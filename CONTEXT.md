# RecommendME V6 - Complete Project Context

## Overview

RecommendME is a human-filtered taste exchange platform where users give and receive recommendations in three categories: Read, Listen, and Watch. The core mechanic is simple: you receive a recommendation only after you give one. Users are matched with strangers, exchange recommendations, and can form connections through mutual follows.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Tailwind CSS + Shadcn UI |
| Backend | FastAPI + Motor (async MongoDB driver) |
| Database | MongoDB |
| Auth | JWT (httpOnly cookies + localStorage fallback) |
| LLM | Groq API (llama-3.3-70b-versatile) |
| Email | Resend |
| Hosting | Render (backend) + Vercel (frontend) |

## Directory Structure

```
/app/
├── backend/
│   ├── server.py           # Main FastAPI application (all routes)
│   ├── requirements.txt    # Python dependencies
│   ├── .env               # Environment variables
│   └── .env.example       # Env template
├── frontend/
│   ├── src/
│   │   ├── App.js         # Main app with routing
│   │   ├── index.js       # Entry point
│   │   ├── index.css      # Global styles + Tailwind
│   │   ├── components/
│   │   │   ├── BottomNav.js         # Mobile navigation
│   │   │   ├── GoogleSignInButton.js # OAuth button
│   │   │   ├── Navbar.js            # Top navigation
│   │   │   ├── ProtectedRoute.js    # Auth guard
│   │   │   ├── ShareCard.js         # html2canvas shareable cards
│   │   │   └── ui/                  # Shadcn UI components
│   │   ├── contexts/
│   │   │   └── AuthContext.js       # Auth state management
│   │   ├── hooks/
│   │   │   └── use-toast.js         # Toast notifications
│   │   ├── lib/
│   │   │   ├── api.js               # Axios instance
│   │   │   └── utils.js             # Utility functions
│   │   └── pages/
│   │       ├── AdminDashboard.js
│   │       ├── AuthCallback.js      # Google OAuth callback
│   │       ├── ConnectionsPage.js
│   │       ├── ExchangeReveal.js
│   │       ├── HomePage.js
│   │       ├── KnownBlendInvitePage.js
│   │       ├── LandingPage.js
│   │       ├── LoginPage.js
│   │       ├── MatchingScreen.js
│   │       ├── MyList.js
│   │       ├── ProfilePage.js
│   │       ├── PublicTastePage.js
│   │       ├── RecExchangePage.js
│   │       ├── RegisterPage.js
│   │       └── ShareableLinkPage.js
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.js
│   └── .env.example
├── memory/
│   └── PRD.md              # Product requirements document
├── render.yaml             # Render deployment config
├── vercel.json            # Vercel routing config
└── test_result.md         # Testing state tracker
```

## Design System (Bold Flat)

### Visual Language
- **Borders**: 2px solid #1a1a1a (hard, no blur)
- **Shadows**: 4px 4px 0 #1a1a1a (offset, never blurred)
- **Background**: #FFFDF7 (warm off-white, never pure white)
- **Cards**: #FFFFFF with hard shadow
- **Press Animation**: translate(4px, 4px) + shadow:none
- **No images**: Purely typographic design

### Typography
- **Headings**: Fredoka (font-heading)
- **Body**: Nunito (font-body)
- **Case**: Sentence case only

### Category Colors
| Category | Color | Text Color |
|----------|-------|------------|
| Read | #FF9600 (orange) | white |
| Listen | #FF4B4B (red) | white |
| Watch | #FFC800 (yellow) | #1a1a1a |

### Accent Colors
- Primary Blue: #1CB0F6
- Success Green: #58CC02
- Error Red: #FF4B4B
- Muted Gray: #6b6b6b

## Database Schema (MongoDB Collections)

