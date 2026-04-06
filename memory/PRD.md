# RecommendME V6 — PRD & Implementation Tracker

## Original Problem Statement
RecommendME V6 rebuild following the detailed V6 prompt document. Complete structural overhaul with bold flat design, new features (weekly defaults, genre, blends, broadcasts, blocking, rec exchange links, public taste pages, known blend invites), Groq LLM integration, and Resend email preparation.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI (port 3000)
- **Backend**: FastAPI + Motor (async MongoDB) (port 8001)
- **Database**: MongoDB
- **Auth**: JWT-based email/password (httpOnly cookies + localStorage fallback)
- **LLM**: Groq API (llama-3.3-70b-versatile) for genre inference, taste scoring (blends), LLM fallback recommendations
- **Email**: Resend (configured, needs API key to activate)
- **Design**: Bold Flat — 2px #1a1a1a borders, 4px offset shadows, #FFFDF7 warm bg, Fredoka + Nunito, no images

## What's Been Implemented (V6 - April 6, 2026)

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
- Groq: genre inference, blend taste scoring, LLM fallback generation (Layer 6)
- Resend: email helper configured (Layer 7)
- Known blend invites (2 slots, 72h expiry) (Layer 8)
- Social handle reveal after 7 exchanges (Layer 9)
- Block system (severs connections, archives entries) (Layer 10)
- Connection exchanges + broadcasts with view tracking (Layer 11)
- Rec exchange links Type 2 (NGL-style, 72h expiry) (Layer 12)
- Public taste page (/u/[handle]) (Layer 13)
- Admin dashboard (numbers only, no charts) with key metrics

### Frontend Pages (Layer 15)
- Landing (typographic hero)
- Login / Register (bold flat forms)
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

## Prioritized Backlog

### P0 (Next)
- Activate Resend with API key for email notifications
- Shareable card export (html2canvas)
- LLM fallback cron job (trigger after 24h in pool)
- Pro/waitlist modal on match limit

### P1
- Fibonacci batch email scheduling
- OG meta tags for shared links
- PWA installability
- Sub-categories within Read/Listen/Watch

### P2
- Stripe Pro subscription
- Dark mode (V6 doc says NOT to build)
- External metadata API for URL previews
