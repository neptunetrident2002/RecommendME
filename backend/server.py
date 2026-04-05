from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"

def get_jwt_secret():
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=24), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("is_banned"):
            raise HTTPException(status_code=403, detail="Account banned")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

def user_to_dict(user: dict) -> dict:
    u = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    u["id"] = str(user["_id"]) if isinstance(user.get("_id"), ObjectId) else user.get("_id", str(user.get("id", "")))
    return u

# ── App Setup ──
app = FastAPI()
api = APIRouter(prefix="/api")

# ── Pydantic Models ──
class RegisterBody(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None
    city: Optional[str] = None

class LoginBody(BaseModel):
    email: str
    password: str

class RecommendationCreate(BaseModel):
    title: str
    author: Optional[str] = None
    category: str  # read / listen / watch
    url: Optional[str] = None
    why_note: str

class SetDefaultRec(BaseModel):
    recommendation_id: str

class EnterPoolBody(BaseModel):
    category: str
    recommendation_id: Optional[str] = None

class WriteRecForMatch(BaseModel):
    match_id: str
    title: str
    author: Optional[str] = None
    url: Optional[str] = None
    why_note: str

class FollowBody(BaseModel):
    match_id: str

class ListEntryUpdate(BaseModel):
    completion_status: Optional[str] = None
    user_comment: Optional[str] = None
    is_archived: Optional[bool] = None
    completion_date: Optional[str] = None

class LinkSubmission(BaseModel):
    category: str
    title: str
    author: Optional[str] = None
    why_note: str

class ReportCreate(BaseModel):
    reported_user_id: str
    match_id: Optional[str] = None
    reason: str
    detail: Optional[str] = None

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    city: Optional[str] = None

# ── AUTH ROUTES ──
@api.post("/auth/register")
async def register(body: RegisterBody, response: Response):
    email = body.email.strip().lower()
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "display_name": body.display_name or "",
        "city": body.city or "",
        "is_pro": False,
        "is_admin": False,
        "is_banned": False,
        "default_rec_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "matches_used": 0,
        "max_matches": 3,
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    access = create_access_token(str(result.inserted_id), email)
    refresh = create_refresh_token(str(result.inserted_id))
    set_auth_cookies(response, access, refresh)
    return {**user_to_dict(user_doc), "access_token": access}

@api.post("/auth/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.strip().lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    # Brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        # Increment attempts
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True
        )
        raise HTTPException(401, "Invalid email or password")
    if user.get("is_banned"):
        raise HTTPException(403, "Account banned")
    await db.login_attempts.delete_one({"identifier": identifier})
    uid = str(user["_id"])
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {**user_to_dict(user), "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_to_dict({"_id": ObjectId(user["_id"]) if not isinstance(user["_id"], ObjectId) else user["_id"], **{k: v for k, v in user.items() if k != "_id"}})

@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        access = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie(key="access_token", value=access, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

@api.put("/auth/profile")
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {}
    if body.display_name is not None:
        updates["display_name"] = body.display_name
    if body.city is not None:
        updates["city"] = body.city
    if updates:
        await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": updates})
    updated = await db.users.find_one({"_id": ObjectId(user["_id"])})
    return user_to_dict(updated)

# ── RECOMMENDATIONS ──
@api.post("/recommendations")
async def create_recommendation(body: RecommendationCreate, user: dict = Depends(get_current_user)):
    if body.category not in ("read", "listen", "watch"):
        raise HTTPException(400, "Category must be read, listen, or watch")
    if len(body.why_note) < 20:
        raise HTTPException(400, "Why-note must be at least 20 characters")
    doc = {
        "user_id": user["_id"],
        "title": body.title,
        "author": body.author or "",
        "category": body.category,
        "url": body.url or "",
        "why_note": body.why_note,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_default": False,
    }
    result = await db.recommendations.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@api.get("/recommendations/mine")
async def get_my_recommendations(user: dict = Depends(get_current_user)):
    recs = await db.recommendations.find({"user_id": user["_id"]}).to_list(100)
    out = []
    for r in recs:
        r["id"] = str(r["_id"])
        r.pop("_id", None)
        out.append(r)
    return out

@api.post("/recommendations/set-default")
async def set_default_recommendation(body: SetDefaultRec, user: dict = Depends(get_current_user)):
    # Unset all defaults for this user
    await db.recommendations.update_many({"user_id": user["_id"]}, {"$set": {"is_default": False}})
    await db.recommendations.update_one({"_id": ObjectId(body.recommendation_id), "user_id": user["_id"]}, {"$set": {"is_default": True}})
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"default_rec_id": body.recommendation_id}})
    return {"ok": True}

