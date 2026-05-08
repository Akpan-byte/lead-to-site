#!/usr/bin/env python3
"""
Lead-to-Website Pipeline
========================
End-to-end: CSV → Scrape Site → Generate Website → Deploy to Vercel

Usage:
  python3 pipeline.py --csv sample_leads.csv
  python3 pipeline.py --test  # run with sample data, no Vercel deploy
  python3 pipeline.py --verify-template  # just test template generation
"""

import os
import sys
import csv
import json
import argparse
import time
import re
import base64
from datetime import datetime

# Add local modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from website_template import generate_website
from email_generator import generate_email, generate_email_with_ai
from site_scraper import scrape_site, merge_scraped_with_lead
from gmail_sender import send_from_pipeline

# ─── Vercel Deploy ───────────────────────────────────────────────────────────

def deploy_to_vercel(html_content: str, project_name: str, vercel_token: str = None) -> dict:
    """
    Deploy HTML to Vercel via REST API.
    Vercel API v13+: https://api.vercel.com/v13/deployments
    """
    import urllib.request
    import urllib.error

    token_sources = [
        vercel_token,
        os.environ.get('VERCEL_API_TOKEN'),
        os.environ.get('VERCEL_TOKEN'),
    ]
    # Also check config file
    config_path = '/tmp/lead-to-site/config.json'
    if os.path.exists(config_path):
        try:
            import json as _json
            with open(config_path) as f:
                cfg = _json.load(f)
                if cfg.get('vercel_token'):
                    token_sources.append(cfg['vercel_token'])
                if not os.environ.get('GROQ_API_KEY') and cfg.get('groq_key'):
                    os.environ['GROQ_API_KEY'] = cfg['groq_key']
                if not os.environ.get('DEEPSEEK_API_KEY') and cfg.get('deepseek_key'):
                    os.environ['DEEPSEEK_API_KEY'] = cfg['deepseek_key']
        except:
            pass

    token = next((t for t in token_sources if t), None)
    if not token:
        return {'success': False, 'error': 'No Vercel token found. Set VERCEL_API_TOKEN env var or add vercel_token to /tmp/lead-to-site/config.json'}

    url = 'https://api.vercel.com/v13/deployments'

    # Build files payload — index.html must be base64 encoded for Vercel API
    files_payload = [{
        'file': 'index.html',
        'data': base64.b64encode(html_content.encode('utf-8')).decode('ascii'),
        'encoding': 'base64',
    }]

    payload = json.dumps({
        'name': project_name,
        'files': files_payload,
        'projectSettings': {
            'framework': None,
            'buildCommand': None,
            'outputDirectory': None,
            'installCommand': None,
            'devCommand': None,
        },
        'target': 'production',
        'public': True,  # make publicly accessible (no Vercel auth required)
    }).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            vercel_url = result.get('url', project_name + '.vercel.app')
            # Use SHORT URL (not team-scoped) so it's publicly accessible
            # e.g. "activecampaign-174257-aaa-bbb-theakpanobong-4550s-projects.vercel.app"
            #       -> "activecampaign-174257.vercel.app"
            import re
            m = re.match(r'^([a-z0-9]+-\d+)-', vercel_url.split('.')[0])
            short = m.group(1) + '.vercel.app' if m else vercel_url
            return {
                'success': True,
                'url': f'https://{short}',
                'deployment_id': result.get('id', ''),
                'status': result.get('status', 'READY'),
            }
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else ''
        try:
            err_json = json.loads(error_body)
            msg = err_json.get('error', {}).get('message', err_json.get('message', error_body))
        except:
            msg = error_body
        return {'success': False, 'error': f"HTTP {e.code}: {msg}"}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ─── CSV Parser ───────────────────────────────────────────────────────────────