### users
```javascript
{
  _id: ObjectId,
  email: string,              // unique
  password_hash: string,      // bcrypt hash (empty for Google/guest)
  display_name: string,
  city: string,
  is_pro: boolean,            // Pro subscription status
  is_admin: boolean,
  is_banned: boolean,
  is_guest: boolean,          // Anonymous guest user
  guest_id: string,           // Guest identifier for conversion
  guest_match_limit: number,  // 1 for guests
  public_handle: string,      // For public taste page URL
  is_public: boolean,         // Public profile visibility
  
  // Weekly defaults (expire after 168h)
  default_rec_read: ObjectId,
  default_rec_read_set_at: ISODate,
  default_rec_listen: ObjectId,
  default_rec_listen_set_at: ISODate,
  default_rec_watch: ObjectId,
  default_rec_watch_set_at: ISODate,
  
  // Rate limiting
  match_count: number,        // Daily match count
  match_count_date: string,   // YYYY-MM-DD
  
  // Social
  social_handle: string,
  social_platform: "instagram" | "snapchat" | "x",
  known_blend_invites_sent: number,  // Max 2
  
  // Tracking
  invited_by: string,         // User ID who invited via known blend
  referral_source: string,    // How they found the app
  email_opt_out: string[],    // Array of opted-out email triggers
  auth_provider: "email" | "google",
  created_at: ISODate
}
```

### recommendations
```javascript
{
  _id: ObjectId,
  user_id: string,           // null for anonymous/LLM recs
  title: string,
  author: string,
  category: "read" | "listen" | "watch",
  genre: string,             // Normalized genre
  url: string,               // Optional link
  og_cache: object,          // Cached OG metadata
  why_note: string,          // Min 20 chars
  created_at: ISODate
}
```

### matches
```javascript
{
  _id: ObjectId,
  user_a_id: string,
  user_b_id: string,         // null for LLM fallback
  category: string,
  status: "pending" | "active" | "completed" | "expired",
  created_at: ISODate,
  expires_at: ISODate,       // 24h follow window
  rec_a_id: string,          // User A's recommendation
  rec_b_id: string,          // User B's recommendation
  revealed_at: ISODate,
  is_llm_fallback: boolean   // True if generated by LLM
}
```

### matching_pool
```javascript
{
  _id: ObjectId,
  user_id: string,           // unique index
  category: string,
  rec_id: string,            // Optional pre-selected rec
  entered_at: ISODate,
  request_note: string       // Optional context for LLM fallback
}
```

### follows
```javascript
{
  _id: ObjectId,
  follower_id: string,
  followee_id: string,
  match_id: string,
  created_at: ISODate
}
```

### connections
```javascript
{
  _id: ObjectId,
  user_a_id: string,
  user_b_id: string,
  formed_at: ISODate,
  ended_at: ISODate,         // null if active
  exchange_count: number,    // Mutual exchanges
  social_a_visible: boolean,
  social_b_visible: boolean
}
```

### blends
```javascript
{
  _id: ObjectId,
  connection_id: string,     // null for known blends
  user_a_id: string,
  user_b_id: string,
  blend_type: "stranger" | "known",
  public_token: string,      // Shareable URL token
  is_public: boolean,
  score: number,             // 0-100 compatibility score
  descriptors: string[],     // Taste descriptors
  score_summary: string,     // LLM-generated summary
  score_computed_at: ISODate,
  created_at: ISODate
}
```

### broadcasts
```javascript
{
  _id: ObjectId,
  user_id: string,
  category: string,
  request_text: string,
  created_at: ISODate,
  expires_at: ISODate,       // 7 days
  is_active: boolean
}
```

### list_entries
```javascript
{
  _id: ObjectId,
  user_id: string,
  recommendation_id: string,
  match_id: string,
  source_type: "match" | "llm" | "link" | "rec_exchange" | "broadcast",
  received_at: ISODate,
  completion_status: "not_started" | "in_progress" | "completed",
  completion_date: ISODate,
  user_comment: string,
  is_archived: boolean,
  show_note_publicly: boolean
}
```

### blocks
```javascript
{
  _id: ObjectId,
  blocker_id: string,
  blocked_id: string,
  created_at: ISODate
}
```

### reports
```javascript
{
  _id: ObjectId,
  reporter_id: string,
  reported_user_id: string,
  match_id: string,
  reason: string,
  detail: string,
  created_at: ISODate,
  resolved_at: ISODate,
  resolved_by: string
}
```