@api.get("/recommendations/default")
async def get_default_recommendation(user: dict = Depends(get_current_user)):
    rec = await db.recommendations.find_one({"user_id": user["_id"], "is_default": True})
    if not rec:
        return {"recommendation": None}
    rec["id"] = str(rec["_id"])
    rec.pop("_id", None)
    return {"recommendation": rec}

# ── MATCHING POOL ──
@api.post("/matching/enter")
async def enter_pool(body: EnterPoolBody, user: dict = Depends(get_current_user)):
    if body.category not in ("read", "listen", "watch"):
        raise HTTPException(400, "Invalid category")
    # Check match limit for free users
    if not user.get("is_pro") and user.get("matches_used", 0) >= user.get("max_matches", 3):
        raise HTTPException(403, "Match limit reached. Upgrade to Pro for unlimited matches.")
    # Check if user has a recommendation ready
    rec_id = body.recommendation_id or user.get("default_rec_id")
    if rec_id:
        rec = await db.recommendations.find_one({"_id": ObjectId(rec_id), "user_id": user["_id"]})
        if not rec:
            raise HTTPException(400, "Recommendation not found")
    # Remove any existing pool entry
    await db.matching_pool.delete_many({"user_id": user["_id"]})
    pool_entry = {
        "user_id": user["_id"],
        "category": body.category,
        "recommendation_id": rec_id,
        "entered_at": datetime.now(timezone.utc).isoformat(),
        "status": "waiting",
    }
    await db.matching_pool.insert_one(pool_entry)
    return {"status": "waiting", "message": "You're in the pool"}

@api.get("/matching/pool-count/{category}")
async def pool_count(category: str):
    count = await db.matching_pool.count_documents({"category": category, "status": "waiting"})
    return {"category": category, "count": count}

@api.get("/matching/check")
async def check_match(user: dict = Depends(get_current_user)):
    # Check if user is in pool
    my_entry = await db.matching_pool.find_one({"user_id": user["_id"], "status": "waiting"})
    if not my_entry:
        # Check if user was already matched
        match = await db.matches.find_one({
            "$or": [{"user_a_id": user["_id"]}, {"user_b_id": user["_id"]}],
            "status": {"$in": ["pending", "active"]}
        }, sort=[("created_at", -1)])
        if match:
            match["id"] = str(match["_id"])
            match.pop("_id", None)
            return {"status": "matched", "match": match}
        return {"status": "not_in_pool"}
    # Try to find another person in the same category
    other = await db.matching_pool.find_one({
        "category": my_entry["category"],
        "status": "waiting",
        "user_id": {"$ne": user["_id"]}
    })
    if other:
        # Create a match
        now = datetime.now(timezone.utc).isoformat()
        match_doc = {
            "user_a_id": user["_id"],
            "user_b_id": other["user_id"],
            "category": my_entry["category"],
            "status": "pending",  # pending = need recs locked, active = revealed
            "created_at": now,
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
            "rec_a_id": my_entry.get("recommendation_id"),
            "rec_b_id": other.get("recommendation_id"),
            "revealed_at": None,
        }
        result = await db.matches.insert_one(match_doc)
        # Remove both from pool
        await db.matching_pool.delete_many({"user_id": {"$in": [user["_id"], other["user_id"]]}})
        # Increment matches_used for both
        await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"matches_used": 1}})
        await db.users.update_one({"_id": ObjectId(other["user_id"])}, {"$inc": {"matches_used": 1}})
        match_doc["id"] = str(result.inserted_id)
        match_doc.pop("_id", None)
        return {"status": "matched", "match": match_doc}
    return {"status": "waiting"}

