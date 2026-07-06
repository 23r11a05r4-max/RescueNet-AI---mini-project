# Sentinel Command Center — PRD

## Original Problem
Build a Real-Time Alerts & AI Intelligence Dashboard for missing person investigations, with:
- 16 alert event types (report submitted, AI face match, CCTV detection, movement path, recovery, etc.)
- Priority levels: Low / Medium / High / Critical
- Real-time dashboard analytics (statistics, demographics, geographic hotspots, trends)
- AI predictive insights and recommendations
- Executive dashboard with response times, AI accuracy, CCTV/voice metrics
- Automated report generation (CSV / JSON / PDF-via-print)

## User Choices (defaults applied)
- AI: **Claude Sonnet 4.5** (`claude-sonnet-4-5-20250929`) via Emergent LLM key
- Auth: **JWT** with roles Admin / Police / NGO / Citizen
- Notifications: **In-app only** (polling every 8s + sonner toasts)
- Seed data: **Yes** — 24 sample investigations auto-seeded on backend startup
- Map: **Leaflet + OpenStreetMap** (no key needed)

## User Personas
- **Admin** — full access, executive dashboard, all reports
- **Police Officer** — case management, status updates
- **NGO Rep** — read-only investigations, assignment tracking
- **Citizen / Reporter** — file missing person reports

## What's Implemented (Feb 2026)
### Backend (`/app/backend/server.py`)
- JWT auth (`/api/auth/register`, `/login`, `/me`) with bcrypt + role-based deps
- Investigations CRUD (`POST/GET /api/investigations`, detail, status PATCH)
- Alerts (`/api/alerts` with priority filter, mark-read)
- Analytics: `/api/analytics/{overview,demographics,geographic,trends,executive}`
- AI Insights (`/api/ai/insights`) — Claude Sonnet 4.5 with 5-min cache and rule-based fallback
- Reports (`/api/reports/summary`, `/investigation/{id}`) with CSV export
- Auto-seed on startup with 24 investigations across 10 Indian districts, 4 demo users

### Frontend
- Login/Register pages with clickable demo credentials
- Command Overview dashboard: StatsCards, GeoMap (Leaflet w/ hotspots + markers), AlertFeed (8s polling + toast on new Critical/High), AI Insights panel (Claude Sonnet 4.5), TrendCharts (area chart 60 days), DemographicCharts (5 charts + auto-insight), ExecutivePanel (10 KPIs)
- Investigations list with status filters + new-report modal
- Investigation detail with timeline, AI matches, CCTV hits, status updates, CSV export
- Reports page with global summary + per-case CSV/JSON exports + PDF (print)
- Dark tactical theme (Chivo + IBM Plex Sans, slate-950 base, cyan AI accent), data-testids on every interactive element

### Testing
- Backend fully validated by testing agent (95%+ pass): auth, all analytics, alerts, AI insights (Claude Sonnet 4.5 responding in ~3s), CSV exports all working

## Backlog / Next Actions (P0/P1/P2)
- **P1** Push notifications (Web Push API) + optional Twilio SMS + Resend email channels
- **P1** WebSocket/SSE for true real-time (currently polling every 8s)
- **P1** Face upload + AI face match integration (currently synthetic scores)
- **P2** Voice AI call integration (ElevenLabs / OpenAI TTS + STT)
- **P2** Live CCTV feed ingestion & AI detection pipeline
- **P2** Real PDF generation server-side (reportlab / weasyprint) instead of browser print
- **P2** Advanced role-based views (NGO-only, citizen-only tailored dashboards)
- **P2** Search team GPS tracking module

## Demo Credentials
See `/app/memory/test_credentials.md`