def parse_csv(filepath: str) -> list[dict]:
    """Parse CSV file into list of lead dicts."""
    leads = []
    with open(filepath, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Strip whitespace from all keys/values
            cleaned = {str(k or '').strip(): (str(v).strip() if v and isinstance(v, str) else '') for k, v in row.items()}
            leads.append(cleaned)
    return leads


def slugify(text: str) -> str:
    """Convert text to a URL-safe slug for Vercel project names."""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text[:50].strip('-')


def csv_has_enough_data(lead: dict) -> tuple[bool, str]:
    """
    Determine if CSV has enough info to skip website scraping.
    Returns (skip, reason) tuple.
    Skip scraping if CSV has 3+ rich data fields (services, tagline, description,
    industry, title) or if website_url is a placeholder.
    """
    # Explicit override
    skip_marker = str(lead.get('skip_scrape', '')).lower().strip()
    if skip_marker in ('true', '1', 'yes'):
        return True, 'explicit skip_scrape=True in CSV'

    score = 0
    rich_fields = []
    if lead.get('services', '').strip():
        score += 1; rich_fields.append('services')
    if lead.get('tagline', '').strip():
        score += 1; rich_fields.append('tagline')
    if lead.get('about_text', '').strip() or lead.get('description', '').strip():
        score += 1; rich_fields.append('description')
    if lead.get('industry', '').strip():
        score += 1; rich_fields.append('industry')
    if lead.get('title', '').strip():
        score += 1; rich_fields.append('title')

    if score >= 3:
        return True, f'CSV rich data ({len(rich_fields)} fields: {", ".join(rich_fields)})'

    # Check for placeholder URLs
    url = lead.get('website_url', '').lower()
    fake_patterns = ('example.com','test.com','yourdomain.com','your-site.com',
                     'mysite.com','website.com','domain.com','yourcompany.com',
                     'company.com','.local','localhost','yourbrand.com',
                     'business.com','site.com','https://')
    if url:
        if any(p in url for p in fake_patterns) and not url.startswith('http'):
            return True, 'website_url is a placeholder'
        if url.startswith('http') and any(p in url for p in ('example.com','test.com','localhost')):
            return True, 'website_url is a test placeholder'

    return False, f'only {len(rich_fields)} rich fields — will scrape website'


# ─── Main Pipeline ───────────────────────────────────────────────────────────

def process_lead(lead: dict, vercel_token: str = None, skip_deploy: bool = False, 
                  scrape_enabled: bool = True, json_output: bool = False,
                  output_dir: str = None) -> dict:
    """
    Process a single lead end-to-end.
    Returns dict with all step results.
    """
    result = {
        'lead_id': lead.get('id', lead.get('email', 'unknown')),
        'company_name': lead.get('company_name', 'Unknown'),
        'steps': {},
        'final_url': None,
        'error': None,
    }

    # Load config (gmail credentials, AI keys)
    config = {
        'vercel_token': vercel_token,
        'lead': lead,
        # Env vars override config file
        'gmail_email': os.environ.get('GMAIL_EMAIL', ''),
        'gmail_app_password': os.environ.get('GMAIL_APP_PASSWORD', ''),
        'vercel_token': os.environ.get('VERCEL_API_TOKEN') or os.environ.get('VERCEL_TOKEN') or vercel_token,
    }
    config_path = '/tmp/lead-to-site/config.json'
    if os.path.exists(config_path):
        try:
            with open(config_path) as f:
                file_cfg = json.load(f)
                # File config supplements (env vars already set above take precedence)
                for key in ('gmail_email', 'gmail_app_password', 'vercel_token', 'groq_key', 'deepseek_key', 'from_name'):
                    if not config.get(key) and file_cfg.get(key):
                        config[key] = file_cfg[key]
        except:
            pass
    # Make lead available in config for send_from_pipeline
    config['lead'] = lead

    def emit(status, extra=None):
        """Emit a JSON status line for SSE streaming."""
        if json_output:
            obj = {
                'id': result['lead_id'],
                'company': result['company_name'],
                'status': status,
            }
            if extra:
                obj.update(extra)
            print(json.dumps(obj, default=str), flush=True)

    try:
        # ── Emit queued ─────────────────────────────────────────────────────
        if json_output:
            emit('queued', {'total': len(lead) if isinstance(lead, dict) else 1})
        else:
            print(f"\n  [1/4] Processing: {lead.get('company_name', 'unknown')}")

        # ── Step 1: Scrape website (CSV-first — skip if enough data already) ────
        skip_scrape, skip_reason = csv_has_enough_data(lead)
        if scrape_enabled and lead.get('website_url') and not skip_scrape:
            if json_output:
                emit('scraping', {'url': lead['website_url']})
            else:
                print(f"  [1/4] Scraping site: {lead['website_url']}")
            scraped = scrape_site(lead['website_url'])
            if scraped.get('success'):
                lead = merge_scraped_with_lead(scraped, lead)
                result['steps']['scrape'] = {'status': 'ok', 'data': {k: v for k, v in scraped.items() if k != 'main_content'}}
            else:
                result['steps']['scrape'] = {'status': 'skipped', 'reason': scraped.get('error', 'unknown')}
                print(f"  [scrape] Skipped/failed: {scraped.get('error')}")
        else:
            reason = skip_reason if skip_scrape else 'no website_url or scrape disabled'
            result['steps']['scrape'] = {'status': 'skipped', 'reason': reason}
            if not json_output:
                print(f"  [1/4] Skipping scrape: {reason}")

        # ── Step 2: Generate Website HTML ─────────────────────────────────
        if json_output:
            emit('generating')
        else:
            print(f"  [2/4] Generating personalized website HTML...")
        html = generate_website(lead)
        html_size = len(html.encode('utf-8'))
        
        # Save HTML file if output_dir is specified
        if output_dir and json_output:
            lead_id = lead.get('id', lead.get('email', f'lead_{lead.get("company_name", "unknown")}'))
            html_path = os.path.join(output_dir, f'{lead_id}.html')
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html)
            result['html_path'] = html_path
        
        result['steps']['generate_html'] = {'status': 'ok', 'size_bytes': html_size}
        if not json_output:
            print(f"  [generate] HTML generated: {html_size:,} bytes")

        # ── Step 3: Deploy to Vercel ───────────────────────────────────────
        project_name = slugify(lead.get('company_name', 'site')) + '-' + str(int(time.time()))[-6:]
        
        if skip_deploy:
            result['steps']['vercel_deploy'] = {'status': 'skipped', 'reason': 'test mode'}
            result['final_url'] = None
            if json_output:
                emit('deploying', {'status': 'skipped', 'reason': 'no vercel token'})
            else:
                print(f"  [3/4] Vercel deploy SKIPPED (test mode)")
        else:
            if json_output:
                emit('deploying')
            else:
                print(f"  [3/4] Deploying to Vercel as '{project_name}'...")
            deploy_result = deploy_to_vercel(html, project_name, vercel_token)
            
            if deploy_result.get('success'):
                result['steps']['vercel_deploy'] = {'status': 'ok', 'url': deploy_result['url']}
                result['final_url'] = deploy_result['url']
                if json_output:
                    emit('done', {'vercel_url': deploy_result['url'], 'html_size': html_size})
                else:
                    print(f"  [vercel] Deployed: {deploy_result['url']}")
            else:
                result['steps']['vercel_deploy'] = {'status': 'failed', 'error': deploy_result.get('error')}
                result['error'] = f"Vercel deploy failed: {deploy_result.get('error')}"
                result['status'] = 'error'
                if json_output:
                    emit('error', {'error': deploy_result.get('error')})
                else:
                    print(f"  [vercel] FAILED: {deploy_result.get('error')}")
                return result

        # ── Step 4: Generate Outreach Email ─────────────────────────────────
        # Always generate email — use Vercel URL if deployed, otherwise the original site URL
        website_url = result.get('final_url') or lead.get('website_url') or None
        try:
            from email_generator import generate_email, generate_email_with_ai
            groq_key = os.environ.get('GROQ_API_KEY', '')
            deepseek_key = os.environ.get('DEEPSEEK_API_KEY', '')
            if (groq_key or deepseek_key) and website_url:
                email_result = generate_email_with_ai(lead, website_url)
            else:
                email_result = generate_email(lead, website_url)
            result['steps']['email'] = {'status': 'ok', 'subject': email_result['subject'], 'method': email_result['method']}
            result['email'] = email_result
            if not json_output:
                print(f"  [4/4] Email subject: {email_result['subject']} ({email_result['method']})")
            # NOTE: don't emit done here — Gmail step comes next and needs to close SSE
        except Exception as e:
            result['steps']['email'] = {'status': 'failed', 'error': str(e)}
            if not json_output:
                print(f"  [email] FAILED: {e}")
            # Fall through to Gmail step — don't emit done yet

        # ── Step 5: Send via Gmail (placeholder — Smartlead integration coming) ──
        gmail_email = config.get('gmail_email', '')
        gmail_password = config.get('gmail_app_password', '')

        if gmail_email and gmail_password and result.get('final_url'):
            # Inject email_data into result so send_from_pipeline can use it
            result['email_data'] = result.get('email', {})

            if json_output:
                emit('sending')

            send_res = send_from_pipeline(result, config)

            if send_res.get('success'):
                result['steps']['gmail_send'] = {
                    'status': 'sent',
                    'to': send_res.get('to'),
                    'from': send_res.get('from'),
                    'subject': send_res.get('subject'),
                }
                result['send_status'] = 'sent'
                if json_output:
                    emit('sent', {
                        'vercel_url': result.get('final_url'),
                        'html_size': html_size,
                        'send_status': 'sent',
                        'email_subject': result.get('email', {}).get('subject'),
                        'email_body': result.get('email', {}).get('body'),
                    })
            else:
                result['steps']['gmail_send'] = {
                    'status': 'failed',
                    'error': send_res.get('error'),
                }
                result['send_status'] = 'failed'
                result['send_error'] = send_res.get('error')
                if json_output:
                    emit('sent', {
                        'vercel_url': result.get('final_url'),
                        'html_size': html_size,
                        'send_status': 'failed',
                        'send_error': send_res.get('error'),
                        'email_subject': result.get('email', {}).get('subject'),
                        'email_body': result.get('email', {}).get('body'),
                    })
        elif not gmail_email or not gmail_password:
            result['steps']['gmail_send'] = {
                'status': 'skipped',
                'reason': 'Gmail not configured — add in Settings',
            }
            result['send_status'] = 'pending_gmail'
            if json_output:
                emit('sent', {
                    'vercel_url': result.get('final_url'),
                    'html_size': html_size,
                    'send_status': 'pending_gmail',
                    'email_subject': result.get('email', {}).get('subject'),
                    'email_body': result.get('email', {}).get('body'),
                })

        # ── Step 6: Smartlead-ready payload ─────────────────────────────────
        result['steps']['smartlead_ready'] = {
            'status': 'ready',
            'message': 'Lead processed. Pass to Smartlead for outreach.',
            'lead_data': {
                'company_name': lead.get('company_name'),
                'email': lead.get('email'),
                'website_url': lead.get('website_url'),
                'website_preview_url': result['final_url'],
                'owner_name': lead.get('owner_name') or lead.get('name'),
            }
        }
        print(f"  [4/4] Ready for Smartlead outreach")

        result['status'] = 'success'
        print(f"\n  [DONE] {lead.get('company_name')} -> {result['final_url']}")

    except Exception as e:
        result['status'] = 'error'
        result['error'] = str(e)
        if json_output:
            emit('error', {'error': str(e)})
        else:
            print(f"  [ERROR] {e}")

    return result