@api.post("/matching/cancel")
async def cancel_matching(user: dict = Depends(get_current_user)):
    await db.matching_pool.delete_many({"user_id": user["_id"]})
    return {"ok": True}

@api.post("/matching/write-rec")
async def write_rec_for_match(body: WriteRecForMatch, user: dict = Depends(get_current_user)):
    if len(body.why_note) < 20:
        raise HTTPException(400, "Why-note must be at least 20 characters")
    match = await db.matches.find_one({"_id": ObjectId(body.match_id)})
    if not match:
        raise HTTPException(404, "Match not found")
    if user["_id"] not in (match["user_a_id"], match["user_b_id"]):
        raise HTTPException(403, "Not your match")
    # Create the recommendation
    doc = {
        "user_id": user["_id"],
        "title": body.title,
        "author": body.author or "",
        "category": match["category"],
        "url": body.url or "",
        "why_note": body.why_note,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_default": False,
    }
    result = await db.recommendations.insert_one(doc)
    rec_id = str(result.inserted_id)
    # Update match with this rec
    field = "rec_a_id" if user["_id"] == match["user_a_id"] else "rec_b_id"
    await db.matches.update_one({"_id": ObjectId(body.match_id)}, {"$set": {field: rec_id}})
    return {"ok": True, "recommendation_id": rec_id}

@api.post("/matching/reveal/{match_id}")
async def reveal_match(match_id: str, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"_id": ObjectId(match_id)})
    if not match:
        raise HTTPException(404, "Match not found")
    if user["_id"] not in (match["user_a_id"], match["user_b_id"]):
        raise HTTPException(403, "Not your match")
    # Both must have recommendations
    if not match.get("rec_a_id") or not match.get("rec_b_id"):
        raise HTTPException(400, "Both users must have recommendations before reveal")
    # Update match status to active and set revealed_at
    now = datetime.now(timezone.utc).isoformat()
    expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    await db.matches.update_one(
        {"_id": ObjectId(match_id)},
        {"$set": {"status": "active", "revealed_at": now, "expires_at": expires}}
    )
    # Get both recommendations
    is_a = user["_id"] == match["user_a_id"]
    other_rec_id = match["rec_b_id"] if is_a else match["rec_a_id"]
    my_rec_id = match["rec_a_id"] if is_a else match["rec_b_id"]
    other_rec = await db.recommendations.find_one({"_id": ObjectId(other_rec_id)})
    my_rec = await db.recommendations.find_one({"_id": ObjectId(my_rec_id)}) if my_rec_id else None
    # Get other user's city
    other_user_id = match["user_b_id"] if is_a else match["user_a_id"]
    other_user = await db.users.find_one({"_id": ObjectId(other_user_id)})
    # Create list entry for the user
    existing_entry = await db.list_entries.find_one({"user_id": user["_id"], "recommendation_id": other_rec_id, "match_id": match_id})
    if not existing_entry:
        list_entry = {
            "user_id": user["_id"],
            "recommendation_id": other_rec_id,
            "match_id": match_id,
            "source_type": "match",
            "received_at": now,
            "completion_status": "not_started",
            "completion_date": None,
            "user_comment": "",
            "is_archived": False,
        }
        await db.list_entries.insert_one(list_entry)
    if other_rec:
        other_rec["id"] = str(other_rec["_id"])
        other_rec.pop("_id", None)
    if my_rec:
        my_rec["id"] = str(my_rec["_id"])
        my_rec.pop("_id", None)
    match_data = {k: v for k, v in match.items() if k != "_id"}
    match_data["id"] = match_id
    match_data["status"] = "active"
    match_data["revealed_at"] = now
    match_data["expires_at"] = expires
    return {
        "match": match_data,
        "their_recommendation": other_rec,
        "my_recommendation": my_rec,
        "their_city": other_user.get("city", "") if other_user else "",
    }

