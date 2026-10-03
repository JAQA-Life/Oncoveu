# SEO, AEO and GEO — what is built in, and what to do after launch

## Built in
**SEO (search engines)**
- Unique `<title>` (≤ 62 chars) and meta description (≤ 155 chars) on every page; one `<h1>` per page; logical heading order.
- Canonical URLs (https://oncotics.com/…/ with trailing slashes), `hreflang`, robots meta with large image previews.
- Open Graph + Twitter cards with 1200×630 images (`og-oncotics.png`, `og-amit-suresh.jpg`).
- `sitemap.xml` (with image entry for Amit's photo) and `robots.txt`.
- Fast, dependency-free pages: no web fonts, no JavaScript on site pages, WebP photo with JPEG fallback, explicit image sizes, gzip + caching via `.htaccess`.
- HTTPS + non-www canonical redirects, clean folder URLs, custom 404 (noindex).
- Accessible: skip link, landmarks, alt text, visible focus, contrast checked, light/dark.

**Structured data (schema.org JSON-LD)**
- Organization (founder, logo, LinkedIn `sameAs`, contact point), WebSite, WebPage/AboutPage/ContactPage.
- Person — Amit Suresh: Creator and Architect; credentials (IICA Independent Director, MBA in Healthcare Management, CFI FMVA); occupation Genetic Engineer; LinkedIn `sameAs`.
- SoftwareApplication (HealthApplication, free) for the Workspace; FAQPage (home + contact); BreadcrumbList; Speakable.

**AEO (answer engines, featured snippets, voice)**
- Question-style headings: What is Oncotics? Who benefits? How does it work? When is it useful? Why was it built? Where does the data come from?
- Answer-first summary boxes, short factual paragraphs, a who/how table, numbered steps and a 10-question FAQ with FAQPage markup.

**GEO (generative engines: ChatGPT, Claude, Perplexity, Gemini, Copilot)**
- `/llms.txt` (key facts + page map) and `/llms-full.txt` (full page text) for AI assistants.
- `robots.txt` explicitly allows GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended and Bingbot.
- Consistent entity facts across pages, schema and llms.txt (name, founder, credentials, URL, LinkedIn), named data sources with links, visible "last updated" date.

## After launch (do once)
1. **Google Search Console**: add the domain property, verify with a DNS TXT record in hPanel, submit `https://oncotics.com/sitemap.xml`, request indexing for the home, about and workspace pages.
2. **Bing Webmaster Tools**: import from Search Console (Bing also feeds Copilot and ChatGPT search); submit the sitemap.
3. Test with Google's **Rich Results Test** and the **Schema Markup Validator** (validator.schema.org).
4. Check **PageSpeed Insights** for mobile and desktop.
5. On Amit's LinkedIn profile, add https://oncotics.com in the website/featured section so the entity link is two-way.
6. When content changes, update the "Last updated" date and `<lastmod>` in the sitemap (both come from `UPDATED` in `build_site.py`).

## To keep the promises true
If you ever add analytics or third-party embeds, update the privacy page, the llms files and the CSP first.