def process_csv(csv_path: str, vercel_token: str = None, skip_deploy: bool = False,
                scrape_enabled: bool = True, output_json: str = None,
                json_output: bool = False, output_dir: str = None) -> list[dict]:
    """
    Process all leads from a CSV file.
    """
    print(f"\n{'='*60}")
    print(f"  Lead-to-Website Pipeline")
    print(f"  CSV: {csv_path}")
    print(f"  Deploy: {'DISABLED (test mode)' if skip_deploy else 'ENABLED'}")
    print(f"  Scrape: {'ENABLED' if scrape_enabled else 'DISABLED'}")
    print(f"{'='*60}\n")

    leads = parse_csv(csv_path)
    if not json_output:
        print(f"Loaded {len(leads)} leads from CSV\n")

    results = []
    for i, lead in enumerate(leads, 1):
        if not json_output:
            print(f"\n{'─'*60}")
            print(f"Processing lead {i}/{len(leads)}: {lead.get('company_name', 'unknown')}")
        result = process_lead(lead, vercel_token, skip_deploy, scrape_enabled, json_output, output_dir)
        results.append(result)

        # Small delay between Vercel deploys to avoid rate limiting
        if not skip_deploy and i < len(leads):
            time.sleep(2)

    # Summary
    if not json_output:
        print(f"\n\n{'='*60}")
        print(f"  PIPELINE SUMMARY")
        print(f"{'='*60}")
        success = sum(1 for r in results if r['status'] == 'success')
        failed = sum(1 for r in results if r['status'] != 'success')
        print(f"  Total: {len(results)} | Success: {success} | Failed: {failed}")

        for r in results:
            status = '✅' if r['status'] == 'success' else '❌'
            url = r['final_url'] or r.get('error', 'N/A')
            print(f"  {status} {r['company_name']}: {url}")

        # Save results
        if output_json:
            with open(output_json, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"\n  Results saved to: {output_json}")

        # Always save results.json to output_dir (for dashboard status page)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            results_json_path = os.path.join(output_dir, 'results.json')
            with open(results_json_path, 'w') as f:
                json.dump(results, f, indent=2)

    return results