@api.get("/matching/exchange/{match_id}")
async def get_exchange(match_id: str, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"_id": ObjectId(match_id)})
    if not match:
        raise HTTPException(404, "Match not found")
    if user["_id"] not in (match["user_a_id"], match["user_b_id"]):
        raise HTTPException(403, "Not your match")
    is_a = user["_id"] == match["user_a_id"]
    other_rec_id = match["rec_b_id"] if is_a else match["rec_a_id"]
    my_rec_id = match["rec_a_id"] if is_a else match["rec_b_id"]
    other_rec = await db.recommendations.find_one({"_id": ObjectId(other_rec_id)}) if other_rec_id else None
    my_rec = await db.recommendations.find_one({"_id": ObjectId(my_rec_id)}) if my_rec_id else None
    other_user_id = match["user_b_id"] if is_a else match["user_a_id"]
    other_user = await db.users.find_one({"_id": ObjectId(other_user_id)})
    # Check follow status
    my_follow = await db.follows.find_one({"follower_id": user["_id"], "match_id": match_id})
    their_follow = await db.follows.find_one({"follower_id": other_user_id, "match_id": match_id})
    # Check connection
    connection = await db.connections.find_one({
        "$or": [
            {"user_a_id": user["_id"], "user_b_id": other_user_id, "ended_at": None},
            {"user_a_id": other_user_id, "user_b_id": user["_id"], "ended_at": None}
        ]
    })
    if other_rec:
        other_rec["id"] = str(other_rec["_id"])
        other_rec.pop("_id", None)
    if my_rec:
        my_rec["id"] = str(my_rec["_id"])
        my_rec.pop("_id", None)
    match_data = {k: v for k, v in match.items() if k != "_id"}
    match_data["id"] = match_id
    return {
        "match": match_data,
        "their_recommendation": other_rec if match.get("status") == "active" else None,
        "my_recommendation": my_rec,
        "their_city": other_user.get("city", "") if other_user else "",
        "i_followed": my_follow is not None,
        "they_followed": their_follow is not None,
        "is_connected": connection is not None,
        "needs_my_rec": (is_a and not match.get("rec_a_id")) or (not is_a and not match.get("rec_b_id")),
    }

