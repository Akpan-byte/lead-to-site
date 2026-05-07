# Lead-to-Site

Personalized outreach pipeline: upload a CSV of leads, scrape their websites, generate branded landing pages, and deploy to Vercel — with live progress tracking.

## Architecture

```
CSV Upload → Scrape (Crawl4AI + Scrapling) → Generate Website (Dynamic HTML) → Deploy to Vercel
                                                                                         ↓
                                                                                   SmartLead Ready
```

## Quick Start

```bash
cd /config/lead-to-site-ui

# Install dependencies
npm install

# Copy and fill env vars
cp .env.local.example .env.local
# Edit .env.local with your Vercel token

# Run dev server
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VERCEL_API_TOKEN` | Yes (for deploys) | Vercel API token from vercel.com/account/tokens |
| `DEEPSEEK_API_KEY` | No | DeepSeek API key for AI-powered content personalization |
| `DEEPSEEK_BASE_URL` | No | DeepSeek API base URL (default: https://api.deepseek.com) |

## CSV Format

Required columns:
- `company_name` — Business name
- `website_url` — Company's website URL
- `email` — Contact email

Optional columns:
- `owner_name`, `first_name`, `last_name` — Personalization
- `industry`, `location` — Context
- `brand_color` — Primary hex color (e.g. `#4F46E5`)
- `secondary_color` — Accent hex color
- `tagline` — Company tagline
- `services` — Comma-separated service list

See `sample_leads.csv` for a full example.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Pipeline**: Python 3 — Crawl4AI, Scrapling (Patchright), DeepSeek API
- **Deploy**: Vercel REST API v13
- **Website Gen**: Dynamic HTML with CSS variable brand injection

## Project Structure

```
lead-to-site/
├── pipeline/                    # Python pipeline scripts
│   ├── pipeline.py              # Main orchestrator (CSV → scrape → generate → deploy)
│   ├── site_scraper.py          # Crawl4AI + Scrapling scraper
│   ├── website_template.py     # Dynamic HTML generator (27KB, ~600 lines)
│   ├── deepseek_client.py       # DeepSeek API client for AI personalization
│   └── sample_leads.csv         # 3 test leads
│
lead-to-site-ui/                # Next.js web UI
├── app/
│   ├── page.tsx                 # Main dashboard (drag-drop, live SSE progress)
│   ├── api/
│   │   ├── upload/route.ts       # CSV upload → save to /tmp/lead-to-site/{run_id}/
│   │   ├── pipeline/[run_id]/
│   │   │   ├── run/route.ts      # SSE stream → spawns python pipeline.py
│   │   │   └── status/route.ts  # Poll for run status + lead progress
│   │   ├── settings/route.ts    # GET/POST API keys (stored in /tmp/)
│   │   └── sample/route.ts      # Serve sample_leads.csv for download
│   ├── globals.css               # Dark theme, animations
│   └── layout.tsx
├── lib/
│   ├── api.ts                   # Client-side API helpers
│   └── csv.ts                   # CSV parse + download helpers
└── types/
    └── index.ts                 # Shared TypeScript types
```

## How It Works

1. **Upload**: User drops a CSV file → saved to `/tmp/lead-to-site/{run_id}/input.csv`
2. **Run Pipeline**: Click "Run Pipeline" → SSE connects → spawns `python3 pipeline.py --csv ... --json-output`
3. **Live Progress**: Python script emits JSON lines per lead (scraping/generating/deploying/done) → SSE streams to UI
4. **Status Polling**: `/api/pipeline/{run_id}/status` returns current lead progress map
5. **Results**: Pipeline saves `results.json` → status endpoint returns it → UI shows final URLs

## Deployment

### Vercel (Recommended)

```bash
cd lead-to-site-ui
vercel --prod
# Set environment variables in Vercel dashboard:
# VERCEL_API_TOKEN, DEEPSEEK_API_KEY
```

### Self-hosted

```bash
cd /config/lead-to-site-ui
npm run build
npm start
```

### Set up Vercel token

1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Create a token with `deployments:create` and `projects:read` scopes
3. Add to UI settings or set `VERCEL_API_TOKEN` env var

## Testing the Pipeline (CLI)

```bash
cd /config/lead-to-site

# Test with sample data (no deploy)
python3 pipeline.py --test

# Process CSV (no deploy)
python3 pipeline.py --csv sample_leads.csv

# Process CSV + deploy to Vercel
python3 pipeline.py --csv sample_leads.csv --live --token YOUR_TOKEN

# Skip scraping (use CSV data only)
python3 pipeline.py --csv sample_leads.csv --scrape-disabled
```

## License

AGPL-3.0 — see LICENSE file
