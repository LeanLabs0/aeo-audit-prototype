# AEO Scanner: Hero Pillars + Refine Box + Check Guides Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add above-the-fold pillar-score mini-donuts, move "Detected / Refine" into its own box, shrink the verdict headline, and give every failed scorecard check a researched "How to implement" + authoritative resources in the full report.

**Architecture:** Pure frontend change in the `aeo-audit-prototype` repo (`scan.js`, served on GitHub Pages from `feat/aeo-scanner`). The scanner renders `.aeo2` HTML from the live scan response; all four items are render-layer changes plus one static `CHECK_GUIDE` data map. No backend change. The full report (`full-report.html`) reuses the same `scan.js` render functions, so check-guide rendering benefits both.

**Tech Stack:** Vanilla JS (IIFE in `scan.js`), inline `injectAeoStyles()` CSS, GitHub Pages. Local testing via `python -m http.server` + `?state=mock` (uses `scan-mock-data.js`) + Playwright. No test framework — "test" = `node --check` + a local mock render + a DOM assertion.

**Key file:** `C:/Users/Sistemas/aeo-audit-prototype/scan.js` (single file; render functions + `injectAeoStyles()` near the bottom).

**Conventions to respect:**
- No em dashes or en dashes anywhere (house rule; `esc()` strips them at render, but author clean strings too).
- Bump the `scan.js?v=...` cache-bust in BOTH `scan.html` and `full-report.html` on every change, then hard-refresh.
- Local smoke before deploy: `node --check scan.js`, serve, load `scan.html?state=mock`, assert in DOM, screenshot.
- Commit after each task. Deploy = `git push origin feat/aeo-scanner`; poll Pages for the new `?v=`.

---

## Task 1: Hero pillar-score mini-donuts (above the fold)

Add a row of pillar mini-donuts under the gauge/verdict in the hero, like isitagentready.com: each pillar shows a donut with its 0-100 score inside, the pillar name, and the `pass/total` ratio. Pillars = the same `checks` the scorecard uses (Structured data, Can AI read your site, Does AI know who you are).

**Files:**
- Modify: `scan.js` — `renderFull` (pass `checks` to `heroHtml`), `renderFullReport` (same), `heroHtml` (render the row), add `heroPillarsHtml(checks)` + `pillarDonut(score)`, `injectAeoStyles()` (CSS).

**Step 1: Add the helpers** (place next to `engineDonut`, near the other donut helpers)

```javascript
  // Mini pillar donut for the hero: score 0-100 inside a colored ring.
  function pillarDonut(score) {
    const s = Math.max(0, Math.min(100, Number(score) || 0));
    const r = 22, c = 2 * Math.PI * r, dash = c * (s / 100);
    const cls = tone(s); // ok/warn/bad
    return `<svg viewBox="0 0 56 56" class="hpd ${cls}" aria-hidden="true">
      <circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--track)" stroke-width="5"/>
      <circle cx="28" cy="28" r="${r}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"
              stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 28 28)"/>
      <text x="28" y="28" class="hpn" text-anchor="middle" dominant-baseline="central">${s}</text></svg>`;
  }
  function heroPillarsHtml(checks) {
    if (!checks || !checks.length) return "";
    const cells = checks.map((c) => {
      const [name] = CAT_LABELS[c.key] || [c.name || c.key];
      const subs = c.subchecks || [];
      const pass = subs.filter((s) => s.status === "pass").length;
      return `<div class="hpill">${pillarDonut(c.score)}
        <div class="hpname">${esc(name)}</div>
        <div class="hpratio">${pass}/${subs.length}</div></div>`;
    }).join("");
    return `<div class="hero-pillars">${cells}</div>`;
  }
```

**Step 2: Thread `checks` into `heroHtml`** — change the signature and the call sites.

- `heroHtml(score, lvl, verdict, citedCells, totalCells, url, category, icp)` -> add `, checks` as the last param.
- Insert `${heroPillarsHtml(checks)}` right after the `.appeared` line inside the hero (before the detected box, which Task 2 removes).
- In `renderFull`, the `heroHtml(...)` call: append `, checks`.
- In `renderFullReport`, the `heroHtml(...)` call: append `, checks`.

**Step 3: CSS** (add inside `injectAeoStyles()` css, near the `.hero` rules)