### shareable_links
```javascript
{
  _id: ObjectId,
  user_id: string,
  token: string,             // URL token
  created_at: ISODate
}
```

### rec_exchange_links
```javascript
{
  _id: ObjectId,
  user_id: string,
  token: string,
  rec_id: string,            // Frozen recommendation
  created_at: ISODate,
  expires_at: ISODate,       // 72h
  is_active: boolean,
  last_notified_count: number  // For Fibonacci notifications
}
```

### link_submissions
```javascript
{
  _id: ObjectId,
  link_id: string,           // Type 1 link
  rec_exchange_link_id: string,  // Type 2 link
  category: string,
  title: string,
  author: string,
  why_note: string,
  created_at: ISODate,
  ip_hash: string            // Rate limiting
}
```

### known_blend_invites
```javascript
{
  _id: ObjectId,
  inviter_id: string,
  token: string,
  accepted_by: string,
  created_at: ISODate,
  accepted_at: ISODate,
  blend_id: string,
  status: "pending" | "accepted" | "expired"
}
```

### waitlist
```javascript
{
  _id: ObjectId,
  email: string,
  referral_source: string,
  created_at: ISODate,
  invited_at: ISODate
}
```

### cron_logs
```javascript
{
  _id: ObjectId,
  job_name: string,
  records_processed: number,
  connections_formed: number,
  errors: number,
  ran_at: ISODate
}
```

### link_events
```javascript
{
  _id: ObjectId,
  user_id: string,
  link_type: "rec_card" | "blend_card" | "stats_card",
  event_type: "click",
  created_at: ISODate
}
```

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Email/password registration |
| POST | /api/auth/login | No | Email/password login |
| POST | /api/auth/logout | Yes | Clear session |
| GET | /api/auth/me | Yes | Get current user |
| POST | /api/auth/refresh | Cookie | Refresh access token |
| PUT | /api/auth/profile | Yes | Update profile |
| POST | /api/auth/google-callback | No | Google OAuth exchange |
| POST | /api/auth/guest | No | Create anonymous guest |
| POST | /api/auth/convert-guest | No | Convert guest to registered |

### Recommendations
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/recommendations | Yes | Create recommendation |
| GET | /api/recommendations/mine | Yes | Get my recommendations |
| DELETE | /api/recommendations/{id} | Yes | Delete recommendation |
| POST | /api/recommendations/set-weekly-default | Yes | Set weekly default |
| GET | /api/recommendations/weekly-defaults | Yes | Get weekly defaults |

### Matching
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/matching/enter | Yes | Enter matching pool |
| GET | /api/matching/check | Yes | Check for match |
| POST | /api/matching/cancel | Yes | Leave matching pool |
| POST | /api/matching/write-rec | Yes | Submit rec for match |
| POST | /api/matching/reveal/{id} | Yes | Reveal exchange |
| GET | /api/matching/exchange/{id} | Yes | Get exchange details |
| GET | /api/matches/active | Yes | Get active matches |

### Social
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/follow | Yes | Follow from match |
| POST | /api/downvote | Yes | Downvote match |
| GET | /api/connections | Yes | List connections |
| POST | /api/connections/{id}/disconnect | Yes | End connection |
| POST | /api/connections/{id}/toggle-social | Yes | Toggle social visibility |
| POST | /api/connection-exchange | Yes | Send rec to connection |

### Broadcasts
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/broadcasts | Yes | Create broadcast |
| GET | /api/broadcasts | Yes | List broadcasts |
| POST | /api/broadcasts/respond | Yes | Respond to broadcast |
| POST | /api/broadcasts/{id}/close | Yes | Close broadcast |

### List Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/list | Yes | Get my list |
| PUT | /api/list/{id} | Yes | Update list entry |
| DELETE | /api/list/{id} | Yes | Delete list entry |
| GET | /api/list/stats | Yes | Get list statistics |

### Blocks & Reports
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/blocks | Yes | Block user |
| GET | /api/blocks | Yes | List blocks |
| DELETE | /api/blocks/{id} | Yes | Unblock user |
| POST | /api/reports | Yes | Report user |

