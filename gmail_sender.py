#!/usr/bin/env python3
"""Gmail SMTP email sender — sends personalized outreach emails via Gmail.

Requires:
  - Gmail address (your-email@gmail.com)
  - Gmail App Password (16-char, from myaccount.google.com/apppasswords)
  
  Setup:
    1. Go to myaccount.google.com/apppasswords
    2. Create a new App Password for "Lead-to-Site"
    3. Enter that 16-char password in the dashboard settings
"""

import json
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import Header


def send_gmail(
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
    from_email: str,
    app_password: str,
    body_html: str = None,
) -> dict:
    """Send a single email via Gmail SMTP. Returns dict with status."""
    
    if not app_password:
        return {'success': False, 'error': 'Gmail App Password not configured'}
    
    if not from_email or not app_password:
        return {'success': False, 'error': 'Gmail credentials missing'}
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = Header(subject, 'utf-8')
        msg['From'] = f"{from_email}"
        msg['To'] = to_email
        msg['Reply-To'] = from_email
        
        # Plain text
        part1 = MIMEText(body.encode('utf-8') if isinstance(body, str) else body, 'plain', 'utf-8')
        msg.attach(part1)
        
        # HTML (optional)
        if body_html:
            part2 = MIMEText(body_html.encode('utf-8') if isinstance(body_html, str) else body_html, 'html', 'utf-8')
            msg.attach(part2)
        
        with smtplib.SMTP('smtp.gmail.com', 587, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(from_email, app_password)
            server.sendmail(from_email, [to_email], msg.as_string())
        
        return {
            'success': True,
            'to': to_email,
            'from': from_email,
            'subject': subject,
        }
    
    except smtplib.SMTPAuthenticationError:
        return {'success': False, 'error': 'Gmail auth failed — check email/App Password'}
    except smtplib.SMTPException as e:
        return {'success': False, 'error': f'SMTP error: {e}'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def send_from_pipeline(result: dict, config: dict) -> dict:
    """Send email for a single pipeline result. Call this after deploy step."""
    
    gmail_email = config.get('gmail_email', '')
    gmail_app_password = config.get('gmail_app_password', '')
    from_name = config.get('from_name', 'Obong')
    
    if not gmail_email or not gmail_app_password:
        return {'success': False, 'error': 'Gmail not configured'}
    
    # Build from address
    from_address = gmail_email
    
    # Get data from result
    to_email = result.get('email', '')
    if not to_email:
        to_email = result.get('lead', {}).get('email', '')
    
    if not to_email:
        return {'success': False, 'error': 'No recipient email'}
    
    # Get lead info
    lead = result.get('lead', {})
    to_name = lead.get('owner_name', '') or f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip()
    
    # Get email content — use generated email or build from template
    email_data = result.get('email_data', {})
    
    if email_data:
        subject = email_data.get('subject', 'Quick question')
        body = email_data.get('body', '')
        body_html = email_data.get('body_html', '')
    else:
        # Fallback: generate inline
        from email_generator import generate_email
        company = lead.get('company_name', 'your company')
        first_name = (lead.get('first_name') or lead.get('owner_name') or 'there').split()[0]
        industry = lead.get('industry', '')
        services = lead.get('services', '')
        final_url = result.get('final_url', '')
        
        if isinstance(services, str):
            services_list = [s.strip() for s in services.split(',') if s.strip()]
        else:
            services_list = services if services else []
        
        if final_url:
            hook = (
                f"I built a personalized site for {company} here: {final_url}\n\n"
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
{from_name}"""
        
        subject = f"Quick {industry} question" if industry else f"Saw {company}'s approach"
        body_html = f"<p>{body.replace(chr(10)+chr(10), '</p><p>').replace(chr(10), '<br>')}</p>"
    
    return send_gmail(
        to_email=to_email,
        to_name=to_name,
        subject=subject,
        body=body,
        body_html=body_html,
        from_email=from_address,
        app_password=gmail_app_password,
    )


if __name__ == '__main__':
    # CLI test: python gmail_sender.py --test
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        result = send_gmail(
            to_email='theakpanobong@gmail.com',
            to_name='Obong',
            subject='Test from Lead-to-Site Pipeline',
            body='This is a test email from the Lead-to-Site pipeline.\n\nIf you received this, Gmail sending works!',
            from_email='theakpanobong@gmail.com',
            app_password='',
        )
        print(json.dumps(result, indent=2))
    else:
        print("Usage: python gmail_sender.py --test")
        print("Run with valid config to send real emails.")
