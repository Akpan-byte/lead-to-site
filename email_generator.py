#!/usr/bin/env python3
"""Cold Outreach Email Generator - Groq (llama) + DeepSeek + template fallback."""

import json
from datetime import datetime


def generate_email(lead: dict, website_url: str = None) -> dict:
    """Template-based email generation (no API key needed)."""
    first_name = (lead.get('first_name') or lead.get('owner_name') or lead.get('name') or 'there').split()[0]
    company = lead.get('company_name', 'your business')
    industry = lead.get('industry', '')
    services = lead.get('services', '')

    if isinstance(services, str):
        services_list = [s.strip() for s in services.split(',') if s.strip()]
    else:
        services_list = services if services else []

    subjects = [
        f"Quick {industry} question" if industry else f"Quick question about {company}",
        f"{company} + a growth idea",
        f"Saw your work with {services_list[0]}" if services_list else f"Saw {company}'s approach",
        "One thing I'd do differently",
    ]

    if website_url:
        hook = (
            f"I built a personalized site for {company} here: {website_url}\n\n"
            f"It shows what I'd build for you too — takes about 3 min to see the idea."
        )
    else:
        hook = (
            f"I came across {company} and loved what you're doing in {industry or 'your space'}.\n\n"
            f"Have you considered adding personalized landing pages to your outreach?"
        )

    service_touch = ""
    if services_list:
        service_touch = (
            f"Also noticed you handle {services_list[0]} — personalized pages "
            f"tend to crush generic cold emails in that space."
        )

    body = f"""Hi {first_name},

{hook}

{service_touch}

I help agencies build personalized landing pages for every prospect — so cold outreach actually gets clicked.

Worth 15 minutes to show you how it works?

Best,
Obong"""

    body_html = f"<p>{body.replace(chr(10) + chr(10), '</p><p>').replace(chr(10), '<br>')}</p>"

    return {
        'subject': subjects[0],
        'subjects': subjects,
        'body': body,
        'body_html': body_html,
        'preview_text': "Worth 15 minutes to show you how it works?",
        'to_email': lead.get('email', ''),
        'to_name': f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip() or lead.get('owner_name', ''),
        'from_name': 'Obong',
        'website_url': website_url,
        'generated_at': datetime.now().isoformat(),
        'method': 'template',
    }


def _call_llm(prompt: str, api_key: str, provider: str = 'groq') -> str:
    """Call Groq (llama) or DeepSeek for email generation."""
    import urllib.request
    import urllib.error

    if provider == 'groq':
        url = 'https://api.groq.com/openai/v1/chat/completions'
        model = 'llama-3.3-70b-versatile'
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 400,
            "temperature": 0.8,
        }
    elif provider == 'deepseek':
        url = 'https://api.deepseek.com/chat/completions'
        model = 'deepseek-chat'
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 400,
            "temperature": 0.8,
        }
    else:
        raise ValueError(f"Unknown provider: {provider}")

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method='POST',
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        return result['choices'][0]['message']['content'].strip()


def generate_email_with_ai(lead: dict, website_url: str = None) -> dict:
    """Generate email using Groq (llama) first, then DeepSeek, then template."""
    import os

    first_name = (lead.get('first_name') or lead.get('owner_name') or 'there').split()[0]
    company = lead.get('company_name', 'your business')
    industry = lead.get('industry', '')
    services = lead.get('services', '')
    tagline = lead.get('tagline', '')

    if isinstance(services, str):
        services_list = [s.strip() for s in services.split(',') if s.strip()]
    else:
        services_list = services if services else []

    prompt = f"""Write a personalized cold outreach email.

Company: {company}
Industry: {industry}
Services: {services}
Tagline: {tagline}
Personalized demo site: {website_url}

Rules:
- First line is the subject line (no "Subject:" prefix)
- 80-120 words max
- Tone: confident, direct, no fluff
- Must mention the personalized demo site URL: {website_url}
- Mention something specific about their business or industry
- End with a clear, low-commitment CTA (15 min call or reply)
- Plain text only, no emojis, sign from "Obong"
- Structure: subject line, then a blank line, then the email body
"""

    # Try Groq first
    groq_key = os.environ.get('GROQ_API_KEY', '')
    if groq_key:
        try:
            text = _call_llm(prompt, groq_key, 'groq')
            lines = text.split('\n')
            subject = lines[0].strip()
            body = '\n'.join(lines[1:]).strip() if len(lines) > 1 else text
            body_html = f"<p>{body.replace(chr(10) + chr(10), '</p><p>').replace(chr(10), '<br>')}</p>"
            return {
                'subject': subject,
                'subjects': [subject, f"Quick {industry} question" if industry else f"Re: {company}"],
                'body': body,
                'body_html': body_html,
                'preview_text': body[:100],
                'to_email': lead.get('email', ''),
                'to_name': f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip() or lead.get('owner_name', ''),
                'from_name': 'Obong',
                'website_url': website_url,
                'generated_at': datetime.now().isoformat(),
                'method': 'groq-llama',
            }
        except Exception as e:
            print(f"[email] Groq failed ({e}), trying DeepSeek...", flush=True)

    # Try DeepSeek second
    deepseek_key = os.environ.get('DEEPSEEK_API_KEY', '')
    if deepseek_key:
        try:
            text = _call_llm(prompt, deepseek_key, 'deepseek')
            lines = text.split('\n')
            subject = lines[0].strip()
            body = '\n'.join(lines[1:]).strip() if len(lines) > 1 else text
            body_html = f"<p>{body.replace(chr(10) + chr(10), '</p><p>').replace(chr(10), '<br>')}</p>"
            return {
                'subject': subject,
                'subjects': [subject, f"Quick {industry} question" if industry else f"Re: {company}"],
                'body': body,
                'body_html': body_html,
                'preview_text': body[:100],
                'to_email': lead.get('email', ''),
                'to_name': f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip() or lead.get('owner_name', ''),
                'from_name': 'Obong',
                'website_url': website_url,
                'generated_at': datetime.now().isoformat(),
                'method': 'deepseek',
            }
        except Exception as e:
            print(f"[email] DeepSeek failed ({e}), using template...", flush=True)

    # Fall back to template
    return generate_email(lead, website_url)
