from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, BackgroundTasks, Header
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import re
import logging
import bcrypt
import jwt
import secrets
import hashlib
import json
import asyncio
import httpx
import uuid
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta

# ── Config ──
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
JWT_ALGORITHM = "HS256"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
CRON_SECRET = os.environ.get("CRON_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Groq client ──
groq_client = None
if GROQ_API_KEY:
    try:
        from groq import AsyncGroq
        groq_client = AsyncGroq(api_key=GROQ_API_KEY)
        logger.info("Groq client initialized")
    except Exception as e:
        logger.warning(f"Could not init Groq: {e}")

# ── Resend client ──
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
if RESEND_API_KEY:
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        logger.info("Resend configured")
    except Exception as e:
        logger.warning(f"Could not init Resend: {e}")

# ── Genre normalisation ──
GENRE_SUBSTITUTIONS = {
    "r&b": "rhythm and blues", "d&b": "drum and bass", "dnb": "drum and bass",
    "2-step": "two step", "2step": "two step",
    "ukg": "uk garage", "bm": "black metal", "dm": "death metal",
    "gn": "graphic novel", "mg": "middle grade", "na": "new adult", "ya": "young adult",
}

def normalise_genre(raw: str) -> str:
    if not raw or not raw.strip():
        return ""
    val = raw.strip()
    low = val.lower()
    if low in GENRE_SUBSTITUTIONS:
        val = GENRE_SUBSTITUTIONS[low]
    val = val.lower()
    val = val.replace("-", " ").replace("&", " ")
    val = re.sub(r"[^a-z ]", "", val)
    val = re.sub(r" +", " ", val).strip()
    return val

# ── Auth helpers ──
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

def user_to_public(user: dict) -> dict:
    uid = str(user["_id"]) if isinstance(user.get("_id"), ObjectId) else user.get("_id", "")
    return {
        "id": uid,
        "email": user.get("email", ""),
        "display_name": user.get("display_name", ""),
        "city": user.get("city", ""),
        "is_pro": user.get("is_pro", False),
        "is_admin": user.get("is_admin", False),
        "is_banned": user.get("is_banned", False),
        "is_public": user.get("is_public", False),
        "public_handle": user.get("public_handle", ""),
        "default_rec_read": user.get("default_rec_read"),
        "default_rec_read_set_at": user.get("default_rec_read_set_at"),
        "default_rec_listen": user.get("default_rec_listen"),
        "default_rec_listen_set_at": user.get("default_rec_listen_set_at"),
        "default_rec_watch": user.get("default_rec_watch"),
        "default_rec_watch_set_at": user.get("default_rec_watch_set_at"),
        "match_count": user.get("match_count", 0),
        "match_count_date": user.get("match_count_date"),
        "known_blend_invites_sent": user.get("known_blend_invites_sent", 0),
        "social_handle": user.get("social_handle", ""),
        "social_platform": user.get("social_platform"),
        "email_opt_out": user.get("email_opt_out", []),
        "is_guest": user.get("is_guest", False),
        "auth_provider": user.get("auth_provider", "email"),
    }

def rec_to_dict(rec: dict) -> dict:
    if not rec:
        return None
    r = {k: v for k, v in rec.items() if k != "_id"}
    r["id"] = str(rec["_id"])
    return r

def check_weekly_default_valid(set_at) -> bool:
    if not set_at:
        return False
    if isinstance(set_at, str):
        set_at = datetime.fromisoformat(set_at)
    return (datetime.now(timezone.utc) - set_at) < timedelta(hours=168)

async def check_and_reset_match_cap(user: dict) -> tuple:
    """Returns (current_count, max_count, can_match)"""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    uid = user["_id"] if isinstance(user["_id"], ObjectId) else ObjectId(user["_id"])
    if user.get("match_count_date") != today_str:
        await db.users.update_one({"_id": uid}, {"$set": {"match_count": 0, "match_count_date": today_str}})
        user["match_count"] = 0
    max_m = 10 if user.get("is_pro") else 3
    return user.get("match_count", 0), max_m, user.get("match_count", 0) < max_m

# ── App Setup ──
app = FastAPI()
api = APIRouter(prefix="/api")

# ── Pydantic Models ──
class RegisterBody(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None
    city: Optional[str] = None
    referral_source: Optional[str] = None

class LoginBody(BaseModel):
    email: str
    password: str

class RecommendationCreate(BaseModel):
    title: str
    author: Optional[str] = None
    category: str
    genre: Optional[str] = None
    url: Optional[str] = None
    why_note: str

class SetWeeklyDefault(BaseModel):
    recommendation_id: str
    category: str

class EnterPoolBody(BaseModel):
    category: str
    recommendation_id: Optional[str] = None
    request_note: Optional[str] = None

class WriteRecForMatch(BaseModel):
    match_id: str
    title: str
    author: Optional[str] = None
    genre: Optional[str] = None
    url: Optional[str] = None
    why_note: str

class FollowBody(BaseModel):
    match_id: str

class DownvoteBody(BaseModel):
    match_id: str

class ListEntryUpdate(BaseModel):
    completion_status: Optional[str] = None
    user_comment: Optional[str] = None
    is_archived: Optional[bool] = None
    completion_date: Optional[str] = None
    show_note_publicly: Optional[bool] = None

class LinkSubmission(BaseModel):
    category: str
    title: str
    author: Optional[str] = None
    why_note: str

class RecExchangeSubmission(BaseModel):
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
    public_handle: Optional[str] = None
    is_public: Optional[bool] = None
    social_handle: Optional[str] = None
    social_platform: Optional[str] = None
    email_opt_out: Optional[List[str]] = None

class BlockBody(BaseModel):
    user_id: str

class BroadcastCreate(BaseModel):
    category: str
    request_text: str

class BroadcastResponseBody(BaseModel):
    broadcast_id: str
    title: str
    author: Optional[str] = None
    genre: Optional[str] = None
    url: Optional[str] = None
    why_note: str

class ConnectionExchangeBody(BaseModel):
    connection_id: str
    title: str
    author: Optional[str] = None
    genre: Optional[str] = None
    url: Optional[str] = None
    why_note: str

class WaitlistBody(BaseModel):
    email: str
    referral_source: Optional[str] = None

class RecExchangeLinkCreate(BaseModel):
    recommendation_id: str

class KnownBlendInviteAccept(BaseModel):
    token: str

class GoogleCallbackBody(BaseModel):
    session_id: str
    referral_source: Optional[str] = None

class GuestConvertBody(BaseModel):
    guest_id: str
    email: str
    password: str
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
        "email": email, "password_hash": hash_password(body.password),
        "display_name": body.display_name or "", "city": body.city or "",
        "is_pro": False, "is_admin": False, "is_banned": False,
        "public_handle": "", "is_public": False,
        "default_rec_read": None, "default_rec_read_set_at": None,
        "default_rec_listen": None, "default_rec_listen_set_at": None,
        "default_rec_watch": None, "default_rec_watch_set_at": None,
        "match_count": 0, "match_count_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "known_blend_invites_sent": 0,
        "social_handle": "", "social_platform": None,
        "invited_by": None, "referral_source": body.referral_source or "",
        "email_opt_out": [], "auth_provider": "email",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    access = create_access_token(str(result.inserted_id), email)
    refresh = create_refresh_token(str(result.inserted_id))
    set_auth_cookies(response, access, refresh)
    return {**user_to_public(user_doc), "access_token": access}

@api.post("/auth/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.strip().lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True)
        raise HTTPException(401, "Invalid email or password")
    if user.get("is_banned"):
        raise HTTPException(403, "Account banned")
    await db.login_attempts.delete_one({"identifier": identifier})
    uid = str(user["_id"])
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {**user_to_public(user), "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_to_public({"_id": user["_id"], **{k: v for k, v in user.items() if k != "_id"}})

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
    uid = ObjectId(user["_id"])
    if body.display_name is not None:
        updates["display_name"] = body.display_name
    if body.city is not None:
        updates["city"] = body.city
    if body.public_handle is not None:
        if body.public_handle:
            existing = await db.users.find_one({"public_handle": body.public_handle, "_id": {"$ne": uid}})
            if existing:
                raise HTTPException(400, "Handle already taken")
        updates["public_handle"] = body.public_handle
    if body.is_public is not None:
        updates["is_public"] = body.is_public
    if body.social_handle is not None:
        updates["social_handle"] = body.social_handle
    if body.social_platform is not None:
        if body.social_platform and body.social_platform not in ("instagram", "snapchat", "x"):
            raise HTTPException(400, "Platform must be instagram, snapchat, or x")
        updates["social_platform"] = body.social_platform
    if body.email_opt_out is not None:
        # Only allow opt-out for triggers that support it
        valid_triggers = [k for k, v in EMAIL_TRIGGERS.items() if v] + ["all"]
        updates["email_opt_out"] = [t for t in body.email_opt_out if t in valid_triggers]
    if updates:
        await db.users.update_one({"_id": uid}, {"$set": updates})
    updated = await db.users.find_one({"_id": uid})
    return user_to_public(updated)

# ── GOOGLE OAUTH ──
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
@api.post("/auth/google-callback")
async def google_callback(body: GoogleCallbackBody, response: Response):
    """Exchange Emergent OAuth session_id for app JWT tokens."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": body.session_id},
                timeout=10.0,
            )
        if resp.status_code != 200:
            raise HTTPException(400, "Invalid or expired session")
        google_data = resp.json()
    except httpx.HTTPError:
        raise HTTPException(502, "Failed to verify Google session")

    email = google_data.get("email", "").strip().lower()
    name = google_data.get("name", "")
    if not email:
        raise HTTPException(400, "No email returned from Google")

    user = await db.users.find_one({"email": email})
    if user:
        uid = str(user["_id"])
        if not user.get("display_name") and name:
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"display_name": name}})
    else:
        user_doc = {
            "email": email, "password_hash": "",
            "display_name": name, "city": "",
            "is_pro": False, "is_admin": False, "is_banned": False,
            "public_handle": "", "is_public": False,
            "default_rec_read": None, "default_rec_read_set_at": None,
            "default_rec_listen": None, "default_rec_listen_set_at": None,
            "default_rec_watch": None, "default_rec_watch_set_at": None,
            "match_count": 0, "match_count_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "known_blend_invites_sent": 0,
            "social_handle": "", "social_platform": None,
            "invited_by": None, "referral_source": body.referral_source or "google",
            "email_opt_out": [],
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await db.users.insert_one(user_doc)
        uid = str(result.inserted_id)

    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    user = await db.users.find_one({"_id": ObjectId(uid)})
    return {**user_to_public(user), "access_token": access}

# ── ANONYMOUS GUEST SESSION ──
class GuestSessionBody(BaseModel):
    referral_source: Optional[str] = None

@api.post("/auth/guest")
async def create_guest_session(body: GuestSessionBody = GuestSessionBody()):
    """Create an anonymous guest with localStorage UUID. 1 match allowed."""
    guest_id = f"guest_{uuid.uuid4().hex[:12]}"
    guest_doc = {
        "email": f"{guest_id}@guest.local", "password_hash": "",
        "display_name": "Guest", "city": "",
        "is_pro": False, "is_admin": False, "is_banned": False, "is_guest": True,
        "public_handle": "", "is_public": False,
        "default_rec_read": None, "default_rec_read_set_at": None,
        "default_rec_listen": None, "default_rec_listen_set_at": None,
        "default_rec_watch": None, "default_rec_watch_set_at": None,
        "match_count": 0, "match_count_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "known_blend_invites_sent": 0,
        "social_handle": "", "social_platform": None,
        "invited_by": None, "referral_source": body.referral_source or "guest",
        "email_opt_out": [],
        "guest_id": guest_id,
        "guest_match_limit": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.insert_one(guest_doc)
    uid = str(result.inserted_id)
    access = create_access_token(uid, guest_doc["email"])
    return {"guest_id": guest_id, "access_token": access, "user": {**user_to_public({**guest_doc, "_id": result.inserted_id})}}

@api.post("/auth/convert-guest")
async def convert_guest(body: GuestConvertBody, response: Response):
    """Atomically convert guest to registered user, migrating all data."""
    guest = await db.users.find_one({"guest_id": body.guest_id, "is_guest": True})
    if not guest:
        raise HTTPException(404, "Guest session not found")
    email = body.email.strip().lower()
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    existing = await db.users.find_one({"email": email, "is_guest": {"$ne": True}})
    if existing:
        raise HTTPException(400, "Email already registered")
    guest_uid = str(guest["_id"])
    await db.users.update_one({"_id": guest["_id"]}, {"$set": {
        "email": email, "password_hash": hash_password(body.password),
        "display_name": body.display_name or "", "city": body.city or "",
        "is_guest": False, "guest_id": None, "referral_source": "guest_converted",
    }})
    access = create_access_token(guest_uid, email)
    refresh = create_refresh_token(guest_uid)
    set_auth_cookies(response, access, refresh)
    updated = await db.users.find_one({"_id": guest["_id"]})
    return {**user_to_public(updated), "access_token": access}

# ── RECOMMENDATIONS ──
@api.post("/recommendations")
async def create_recommendation(body: RecommendationCreate, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    if body.category not in ("read", "listen", "watch"):
        raise HTTPException(400, "Category must be read, listen, or watch")
    if len(body.why_note) < 20:
        raise HTTPException(400, "Why-note must be at least 20 characters")
    genre = normalise_genre(body.genre) if body.genre else ""
    doc = {
        "user_id": user["_id"], "title": body.title, "author": body.author or "",
        "category": body.category, "genre": genre, "url": body.url or "",
        "og_cache": None, "why_note": body.why_note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.recommendations.insert_one(doc)
    rec_id = str(result.inserted_id)
    # Async genre inference if blank
    if not genre and groq_client:
        background_tasks.add_task(infer_genre_async, rec_id, body.title, body.author or "")
    return {**rec_to_dict({**doc, "_id": result.inserted_id})}

@api.get("/recommendations/mine")
async def get_my_recommendations(user: dict = Depends(get_current_user)):
    recs = await db.recommendations.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(200)
    return [rec_to_dict(r) for r in recs]

@api.delete("/recommendations/{rec_id}")
async def delete_recommendation(rec_id: str, user: dict = Depends(get_current_user)):
    rec = await db.recommendations.find_one({"_id": ObjectId(rec_id), "user_id": user["_id"]})
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    await db.recommendations.delete_one({"_id": ObjectId(rec_id)})
    return {"ok": True}

@api.post("/recommendations/set-weekly-default")
async def set_weekly_default(body: SetWeeklyDefault, user: dict = Depends(get_current_user)):
    if body.category not in ("read", "listen", "watch"):
        raise HTTPException(400, "Invalid category")
    rec = await db.recommendations.find_one({"_id": ObjectId(body.recommendation_id), "user_id": user["_id"]})
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    field_rec = f"default_rec_{body.category}"
    field_set = f"default_rec_{body.category}_set_at"
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {
        field_rec: body.recommendation_id,
        field_set: datetime.now(timezone.utc).isoformat(),
    }})
    return {"ok": True}

@api.get("/recommendations/weekly-defaults")
async def get_weekly_defaults(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"_id": ObjectId(user["_id"])})
    result = {}
    for cat in ("read", "listen", "watch"):
        rec_id = u.get(f"default_rec_{cat}")
        set_at = u.get(f"default_rec_{cat}_set_at")
        valid = check_weekly_default_valid(set_at)
        rec = None
        if rec_id and valid:
            r = await db.recommendations.find_one({"_id": ObjectId(rec_id)})
            rec = rec_to_dict(r) if r else None
        hours_left = 0
        if set_at and valid:
            if isinstance(set_at, str):
                set_at = datetime.fromisoformat(set_at)
            hours_left = max(0, 168 - (datetime.now(timezone.utc) - set_at).total_seconds() / 3600)
        result[cat] = {"recommendation": rec, "valid": valid, "hours_left": round(hours_left, 1)}
    return result

# ── MATCHING POOL ──
@api.post("/matching/enter")
async def enter_pool(body: EnterPoolBody, user: dict = Depends(get_current_user)):
    if body.category not in ("read", "listen", "watch"):
        raise HTTPException(400, "Invalid category")
    count, max_m, can_match = await check_and_reset_match_cap(user)
    if not can_match:
        raise HTTPException(403, f"Match limit reached ({count}/{max_m} today).")
    rec_id = body.recommendation_id
    if not rec_id:
        u = await db.users.find_one({"_id": ObjectId(user["_id"])})
        field = f"default_rec_{body.category}"
        field_set = f"default_rec_{body.category}_set_at"
        if u.get(field) and check_weekly_default_valid(u.get(field_set)):
            rec_id = u[field]
    await db.matching_pool.delete_many({"user_id": user["_id"]})
    pool_entry = {
        "user_id": user["_id"], "category": body.category,
        "rec_id": rec_id, "entered_at": datetime.now(timezone.utc).isoformat(),
        "request_note": body.request_note or "",
    }
    await db.matching_pool.insert_one(pool_entry)
    return {"status": "waiting"}

@api.get("/matching/check")
async def check_match(user: dict = Depends(get_current_user)):
    my_entry = await db.matching_pool.find_one({"user_id": user["_id"]})
    if not my_entry:
        match = await db.matches.find_one({
            "$or": [{"user_a_id": user["_id"]}, {"user_b_id": user["_id"]}],
            "status": {"$in": ["pending", "active"]}
        }, sort=[("created_at", -1)])
        if match:
            return {"status": "matched", "match": {**{k: v for k, v in match.items() if k != "_id"}, "id": str(match["_id"])}}
        return {"status": "not_in_pool"}
    uid = user["_id"]
    # Get blocks and exclusions
    blocks = await db.blocks.find({"$or": [{"blocker_id": uid}, {"blocked_id": uid}]}).to_list(500)
    blocked_ids = set()
    for b in blocks:
        blocked_ids.add(b["blocker_id"])
        blocked_ids.add(b["blocked_id"])
    blocked_ids.discard(uid)
    # Get pending reports
    pending_reports = await db.reports.find({"reporter_id": uid, "resolved_at": None}).to_list(100)
    for r in pending_reports:
        blocked_ids.add(r["reported_user_id"])
    # Get prior matches, follows, connections
    prior_matches = await db.matches.find({"$or": [{"user_a_id": uid}, {"user_b_id": uid}]}).to_list(500)
    for m in prior_matches:
        blocked_ids.add(m["user_a_id"])
        blocked_ids.add(m["user_b_id"])
    blocked_ids.discard(uid)
    exclude_filter = {"category": my_entry["category"], "user_id": {"$ne": uid, "$nin": list(blocked_ids)}}
    pool_size = await db.matching_pool.count_documents(exclude_filter)
    # If pool < 10, relax prior match history
    if pool_size == 0:
        block_only = set()
        for b in blocks:
            block_only.add(b["blocker_id"])
            block_only.add(b["blocked_id"])
        block_only.discard(uid)
        exclude_filter = {"category": my_entry["category"], "user_id": {"$ne": uid, "$nin": list(block_only)}}
    other = await db.matching_pool.find_one(exclude_filter, sort=[("entered_at", 1)])
    if other:
        now = datetime.now(timezone.utc).isoformat()
        match_doc = {
            "user_a_id": uid, "user_b_id": other["user_id"],
            "category": my_entry["category"], "status": "pending",
            "created_at": now, "expires_at": None,
            "rec_a_id": my_entry.get("rec_id"), "rec_b_id": other.get("rec_id"),
            "revealed_at": None, "is_llm_fallback": False,
        }
        result = await db.matches.insert_one(match_doc)
        await db.matching_pool.delete_many({"user_id": {"$in": [uid, other["user_id"]]}})
        await db.users.update_one({"_id": ObjectId(uid)}, {"$inc": {"match_count": 1}})
        await db.users.update_one({"_id": ObjectId(other["user_id"])}, {"$inc": {"match_count": 1}})
        match_doc["id"] = str(result.inserted_id)
        match_doc.pop("_id", None)
        return {"status": "matched", "match": match_doc}
    return {"status": "waiting"}

@api.post("/matching/cancel")
async def cancel_matching(user: dict = Depends(get_current_user)):
    await db.matching_pool.delete_many({"user_id": user["_id"]})
    return {"ok": True}

@api.post("/matching/write-rec")
async def write_rec_for_match(body: WriteRecForMatch, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    if len(body.why_note) < 20:
        raise HTTPException(400, "Why-note must be at least 20 characters")
    match = await db.matches.find_one({"_id": ObjectId(body.match_id)})
    if not match:
        raise HTTPException(404, "Match not found")
    if user["_id"] not in (match["user_a_id"], match["user_b_id"]):
        raise HTTPException(403, "Not your match")
    genre = normalise_genre(body.genre) if body.genre else ""
    doc = {
        "user_id": user["_id"], "title": body.title, "author": body.author or "",
        "category": match["category"], "genre": genre, "url": body.url or "",
        "og_cache": None, "why_note": body.why_note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.recommendations.insert_one(doc)
    rec_id = str(result.inserted_id)
    field = "rec_a_id" if user["_id"] == match["user_a_id"] else "rec_b_id"
    await db.matches.update_one({"_id": ObjectId(body.match_id)}, {"$set": {field: rec_id}})
    if not genre and groq_client:
        background_tasks.add_task(infer_genre_async, rec_id, body.title, body.author or "")
    return {"ok": True, "recommendation_id": rec_id}

@api.post("/matching/reveal/{match_id}")
async def reveal_match(match_id: str, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"_id": ObjectId(match_id)})
    if not match:
        raise HTTPException(404, "Match not found")
    if user["_id"] not in (match["user_a_id"], match["user_b_id"]):
        raise HTTPException(403, "Not your match")
    if not match.get("rec_a_id") or not match.get("rec_b_id"):
        raise HTTPException(400, "Both users must have recommendations before reveal")
    now = datetime.now(timezone.utc).isoformat()
    expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    await db.matches.update_one({"_id": ObjectId(match_id)}, {"$set": {"status": "active", "revealed_at": now, "expires_at": expires}})
    is_a = user["_id"] == match["user_a_id"]
    other_rec_id = match["rec_b_id"] if is_a else match["rec_a_id"]
    my_rec_id = match["rec_a_id"] if is_a else match["rec_b_id"]
    other_rec = await db.recommendations.find_one({"_id": ObjectId(other_rec_id)}) if other_rec_id else None
    my_rec = await db.recommendations.find_one({"_id": ObjectId(my_rec_id)}) if my_rec_id else None
    other_user_id = match["user_b_id"] if is_a else match["user_a_id"]
    other_user = await db.users.find_one({"_id": ObjectId(other_user_id)})
    existing_entry = await db.list_entries.find_one({"user_id": user["_id"], "recommendation_id": other_rec_id, "match_id": match_id})
    if not existing_entry and other_rec_id:
        await db.list_entries.insert_one({
            "user_id": user["_id"], "recommendation_id": other_rec_id, "match_id": match_id,
            "source_type": "match", "received_at": now, "completion_status": "not_started",
            "completion_date": None, "user_comment": "", "is_archived": False, "show_note_publicly": True,
        })
    return {
        "match": {**{k: v for k, v in match.items() if k != "_id"}, "id": match_id, "status": "active", "revealed_at": now, "expires_at": expires},
        "their_recommendation": rec_to_dict(other_rec),
        "my_recommendation": rec_to_dict(my_rec),
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
    my_follow = await db.follows.find_one({"follower_id": user["_id"], "match_id": match_id})
    their_follow = await db.follows.find_one({"follower_id": other_user_id, "match_id": match_id})
    connection = await db.connections.find_one({"$or": [
        {"user_a_id": user["_id"], "user_b_id": other_user_id, "ended_at": None},
        {"user_a_id": other_user_id, "user_b_id": user["_id"], "ended_at": None}
    ]})
    match_data = {k: v for k, v in match.items() if k != "_id"}
    match_data["id"] = match_id
    return {
        "match": match_data,
        "their_recommendation": rec_to_dict(other_rec) if match.get("status") in ("active", "completed") else None,
        "my_recommendation": rec_to_dict(my_rec),
        "their_city": other_user.get("city", "") if other_user else "",
        "i_followed": my_follow is not None,
        "they_followed": their_follow is not None,
        "is_connected": connection is not None,
        "is_llm_fallback": match.get("is_llm_fallback", False),
        "needs_my_rec": (is_a and not match.get("rec_a_id")) or (not is_a and not match.get("rec_b_id")),
    }

# ── FOLLOW & CONNECTIONS ──
@api.post("/follow")
async def follow_user(body: FollowBody, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"_id": ObjectId(body.match_id)})
    if not match:
        raise HTTPException(404, "Match not found")
    if match.get("status") not in ("active",):
        raise HTTPException(400, "Match is not active")
    if match.get("expires_at"):
        expires = datetime.fromisoformat(match["expires_at"])
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(400, "Follow window has expired")
    existing = await db.follows.find_one({"follower_id": user["_id"], "match_id": body.match_id})
    if existing:
        raise HTTPException(400, "Already followed")
    is_a = user["_id"] == match["user_a_id"]
    other_user_id = match["user_b_id"] if is_a else match["user_a_id"]
    await db.follows.insert_one({
        "follower_id": user["_id"], "followee_id": other_user_id,
        "match_id": body.match_id, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mutual = await db.follows.find_one({"follower_id": other_user_id, "match_id": body.match_id})
    if mutual:
        existing_conn = await db.connections.find_one({"$or": [
            {"user_a_id": user["_id"], "user_b_id": other_user_id, "ended_at": None},
            {"user_a_id": other_user_id, "user_b_id": user["_id"], "ended_at": None}
        ]})
        if not existing_conn:
            conn_result = await db.connections.insert_one({
                "user_a_id": user["_id"], "user_b_id": other_user_id,
                "formed_at": datetime.now(timezone.utc).isoformat(), "ended_at": None,
                "exchange_count": 0, "social_a_visible": False, "social_b_visible": False,
            })
            # Create blend
            blend_token = secrets.token_urlsafe(12)
            await db.blends.insert_one({
                "connection_id": str(conn_result.inserted_id),
                "user_a_id": user["_id"], "user_b_id": other_user_id,
                "blend_type": "stranger", "public_token": blend_token,
                "is_public": False, "score": None, "descriptors": None,
                "score_summary": None, "score_computed_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            await db.matches.update_one({"_id": ObjectId(body.match_id)}, {"$set": {"status": "completed"}})
            # Send connection formed emails to both users
            other_user = await db.users.find_one({"_id": ObjectId(other_user_id)})
            background_tasks.add_task(send_email_connection_formed, user["_id"], other_user.get("display_name", "") if other_user else "")
            background_tasks.add_task(send_email_connection_formed, other_user_id, user.get("display_name", ""))
        return {"ok": True, "connection_formed": True}
    return {"ok": True, "connection_formed": False}

@api.post("/downvote")
async def downvote(body: DownvoteBody, user: dict = Depends(get_current_user)):
    await db.downvotes.insert_one({
        "user_id": user["_id"], "match_id": body.match_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}

@api.get("/connections")
async def get_connections(user: dict = Depends(get_current_user)):
    connections = await db.connections.find({
        "$or": [{"user_a_id": user["_id"]}, {"user_b_id": user["_id"]}], "ended_at": None
    }).to_list(100)
    result = []
    for c in connections:
        other_id = c["user_b_id"] if c["user_a_id"] == user["_id"] else c["user_a_id"]
        other = await db.users.find_one({"_id": ObjectId(other_id)})
        blend = await db.blends.find_one({"connection_id": str(c["_id"])})
        is_a = c["user_a_id"] == user["_id"]
        my_social_visible = c.get("social_a_visible" if is_a else "social_b_visible", False)
        their_social_visible = c.get("social_b_visible" if is_a else "social_a_visible", False)
        their_social = None
        if their_social_visible and c.get("exchange_count", 0) >= 7 and other:
            their_social = {"handle": other.get("social_handle", ""), "platform": other.get("social_platform", "")}
        result.append({
            "id": str(c["_id"]),
            "other_user": {"id": other_id, "display_name": other.get("display_name", ""), "city": other.get("city", "")} if other else None,
            "formed_at": c["formed_at"],
            "exchange_count": c.get("exchange_count", 0),
            "my_social_visible": my_social_visible,
            "their_social": their_social,
            "blend_token": blend.get("public_token") if blend else None,
            "blend_score": blend.get("score") if blend else None,
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

@api.post("/connections/{connection_id}/toggle-social")
async def toggle_social(connection_id: str, user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"_id": ObjectId(connection_id)})
    if not conn:
        raise HTTPException(404, "Connection not found")
    if user["_id"] not in (conn["user_a_id"], conn["user_b_id"]):
        raise HTTPException(403, "Not your connection")
    if conn.get("exchange_count", 0) < 7:
        raise HTTPException(400, "Need at least 7 mutual exchanges")
    is_a = user["_id"] == conn["user_a_id"]
    field = "social_a_visible" if is_a else "social_b_visible"
    current = conn.get(field, False)
    await db.connections.update_one({"_id": ObjectId(connection_id)}, {"$set": {field: not current}})
    return {"ok": True, "visible": not current}

# ── CONNECTION EXCHANGES ──
@api.post("/connection-exchange")
async def send_connection_exchange(body: ConnectionExchangeBody, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"_id": ObjectId(body.connection_id), "ended_at": None})
    if not conn:
        raise HTTPException(404, "Connection not found or ended")
    if user["_id"] not in (conn["user_a_id"], conn["user_b_id"]):
        raise HTTPException(403, "Not your connection")
    other_id = conn["user_b_id"] if user["_id"] == conn["user_a_id"] else conn["user_a_id"]
    if len(body.why_note) < 20:
        raise HTTPException(400, "Why-note must be at least 20 characters")
    genre = normalise_genre(body.genre) if body.genre else ""
    rec_doc = {
        "user_id": user["_id"], "title": body.title, "author": body.author or "",
        "category": "read", "genre": genre, "url": body.url or "",
        "og_cache": None, "why_note": body.why_note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    rec_result = await db.recommendations.insert_one(rec_doc)
    rec_id = str(rec_result.inserted_id)
    exchange_doc = {
        "connection_id": body.connection_id, "sender_id": user["_id"],
        "receiver_id": other_id, "recommendation_id": rec_id,
        "sent_at": datetime.now(timezone.utc).isoformat(), "counted": False,
    }
    await db.connection_exchanges.insert_one(exchange_doc)
    # Check for mutual exchange
    reverse = await db.connection_exchanges.find_one({
        "connection_id": body.connection_id, "sender_id": other_id,
        "receiver_id": user["_id"], "counted": False,
    })
    if reverse:
        await db.connection_exchanges.update_many(
            {"_id": {"$in": [reverse["_id"]]}}, {"$set": {"counted": True}})
        await db.connection_exchanges.update_one(
            {"connection_id": body.connection_id, "sender_id": user["_id"], "counted": False},
            {"$set": {"counted": True}})
        await db.connections.update_one({"_id": ObjectId(body.connection_id)}, {"$inc": {"exchange_count": 1}})
    # Create list entry for receiver
    await db.list_entries.insert_one({
        "user_id": other_id, "recommendation_id": rec_id, "match_id": None,
        "source_type": "rec_exchange", "received_at": datetime.now(timezone.utc).isoformat(),
        "completion_status": "not_started", "completion_date": None,
        "user_comment": "", "is_archived": False, "show_note_publicly": True,
    })
    if not genre and groq_client:
        background_tasks.add_task(infer_genre_async, rec_id, body.title, body.author or "")
    return {"ok": True}

# ── BROADCASTS ──
@api.post("/broadcasts")
async def create_broadcast(body: BroadcastCreate, user: dict = Depends(get_current_user)):
    if body.category not in ("read", "listen", "watch"):
        raise HTTPException(400, "Invalid category")
    existing = await db.broadcasts.find_one({"user_id": user["_id"], "is_active": True})
    if existing:
        raise HTTPException(400, "You already have an active broadcast. Close it first.")
    doc = {
        "user_id": user["_id"], "category": body.category,
        "request_text": body.request_text,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "is_active": True,
    }
    result = await db.broadcasts.insert_one(doc)
    return {"id": str(result.inserted_id), **{k: v for k, v in doc.items() if k != "_id"}}

@api.get("/broadcasts")
async def get_broadcasts(user: dict = Depends(get_current_user)):
    connections = await db.connections.find({
        "$or": [{"user_a_id": user["_id"]}, {"user_b_id": user["_id"]}], "ended_at": None
    }).to_list(200)
    connected_ids = set()
    for c in connections:
        connected_ids.add(c["user_a_id"])
        connected_ids.add(c["user_b_id"])
    connected_ids.discard(user["_id"])
    connected_ids.add(user["_id"])
    broadcasts = await db.broadcasts.find({"user_id": {"$in": list(connected_ids)}, "is_active": True}).sort("created_at", -1).to_list(50)
    result = []
    for b in broadcasts:
        owner = await db.users.find_one({"_id": ObjectId(b["user_id"])})
        responses = await db.broadcast_responses.count_documents({"broadcast_id": str(b["_id"])})
        views = await db.broadcast_views.count_documents({"broadcast_id": str(b["_id"])})
        # Mark as viewed
        if b["user_id"] != user["_id"]:
            existing_view = await db.broadcast_views.find_one({"broadcast_id": str(b["_id"]), "viewer_id": user["_id"]})
            if not existing_view:
                await db.broadcast_views.insert_one({"broadcast_id": str(b["_id"]), "viewer_id": user["_id"], "viewed_at": datetime.now(timezone.utc).isoformat()})
        result.append({
            "id": str(b["_id"]), "category": b["category"], "request_text": b["request_text"],
            "created_at": b["created_at"], "is_mine": b["user_id"] == user["_id"],
            "owner_name": owner.get("display_name", "") if owner else "",
            "response_count": responses, "view_count": views,
        })
    return result

@api.post("/broadcasts/respond")
async def respond_to_broadcast(body: BroadcastResponseBody, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    broadcast = await db.broadcasts.find_one({"_id": ObjectId(body.broadcast_id), "is_active": True})
    if not broadcast:
        raise HTTPException(404, "Broadcast not found or closed")
    if len(body.why_note) < 20:
        raise HTTPException(400, "Why-note must be at least 20 characters")
    genre = normalise_genre(body.genre) if body.genre else ""
    rec_doc = {
        "user_id": user["_id"], "title": body.title, "author": body.author or "",
        "category": broadcast["category"], "genre": genre, "url": body.url or "",
        "og_cache": None, "why_note": body.why_note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    rec_result = await db.recommendations.insert_one(rec_doc)
    rec_id = str(rec_result.inserted_id)
    await db.broadcast_responses.insert_one({
        "broadcast_id": body.broadcast_id, "responder_id": user["_id"],
        "recommendation_id": rec_id, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.list_entries.insert_one({
        "user_id": broadcast["user_id"], "recommendation_id": rec_id, "match_id": None,
        "source_type": "broadcast", "received_at": datetime.now(timezone.utc).isoformat(),
        "completion_status": "not_started", "completion_date": None,
        "user_comment": "", "is_archived": False, "show_note_publicly": True,
    })
    if not genre and groq_client:
        background_tasks.add_task(infer_genre_async, rec_id, body.title, body.author or "")
    # Send email to broadcast owner
    background_tasks.add_task(send_email_broadcast_response, broadcast["user_id"])
    return {"ok": True}

@api.post("/broadcasts/{broadcast_id}/close")
async def close_broadcast(broadcast_id: str, user: dict = Depends(get_current_user)):
    broadcast = await db.broadcasts.find_one({"_id": ObjectId(broadcast_id), "user_id": user["_id"]})
    if not broadcast:
        raise HTTPException(404, "Broadcast not found")
    await db.broadcasts.update_one({"_id": ObjectId(broadcast_id)}, {"$set": {"is_active": False}})
    return {"ok": True}

# ── THE LIST ──
@api.get("/list")
async def get_my_list(user: dict = Depends(get_current_user), category: Optional[str] = None,
    source_type: Optional[str] = None, completion_status: Optional[str] = None,
    search: Optional[str] = None, show_archived: bool = False, tab: str = "my_list"):
    query = {"user_id": user["_id"]}
    if not show_archived:
        query["is_archived"] = {"$ne": True}
    if source_type:
        query["source_type"] = source_type
    if completion_status:
        query["completion_status"] = completion_status
    # Tab filtering: my_list = own additions, matched_list = from matches/links/llm, blends = from connections
    if tab == "my_list":
        query["source_type"] = {"$nin": ["match", "llm", "link", "rec_exchange"]}
    elif tab == "matched_list":
        query["source_type"] = {"$in": ["match", "llm", "link", "rec_exchange"]}
    entries = await db.list_entries.find(query).sort("received_at", -1).to_list(200)
    result = []
    for e in entries:
        rec = await db.recommendations.find_one({"_id": ObjectId(e["recommendation_id"])}) if e.get("recommendation_id") else None
        if rec:
            if category and rec.get("category") != category:
                continue
            if search and search.lower() not in rec.get("title", "").lower():
                continue
        entry_data = {k: v for k, v in e.items() if k != "_id"}
        entry_data["id"] = str(e["_id"])
        entry_data["recommendation"] = rec_to_dict(rec) if rec else None
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
    if body.show_note_publicly is not None:
        updates["show_note_publicly"] = body.show_note_publicly
    if updates:
        await db.list_entries.update_one({"_id": ObjectId(entry_id)}, {"$set": updates})
    return {"ok": True}

@api.delete("/list/{entry_id}")
async def delete_list_entry(entry_id: str, user: dict = Depends(get_current_user)):
    entry = await db.list_entries.find_one({"_id": ObjectId(entry_id), "user_id": user["_id"]})
    if not entry:
        raise HTTPException(404, "Entry not found")
    await db.list_entries.delete_one({"_id": ObjectId(entry_id)})
    return {"ok": True}

@api.get("/list/stats")
async def list_stats(user: dict = Depends(get_current_user)):
    total = await db.list_entries.count_documents({"user_id": user["_id"], "is_archived": {"$ne": True}})
    completed = await db.list_entries.count_documents({"user_id": user["_id"], "completion_status": "completed"})
    in_progress = await db.list_entries.count_documents({"user_id": user["_id"], "completion_status": "in_progress"})
    entries = await db.list_entries.find({"user_id": user["_id"]}).to_list(1000)
    cat_counts = {"read": 0, "listen": 0, "watch": 0}
    for e in entries:
        if e.get("recommendation_id"):
            rec = await db.recommendations.find_one({"_id": ObjectId(e["recommendation_id"])}, {"category": 1})
            if rec and rec.get("category") in cat_counts:
                cat_counts[rec["category"]] += 1
    return {"total": total, "completed": completed, "in_progress": in_progress, "categories": cat_counts}

# ── BLOCKS ──
@api.post("/blocks")
async def block_user(body: BlockBody, user: dict = Depends(get_current_user)):
    if body.user_id == user["_id"]:
        raise HTTPException(400, "Cannot block yourself")
    existing = await db.blocks.find_one({"blocker_id": user["_id"], "blocked_id": body.user_id})
    if existing:
        raise HTTPException(400, "Already blocked")
    await db.blocks.insert_one({
        "blocker_id": user["_id"], "blocked_id": body.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # Sever connections
    await db.connections.update_many(
        {"$or": [
            {"user_a_id": user["_id"], "user_b_id": body.user_id, "ended_at": None},
            {"user_a_id": body.user_id, "user_b_id": user["_id"], "ended_at": None}
        ]},
        {"$set": {"ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    # Archive list entries from blocked user
    recs_by_blocked = await db.recommendations.find({"user_id": body.user_id}).to_list(500)
    blocked_rec_ids = [str(r["_id"]) for r in recs_by_blocked]
    if blocked_rec_ids:
        await db.list_entries.update_many(
            {"user_id": user["_id"], "recommendation_id": {"$in": blocked_rec_ids}},
            {"$set": {"is_archived": True}}
        )
    return {"ok": True}

@api.get("/blocks")
async def get_blocks(user: dict = Depends(get_current_user)):
    blocks = await db.blocks.find({"blocker_id": user["_id"]}).to_list(100)
    result = []
    for b in blocks:
        blocked = await db.users.find_one({"_id": ObjectId(b["blocked_id"])})
        result.append({
            "id": str(b["_id"]),
            "blocked_user": {"id": b["blocked_id"], "display_name": blocked.get("display_name", "") if blocked else ""},
            "created_at": b["created_at"],
        })
    return result

@api.delete("/blocks/{block_id}")
async def unblock_user(block_id: str, user: dict = Depends(get_current_user)):
    block = await db.blocks.find_one({"_id": ObjectId(block_id), "blocker_id": user["_id"]})
    if not block:
        raise HTTPException(404, "Block not found")
    await db.blocks.delete_one({"_id": ObjectId(block_id)})
    return {"ok": True}

# ── SHAREABLE LINKS (Type 1) ──
@api.post("/shareable-link/generate")
async def generate_shareable_link(user: dict = Depends(get_current_user)):
    existing = await db.shareable_links.find_one({"user_id": user["_id"]})
    if existing:
        return {"id": str(existing["_id"]), "token": existing["token"]}
    token = secrets.token_urlsafe(8)
    doc = {"user_id": user["_id"], "token": token, "created_at": datetime.now(timezone.utc).isoformat()}
    result = await db.shareable_links.insert_one(doc)
    return {"id": str(result.inserted_id), "token": token}

@api.get("/shareable-link/{token}")
async def get_shareable_link(token: str):
    link = await db.shareable_links.find_one({"token": token})
    if not link:
        raise HTTPException(404, "Link not found")
    owner = await db.users.find_one({"_id": ObjectId(link["user_id"])})
    return {"token": token, "owner_display_name": owner.get("display_name", "Someone") if owner else "Someone"}

@api.post("/shareable-link/{token}/submit")
async def submit_via_link(token: str, body: LinkSubmission, request: Request, background_tasks: BackgroundTasks):
    if len(body.why_note) < 20:
        raise HTTPException(400, "Why-note must be at least 20 characters")
    link = await db.shareable_links.find_one({"token": token})
    if not link:
        raise HTTPException(404, "Link not found")
    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()
    rec_doc = {
        "user_id": None, "title": body.title, "author": body.author or "",
        "category": body.category, "genre": "", "url": "", "og_cache": None,
        "why_note": body.why_note, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    rec_result = await db.recommendations.insert_one(rec_doc)
    rec_id = str(rec_result.inserted_id)
    await db.link_submissions.insert_one({
        "link_id": str(link["_id"]), "rec_exchange_link_id": None,
        "category": body.category, "title": body.title, "author": body.author or "",
        "why_note": body.why_note, "created_at": datetime.now(timezone.utc).isoformat(), "ip_hash": ip_hash,
    })
    await db.list_entries.insert_one({
        "user_id": link["user_id"], "recommendation_id": rec_id, "match_id": None,
        "source_type": "link", "received_at": datetime.now(timezone.utc).isoformat(),
        "completion_status": "not_started", "completion_date": None,
        "user_comment": "", "is_archived": False, "show_note_publicly": True,
    })
    # Send email notification
    background_tasks.add_task(send_email_link_submission, link["user_id"])
    return {"ok": True}

# ── REC EXCHANGE LINKS (Type 2) ──
@api.post("/rec-exchange-link/create")
async def create_rec_exchange_link(body: RecExchangeLinkCreate, user: dict = Depends(get_current_user)):
    existing = await db.rec_exchange_links.find_one({"user_id": user["_id"], "is_active": True})
    if existing:
        raise HTTPException(400, "You already have an active rec exchange link")
    rec = await db.recommendations.find_one({"_id": ObjectId(body.recommendation_id), "user_id": user["_id"]})
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    token = secrets.token_urlsafe(10)
    doc = {
        "user_id": user["_id"], "token": token, "rec_id": body.recommendation_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat(),
        "is_active": True, "last_notified_count": 0,
    }
    result = await db.rec_exchange_links.insert_one(doc)
    return {"id": str(result.inserted_id), "token": token, "expires_at": doc["expires_at"]}

@api.get("/rec-exchange-link/mine")
async def get_my_rec_exchange_link(user: dict = Depends(get_current_user)):
    link = await db.rec_exchange_links.find_one({"user_id": user["_id"], "is_active": True})
    if not link:
        return {"link": None}
    if datetime.fromisoformat(link["expires_at"]) < datetime.now(timezone.utc):
        await db.rec_exchange_links.update_one({"_id": link["_id"]}, {"$set": {"is_active": False}})
        return {"link": None}
    submissions = await db.link_submissions.count_documents({"rec_exchange_link_id": str(link["_id"])})
    return {"link": {"id": str(link["_id"]), "token": link["token"], "expires_at": link["expires_at"], "submission_count": submissions}}

@api.get("/rec-exchange-link/{token}")
async def get_rec_exchange_link(token: str):
    link = await db.rec_exchange_links.find_one({"token": token, "is_active": True})
    if not link:
        raise HTTPException(404, "Link not found or expired")
    if datetime.fromisoformat(link["expires_at"]) < datetime.now(timezone.utc):
        await db.rec_exchange_links.update_one({"_id": link["_id"]}, {"$set": {"is_active": False}})
        raise HTTPException(404, "Link expired")
    owner = await db.users.find_one({"_id": ObjectId(link["user_id"])})
    return {"token": token, "owner_display_name": owner.get("display_name", "Someone") if owner else "Someone"}

@api.post("/rec-exchange-link/{token}/submit")
async def submit_rec_exchange(token: str, body: RecExchangeSubmission, request: Request, background_tasks: BackgroundTasks):
    if len(body.why_note) < 20:
        raise HTTPException(400, "Why-note must be at least 20 characters")
    link = await db.rec_exchange_links.find_one({"token": token, "is_active": True})
    if not link:
        raise HTTPException(404, "Link not found or expired")
    if datetime.fromisoformat(link["expires_at"]) < datetime.now(timezone.utc):
        await db.rec_exchange_links.update_one({"_id": link["_id"]}, {"$set": {"is_active": False}})
        raise HTTPException(404, "Link expired")
    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()
    rec_doc = {
        "user_id": None, "title": body.title, "author": body.author or "",
        "category": body.category, "genre": "", "url": "", "og_cache": None,
        "why_note": body.why_note, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    rec_result = await db.recommendations.insert_one(rec_doc)
    rec_id = str(rec_result.inserted_id)
    await db.link_submissions.insert_one({
        "link_id": None, "rec_exchange_link_id": str(link["_id"]),
        "category": body.category, "title": body.title, "author": body.author or "",
        "why_note": body.why_note, "created_at": datetime.now(timezone.utc).isoformat(), "ip_hash": ip_hash,
    })
    await db.list_entries.insert_one({
        "user_id": link["user_id"], "recommendation_id": rec_id, "match_id": None,
        "source_type": "rec_exchange", "received_at": datetime.now(timezone.utc).isoformat(),
        "completion_status": "not_started", "completion_date": None,
        "user_comment": "", "is_archived": False, "show_note_publicly": True,
    })
    # Fibonacci threshold email notification for Type 2
    total_submissions = await db.link_submissions.count_documents({"rec_exchange_link_id": str(link["_id"])})
    last_notified = link.get("last_notified_count", 0)
    next_threshold = get_next_fibonacci_threshold(total_submissions, last_notified)
    if next_threshold > 0:
        await db.rec_exchange_links.update_one({"_id": link["_id"]}, {"$set": {"last_notified_count": next_threshold}})
        background_tasks.add_task(send_email_exchange_link_threshold, link["user_id"], next_threshold)
    # Return the sharer's frozen rec as reward
    reward_rec = None
    if link.get("rec_id"):
        rec = await db.recommendations.find_one({"_id": ObjectId(link["rec_id"])})
        if rec:
            reward_rec = {"title": rec["title"], "author": rec.get("author", ""), "category": rec["category"], "why_note": rec["why_note"]}
    return {"ok": True, "reward_recommendation": reward_rec}

# ── KNOWN BLEND INVITES ──
@api.post("/known-blend/invite")
async def create_known_blend_invite(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if u.get("known_blend_invites_sent", 0) >= 2:
        raise HTTPException(400, "No invite slots remaining (2 of 2 used)")
    token = secrets.token_urlsafe(12)
    await db.known_blend_invites.insert_one({
        "inviter_id": user["_id"], "token": token,
        "accepted_by": None, "created_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None, "blend_id": None, "status": "pending",
    })
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"known_blend_invites_sent": 1}})
    return {"token": token}

@api.get("/known-blend/invites")
async def get_my_invites(user: dict = Depends(get_current_user)):
    invites = await db.known_blend_invites.find({"inviter_id": user["_id"]}).sort("created_at", -1).to_list(10)
    result = []
    for inv in invites:
        expires_at = (datetime.fromisoformat(inv["created_at"]) + timedelta(hours=72)).isoformat()
        is_expired = datetime.fromisoformat(expires_at) < datetime.now(timezone.utc)
        if inv["status"] == "pending" and is_expired:
            await db.known_blend_invites.update_one({"_id": inv["_id"]}, {"$set": {"status": "expired"}})
            await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"known_blend_invites_sent": -1}})
            inv["status"] = "expired"
        accepted_user = None
        if inv.get("accepted_by"):
            au = await db.users.find_one({"_id": ObjectId(inv["accepted_by"])})
            accepted_user = {"display_name": au.get("display_name", "") if au else ""}
        result.append({
            "id": str(inv["_id"]), "token": inv["token"], "status": inv["status"],
            "created_at": inv["created_at"], "expires_at": expires_at,
            "accepted_user": accepted_user, "blend_id": inv.get("blend_id"),
        })
    return result

@api.get("/known-blend/invite/{token}")
async def get_known_blend_invite(token: str):
    inv = await db.known_blend_invites.find_one({"token": token})
    if not inv:
        raise HTTPException(404, "Invite not found")
    expires_at = (datetime.fromisoformat(inv["created_at"]) + timedelta(hours=72))
    if inv["status"] == "pending" and expires_at < datetime.now(timezone.utc):
        raise HTTPException(404, "Invite expired")
    if inv["status"] != "pending":
        raise HTTPException(400, "Invite already used or expired")
    inviter = await db.users.find_one({"_id": ObjectId(inv["inviter_id"])})
    return {"token": token, "inviter_name": inviter.get("display_name", "Someone") if inviter else "Someone"}

@api.post("/known-blend/accept")
async def accept_known_blend_invite(body: KnownBlendInviteAccept, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    inv = await db.known_blend_invites.find_one({"token": body.token, "status": "pending"})
    if not inv:
        raise HTTPException(404, "Invite not found or already used")
    expires_at = datetime.fromisoformat(inv["created_at"]) + timedelta(hours=72)
    if expires_at < datetime.now(timezone.utc):
        await db.known_blend_invites.update_one({"_id": inv["_id"]}, {"$set": {"status": "expired"}})
        raise HTTPException(400, "Invite expired")
    blend_token = secrets.token_urlsafe(12)
    blend_doc = {
        "connection_id": None, "user_a_id": inv["inviter_id"], "user_b_id": user["_id"],
        "blend_type": "known", "public_token": blend_token,
        "is_public": False, "score": None, "descriptors": None,
        "score_summary": None, "score_computed_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    blend_result = await db.blends.insert_one(blend_doc)
    await db.known_blend_invites.update_one({"_id": inv["_id"]}, {"$set": {
        "accepted_by": user["_id"], "accepted_at": datetime.now(timezone.utc).isoformat(),
        "blend_id": str(blend_result.inserted_id), "status": "accepted",
    }})
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"invited_by": inv["inviter_id"]}})
    # Send email to inviter
    background_tasks.add_task(send_email_known_blend_accepted, inv["inviter_id"], user.get("display_name", ""))
    return {"ok": True, "blend_token": blend_token}

# ── BLENDS ──
@api.get("/blends")
async def get_my_blends(user: dict = Depends(get_current_user)):
    blends = await db.blends.find({"$or": [{"user_a_id": user["_id"]}, {"user_b_id": user["_id"]}]}).to_list(50)
    result = []
    for b in blends:
        other_id = b["user_b_id"] if b["user_a_id"] == user["_id"] else b["user_a_id"]
        other = await db.users.find_one({"_id": ObjectId(other_id)})
        result.append({
            "id": str(b["_id"]), "blend_type": b.get("blend_type", "stranger"),
            "public_token": b.get("public_token"), "is_public": b.get("is_public", False),
            "score": b.get("score"), "descriptors": b.get("descriptors"),
            "score_summary": b.get("score_summary"), "score_computed_at": b.get("score_computed_at"),
            "other_user": {"id": other_id, "display_name": other.get("display_name", "") if other else ""},
        })
    return result

@api.get("/blends/{token}")
async def get_blend_by_token(token: str, user: dict = Depends(get_optional_user)):
    blend = await db.blends.find_one({"public_token": token})
    if not blend:
        raise HTTPException(404, "Blend not found")
    user_a = await db.users.find_one({"_id": ObjectId(blend["user_a_id"])})
    user_b = await db.users.find_one({"_id": ObjectId(blend["user_b_id"])})
    entries_a = await db.list_entries.find({"user_id": blend["user_a_id"], "is_archived": {"$ne": True}}).sort("received_at", -1).to_list(50)
    entries_b = await db.list_entries.find({"user_id": blend["user_b_id"], "is_archived": {"$ne": True}}).sort("received_at", -1).to_list(50)
    combined = []
    for e in entries_a + entries_b:
        rec = await db.recommendations.find_one({"_id": ObjectId(e["recommendation_id"])}) if e.get("recommendation_id") else None
        if rec:
            combined.append({
                "id": str(e["_id"]), "recommendation": rec_to_dict(rec),
                "user_side": "a" if e["user_id"] == blend["user_a_id"] else "b",
                "completion_status": e.get("completion_status"),
            })
    combined.sort(key=lambda x: x.get("recommendation", {}).get("created_at", ""), reverse=True)
    return {
        "blend_type": blend.get("blend_type", "stranger"),
        "is_public": blend.get("is_public", False),
        "score": blend.get("score"), "descriptors": blend.get("descriptors"),
        "score_summary": blend.get("score_summary"), "score_computed_at": blend.get("score_computed_at"),
        "user_a_name": user_a.get("display_name", "") if user_a else "",
        "user_b_name": user_b.get("display_name", "") if user_b else "",
        "entries": combined[:50],
    }

@api.post("/blends/{blend_id}/toggle-public")
async def toggle_blend_public(blend_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    blend = await db.blends.find_one({"_id": ObjectId(blend_id)})
    if not blend:
        raise HTTPException(404, "Blend not found")
    if user["_id"] not in (blend["user_a_id"], blend["user_b_id"]):
        raise HTTPException(403, "Not your blend")
    new_val = not blend.get("is_public", False)
    await db.blends.update_one({"_id": ObjectId(blend_id)}, {"$set": {"is_public": new_val}})
    # Send email to both users when blend is made public
    if new_val:
        background_tasks.add_task(send_email_blend_public, blend["user_a_id"], blend.get("public_token", ""))
        background_tasks.add_task(send_email_blend_public, blend["user_b_id"], blend.get("public_token", ""))
    return {"ok": True, "is_public": new_val}

@api.post("/blends/{blend_id}/recompute")
async def recompute_blend_score(blend_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    blend = await db.blends.find_one({"_id": ObjectId(blend_id)})
    if not blend:
        raise HTTPException(404, "Blend not found")
    if user["_id"] not in (blend["user_a_id"], blend["user_b_id"]):
        raise HTTPException(403, "Not your blend")
    if blend.get("score_computed_at"):
        last = datetime.fromisoformat(blend["score_computed_at"])
        if (datetime.now(timezone.utc) - last) < timedelta(hours=1):
            raise HTTPException(400, "Already updating. Try again later.")
    background_tasks.add_task(compute_blend_score, blend_id)
    return {"ok": True, "message": "Updating..."}

# ── REPORTS ──
@api.post("/reports")
async def create_report(body: ReportCreate, user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    count = await db.reports.count_documents({"reporter_id": user["_id"], "created_at": {"$regex": f"^{today}"}})
    if count >= 3:
        raise HTTPException(429, "Report limit reached (3 per day)")
    await db.reports.insert_one({
        "reporter_id": user["_id"], "reported_user_id": body.reported_user_id,
        "match_id": body.match_id, "reason": body.reason, "detail": body.detail or "",
        "created_at": datetime.now(timezone.utc).isoformat(), "resolved_at": None, "resolved_by": None,
    })
    return {"ok": True}

# ── WAITLIST ──
@api.post("/waitlist")
async def join_waitlist(body: WaitlistBody, background_tasks: BackgroundTasks):
    existing = await db.waitlist.find_one({"email": body.email.strip().lower()})
    if existing:
        return {"ok": True, "message": "You're in the list."}
    await db.waitlist.insert_one({
        "email": body.email.strip().lower(),
        "referral_source": body.referral_source or "pro_modal",
        "created_at": datetime.now(timezone.utc).isoformat(), "invited_at": None,
    })
    # Send confirmation email
    background_tasks.add_task(send_email_pro_waitlist_join, body.email.strip().lower())
    return {"ok": True, "message": "You're in the list."}

# ── PUBLIC TASTE PAGE ──
@api.get("/public/user/{handle}")
async def get_public_taste_page(handle: str):
    user = await db.users.find_one({"public_handle": handle, "is_public": True})
    if not user:
        raise HTTPException(404, "User not found or profile is private")
    entries = await db.list_entries.find({"user_id": str(user["_id"]), "is_archived": {"$ne": True}}).sort("received_at", -1).to_list(50)
    items = []
    for e in entries:
        rec = await db.recommendations.find_one({"_id": ObjectId(e["recommendation_id"])}) if e.get("recommendation_id") else None
        if rec:
            show_note = e.get("show_note_publicly", True)
            items.append({
                "recommendation": {
                    "title": rec["title"], "author": rec.get("author", ""),
                    "category": rec["category"], "genre": rec.get("genre", ""),
                    "why_note": rec["why_note"] if show_note else "",
                },
                "completion_status": e.get("completion_status"),
                "source_type": e.get("source_type"),
            })
    return {
        "display_name": user.get("display_name", "Someone"),
        "city": user.get("city", ""),
        "entries": items,
    }

# ── OG LINK PREVIEW PROXY ──
@api.get("/og-proxy")
async def og_proxy(url: str):
    """Fetch Open Graph metadata for a URL, with platform-specific overrides."""
    if not url or not url.startswith("http"):
        raise HTTPException(400, "Invalid URL")
    og_data = {"title": "", "description": "", "image": "", "site_name": "", "url": url}
    # Platform-specific overrides
    lower_url = url.lower()
    if "spotify.com" in lower_url:
        og_data["site_name"] = "Spotify"
        if "/track/" in lower_url:
            og_data["description"] = "Song on Spotify"
        elif "/album/" in lower_url:
            og_data["description"] = "Album on Spotify"
        elif "/playlist/" in lower_url:
            og_data["description"] = "Playlist on Spotify"
    elif "youtube.com" in lower_url or "youtu.be" in lower_url:
        og_data["site_name"] = "YouTube"
        og_data["description"] = "Video on YouTube"
    elif "music.apple.com" in lower_url:
        og_data["site_name"] = "Apple Music"
        og_data["description"] = "Listen on Apple Music"
    elif "soundcloud.com" in lower_url:
        og_data["site_name"] = "SoundCloud"
        og_data["description"] = "Track on SoundCloud"
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=8.0) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; RecommendME/1.0; +https://recommendme.app)"})
            html = resp.text[:50000]
        import re as _re
        def extract_og(prop):
            m = _re.search(rf'<meta[^>]+property=["\']og:{prop}["\'][^>]+content=["\']([^"\']+)["\']', html, _re.IGNORECASE)
            if not m:
                m = _re.search(rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:{prop}["\']', html, _re.IGNORECASE)
            return m.group(1) if m else ""
        title = extract_og("title")
        description = extract_og("description")
        image = extract_og("image")
        site_name = extract_og("site_name")
        if title:
            og_data["title"] = title
        if description:
            og_data["description"] = description
        if image:
            og_data["image"] = image
        if site_name:
            og_data["site_name"] = site_name
        if not og_data["title"]:
            m = _re.search(r'<title[^>]*>([^<]+)</title>', html, _re.IGNORECASE)
            if m:
                og_data["title"] = m.group(1).strip()
    except Exception as e:
        logger.warning(f"OG proxy fetch failed for {url}: {e}")
    return og_data

# ── ACTIVE MATCHES ──
@api.get("/matches/active")
async def get_active_matches(user: dict = Depends(get_current_user)):
    matches = await db.matches.find({
        "$or": [{"user_a_id": user["_id"]}, {"user_b_id": user["_id"]}],
        "status": {"$in": ["pending", "active"]}
    }).sort("created_at", -1).to_list(20)
    return [{**{k: v for k, v in m.items() if k != "_id"}, "id": str(m["_id"])} for m in matches]

# ── ADMIN ──
@api.get("/admin/metrics")
async def admin_metrics(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    total_users = await db.users.count_documents({})
    total_matches = await db.matches.count_documents({})
    completed_matches = await db.matches.count_documents({"status": "completed"})
    active_matches = await db.matches.count_documents({"status": "active"})
    total_connections = await db.connections.count_documents({"ended_at": None})
    total_follows = await db.follows.count_documents({})
    follow_rate = round(total_connections / total_matches * 100, 1) if total_matches > 0 else 0
    pro_waitlist = await db.waitlist.count_documents({})
    banned = await db.users.count_documents({"is_banned": True})
    open_reports = await db.reports.count_documents({"resolved_at": None})
    llm_today = await db.matches.count_documents({"is_llm_fallback": True, "created_at": {"$regex": f"^{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"}})
    total_today = await db.matches.count_documents({"created_at": {"$regex": f"^{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"}})
    llm_rate = round(llm_today / total_today * 100, 1) if total_today > 0 else 0
    pool_count = await db.matching_pool.count_documents({})
    known_blends = await db.blends.count_documents({"blend_type": "known"})
    known_signups = await db.users.count_documents({"invited_by": {"$ne": None}})
    return {
        "active_today": total_today, "connections_formed": total_connections,
        "mutual_follow_rate": follow_rate, "llm_fallback_rate_today": llm_rate,
        "pro_waitlist_count": pro_waitlist, "open_reports": open_reports,
        "total_users": total_users, "total_matches": total_matches,
        "banned_users": banned, "pool_count": pool_count,
        "known_blends": known_blends, "known_signups": known_signups,
    }

@api.get("/admin/reports")
async def admin_reports(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    reports = await db.reports.find({}).sort("created_at", -1).to_list(100)
    return [{**{k: v for k, v in r.items() if k != "_id"}, "id": str(r["_id"])} for r in reports]

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
    await db.reports.update_one({"_id": ObjectId(report_id)}, {"$set": {"resolved_at": datetime.now(timezone.utc).isoformat(), "resolved_by": user["_id"]}})
    return {"ok": True}

@api.get("/admin/users")
async def admin_users(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    users = await db.users.find({}, {"password_hash": 0}).to_list(1000)
    return [{**{k: v for k, v in u.items() if k != "_id"}, "id": str(u["_id"])} for u in users]

# ── GROQ ASYNC FUNCTIONS ──
async def infer_genre_async(rec_id: str, title: str, author: str):
    if not groq_client:
        return
    try:
        prompt = f"Given the title \"{title}\""
        if author:
            prompt += f" by {author}"
        prompt += ", infer the most likely genre. Return ONLY a JSON object: {\"genre\": \"lowercase genre name\"}. If unsure, use \"other\"."
        response = await groq_client.chat.completions.create(
            model=GROQ_MODEL, messages=[
                {"role": "system", "content": "You classify content into genres. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ], temperature=0.3, max_tokens=50,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        genre = normalise_genre(data.get("genre", "other"))
        if genre:
            await db.recommendations.update_one({"_id": ObjectId(rec_id)}, {"$set": {"genre": genre}})
    except Exception as e:
        logger.warning(f"Genre inference failed for {rec_id}: {e}")

async def compute_blend_score(blend_id: str):
    if not groq_client:
        return
    try:
        blend = await db.blends.find_one({"_id": ObjectId(blend_id)})
        if not blend:
            return
        entries_a = await db.list_entries.find({"user_id": blend["user_a_id"]}).to_list(200)
        entries_b = await db.list_entries.find({"user_id": blend["user_b_id"]}).to_list(200)
        if len(entries_a) < 5 or len(entries_b) < 5:
            return
        async def get_recs(entries):
            recs = []
            for e in entries:
                if e.get("recommendation_id"):
                    r = await db.recommendations.find_one({"_id": ObjectId(e["recommendation_id"])})
                    if r:
                        recs.append({"title": r["title"], "author": r.get("author", ""), "category": r["category"], "genre": r.get("genre", "")})
            return recs
        recs_a = await get_recs(entries_a)
        recs_b = await get_recs(entries_b)
        min_count = min(len(recs_a), len(recs_b))
        import random
        sample_a = random.sample(recs_a, min(min_count, len(recs_a)))
        sample_b = random.sample(recs_b, min(min_count, len(recs_b)))
        system_prompt = """You are a taste analyst. Given two people's genre distributions and lists of books, music, and films, return a JSON object with exactly these fields:
- score: integer 0-100 representing taste compatibility based on genre distribution overlap, inferred taste, style, mood, and cultural sensibility — not based on shared titles
- descriptors: array of exactly 3 short strings describing shared taste (e.g. "literary fiction", "ambient electronic", "slow cinema") — lowercase, 1-3 words each
- summary: one sentence maximum 12 words describing shared taste, written warmly in second person

Return only valid JSON. No preamble. No explanation. No markdown fences."""
        user_msg = f"Person A's list:\n{json.dumps(sample_a[:20])}\n\nPerson B's list:\n{json.dumps(sample_b[:20])}"
        response = await groq_client.chat.completions.create(
            model=GROQ_MODEL, messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg}
            ], temperature=0.3, max_tokens=200,
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)
        await db.blends.update_one({"_id": ObjectId(blend_id)}, {"$set": {
            "score": data.get("score"), "descriptors": data.get("descriptors"),
            "score_summary": data.get("summary"), "score_computed_at": datetime.now(timezone.utc).isoformat(),
        }})
    except Exception as e:
        logger.warning(f"Blend score computation failed for {blend_id}: {e}")

async def generate_llm_fallback(user_id: str, category: str, request_note: str = ""):
    if not groq_client:
        return
    try:
        # Rate limit: 1 LLM fallback per user per 24 hours
        cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        recent_fallback = await db.matches.find_one({
            "user_a_id": user_id, "is_llm_fallback": True,
            "created_at": {"$gt": cutoff_24h}
        })
        if recent_fallback:
            logger.info(f"LLM fallback skipped for {user_id}: already received one in last 24h")
            return
        system_prompt = f"""You are writing a single {category} recommendation as a thoughtful human. Write in first person with genuine emotional reflection. Not a review or description — a personal, specific reason this changed you. Return JSON: {{"title": "...", "author": "...", "why_note": "...", "genre": "..."}}"""
        user_msg = f"Give one {category} recommendation."
        if request_note:
            user_msg += f" The person mentioned: {request_note}"
        response = await groq_client.chat.completions.create(
            model=GROQ_MODEL, messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg}
            ], temperature=0.7, max_tokens=300,
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)
        genre = normalise_genre(data.get("genre", ""))
        rec_doc = {
            "user_id": None, "title": data.get("title", "Unknown"),
            "author": data.get("author", ""), "category": category,
            "genre": genre, "url": "", "og_cache": None,
            "why_note": data.get("why_note", ""), "created_at": datetime.now(timezone.utc).isoformat(),
        }
        rec_result = await db.recommendations.insert_one(rec_doc)
        rec_id = str(rec_result.inserted_id)
        now = datetime.now(timezone.utc).isoformat()
        match_doc = {
            "user_a_id": user_id, "user_b_id": None, "category": category,
            "status": "active", "created_at": now,
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
            "rec_a_id": None, "rec_b_id": rec_id,
            "revealed_at": now, "is_llm_fallback": True,
        }
        match_result = await db.matches.insert_one(match_doc)
        await db.list_entries.insert_one({
            "user_id": user_id, "recommendation_id": rec_id,
            "match_id": str(match_result.inserted_id),
            "source_type": "llm", "received_at": now,
            "completion_status": "not_started", "completion_date": None,
            "user_comment": "", "is_archived": False, "show_note_publicly": True,
        })
        await db.matching_pool.delete_many({"user_id": user_id})
        # Send email notification
        await send_email_match_ready(user_id)
    except Exception as e:
        logger.warning(f"LLM fallback failed for {user_id}: {e}")

# ── EMAIL HELPERS ──
async def send_email_async(to: str, subject: str, html: str):
    if not RESEND_API_KEY:
        logger.info(f"Email skipped (no API key): to={to}, subject={subject}")
        return
    try:
        params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html}
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to}: {subject}")
    except Exception as e:
        logger.warning(f"Email failed: {e}")

async def send_triggered_email(user_id: str, trigger: str, subject: str, html: str):
    """Send email if user hasn't opted out of this trigger type."""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1, "email_opt_out": 1, "is_guest": 1})
        if not user or user.get("is_guest"):
            return
        opt_out = user.get("email_opt_out", [])
        if trigger in opt_out or "all" in opt_out:
            logger.info(f"Email opted out: {user.get('email')} / {trigger}")
            return
        await send_email_async(user["email"], subject, html)
    except Exception as e:
        logger.warning(f"Triggered email failed ({trigger}): {e}")

# Email trigger constants (opt-outable ones marked)
EMAIL_TRIGGERS = {
    "match_ready": False,  # "Your match is ready." - No opt-out
    "follow_warning": True,  # "Still thinking about it?" - Opt-outable
    "connection_formed": False,  # "You're connected." - No opt-out
    "blend_public": True,  # "Your blend is live." - Opt-outable
    "broadcast_response": True,  # "Someone responded to your request." - Opt-outable
    "link_submission": True,  # "Someone left you a recommendation." - Opt-outable
    "exchange_link_activity": True,  # "Your exchange link is getting responses." - Opt-outable
    "known_blend_accepted": True,  # "They joined your blend." - Opt-outable
    "waitlist_invite": False,  # "You're in. Here's your link." - No opt-out
    "pro_waitlist_join": False,  # "We've saved your spot." - No opt-out
}

# Fibonacci thresholds for Type 2 rec exchange link notifications
FIBONACCI_THRESHOLDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]

def get_next_fibonacci_threshold(current_count: int, last_notified: int) -> int:
    """Returns the next threshold to notify at, or 0 if no notification needed."""
    for thresh in FIBONACCI_THRESHOLDS:
        if thresh > last_notified and current_count >= thresh:
            # Find highest crossed threshold
            highest = thresh
            for t in FIBONACCI_THRESHOLDS:
                if t > last_notified and current_count >= t:
                    highest = t
            return highest
    return 0

def email_html_wrap(title: str, body: str, unsubscribe_link: str = None) -> str:
    footer = '<p style="color:#6b6b6b;font-size:12px;">RecommendME &mdash; a human-filtered taste exchange.</p>'
    if unsubscribe_link:
        footer = f'<p style="color:#6b6b6b;font-size:12px;">RecommendME &mdash; a human-filtered taste exchange.<br/><a href="{unsubscribe_link}" style="color:#6b6b6b;text-decoration:underline;">Unsubscribe from these emails</a></p>'
    return f"""<div style="font-family:'Nunito',sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#FFFDF7;">
<h2 style="font-family:'Fredoka',sans-serif;color:#1a1a1a;font-size:22px;margin:0 0 16px;">{title}</h2>
<div style="color:#333;font-size:15px;line-height:1.6;">{body}</div>
<hr style="border:none;border-top:2px solid #1a1a1a;margin:24px 0 16px;"/>
{footer}
</div>"""

def get_unsubscribe_link(user_id: str, trigger: str) -> str:
    """Generate unsubscribe link for opt-outable emails."""
    token = hashlib.sha256(f"{user_id}:{trigger}:{get_jwt_secret()}".encode()).hexdigest()[:24]
    return f"{FRONTEND_URL}/unsubscribe?uid={user_id}&trigger={trigger}&token={token}"

async def send_email_match_ready(user_id: str):
    """Async match found (user in pool 60s+, match then found)"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1, "is_guest": 1})
        if not user or user.get("is_guest"):
            return
        body = "Your match has arrived. Head over to RecommendME to see what someone picked for you."
        html = email_html_wrap("Your match is ready", body)
        await send_email_async(user["email"], "Your match is ready", html)
    except Exception as e:
        logger.warning(f"Email match_ready failed: {e}")

async def send_email_follow_warning(user_id: str, match_id: str):
    """Follow window 2h warning (if opted in)"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1, "email_opt_out": 1, "is_guest": 1})
        if not user or user.get("is_guest"):
            return
        opt_out = user.get("email_opt_out", [])
        if "follow_warning" in opt_out or "all" in opt_out:
            return
        unsub = get_unsubscribe_link(user_id, "follow_warning")
        body = "You have a few hours left to follow back from your recent exchange. No pressure, just a gentle reminder."
        html = email_html_wrap("Still thinking about it", body, unsub)
        await send_email_async(user["email"], "Still thinking about it", html)
    except Exception as e:
        logger.warning(f"Email follow_warning failed: {e}")

async def send_email_connection_formed(user_id: str, other_name: str):
    """Connection formed - both users followed"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1, "is_guest": 1})
        if not user or user.get("is_guest"):
            return
        body = f"You and {other_name or 'someone'} are now connected. You can exchange recommendations anytime."
        html = email_html_wrap("You're connected", body)
        await send_email_async(user["email"], "You're connected", html)
    except Exception as e:
        logger.warning(f"Email connection_formed failed: {e}")

async def send_email_blend_public(user_id: str, blend_token: str):
    """Blend made public"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1, "email_opt_out": 1, "is_guest": 1})
        if not user or user.get("is_guest"):
            return
        opt_out = user.get("email_opt_out", [])
        if "blend_public" in opt_out or "all" in opt_out:
            return
        unsub = get_unsubscribe_link(user_id, "blend_public")
        body = "Your blend is now visible to anyone with the link. Share it if you like."
        html = email_html_wrap("Your blend is live", body, unsub)
        await send_email_async(user["email"], "Your blend is live", html)
    except Exception as e:
        logger.warning(f"Email blend_public failed: {e}")

async def send_email_broadcast_response(user_id: str):
    """Broadcast response received"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1, "email_opt_out": 1, "is_guest": 1})
        if not user or user.get("is_guest"):
            return
        opt_out = user.get("email_opt_out", [])
        if "broadcast_response" in opt_out or "all" in opt_out:
            return
        unsub = get_unsubscribe_link(user_id, "broadcast_response")
        body = "Someone responded to your request with a recommendation. Check your list."
        html = email_html_wrap("Someone responded to your request", body, unsub)
        await send_email_async(user["email"], "Someone responded to your request", html)
    except Exception as e:
        logger.warning(f"Email broadcast_response failed: {e}")

async def send_email_link_submission(user_id: str):
    """Type 1 link submission received"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1, "email_opt_out": 1, "is_guest": 1})
        if not user or user.get("is_guest"):
            return
        opt_out = user.get("email_opt_out", [])
        if "link_submission" in opt_out or "all" in opt_out:
            return
        unsub = get_unsubscribe_link(user_id, "link_submission")
        body = "Someone left you a recommendation through your link. Check your list to see what they shared."
        html = email_html_wrap("Someone left you a recommendation", body, unsub)
        await send_email_async(user["email"], "Someone left you a recommendation", html)
    except Exception as e:
        logger.warning(f"Email link_submission failed: {e}")

async def send_email_exchange_link_threshold(user_id: str, count: int):
    """Type 2 Fibonacci threshold crossed"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1, "email_opt_out": 1, "is_guest": 1})
        if not user or user.get("is_guest"):
            return
        opt_out = user.get("email_opt_out", [])
        if "exchange_link_activity" in opt_out or "all" in opt_out:
            return
        unsub = get_unsubscribe_link(user_id, "exchange_link_activity")
        body = f"Your exchange link has received {count} responses. People are sharing recommendations with you."
        html = email_html_wrap("Your exchange link is getting responses", body, unsub)
        await send_email_async(user["email"], "Your exchange link is getting responses", html)
    except Exception as e:
        logger.warning(f"Email exchange_link_activity failed: {e}")

async def send_email_known_blend_accepted(user_id: str, accepter_name: str):
    """Known blend invite accepted"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1, "email_opt_out": 1, "is_guest": 1})
        if not user or user.get("is_guest"):
            return
        opt_out = user.get("email_opt_out", [])
        if "known_blend_accepted" in opt_out or "all" in opt_out:
            return
        unsub = get_unsubscribe_link(user_id, "known_blend_accepted")
        body = f"{accepter_name or 'Someone'} accepted your blend invite. Your taste comparison is ready."
        html = email_html_wrap("They joined your blend", body, unsub)
        await send_email_async(user["email"], "They joined your blend", html)
    except Exception as e:
        logger.warning(f"Email known_blend_accepted failed: {e}")

async def send_email_waitlist_invite(email: str, invite_link: str):
    """Waitlist invite (admin-triggered)"""
    try:
        body = f"You're in. Here's your link to get started: <a href=\"{invite_link}\">{invite_link}</a>"
        html = email_html_wrap("You're in", body)
        await send_email_async(email, "You're in", html)
    except Exception as e:
        logger.warning(f"Email waitlist_invite failed: {e}")

async def send_email_pro_waitlist_join(email: str):
    """Pro waitlist join confirmation"""
    try:
        body = "We've saved your spot on the Pro waitlist. We'll let you know when it's your turn."
        html = email_html_wrap("We've saved your spot", body)
        await send_email_async(email, "We've saved your spot", html)
    except Exception as e:
        logger.warning(f"Email pro_waitlist_join failed: {e}")

# ── UNSUBSCRIBE ENDPOINT ──
class UnsubscribeBody(BaseModel):
    uid: str
    trigger: str
    token: str

@api.post("/unsubscribe")
async def unsubscribe(body: UnsubscribeBody):
    """Unsubscribe from a specific email trigger type."""
    # Verify token
    expected = hashlib.sha256(f"{body.uid}:{body.trigger}:{get_jwt_secret()}".encode()).hexdigest()[:24]
    if body.token != expected:
        raise HTTPException(400, "Invalid unsubscribe link")
    # Check if trigger is opt-outable
    if body.trigger not in EMAIL_TRIGGERS or not EMAIL_TRIGGERS.get(body.trigger):
        raise HTTPException(400, "Cannot unsubscribe from this email type")
    try:
        user = await db.users.find_one({"_id": ObjectId(body.uid)})
        if not user:
            raise HTTPException(404, "User not found")
        opt_out = user.get("email_opt_out", [])
        if body.trigger not in opt_out:
            opt_out.append(body.trigger)
            await db.users.update_one({"_id": ObjectId(body.uid)}, {"$set": {"email_opt_out": opt_out}})
        return {"ok": True, "message": f"Unsubscribed from {body.trigger} emails"}
    except Exception as e:
        logger.warning(f"Unsubscribe failed: {e}")
        raise HTTPException(500, "Failed to unsubscribe")

@api.get("/unsubscribe")
async def unsubscribe_get(uid: str, trigger: str, token: str):
    """GET endpoint for unsubscribe links in emails."""
    expected = hashlib.sha256(f"{uid}:{trigger}:{get_jwt_secret()}".encode()).hexdigest()[:24]
    if token != expected:
        raise HTTPException(400, "Invalid unsubscribe link")
    if trigger not in EMAIL_TRIGGERS or not EMAIL_TRIGGERS.get(trigger):
        raise HTTPException(400, "Cannot unsubscribe from this email type")
    try:
        user = await db.users.find_one({"_id": ObjectId(uid)})
        if not user:
            raise HTTPException(404, "User not found")
        opt_out = user.get("email_opt_out", [])
        if trigger not in opt_out:
            opt_out.append(trigger)
            await db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"email_opt_out": opt_out}})
        return {"ok": True, "message": "You've been unsubscribed from these emails."}
    except Exception:
        raise HTTPException(500, "Failed to unsubscribe")