### Links
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/shareable-link/generate | Yes | Generate Type 1 link |
| GET | /api/shareable-link/{token} | No | Get link info |
| POST | /api/shareable-link/{token}/submit | No | Submit via link |
| POST | /api/rec-exchange-link/create | Yes | Create Type 2 link |
| GET | /api/rec-exchange-link/mine | Yes | Get my active link |
| GET | /api/rec-exchange-link/{token} | No | Get link info |
| POST | /api/rec-exchange-link/{token}/submit | No | Submit via link |

### Blends
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/blends | Yes | List my blends |
| GET | /api/blends/{token} | Optional | Get blend by token |
| POST | /api/blends/{id}/toggle-public | Yes | Toggle public visibility |
| POST | /api/blends/{id}/recompute | Yes | Recompute blend score |

### Known Blend Invites
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/known-blend/invite | Yes | Create invite |
| GET | /api/known-blend/invites | Yes | List my invites |
| GET | /api/known-blend/invite/{token} | No | Get invite info |
| POST | /api/known-blend/accept | Yes | Accept invite |

### Public
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/public/user/{handle} | No | Get public taste page |
| GET | /api/og-proxy | No | Fetch OG metadata |
| POST | /api/waitlist | No | Join pro waitlist |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/admin/metrics | Admin | Dashboard metrics |
| GET | /api/admin/reports | Admin | List reports |
| GET | /api/admin/users | Admin | List users |
| POST | /api/admin/ban/{id} | Admin | Ban user |
| POST | /api/admin/unban/{id} | Admin | Unban user |
| POST | /api/admin/resolve-report/{id} | Admin | Resolve report |

### Email & Tracking
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/unsubscribe | No | Unsubscribe via link |
| POST | /api/unsubscribe | No | Unsubscribe via API |
| POST | /api/link-events | Yes | Track card generation |

### Cron (Internal)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/internal/cron/matching-queue | Cron | Process stale pool entries |
| POST | /api/internal/cron/follow-expiry | Cron | Expire follow windows |
| POST | /api/internal/cron/llm-fallback | Cron | Generate LLM recs |
| POST | /api/internal/cron/cleanup | Cron | Clean expired data |

### Health
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /health | No | Health check |
| GET | /api/health | No | Health check |

## Authentication Flow

### Email/Password
1. User registers via `/api/auth/register`
2. Backend creates user, generates JWT tokens
3. Access token (24h) in httpOnly cookie + localStorage
4. Refresh token (7d) in httpOnly cookie
5. Frontend includes token in Authorization header or cookie

### Google OAuth
1. Frontend redirects to Emergent OAuth URL
2. User authenticates with Google
3. Callback returns session_id in URL hash
4. Frontend sends session_id to `/api/auth/google-callback`
5. Backend exchanges for user info, creates/updates user
6. Returns JWT tokens like regular login

### Guest Sessions
1. Frontend calls `/api/auth/guest`
2. Backend creates user with is_guest=true
3. Guest gets 1 match lifetime limit
4. Guest can convert via `/api/auth/convert-guest`
5. Conversion migrates all data atomically

## Email System

### Triggers (with opt-out status)
| Trigger | Subject | Opt-out |
|---------|---------|---------|
| match_ready | Your match is ready | No |
| follow_warning | Still thinking about it | Yes |
| connection_formed | You're connected | No |
| blend_public | Your blend is live | Yes |
| broadcast_response | Someone responded to your request | Yes |
| link_submission | Someone left you a recommendation | Yes |
| exchange_link_activity | Your exchange link is getting responses | Yes |
| known_blend_accepted | They joined your blend | Yes |
| pro_waitlist_join | We've saved your spot | No |

### Fibonacci Batching (Type 2 Links)
Thresholds: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89
- Email sent when response count crosses threshold
- Only highest crossed threshold triggers email
- `last_notified_count` tracks notification state

### Unsubscribe
- Token: SHA256(user_id:trigger:JWT_SECRET)[:24]
- Link format: `{FRONTEND_URL}/unsubscribe?uid={id}&trigger={type}&token={token}`
- Adds trigger to user's `email_opt_out` array