```css
    .aeo2 .hero-pillars{position:relative;display:flex;justify-content:center;flex-wrap:wrap;gap:26px;margin-top:30px;padding-top:26px;border-top:1px solid var(--line)}
    .aeo2 .hpill{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:96px}
    .aeo2 .hpd{width:56px;height:56px}
    .aeo2 .hpd.bad{color:var(--bad)}.aeo2 .hpd.warn{color:var(--warn)}.aeo2 .hpd.ok{color:var(--ok)}
    .aeo2 .hpn{font-size:16px;font-weight:800;fill:var(--ink)}
    .aeo2 .hpname{font-weight:700;font-size:13px;text-align:center;max-width:120px;line-height:1.2}
    .aeo2 .hpratio{font-size:12px;color:var(--muted);font-weight:700}
```

**Step 4: Verify**

```bash
node --check scan.js   # expect: (no output / exit 0)
```
Serve + load `scan.html?state=mock`, then assert the hero has 3 pillar donuts:
```javascript
[...document.querySelectorAll('.aeo2 .hero .hpill')].map(p => p.innerText.replace(/\n/g,' '))
// expect 3 entries like "50 Structured data 3/4"
```

**Step 5: Commit**

```bash
git add scan.js && git commit -m "feat(scanner): hero pillar-score mini-donuts above the fold"
```

---

## Task 2: Move "Detected / Refine" into its own box

Pull the `.detected` line + `.refine-form` out of `.hero` and render them as a separate card below the hero.

**Files:** Modify `scan.js` — `heroHtml` (remove detected + refine-form), add `detectBoxHtml(category, icp)`, `renderFull`/`renderFullReport` (insert the box after hero), `injectAeoStyles()` (CSS for `.detectbox`).

**Step 1: Remove from `heroHtml`** — delete the `.detected` div and the `.refine-form` div from the hero template (keep eyebrow, gauge, level, verdict, appeared, hero-pillars).

**Step 2: Add `detectBoxHtml`**

```javascript
  function detectBoxHtml(category, icp) {
    return `<div class="sec2"><div class="detectbox">
      <div class="detected">Detected: <b id="detCat">${esc(category)}</b> for <b id="detIcp">${esc(icp)}</b>
        &nbsp;&middot;&nbsp; <span class="link2" id="refineLink">Refine</span></div>
      <div class="refine-form" id="refineForm">
        <input id="catIn" value="${esc(category)}" placeholder="Category">
        <input id="icpIn" value="${esc(icp)}" placeholder="Ideal customer (ICP)">
        <button class="btn-sm" id="rescanBtn">Re-scan</button>
      </div>
    </div></div>`;
  }
```

**Step 3: Insert in render** — in `renderFull` (and `renderFullReport`), add `detectBoxHtml(category, icp) +` immediately after the `heroHtml(...)` line. (`wireAeo` already wires `#refineLink`/`#rescanBtn`; no JS wiring change needed.)

**Step 4: CSS**

```css
    .aeo2 .detectbox{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 22px;box-shadow:var(--shs);text-align:center}
    .aeo2 .detectbox .detected{margin:0}
    .aeo2 .detectbox .refine-form{margin-top:14px}
```

**Step 5: Verify** — `node --check scan.js`; mock render; assert `document.querySelector('.aeo2 .hero .detected') === null` and `document.querySelector('.aeo2 .detectbox #refineLink')` exists; clicking `#refineLink` toggles `.refine-form.open`.

**Step 6: Commit**

```bash
git add scan.js && git commit -m "feat(scanner): move Detected/Refine into its own box below the hero"
```

---

## Task 3: Shrink the verdict headline

The verdict can run 3-4 lines; at 26px it gets too tall. Make it responsive/smaller.

**Files:** Modify `scan.js` — `injectAeoStyles()`, the `.aeo2 .verdict` rule.

**Step 1: Change the rule**

Find:
```css
    .aeo2 .verdict{position:relative;font-size:26px;line-height:1.26;font-weight:800;letter-spacing:-.02em;margin:22px auto 0;max-width:660px}
```
Replace with:
```css
    .aeo2 .verdict{position:relative;font-size:clamp(19px,2.2vw,22px);line-height:1.3;font-weight:800;letter-spacing:-.01em;margin:20px auto 0;max-width:620px}
```

**Step 2: Verify** — `node --check scan.js`; mock render; confirm a long verdict (4 lines) fits without overflowing the hero card (visual screenshot).