# ─── Sample Lead Generator ───────────────────────────────────────────────────

SAMPLE_LEADS = [
    {
        'id': '1',
        'company_name': 'Apex Digital Marketing',
        'industry': 'Digital Marketing',
        'location': 'Austin, TX',
        'website_url': 'https://apexdigital.com',
        'owner_name': 'Marcus Johnson',
        'first_name': 'Marcus',
        'last_name': 'Johnson',
        'email': 'marcus@apexdigital.com',
        'contact_email': 'hello@apexdigital.com',
        'phone': '512-555-0123',
        'services': 'SEO Optimization, PPC Campaigns, Social Media Management, Content Marketing',
        'brand_color': '#4F46E5',
        'secondary_color': '#10B981',
        'tagline': 'Scale Your Business Through Data-Driven Marketing',
    },
    {
        'id': '2',
        'company_name': 'Velocity Fitness Coaching',
        'industry': 'Fitness Coaching',
        'location': 'Denver, CO',
        'website_url': 'https://velocityfit.co',
        'owner_name': 'Sarah Chen',
        'first_name': 'Sarah',
        'last_name': 'Chen',
        'email': 'sarah@velocityfit.co',
        'contact_email': 'info@velocityfit.co',
        'phone': '720-555-0456',
        'services': 'Online Personal Training, Nutrition Planning, Group Classes, Transformation Programs',
        'brand_color': '#DC2626',
        'secondary_color': '#F59E0B',
        'tagline': 'Your Best Self Starts Here',
    },
    {
        'id': '3',
        'company_name': 'CloudScale SaaS Agency',
        'industry': 'SaaS Development',
        'location': 'San Francisco, CA',
        'website_url': 'https://cloudscale.io',
        'owner_name': 'Alex Rivera',
        'first_name': 'Alex',
        'last_name': 'Rivera',
        'email': 'alex@cloudscale.io',
        'contact_email': 'founders@cloudscale.io',
        'phone': '415-555-0789',
        'services': 'MVP Development, Cloud Architecture, SaaS Scaling, Product Consulting',
        'brand_color': '#0891B2',
        'secondary_color': '#8B5CF6',
        'tagline': 'Build, Launch, Scale — Without the Complexity',
    },
]


