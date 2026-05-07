# Changelog

## [Unreleased]

### Added
- **Outreach email generation** — pipeline now generates a personalized cold email per lead, referencing the deployed Vercel URL
- **Groq (Llama 3.3 70B) support** — first-choice AI provider for email generation, free tier at console.groq.com
- **DeepSeek fallback** — second-choice AI provider, falls back to template if no keys set
- **Template email fallback** — no API key needed, fully functional template-based email generation
- **10-sample-lead test CSV** — `leads_test.csv` with 10 realistic leads across industries
- **Dashboard "Copy Email" button** — copies subject + body to clipboard after pipeline completes
- **Groq API key field in Settings modal** — configurable via UI
- **Config file persistence** — tokens saved to `/tmp/lead-to-site/config.json` so pipeline can read them at runtime

### Changed
- **Email generation chain**: Groq → DeepSeek → Template (was: DeepSeek → Template)
- **Pipeline token reading**: Now checks `/tmp/lead-to-site/config.json` in addition to env vars
- **Dashboard build**: Fixed `output: 'export'` incompatibility with API routes; removed static export mode

### Fixed
- `output: 'export'` removed from `next.config.ts` — it broke dynamic API routes (SSE, file I/O)
- Pipeline function name mismatch: `generate_email_with_deepseek` → `generate_email_with_ai`
- CSV services field quoting in test data

## [v1.0.0] — 2025-05-07

### Added
- Full pipeline: CSV → Scrape → Generate HTML → Deploy to Vercel
- `pipeline.py` — main CLI orchestrator
- `site_scraper.py` — Chromium + Crawl4AI + Scrapling dual-engine scraper
- `website_template.py` — 27KB branded HTML generator with CSS variables
- `sample_output/` — pre-generated HTML for sample leads
- Next.js dashboard (`/config/lead-to-site-ui/`) — drag-drop CSV, live SSE progress, results table
- GitHub Actions deploy workflow → GitHub Pages
- Vercel deployment via API (`vcp_` token)
- n8n v1 → v2 upgrade (Python Code nodes not available in either version)
- GitHub Pages fallback hosting