**Step 3: Commit**

```bash
git add scan.js && git commit -m "fix(scanner): shrink verdict headline so a 3-4 line headline fits"
```

---

## Task 4: Researched "How to implement" + resources on failed full-report cards

Add a static `CHECK_GUIDE` map (researched, authoritative, with verified source links) and render it on FAILED scorecard cards in the FULL report: an Issue, a "How to implement", and a richer Resources list. This un-strips the how-to in the full report (replacing the old Blueprint-hook).

**Background:** The backend (`factor8-aeo/.../checks_builder.py`) emits thin one-line `how_to_implement` and few/no `resources` per check. `CHECK_GUIDE` overrides them in the frontend, keyed by `sub.key` (e.g. `organization_schema`, `bot_gptbot`, `wikidata`). The keys below match `checks_builder.py` exactly. Sources were web-verified 2026-06-02.

**Files:** Modify `scan.js` — add `CHECK_GUIDE` constant (top of the IIFE, near the other consts), `subCard` (render guide how-to + merged resources), `renderFullReport` (call `scorecardHtml(checks, false, false)` so `stripFix=false`), `injectAeoStyles()` (optional resource styling).

**Step 1: Add the `CHECK_GUIDE` constant** near the top of the IIFE (e.g. right after `const ENGINE_LIST = [...]`). Paste verbatim:

```javascript
const CHECK_GUIDE = {
    "organization_schema": {
      "how_to": "Publish a single Organization (or LocalBusiness/Corporation subtype) JSON-LD block in the <head> of your homepage or About page - Google says you do not need it on every page. Populate name, url, logo (an absolute URL to an image at least 112x112px that renders on white), sameAs (array of your verified LinkedIn, X, Crunchbase, Wikipedia/Wikidata profiles), and contactPoint (a ContactPoint object with telephone, contactType, and email). On HubSpot CMS, add this via a global header HubL module or Settings > Website > Pages > site header HTML so it loads site-wide from one source, and give the node a stable @id like https://example.com/#organization so other schema (Article publisher, breadcrumbs) can reference the same entity.",
      "resources": [
        {
          "label": "Google Search Central - Organization structured data",
          "url": "https://developers.google.com/search/docs/appearance/structured-data/organization"
        },
        {
          "label": "schema.org - Organization type",
          "url": "https://schema.org/Organization"
        },
        {
          "label": "schema.org - ContactPoint type",
          "url": "https://schema.org/ContactPoint"
        },
        {
          "label": "Google Rich Results Test (validate your markup)",
          "url": "https://search.google.com/test/rich-results"
        }
      ]
    },
    "page_schema": {
      "how_to": "Add a sitewide WebSite node (with @type WebSite, url, name, and optionally a potentialAction SearchAction pointing at your search endpoint) plus a per-page WebPage node (@type WebPage, url, name, description, and a publisher reference to your Organization @id). Wire them into a single @graph so WebPage references the WebSite via isPartOf and the Organization via publisher, all keyed by @id (e.g. #website, #webpage). In HubSpot, generate the WebSite block once in the global header module and emit the WebPage block from the page/template using HubL tokens like {{ content.absolute_url }}, {{ page_meta.html_title }}, and {{ page_meta.meta_description }} so each page is self-describing.",
      "resources": [
        {
          "label": "schema.org - WebSite type",
          "url": "https://schema.org/WebSite"
        },
        {
          "label": "schema.org - WebPage type",
          "url": "https://schema.org/WebPage"
        },
        {
          "label": "Google Search Central - Intro to structured data (JSON-LD, @graph)",
          "url": "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data"
        }
      ]
    },
    "jsonld_coverage": {
      "how_to": "Roll a base JSON-LD @graph (Organization + WebSite + WebPage + BreadcrumbList) into your master HubSpot template/theme so every published page emits valid structured data automatically, then layer page-type-specific types (Article/BlogPosting on blog posts, Product, FAQPage, Service) on top. Use Google's preferred JSON-LD format inside a single <script type=\"application/ld+json\"> block in the <head>, and link nodes by @id rather than duplicating Organization fields per page. Validate coverage with the Rich Results Test (Google-eligibility) and the schema.org Validator (generic syntax), and monitor at scale via the Search Console structured-data enhancement reports.",
      "resources": [
        {
          "label": "Google Search Central - Structured data general guidelines",
          "url": "https://developers.google.com/search/docs/appearance/structured-data/sd-policies"
        },
        {
          "label": "Google Search Central - Intro to structured data",
          "url": "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data"
        },
        {
          "label": "schema.org Validator",
          "url": "https://validator.schema.org/"
        },
        {
          "label": "Google Rich Results Test",
          "url": "https://search.google.com/test/rich-results"
        }
      ]
    },
    "freshness": {
      "how_to": "On Article/BlogPosting (and WebPage) schema, populate datePublished and dateModified in full ISO 8601 format with a timezone offset (e.g. 2026-06-02T09:30:00-05:00), and update dateModified whenever you meaningfully revise the page. Critically, the dates in JSON-LD must exactly match a visible on-page byline date in the same timezone - Google ignores structured-data dates that contradict or lack a visible date. In HubSpot blog templates, map these to {{ content.publish_date_localized }} and {{ content.updated }} (or content.updated_time) so they stay accurate automatically, and also surface lastmod in your XML sitemap as a corroborating freshness signal.",
      "resources": [
        {
          "label": "Google Search Central - Article structured data (datePublished/dateModified)",
          "url": "https://developers.google.com/search/docs/appearance/structured-data/article"
        },
        {
          "label": "Google Search Central Blog - Help Google know the best date for your page",
          "url": "https://developers.google.com/search/blog/2019/03/help-google-search-know-best-date-for"
        },
        {
          "label": "schema.org - dateModified property",
          "url": "https://schema.org/dateModified"
        },
        {
          "label": "schema.org - datePublished property",
          "url": "https://schema.org/datePublished"
        }
      ]
    },
    "bot_gptbot": {
      "how_to": "OpenAI's training/answer crawler uses the robots.txt user-agent token GPTBot (full UA string contains \"GPTBot/1.x; +https://openai.com/gptbot\"). In your robots.txt at the site root, explicitly allow it with a block: `User-agent: GPTBot` then `Allow: /` (and make sure no broad `User-agent: *` / `Disallow: /` rule overrides it). Separately add allow blocks for `OAI-SearchBot` (ChatGPT search index) and `ChatGPT-User` (live user fetches), since those are independent tokens. In HubSpot, edit robots.txt under Settings > Website > Pages, and confirm your WAF/CDN (Cloudflare bot-fight, HubSpot security) is not blocking GPTBot's published IP ranges at openai.com/gptbot.json.",
      "resources": [
        {
          "label": "OpenAI - Overview of OpenAI Crawlers (official bots/robots.txt docs)",
          "url": "https://developers.openai.com/api/docs/bots"
        },
        {
          "label": "OpenAI - GPTBot IP ranges (JSON for WAF allowlisting)",
          "url": "https://openai.com/gptbot.json"
        },
        {
          "label": "OpenAI Help Center - Publishers and Developers FAQ",
          "url": "https://help.openai.com/en/articles/12627856-publishers-and-developers-faq"
        }
      ]
    },
    "bot_claudebot": {
      "how_to": "Anthropic's training crawler uses the robots.txt user-agent token ClaudeBot; user-initiated fetches use Claude-User and the search index uses Claude-SearchBot (three independent tokens). In robots.txt add `User-agent: ClaudeBot` with `Disallow:` (empty = allow all), and add the same allow blocks for `Claude-User` and `Claude-SearchBot` so Claude can both train on and cite your pages. Anthropic honors standard robots.txt directives and the non-standard `Crawl-delay` (e.g. `Crawl-delay: 1`) if you need to throttle rather than block. Apply these rules on every subdomain, and verify your WAF/CDN does not silently block ClaudeBot.",
      "resources": [
        {
          "label": "Anthropic/Claude Help Center - Does Anthropic crawl data from the web, and how to block the crawler",
          "url": "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler"
        },
        {
          "label": "Search Engine Land - Anthropic clarifies its three web crawlers (ClaudeBot, Claude-User, Claude-SearchBot)",
          "url": "https://searchengineland.com/anthropic-claude-bots-470171"
        }
      ]
    },
    "bot_perplexitybot": {
      "how_to": "Perplexity uses two robots.txt user-agent tokens: PerplexityBot (indexes pages for Perplexity answers/citations) and Perplexity-User (live user-initiated fetches). In robots.txt add `User-agent: PerplexityBot` with an empty `Disallow:` (or `Allow: /`) so your pages can be indexed and cited; the two tokens are configured independently. Note Perplexity-User generally ignores robots.txt because it acts on a specific user request. Allowlist PerplexityBot's published IPs (perplexity.com/perplexitybot.json) in your WAF/CDN; changes to robots.txt can take up to ~24 hours to take effect.",
      "resources": [
        {
          "label": "Perplexity - Official Perplexity Crawlers documentation",
          "url": "https://docs.perplexity.ai/docs/resources/perplexity-crawlers"
        },
        {
          "label": "Perplexity - PerplexityBot IP ranges (JSON for WAF allowlisting)",
          "url": "https://www.perplexity.com/perplexitybot.json"
        }
      ]
    },
    "bot_google_extended": {
      "how_to": "Google-Extended is a robots.txt control token (not a separate HTTP user agent - crawling still happens via Googlebot) that governs whether your content helps train Gemini Apps and the Vertex AI generative APIs, and whether it is used for grounding. To let Gemini/Vertex use your content, do NOT disallow it: either omit any Google-Extended block, or add `User-agent: Google-Extended` with an empty `Disallow:`. Blocking Google-Extended does not affect Google Search inclusion or rankings, so allowing it is the AEO-friendly choice. Add this block in your HubSpot robots.txt alongside (not merged with) your `User-agent: *` rules.",
      "resources": [
        {
          "label": "Google Search Central - Google's common crawlers (Google-Extended entry)",
          "url": "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers"
        },
        {
          "label": "Search Engine Land - Google introduces Google-Extended to control Bard/Vertex AI via robots.txt",
          "url": "https://searchengineland.com/google-extended-crawler-432636"
        }
      ]
    },
    "robots_ai": {
      "how_to": "Serve a valid robots.txt at the site root (https://yourdomain.com/robots.txt) that does NOT block AI crawlers - confirm there is no catch-all `User-agent: *` + `Disallow: /` and no AI-specific `Disallow: /` rules. Add explicit allow blocks for the major AI tokens (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Google-Extended) using `Disallow:` (empty) per group; remember each User-agent group is matched by the single most specific token, so AI bots inherit the `*` rules only if no dedicated block exists. Keep robots.txt under 500KB, include your XML `Sitemap:` line, and in HubSpot edit it via Settings > Website > Pages > robots.txt. Validate the live file resolves with HTTP 200 and is not behind a WAF/login wall.",
      "resources": [
        {
          "label": "Google Search Central - Introduction to robots.txt (syntax, group matching, rules)",
          "url": "https://developers.google.com/search/docs/crawling-indexing/robots/intro"
        },
        {
          "label": "Google Search Central - How to write and submit a robots.txt file",
          "url": "https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt"
        },
        {
          "label": "OpenAI - Overview of OpenAI Crawlers (token reference)",
          "url": "https://developers.openai.com/api/docs/bots"
        }
      ]
    },
    "ssr": {
      "how_to": "Major AI crawlers (GPTBot, ClaudeBot, PerplexityBot) fetch HTML but do NOT execute JavaScript and do not wait for client-side rendering - Vercel/MERJ measured zero JS execution across 500M+ GPTBot fetches - so any content injected by client-side JS is invisible to them. Ensure every important page (homepage, product/solution, pricing, blog, FAQ) ships its full body copy, headings, and links in the initial server HTML via SSR, static generation (SSG), or pre-rendering rather than hydration. HubSpot CMS pages are server-rendered by default, so the main risk is embedded React/Vue widgets or third-party apps that load content via JS - move that copy into native HubSpot modules/rich-text. Verify by running `curl -A \"GPTBot\" https://yourpage` (or View Source) and confirming the real text is present, not an empty `<div id=\"root\">`.",
      "resources": [
        {
          "label": "Vercel - The rise of the AI crawler (data showing AI bots do not render JS)",
          "url": "https://vercel.com/blog/the-rise-of-the-ai-crawler"
        },
        {
          "label": "Google Search Central - Crawler (user agent) overview",
          "url": "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers"
        }
      ]
    },
    "llms_txt": {
      "how_to": "Publish a markdown file at the root path /llms.txt (https://yourdomain.com/llms.txt) following the llmstxt.org spec: a single required H1 with the site/company name, an optional `>` blockquote one-line summary, optional intro paragraphs (no headings), then H2 sections (e.g. `## Docs`, `## Products`, `## Optional`) each containing a bulleted list of `[Page name](https://full-url): short description` links to your most important pages. Use the `## Optional` section for links agents may skip under tight context. Optionally also generate /llms-full.txt with the full expanded page contents inline for deeper context. In HubSpot, host it as a static file (Files tool or a serverless/template route) and confirm it serves as `text/plain` or markdown with HTTP 200; keep links absolute and current.",
      "resources": [
        {
          "label": "llmstxt.org - The /llms.txt standard (spec, file location, required format)",
          "url": "https://llmstxt.org/"
        },
        {
          "label": "llms.txt spec & tooling (llms_txt2ctx, llms-full.txt) on GitHub",
          "url": "https://github.com/AnswerDotAI/llms-txt"
        }
      ]
    },
    "wikidata": {
      "how_to": "Create a canonical Wikidata item for the brand at Special:NewItem so engines resolve a stable Q-ID instead of fuzzy-matching the company name. To pass notability, satisfy at least one of Wikidata's three criteria: a valid sitelink (e.g. an existing Wikipedia article), or a 'clearly identifiable entity describable with serious, publicly available references' (cite third-party coverage, Crunchbase/registry records, press), or a structural need. Populate core statements: instance of (P31) business/organization, official website (P856), inception (P571), and authority identifiers (LinkedIn P4264, Crunchbase P2088). Then reference that Q-ID back from your site via Organization schema sameAs (e.g. https://www.wikidata.org/wiki/Q12345) so the on-site entity and the Wikidata entity are explicitly bound.",
      "resources": [
        {
          "label": "Wikidata:Notability (official policy)",
          "url": "https://www.wikidata.org/wiki/Wikidata:Notability"
        },
        {
          "label": "Create a new Item (Special:NewItem)",
          "url": "https://www.wikidata.org/wiki/Special:NewItem"
        },
        {
          "label": "Help:Items (item structure, labels, Q-IDs)",
          "url": "https://www.wikidata.org/wiki/Help:Items"
        },
        {
          "label": "Help:QuickStatements (bulk statement entry)",
          "url": "https://www.wikidata.org/wiki/Help:QuickStatements"
        }
      ]
    },
    "sameas": {
      "how_to": "In your Organization JSON-LD (a single sitewide block, typically injected in the HubSpot header HTML or a global module so it renders on every page), add a sameAs array of authoritative external profile URLs alongside name, url, and logo. Include the canonical profiles: LinkedIn company page, Crunchbase, G2, Wikipedia, and the Wikidata Q-ID URL, so engines can merge those sources into one entity record. Use exact, live canonical URLs (no redirects, no tracking params) and keep them identical to the URLs each profile self-references. Validate the markup in Google's Rich Results Test and the Schema Markup Validator after publishing.",
      "resources": [
        {
          "label": "Google: Organization structured data (sameAs)",
          "url": "https://developers.google.com/search/docs/appearance/structured-data/organization"
        },
        {
          "label": "schema.org/sameAs property",
          "url": "https://schema.org/sameAs"
        },
        {
          "label": "schema.org/Organization type",
          "url": "https://schema.org/Organization"
        },
        {
          "label": "Schema Markup Validator",
          "url": "https://validator.schema.org/"
        }
      ]
    },
    "authors": {
      "how_to": "Attribute every article to a named human author with a visible byline that links to a dedicated author page, and mark it up with author of @type Person in Article JSON-LD. Per Google, put only the author's name in author.name (no job titles, honorifics, or publisher names) and add author.url pointing to the internal author profile page for disambiguation. On the HubSpot blog this means setting real blog authors (not 'Admin'/'Team'), enabling author bio display, and creating an author listing page; mark that profile page up with ProfilePage structured data (mainEntity = the Person, with image, jobTitle, and sameAs to LinkedIn). This signals E-E-A-T by tying content to a verifiable, expert human identity.",
      "resources": [
        {
          "label": "Google: Article structured data (author / Person)",
          "url": "https://developers.google.com/search/docs/appearance/structured-data/article"
        },
        {
          "label": "Google: Profile page (ProfilePage) structured data",
          "url": "https://developers.google.com/search/docs/appearance/structured-data/profile-page"
        },
        {
          "label": "Google: Creating helpful, people-first content (E-E-A-T)",
          "url": "https://developers.google.com/search/docs/fundamentals/creating-helpful-content"
        },
        {
          "label": "schema.org/Person type",
          "url": "https://schema.org/Person"
        }
      ]
    }
  };