def run_sample_test(vercel_token: str = None, skip_deploy: bool = True):
    """Run pipeline with sample leads (no CSV needed)."""
    print(f"\n{'='*60}")
    print(f"  SAMPLE LEAD TEST")
    print(f"  Mode: {'TEST (no deploy)' if skip_deploy else 'LIVE'}")
    print(f"{'='*60}\n")

    results = []
    for i, lead in enumerate(SAMPLE_LEADS, 1):
        print(f"\n{'─'*60}")
        print(f"[Sample {i}/3] {lead['company_name']} | {lead['industry']}")
        print(f"  Brand color: {lead['brand_color']} | {lead['secondary_color']}")
        print(f"  Website: {lead['website_url']}")

        # Generate HTML only
        html = generate_website(lead)
        html_file = f"/config/lead-to-site/sample_output/{slugify(lead['company_name'])}-site.html"
        os.makedirs(os.path.dirname(html_file), exist_ok=True)
        with open(html_file, 'w') as f:
            f.write(html)

        result = {
            'lead_id': lead['id'],
            'company_name': lead['company_name'],
            'status': 'success',
            'html_file': html_file,
            'html_size': len(html.encode('utf-8')),
            'website_preview_url': None,
            'steps': {
                'scrape': {'status': 'skipped', 'reason': 'sample test'},
                'generate_html': {'status': 'ok', 'size_bytes': len(html.encode('utf-8'))},
            }
        }

        if not skip_deploy and vercel_token:
            print(f"  Deploying to Vercel...")
            deploy_res = deploy_to_vercel(html, slugify(lead['company_name']) + '-test', vercel_token)
            if deploy_res.get('success'):
                result['website_preview_url'] = deploy_res['url']
                result['steps']['vercel_deploy'] = {'status': 'ok', 'url': deploy_res['url']}
            else:
                result['steps']['vercel_deploy'] = {'status': 'failed', 'error': deploy_res.get('error')}

        results.append(result)

        status_icon = '✅' if result.get('html_file') else '❌'
        url = result.get('website_preview_url') or result.get('html_file', 'N/A')
        print(f"  {status_icon} Output: {url}")

    print(f"\n\n{'='*60}")
    print(f"  SAMPLE TEST COMPLETE")
    print(f"{'='*60}")
    for r in results:
        icon = '✅' if r.get('html_file') else '❌'
        print(f"  {icon} {r['company_name']}: {r.get('html_file', r.get('website_preview_url', 'N/A'))}")

    return results