## LLM Integration (Groq)

### Genre Inference
- Triggered when recommendation created without genre
- Background task calls Groq API
- Updates recommendation with normalized genre

### Blend Scoring
- Compares list entries between two users
- Returns score (0-100), descriptors, summary
- Rate limited to 1 recompute per hour

### LLM Fallback Recommendations
- Triggered for users in pool 24h+ without match
- Generates personalized recommendation
- Creates match with is_llm_fallback=true
- Rate limited to 1 per user per 24h

## Cron Jobs (External Scheduler)

Configure at cron-job.org after deployment:

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| /health | Every 14 min | Prevent cold starts |
| /api/internal/cron/matching-queue | Every 60s | Process LLM fallbacks |
| /api/internal/cron/follow-expiry | Every 5 min | Expire follow windows |
| /api/internal/cron/llm-fallback | Every 30 min | Generate LLM recs |
| /api/internal/cron/cleanup | Daily 02:00 UTC | Clean old data |

All cron endpoints require `X-Cron-Secret` header.

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=recommendme
JWT_SECRET=<strong random string>
ADMIN_EMAIL=admin@recommendme.app
ADMIN_PASSWORD=<secure password>
CORS_ORIGINS=*
FRONTEND_URL=https://your-domain.com
GROQ_API_KEY=<groq api key>
GROQ_MODEL=llama-3.3-70b-versatile
RESEND_API_KEY=<resend api key>
SENDER_EMAIL=noreply@recommendme.app
CRON_SECRET=<strong random string>
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://your-backend.onrender.com
REACT_APP_GOOGLE_CLIENT_ID=<google oauth client id>
```

## Frontend Routes

| Path | Component | Auth | Description |
|------|-----------|------|-------------|
| / | LandingPage | No | Marketing page |
| /login | LoginPage | No | Login form |
| /register | RegisterPage | No | Registration form |
| /auth/callback | AuthCallback | No | OAuth callback |
| /home | HomePage | Yes | Main dashboard |
| /matching | MatchingScreen | Yes | Matching animation |
| /exchange/:id | ExchangeReveal | Yes | Match reveal |
| /list | MyList | Yes | User's list |
| /connections | ConnectionsPage | Yes | Connections/Blends |
| /profile | ProfilePage | Yes | Settings |
| /admin | AdminDashboard | Admin | Admin panel |
| /r/:token | ShareableLinkPage | No | Type 1 link |
| /x/:token | RecExchangePage | No | Type 2 link |
| /u/:handle | PublicTastePage | No | Public profile |
| /blend-invite/:token | KnownBlendInvitePage | No | Blend invite |
| /unsubscribe | - | No | Email unsubscribe |

## Key Business Rules

### Match Limits
- Free users: 3 matches/day
- Pro users: 10 matches/day
- Guests: 1 match lifetime

### Weekly Defaults
- Each category can have one default recommendation
- Expires after 168 hours (7 days)
- Auto-used when entering pool without selecting rec

### Follow Window
- 24 hours to follow after match reveal
- Mutual follow creates connection + blend
- Window expiry handled by cron job

### Known Blend Invites
- Each user gets 2 invite slots
- Invites expire after 72 hours
- Expired invites return slot

### Social Handle Reveal
- Requires 7 mutual exchanges
- Each user controls their visibility
- Both must opt-in for mutual reveal

### Blocking
- Severs existing connections
- Archives list entries from blocked user
- Excludes from future matching

## Shareable Cards

Three variants generated client-side with html2canvas:

1. **Single Rec Card** (9:16)
   - Category color block at top
   - Title, author, why-note
   - Source badge
   - RecommendME branding

2. **Blend Story Card**
   - Score percentage
   - Descriptors as pills
   - Score summary
   - User attribution

3. **Taste Stats Card**
   - Category bars (Read/Listen/Watch)
   - Total and completed counts
   - Public profile link

All cards use inline styles only (html2canvas requirement).

## Test Credentials

- **Admin**: admin@recommendme.app / Admin123!

---

*Last updated: April 2026*
*Version: V6 Complete*