```

**Step 2: Update `subCard`** to use the guide for failed checks and merge resources:

```javascript
  function mergeResources(a, b) {
    const out = [], seen = new Set();
    for (const r of [...(a || []), ...(b || [])]) {
      if (!r || !r.url || seen.has(r.url)) continue;
      seen.add(r.url); out.push(r);
    }
    return out;
  }
  function subCard(s, stripFix) {
    const pass = s.status === "pass";
    const guide = CHECK_GUIDE[s.key] || null;
    let body;
    if (pass) {
      body = s.result ? `<div class="lbl">Result</div><div>${esc(s.result)}</div>` : "";
    } else {
      const issue = s.issue ? `<div class="lbl issue">Issue</div><div class="issue">${esc(s.issue)}</div>` : "";
      const howTxt = (guide && guide.how_to) || s.how_to_implement;
      const how = (!stripFix && howTxt) ? `<div class="lbl">How to implement</div><div>${esc(howTxt)}</div>` : "";
      body = issue + how;
    }
    const resList = mergeResources(guide ? guide.resources : [], s.resources);
    const res = resList.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)}</a>`).join("");
    return `<div class="ccard ${pass ? "" : "fail"}"><div class="chead"><span class="cicon ${pass ? "ok" : "bad"}">${pass ? "✓" : "✕"}</span>
      <span class="cname">${esc(s.name || s.key)}${s.goal ? `<small>${esc(s.goal)}</small>` : ""}</span><span class="chev">▾</span></div>
      <div class="cbody">${body}${res ? `<div class="lbl">Resources</div><div class="res">${res}</div>` : ""}</div></div>`;
  }
```
(Note: this removes the old `bp-hook`. The Blueprint hook is no longer shown on cards; the how-to is now real.)

