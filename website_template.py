"""
Professional Website Template Generator
Takes business data and generates a branded, personalized website.
The template is saved as the "master template" — text/content gets personalized per business.
"""

BRAND_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{company_name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {{
      --primary: {primary_color};
      --primary-dark: {primary_dark};
      --primary-light: {primary_light};
      --secondary: {secondary_color};
      --text-dark: #1a1a2e;
      --text-body: #4a5568;
      --bg-light: #f8fafc;
      --bg-white: #ffffff;
      --accent: {accent_color};
    }}

    * {{
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }}

    html {{
      scroll-behavior: smooth;
    }}

    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text-dark);
      line-height: 1.6;
      overflow-x: hidden;
    }}

    /* ── NAVBAR ── */
    .navbar {{
      position: fixed;
      top: 0;
      width: 100%;
      z-index: 1000;
      padding: 16px 0;
      transition: all 0.3s ease;
    }}

    .navbar.scrolled {{
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 20px rgba(0,0,0,0.08);
    }}

    .navbar .container {{
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}

    .nav-logo {{
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--primary);
      text-decoration: none;
      letter-spacing: -0.5px;
    }}

    .nav-links {{
      display: flex;
      gap: 32px;
      list-style: none;
    }}

    .nav-links a {{
      text-decoration: none;
      color: var(--text-dark);
      font-weight: 500;
      font-size: 0.9rem;
      transition: color 0.2s;
    }}

    .nav-links a:hover {{
      color: var(--primary);
    }}

    /* ── CONTAINER ── */
    .container {{
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
    }}

    /* ── HERO ── */
    .hero {{
      min-height: 100vh;
      display: flex;
      align-items: center;
      position: relative;
      overflow: hidden;
      padding: 120px 0 80px;
    }}

    .hero::before {{
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      z-index: 0;
    }}

    .hero::after {{
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
      z-index: 1;
    }}

    .hero-content {{
      position: relative;
      z-index: 2;
      max-width: 700px;
    }}

    .hero-badge {{
      display: inline-block;
      background: rgba(255,255,255,0.15);
      color: white;
      padding: 6px 16px;
      border-radius: 50px;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 24px;
      backdrop-filter: blur(4px);
    }}

    .hero h1 {{
      font-size: clamp(2.5rem, 5vw, 4rem);
      font-weight: 800;
      color: white;
      line-height: 1.1;
      margin-bottom: 24px;
      letter-spacing: -1px;
    }}

    .hero p {{
      font-size: 1.2rem;
      color: rgba(255,255,255,0.85);
      margin-bottom: 40px;
      line-height: 1.7;
      max-width: 560px;
    }}

    .hero-buttons {{
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }}

    .btn-primary {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: white;
      color: var(--primary);
      padding: 14px 32px;
      border-radius: 50px;
      font-weight: 700;
      font-size: 1rem;
      text-decoration: none;
      transition: all 0.3s ease;
      border: none;
      cursor: pointer;
    }}

    .btn-primary:hover {{
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }}

    .btn-secondary {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: transparent;
      color: white;
      padding: 14px 32px;
      border-radius: 50px;
      font-weight: 600;
      font-size: 1rem;
      text-decoration: none;
      border: 2px solid rgba(255,255,255,0.4);
      transition: all 0.3s ease;
    }}

    .btn-secondary:hover {{
      background: rgba(255,255,255,0.1);
      border-color: white;
    }}

    /* ── STATS ── */
    .stats {{
      background: white;
      padding: 0;
      margin-top: -60px;
      position: relative;
      z-index: 3;
    }}

    .stats-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.08);
      overflow: hidden;
    }}

    .stat-item {{
      padding: 40px 30px;
      text-align: center;
      border-right: 1px solid #f0f0f0;
    }}

    .stat-item:last-child {{
      border-right: none;
    }}

    .stat-number {{
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--primary);
      line-height: 1;
      margin-bottom: 8px;
    }}

    .stat-label {{
      font-size: 0.85rem;
      color: var(--text-body);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}

    /* ── ABOUT ── */
    .about {{
      padding: 100px 0;
      background: var(--bg-white);
    }}

    .section-header {{
      text-align: center;
      max-width: 600px;
      margin: 0 auto 60px;
    }}

    .section-tag {{
      display: inline-block;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 700;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 12px;
    }}

    .section-header h2 {{
      font-size: clamp(2rem, 3.5vw, 2.8rem);
      font-weight: 800;
      color: var(--text-dark);
      line-height: 1.2;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
    }}

    .section-header p {{
      color: var(--text-body);
      font-size: 1.05rem;
    }}

    /* ── SERVICES ── */
    .services {{
      padding: 100px 0;
      background: var(--bg-light);
    }}

    .services-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 30px;
    }}

    .service-card {{
      background: white;
      border-radius: 20px;
      padding: 40px;
      transition: all 0.3s ease;
      border: 1px solid #f0f0f0;
      position: relative;
      overflow: hidden;
    }}

    .service-card::before {{
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      transform: scaleX(0);
      transition: transform 0.3s ease;
    }}

    .service-card:hover {{
      transform: translateY(-4px);
      box-shadow: 0 20px 60px rgba(0,0,0,0.08);
      border-color: transparent;
    }}

    .service-card:hover::before {{
      transform: scaleX(1);
    }}

    .service-icon {{
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
      font-size: 1.5rem;
    }}

    .service-card h3 {{
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-dark);
      margin-bottom: 12px;
    }}

    .service-card p {{
      color: var(--text-body);
      font-size: 0.95rem;
      line-height: 1.7;
    }}

    /* ── TESTIMONIALS ── */
    .testimonials {{
      padding: 100px 0;
      background: white;
    }}

    .testimonials-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 30px;
    }}

    .testimonial-card {{
      background: var(--bg-light);
      border-radius: 20px;
      padding: 36px;
      border-left: 4px solid var(--primary);
    }}

    .testimonial-text {{
      font-size: 1rem;
      color: var(--text-body);
      line-height: 1.8;
      margin-bottom: 24px;
      font-style: italic;
    }}

    .testimonial-author {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .testimonial-avatar {{
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 1rem;
    }}

    .testimonial-name {{
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-dark);
    }}

    .testimonial-role {{
      font-size: 0.8rem;
      color: var(--text-body);
    }}

    /* ── CTA ── */
    .cta {{
      padding: 100px 0;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      text-align: center;
      position: relative;
      overflow: hidden;
    }}

    .cta::before {{
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z' fill='%23ffffff' fill-opacity='0.03' fill-rule='evenodd'/%3E%3C/svg%3E");
    }}

    .cta-content {{
      position: relative;
      z-index: 1;
    }}

    .cta h2 {{
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 800;
      color: white;
      margin-bottom: 16px;
    }}

    .cta p {{
      color: rgba(255,255,255,0.8);
      font-size: 1.1rem;
      margin-bottom: 40px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }}

    /* ── FOOTER ── */
    .footer {{
      background: #0f0f1a;
      color: rgba(255,255,255,0.6);
      padding: 60px 0 30px;
    }}

    .footer-grid {{
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 60px;
      margin-bottom: 40px;
    }}

    .footer-brand h3 {{
      color: white;
      font-size: 1.3rem;
      font-weight: 800;
      margin-bottom: 12px;
    }}

    .footer-brand p {{
      font-size: 0.9rem;
      line-height: 1.7;
    }}

    .footer-col h4 {{
      color: white;
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }}

    .footer-col ul {{
      list-style: none;
    }}

    .footer-col ul li {{
      margin-bottom: 10px;
    }}

    .footer-col ul a {{
      color: rgba(255,255,255,0.6);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.2s;
    }}

    .footer-col ul a:hover {{
      color: white;
    }}

    .footer-bottom {{
      border-top: 1px solid rgba(255,255,255,0.08);
      padding-top: 30px;
      text-align: center;
      font-size: 0.85rem;
    }}

    /* ── MOBILE ── */
    @media (max-width: 768px) {{
      .nav-links {{ display: none; }}
      .hero {{ padding: 100px 0 60px; }}
      .hero h1 {{ font-size: 2.2rem; }}
      .stats-grid {{ grid-template-columns: 1fr 1fr; }}
      .stat-item {{ border-right: none; border-bottom: 1px solid #f0f0f0; }}
      .footer-grid {{ grid-template-columns: 1fr; gap: 30px; }}
    }}

    /* ── SCROLL ANIMATIONS ── */
    .fade-up {{
      opacity: 0;
      transform: translateY(30px);
      transition: all 0.6s ease;
    }}

    .fade-up.visible {{
      opacity: 1;
      transform: translateY(0);
    }}
  </style>
</head>
<body>
  <!-- NAV -->
  <nav class="navbar" id="navbar">
    <div class="container">
      <a href="#" class="nav-logo">{company_name}</a>
      <ul class="nav-links">
        <li><a href="#about">About</a></li>
        <li><a href="#services">Services</a></li>
        <li><a href="#testimonials">Testimonials</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </div>
  </nav>

  <!-- HERO -->
  <section class="hero">
    <div class="container">
      <div class="hero-content">
        <div class="hero-badge">{industry}</div>
        <h1>{hero_headline}</h1>
        <p>{hero_subtext}</p>
        <div class="hero-buttons">
          <a href="#contact" class="btn-primary">
            {cta_primary}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <a href="#services" class="btn-secondary">{cta_secondary}</a>
        </div>
      </div>
    </div>
  </section>

  <!-- STATS -->
  <div class="stats">
    <div class="container">
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-number">{stat_1_value}</div>
          <div class="stat-label">{stat_1_label}</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">{stat_2_value}</div>
          <div class="stat-label">{stat_2_label}</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">{stat_3_value}</div>
          <div class="stat-label">{stat_3_label}</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">{stat_4_value}</div>
          <div class="stat-label">{stat_4_label}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ABOUT -->
  <section class="about" id="about">
    <div class="container">
      <div class="section-header fade-up">
        <div class="section-tag">About Us</div>
        <h2>{about_title}</h2>
        <p>{about_subtitle}</p>
      </div>
      <div style="max-width: 800px; margin: 0 auto;">
        <p style="font-size: 1.1rem; color: var(--text-body); line-height: 1.9; text-align: center;">{about_text}</p>
      </div>
    </div>
  </section>

  <!-- SERVICES -->
  <section class="services" id="services">
    <div class="container">
      <div class="section-header fade-up">
        <div class="section-tag">What We Do</div>
        <h2>{services_title}</h2>
        <p>{services_subtitle}</p>
      </div>
      <div class="services-grid">
        {service_cards}
      </div>
    </div>
  </section>

  <!-- TESTIMONIALS -->
  <section class="testimonials" id="testimonials">
    <div class="container">
      <div class="section-header fade-up">
        <div class="section-tag">Client Stories</div>
        <h2>What Our Clients Say</h2>
        <p>Real results from real businesses we've helped grow.</p>
      </div>
      <div class="testimonials-grid">
        {testimonial_cards}
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="cta" id="contact">
    <div class="container">
      <div class="cta-content">
        <h2>{cta_final_headline}</h2>
        <p>{cta_final_subtext}</p>
        <a href="mailto:{contact_email}" class="btn-primary" style="background: white;">
          {cta_final_button}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <h3>{company_name}</h3>
          <p>{location}</p>
        </div>
        <div class="footer-col">
          <h4>Quick Links</h4>
          <ul>
            <li><a href="#about">About</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#testimonials">Testimonials</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Contact</h4>
          <ul>
            <li><a href="mailto:{contact_email}">{contact_email}</a></li>
            <li><a href="#">{location}</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; {year} {company_name}. All rights reserved.</p>
      </div>
    </div>
  </footer>

  <script>
    // Navbar scroll effect
    window.addEventListener('scroll', () => {{
      const nav = document.getElementById('navbar');
      nav.classList.toggle('scrolled', window.scrollY > 50);
    }});

    // Scroll animations
    const observer = new IntersectionObserver((entries) => {{
      entries.forEach(entry => {{
        if (entry.isIntersecting) {{
          entry.target.classList.add('visible');
        }}
      }});
    }}, {{ threshold: 0.1 }});

    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
  </script>
</body>
</html>"""


def darken_hex(hex_color, amount=0.2):
    """Darken a hex color by amount (0.0 - 1.0)."""
    hex_color = hex_color.lstrip('#')
    r = max(0, int(hex_color[0:2], 16) - int(255 * amount))
    g = max(0, int(hex_color[2:4], 16) - int(255 * amount))
    b = max(0, int(hex_color[4:6], 16) - int(255 * amount))
    return f"#{r:02x}{g:02x}{b:02x}"


def lighten_hex(hex_color, amount=0.3):
    """Lighten a hex color by amount."""
    hex_color = hex_color.lstrip('#')
    r = min(255, int(hex_color[0:2], 16) + int((255 - int(hex_color[0:2], 16)) * amount))
    g = min(255, int(hex_color[2:4], 16) + int((255 - int(hex_color[2:4], 16)) * amount))
    b = min(255, int(hex_color[4:6], 16) + int((255 - int(hex_color[4:6], 16)) * amount))
    return f"#{r:02x}{g:02x}{b:02x}"


def generate_website(lead_data: dict) -> str:
    """
    Generate a personalized website HTML from lead data.
    lead_data keys:
      - company_name, industry, location, services, website_url
      - owner_name, first_name, email, contact_email, phone
      - brand_color (hex, e.g. '#4F46E5'), secondary_color (optional)
      - tagline, description (optional)
      - hero_headline, hero_subtext, about_text (optional, will use defaults)
    """
    # ── Colors ──
    primary = lead_data.get('brand_color', '#4F46E5').lstrip('#')
    if len(primary) == 3:
        primary = ''.join(c*2 for c in primary)
    primary = f"#{primary}"
    primary_dark = darken_hex(primary, 0.15)
    primary_light = lighten_hex(primary, 0.7)
    secondary = lead_data.get('secondary_color', '#0EA5E9').lstrip('#')
    if len(secondary) == 3:
        secondary = ''.join(c*2 for c in secondary)
    secondary = f"#{secondary}"
    accent = lighten_hex(primary, 0.5)

    # ── Core fields ──
    company_name = lead_data.get('company_name', 'Our Company')
    industry = lead_data.get('industry', '')
    location = lead_data.get('location', '')
    website_url = lead_data.get('website_url', '')
    contact_email = lead_data.get('contact_email') or lead_data.get('email', 'hello@example.com')
    services_raw = lead_data.get('services', '')

    # Parse services (comma-separated or list)
    if isinstance(services_raw, str):
        # Handle comma-separated values - strip and filter
        services_list = [s.strip() for s in services_raw.split(',') if s.strip()]
    elif isinstance(services_raw, (list, tuple)):
        services_list = [str(s).strip() for s in services_raw if s]
    else:
        services_list = []

    # ── AI-generated or default content ──
    hero_headline = lead_data.get('hero_headline') or f"Transform Your {industry} Business with {company_name}"
    hero_subtext = lead_data.get('hero_subtext') or (
        f"We help businesses like yours achieve exceptional results through "
        f"strategic {industry} solutions. Trusted by companies worldwide."
    )
    cta_primary = lead_data.get('cta_primary') or "Get Started Today"
    cta_secondary = lead_data.get('cta_secondary') or "Learn More"

    # Stats (defaults, can be overridden)
    stat_1_value = lead_data.get('stat_1_value', '500+')
    stat_1_label = lead_data.get('stat_1_label', 'Clients Served')
    stat_2_value = lead_data.get('stat_2_value', '98%')
    stat_2_label = lead_data.get('stat_2_label', 'Satisfaction Rate')
    stat_3_value = lead_data.get('stat_3_value', '10+')
    stat_3_label = lead_data.get('stat_3_label', 'Years Experience')
    stat_4_value = lead_data.get('stat_4_value', '24/7')
    stat_4_label = lead_data.get('stat_4_label', 'Support Available')

    about_title = lead_data.get('about_title') or f"Who We Are"
    about_subtitle = lead_data.get('about_subtitle') or (
        f"{company_name} is dedicated to delivering excellence in {industry}."
    )
    about_text = lead_data.get('about_text') or (
        f"Founded with a passion for helping businesses grow, {company_name} has become a trusted "
        f"partner for companies seeking {industry} solutions. Our team combines deep industry "
        f"expertise with a commitment to results, ensuring every client receives personalized "
        f"attention and measurable outcomes. We believe in building long-term relationships "
        f"founded on trust, transparency, and shared success."
    )

    services_title = lead_data.get('services_title') or "Our Services"
    services_subtitle = lead_data.get('services_subtitle') or (
        "Comprehensive solutions tailored to your unique needs."
    )

    # Default services if none provided
    default_services = [
        ("Strategic Consulting", f"Expert {industry} consulting to accelerate your growth."),
        ("Custom Solutions", f"Bespoke {industry} solutions designed for your specific goals."),
        ("Ongoing Support", "Dedicated support to ensure your continued success."),
    ]
    icons = ["💼", "⚡", "🤝"]

    # Normalize service items to (title, description) tuples
    normalized_services = []
    for svc in (services_list if services_list else default_services):
        if isinstance(svc, dict):
            title = str(svc.get('title') or svc.get('name') or 'Our Service')
            desc = str(svc.get('description') or svc.get('desc') or f"Professional {title.lower()} services tailored to your needs.")
        elif isinstance(svc, (list, tuple)) and len(svc) >= 2:
            title = str(svc[0])
            desc = str(svc[1])
        elif isinstance(svc, (list, tuple)):
            title = str(svc[0])
            desc = f"Professional {title.lower()} services tailored to your needs."
        else:
            title = str(svc)
            desc = f"Professional {title.lower()} services tailored to your needs."
        normalized_services.append((title, desc))

    service_cards = ""
    for i, (title, desc) in enumerate(normalized_services):
        icon = icons[i % len(icons)]
        service_cards += f"""
        <div class="service-card">
          <div class="service-icon">{icon}</div>
          <h3>{title}</h3>
          <p>{desc}</p>
        </div>"""

    # Testimonials
    testimonial_cards = """
        <div class="testimonial-card">
          <p class="testimonial-text">"Working with {company_name} has been transformative for our business. Their expertise and dedication are unmatched."</p>
          <div class="testimonial-author">
            <div class="testimonial-avatar">JD</div>
            <div>
              <div class="testimonial-name">Jane Doe</div>
              <div class="testimonial-role">CEO, GrowthCo</div>
            </div>
          </div>
        </div>
        <div class="testimonial-card">
          <p class="testimonial-text">"Exceptional results from day one. {company_name} delivered beyond our expectations and helped us scale rapidly."</p>
          <div class="testimonial-author">
            <div class="testimonial-avatar">MS</div>
            <div>
              <div class="testimonial-name">Michael Smith</div>
              <div class="testimonial-role">Founder, ScaleUp Inc</div>
            </div>
          </div>
        </div>
        <div class="testimonial-card">
          <p class="testimonial-text">"The team at {company_name} truly understands our industry. Their solutions have been game-changing for our operations."</p>
          <div class="testimonial-author">
            <div class="testimonial-avatar">SL</div>
            <div>
              <div class="testimonial-name">Sarah Lee</div>
              <div class="testimonial-role">Director, TechFlow</div>
            </div>
          </div>
        </div>""".format(company_name=company_name)

    cta_final_headline = lead_data.get('cta_final_headline') or "Ready to Get Started?"
    cta_final_subtext = lead_data.get('cta_final_subtext') or (
        f"Take the first step toward transforming your {industry} business today."
    )
    cta_final_button = lead_data.get('cta_final_button') or "Schedule a Free Consultation"

    year = lead_data.get('year', 2026)

    # Build the HTML
    html = BRAND_TEMPLATE.format(
        company_name=company_name,
        industry=industry or 'Business Services',
        location=location or '',
        primary_color=primary,
        primary_dark=primary_dark,
        primary_light=primary_light,
        secondary_color=secondary,
        accent_color=accent,
        hero_headline=hero_headline,
        hero_subtext=hero_subtext,
        cta_primary=cta_primary,
        cta_secondary=cta_secondary,
        stat_1_value=stat_1_value,
        stat_1_label=stat_1_label,
        stat_2_value=stat_2_value,
        stat_2_label=stat_2_label,
        stat_3_value=stat_3_value,
        stat_3_label=stat_3_label,
        stat_4_value=stat_4_value,
        stat_4_label=stat_4_label,
        about_title=about_title,
        about_subtitle=about_subtitle,
        about_text=about_text,
        services_title=services_title,
        services_subtitle=services_subtitle,
        service_cards=service_cards,
        testimonial_cards=testimonial_cards,
        cta_final_headline=cta_final_headline,
        cta_final_subtext=cta_final_subtext,
        cta_final_button=cta_final_button,
        contact_email=contact_email,
        year=year,
    )

    return html