# ─── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Lead-to-Website Pipeline')
    parser.add_argument('--csv', type=str, help='Path to CSV file with leads')
    parser.add_argument('--test', action='store_true', help='Run with sample leads (no CSV, no deploy)')
    parser.add_argument('--verify-template', action='store_true', help='Verify template renders correctly')
    parser.add_argument('--live', action='store_true', help='Actually deploy to Vercel (requires token)')
    parser.add_argument('--scrape-disabled', action='store_true', help='Skip scraping step')
    parser.add_argument('--output', type=str, help='Save results to JSON file')
    parser.add_argument('--token', type=str, help='Vercel API token (or set VERCEL_API_TOKEN env var)')
    parser.add_argument('--json-output', action='store_true', help='Output JSON lines for SSE streaming')
    parser.add_argument('--output-dir', type=str, help='Output directory for generated HTML files')

    args = parser.parse_args()

    cli_token_sources = [
        args.token,
        os.environ.get('VERCEL_API_TOKEN'),
        os.environ.get('VERCEL_TOKEN'),
    ]
    # Also check config file
    cli_config_path = '/tmp/lead-to-site/config.json'
    if os.path.exists(cli_config_path):
        try:
            with open(cli_config_path) as f:
                cfg = json.load(f)
                if cfg.get('vercel_token'):
                    cli_token_sources.append(cfg['vercel_token'])
                if not os.environ.get('GROQ_API_KEY') and cfg.get('groq_key'):
                    os.environ['GROQ_API_KEY'] = cfg['groq_key']
                if not os.environ.get('DEEPSEEK_API_KEY') and cfg.get('deepseek_key'):
                    os.environ['DEEPSEEK_API_KEY'] = cfg['deepseek_key']
        except:
            pass

    vercel_token = next((t for t in cli_token_sources if t), None)

    if args.verify_template:
        print("Verifying website template with sample data...")
        lead = SAMPLE_LEADS[0]
        html = generate_website(lead)
        out_path = '/config/lead-to-site/template-verification.html'
        with open(out_path, 'w') as f:
            f.write(html)
        print(f"Template verified. Output: {out_path}")
        print(f"Size: {len(html):,} chars / {len(html.encode('utf-8')):,} bytes")
        sys.exit(0)

    if args.test:
        results = run_sample_test(vercel_token=vercel_token, skip_deploy=True)
    elif args.csv:
        results = process_csv(
            csv_path=args.csv,
            vercel_token=vercel_token,
            skip_deploy=not args.live,
            scrape_enabled=not args.scrape_disabled,
            output_json=args.output,
            json_output=args.json_output,
            output_dir=args.output_dir,
        )
    else:
        print("Usage:")
        print("  python3 pipeline.py --test                          # Run with sample data")
        print("  python3 pipeline.py --verify-template               # Test template only")
        print("  python3 pipeline.py --csv leads.csv                 # Process CSV (no deploy)")
        print("  python3 pipeline.py --csv leads.csv --live         # Process CSV + deploy to Vercel")
        print("  python3 pipeline.py --csv leads.csv --live --token YOUR_TOKEN")
        sys.exit(1)