**Step 3: Un-strip in the full report** — in `renderFullReport`, change `scorecardHtml(checks, false, true)` to `scorecardHtml(checks, false, false)`. (Preview stays `scorecardHtml(checks, true, true)` — still gated/teased.)

**Step 4: Verify**

```bash
node --check scan.js
```
Mock render the full report: serve, load `scan.html?state=mock`, click a competitor "Unlock full details" to reach `full-report.html`, then assert a failed card has how-to + multiple resources:
```javascript
const c = [...document.querySelectorAll('.aeo2 .ccard.fail')].find(x => /Wikidata|llms\.txt|GPTBot/i.test(x.innerText));
c.classList.add('open');
const t = c.querySelector('.cbody').innerText;
({ hasHowTo: /How to implement/.test(t), resourceCount: c.querySelectorAll('.res a').length, emDash: /—/.test(t) });
// expect hasHowTo true, resourceCount >= 2, emDash false
```

**Step 5: Commit**

```bash
git add scan.js && git commit -m "feat(scanner): researched How-to-implement + authoritative resources on failed full-report checks"
```

---

## Final: cache-bust + deploy + live verify

**Step 1:** Bump cache-bust in both HTML files (e.g. `g` -> `i`):
```bash
sed -i 's/scan\.js?v=20260602[a-z]/scan.js?v=20260602i/' scan.html full-report.html
git add scan.html full-report.html && git commit -m "chore(scanner): cache-bust scan.js -> v20260602i"
```

**Step 2:** Deploy:
```bash
git push origin feat/aeo-scanner
```

**Step 3:** Poll Pages until `curl -s "https://leanlabs0.github.io/aeo-audit-prototype/scan.html?cb=$RANDOM" | grep v=20260602i` matches, then run a real scan in Playwright (`https://www.lean-labs.com/growth-driven-design`) and confirm: hero pillar donuts render with real scores; Detected/Refine is its own box; the verdict fits; the full report's failed cards show How-to-implement + multiple working resource links; no em dashes anywhere.

---

## Open question for Ralph (does not block Tasks 1-3)

The `CHECK_GUIDE` lives in the frontend (fast, prototype-friendly). The backend `checks_builder.py` still emits the old thin `how_to_implement`/`resources`. If/when this graduates from prototype to the real product, the same researched content should move into `checks_builder.py` so the API is the source of truth (and other consumers benefit). Flagged, not done here.
