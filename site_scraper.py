"""
Site scraper using Crawl4AI (primary) or Scrapling (fallback).
Extracts business info from a website URL.
"""

import re


def scrape_site_with_crawl4ai(url: str, timeout: int = 30) -> dict:
    """
    Scrape site using Crawl4AI. Returns dict with:
      title, description, meta_description, main_content, emails, phone_numbers
    """
    try:
        from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
    except ImportError:
        return {'success': False, 'error': 'crawl4ai not installed'}

    result_data = {}

    async def _scrape():
        config = CrawlerRunConfig(
            verbose=False,
            remove_forms=True,
            page_timeout=timeout * 1000,
        )
        async with AsyncWebCrawler(verbose=False) as crawler:
            result = await crawler.arun(url=url, config=config)
            return result

    import asyncio
    try:
        result = asyncio.run(_scrape())
    except Exception as e:
        return {'success': False, 'error': f'Crawl4AI error: {e}'}

    # Parse result - Crawl4AI v0.8.x returns a list or single result
    try:
        if isinstance(result, list):
            result = result[0]
        if hasattr(result, 'markdown'):
            content = result.markdown
        elif hasattr(result, 'content'):
            content = result.content
        else:
            content = str(result)
        
        metadata = getattr(result, 'metadata', {}) or {}
        success = getattr(result, 'success', True) if hasattr(result, 'success') else True
    except Exception as e:
        return {'success': False, 'error': f'Crawl4AI parse error: {e}'}

    if not content and not metadata:
        return {'success': False, 'error': 'Empty response from Crawl4AI'}

    result_data['success'] = success
    result_data['title'] = metadata.get('title', '') or (content.split('\n')[0][:100] if content else '')
    result_data['description'] = metadata.get('description', '') or metadata.get('meta_description', '')
    result_data['meta_description'] = metadata.get('meta_description', '') or metadata.get('description', '')
    result_data['og_image'] = metadata.get('og_image', '')
    result_data['main_content'] = content[:3000] if content else ''

    # Find emails
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', content or '')
    result_data['emails'] = list(set([e for e in emails if 'example' not in e.lower() and 'noreply' not in e.lower()]))[:5]

    # Find phone numbers
    phones = re.findall(r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]{7,}', content or '')
    result_data['phone_numbers'] = list(set([p.strip() for p in phones if len(p.strip()) >= 7]))[:5]

    result_data['raw_metadata'] = metadata

    return result_data


def scrape_site_with_scrapling(url: str, timeout: int = 15) -> dict:
    """
    Fallback scraper using Scrapling's StealthyFetcher.
    Extracts: title, meta description, H1, emails, phone numbers.
    """
    try:
        from scrapling import StealthyFetcher
    except ImportError:
        return {'success': False, 'error': 'scrapling not installed'}

    result_data = {}

    try:
        response = StealthyFetcher.fetch(
            url,
            headless=True,
            timeout=timeout,
        )
    except Exception as e:
        return {'success': False, 'error': f'StealthyFetcher error: {e}'}

    try:
        result_data['success'] = True
        result_data['title'] = response.title or ''

        # Meta description
        try:
            result_data['meta_description'] = response.meta('description') or ''
        except:
            result_data['meta_description'] = ''

        # Get text content
        content = response.content_tree
        if content is not None:
            try:
                text_content = content.text_content()
            except Exception:
                text_content = str(content)
        else:
            text_content = ''

        result_data['main_content'] = text_content[:3000] if text_content else ''

        # Emails
        raw_html = response.html if hasattr(response, 'html') else str(response)
        emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', raw_html)
        result_data['emails'] = list(set([e for e in emails if 'example' not in e.lower()]))[:5]

        # Phone numbers
        phones = re.findall(r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]{7,}', raw_html)
        result_data['phone_numbers'] = list(set([p.strip() for p in phones if len(p.strip()) >= 7]))[:5]

    except Exception as e:
        result_data = {'success': False, 'error': f'Parse error: {e}'}

    return result_data


def scrape_site_with_requests(url: str, timeout: int = 10) -> dict:
    """
    Lightweight fallback: use requests to get title + meta description only.
    Works for static sites, no JS rendering.
    """
    import requests

    result_data = {}

    try:
        resp = requests.get(
            url,
            timeout=timeout,
            headers={
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            allow_redirects=True,
        )
        resp.raise_for_status()
    except Exception as e:
        return {'success': False, 'error': f'requests error: {e}'}

    html = resp.text
    result_data['success'] = True
    result_data['title'] = ''
    result_data['meta_description'] = ''
    result_data['main_content'] = ''

    # Extract title
    title_match = re.search(r'<title[^>]*>([^<]+)</title>', html, re.IGNORECASE)
    if title_match:
        result_data['title'] = title_match.group(1).strip()

    # Extract meta description
    desc_match = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if not desc_match:
        desc_match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']', html, re.IGNORECASE)
    if desc_match:
        result_data['meta_description'] = desc_match.group(1).strip()

    # Emails
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', html)
    result_data['emails'] = list(set([e for e in emails if 'example' not in e.lower() and 'noreply' not in e.lower()]))[:5]

    # Phone numbers
    phones = re.findall(r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]{7,}', html)
    result_data['phone_numbers'] = list(set([p.strip() for p in phones if len(p.strip()) >= 7]))[:5]

    result_data['status_code'] = resp.status_code

    return result_data


