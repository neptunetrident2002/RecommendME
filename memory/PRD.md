# RecommendME V6 — PRD & Implementation Tracker

## Original Problem Statement
RecommendME V6 rebuild following the detailed V6 prompt document. Complete structural overhaul with bold flat design, new features (weekly defaults, genre, blends, broadcasts, blocking, rec exchange links, public taste pages, known blend invites), Groq LLM integration, and Resend email integration.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI (port 3000)
- **Backend**: FastAPI + Motor (async MongoDB) (port 8001)
- **Database**: MongoDB
- **Auth**: JWT-based email/password + Google OAuth + Anonymous Guest Sessions (httpOnly cookies + localStorage fallback)
- **LLM**: Groq API (llama-3.3-70b-versatile) for genre inference, taste scoring (blends), LLM fallback recommendations
- **Email**: Resend (configured with opt-out support and Fibonacci batching for rec exchange links)
- **Design**: Bold Flat — 2px #1a1a1a borders, 4px offset shadows, #FFFDF7 warm bg, Fredoka + Nunito, no images

## Implemented Features (V6 - Complete)

### Design System (Layer 15)
- Bold flat: 2px hard borders, 4px 4px 0 offset shadows (never blurred)
- Page bg: #FFFDF7 (warm off-white, never pure white)
- Card bg: #FFFFFF with hard shadow
- Press animation: translate(4px, 4px) + shadow:none
- No images anywhere — purely typographic
- Bottom navigation (4 tabs: Home, List, Connections, Profile)
- Sentence case only

### Backend (Layers 1-12)
- Auth with admin seeding, brute force protection (Layer 2)
- Weekly defaults per category with 168h expiry (Layer 2.5)
- Genre normalization with Groq auto-inference (Layer 6)
- Matching pool with block/report exclusion, daily match cap 3/10 (Layer 3)
- Exchange state machine: pending → active → completed (Layer 4)
- Follow window 24h, mutual follow → connection + blend creation (Layer 5)
- Groq: genre inference, blend taste scoring, LLM fallback generation with 24h rate limit (Layer 6)
- Resend: email helper with opt-out support and unsubscribe endpoint (Layer 7)
- Known blend invites (2 slots, 72h expiry) (Layer 8)
- Social handle reveal after 7 exchanges (Layer 9)
- Block system (severs connections, archives entries) (Layer 10)
- Connection exchanges + broadcasts with view tracking (Layer 11)
- Rec exchange links Type 2 (NGL-style, 72h expiry) with Fibonacci batch notifications (Layer 12)
- Public taste page (/u/[handle]) (Layer 13)
- Admin dashboard (numbers only, no charts) with key metrics

### Authentication
- Email/password registration and login
- Google OAuth integration via Emergent OAuth
- Anonymous guest sessions (1 match lifetime limit)
- Guest-to-registered conversion with data migration
- Referral source capture from `?from=` URL parameter

### HTTP Cron Endpoints (for Render free tier)
- `POST /api/internal/cron/matching-queue` — LLM fallback for 24h+ waiting users
- `POST /api/internal/cron/follow-expiry` — Expire 24h follow windows
- `POST /api/internal/cron/llm-fallback` — Generate LLM recs for long-waiting users
- `POST /api/internal/cron/cleanup` — Clean expired links, stale pool entries, old cron_logs (14 days)
- All protected by CRON_SECRET header verification

### Keep-alive Endpoint
- `GET /health` — Returns `{"status": "ok"}` for external pinging

### Resend Email Integration
All emails implemented as background tasks with opt-out support:
- Match ready notification (no opt-out)
- Follow window 2h warning (opt-outable)
- Connection formed notification (no opt-out)
- Blend made public notification (opt-outable)
- Broadcast response notification (opt-outable)
- Type 1 link submission notification (opt-outable)
- Type 2 Fibonacci threshold notifications (1, 2, 3, 5, 8, 13, 21, 34, 55, 89) (opt-outable)
- Known blend invite accepted notification (opt-outable)
- Pro waitlist join confirmation (no opt-out)
- Unsubscribe endpoint with token verification

### OG Link Preview Proxy
- `GET /api/og-proxy?url={encoded_url}` — Fetch OG tags server-side
- Platform-specific handling: Spotify, YouTube, Apple Music, SoundCloud
- Caches results in `og_cache` field on recommendations

### Shareable Cards (html2canvas)
- Single recommendation card (9:16 portrait)
- Blend story card (with score, descriptors, attribution)
- Personal taste stats card (category bars, totals)
- All use inline styles for html2canvas compatibility
- Download and share functionality with navigator.share() on mobile
- Link event tracking for analytics

### Frontend Pages (Layer 15)
- Landing (typographic hero with guest CTA)
- Login / Register (bold flat forms with Google OAuth)
- Home (category buttons, weekly defaults, match CTA)
- Matching screen (ambient animation, no pool count)
- Exchange reveal (state-aware, follow/downvote/report)
- My List (tabs: Received / My additions, filters, edit)
- Connections (tabs: Connections / Broadcasts / Blends)
- Profile (settings, links, known invites, blocks, logout)
- Admin (metrics / reports / users tabs)
- Shareable link (/r/:token)
- Rec exchange (/x/:token)
- Public taste page (/u/:handle)
- Known blend invite (/blend-invite/:token)
- Auth callback for Google OAuth

### Deployment Configuration
- `render.yaml` — Render web service configuration
- `vercel.json` — Frontend routing for SPA
- `.env.example` files for backend and frontend

## P0 Backlog (Next)
- OG meta tags for shared links
- PWA installability

## P1 Backlog
- Sub-categories within Read/Listen/Watch
- Admin-triggered waitlist invite emails

## Not Building
- Stripe or any payment processing
- Dark mode (V6 doc says NOT to build)
- Any Supabase dependency — the stack is FastAPI + MongoDB

## Environment Variables Required

### Backend
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=recommendme
JWT_SECRET=<strong random string>
ADMIN_EMAIL=admin@recommendme.app
ADMIN_PASSWORD=<secure password>
CORS_ORIGINS=*
FRONTEND_URL=https://your-frontend-domain.com
GROQ_API_KEY=<groq api key>
GROQ_MODEL=llama-3.3-70b-versatile
RESEND_API_KEY=<resend api key>
SENDER_EMAIL=noreply@recommendme.app
CRON_SECRET=<strong random string>
```

### Frontend
```
REACT_APP_BACKEND_URL=https://your-backend-api.onrender.com
REACT_APP_GOOGLE_CLIENT_ID=<google oauth client id>
```

## cron-job.org Setup (after deploy)

| Endpoint | Schedule | Header |
|---|---|---|
| `POST {BASE_URL}/health` | Every 14 minutes | none |
| `POST {BASE_URL}/api/internal/cron/matching-queue` | Every 60 seconds | `X-Cron-Secret: {value}` |
| `POST {BASE_URL}/api/internal/cron/follow-expiry` | Every 5 minutes | `X-Cron-Secret: {value}` |
| `POST {BASE_URL}/api/internal/cron/llm-fallback` | Every 30 minutes | `X-Cron-Secret: {value}` |
| `POST {BASE_URL}/api/internal/cron/cleanup` | Once daily at 02:00 UTC | `X-Cron-Secret: {value}` |