# ── FOLLOW & CONNECTIONS ──
@api.post("/follow")
async def follow_user(body: FollowBody, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"_id": ObjectId(body.match_id)})
    if not match:
        raise HTTPException(404, "Match not found")
    if match.get("status") != "active":
        raise HTTPException(400, "Match is not active")
    # Check 24h window
    if match.get("expires_at"):
        expires = datetime.fromisoformat(match["expires_at"])
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(400, "Follow window has expired")
    # Check if already followed
    existing = await db.follows.find_one({"follower_id": user["_id"], "match_id": body.match_id})
    if existing:
        raise HTTPException(400, "Already followed")
    is_a = user["_id"] == match["user_a_id"]
    other_user_id = match["user_b_id"] if is_a else match["user_a_id"]
    await db.follows.insert_one({
        "follower_id": user["_id"],
        "followee_id": other_user_id,
        "match_id": body.match_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # Check if mutual follow → create connection
    mutual = await db.follows.find_one({"follower_id": other_user_id, "match_id": body.match_id})
    if mutual:
        existing_conn = await db.connections.find_one({
            "$or": [
                {"user_a_id": user["_id"], "user_b_id": other_user_id, "ended_at": None},
                {"user_a_id": other_user_id, "user_b_id": user["_id"], "ended_at": None}
            ]
        })
        if not existing_conn:
            await db.connections.insert_one({
                "user_a_id": user["_id"],
                "user_b_id": other_user_id,
                "formed_at": datetime.now(timezone.utc).isoformat(),
                "ended_at": None,
                "match_id": body.match_id,
            })
            await db.matches.update_one({"_id": ObjectId(body.match_id)}, {"$set": {"status": "completed"}})
        return {"ok": True, "connection_formed": True}
    return {"ok": True, "connection_formed": False}

@api.get("/connections")
async def get_connections(user: dict = Depends(get_current_user)):
    connections = await db.connections.find({
        "$or": [{"user_a_id": user["_id"]}, {"user_b_id": user["_id"]}],
        "ended_at": None
    }).to_list(100)
    result = []
    for c in connections:
        other_id = c["user_b_id"] if c["user_a_id"] == user["_id"] else c["user_a_id"]
        other = await db.users.find_one({"_id": ObjectId(other_id)})
        result.append({
            "id": str(c["_id"]),
            "other_user": {"id": other_id, "display_name": other.get("display_name", ""), "city": other.get("city", "")} if other else None,
            "formed_at": c["formed_at"],
            "match_id": c.get("match_id", ""),
        })
    return result

@api.post("/connections/{connection_id}/disconnect")
async def disconnect(connection_id: str, user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"_id": ObjectId(connection_id)})
    if not conn:
        raise HTTPException(404, "Connection not found")
    if user["_id"] not in (conn["user_a_id"], conn["user_b_id"]):
        raise HTTPException(403, "Not your connection")
    await db.connections.update_one({"_id": ObjectId(connection_id)}, {"$set": {"ended_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}

# ── THE LIST ──
@api.get("/list")
async def get_my_list(
    user: dict = Depends(get_current_user),
    category: Optional[str] = None,
    source_type: Optional[str] = None,
    completion_status: Optional[str] = None,
    search: Optional[str] = None,
    show_archived: bool = False,
):
    query = {"user_id": user["_id"]}
    if not show_archived:
        query["is_archived"] = {"$ne": True}
    if source_type:
        query["source_type"] = source_type
    if completion_status:
        query["completion_status"] = completion_status
    entries = await db.list_entries.find(query).sort("received_at", -1).to_list(100)
    result = []
    for e in entries:
        rec = await db.recommendations.find_one({"_id": ObjectId(e["recommendation_id"])}) if e.get("recommendation_id") else None
        if rec:
            if category and rec.get("category") != category:
                continue
            if search and search.lower() not in rec.get("title", "").lower():
                continue
            rec_data = {k: v for k, v in rec.items() if k != "_id"}
            rec_data["id"] = str(rec["_id"])
        else:
            rec_data = None
        entry_data = {k: v for k, v in e.items() if k != "_id"}
        entry_data["id"] = str(e["_id"])
        entry_data["recommendation"] = rec_data
        result.append(entry_data)
    return result

@api.put("/list/{entry_id}")
async def update_list_entry(entry_id: str, body: ListEntryUpdate, user: dict = Depends(get_current_user)):
    entry = await db.list_entries.find_one({"_id": ObjectId(entry_id), "user_id": user["_id"]})
    if not entry:
        raise HTTPException(404, "Entry not found")
    updates = {}
    if body.completion_status is not None:
        updates["completion_status"] = body.completion_status
    if body.user_comment is not None:
        updates["user_comment"] = body.user_comment
    if body.is_archived is not None:
        updates["is_archived"] = body.is_archived
    if body.completion_date is not None:
        updates["completion_date"] = body.completion_date
    if updates:
        await db.list_entries.update_one({"_id": ObjectId(entry_id)}, {"$set": updates})
    return {"ok": True}

@api.get("/list/stats")
async def list_stats(user: dict = Depends(get_current_user)):
    total = await db.list_entries.count_documents({"user_id": user["_id"], "is_archived": {"$ne": True}})
    completed = await db.list_entries.count_documents({"user_id": user["_id"], "completion_status": "completed"})
    in_progress = await db.list_entries.count_documents({"user_id": user["_id"], "completion_status": "in_progress"})
    # Category counts
    entries = await db.list_entries.find({"user_id": user["_id"]}).to_list(1000)
    cat_counts = {"read": 0, "listen": 0, "watch": 0}
    for e in entries:
        if e.get("recommendation_id"):
            rec = await db.recommendations.find_one({"_id": ObjectId(e["recommendation_id"])}, {"category": 1})
            if rec and rec.get("category") in cat_counts:
                cat_counts[rec["category"]] += 1
    return {"total": total, "completed": completed, "in_progress": in_progress, "categories": cat_counts}

# ── SHAREABLE LINKS ──
@api.post("/shareable-link/generate")
async def generate_shareable_link(user: dict = Depends(get_current_user)):
    existing = await db.shareable_links.find_one({"user_id": user["_id"]})
    if existing:
        existing["id"] = str(existing["_id"])
        existing.pop("_id", None)
        return existing
    token = secrets.token_urlsafe(8)
    doc = {
        "user_id": user["_id"],
        "token": token,
        "default_rec_id": user.get("default_rec_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.shareable_links.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

@api.get("/shareable-link/{token}")
async def get_shareable_link(token: str):
    link = await db.shareable_links.find_one({"token": token})
    if not link:
        raise HTTPException(404, "Link not found")
    # Get owner's default rec
    owner = await db.users.find_one({"_id": ObjectId(link["user_id"])})
    default_rec = None
    if owner and owner.get("default_rec_id"):
        rec = await db.recommendations.find_one({"_id": ObjectId(owner["default_rec_id"])})
        if rec:
            default_rec = {k: v for k, v in rec.items() if k != "_id"}
            default_rec["id"] = str(rec["_id"])
    return {
        "token": token,
        "owner_display_name": owner.get("display_name", "Someone") if owner else "Someone",
        "has_default_rec": default_rec is not None,
    }

@api.post("/shareable-link/{token}/submit")
async def submit_via_link(token: str, body: LinkSubmission, request: Request):
    if len(body.why_note) < 20:
        raise HTTPException(400, "Why-note must be at least 20 characters")
    link = await db.shareable_links.find_one({"token": token})
    if not link:
        raise HTTPException(404, "Link not found")
    import hashlib
    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()
    # Create recommendation
    rec_doc = {
        "user_id": "anonymous",
        "title": body.title,
        "author": body.author or "",
        "category": body.category,
        "url": "",
        "why_note": body.why_note,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_default": False,
    }
    rec_result = await db.recommendations.insert_one(rec_doc)
    rec_id = str(rec_result.inserted_id)
    # Save submission
    await db.link_submissions.insert_one({
        "link_id": str(link["_id"]),
        "category": body.category,
        "title": body.title,
        "author": body.author or "",
        "why_note": body.why_note,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "ip_hash": ip_hash,
        "recommendation_id": rec_id,
    })
    # Create list entry for the link owner
    await db.list_entries.insert_one({
        "user_id": link["user_id"],
        "recommendation_id": rec_id,
        "match_id": None,
        "source_type": "link",
        "received_at": datetime.now(timezone.utc).isoformat(),
        "completion_status": "not_started",
        "completion_date": None,
        "user_comment": "",
        "is_archived": False,
    })
    # Return owner's default rec as reward
    owner = await db.users.find_one({"_id": ObjectId(link["user_id"])})
    reward_rec = None
    if owner and owner.get("default_rec_id"):
        rec = await db.recommendations.find_one({"_id": ObjectId(owner["default_rec_id"])})
        if rec:
            reward_rec = {"title": rec["title"], "author": rec.get("author", ""), "category": rec["category"], "why_note": rec["why_note"]}
    return {"ok": True, "reward_recommendation": reward_rec}

# ── REPORTS ──
@api.post("/reports")
async def create_report(body: ReportCreate, user: dict = Depends(get_current_user)):
    doc = {
        "reporter_id": user["_id"],
        "reported_user_id": body.reported_user_id,
        "match_id": body.match_id,
        "reason": body.reason,
        "detail": body.detail or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None,
        "resolved_by": None,
    }
    await db.reports.insert_one(doc)
    return {"ok": True}

# ── ADMIN ──
@api.get("/admin/metrics")
async def admin_metrics(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    total_users = await db.users.count_documents({})
    total_matches = await db.matches.count_documents({})
    completed_matches = await db.matches.count_documents({"status": "completed"})
    active_matches = await db.matches.count_documents({"status": "active"})
    total_follows = await db.follows.count_documents({})
    total_connections = await db.connections.count_documents({"ended_at": None})
    total_list_entries = await db.list_entries.count_documents({})
    total_completions = await db.list_entries.count_documents({"completion_status": "completed"})
    total_reports = await db.reports.count_documents({})
    open_reports = await db.reports.count_documents({"resolved_at": None})
    total_link_submissions = await db.link_submissions.count_documents({})
    total_shareable_links = await db.shareable_links.count_documents({})
    pro_users = await db.users.count_documents({"is_pro": True})
    banned_users = await db.users.count_documents({"is_banned": True})
    pool_count = await db.matching_pool.count_documents({"status": "waiting"})
    follow_rate = 0
    if total_matches > 0:
        matches_with_follows = await db.follows.distinct("match_id")
        follow_rate = round(len(matches_with_follows) / total_matches * 100, 1)
    mutual_rate = 0
    if total_matches > 0:
        mutual_rate = round(total_connections / total_matches * 100, 1) if total_matches > 0 else 0
    return {
        "total_users": total_users,
        "pro_users": pro_users,
        "banned_users": banned_users,
        "total_matches": total_matches,
        "completed_matches": completed_matches,
        "active_matches": active_matches,
        "total_follows": total_follows,
        "total_connections": total_connections,
        "total_list_entries": total_list_entries,
        "total_completions": total_completions,
        "total_reports": total_reports,
        "open_reports": open_reports,
        "total_link_submissions": total_link_submissions,
        "total_shareable_links": total_shareable_links,
        "follow_rate": follow_rate,
        "mutual_follow_rate": mutual_rate,
        "pool_count": pool_count,
    }

@api.get("/admin/reports")
async def admin_reports(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    reports = await db.reports.find({}).sort("created_at", -1).to_list(100)
    result = []
    for r in reports:
        r["id"] = str(r["_id"])
        r.pop("_id", None)
        result.append(r)
    return result

@api.post("/admin/ban/{user_id}")
async def ban_user(user_id: str, user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_banned": True}})
    return {"ok": True}

@api.post("/admin/unban/{user_id}")
async def unban_user(user_id: str, user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_banned": False}})
    return {"ok": True}

@api.post("/admin/resolve-report/{report_id}")
async def resolve_report(report_id: str, user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    await db.reports.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {"resolved_at": datetime.now(timezone.utc).isoformat(), "resolved_by": user["_id"]}}
    )
    return {"ok": True}

@api.get("/admin/users")
async def admin_users(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    users = await db.users.find({}, {"password_hash": 0}).to_list(1000)
    result = []
    for u in users:
        u["id"] = str(u["_id"])
        u.pop("_id", None)
        result.append(u)
    return result

# ── ACTIVE MATCHES ──
@api.get("/matches/active")
async def get_active_matches(user: dict = Depends(get_current_user)):
    matches = await db.matches.find({
        "$or": [{"user_a_id": user["_id"]}, {"user_b_id": user["_id"]}],
        "status": {"$in": ["pending", "active"]}
    }).sort("created_at", -1).to_list(20)
    result = []
    for m in matches:
        m["id"] = str(m["_id"])
        m.pop("_id", None)
        result.append(m)
    return result

# ── Include Router ──
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Startup ──
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.matching_pool.create_index("category")
    await db.matching_pool.create_index("user_id")
    await db.shareable_links.create_index("token", unique=True)
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@recommendme.app")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "display_name": "Admin",
            "city": "",
            "is_pro": True,
            "is_admin": True,
            "is_banned": False,
            "default_rec_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "matches_used": 0,
            "max_matches": 999,
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")
    # Write test credentials
    try:
        Path("/app/memory").mkdir(exist_ok=True)
        with open("/app/memory/test_credentials.md", "w") as f:
            f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n")
    except Exception as e:
        logger.warning(f"Could not write test credentials: {e}")

@app.on_event("shutdown")
async def shutdown():
    client.close()
