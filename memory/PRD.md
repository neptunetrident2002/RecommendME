# RecommendME — PRD & Implementation Tracker

## Original Problem Statement
Build RecommendME - a human-filtered taste exchange web app based on the detailed PRD. One stranger, one category (Read/Listen/Watch), one recommendation each, 24-hour follow window. Duolingo-inspired UI.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI (port 3000)
- **Backend**: FastAPI + Motor (async MongoDB) (port 8001)
- **Database**: MongoDB
- **Auth**: JWT-based email/password with httpOnly cookies + localStorage fallback
- **Design**: Duolingo-inspired — Fredoka headings, Nunito body, bright playful colors (#1CB0F6 primary, category colors: Orange/Pink/Yellow)

## User Personas
1. **Free Registered User** — 3 matches, full access to list, follow, connections
2. **Pro User** — Unlimited matches (deferred - Stripe integration)
3. **Guest User** — Anonymous via shareable link (deferred - full guest flow)
4. **Admin** — Dashboard at /admin with metrics, reports, user management

## Core Requirements (Static)
- Category selection: Read / Listen / Watch
- Give-first mechanic: user must provide recommendation before receiving
- Why-note: minimum 20 characters explaining personal significance
- 24-hour follow window with countdown
- Mutual follow creates permanent connection
- Personal recommendation list with filters (category, status, source, search)
- Shareable link for anonymous recommendation submission
- Admin dashboard with metrics, reports, user banning

## What's Been Implemented (April 5, 2026)
### Backend (server.py)
- JWT auth (register, login, logout, me, refresh, profile update)
- Admin seeding with brute force protection
- Recommendations CRUD (create, set default, list mine)
- Matching pool system (enter, check, cancel, write-rec, reveal)
- Follow & connections (follow, list, disconnect)
- The List (get with filters, update entry, stats)
- Shareable links (generate, get, submit)
- Reports (create, admin view, resolve)
- Admin (metrics, reports, users, ban/unban)
- MongoDB indexes on email, login_attempts, matching_pool, shareable_links

### Frontend Pages
- Landing page (hero, how-it-works, category preview)
- Login / Register pages
- Home dashboard (category selector, default rec, match CTA, share link)
- Matching screen (ambient animation, pool count, timer, async notice)
- Exchange reveal (dual-card reveal, follow button, countdown, report)
- My List (filters, search, status badges, edit dialog, archive)
- Connections page (list, disconnect)
- Admin dashboard (tabs: metrics, reports, users)
- Shareable link page (/r/:token — anonymous submission + reward)

### Design System
- Fonts: Fredoka (headings) + Nunito (body) via Google Fonts
- Colors: Brand Blue #1CB0F6, Read Orange #FF9600, Listen Pink #FF4B4B, Watch Yellow #FFC800, Success Green #58CC02
- Pushable buttons (border-b-4/5 with active translate)
- Rounded-3xl cards with drop shadows
- All interactive elements have data-testid attributes

## Prioritized Backlog

### P0 (Next)
- LLM fallback with Claude Sonnet (when no match within 24h)
- Email notifications via Resend (match found, follow window, connection)
- Real-time matching with WebSocket/polling improvements

### P1
- Sub-categories within Read/Listen/Watch
- Broadcast requests to connections
- Collaborative lists between connections
- Social card export (PNG via html2canvas)
- OG link preview component

### P2
- Pro subscription with Stripe billing
- Guest user flow (anonymous match via Supabase-style anon sessions)
- Waitlist system with invite emails
- Taste profile quarterly reflection
- Public shareable lists
- PWA installability