def scrape_site_with_brave(url: str, timeout: int = 30) -> dict:
    """
    Use system Brave browser via playwright's chromium with executable_path.
    No separate playwright install needed — uses /usr/bin/brave-browser.
    """
    result_data = {}
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {'success': False, 'error': 'playwright not installed'}

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                executable_path='/usr/bin/chromium-browser',
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
            )
            page = browser.new_page()
            page.goto(url, timeout=timeout * 1000, wait_until='domcontentloaded')
            
            result_data['success'] = True
            result_data['title'] = page.title() or ''
            
            # Meta description
            try:
                result_data['meta_description'] = page.locator('meta[name="description"]').get_attribute('content') or ''
            except:
                result_data['meta_description'] = ''
            
            # Get visible text
            try:
                body = page.locator('body')
                text = body.inner_text()
                result_data['main_content'] = text[:3000] if text else ''
            except:
                result_data['main_content'] = ''
            
            # Emails from page content
            html = page.content()
            emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', html)
            result_data['emails'] = list(set([e for e in emails if 'example' not in e.lower() and 'noreply' not in e.lower()]))[:5]
            
            # Phone numbers
            phones = re.findall(r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]{7,}', html)
            result_data['phone_numbers'] = list(set([p.strip() for p in phones if len(p.strip()) >= 7]))[:5]
            
            browser.close()
    except Exception as e:
        return {'success': False, 'error': f'Brave/Playwright error: {e}'}
    
    return result_data


def scrape_site(url: str, timeout: int = 30) -> dict:
    """
    Primary: Brave browser (system install). Fallback: Crawl4AI → Scrapling → requests.
    Returns scraped business data.
    """
    if not url or not url.startswith(('http://', 'https://')):
        return {'success': False, 'error': 'Invalid URL'}

    # Normalize URL
    if not url.startswith('https://'):
        url = url.replace('http://', 'https://')

    # Try Brave (system browser, no install needed)
    print(f"  [scrape] Trying Brave: {url}")
    result = scrape_site_with_brave(url, timeout=timeout)
    if result.get('success'):
        print(f"  [scrape] SUCCESS (Brave): title='{result.get('title', '')[:60]}'")
        return result
    print(f"  [scrape] Brave failed: {result.get('error', 'unknown')}")

    # Try Crawl4AI (best for JS-heavy sites)
    print(f"  [scrape] Trying Crawl4AI: {url}")
    result = scrape_site_with_crawl4ai(url, timeout=timeout)
    if result.get('success'):
        print(f"  [scrape] SUCCESS: title='{result.get('title', '')[:60]}'")
        return result
    print(f"  [scrape] Crawl4AI failed: {result.get('error', 'unknown')}")

    # Try Scrapling fallback (stealth browser automation)
    print(f"  [scrape] Trying Scrapling: {url}")
    result = scrape_site_with_scrapling(url, timeout=timeout)
    if result.get('success'):
        print(f"  [scrape] SUCCESS: title='{result.get('title', '')[:60]}'")
        return result
    print(f"  [scrape] Scrapling failed: {result.get('error', 'unknown')}")

    # Try requests fallback (lightweight, no JS)
    print(f"  [scrape] Trying requests fallback: {url}")
    result = scrape_site_with_requests(url, timeout=timeout)
    if result.get('success'):
        print(f"  [scrape] SUCCESS (requests): title='{result.get('title', '')[:60]}'")
        return result
    print(f"  [scrape] requests failed: {result.get('error', 'unknown')}")

    return result


def merge_scraped_with_lead(scraped: dict, lead: dict) -> dict:
    """
    Merge scraped site data into lead data.
    Prefer explicit lead fields over scraped fields.
    """
    merged = dict(lead)

    if not scraped.get('success'):
        return merged

    # Infer company name from title if not set
    if not merged.get('company_name'):
        title = scraped.get('title', '')
        if title:
            merged['company_name'] = title.split('|')[0].split('-')[0].strip()

    # Fill description from scrape if not set
    if not merged.get('description') and scraped.get('meta_description'):
        merged['description'] = scraped.get('meta_description')

    # Add all scraped data as enrichment fields (prefixed with _)
    merged['_scraped_title'] = scraped.get('title', '')
    merged['_scraped_description'] = scraped.get('meta_description', '')
    merged['_scraped_content_preview'] = scraped.get('main_content', '')[:500]
    merged['_scraped_emails'] = scraped.get('emails', [])
    merged['_scraped_phones'] = scraped.get('phone_numbers', [])

    return merged