# ── LINK EVENTS TRACKING ──
class LinkEventBody(BaseModel):
    link_type: str  # 'rec_card' | 'blend_card' | 'stats_card'
    event_type: str = "click"

@api.post("/link-events")
async def track_link_event(body: LinkEventBody, user: dict = Depends(get_current_user)):
    """Track shareable card generation events."""
    await db.link_events.insert_one({
        "user_id": user["_id"],
        "link_type": body.link_type,
        "event_type": body.event_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}

# ── Include Router ──
app.include_router(api)

# ── HEALTH ──
@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}

# ── CRON HELPER ──
def verify_cron_secret(x_cron_secret: str = Header(None)):
    if not CRON_SECRET or x_cron_secret != CRON_SECRET:
        raise HTTPException(403, "Invalid cron secret")

cron_router = APIRouter(prefix="/api/internal/cron")

# ── CRON: MATCHING QUEUE (LLM fallback for entries older than 24h) ──
@cron_router.post("/matching-queue")
async def cron_matching_queue(_=Depends(verify_cron_secret)):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    stale = await db.matching_pool.find({"entered_at": {"$lt": cutoff}}).to_list(50)
    processed = 0
    errors = 0
    for entry in stale:
        try:
            if groq_client:
                await generate_llm_fallback(entry["user_id"], entry["category"], entry.get("request_note", ""))
                processed += 1
            else:
                await db.matching_pool.delete_one({"_id": entry["_id"]})
                processed += 1
        except Exception as e:
            logger.warning(f"Cron matching-queue error: {e}")
            errors += 1
    await db.cron_logs.insert_one({
        "job_name": "matching-queue", "records_processed": processed,
        "errors": errors, "ran_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"processed": processed, "errors": errors}

# ── CRON: FOLLOW EXPIRY (expire 24h follow windows) ──
@cron_router.post("/follow-expiry")
async def cron_follow_expiry(_=Depends(verify_cron_secret)):
    now = datetime.now(timezone.utc).isoformat()
    expired = await db.matches.find({
        "status": "active", "expires_at": {"$lt": now, "$ne": None}
    }).to_list(200)
    processed = 0
    for m in expired:
        await db.matches.update_one({"_id": m["_id"]}, {"$set": {"status": "expired"}})
        processed += 1
    await db.cron_logs.insert_one({
        "job_name": "follow-expiry", "records_processed": processed,
        "errors": 0, "ran_at": now,
    })
    return {"processed": processed, "errors": 0}

# ── CRON: LLM FALLBACK (generate LLM recs for long-waiting users) ──
@cron_router.post("/llm-fallback")
async def cron_llm_fallback(_=Depends(verify_cron_secret)):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()
    waiting = await db.matching_pool.find({"entered_at": {"$lt": cutoff}}).to_list(20)
    processed = 0
    errors = 0
    for entry in waiting:
        try:
            if groq_client:
                await generate_llm_fallback(entry["user_id"], entry["category"], entry.get("request_note", ""))
                processed += 1
        except Exception as e:
            logger.warning(f"Cron llm-fallback error: {e}")
            errors += 1
    await db.cron_logs.insert_one({
        "job_name": "llm-fallback", "records_processed": processed,
        "errors": errors, "ran_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"processed": processed, "errors": errors}

# ── CRON: CLEANUP (expired links, old pool entries, stale data, old cron_logs) ──
@cron_router.post("/cleanup")
async def cron_cleanup(_=Depends(verify_cron_secret)):
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    processed = 0
    expired_links = await db.rec_exchange_links.update_many(
        {"is_active": True, "expires_at": {"$lt": now_iso}}, {"$set": {"is_active": False}})
    processed += expired_links.modified_count
    cutoff_48h = (now - timedelta(hours=48)).isoformat()
    stale_pool = await db.matching_pool.delete_many({"entered_at": {"$lt": cutoff_48h}})
    processed += stale_pool.deleted_count
    expired_broadcasts = await db.broadcasts.update_many(
        {"is_active": True, "expires_at": {"$lt": now_iso}}, {"$set": {"is_active": False}})
    processed += expired_broadcasts.modified_count
    cutoff_1h = (now - timedelta(hours=1)).isoformat()
    old_attempts = await db.login_attempts.delete_many({"locked_until": {"$lt": cutoff_1h}})
    processed += old_attempts.deleted_count
    # Delete cron_logs older than 14 days
    cutoff_14d = (now - timedelta(days=14)).isoformat()
    old_logs = await db.cron_logs.delete_many({"ran_at": {"$lt": cutoff_14d}})
    processed += old_logs.deleted_count
    await db.cron_logs.insert_one({
        "job_name": "cleanup", "records_processed": processed,
        "errors": 0, "ran_at": now_iso,
    })
    return {"processed": processed, "errors": 0}

app.include_router(cron_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ──
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("public_handle", sparse=True)
    await db.login_attempts.create_index("identifier")
    await db.matching_pool.create_index("category")
    try:
        await db.matching_pool.drop_index("user_id_1")
    except Exception:
        pass
    await db.matching_pool.create_index("user_id", unique=True)
    await db.shareable_links.create_index("token", unique=True)
    await db.rec_exchange_links.create_index("token", unique=True)
    await db.blends.create_index("public_token", unique=True)
    await db.known_blend_invites.create_index("token", unique=True)
    await db.blocks.create_index([("blocker_id", 1), ("blocked_id", 1)], unique=True)
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@recommendme.app")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "display_name": "Admin", "city": "", "is_pro": True, "is_admin": True,
            "is_banned": False, "public_handle": "", "is_public": False,
            "default_rec_read": None, "default_rec_read_set_at": None,
            "default_rec_listen": None, "default_rec_listen_set_at": None,
            "default_rec_watch": None, "default_rec_watch_set_at": None,
            "match_count": 0, "match_count_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "known_blend_invites_sent": 0, "social_handle": "", "social_platform": None,
            "invited_by": None, "referral_source": "",
            "email_opt_out": [], "auth_provider": "email",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

@app.on_event("shutdown")
async def shutdown():
    client.close()
