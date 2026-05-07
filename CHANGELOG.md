# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] — 2026-05-07

### Added
- **Next.js Web UI** (`/lead-to-site-ui/`) — Full dashboard with drag-and-drop CSV upload, live SSE progress stream per lead, results table with deployed URLs
- **Pipeline Orchestrator** (`pipeline.py`) — End-to-end: CSV → scrape → merge → generate → deploy. Supports `--json-output` for SSE streaming and `--output-dir` for per-lead HTML files
- **Website Scraper** (`site_scraper.py`) — Dual-engine scraper: Crawl4AI (primary) with Scrapling fallback. Extracts title, description, emails, phones, social links, meta tags
- **Website Generator** (`website_template.py`) — 27KB dynamic HTML template with CSS variable brand injection (primary/secondary colors), services grid, hero section, CTA, responsive layout
- **DeepSeek Client** (`deepseek_client.py`) — OpenAI-compatible API client for AI-powered content personalization (optional, no key needed for basic pipeline)
- **SSE Streaming** — Real-time per-lead progress: queued → scraping → generating → deploying → done. WebSocket-free, just EventSource
- **Settings API** — Tokens stored server-side in `/tmp/lead-to-site/settings.json`, never exposed to client
- **Sample CSV** — 3 realistic test leads: Apex Digital Marketing (Austin TX), Velocity Fitness (Denver CO), CloudScale SaaS (SF CA)
- **Vercel Deploy Stub** — API integration ready, returns early with clear message if no token set

### Architecture
- **Decision: n8n abandoned** — Python Code nodes don't work in n8n v1.23.0 or v2.19.4. Pipeline scripts run standalone; Next.js UI orchestrates via SSE + subprocess
- **No SmartLead integration** — Pipeline stops at Vercel deploy. Outreach step is planned for future

### Known Limitations
- Vercel API token required for real deployments (free tier works)
- DeepSeek API key optional for basic pipeline
- HTML sites are standalone files (no server-side routing)
