/* scan.js — AEO scanner v5 (multi-solution, live-wired).
 *
 * Renders the response from
 *   POST https://factor8-agent-sdk.fly.dev/api/v1/{brand-slug}/public-scanner/aeo-visibility-scan
 * (or window.AEO_SCAN_MOCK when ?state= is present, for debugging).
 *
 * Replaces the previous 5-category renderers (ai_citations / content /
 * structured_data / crawler_access / entity) with a per-solution layout:
 *   - One tile per solution (donut + title + "Cited by N of 4 engines").
 *   - One collapsible section per solution containing:
 *       * Competitors chip row ("Surfaced by AI:")
 *       * Red callout with verbatim raw_response + "{brand} was not mentioned"
 *       * Prompt-tracking table (8 rows × 4 engines, first 2 visible)
 *       * Inline email gate that unblurs the remaining 6 rows on submit
 */
(function () {
  "use strict";

  const ENGINE_LABELS = { chatgpt: "ChatGPT", claude: "Claude", perplexity: "Perplexity", gemini: "Gemini" };
  const ENGINE_ORDER = ["chatgpt", "claude", "perplexity", "gemini"];

  // Per-LLM prompt-table sections rendered inside the AI Citations group body.
  const ENGINE_LIST = [
    { key: "chatgpt", label: "ChatGPT" },
    { key: "claude",  label: "Claude"  },
    { key: "gemini",  label: "Gemini"  },
  ];

  // Researched check guidance (how-to + authoritative resources), keyed by check key.
  // Sources web-verified 2026-06-02. See docs/plans/2026-06-02-aeo-scanner-hero-pillars-and-check-guides.md
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

  // Live API config.
  // PROD (2026-05-29): the AEO scanner is now merged to main and deployed on Fly.
  // gpt-5.1-chat / Claude Sonnet 4.6 / Gemini 3.1-flash-lite, all web-search.
  const API = {
    url: "https://factor8-agent-sdk.fly.dev/api/v1/brand-slug/public-scanner/aeo-visibility-scan",
    key: "594aa935e360c9bf28f97437c1dddea9",
  };
  const GENIE_PREFETCH_URL = "https://factor8-agent-sdk.fly.dev/api/v1/brand-slug/public-scanner/aeo-genie";

  // Start writing the Genie moves in the BACKGROUND the moment the full report renders,
  // so they are cooking (server-side, ~1 min) while the user reads. The server dedups,
  // so the later CTA click joins the same run. If it finishes before they click, we
  // stash the result for an instant Genie.
  function prefetchGenie(data) {
    try {
      localStorage.removeItem("aeo_genie_result");
      fetch(GENIE_PREFETCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API.key },
        body: JSON.stringify({ scan_result: data }),
      }).then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && d.moves) { try { d.__scan_url = (data.solutions && data.solutions[0] && data.solutions[0].url) || data.url || ""; localStorage.setItem("aeo_genie_result", JSON.stringify(d)); } catch (_) {} } })
        .catch(() => {});
    } catch (_) {}
  }

  // ── Small DOM helpers ─────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  // Also strips em/en dashes from ALL rendered text (incl. backend-sourced check
  // copy + AI responses) so no em dash ever reaches the report. House rule.
  const esc = (s) => String(s == null ? "" : s)
    .replace(/\s*—\s*/g, ", ").replace(/\s*–\s*/g, "-")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  function tintClass(score) {
    if (score >= 80) return "tint-ok";
    if (score >= 50) return "tint-warn";
    return "tint-bad";
  }

  function levelText(score) {
    // 4-level visibility scale (approved). cls drives color: bad/orange/warn/ok.
    if (score >= 75) return { n: 4, label: "Consistently recommended", cls: "ok" };
    if (score >= 50) return { n: 3, label: "Sometimes recommended", cls: "warn" };
    if (score >= 25) return { n: 2, label: "Occasionally recommended", cls: "orange" };
    return { n: 1, label: "Rarely recommended", cls: "bad" };
  }

  function truncate(s, n) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
  }

  function slugify(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // ── State switch (debug only) ───────────────────────────────────────────
  function getState() {
    const m = new URLSearchParams(window.location.search).get("state");
    return m || "default";
  }

  // ── SCREEN SWITCHING (entry ↔ results) ──────────────────────────────────
  function showEntry() {
    const entry = $("#entry"), results = $("#results");
    if (results) results.setAttribute("hidden", "");
    if (entry) entry.removeAttribute("hidden");
  }

  function showResults() {
    const entry = $("#entry"), results = $("#results");
    if (entry) entry.setAttribute("hidden", "");
    if (results) results.removeAttribute("hidden");
    window.scrollTo({ top: 0 });
  }

  // ── GAUGE ──────────────────────────────────────────────────────────────
  function renderGauge(score) {
    const host = $("#gauge");
    const tone = tintClass(score);
    host.innerHTML = `
      <div class="gauge-wrap">
        <svg viewBox="0 0 200 120" class="gauge-svg" aria-hidden="true">
          <defs><linearGradient id="llGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#7612fa"/><stop offset="0.5" stop-color="#c109af"/><stop offset="1" stop-color="#ff6221"/>
          </linearGradient></defs>
          <path d="M10,100 A90,90 0 0 1 190,100" fill="none" stroke="#e8e8ef" stroke-width="16" stroke-linecap="round"/>
          <path id="gaugeArc" d="M10,100 A90,90 0 0 1 190,100" fill="none" stroke="url(#llGrad)" stroke-width="16" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
        </svg>
        <div class="gauge-center">
          <div class="gauge-score ${tone}">${score}<span class="gauge-of">/100</span></div>
        </div>
      </div>`;
    const arc = $("#gaugeArc");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { arc.style.strokeDashoffset = String(100 - score); });
    });
  }

  // ── BRAND CONTEXT ───────────────────────────────────────────────────────
  function renderBrandContext(ctx) {
    const host = $("#brandContext");
    if (!ctx) { host.innerHTML = ""; return; }
    host.innerHTML = `
      <div class="brand-line">Detected: <b>${esc(ctx.category || "your category")}</b> for <b>${esc(ctx.icp || "your buyers")}</b>
        · <button type="button" class="link-btn" id="refineBtn">refine</button></div>`;
    const btn = $("#refineBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        showEntry();
        const fields = $("#ctxFields");
        if (fields) fields.scrollIntoView({ behavior: "smooth", block: "center" });
        const cat = $("#inputCategory");
        if (cat) cat.focus();
      });
    }
  }

  // ── SOLUTION TILES (donut + title + sub) ─────────────────────────────────
  function donutSvg(score) {
    const r = 26, c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, score)) / 100;
    const dash = c * pct;
    return `
      <svg viewBox="0 0 64 64" class="donut-svg ${tintClass(score)}" aria-hidden="true">
        <circle cx="32" cy="32" r="${r}" fill="none" stroke="#e8e8ef" stroke-width="6"/>
        <circle class="donut-ring" cx="32" cy="32" r="${r}" fill="none" stroke="currentColor" stroke-width="6"
                stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${c.toFixed(2)}"
                transform="rotate(-90 32 32)"/>
        <text x="32" y="32" class="donut-num" text-anchor="middle" dominant-baseline="central">${score}</text>
      </svg>`;
  }

  function enginesCited(sol) {
    const by = (sol.evidence && sol.evidence.by_engine) || {};
    let n = 0;
    for (const k of ENGINE_ORDER) {
      const e = by[k];
      if (e && (e.mention_rate > 0 || e.mentions > 0)) n += 1;
    }
    return n;
  }

  // ── CATEGORY TILES (one tile per AEO pillar) ─────────────────────────────
  function _countPasses(subs) {
    const total = (subs || []).length;
    const pass = (subs || []).filter((s) => s && s.status === "pass").length;
    return { pass, total };
  }

  // AI Citations data lives in the bottom "What we found" table — the
  // drill-down panel is suppressed entirely. This helper catches every
  // shape the backend (or older mocks) may emit.
  function isAiCitationsCat(cat) {
    if (!cat) return false;
    const key = (cat.key || "").toLowerCase();
    const name = (cat.name || "").toLowerCase();
    if (key === "ai_citations" || key === "ai-citations" || key === "aicitations") return true;
    if (key.startsWith("ai_") && /citation/.test(key)) return true;
    if (/ai[\s\-_]*citations?/.test(name)) return true;
    // Also: if any subcheck key starts with "cited_" it's the citations category.
    if (Array.isArray(cat.subchecks) && cat.subchecks.some((s) => /^cited_/.test((s && s.key) || ""))) return true;
    return false;
  }

  function renderCategoryTiles(checks) {
    const host = $("#categories");
    if (!host) return;
    if (!checks || !checks.length) {
      host.innerHTML = `<div class="no-solutions">No category checks available for this scan.</div>`;
      return;
    }
    host.innerHTML = checks.map((cat) => {
      const score = Number.isFinite(cat.score) ? cat.score : 0;
      const { pass, total } = _countPasses(cat.subchecks);
      const targetId = `cat-${slugify(cat.key || cat.name)}`;
      return `
        <button type="button" class="cat-card cat-tile" data-cat-tile data-target="${esc(targetId)}" aria-expanded="false" title="${esc(cat.name || "")}">
          <div class="cat-donut">${donutSvg(score)}</div>
          <div class="cat-label">${esc(cat.name || cat.key || "Category")}</div>
          <span class="cat-score-chip ${tintClass(score)}">${score}</span>
          <span class="cat-summary">${pass} of ${total} checks passing</span>
        </button>`;
    }).join("");

    host.querySelectorAll("[data-cat-tile]").forEach((tile) => {
      tile.addEventListener("click", () => {
        const target = tile.getAttribute("data-target");
        const group = document.getElementById(target);
        if (!group) return;
        openGroup(group);
        host.querySelectorAll("[data-cat-tile]").forEach((t) =>
          t.setAttribute("aria-expanded", t === tile ? "true" : "false"));
        group.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // ── CATEGORY DETAIL SECTIONS (one collapsible group per category) ────────
  function _buildFixPrompt(sub) {
    const parts = [];
    parts.push(`I'm fixing an AI Engine Optimization (AEO) check on my website.`);
    if (sub.name) parts.push(`Check: ${sub.name}`);
    if (sub.goal) parts.push(`Goal: ${sub.goal}`);
    if (sub.issue) parts.push(`Issue: ${sub.issue}`);
    if (sub.how_to_implement) parts.push(`Suggested fix: ${sub.how_to_implement}`);
    parts.push(`Please walk me through implementing this on a typical SaaS marketing site (HubSpot CMS or similar). Include code/markup samples.`);
    return parts.join("\n\n");
  }

  function _subcheckCard(sub) {
    const isPass = sub.status === "pass";
    const statusIcon = isPass
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

    const goalBlock = sub.goal
      ? `<div class="card-section">
           <div class="card-label">Goal</div>
           <div class="card-text">${esc(sub.goal)}</div>
         </div>` : "";

    let bodyBlocks = "";
    if (isPass) {
      if (sub.result) {
        bodyBlocks += `
          <div class="card-section">
            <div class="card-label">Result</div>
            <div class="result-text">${esc(sub.result)}</div>
          </div>`;
      }
    } else {
      if (sub.issue) {
        bodyBlocks += `
          <div class="card-section">
            <div class="card-label">Issue</div>
            <div class="issue-text">${esc(sub.issue)}</div>
          </div>`;
      }
      if (sub.how_to_implement) {
        bodyBlocks += `
          <div class="card-section">
            <div class="card-label">How to implement</div>
            <div class="card-text">${esc(sub.how_to_implement)}</div>
          </div>`;
      }
    }

    const resources = Array.isArray(sub.resources) ? sub.resources : [];
    let resourceBlock = "";
    if (resources.length) {
      const chips = resources.map((r) =>
        `<a class="resource-chip" href="${esc(r.url)}" target="_blank" rel="noopener">
           <span>${esc(r.label)}</span>
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
         </a>`).join("");
      resourceBlock = `
        <div class="card-section">
          <div class="card-label">Resources</div>
          <div class="resource-chips">${chips}</div>
        </div>`;
    }

    const promptText = _buildFixPrompt(sub);
    const copyBtn = !isPass
      ? `<button type="button" class="card-action-btn card-action-btn--primary" data-copy-prompt="${esc(promptText)}">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
           Copy prompt
         </button>` : "";

    const detailsBtn = `
      <button type="button" class="card-action-btn" data-audit-details>
        Audit details
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>`;

    const actionRow = `
      <div class="card-actions">
        ${copyBtn}
        ${detailsBtn}
      </div>
      <pre class="card-audit-payload" hidden>${esc(JSON.stringify(sub, null, 2))}</pre>`;

    return `
      <div class="scan-card ${isPass ? "" : "scan-card--fail"}">
        <button type="button" class="scan-card-head" data-card-toggle aria-expanded="false">
          <span class="card-status ${isPass ? "status-pass" : "status-fail"}" aria-hidden="true">${statusIcon}</span>
          <span class="card-name">${esc(sub.name || sub.key || "Check")}</span>
          <svg class="card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="scan-card-body">
          ${goalBlock}
          ${bodyBlocks}
          ${resourceBlock}
          ${actionRow}
        </div>
      </div>`;
  }

  // Pull candidate brand names out of a raw AI response. Mirrors the
  // server-side regex extractor: numbered lists (1. X, 1) X, - X, • X) and
  // bolded markdown (**X**). Filters out the user's own brand and common
  // generic terms ("Best", "Pricing", etc.).
  function extractBrandsFromText(text, brand, maxN = 4) {
    if (!text) return [];
    const brandL = (brand || "").toLowerCase();
    const candidates = new Set();
    const order = [];
    const addCand = (raw, opts) => {
      let c = String(raw || "").trim();
      // Drop trailing colons / punctuation / dashes (e.g. "Brand Voice:").
      const hadTrailingColon = /:\s*$/.test(c);
      c = c.replace(/[*_:.,\-—\s]+$/, "").trim();
      if (!c) return;
      // Reject obvious section labels — phrases that end with ":" OR start
      // with weak intros ("Why", "Key", "Best", "Top") followed by anything.
      if (hadTrailingColon && (opts && opts.fromBold)) return;
      if (/^(Why|Key|Best|Top|How|What|When|Where|For|Considerations?|Pros|Cons|Use Cases?|Overview|Summary|Features?|Pricing|Limitations?)\b/i.test(c)) return;
      // Strip leading "X. " / "X) " from numbered items (regex doesn't always
      // consume them when the trigger char is a colon).
      c = c.replace(/^\d+[\.\)]\s+/, "");
      // Pull a clean brand head if there's a " - " / " — " / " (" suffix:
      // "Jasper (formerly Jarvis.ai) - Best for Content" -> "Jasper".
      const head = c.split(/\s[-–—]\s|\s\(/)[0].trim();
      if (head && head.length >= 2 && head.length <= 60) c = head;
      if (!c) return;
      if (!candidates.has(c)) {
        candidates.add(c);
        order.push(c);
      }
    };
    // Numbered / bulleted list items: 1) X, 1. X, 1: X, - X, • X, * X
    const numbered = /(?:^|[\s,;:])(?:\d+[\.\):]\s+|[-•*]\s+)([A-Z0-9][^\n,.;:!?\(\)]{1,60})/gm;
    let m;
    while ((m = numbered.exec(text)) !== null) addCand(m[1], { fromBold: false });
    // Bolded markdown headers — **Brand Name**
    const bold = /\*\*([A-Z][^\*\n]{1,60})\*\*/g;
    while ((m = bold.exec(text)) !== null) {
      const raw = m[1].trim();
      // Bold ending with ":" is a section header in disguise — skip.
      if (raw.endsWith(":")) continue;
      addCand(raw, { fromBold: true });
    }

    const SECTION_LABEL = new Set([
      "hero section", "foundation", "clear value proposition", "contact/demo",
      "core philosophy", "key use cases", "key use case",
      "key features", "main features", "main feature",
      "brand voice", "brand voice consistency", "ai features", "ai capabilities",
      "data-driven marketing", "data-driven", "rapid content creation",
      "free tier", "user-friendly interface", "templates & recipes", "templates and recipes",
      "seo optimization", "brainstorming power", "wide range of tools",
      "integrated platform", "robust crm", "email marketing", "marketing hub",
      "knowledge graph", "context engine", "continuous learning", "agentic",
      "action-oriented language", "clear call-to-actions", "clear call to actions",
      "accessibility & inclusivity", "accessibility and inclusivity", "balanced risk/reward",
      "content-first design", "design thinking",
      "conversion rate optimization", "personalization", "a/b testing",
      "content generation", "analytics integration", "responsive design",
      "testing", "approach", "flexibility", "agile",
      "sticky ctas", "mobile-first", "homepage elements",
      "user-centric design", "understand your audience", "intuitive navigation",
      "conversion-first structure", "minimum viable website", "primary cta",
      "secondary ctas", "gdd",
      "overview", "summary", "conclusion", "recommendation", "recommendations",
      "pros", "cons", "considerations", "use cases", "use case",
      "limitations", "pricing",
    ]);
    const BAD_FIRST = new Set([
      "why","how","what","when","where","who","which",
      "key","core","main",
      "use","using","for","with","without","via",
      "pros","cons","consider","considering",
      "understand","understanding","build","building","create","creating",
      "open","opening","end","ending","start","starting",
      "improve","improving","optimize","optimizing",
    ]);
    const STOP = new Set([
      "best for", "best overall", "best", "top", "budget", "pricing", "price",
      "scalability", "performance", "quality", "integration", "integrations",
      "security", "ease of use", "customer support", "support", "reliability",
      "speed", "cost", "value", "considerations", "factors", "criteria",
      "options", "alternatives", "tools", "platforms", "providers", "solutions",
      "services", "agencies", "vendors", "companies", "strengths", "weaknesses",
      "ai-powered", "ai-driven", "automation", "knowledge graph", "context engine",
      "continuous learning", "agentic", "features", "pros", "cons", "overview",
      "summary", "conclusion", "recommendation", "recommendations",
      // Common Gemini/Claude bold-section noise:
      "brand voice consistency", "rapid content creation", "free tier",
      "user-friendly interface", "templates & recipes", "seo optimization",
      "key use cases", "brainstorming power", "wide range of tools",
      "integrated platform", "ai capabilities", "robust crm", "email marketing",
      "marketing hub", "key features", "main features",
    ]);
    const out = [];
    for (const c of order) {
      if (c.length < 2 || c.length > 60) continue;
      const cl = c.toLowerCase();
      if (cl === brandL) continue;
      if (STOP.has(cl)) continue;
      // Reject if it looks like a sentence/section label, not a brand.
      const words = c.split(/\s+/);
      if (words.length > 4) continue;
      if (SECTION_LABEL.has(cl)) continue;
      const firstWord = words[0] ? words[0].toLowerCase() : "";
      if (BAD_FIRST.has(firstWord)) continue;
      // Brand-shape detector: every word should either start with an
      // uppercase letter, be a short connector ("&", "/", "+"), or contain
      // a digit/non-letter (e.g. "GPT-4", "Copy.ai"). Sentences and feature
      // labels mix Title-case first words with lowercase prose later.
      let looksLikeBrand = true;
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (!w) continue;
        if (/^[&/+\-]$/.test(w)) continue;          // connector
        if (/[0-9.\/+]/.test(w)) continue;          // contains digit / punct
        if (/^[A-Z]/.test(w)) continue;             // Title-case word
        // First-word lowercase ("iPhone"-style) is fine if mixed-case overall
        if (i === 0 && /[A-Z]/.test(w)) continue;
        looksLikeBrand = false;
        break;
      }
      if (!looksLikeBrand) continue;
      out.push(c);
      if (out.length >= maxN) break;
    }
    return out;
  }

  // ── IMPROVE-THE-SCORE CTA (fail-count pill, between score and tiles) ─────
  function countFailSubchecks(checks) {
    let n = 0;
    for (const cat of (checks || [])) {
      for (const s of (cat.subchecks || [])) {
        if (s && s.status === "fail") n += 1;
      }
    }
    return n;
  }

  function renderImproveCta(checks) {
    const host = $("#improveCtaMount");
    if (!host) return;
    const n = countFailSubchecks(checks);
    if (n === 0) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = `
      <button type="button" class="improve-cta" id="improveCtaBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        <span>Improve the score</span>
        <span class="improve-cta-count">${n}</span>
      </button>`;
    const btn = $("#improveCtaBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        const groups = document.getElementById("categoryDetails");
        if (groups) groups.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function renderCategoryDetails(checks, primarySolution, brand) {
    const host = $("#categoryDetails");
    if (!host) return;
    if (!checks || !checks.length) {
      host.innerHTML = "";
      return;
    }

    // AI Citations is the first category (backend ships it first). Its body is
    // the per-prompt table — the user-facing "what we found" detail. Other
    // categories keep the standard sub-check card render.
    host.innerHTML = checks.map((cat, i) => {
      const score = Number.isFinite(cat.score) ? cat.score : 0;
      const { pass, total } = _countPasses(cat.subchecks);
      const targetId = `cat-${slugify(cat.key || cat.name)}`;
      const isFirst = i === 0;

      let body;
      if (isAiCitationsCat(cat)) {
        body = primarySolution ? promptTableHtml(primarySolution, brand) : "";
      } else {
        const cards = (cat.subchecks || []).map(_subcheckCard).join("");
        body = `<div class="card-stack">${cards}</div>`;
      }

      return `
        <div class="check-group cat-group ${isFirst ? "open" : ""}" id="${esc(targetId)}">
          <button type="button" class="check-group-head" aria-expanded="${isFirst ? "true" : "false"}">
            <span class="check-group-name">${esc(cat.name || cat.key || "Category")}</span>
            <span class="check-group-meta">
              <span class="check-group-frac ${tintClass(score)}">${pass}/${total}</span>
              <svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          </button>
          <div class="check-group-body">${body}</div>
        </div>`;
    }).join("");

    wireGroups($("#categoryDetails"));
    wireCards($("#categoryDetails"));
    wireCardActions($("#categoryDetails"));
  }

  function renderSolutionTiles(solutions) {
    const host = $("#categories");
    if (!solutions || !solutions.length) {
      host.innerHTML = `<div class="no-solutions">No solution pages detected on this homepage. Try a more specific URL.</div>`;
      return;
    }
    host.innerHTML = solutions.map((sol, i) => {
      const score = Number.isFinite(sol.score) ? sol.score : 0;
      const cited = enginesCited(sol);
      const title = truncate(sol.title || sol.url || `Solution ${i + 1}`, 36);
      const targetId = `sol-${i}-${slugify(sol.title || "solution").slice(0, 32)}`;
      return `
        <button type="button" class="cat-card sol-card" data-sol-tile data-target="${esc(targetId)}" aria-expanded="false" title="${esc(sol.title || "")}">
          <div class="cat-donut">${donutSvg(score)}</div>
          <div class="cat-label">${esc(title)}</div>
          <span class="cat-score-chip ${tintClass(score)}">${score}</span>
          <span class="cat-summary">Cited by ${cited} of 4 engines</span>
        </button>`;
    }).join("");

    host.querySelectorAll("[data-sol-tile]").forEach((tile) => {
      tile.addEventListener("click", () => {
        const target = tile.getAttribute("data-target");
        const group = document.getElementById(target);
        if (!group) return;
        openGroup(group);
        host.querySelectorAll("[data-sol-tile]").forEach((t) =>
          t.setAttribute("aria-expanded", t === tile ? "true" : "false"));
        group.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function promptTableHtml(sol, brandName) {
    const ev = (sol && sol.evidence) || {};
    const prompts = ev.prompts || [];
    const runs = ev.runs || [];
    if (!prompts.length) return "";

    const brandLabel = brandName || "You";
    const headerCited = `${esc(brandLabel)} Cited`;

    // ONE clean competitor list (server-side, LLM-extracted) instead of the old
    // noisy per-row regex extraction that leaked section headers like
    // "Value Proposition" / "HubSpot Partner".
    const comps = (sol.competitors || []).filter(Boolean);
    const compBlock = comps.length ? `
      <div class="competitors-summary">
        <span class="competitors-label">Surfaced by AI instead of ${esc(brandLabel)}:</span>
        <span class="competitors-chips">${comps.map((c) => `<span class="competitor-chip">${esc(c)}</span>`).join("")}</span>
      </div>` : "";

    // One labeled table per engine — Question + whether you were cited.
    const tables = ENGINE_LIST.map(({ key, label }) => {
      const engineRuns = runs.filter((r) => r && (r.engine === key));
      if (!engineRuns.length) return "";

      const citedByPrompt = new Set();
      for (const r of engineRuns) {
        if (r.mentioned) citedByPrompt.add(r.prompt_id);
      }

      const rows = prompts.map((p, i) => {
        const cited = citedByPrompt.has(p.id);
        return `
          <tr>
            <td class="col-num">${i + 1}</td>
            <td class="col-q">${esc(p.prompt)}</td>
            <td class="col-cited ${cited ? "yes" : "no"}">${cited ? "Yes" : "No"}</td>
          </tr>`;
      }).join("");

      return `
        <div class="engine-table-block">
          <h3 class="engine-table-title">${esc(label)}</h3>
          <div class="prompts-table-wrap">
            <table class="prompts-table">
              <thead>
                <tr>
                  <th class="col-num">#</th>
                  <th class="col-q">Question</th>
                  <th class="col-cited">${headerCited}</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }).join("");

    return compBlock + tables;
  }

  // ── WIRING ───────────────────────────────────────────────────────────────
  function openGroup(group) {
    group.classList.add("open");
    const head = group.querySelector(".check-group-head");
    if (head) head.setAttribute("aria-expanded", "true");
  }

  function wireGroups(root) {
    const scope = root || document;
    scope.querySelectorAll(".check-group-head").forEach((head) => {
      // Guard against double-wiring: stamp the element and skip if already wired.
      if (head.dataset.wired === "1") return;
      head.dataset.wired = "1";
      head.addEventListener("click", () => {
        const group = head.closest(".check-group");
        const open = group.classList.toggle("open");
        head.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  function wireCards(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-card-toggle]").forEach((head) => {
      if (head.dataset.wired === "1") return;
      head.dataset.wired = "1";
      head.addEventListener("click", () => {
        const card = head.closest(".scan-card");
        const open = card.classList.toggle("open");
        head.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  function wireCardActions(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-copy-prompt]").forEach((btn) => {
      if (btn.dataset.wired === "1") return;
      btn.dataset.wired = "1";
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const text = btn.getAttribute("data-copy-prompt") || "";
        try {
          await navigator.clipboard.writeText(text);
          toast("Prompt copied. Paste into ChatGPT, Claude, or your LLM of choice.");
        } catch (_) {
          toast("Couldn't copy to clipboard. Try selecting manually.");
        }
      });
    });
    scope.querySelectorAll("[data-audit-details]").forEach((btn) => {
      if (btn.dataset.wired === "1") return;
      btn.dataset.wired = "1";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const card = btn.closest(".scan-card");
        const pre = card && card.querySelector(".card-audit-payload");
        if (pre) pre.toggleAttribute("hidden");
      });
    });
  }

  // ── STATE RENDERERS (error / empty) ──────────────────────────────────────
  function showStateCard(html) {
    showResults();
    $("#report").setAttribute("hidden", "");
    const sec = $("#scanState");
    sec.removeAttribute("hidden");
    sec.innerHTML = html;
    const again = sec.querySelector("[data-scan-again]");
    if (again) again.addEventListener("click", () => { window.location.search = ""; });
  }

  function renderUnreadable(host) {
    showStateCard(`
      <div class="state-card state-card--bad">
        <div class="state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><path d="m2 2 20 20"/></svg>
        </div>
        <h2 class="state-title">We couldn't detect solution pages on <b>${esc(host || "the homepage")}</b></h2>
        <p class="state-text">Try a more specific URL. For example, a /solutions or /products page. If the homepage renders content with JavaScript, that's itself an AEO problem: AI engines see the same empty page.</p>
        <button type="button" class="btn-primary" data-scan-again>Scan another site</button>
      </div>`);
  }

  function renderUnreachable(host) {
    showStateCard(`
      <div class="state-card state-card--bad">
        <div class="state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="4"/></svg>
        </div>
        <h2 class="state-title">We couldn't reach <b>${esc(host || "that site")}</b></h2>
        <p class="state-text">Check the URL is public and reachable, then try again.</p>
        <button type="button" class="btn-primary" data-scan-again>Try again</button>
      </div>`);
  }

  function renderGenericError(msg) {
    showStateCard(`
      <div class="state-card state-card--bad">
        <div class="state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
        </div>
        <h2 class="state-title">Something went wrong</h2>
        <p class="state-text">${esc(msg || "We hit an unexpected error running the scan. Please try again in a moment.")}</p>
        <button type="button" class="btn-primary" data-scan-again>Try again</button>
      </div>`);
  }

  // ── LOADING SCREEN (stepped progress driven by SSE phase events) ─────────
  const STEPS = [
    { key: "fetching",  label: "Fetching your solution page" },
    { key: "profiling", label: "Detecting your category & buyer" },
    { key: "prompts",   label: "Generating buyer prompts" },
    { key: "querying",  label: "Querying ChatGPT, Claude & Gemini" },
    { key: "compiling", label: "Compiling your AEO report" },
  ];

  let _loadingState = { currentPhase: null, pct: 0, message: "" };

  function showLoading(url) {
    showResults();
    $("#report").setAttribute("hidden", "");
    const sec = $("#scanState");
    sec.removeAttribute("hidden");
    _loadingState = { currentPhase: null, pct: 0, message: "" };
    sec.innerHTML = `
      <div class="state-card state-card--loading">
        <h2 class="state-title">Scanning <b>${esc(url)}</b></h2>
        <p class="state-text loader-msg" id="loaderMsg">Connecting…</p>
        <div class="scan-progress-bar"><div class="scan-progress-fill" id="scanProgressFill" style="width: 2%"></div></div>
        <ul class="scan-steps" id="scanSteps">
          ${STEPS.map((s) => `
            <li class="scan-step" data-step="${s.key}">
              <span class="scan-step-icon"><span class="scan-step-dot"></span></span>
              <span class="scan-step-label">${esc(s.label)}</span>
            </li>`).join("")}
        </ul>
        <p class="state-foot">Real prompts against real AI engines. Usually 60–90s.</p>
      </div>`;
  }

  function updateLoadingProgress(evt) {
    const sec = $("#scanState");
    if (!sec || sec.hasAttribute("hidden")) return;
    _loadingState.pct = Math.max(_loadingState.pct, evt.pct || 0);
    if (evt.message) _loadingState.message = evt.message;
    if (evt.phase) _loadingState.currentPhase = evt.phase;

    const msgEl = document.getElementById("loaderMsg");
    if (msgEl && _loadingState.message) msgEl.textContent = _loadingState.message;

    const fillEl = document.getElementById("scanProgressFill");
    if (fillEl) fillEl.style.width = `${Math.min(100, _loadingState.pct)}%`;

    // Mark steps as done / active based on the current phase.
    const stepsList = document.getElementById("scanSteps");
    if (!stepsList) return;
    const currentIdx = STEPS.findIndex((s) => s.key === _loadingState.currentPhase);
    stepsList.querySelectorAll(".scan-step").forEach((li, i) => {
      li.classList.remove("done", "active");
      if (currentIdx === -1) return;
      if (i < currentIdx) li.classList.add("done");
      else if (i === currentIdx) li.classList.add("active");
    });
  }

  function stopLoading() {
    // No interval to clear — old cycling-message loop is gone.
  }

  // ── LIVE FETCH ────────────────────────────────────────────────────────────
  // Single-solution payload — homepage drives brand inference, solutions=[ONE
  // deep URL] forces a one-solution scan. Optional category/icp overrides.
  async function runLiveScan(parsed, onProgress, overrides) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 180000);  // 180s ceiling
    overrides = overrides || {};
    const catInput = (overrides.category != null ? overrides.category
      : ($("#inputCategory") && $("#inputCategory").value || "")).trim();
    const icpInput = (overrides.icp != null ? overrides.icp
      : ($("#inputIcp") && $("#inputIcp").value || "")).trim();
    const body = { url: parsed.homepage, solutions: [parsed.solution_url] };
    if (catInput) body.category = catInput;
    if (icpInput) body.icp = icpInput;

    let r;
    try {
      r = await fetch(API.url, {
        method: "POST",
        signal: ctl.signal,
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          "X-API-Key": API.key,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      clearTimeout(t);
      throw err;
    }

    if (r.status === 429) { clearTimeout(t); throw new Error("RATE_LIMIT"); }
    if (r.status === 502) { clearTimeout(t); throw new Error("UNREACHABLE"); }
    if (r.status === 422) { clearTimeout(t); throw new Error("NO_SOLUTIONS"); }
    if (!r.ok) { clearTimeout(t); throw new Error(`scan ${r.status}`); }

    // If server fell back to JSON (Accept ignored), handle gracefully.
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("text/event-stream")) {
      clearTimeout(t);
      return await r.json();
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult = null;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop();  // keep last (possibly incomplete) chunk in buffer
        for (const chunk of chunks) {
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            let evt;
            try { evt = JSON.parse(line.slice(6)); } catch (_) { continue; }
            if (evt.phase === "complete") {
              finalResult = evt.result;
            } else if (evt.phase === "error") {
              throw new Error(`scan ${evt.status || 500}: ${evt.detail || "unknown"}`);
            } else if (onProgress) {
              onProgress(evt);
            }
          }
        }
      }
    } finally {
      clearTimeout(t);
    }

    if (!finalResult) throw new Error("scan_no_result");
    return finalResult;
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "scan-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add("show"); }, 10);
    setTimeout(() => { t.classList.remove("show"); }, 3800);
    setTimeout(() => { t.remove(); }, 4200);
  }

  function hostOf(url) {
    try {
      return new URL(/^https?:\/\//.test(url) ? url : "https://" + url).hostname.replace(/^www\./, "");
    } catch (_) {
      return url;
    }
  }

  // ── INPUT VALIDATION ─────────────────────────────────────────────────────
  // A solution URL must be a full http(s) URL with a path beyond the homepage.
  function parseScanInput(rawUrl) {
    let u;
    try {
      u = new URL(rawUrl);
    } catch {
      return { ok: false, error: "Enter a full URL starting with https://" };
    }
    if (!/^https?:$/.test(u.protocol)) {
      return { ok: false, error: "URL must start with http:// or https://" };
    }
    const path = (u.pathname || "/").replace(/\/+$/, "");
    if (path === "" || path === "/" || /^\/(home|index\.?html?)$/i.test(path)) {
      return {
        ok: false,
        error: "Paste a specific solution page URL, not the homepage. Example: https://yoursite.com/solutions/your-product",
      };
    }
    return {
      ok: true,
      solution_url: rawUrl,
      homepage: `${u.protocol}//${u.host}`,
    };
  }

  function showInputError(msg) {
    const el = $("#scanUrlError");
    if (!el) return;
    el.textContent = msg;
    el.removeAttribute("hidden");
  }
  function clearInputError() {
    const el = $("#scanUrlError");
    if (!el) return;
    el.textContent = "";
    el.setAttribute("hidden", "");
  }

  // ── MAIN RENDER (v6 redesign, scoped under .aeo2, built from live data) ────
  const ENGINES2 = [["chatgpt", "ChatGPT"], ["claude", "Claude"], ["gemini", "Gemini"]];
  const CAT_LABELS = {
    crawler_access: ["Can AI read your site?", "Crawler access"],
    structured_data: ["Structured Data", "Schema markup"],
    entity: ["Does AI know who you are?", "Entity and authority"],
    content: ["Answer-ready content", "Extractability"],
  };
  let _modalData = {};   // qid -> {question, byEngine:{engine:{cited,text}}}

  function _leadUrl() {
    return API.url.replace(/\/api\/v1\/.*$/, "/api/v1/aeo-scan/lead");
  }
  function tone(score) { return score >= 70 ? "ok" : score >= 40 ? "warn" : "bad"; }
  // Per-engine tier by cited rate -> [colorClass, label]. Drives the donut color.
  function engTone(cited, total) {
    const r = total ? cited / total : 0;
    if (cited <= 0) return ["bad", "Never mentions you"];
    if (r < 0.4) return ["bad", "Rarely"];
    if (r < 0.75) return ["warn", "Sometimes"];
    return ["ok", "Often"];
  }
  // Colored donut ring for an engine card (cited/total fraction).
  function engineDonut(cited, total, cls) {
    const r = 26, c = 2 * Math.PI * r, frac = total ? Math.max(0, Math.min(1, cited / total)) : 0;
    const dash = c * frac;
    return `<svg viewBox="0 0 64 64" class="edonut ${cls}" aria-hidden="true">
      <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--track)" stroke-width="6"/>
      <circle cx="32" cy="32" r="${r}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/>
      <text x="32" y="32" class="edn" text-anchor="middle" dominant-baseline="central">${cited}/${total}</text></svg>`;
  }
  // Compact gauge used inside the unlock gate card.
  function miniGauge(score, lvl) {
    const off = 100 - Math.max(0, Math.min(100, score));
    return `<div class="mgauge">
      <svg viewBox="0 0 200 120"><path d="M10,100 A90,90 0 0 1 190,100" fill="none" stroke="var(--track)" stroke-width="16" stroke-linecap="round"/>
        <path d="M10,100 A90,90 0 0 1 190,100" fill="none" stroke="url(#aeoG)" stroke-width="16" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${off}"/></svg>
      <div class="mnum"><b class="t-${lvl.cls}">${score}</b><span>/100</span></div>
      <div class="mlvl t-${lvl.cls}">${esc(lvl.label)}, Level ${lvl.n} of 4</div></div>`;
  }
  // Mini pillar donut for the hero: score 0-100 inside a colored ring.
  function pillarDonut(score) {
    const s = Math.max(0, Math.min(100, Number(score) || 0));
    const r = 22, c = 2 * Math.PI * r, dash = c * (s / 100);
    const cls = tone(s);
    return `<svg viewBox="0 0 56 56" class="hpd ${cls}" aria-hidden="true">
      <circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--track)" stroke-width="5"/>
      <circle cx="28" cy="28" r="${r}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"
              stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 28 28)"/>
      <text x="28" y="28" class="hpn" text-anchor="middle" dominant-baseline="central">${s}</text></svg>`;
  }
  function heroPillarsHtml(checks) {
    if (!checks || !checks.length) return "";
    // Each pillar links down to its group in the Content Authority Audit, so the
    // top-line score connects to the actual passed/failed checks behind it.
    const cells = checks.map((c) => {
      const [name] = CAT_LABELS[c.key] || [c.name || c.key];
      const subs = c.subchecks || [];
      const pass = subs.filter((s) => s.status === "pass").length;
      return `<a class="hpill" href="#cat-${esc(c.key)}">${pillarDonut(c.score)}
        <div class="hpname">${esc(name)}</div>
        <div class="hpratio">${pass}/${subs.length} checks</div></a>`;
    }).join("");
    return `<div class="hero-pillars">${cells}</div>`;
  }
  function detectBoxHtml(category, icp) {
    return `<div class="sec2"><div class="detectbox">
      <div class="db-h">What we tested you for</div>
      <div class="detected">We checked how AI answers when buyers search for <b id="detCat">${esc(category)}</b> (for <b id="detIcp">${esc(icp)}</b>). Not what you want to rank for? <span class="link2" id="refineLink">Refine</span></div>
      <div class="refine-form" id="refineForm">
        <input id="catIn" value="${esc(category)}" placeholder="Category">
        <input id="icpIn" value="${esc(icp)}" placeholder="Ideal customer (ICP)">
        <button class="btn-sm" id="rescanBtn">Re-scan</button>
      </div>
    </div></div>`;
  }
  function mergeResources(a, b) {
    const out = [], seen = new Set();
    for (const r of [...(a || []), ...(b || [])]) {
      if (!r || !r.url || seen.has(r.url)) continue;
      seen.add(r.url); out.push(r);
    }
    return out;
  }
  let _lastData = null;   // stashed scan response for the "unlock -> full report" redirect

  // ===== Pillar B: AI source mix (from the engine responses we already collect) =====
  const AUTHORITY_DOMAINS = ["wikipedia.org", "reddit.com", "linkedin.com", "youtube.com",
    "g2.com", "capterra.com", "trustpilot.com", "trustradius.com", "clutch.co", "gartner.com",
    "forbes.com", "github.com", "medium.com", "quora.com", "producthunt.com", "techcrunch.com"];
  const POS_WORDS = ["best", "leading", "top", "trusted", "recommended", "popular", "strong", "excellent", "reliable", "proven", "preferred", "standout", "robust"];
  const NEG_WORDS = ["lacks", "limited", "expensive", "weak", "outdated", "avoid", "worse", "drawback", "downside", "poor", "clunky", "confusing"];
  const INTENT_WEIGHT = { Comparative: 3, Evaluative: 2, Question: 1 };

  function _hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch (_) { return ""; } }
  function _isAuthority(h) { return AUTHORITY_DOMAINS.some((d) => h === d || h.endsWith("." + d)); }
  function _ck(key, name, pass, goal, ok, bad) {
    return pass ? { key, name, status: "pass", goal, result: ok } : { key, name, status: "fail", goal, issue: bad };
  }

  function buildCitationFootprint(ev, brand, compStats) {
    const runs = (ev && ev.runs) || [];
    if (!runs.length) return null;
    const brandL = (brand || "").toLowerCase();
    const compNames = (compStats || []).map((c) => (c.name || "").toLowerCase()).filter(Boolean);
    const distinctAuth = new Set(); let authorityHits = 0;
    runs.forEach((r) => (r.sources || []).forEach((u) => {
      const h = _hostOf(u); if (h && _isAuthority(h)) { distinctAuth.add(h); authorityHits++; }
    }));
    let brandM = 0, compM = 0;
    runs.forEach((r) => {
      const t = (r.raw_response || "").toLowerCase();
      if (brandL && t.includes(brandL)) brandM++;
      compNames.forEach((c) => { if (t.includes(c)) compM++; });
    });
    const sov = (brandM + compM) ? Math.round((brandM / (brandM + compM)) * 100) : 0;
    let pos = 0, neg = 0;
    runs.forEach((r) => {
      const t = (r.raw_response || "").toLowerCase();
      if (!brandL || !t.includes(brandL)) return;
      const i = t.indexOf(brandL), win = t.slice(Math.max(0, i - 160), i + 160);
      if (POS_WORDS.some((w) => win.includes(w))) pos++;
      if (NEG_WORDS.some((w) => win.includes(w))) neg++;
    });
    const sentiment = neg > pos ? "negative" : (pos > 0 ? "positive" : "neutral");
    const auth = [...distinctAuth];
    const subs = [
      _ck("authority_sources", "AI pulls from authority sources", auth.length >= 2,
        "Be present where AI looks: high-trust domains (Wikipedia, Reddit, G2, LinkedIn).",
        `Answers in your space cite ${auth.length} authority domains (${auth.slice(0, 4).join(", ")}).`,
        `AI answers cite few high-trust sources (${auth.length}). Earning placements there lifts citations.`),
      _ck("share_of_voice", "Share of voice vs competitors", sov >= 25,
        "Win a meaningful slice of the brand mentions in AI answers.",
        `You hold ${sov}% share of voice (you ${brandM}, competitors ${compM}).`,
        `Low share of voice (${sov}%): competitors named ${compM} times to your ${brandM}.`),
      _ck("sentiment", "Positive brand sentiment", sentiment !== "negative",
        "Be described positively when AI mentions you.",
        `Brand sentiment in answers reads ${sentiment}.`,
        `Brand sentiment reads negative; the framing around your name is unfavorable.`),
      _ck("source_mix", "Third-party sources vouch for you", authorityHits > 0,
        "Get cited by third-party/editorial sources, not just your own site.",
        `Answers reference ${authorityHits} third-party/authority sources.`,
        `Answers lean on owned/thin sources; little third-party validation.`),
    ];
    const pass = subs.filter((s) => s.status === "pass").length;
    return { key: "citation_footprint", name: "AI source mix", score: Math.round((pass / subs.length) * 100), subchecks: subs };
  }

  // ===== Boss Baseline sections (full report), all from the scan response =====
  // One row per LOST question: the engines that did NOT name you (but named a
  // rival), plus the union of rivals recommended instead. Scans every
  // (engine, question) answer where you were absent + a rival appeared, then
  // aggregates by question -- so we still catch per-engine gaps the old
  // per-prompt version hid, without exploding into 16-24 rows.
  function buildCitationGaps(ev, compStats) {
    const prompts = (ev && ev.prompts) || [], runs = (ev && ev.runs) || [];
    const names = (compStats || []).map((c) => c.name).filter(Boolean);
    const engOrder = {}, engLabel = {};
    ENGINES2.forEach(([k, lbl], i) => { engOrder[k] = i; engLabel[k] = lbl; });
    const pOrder = {}, pById = {};
    prompts.forEach((p, i) => { pOrder[p.id] = i; pById[p.id] = p; });
    const byQ = {};
    runs.forEach((r) => {
      if (r.mentioned || !(r.engine in engLabel)) return; // you were named, or off-report engine
      const p = pById[r.prompt_id]; if (!p) return;
      const text = (r.raw_response || "").toLowerCase();
      const wins = names.filter((n) => n && text.includes(n.toLowerCase()));
      if (!wins.length) return;
      const g = byQ[r.prompt_id] || (byQ[r.prompt_id] = { q: p.prompt, _o: pOrder[r.prompt_id], _eng: [], rivals: [] });
      g._eng.push({ label: engLabel[r.engine], o: engOrder[r.engine] });
      wins.forEach((w) => { if (!g.rivals.includes(w)) g.rivals.push(w); });
    });
    const out = Object.keys(byQ).map((k) => byQ[k]);
    out.forEach((g) => {
      g._eng.sort((a, b) => a.o - b.o);
      g.engines = g._eng.map((e) => e.label);
    });
    out.sort((a, b) => a._o - b._o);
    return out;
  }
  function citationGapHtml(ev, compStats, num) {
    const g = buildCitationGaps(ev, compStats);
    // Always render the section (keeps section numbering + sidebar link valid);
    // an empty gap list gets a positive empty-state instead of disappearing.
    const RIVAL_CAP = 5;
    const rows = g.map((x) => {
      const miss = x.engines.map((e) => `<span class="miss-eng">${esc(e)}</span>`).join("");
      const shown = x.rivals.slice(0, RIVAL_CAP).map((w) => `<span class="chip sm">${esc(w)}</span>`).join(" ");
      const more = x.rivals.length > RIVAL_CAP ? ` <span class="gapmore">+${x.rivals.length - RIVAL_CAP} more</span>` : "";
      return `<tr><td class="q">${esc(x.q)}</td><td class="gmiss">${miss}</td><td>${shown}${more}</td></tr>`;
    }).join("");
    const body = g.length
      ? `<div class="matrix"><table class="mx"><thead><tr><th class="q">Buyer question</th><th class="lcol">Missed on</th><th class="lcol">AI recommended instead</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="gap-empty">No citation gaps found. Wherever a competitor gets cited, you do too.</div>`;
    return `<div class="sec2"><h2 id="sec-gap">${secNum(num)}Questions where rivals are named and you're not</h2><p class="sc-sub">Where AI recommends a competitor instead of you, and who.</p>
      ${body}</div>`;
  }
  function queryMapHtml(ev, num) {
    const prompts = (ev && ev.prompts) || [], runs = (ev && ev.runs) || [];
    if (!prompts.length) return "";
    const cited = {}; runs.forEach((r) => { if (r.mentioned) cited[r.prompt_id] = true; });
    const rows = prompts.map((p) => ({ q: p.prompt, intent: p.intent || "Question", won: !!cited[p.id], w: (cited[p.id] ? 0 : 10) + (INTENT_WEIGHT[p.intent] || 1) }))
      .sort((a, b) => b.w - a.w)
      .map((x) => `<tr><td class="q">${esc(x.q)}</td><td><span class="chip sm">${esc(x.intent)}</span></td><td class="cell"><span class="cdot ${x.won ? "yes" : "no"}"></span></td></tr>`).join("");
    return `<div class="sec2"><h2 id="sec-query">${secNum(num)}Buyer questions to win first</h2><p class="sc-sub">Your highest-value questions, ranked by how much they matter.</p>
      <div class="matrix"><table class="mx"><thead><tr><th class="q">Question</th><th>Intent</th><th>You</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  function benchmarkHtml(citedCells, totalCells, brand, compStats, num, bare) {
    const you = { name: brand, count: citedCells, you: true };
    const rivals = (compStats || []).map((c) => ({ name: c.name, count: c.count }));
    const rows = [you, ...rivals].sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...rows.map((r) => r.count));
    const bars = rows.map((r) => `<div class="bmrow ${r.you ? "you" : ""}"><span class="bmname">${esc(r.name)}</span><span class="bmbar"><i style="width:${Math.round((r.count / max) * 100)}%"></i></span><span class="bmnum">${r.count}</span></div>`).join("");
    // bare: just the label + ranked bars, for embedding inside recommendsHtml.
    // The brand itself is row 0 of the sort and gets .bmrow.you (gradient bar +
    // bold name) so YOU are highlighted in the field, not the leader.
    if (bare) return `<div class="mx-label">Every brand AI recommends, by mention count</div><div class="comp">${bars}</div>`;
    return `<div class="sec2"><h2 id="sec-benchmark">${secNum(num)}Where you rank against competitors</h2>
      <p class="sc-sub">Every brand ranked by how many of the ${totalCells} AI answers named it.</p>
      <div class="comp">${bars}</div></div>`;
  }
  // Share of Answer. Uses the SAME per-answer counts as the Competitor Benchmark
  // (your citedCells + each rival's compStats.count) so the two sections can never
  // disagree on who is #1. Leads with RANK (not the raw share %) + a stacked share
  // bar, because share-of-voice in a crowded field is naturally low for the leader
  // -- being the biggest slice of 15 brands still reads as ~17%, which looks bad
  // as a bare number but is clearly winning as a ranked bar.
  function shareOfAnswerHtml(ev, brand, compStats, num, citedCells, bare) {
    const runs = (ev && ev.runs) || [];
    if (!runs.length) return "";
    const stats = (compStats || []).filter((s) => s && s.name);
    const mine = Number.isFinite(citedCells) ? citedCells : 0;
    const entries = [{ name: brand, count: mine, you: true },
                     ...stats.map((s) => ({ name: s.name, count: s.count || 0 }))]
                    .filter((e) => e.count > 0)
                    .sort((a, b) => b.count - a.count);
    const total = entries.reduce((n, e) => n + e.count, 0);
    if (!total) return "";
    const pct = (k) => Math.round(k / total * 100);
    const sov = pct(mine);
    const rank = 1 + stats.filter((s) => (s.count || 0) > mine).length;
    const nBrands = stats.length + 1;
    const cls = rank === 1 ? "ok" : rank <= 3 ? "warn" : "bad";
    const TOP = 6;
    const shown = entries.slice(0, TOP);
    const otherCount = entries.slice(TOP).reduce((n, e) => n + e.count, 0);
    // Pie ("pizza") of share of AI recommendations. YOU = vivid brand magenta so
    // you pop even as a thin slice; rivals = muted grey ramp; leftover = darkest.
    // The SAME conic stops drive both the pie and the legend swatches so they match.
    const YOU = "#c109af";
    const RAMP = ["#8b8794", "#6f6b79", "#56525f", "#403d48", "#2e2c34", "#211f2a"];
    const OTHER = "#1b1922";
    let ri = 0;
    let acc = 0;
    const stops = [];
    const slices = [];
    shown.forEach((e) => {
      const color = e.you ? YOU : RAMP[ri++ % RAMP.length];
      const p = e.count / total * 100;
      stops.push(`${color} ${acc.toFixed(2)}% ${(acc + p).toFixed(2)}%`);
      acc += p;
      slices.push({ name: e.name, count: e.count, color, you: e.you });
    });
    if (otherCount) {
      stops.push(`${OTHER} ${acc.toFixed(2)}% 100%`);
      slices.push({ name: "Others", count: otherCount, color: OTHER, you: false });
    }
    const pie = `<div class="soapie" style="background:conic-gradient(${stops.join(",")})" role="img" aria-label="Share of AI recommendations"></div>`;
    const legend = slices.map((s) =>
      `<span class="soaleg ${s.you ? "you" : ""}" title="${esc(s.name)}: named in ${s.count} of ${total} (${pct(s.count)}%)"><i style="background:${s.color}"></i>${esc(s.name)} ${pct(s.count)}%</span>`
    ).join("");
    const runnerUp = entries[0] && entries[0].you ? entries[1] : null;
    const leader = entries[0];
    const lead = rank === 1
      ? `You own the largest share of AI answers: <b>${sov}%</b> of every brand AI named${runnerUp ? `, ahead of ${esc(runnerUp.name)} at ${pct(runnerUp.count)}%` : ""}.`
      : `You hold <b>${sov}%</b> of every brand AI named. ${esc(leader.name)} leads at ${pct(leader.count)}%.`;
    const inner = `<div class="comp">
        <div class="soa"><div class="soa-num t-${cls}">#${rank}<span class="soa-of">of ${nBrands}</span></div>
          <div class="soa-txt">${lead}</div></div>
        <div class="soa-chart">${pie}<div class="soalegend">${legend}</div></div>
      </div>`;
    if (bare) return inner;
    return `<div class="sec2"><h2 id="sec-share">${secNum(num)}Your Share of AI Recommendations</h2>
      <p class="sc-sub">Your slice of every brand AI named across your ${stats.length} competitors.</p>
      ${inner}</div>`;
  }
  // "Get Your AEO Baseline" summary - the 6 named elements from the boss mockup.
  // The "Get Your AEO Baseline" section is now a floating, clickable section
  // sidebar (jump nav). Each link scrolls to its report section; the active
  // section is highlighted via an IntersectionObserver wired in wireBaselineNav.
  // Floating jump nav. `items` come from renderFullReport's section registry as
  // [{ t: label, h: "#sec-id", n: "01" }, ...] so the sidebar numbering and order
  // always mirror the actual rendered sections.
  function baselineSidebarHtml(items) {
    const links = (items || []).map((it) =>
      `<a class="bsl-link" href="${it.h}" data-target="${it.h}"><span class="bsl-ln">${esc(it.n)}</span><span class="bsl-lt">${esc(it.t)}</span></a>`).join("");
    return `<nav class="bsl-nav" id="bslNav" aria-label="Report sections">
      <div class="bsl-nav-h">Your<br>AEO Baseline</div>
      <div class="bsl-links">${links}</div>
    </nav>`;
  }

  // Big page title for the full report: "AEO Baseline report" + "for {url}".
  function frHeadHtml(url, brand) {
    const u = esc(url || brand || "your solution");
    const link = url
      ? `<a href="${esc(url)}" target="_blank" rel="noopener">${u}</a>`
      : `<b>${u}</b>`;
    return `<div class="fr-head"><h1 class="fr-title">AEO Baseline report</h1>
      <div class="fr-for">for ${link}</div></div>`;
  }

  // Section-number badge. The two-digit number MUST match this section's slot in
  // the floating sidebar (baselineSidebarHtml items order). Full report only.
  function secNum(n) {
    return n ? `<span class="secn">${esc(String(n))}</span>` : "";
  }

  // Register the new pillar labels + check guides (mutate the existing maps).
  Object.assign(CAT_LABELS, {
    content_geo: ["Answer-ready content", "Content extractability"],
    citation_footprint: ["Where AI gets answers", "AI source mix"],
    // Kevin's 4 levers (the shared Baseline + Genie vocabulary). The audit + hero
    // donuts regroup the granular subchecks into these for display.
    grounding_pages: ["Grounding Pages", "Authoritative content"],
    corroboration: ["Corroboration", "Off-site verification"],
    prominence: ["Prominence", "How often AI surfaces you"],
  });

  // Map every subcheck key -> one of Kevin's 4 levers (phase order: grounding ->
  // corroboration -> prominence). structured_data reused as the lever key.
  // Off-site first (Kevin: off-site ~90%). Vanity Structured Data last so the report
  // leads with the real drivers, not a flattering 90 that hides the problem.
  const LEVERS = [
    { key: "prominence", name: "Prominence",
      subKeys: ["share_of_voice", "sentiment"] },
    { key: "corroboration", name: "Corroboration",
      subKeys: ["wikidata", "sameas", "authority_sources", "source_mix"] },
    { key: "grounding_pages", name: "Grounding Pages",
      subKeys: ["answer_first", "atomic_paragraphs", "question_headings", "faq_schema",
                "stats_density", "citations_quotes", "lists_tables", "heading_hierarchy",
                "readability", "def_comparison", "freshness", "authors"] },
    { key: "structured_data", name: "Structured Data",
      subKeys: ["organization_schema", "page_schema", "jsonld_coverage",
                "ai_crawlers", "robots_ai", "ssr", "llms_txt"] },
  ];
  const SUBCHECK_LEVER = {};
  LEVERS.forEach((lv) => lv.subKeys.forEach((k) => { SUBCHECK_LEVER[k] = lv.key; }));

  // Regroup the backend's granular pillar cards into 4 lever cards (same shape as
  // a pillar card: {key, name, score, subchecks}) so heroPillarsHtml/scorecardHtml/
  // subCard render them unchanged. Prominence score = the AEO visibility rate.
  function toLevers(checks, rate) {
    const bucket = {};
    LEVERS.forEach((lv) => { bucket[lv.key] = []; });
    (checks || []).forEach((c) => (c.subchecks || []).forEach((s) => {
      const lk = SUBCHECK_LEVER[s.key];
      if (lk) bucket[lk].push(s);
      else { bucket.grounding_pages.push(s); try { console.warn("unmapped subcheck:", s.key); } catch (_) {} }
    }));
    return LEVERS.map((lv) => {
      const subs = bucket[lv.key];
      const pass = subs.filter((s) => s.status === "pass").length;
      const score = lv.key === "prominence"
        ? Math.round((rate || 0) * 100)
        : (subs.length ? Math.round((pass / subs.length) * 100) : 0);
      return { key: lv.key, name: lv.name, score, subchecks: subs };
    }).filter((lv) => lv.subchecks.length || lv.key === "prominence");
  }
  Object.assign(CHECK_GUIDE, {
    authority_sources: { how_to: "Earn placements on the domains AI answer engines cite most for B2B: get listed/reviewed on G2, Capterra and TrustRadius; build an authoritative Wikipedia/Wikidata entity; participate in relevant Reddit and LinkedIn discussions; and publish to YouTube. AI engines disproportionately cite Reddit, YouTube, LinkedIn and review platforms, so a presence there is a direct path into generated answers in your category.", resources: [{ label: "Search Engine Land - AI search engines cite Reddit, YouTube and LinkedIn most", url: "https://searchengineland.com/ai-search-engines-cite-reddit-youtube-and-linkedin-most-study-473138" }, { label: "Peec AI - Top domains cited by AI search (30M sources)", url: "https://peec.ai/blog/top-domains-cited-by-ai-search-analysis-based-on-30m-sources" }] },
    share_of_voice: { how_to: "Share of voice is your brand mentions divided by all brand mentions (you + competitors) across the AI answers. Lift it by winning the buyer-intent prompts where competitors currently dominate: publish comparison and best-X-for-Y assets, strengthen the on-page answer-ready content for those queries, and earn third-party citations on the sources those answers pull from.", resources: [{ label: "HubSpot AEO Grader - Share of Voice", url: "https://www.hubspot.com/aeo-grader/share-of-voice" }] },
    sentiment: { how_to: "When AI describes your brand unfavorably it usually echoes negative third-party content (reviews, forum threads, comparison posts). Audit what the engines cite around your name, address the substantive complaints, refresh outdated third-party pages where possible, and publish strong first-party proof (case studies, outcomes, named customers) so engines have positive, quotable material to synthesize.", resources: [{ label: "HubSpot AEO Grader - Brand Sentiment", url: "https://www.hubspot.com/aeo-grader/brand-sentiment-analysis" }] },
    source_mix: { how_to: "When answers cite only your own site (or thin sources), engines have little independent validation of your claims. Build third-party citations: directory/review profiles, partner and integration pages, guest articles, podcast/press mentions, and Wikipedia. A healthy mix of owned + independent sources is what makes an engine confident enough to recommend you.", resources: [{ label: "Discovered Labs - AEO performance metrics & citations", url: "https://discoveredlabs.com/blog/aeo-performance-metrics-what-to-measure-and-how-to-track-ai-citations" }] },
    stats_density: { how_to: "Add concrete, quotable statistics to the page body: percentages, dollar figures, multipliers ('3x faster'), and year-stamped data points, ideally tied to your own outcomes or cited research. The Princeton GEO study found adding statistics was the single strongest content lever, raising a source's visibility in generated answers by ~30-40%, because LLMs preferentially quote concrete numbers as the evidence line of an answer.", resources: [{ label: "Princeton - GEO: Generative Engine Optimization (paper)", url: "https://arxiv.org/abs/2311.09735" }, { label: "GEO paper, plain English", url: "https://derivatex.agency/blog/princeton-geo-paper-plain-english/" }] },
    citations_quotes: { how_to: "Attribute claims to credible sources and include at least one expert quote with a name/title; link out to primary sources (research, .gov/.edu/.org, vendor docs). In the GEO study, adding citations and quotations each lifted visibility ~30-40% (up to ~100%+ for lower-ranked pages) because engines treat well-sourced, quotable content as synthesis-ready.", resources: [{ label: "Princeton GEO paper", url: "https://arxiv.org/abs/2311.09735" }, { label: "GEO factors explained", url: "https://www.stackmatix.com/blog/generative-engine-optimization-paper" }] },
    lists_tables: { how_to: "Convert wall-of-text sections into scannable structure: ordered lists for steps/processes, unordered lists for feature/benefit sets, and HTML tables for comparisons and specs. AI engines extract from specific sections and lift lists and tables far more reliably than prose, and pages cited in AI Overviews score materially better on structural formatting.", resources: [{ label: "How to structure content for AEO/GEO", url: "https://pathfinderseo.com/blog/how-to-structure-content-for-aeo-and-geo/" }] },
    heading_hierarchy: { how_to: "Use exactly one H1 (the page title), then a logical H2 > H3 outline with no skipped levels and headings used for structure (not styling). A clean outline lets engines chunk the page into sections and pull the right passage; pages cited in AI Overviews score ~20% better on heading hierarchy and navigation.", resources: [{ label: "Structure content for Google AI Overviews", url: "https://www.serpwizard.com/how-to-structure-content-for-google-ai-overviews-feature/" }] },
    readability: { how_to: "Tune body copy toward clear, self-contained sentences: aim Flesch Reading Ease ~50-70 (grade ~8-12) and average sentence length ~15-25 words. The GEO study's fluency optimization delivered a consistent ~15-30% visibility lift, while naive over-simplification did not, so target the band rather than simpler is better. Short, declarative sentences are the most quotable unit for an answer.", resources: [{ label: "Flesch Reading Ease / Flesch-Kincaid explained", url: "https://readable.com/readability/flesch-reading-ease-flesch-kincaid-grade-level/" }, { label: "Princeton GEO paper", url: "https://arxiv.org/abs/2311.09735" }] },
    def_comparison: { how_to: "Add a crisp definition of your core term/category near the top (X is a ...) and publish comparison assets (X vs Y, best X for [persona]) with a verdict line and a feature table. These map directly to bottom-funnel buyer queries; a brand with no comparison/definition content is structurally absent from what-is-X and X-vs-Y answers regardless of mention rate.", resources: [{ label: "Comparison / vs-page patterns for AEO", url: "https://citevera.com/blog/comparison-pages-aeo-vs-page-patterns" }, { label: "HubSpot - AEO page structure", url: "https://blog.hubspot.com/marketing/aeo-page-structure" }] },
  });

  // "Why this is important" copy per check (full report). This lead magnet shows
  // the user WHAT is wrong and WHY it costs them AI visibility -- it does NOT hand
  // over the fix (that is the paid Blueprint). Keyed by subcheck key; covers the
  // backend pillars (content / structured data / crawler / entity) + the GEO
  // content + AI source-mix checks. No em dashes (esc strips them).
  const CHECK_WHY = {
    // Content & Answers
    answer_first: "AI engines lift the first direct answer they find. When a page opens with brand narrative instead of the answer, the engine grabs a competitor's answer-first page instead of yours.",
    atomic_paragraphs: "Engines quote in small chunks. Long, multi-idea paragraphs are hard to lift cleanly, so your points lose to rivals whose tight paragraphs drop straight into an answer.",
    question_headings: "Engines match page sections to the exact questions buyers ask. Without question-shaped headings, your content is harder to map to a query and gets passed over.",
    faq_schema: "FAQPage schema lets engines extract your Q&A directly. Without it, your answers sit in raw HTML the engine may never parse, while schema-marked competitors get pulled in.",
    // Structured Data
    organization_schema: "Organization schema is your canonical identity block. Without it, engines have no authoritative record of who you are and fall back to whatever third parties say.",
    page_schema: "WebSite and WebPage schema tell engines what each page is. Without it, your pages are harder to classify and trust, weakening how confidently you get cited.",
    jsonld_coverage: "Engines lean on structured data to understand a page. When most pages carry none, large parts of your site are effectively invisible to the machines deciding who to recommend.",
    freshness: "Engines favor content they can tell is current. With no recent dateModified, your pages read as stale and get out-prioritized by fresher competitor pages.",
    // AI Crawler Access
    bot_gptbot: "If GPTBot cannot fetch your pages, ChatGPT has nothing of yours to cite. You are excluded from its answers before the contest even starts.",
    bot_claudebot: "If ClaudeBot cannot reach your site, Claude cannot read or recommend you. You are invisible on that engine no matter how good your content is.",
    bot_perplexitybot: "If PerplexityBot is blocked, Perplexity cannot index or cite you, handing those answers to reachable competitors.",
    bot_google_extended: "Google-Extended controls whether Gemini and AI Overviews can use your content. Blocked, you forfeit visibility across Google's AI surfaces.",
    ai_crawlers: "If GPTBot, ClaudeBot, PerplexityBot or Google-Extended can't reach you, that engine can never cite you. One blocked crawler is one whole engine you're invisible on.",
    robots_ai: "A robots.txt that disallows AI crawlers quietly locks you out of the engines. It is the single fastest way to be absent from every answer.",
    ssr: "AI crawlers often do not run JavaScript. If your content only appears after JS, the engine sees a blank page and has nothing to cite.",
    llms_txt: "llms.txt is a direct map of your key pages for AI agents. Without it, engines have to guess what matters on your site, and often guess wrong.",
    // Entity & Authority
    wikidata: "A Wikidata entity is how engines confirm you are a real, distinct brand. Without one, they fall back to fuzzy name-matching and may confuse or skip you.",
    sameas: "sameAs links bind your brand to its canonical profiles (LinkedIn, Crunchbase, G2). Without them, engines cannot connect the scattered mentions of you into one trusted entity.",
    authors: "Named authors are a core E-E-A-T signal. Anonymous content reads as lower authority, so engines prefer competitors whose expertise is attributable.",
    // Answer-ready content (GEO)
    stats_density: "LLMs quote concrete numbers as the evidence line of an answer. Pages thin on stats give engines nothing to lift, so they synthesize from competitors who supply the figures. Princeton's GEO study found statistics the single strongest content lever (~30-40% lift).",
    citations_quotes: "Engines treat well-sourced, quotable content as synthesis-ready. With few cited claims or expert quotes, your page is harder to trust and excerpt, so it is passed over for pages that are not.",
    lists_tables: "Engines extract from lists and tables far more reliably than prose. Wall-of-text sections are hard to lift, so structured competitors win the placement.",
    heading_hierarchy: "A clean H1, H2, H3 outline lets engines chunk your page and pull the right passage. A messy outline makes your content harder to parse and cite accurately.",
    readability: "Short, self-contained sentences are the most quotable unit of an answer. Dense copy is less likely to be lifted verbatim, costing you placements to clearer-writing rivals.",
    def_comparison: "What-is-X and X-vs-Y are bottom-funnel buyer questions. With no definition or comparison content, you are structurally absent from those answers no matter how often your name appears elsewhere.",
    // AI source mix
    authority_sources: "AI engines pull disproportionately from a few trusted domains (Reddit, YouTube, review sites, Wikipedia). Absent from the sources an engine trusts, it has nothing external to validate you with and recommends the brands that are there.",
    share_of_voice: "Share of voice is how much of the AI conversation you own versus rivals. When competitors dominate the answers buyers read, they become the default shortlist before you are ever considered.",
    sentiment: "AI describes you using the third-party content it finds. Negative or unflattering framing around your name gets repeated into every answer, quietly steering buyers toward rivals.",
    source_mix: "When answers cite only your own site, engines have no independent proof your claims are true. A thin, owned-only source profile reads as unverified, so engines hedge or pick a brand with outside validation.",
  };

  function renderFull(data) {
    stopLoading();
    showResults();
    $("#scanState").setAttribute("hidden", "");
    const report = $("#report");
    report.removeAttribute("hidden");

    const sol = (data.solutions || [])[0] || {};
    const ev = sol.evidence || {};
    const bc = data.brand_context || {};
    const brand = bc.brand || "your brand";
    const category = sol.buyer_category || bc.category || "your category";
    const icp = bc.icp || "B2B buyers";
    const score = Number.isFinite(data.overall_score) ? data.overall_score : 0;
    const lvl = levelText(score);
    const prompts = ev.prompts || [];
    const runs = ev.runs || [];

    // Aggregate runs -> per (engine,prompt) cited + a representative response.
    const cited = {}, resp = {};
    runs.forEach((r) => {
      const k = r.engine + "|" + r.prompt_id;
      if (r.mentioned) cited[k] = true; else if (!(k in cited)) cited[k] = false;
      if (!(k in resp) || r.mentioned) resp[k] = r.raw_response || "";
    });
    const engCount = {};
    ENGINES2.forEach(([k]) => {
      engCount[k] = { cited: prompts.filter((p) => cited[k + "|" + p.id]).length, total: prompts.length };
    });
    const totalCells = prompts.length * ENGINES2.length;
    const citedCells = prompts.reduce((n, p) =>
      n + ENGINES2.filter(([k]) => cited[k + "|" + p.id]).length, 0);
    const comps = (sol.competitors || []).filter(Boolean);
    const compStats = (sol.competitor_stats || []).filter((s) => s && s.name);
    const checks0 = (sol.checks || []).filter((c) => c.key !== "ai_citations");
    const cf = buildCitationFootprint(ev, brand, compStats);
    const checks = cf ? [...checks0, cf] : checks0;

    _modalData = {};
    prompts.forEach((p) => {
      _modalData[p.id] = { question: p.prompt, byEngine: {} };
      ENGINES2.forEach(([k]) => {
        _modalData[p.id].byEngine[k] = { cited: !!cited[k + "|" + p.id], text: resp[k + "|" + p.id] || "" };
      });
    });

    const scannedUrl = sol.url || data.url || "";
    // Verdict tiers by ACTUAL mention rate (not a binary cited==0 check). The old
    // version said "competitors, not you" for ANY citation > 0, which contradicted
    // the rate shown right below (e.g. 33% cited still read as "not recommended").
    const rate = totalCells ? citedCells / totalCells : 0;
    const b = esc(brand), c = esc(category);
    let verdict;
    if (rate === 0)
      verdict = `AI engines <span class="hl">never recommend ${b}</span> when buyers search for ${c}. Your competitors get every spot.`;
    else if (rate < 0.25)
      verdict = `AI engines <span class="hl">rarely recommend ${b}</span> for ${c}. Competitors dominate the answers.`;
    else if (rate < 0.50)
      verdict = `AI <span class="hl">sometimes recommends ${b}</span> for ${c}, but competitors still win most answers.`;
    else if (rate < 0.80)
      verdict = `AI engines <span class="good">often recommend ${b}</span> for ${c}. You're a frequent pick, with room to lead.`;
    else
      verdict = `AI engines <span class="good">consistently recommend ${b}</span> for ${c}. You own this conversation.`;

    _lastData = data;
    const allGreen = score >= 75 && rate >= 0.8;
    injectAeoStyles();
    const leverChecks = toLevers(checks, rate);
    report.innerHTML =
      `<div class="aeo2">` +
        heroHtml(score, lvl, verdict, citedCells, totalCells, scannedUrl, category, icp, leverChecks) +
        detectBoxHtml(category, icp) +
        (allGreen ? allGreenHtml(brand) : "") +
        (comps.length ? compHtml(comps, brand, compStats, true, undefined, category, false, citedCells) : "") +
        engineHtml(engCount) +
        matrixHtml(prompts, cited, false) +
        scorecardHtml(leverChecks, true, true) +
        nextStepHtml() +
      `</div>`;
    wireAeo(brand);
  }

  // Full report (report.html). Same data, fully expanded, ungated.
  // Problems only: the "how to fix" is stripped (reserved for the Blueprint).
  function renderFullReport(data) {
    const sol = (data.solutions || [])[0] || {};
    const ev = sol.evidence || {};
    const bc = data.brand_context || {};
    const brand = bc.brand || "your brand";
    const category = sol.buyer_category || bc.category || "your category";
    const icp = bc.icp || "B2B buyers";
    const score = Number.isFinite(data.overall_score) ? data.overall_score : 0;
    const lvl = levelText(score);
    const prompts = ev.prompts || [];
    const runs = ev.runs || [];
    const cited = {}, resp = {};
    runs.forEach((r) => {
      const k = r.engine + "|" + r.prompt_id;
      if (r.mentioned) cited[k] = true; else if (!(k in cited)) cited[k] = false;
      if (!(k in resp) || r.mentioned) resp[k] = r.raw_response || "";
    });
    const engCount = {};
    ENGINES2.forEach(([k]) => {
      engCount[k] = { cited: prompts.filter((p) => cited[k + "|" + p.id]).length, total: prompts.length };
    });
    const totalCells = prompts.length * ENGINES2.length;
    const citedCells = prompts.reduce((n, p) =>
      n + ENGINES2.filter(([k]) => cited[k + "|" + p.id]).length, 0);
    const rate = totalCells ? citedCells / totalCells : 0;
    const comps = (sol.competitors || []).filter(Boolean);
    const compStats = (sol.competitor_stats || []).filter((s) => s && s.name);
    const checks0 = (sol.checks || []).filter((c) => c.key !== "ai_citations");
    const cf = buildCitationFootprint(ev, brand, compStats);
    const checks = cf ? [...checks0, cf] : checks0;
    _modalData = {};
    prompts.forEach((p) => {
      _modalData[p.id] = { question: p.prompt, byEngine: {} };
      ENGINES2.forEach(([k]) => {
        _modalData[p.id].byEngine[k] = { cited: !!cited[k + "|" + p.id], text: resp[k + "|" + p.id] || "" };
      });
    });
    const scannedUrl = sol.url || data.url || "";
    const b = esc(brand), c = esc(category);
    let verdict;
    if (rate === 0) verdict = `AI engines <span class="hl">never recommend ${b}</span> when buyers search for ${c}. Your competitors get every spot.`;
    else if (rate < 0.25) verdict = `AI engines <span class="hl">rarely recommend ${b}</span> for ${c}. Competitors dominate the answers.`;
    else if (rate < 0.50) verdict = `AI <span class="hl">sometimes recommends ${b}</span> for ${c}, but competitors still win most answers.`;
    else if (rate < 0.80) verdict = `AI engines <span class="good">often recommend ${b}</span> for ${c}. You're a frequent pick, with room to lead.`;
    else verdict = `AI engines <span class="good">consistently recommend ${b}</span> for ${c}. You own this conversation.`;
    const allGreen = score >= 75 && rate >= 0.8;
    injectAeoStyles();
    const host = document.getElementById("report");
    host.removeAttribute("hidden");
    const leverChecks = toLevers(checks, rate);
    // One ordered registry of full-report sections. Filter out empties, number
    // the survivors 01..N in document order, and feed BOTH the body and the
    // floating sidebar from the same list so the numbering can never drift.
    // Shortened + merged per Kevin: platforms+questions are one section, who+share
    // are one, query-map and benchmark dropped, the audit moved to the bottom.
    const defs = [
      { id: "sec-visibility", label: "AEO Visibility Score", on: true,
        render: (n) => heroHtml(score, lvl, verdict, citedCells, totalCells, scannedUrl, category, icp, leverChecks, { hideUrlEyebrow: true, num: n }) },
      { id: "sec-engines", label: "Performance on LLMs", on: true,
        render: (n) => platformsHtml(engCount, prompts, cited, n) },
      { id: "sec-competitors", label: "Who AI recommends", on: comps.length > 0,
        render: (n) => recommendsHtml(comps, brand, compStats, n, category, ev, citedCells, totalCells) },
      { id: "sec-content", label: "Content Authority Audit", on: true,
        render: (n) => scorecardHtml(leverChecks, false, false, n) },
    ];
    const live = defs.filter((d) => d.on);
    live.forEach((d, i) => { d.num = String(i + 1).padStart(2, "0"); });
    const navItems = live.map((d) => ({ t: d.label, h: "#" + d.id, n: d.num }));
    const sec = {};
    live.forEach((d) => { sec[d.id] = d.render(d.num); });
    host.innerHTML =
      `<div class="aeo2">` +
        baselineSidebarHtml(navItems) +
        frHeadHtml(scannedUrl, brand) +
        (sec["sec-visibility"] || "") +
        detectBoxHtml(category, icp) +
        (allGreen ? allGreenHtml(brand) : "") +
        (sec["sec-engines"] || "") +
        (sec["sec-competitors"] || "") +
        (sec["sec-content"] || "") +
        blueprintCtaHtml() +
      `</div>`;
    wireAeo(brand);
    prefetchGenie(data); // warm the Genie moves while the user reads this report
    window.scrollTo({ top: 0 });
  }

  function heroHtml(score, lvl, verdict, citedCells, totalCells, url, category, icp, checks, opts) {
    opts = opts || {};
    // The gauge IS brand visibility: how often you're mentioned across the tracked
    // answers (citedCells / totalCells), the same % as the headline below it.
    const pct = totalCells ? Math.round((citedCells / totalCells) * 100) : 0;
    const off = 100 - Math.max(0, Math.min(100, pct));
    const st = tone(pct); // color by visibility rate
    // Full report (opts.num set): heading + sub sit OUTSIDE the box, like every
    // other section. Preview (no num): keep the centered eyebrow label inside.
    const numbered = !!opts.num;
    const innerLabel = numbered ? "" : `<div class="metric-eyebrow">AEO Visibility Score</div>`;
    const heroBox = `
    <div class="hero"${numbered ? "" : ` id="sec-visibility"`}>
      ${innerLabel}
      <div class="gauge2">
        <svg viewBox="0 0 200 120"><defs><linearGradient id="aeoG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#7612fa"/><stop offset=".5" stop-color="#c109af"/><stop offset="1" stop-color="#ff6221"/>
        </linearGradient></defs>
        <path d="M10,100 A90,90 0 0 1 190,100" fill="none" stroke="var(--track)" stroke-width="16" stroke-linecap="round"/>
        <path class="arc" d="M10,100 A90,90 0 0 1 190,100" fill="none" stroke="url(#aeoG)" stroke-width="16" stroke-linecap="round" pathLength="100" stroke-dasharray="100" style="--off:${off}" stroke-dashoffset="${off}"/></svg>
        <div class="num"><b class="t-${st}">${pct}</b><span class="of">%</span></div>
      </div>
      <h1 class="hverdict">You show up in <b>${citedCells} of ${totalCells}</b> AI answers <span class="hpct">(${pct}%)</span></h1>
      <div class="hsupport">Your AI visibility for <span class="catq">"${esc(category)}"</span>. This is where you stand.</div>
    </div>`;
    if (!numbered) return heroBox;
    return `<div class="sec2"><h2 id="sec-visibility">${secNum(opts.num)}AEO Visibility Score</h2>
      <p class="sc-sub">We asked AI the questions your buyers ask, across ChatGPT, Claude and Gemini.</p>
      ${heroBox}</div>`;
  }
  // gated=true (preview): show the top 3 competitors, blur/lock the rest, + the
  // email box. gated=false (full report): show the whole list.
  function compHtml(comps, brand, stats, gated, num, category, bare, youCount) {
    const ranked = (stats && stats.length) ? stats : null;
    const total = ranked && ranked[0] ? ranked[0].total : 0;
    let list = ranked
      ? ranked.map((s) => ({ name: s.name, count: s.count }))
      : comps.map((c) => ({ name: c, count: null }));
    // Include the assessed brand in the field (highlighted), sorted by count like
    // everyone else. Cap at 10 brands, all visible: no blur chips, no "+N more locked".
    if (youCount != null) {
      list = [{ name: brand, count: youCount, you: true }, ...list]
        .sort((a, b) => (b.count || 0) - (a.count || 0));
    }
    list = list.slice(0, 10);
    const chip = (s) =>
      `<span class="chip${s.you ? " you" : ""}"${s.count != null ? ` title="Named in ${s.count} of ${total} AI answers"` : ""}>${esc(s.name)}${s.count != null && total ? `<b class="cct">${Math.round(s.count / total * 100)}%</b>` : ""}</span>`;
    const chips = list.map((s) => chip(s)).join("");
    const subTxt = total
      ? `Ranked by how many of the ${total} AI answers named each brand.`
      : `Ranked by how often each brand is named in AI answers.`;
    const emailBox = ""; // competitors box removed (Ralph): matrix + audit + bottom gates remain
    const innerComp = `<div class="comp"><div class="chips">${chips}</div>${emailBox}</div>`;
    if (bare) return `<div class="mx-label">Every brand AI recommends, by mention count</div>${innerComp}`;
    const heading = category ? `Who AI recommends for <span class="catq">"${esc(category)}"</span>` : "Who AI recommends";
    return `<div class="sec2"><h2 id="sec-competitors">${secNum(num)}${heading}</h2>
      <p class="sc-sub">${esc(subTxt)}</p>
      ${innerComp}</div>`;
  }
  function engineHtml(engCount, num) {
    const cards = ENGINES2.map(([k, label]) => {
      const c = engCount[k], [cls, v] = engTone(c.cited, c.total);
      return `<div class="eng ${cls}"><div class="ename">${label}</div>
        <div class="edwrap">${engineDonut(c.cited, c.total, cls)}</div>
        <div class="ev2">${v}</div><div class="erate">${c.cited} of ${c.total} questions</div></div>`;
    }).join("");
    return `<div class="sec2"><h2 id="sec-engines">${secNum(num)}Performance on Major LLMs</h2>
      <p class="sc-sub">How many buyer questions each engine recommends you for.</p>
      <div class="engines">${cards}</div></div>`;
  }
  // Merged "Performance + Questions" section (Kevin: the platform scores come from
  // the questions, keep them together). Donuts (summary) + the questions matrix.
  function platformsHtml(engCount, prompts, cited, num) {
    const cards = ENGINES2.map(([k, label]) => {
      const c = engCount[k], [cls, v] = engTone(c.cited, c.total);
      return `<div class="eng ${cls}"><div class="ename">${label}</div>
        <div class="edwrap">${engineDonut(c.cited, c.total, cls)}</div>
        <div class="ev2">${v}</div><div class="erate">${c.cited} of ${c.total} questions</div></div>`;
    }).join("");
    const head = `<tr><th class="q">Question</th><th>ChatGPT</th><th>Claude</th><th>Gemini</th><th></th></tr>`;
    const legend = `<div class="legend"><span><i class="y"></i>Recommended you</span><span><i class="n"></i>Did not mention you</span></div>`;
    const rows = prompts.map((p, i) => matrixRow(p, i, cited)).join("");
    return `<div class="sec2"><h2 id="sec-engines">${secNum(num)}Performance on Major LLMs</h2>
      <p class="sc-sub">We asked AI the questions your buyers ask. Here is how each engine answered, and the exact questions behind it.</p>
      <div class="engines">${cards}</div>
      <div class="mx-label">The questions we asked, across each engine</div>
      <div class="matrix"><table class="mx"><thead>${head}</thead><tbody>${rows}</tbody></table>${legend}</div></div>`;
  }
  // Merged "Who AI recommends + Share" section (Kevin: 3 and 4 are one thing -
  // your share of voice + who is leading).
  function recommendsHtml(comps, brand, compStats, num, category, ev, citedCells, totalCells) {
    const share = shareOfAnswerHtml(ev, brand, compStats, "", citedCells, true);
    // Benchmark bars (you highlighted, in the field) instead of competitor-only
    // chips — the assessed brand must appear, not just rivals.
    const bench = benchmarkHtml(citedCells, totalCells, brand, compStats, "", true);
    const heading = category ? `Who AI recommends for <span class="catq">"${esc(category)}"</span>` : "Who AI recommends";
    return `<div class="sec2"><h2 id="sec-competitors">${secNum(num)}${heading}</h2>
      <p class="sc-sub">Your share of voice, and every brand AI recommends in your space, ranked.</p>
      ${share}${bench}</div>`;
  }
  function matrixRow(p, i, cited) {
    const dots = ENGINES2.map(([k]) =>
      `<td class="cell"><span class="cdot ${cited[k + "|" + p.id] ? "yes" : "no"}"></span></td>`).join("");
    return `<tr><td class="q">${esc(p.prompt)}</td>${dots}<td class="cell"><span class="link2 viewresp" data-q="${esc(p.id)}">View response</span></td></tr>`;
  }
  // full=true renders every row ungated (full report). Preview shows 4 + a blurred teaser.
  function matrixHtml(prompts, cited, full, num) {
    const head = `<tr><th class="q">Question</th><th>ChatGPT</th><th>Claude</th><th>Gemini</th><th></th></tr>`;
    const legend = `<div class="legend"><span><i class="y"></i>Recommended you</span><span><i class="n"></i>Did not mention you</span></div>`;
    if (full) {
      const rows = prompts.map((p, i) => matrixRow(p, i, cited)).join("");
      return `<div class="sec2"><h2 id="sec-questions">${secNum(num)}Questions your customers ask AI</h2>
        <p class="sc-sub">Every buyer prompt we ran, and which engines named you.</p>
        <div class="matrix"><table class="mx"><thead>${head}</thead><tbody>${rows}</tbody></table>
        ${legend}</div></div>`;
    }
    const open = prompts.slice(0, 4).map((p, i) => matrixRow(p, i, cited)).join("");
    const rest = prompts.slice(4);
    const restBody = rest.length ? `<tbody class="locked blur open">${rest.map((p, i) => matrixRow(p, i, cited)).join("")}</tbody>` : "";
    const reveal = `<div class="mx-gate">
      <p>Enter your email to unlock the full report</p>
      <div class="mx-grow"><input id="matrixEmail" type="email" placeholder="you@company.com">
      <button class="btn-fill" id="matrixRevealBtn">Unlock full details</button></div></div>`;
    return `<div class="sec2"><h2>Questions your customers ask AI</h2>
      <div class="matrix"><table class="mx"><thead>${head}</thead><tbody>${open}</tbody>${restBody}</table>
      ${legend}${reveal}</div></div>`;
  }
  // stripFix=true (full report): show the Issue only, hide "how to fix" (the fix is
  // the Blueprint). Each fail gets a Blueprint hook instead.
  function subCard(s, stripFix) {
    const pass = s.status === "pass";
    const guide = CHECK_GUIDE[s.key] || null;
    let body;
    if (pass) {
      body = s.result ? `<div class="lbl">Result</div><div>${esc(s.result)}</div>` : "";
    } else {
      const issue = s.issue ? `<div class="lbl issue">Issue</div><div class="issue">${esc(s.issue)}</div>` : "";
      // Show WHY it matters, never HOW to fix it (the fix is the paid Blueprint).
      const whyTxt = CHECK_WHY[s.key] || (guide && guide.why) || s.why_it_matters;
      const why = whyTxt ? `<div class="lbl">Why this is important</div><div>${esc(whyTxt)}</div>` : "";
      body = issue + why;
    }
    const resList = mergeResources(guide ? guide.resources : [], s.resources);
    const res = resList.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)}</a>`).join("");
    return `<div class="ccard ${pass ? "" : "fail"}"><div class="chead"><span class="cicon ${pass ? "ok" : "bad"}">${pass ? "✓" : "✕"}</span>
      <span class="cname">${esc(s.name || s.key)}${s.goal ? `<small>${esc(s.goal)}</small>` : ""}</span><span class="chev">▾</span></div>
      <div class="cbody">${body}${res ? `<div class="lbl">Resources</div><div class="res">${res}</div>` : ""}</div></div>`;
  }
  // gated=true (preview): pillar headers stay readable, the check cards are
  // blurred/locked, + an email unlock. gated=false (full report): open + expandable.
  function scorecardHtml(checks, gated, stripFix, num) {
    if (!checks.length) return "";
    // Preview: ONE concise card — pillar name + score per row, then the unlock.
    if (gated) {
      const rows = checks.map((c) => {
        const [name] = CAT_LABELS[c.key] || [c.name || c.key];
        const subs = c.subchecks || [];
        const pass = subs.filter((s) => s.status === "pass").length;
        const tease = subs.map((s) => s.name || s.key).filter(Boolean).join("  ·  ");
        return `<div class="pillitem" id="cat-${esc(c.key)}">
          <div class="pillrow"><span class="pillname">${esc(name)}</span>
            <span class="cgf ${tone(c.score)}">${pass}/${subs.length}</span></div>
          ${tease ? `<div class="pilltease blur">${esc(tease)}</div>` : ""}
        </div>`;
      }).join("");
      return `<div class="sec2"><div class="scgate">
        <h2>Content Authority Audit</h2>
        <p class="sc-sub">The pillars AI graded you on. Unlock to see every check and exactly where you are missing.</p>
        ${heroPillarsHtml(checks)}
        <div class="pillrows">${rows}</div>
        <div class="mx-grow"><input id="scoreEmail" type="email" placeholder="you@company.com">
          <button class="btn-fill" id="scoreUnlockBtn">Unlock full details</button></div>
      </div></div>`;
    }
    // Full report: open, expandable accordions.
    const groups = checks.map((c) => {
      const [name] = CAT_LABELS[c.key] || [c.name || c.key];
      const subs = c.subchecks || [];
      const pass = subs.filter((s) => s.status === "pass").length;
      // Failures first: the user came to see what's broken, not scroll past passes.
      const ordered = [...subs].sort((a, b) => (a.status === "pass" ? 1 : 0) - (b.status === "pass" ? 1 : 0));
      return `<div class="cgroup" id="cat-${esc(c.key)}"><div class="cgh"><span class="cgn">${esc(name)}</span>
        <span class="cgf ${tone(c.score)}">${pass}/${subs.length}</span></div>
        <div class="cards2">${ordered.map((s) => subCard(s, stripFix)).join("")}</div></div>`;
    }).join("");
    return `<div class="sec2"><h2 id="sec-content">${secNum(num)}Content Authority Audit</h2>
      <p class="sc-sub">Where your pages fall short of what AI answer engines trust.</p>${heroPillarsHtml(checks)}${groups}</div>`;
  }
  // Unlock gate card (replaces the open scorecard in the preview).
  function gateCardHtml(score, lvl) {
    return `<div class="sec2"><div class="gatecard">
      <div class="gc-left">${miniGauge(score, lvl)}</div>
      <div class="gc-right">
        <h3>Do you want to unlock the full baseline details?</h3>
        <p>See every buyer question, which competitors AI recommends instead, and exactly where you are missing.</p>
        <div class="gc-form">
          <input id="gateEmail" type="email" placeholder="you@company.com">
          <button class="btn-fill lock" id="gateBtn"><span class="lk">&#128274;</span> Yes, unlock full details</button>
        </div>
        <p class="gc-fine">We will email your full report. No spam.</p>
      </div></div></div>`;
  }
  // Shown when a solution scores well across the board (all-green handler).
  function allGreenHtml(brand) {
    return `<div class="sec2"><div class="allgreen">
      <div class="ag-badge">&#10003;</div>
      <h3>You are winning this one, ${esc(brand)}.</h3>
      <p>AI consistently recommends you for this solution. Nobody wins every category though. Scan another solution or page to find where you are losing ground.</p>
      <button class="btn-fill" id="agScanBtn">Scan another solution</button>
    </div></div>`;
  }
  // Bottom CTA for both the short (locked) and full baseline report: drive to the
  // AEO Genie. Copy mirrors the Genie opt-in page.
  function genieCtaHtml() {
    return `<div class="gcta">
      <div class="gcta-eyebrow">Your next step</div>
      <h2 class="gcta-title">The AEO Genie will help you <span class="gcta-grad">rank in your space.</span></h2>
      <div class="gcta-cards">
        <div class="gcta-card">
          <div class="gcta-pills"><span class="gcta-pill primary">Step 1 &middot; Free</span><span class="gcta-pill white">Start here</span></div>
          <h3 class="gcta-h3">How to Win with AEO</h3>
          <ul class="gcta-bullets">
            <li>Up to 10 genius moves, ranked by impact</li>
            <li>An AEO money model on your numbers</li>
            <li>The fastest path to getting cited by AI</li>
          </ul>
          <a class="gcta-btn" href="genie.html" target="_blank" rel="noopener">Run the AEO Genie <span class="gcta-arr">&rarr;</span></a>
          <p class="gcta-fine">Free &middot; takes about 2 minutes &middot; no card</p>
        </div>
        <div class="gcta-card gcta-preview">
          <img class="gcta-genie-frame" src="genie-frame.png" alt="" aria-hidden="true">
          <img class="gcta-genie" src="genie-main.png" alt="" aria-hidden="true">
          <div class="gcta-pv-head"><span class="gcta-pv-label">AEO Genie</span><span class="gcta-pv-url">leanlabs.com/solutions/aeo</span><span class="gcta-pv-gen">Generate</span></div>
          <div class="gcta-pv-rows">
            <div class="gcta-pv-row">Add FAQ schema to 12 key pages</div>
            <div class="gcta-pv-row">Publish a definitive &ldquo;what is&rdquo; guide</div>
            <div class="gcta-pv-row">Earn 3 third-party citations</div>
          </div>
          <div class="gcta-pv-foot">Projected <b>&asymp; 10 customers / yr</b></div>
        </div>
      </div>
    </div>`;
  }
  function nextStepHtml() { return genieCtaHtml(); }
  function ctaHtml() {
    return `<div class="cta2"><h3>Get recommended by AI, not your competitors.</h3>
      <p>Unlock your full baseline report and see exactly where you are losing to competitors.</p>
      <a class="btn2" href="#" id="ctaUnlock">Unlock full details</a></div>`;
  }
  function blueprintCtaHtml() { return genieCtaHtml(); }

  // Conversion: capture email (best-effort POST), stash the scan response, then
  // redirect to the full report. Email delivery of a PDF is a later phase.
  function unlockFull(emailId) {
    // Capture the email if one was entered (best effort), then ALWAYS go to the
    // full report. Every unlock button routes here; none reveal blur in place.
    if (emailId) {
      const el = document.querySelector("#" + emailId);
      const email = ((el && el.value) || "").trim();
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        try {
          fetch(_leadUrl(), { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": API.key },
            body: JSON.stringify({ email: email, url: (($("#scanUrl") && $("#scanUrl").value) || (_lastData && _lastData.url) || "") }) }).catch(() => {});
        } catch (_) {}
      }
    }
    try { localStorage.setItem("aeo_full", JSON.stringify(_lastData || {})); } catch (_) {}
    window.location.href = "full-report.html";
  }

  function wireAeo(brand) {
    const $$ = (s) => document.querySelector(s);
    const refine = $$("#refineLink");
    if (refine) refine.addEventListener("click", () => $$("#refineForm").classList.toggle("open"));
    const rescan = $$("#rescanBtn");
    if (rescan) rescan.addEventListener("click", () => {
      const cat = ($$("#catIn") && $$("#catIn").value || "").trim();
      const ic = ($$("#icpIn") && $$("#icpIn").value || "").trim();
      const onFullReport = document.body.hasAttribute("data-full-report") || !document.getElementById("scanState");
      // Full report has no #scanUrl input; recover the scanned URL from the data.
      let url = ($("#scanUrl") && $("#scanUrl").value) || "";
      if (!url) {
        const sol = (_lastData && (_lastData.solutions || [])[0]) || {};
        url = sol.url || (_lastData && _lastData.url) || "";
        if (!url) { try { const d = JSON.parse(localStorage.getItem("aeo_full") || "null"); url = (d && ((d.solutions || [])[0] || {}).url) || (d && d.url) || ""; } catch (_) {} }
      }
      const parsed = parseScanInput(url);
      if (!parsed.ok) { if (typeof showInputError === "function" && document.getElementById("scanUrlError")) showInputError(parsed.error); return; }
      if (onFullReport) {
        const host = document.getElementById("report");
        if (host) host.innerHTML = `<div style="padding:90px 20px;text-align:center;color:#9b97a8">Re-scanning <b style="color:#f3f2f6">${esc(parsed.solution_url)}</b> for <b style="color:#c47bff">${esc(cat || "your category")}</b>. Usually 60-90s.</div>`;
        runLiveScan(parsed, () => {}, { category: cat, icp: ic })
          .then((d) => { try { localStorage.setItem("aeo_full", JSON.stringify(d)); localStorage.removeItem("aeo_genie_result"); } catch (_) {} renderFullReport(d); })
          .catch((e) => { if (host) host.innerHTML = `<div style="padding:90px 20px;text-align:center;color:#e5484d">Re-scan failed: ${esc(String(e && e.message || e))}</div>`; });
        return;
      }
      showLoading(hostOf(parsed.solution_url));
      runLiveScan(parsed, updateLoadingProgress, { category: cat, icp: ic })
        .then(renderFull).catch((e) => renderGenericError(String(e && e.message || e)));
    });
    // Conversion points -> unlock the full report.
    const matrixReveal = $$("#matrixRevealBtn");
    if (matrixReveal) matrixReveal.addEventListener("click", () => unlockFull("matrixEmail"));
    const scoreUnlock = $$("#scoreUnlockBtn");
    if (scoreUnlock) scoreUnlock.addEventListener("click", () => unlockFull("scoreEmail"));
    const startBp = $$("#startBpBtn");
    if (startBp) startBp.addEventListener("click", () => unlockFull());
    const ctaUnlock = $$("#ctaUnlock");
    if (ctaUnlock) ctaUnlock.addEventListener("click", (e) => { e.preventDefault(); unlockFull(); });
    const agScan = $$("#agScanBtn");
    if (agScan) agScan.addEventListener("click", () => {
      if (document.getElementById("entry")) { showEntry(); window.scrollTo({ top: 0 }); }
      else { window.location.href = "scan.html"; }
    });
    document.querySelectorAll(".aeo2 .chead").forEach((h) =>
      h.addEventListener("click", () => h.parentElement.classList.toggle("open")));
    document.querySelectorAll(".aeo2 .viewresp").forEach((v) =>
      v.addEventListener("click", () => openRespModal(v.getAttribute("data-q"), brand)));
    const bslNav = document.getElementById("bslNav");
    if (bslNav) wireBaselineNav(bslNav);
  }

  // Floating section sidebar scrollspy: the active link is the topmost section
  // currently inside the top band of the viewport. Defaults to the first link so
  // the absolute top of the report reads as section 01. Smooth scroll on the
  // anchor jump is handled by CSS (html{scroll-behavior:smooth}).
  function wireBaselineNav(nav) {
    const links = Array.from(nav.querySelectorAll(".bsl-link"));
    const byId = {};
    const setActive = (a) => { links.forEach((l) => l.classList.remove("active")); if (a) a.classList.add("active"); };
    links.forEach((a) => {
      const id = (a.getAttribute("data-target") || "").replace("#", "");
      if (id) byId[id] = a;
      a.addEventListener("click", () => setActive(a));
    });
    const targets = Object.keys(byId).map((id) => document.getElementById(id)).filter(Boolean);
    if (targets.length) setActive(byId[targets[0].id]);
    if (!("IntersectionObserver" in window) || !targets.length) return;
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) visible.add(en.target.id); else visible.delete(en.target.id); });
      let best = null, bestTop = Infinity;
      visible.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const t = el.getBoundingClientRect().top;
        if (t < bestTop) { bestTop = t; best = id; }
      });
      if (best && byId[best]) setActive(byId[best]);
    }, { rootMargin: "0px 0px -65% 0px", threshold: 0 });
    targets.forEach((t) => io.observe(t));
  }

  function openRespModal(qid, brand) {
    const d = _modalData[qid];
    if (!d) return;
    const blocks = ENGINES2.map(([k, label]) => {
      const r = d.byEngine[k] || { cited: false, text: "" };
      const txt = highlightResp(r.text || "(no response captured)", brand);
      return `<div class="eblock"><div class="eh"><span class="en">${label}</span>
        <span class="cited ${r.cited ? "yes" : "no"}">${r.cited ? "Mentioned you" : "Did not mention you"}</span></div>
        ${r.cited ? "" : `<div class="miss">${esc(brand)} was not recommended in this answer</div>`}
        <div class="resp">${txt}</div></div>`;
    }).join("");
    let ov = document.getElementById("aeoOverlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "aeoOverlay"; ov.className = "aeo2 overlay";
      document.body.appendChild(ov);
      ov.addEventListener("click", (e) => { if (e.target === ov) ov.classList.remove("show"); });
    }
    ov.innerHTML = `<div class="modal"><button class="x" id="aeoX">&times;</button>
      <div class="meyebrow">What AI actually said</div><div class="mq">${esc(d.question)}</div>${blocks}</div>`;
    ov.querySelector("#aeoX").addEventListener("click", () => ov.classList.remove("show"));
    ov.classList.add("show");
  }
  function highlightResp(text, brand) {
    let t = esc(text);
    if (brand) t = t.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      `<mark class="brand">${esc(brand)}</mark>`);
    return t;
  }

  function injectAeoStyles() {
    if (document.getElementById("aeo2-style")) return;
    const css = `
    .aeo2{--ink:#f3f2f6;--muted:#9b97a8;--line:#2a2a30;--card:#141417;--card2:#1b1b20;--track:#2c2c33;
      --bad:#e5484d;--orange:#f5821f;--warn:#f5a623;--ok:#34c98a;
      --g1:#c47bff;--grad:linear-gradient(100deg,#7612fa,#c109af 52%,#ff6221);
      --sh:0 1px 2px rgba(0,0,0,.4),0 20px 44px -24px rgba(0,0,0,.7);
      --shs:0 1px 2px rgba(0,0,0,.3),0 10px 26px -18px rgba(0,0,0,.6);
      color:var(--ink);max-width:920px;margin:0 auto;padding:8px 16px 90px;letter-spacing:.002em}
    .aeo2 *{box-sizing:border-box}
    .aeo2 .fr-head{text-align:center;margin:22px 0 2px}
    .aeo2 .fr-title{font-size:clamp(34px,5.4vw,54px);font-weight:800;letter-spacing:-.03em;line-height:1.03;margin:0;color:var(--ink)}
    .aeo2 .fr-for{margin-top:12px;font-size:15px;color:var(--muted);font-weight:600;word-break:break-word}
    .aeo2 .fr-for a{color:#cfccd9;text-decoration:none;border-bottom:1px solid #3a3a44}
    .aeo2 .fr-for a:hover{color:var(--ink)}
    .aeo2 .hero{position:relative;overflow:hidden;background:var(--card);border:1px solid var(--line);border-radius:26px;padding:58px 40px 50px;margin-top:18px;text-align:center;box-shadow:var(--sh)}
    .aeo2 .hero::before{content:"";position:absolute;left:-10%;right:30%;top:-50%;height:120%;background:radial-gradient(50% 60% at 40% 50%,rgba(118,18,250,.22),rgba(255,98,33,.10) 40%,transparent 70%);pointer-events:none}
    .aeo2 .eyebrow{position:relative;font-size:11.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:600}
    .aeo2 .gauge2{position:relative;width:330px;max-width:88vw;margin:26px auto 0}
    .aeo2 .gauge2 svg{width:100%;display:block}
    .aeo2 .gauge2 .arc{filter:drop-shadow(0 4px 14px rgba(245,130,31,.35));animation:aeoArc 1.15s cubic-bezier(.22,1,.36,1) .25s both}
    @keyframes aeoArc{from{stroke-dashoffset:100}to{stroke-dashoffset:var(--off)}}
    .aeo2 .gauge2 .num{position:absolute;left:0;right:0;top:52%;text-align:center}
    .aeo2 .gauge2 .num b{font-size:74px;font-weight:800;letter-spacing:-.02em}
    .aeo2 .gauge2 .num .of{font-size:20px;color:var(--muted);font-weight:600}
    .aeo2 .level2{position:relative;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin-top:14px}
    .aeo2 .hverdict{position:relative;font-size:clamp(26px,3.6vw,40px);line-height:1.18;font-weight:800;letter-spacing:-.015em;margin:22px auto 0;max-width:640px}
    .aeo2 .hverdict b{color:var(--ink)}
    .aeo2 .hpct{color:var(--muted);font-weight:800}
    .aeo2 .hsupport{position:relative;font-size:15px;margin-top:12px;color:#cfccd9}
    .aeo2 .catq{color:var(--g1);font-weight:800}
    .aeo2 [id^="cat-"]{scroll-margin-top:80px}
    .aeo2 .detected{position:relative;margin-top:8px;font-size:14px;color:var(--muted)}.aeo2 .detected b{color:var(--ink)}
    .aeo2 .hero-pillars{position:relative;display:flex;justify-content:center;flex-wrap:wrap;gap:18px;margin-top:30px;padding-top:26px;border-top:1px solid var(--line)}
    .aeo2 .hpill{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:96px;text-decoration:none;color:inherit;cursor:pointer;border-radius:12px;padding:8px 6px;transition:background .15s,transform .15s}
    .aeo2 .hpill:hover{background:var(--card2);transform:translateY(-2px)}
    .aeo2 .hpd{width:56px;height:56px}
    .aeo2 .hpd.bad{color:var(--bad)}.aeo2 .hpd.warn{color:var(--warn)}.aeo2 .hpd.ok{color:var(--ok)}
    .aeo2 .hpn{font-size:16px;font-weight:800;fill:var(--ink)}
    .aeo2 .hpname{font-weight:700;font-size:13px;text-align:center;max-width:120px;line-height:1.2}
    .aeo2 .hpratio{font-size:12px;color:var(--muted);font-weight:700}
    .aeo2 .pill-jump{position:relative;display:inline-block;margin-top:18px;color:var(--g1);font-weight:700;font-size:13.5px;text-decoration:none}
    .aeo2 .pill-jump:hover{text-decoration:underline}
    .aeo2 .detectbox{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 22px;box-shadow:var(--shs);text-align:center}
    .aeo2 .db-h{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--g1)}
    .aeo2 .detectbox .detected{margin:0}
    .aeo2 .detectbox .refine-form{margin-top:14px}
    .aeo2 .metric-eyebrow{position:relative;font-size:12.5px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--g1);margin-top:2px}
    .aeo2 .bsl{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:30px 32px;box-shadow:var(--shs)}
    .aeo2 .bsl-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--g1);font-weight:800;text-align:center}
    .aeo2 .bsl-h{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:6px 0 4px;text-align:center}
    .aeo2 .bsl-sub{margin:0 auto 22px;color:var(--muted);font-size:14px;text-align:center;max-width:520px}
    .aeo2 .bsl-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .aeo2 .bsl-card{display:block;background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:18px 20px;text-decoration:none;transition:transform .15s,border-color .15s}
    .aeo2 .bsl-card:hover{transform:translateY(-2px);border-color:#3a3a44}
    .aeo2 .bsl-t{font-weight:800;font-size:16px;color:var(--ink)}
    .aeo2 .bsl-d{margin-top:5px;color:var(--muted);font-size:13.5px;line-height:1.5}
    /* floating section sidebar (jump nav) */
    html{scroll-behavior:smooth}
    .aeo2 [id^="sec-"]{scroll-margin-top:24px}
    .aeo2 .bsl-nav{display:none;position:fixed;left:16px;top:50%;transform:translateY(-50%);width:184px;z-index:40;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 14px;box-shadow:var(--sh)}
    .aeo2 .bsl-nav-h{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--g1);line-height:1.25;margin:2px 4px 12px}
    .aeo2 .bsl-links{display:flex;flex-direction:column;gap:2px}
    .aeo2 .bsl-link{display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;text-decoration:none;color:var(--muted);transition:background .15s,color .15s;position:relative}
    .aeo2 .bsl-link:hover{background:var(--card2);color:var(--ink)}
    .aeo2 .bsl-ln{font-size:11px;font-weight:800;color:#5f5b6e;flex:0 0 18px}
    .aeo2 .bsl-lt{font-size:13px;font-weight:700;line-height:1.2}
    .aeo2 .bsl-link.active{background:var(--card2);color:var(--ink)}
    .aeo2 .bsl-link.active .bsl-ln{color:var(--g1)}
    .aeo2 .bsl-link.active::before{content:"";position:absolute;left:-14px;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--grad)}
    @media(min-width:1300px){.aeo2 .bsl-nav{display:block}}
    /* section-number badge (matches sidebar numbering) */
    .aeo2 .secn{display:inline-flex;align-items:center;justify-content:center;min-width:1.7em;height:1.7em;padding:0 .45em;margin-right:.5em;border-radius:8px;background:rgba(118,18,250,.14);border:1px solid rgba(118,18,250,.35);color:var(--g1);font-size:.62em;font-weight:800;font-variant-numeric:tabular-nums;vertical-align:middle;line-height:1;transform:translateY(-.06em)}
    .aeo2 .gap-empty{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;color:#cfccd9;font-size:14.5px;box-shadow:var(--shs)}
    .aeo2 table.mx th.lcol{text-align:left}
    .aeo2 .gmiss{white-space:normal}
    .aeo2 .miss-eng{display:inline-block;font-size:12px;font-weight:700;color:#f3a0a2;background:rgba(229,72,77,.12);border:1px solid rgba(229,72,77,.25);border-radius:7px;padding:3px 9px;margin:2px 6px 2px 0;white-space:nowrap}
    .aeo2 .gapmore{font-size:12px;color:var(--muted);font-weight:700;white-space:nowrap}
    .aeo2 .soa{display:flex;align-items:center;gap:18px;margin-top:6px}
    .aeo2 .soa-num{font-size:48px;font-weight:800;letter-spacing:-.02em;line-height:1;white-space:nowrap;flex:0 0 auto}
    .aeo2 .soa-txt{color:#cfccd9;font-size:15px}.aeo2 .soa-txt b{color:var(--ink);font-weight:800}
    .aeo2 .soa-num .soa-of{font-size:17px;color:var(--muted);font-weight:600;margin-left:7px}
    .aeo2 .soabar{display:flex;height:18px;border-radius:999px;overflow:hidden;margin-top:20px;background:var(--card2)}
    .aeo2 .soaseg{height:100%;background:#3a3a44;box-shadow:inset -1px 0 0 var(--card)}
    .aeo2 .soaseg.you{background:var(--grad)}
    .aeo2 .soaseg.other{background:#26262c}
    .aeo2 .soa-chart{display:flex;align-items:center;gap:28px;margin-top:20px;flex-wrap:wrap}
    .aeo2 .soapie{width:172px;height:172px;border-radius:50%;flex:0 0 auto;border:3px solid var(--card);box-shadow:0 8px 24px -10px rgba(0,0,0,.55)}
    .aeo2 .soa-chart .soalegend{margin-top:0;flex:1;min-width:200px;gap:11px 18px;font-size:13px}
    .aeo2 .soalegend{display:flex;flex-wrap:wrap;gap:14px;margin-top:13px;font-size:12.5px;color:var(--muted)}
    .aeo2 .soaleg{display:inline-flex;align-items:center;gap:6px}
    .aeo2 .soaleg i{width:10px;height:10px;border-radius:3px;background:#3a3a44;display:inline-block}
    .aeo2 .soaleg.you{color:var(--ink);font-weight:700}.aeo2 .soaleg.you i{background:var(--grad)}
    .aeo2 .soaleg.other i{background:#26262c}
    @media(max-width:680px){.aeo2 .bsl-grid{grid-template-columns:1fr}}
    .aeo2 .link2{color:var(--g1);font-weight:700;cursor:pointer}
    .aeo2 .refine-form{display:none;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:18px}
    .aeo2 .refine-form.open{display:flex}
    .aeo2 input{font-family:inherit}
    .aeo2 .refine-form input{padding:11px 13px;border:1px solid var(--line);border-radius:10px;font-size:14px;min-width:230px;background:var(--card2);color:var(--ink)}
    .aeo2 .btn-sm,.aeo2 .btn-fill{background:var(--grad);color:#fff;border:none;border-radius:11px;padding:13px 22px;font-weight:700;font-size:14.5px;cursor:pointer;transition:transform .15s,filter .15s;white-space:nowrap}
    .aeo2 .btn-sm:hover,.aeo2 .btn-fill:hover{transform:translateY(-1px);filter:brightness(1.08)}
    .aeo2 .btn-fill .lk{filter:grayscale(1) brightness(2)}
    .aeo2 .sec2{margin-top:34px}
    .aeo2 .sec2 h2{font-size:23px;font-weight:800;letter-spacing:-.02em;margin:0 0 16px}
    .aeo2 .comp{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:26px 28px;box-shadow:var(--shs)}
    .aeo2 .comp .lead{font-size:20px;font-weight:800;margin:0 0 14px;letter-spacing:-.01em}
    .aeo2 .chips{display:flex;flex-wrap:wrap;gap:10px}
    .aeo2 .chip{display:inline-flex;align-items:center;gap:9px;padding:9px 12px 9px 16px;border-radius:999px;background:var(--card2);border:1px solid var(--line);font-weight:700;font-size:15px;transition:transform .15s}
    .aeo2 .chip:hover{transform:translateY(-2px)}
    .aeo2 .chips .chip.you{background:var(--grad);color:#fff;border:none;box-shadow:0 10px 22px -10px rgba(193,9,175,.6)}
    .aeo2 .cct{display:inline-flex;align-items:center;justify-content:center;min-width:23px;height:23px;padding:0 6px;border-radius:999px;background:var(--grad);color:#fff;font-size:12.5px;font-weight:800;line-height:1}
    .aeo2 .chips .chip.you .cct{background:#fff;color:#c109af}
    .aeo2 .lead-sub{margin:-4px 0 16px;color:var(--muted);font-size:13.5px}
    .aeo2 .chip.sm{padding:5px 11px;font-size:13px;gap:6px}
    .aeo2 .bmrow{display:flex;align-items:center;gap:12px;padding:9px 0}
    .aeo2 .bmname{flex:0 0 190px;font-weight:700;font-size:14px;color:#cfccd9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .aeo2 .bmrow.you .bmname{color:var(--ink);font-weight:800}
    .aeo2 .bmbar{flex:1;height:12px;background:var(--card2);border-radius:999px;overflow:hidden}
    .aeo2 .bmbar i{display:block;height:100%;background:#3a3a44;border-radius:999px}
    .aeo2 .bmrow.you .bmbar i{background:var(--grad)}
    .aeo2 .bmnum{flex:0 0 34px;text-align:right;font-weight:800;font-size:14px}
    .aeo2 .cbox{margin-top:22px;background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:20px 22px;text-align:center}
    .aeo2 .cbox-h{margin:0 0 14px;font-weight:700;font-size:15px}
    .aeo2 .cbox-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    .aeo2 .cbox-row input{flex:1;min-width:220px;max-width:300px;padding:13px 15px;border:1px solid var(--line);border-radius:11px;font-size:14px;background:#0e0e10;color:var(--ink)}
    .aeo2 .cbox-row input::placeholder,.aeo2 .gc-form input::placeholder{color:#6f6b7e}
    .aeo2 .engines{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
    .aeo2 .eng{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px 18px;text-align:center;box-shadow:var(--shs);transition:transform .18s,border-color .18s}
    .aeo2 .eng:hover{transform:translateY(-3px);border-color:#3a3a44}
    .aeo2 .ename{font-weight:800;font-size:15px;margin-bottom:12px}
    .aeo2 .edwrap{width:84px;margin:0 auto 10px}
    .aeo2 .edonut{width:100%;display:block}
    .aeo2 .edonut.bad{color:var(--bad)}.aeo2 .edonut.warn{color:var(--warn)}.aeo2 .edonut.ok{color:var(--ok)}
    .aeo2 .edn{font-size:15px;font-weight:800;fill:var(--ink)}
    .aeo2 .ev2{font-weight:800;font-size:15px}
    .aeo2 .eng.bad .ev2{color:var(--bad)}.aeo2 .eng.warn .ev2{color:var(--warn)}.aeo2 .eng.ok .ev2{color:var(--ok)}
    .aeo2 .erate{color:var(--muted);font-size:13px;margin-top:3px}
    .aeo2 .mx-label{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:22px 0 12px}
    .aeo2 .matrix{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:8px 24px 22px;box-shadow:var(--shs)}
    .aeo2 table.mx{width:100%;border-collapse:collapse}
    .aeo2 table.mx th{font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:14px 6px;text-align:center}
    .aeo2 table.mx th.q{text-align:left}
    .aeo2 table.mx td{padding:13px 6px;border-top:1px solid var(--line);font-size:14.5px;vertical-align:middle}
    .aeo2 table.mx td.q{padding-right:14px}.aeo2 table.mx td.cell{text-align:center;width:92px}
    .aeo2 .cdot{display:inline-block;width:16px;height:16px;border-radius:50%}
    .aeo2 .cdot.yes{background:var(--ok);box-shadow:0 0 0 4px rgba(52,201,138,.16)}
    .aeo2 .cdot.no{background:#0e0e10;border:2px solid #3a3a44}
    .aeo2 .viewresp{font-weight:700;font-size:13px}
    .aeo2 .legend{display:flex;gap:18px;justify-content:flex-end;font-size:12px;color:var(--muted);margin-top:12px}
    .aeo2 .legend i{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;vertical-align:-1px}
    .aeo2 .legend .y{background:var(--ok)}.aeo2 .legend .n{background:#0e0e10;border:2px solid #3a3a44}
    .aeo2 .mx-teaser{margin:14px 0 0;color:var(--g1);font-weight:700;font-size:14px;text-align:center}
    .aeo2 .locked{display:none}.aeo2 .locked.open{display:table-row-group}
    .aeo2 .locked.open.blur td.q,.aeo2 .locked.open.blur td.cell{filter:blur(5px);opacity:.8}
    /* gate card (unlock full details) */
    .aeo2 .gatecard{display:grid;grid-template-columns:240px 1fr;gap:10px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:30px 32px;box-shadow:var(--sh);position:relative;overflow:hidden}
    .aeo2 .gatecard::before{content:"";position:absolute;inset:0;background:radial-gradient(60% 80% at 15% 50%,rgba(118,18,250,.16),transparent 70%);pointer-events:none}
    .aeo2 .mgauge{position:relative;width:200px;margin:0 auto;text-align:center}
    .aeo2 .mgauge svg{width:100%;display:block}
    .aeo2 .mnum{position:absolute;left:0;right:0;top:50%;text-align:center}
    .aeo2 .mnum b{font-size:42px;font-weight:800}.aeo2 .mnum span{font-size:13px;color:var(--muted);font-weight:600}
    .aeo2 .mlvl{font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.07em;margin-top:6px}
    .aeo2 .gc-right{position:relative}
    .aeo2 .gc-right h3{font-size:21px;font-weight:800;margin:0 0 8px;letter-spacing:-.01em}
    .aeo2 .gc-right p{margin:0 0 16px;color:#cfccd9;font-size:14.5px;line-height:1.5}
    .aeo2 .gc-form{display:flex;gap:10px;flex-wrap:wrap}
    .aeo2 .gc-form input{flex:1;min-width:200px;padding:13px 15px;border:1px solid var(--line);border-radius:11px;font-size:14px;background:#0e0e10;color:var(--ink)}
    .aeo2 .gc-fine{margin:10px 0 0;font-size:12px;color:var(--muted)}
    /* all-green handler */
    .aeo2 .allgreen{background:var(--card);border:1px solid rgba(52,201,138,.4);border-radius:20px;padding:34px 32px;text-align:center;box-shadow:var(--sh)}
    .aeo2 .allgreen .ag-badge{width:54px;height:54px;border-radius:50%;background:var(--ok);color:#06281c;font-size:30px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
    .aeo2 .allgreen h3{font-size:23px;font-weight:800;margin:0 0 8px;letter-spacing:-.01em}
    .aeo2 .allgreen p{margin:0 auto 18px;color:#cfccd9;font-size:15px;line-height:1.55;max-width:520px}
    /* scorecard */
    .aeo2 .sc-sub{margin:-8px 0 18px;color:var(--muted);font-size:14px}
    .aeo2 .cgroup{margin-bottom:22px}
    .aeo2 .cgh{display:flex;justify-content:space-between;align-items:center;margin:0 4px 12px}
    .aeo2 .cgn{font-weight:800;font-size:16px}
    .aeo2 .cgf{font-weight:800;font-size:14px;padding:3px 10px;border-radius:8px}
    .aeo2 .cgf.ok{color:var(--ok);background:rgba(52,201,138,.14)}.aeo2 .cgf.warn{color:var(--warn);background:rgba(245,166,35,.14)}.aeo2 .cgf.bad{color:var(--bad);background:rgba(229,72,77,.14)}
    .aeo2 .cards2{display:flex;flex-direction:column;gap:12px}
    .aeo2 .ccard{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:var(--shs);transition:border-color .18s}
    .aeo2 .ccard.fail{border-color:rgba(229,72,77,.3)}
    .aeo2 .ccard:hover{border-color:#3a3a44}
    .aeo2 .chead{display:flex;align-items:center;gap:14px;padding:16px 18px;cursor:pointer}
    .aeo2 .cicon{width:28px;height:28px;flex:0 0 28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#06281c;font-weight:800;font-size:14px}
    .aeo2 .cicon.ok{background:var(--ok)}.aeo2 .cicon.bad{background:var(--bad);color:#2b0808}
    .aeo2 .cname{flex:1;font-weight:800;font-size:15.5px}
    .aeo2 .cname small{display:block;font-weight:600;color:var(--muted);font-size:12.5px;margin-top:1px}
    .aeo2 .chev{color:var(--muted);transition:transform .15s;font-size:13px}
    .aeo2 .ccard.open .chev{transform:rotate(180deg)}
    .aeo2 .cbody{display:none;padding:0 18px 18px 60px;color:#cfccd9}.aeo2 .ccard.open .cbody{display:block}
    .aeo2 .cbody .lbl{font-weight:700;margin-top:12px;color:var(--ink)}.aeo2 .cbody .issue{color:#f3a0a2}
    .aeo2 .bp-hook{margin-top:12px;background:rgba(118,18,250,.12);border:1px solid rgba(118,18,250,.3);border-radius:10px;padding:11px 13px;font-size:13.5px;color:#d9c6ff;font-weight:600}
    .aeo2 .res{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .aeo2 .res a{font-size:13px;color:#ffb38a;border:1px solid #45342c;border-radius:8px;padding:5px 10px;text-decoration:none}
    .aeo2 .cta2{margin-top:42px;background:var(--grad);border-radius:22px;padding:40px;text-align:center;color:#fff;box-shadow:0 26px 54px -22px rgba(193,9,175,.6)}
    .aeo2 .cta2 h3{font-size:26px;margin:0 0 8px;font-weight:800;letter-spacing:-.01em}
    .aeo2 .cta2 p{margin:0 auto 20px;opacity:.94;max-width:520px}
    .aeo2 .btn2{display:inline-block;background:#fff;color:#7612fa;font-weight:800;padding:15px 30px;border-radius:12px;text-decoration:none;transition:transform .15s;cursor:pointer}
    .aeo2 .btn2:hover{transform:translateY(-2px)}
    /* p2v2 Genie CTA (replicated exact) */
    .aeo2 .gcta{margin-top:42px;background:#0d0d0d;border:1px solid #1f1f1f;border-radius:26px;padding:52px 40px 46px;text-align:center}
    .aeo2 .gcta-eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.2em;color:rgba(255,255,255,.5);margin-bottom:14px}
    .aeo2 .gcta-title{font-size:clamp(28px,4vw,44px);font-weight:800;line-height:1.08;letter-spacing:-.02em;color:#fff;margin:0 0 38px}
    .aeo2 .gcta-grad{background:linear-gradient(180deg,#fff,rgba(255,255,255,.5));-webkit-background-clip:text;background-clip:text;color:transparent}
    .aeo2 .gcta-cards{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:980px;margin:0 auto;text-align:left}
    .aeo2 .gcta-card{background:#141414;border:1px solid #292929;border-radius:20px;padding:26px 28px}
    .aeo2 .gcta-pills{display:flex;gap:8px;margin-bottom:16px}
    .aeo2 .gcta-pill{display:inline-flex;align-items:center;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;padding:5px 12px;border-radius:999px}
    .aeo2 .gcta-pill.primary{border:1px solid rgba(235,235,235,.4);background:rgba(235,235,235,.14);color:#ededed}
    .aeo2 .gcta-pill.white{background:#fff;color:#000}
    .aeo2 .gcta-h3{font-size:clamp(22px,2.6vw,30px);font-weight:800;color:#fff;margin:0 0 16px;line-height:1.15;letter-spacing:-.01em}
    .aeo2 .gcta-bullets{list-style:none;margin:0 0 22px;padding:0;display:flex;flex-direction:column;gap:11px}
    .aeo2 .gcta-bullets li{position:relative;padding-left:28px;color:rgba(255,255,255,.82);font-size:14.5px;line-height:1.4}
    .aeo2 .gcta-bullets li::before{content:"";position:absolute;left:0;top:1px;width:18px;height:18px;border-radius:50%;background:rgba(235,235,235,.14);border:1px solid rgba(235,235,235,.4)}
    .aeo2 .gcta-bullets li::after{content:"\\2713";position:absolute;left:4px;top:1px;font-size:11px;font-weight:800;color:#fff}
    .aeo2 .gcta-btn{display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 30px;background:#fff;color:#000;font-weight:800;border-radius:999px;text-decoration:none;transition:transform .15s,background .15s}
    .aeo2 .gcta-btn:hover{transform:translateY(-2px);background:rgba(255,255,255,.9)}
    .aeo2 .gcta-arr{transition:transform .15s}
    .aeo2 .gcta-btn:hover .gcta-arr{transform:translateX(3px)}
    .aeo2 .gcta-fine{margin:14px 0 0;font-size:12px;color:rgba(255,255,255,.5)}
    .aeo2 .gcta-preview{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;min-height:230px}
    .aeo2 .gcta-genie-frame,.aeo2 .gcta-genie{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:74%;pointer-events:none;mix-blend-mode:screen;object-fit:contain}
    .aeo2 .gcta-genie-frame{opacity:.4}
    .aeo2 .gcta-genie{opacity:.7;width:100%}
    .aeo2 .gcta-pv-head{position:relative;display:flex;align-items:center;gap:8px;margin-bottom:12px}
    .aeo2 .gcta-pv-label{font-size:11px;font-weight:800;color:rgba(255,255,255,.6)}
    .aeo2 .gcta-pv-url{font-size:11px;color:rgba(255,255,255,.4);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .aeo2 .gcta-pv-gen{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;background:rgba(255,255,255,.1);color:#fff;padding:4px 10px;border-radius:999px}
    .aeo2 .gcta-pv-rows{position:relative;display:flex;flex-direction:column;gap:8px}
    .aeo2 .gcta-pv-row{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px;font-size:12px;color:rgba(255,255,255,.85)}
    .aeo2 .gcta-pv-foot{position:relative;margin-top:14px;font-size:12px;color:rgba(255,255,255,.65)}
    .aeo2 .gcta-pv-foot b{color:#ededed;font-weight:800;margin-left:4px}
    @media(max-width:760px){.aeo2 .gcta-cards{grid-template-columns:1fr}.aeo2 .gcta{padding:38px 22px}}
    .aeo2.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;justify-content:center;padding:40px 16px;overflow:auto;max-width:none}
    .aeo2.overlay.show{display:flex}
    .aeo2 .modal{background:var(--card);border:1px solid var(--line);border-radius:18px;max-width:760px;width:100%;padding:24px 28px 28px;height:max-content;box-shadow:0 20px 60px rgba(0,0,0,.6)}
    .aeo2 .modal .x{float:right;cursor:pointer;color:var(--muted);font-size:24px;line-height:1;border:none;background:none}
    .aeo2 .modal .meyebrow{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
    .aeo2 .modal .mq{font-size:19px;font-weight:800;margin:4px 30px 4px 0}
    .aeo2 .eblock{margin-top:18px;border:1px solid var(--line);border-radius:14px;padding:16px 18px}
    .aeo2 .eblock .eh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
    .aeo2 .eblock .en{font-weight:800;font-size:15px}
    .aeo2 .eblock .cited{font-weight:800;font-size:13px;padding:4px 11px;border-radius:999px}
    .aeo2 .eblock .cited.no{color:var(--bad);background:rgba(229,72,77,.16)}.aeo2 .eblock .cited.yes{color:var(--ok);background:rgba(52,201,138,.16)}
    .aeo2 .eblock .miss{background:rgba(229,72,77,.12);color:#f3a0a2;font-weight:700;font-size:13px;border-radius:8px;padding:8px 12px;margin-bottom:10px}
    .aeo2 .eblock .resp{font-size:14px;line-height:1.6;color:#cfccd9;white-space:pre-wrap;max-height:230px;overflow:auto;background:#0e0e10;border-radius:10px;padding:12px 14px}
    .aeo2 mark.brand{background:rgba(52,201,138,.22);color:#7ee8b6;font-weight:700;padding:0 3px;border-radius:3px}
    /* score/level tiered by the 4-level scale */
    .aeo2 .t-ok{color:var(--ok)}.aeo2 .t-warn{color:var(--warn)}.aeo2 .t-orange{color:var(--orange)}.aeo2 .t-bad{color:var(--bad)}
    /* gated competitors + matrix reveal + next-step ascension */
    .aeo2 .chip.locked{filter:blur(5px);user-select:none;pointer-events:none}
    .aeo2 .chip.morelock{background:rgba(118,18,250,.12);border:1px solid rgba(118,18,250,.35);color:var(--g1);font-weight:800}
    .aeo2 .scgate{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:26px 28px;box-shadow:var(--shs)}
    .aeo2 .scgate h2{margin:0 0 4px;font-size:22px}
    .aeo2 .scgate .sc-sub{margin:0 0 16px}
    .aeo2 .pillrows{display:flex;flex-direction:column;margin-bottom:20px}
    .aeo2 .pillitem{padding:13px 2px;border-top:1px solid var(--line)}
    .aeo2 .pillitem:first-child{border-top:none}
    .aeo2 .pillrow{display:flex;justify-content:space-between;align-items:center}
    .aeo2 .pilltease{margin-top:7px;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .aeo2 .pilltease.blur{filter:blur(4px);user-select:none;pointer-events:none}
    .aeo2 .pillname{font-weight:800;font-size:15.5px}
    .aeo2 .scgate .mx-grow{display:flex;gap:10px;flex-wrap:wrap}
    .aeo2 .mx-gate{margin-top:18px;background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:20px;text-align:center}
    .aeo2 .mx-gate p{margin:0 0 14px;font-weight:700}
    .aeo2 .mx-grow{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    .aeo2 .mx-grow input{padding:13px 15px;border:1px solid var(--line);border-radius:11px;font-size:14px;min-width:240px;background:#0e0e10;color:var(--ink)}
    .aeo2 .mx-grow input::placeholder{color:#6f6b7e}
    .aeo2 .gatecard.bp{grid-template-columns:1fr}
    .aeo2 .gc-wide{grid-column:1/-1}
    .aeo2 .bp-eyebrow,.aeo2 .ns-eyebrow,.aeo2 .ad-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--g1);font-weight:800;margin-bottom:8px}
    .aeo2 .nextstep{position:relative;overflow:hidden;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:34px 32px;text-align:center;box-shadow:var(--sh)}
    .aeo2 .nextstep::before{content:"";position:absolute;inset:0;background:radial-gradient(60% 90% at 50% 0,rgba(118,18,250,.16),transparent 70%);pointer-events:none}
    .aeo2 .nextstep .ns-eyebrow,.aeo2 .nextstep h3,.aeo2 .nextstep .btn2{position:relative}
    .aeo2 .nextstep h3{font-size:22px;font-weight:800;margin:0 auto 18px;max-width:520px;letter-spacing:-.01em}
    .aeo2 .adfu{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:30px 32px;text-align:center;box-shadow:var(--shs)}
    .aeo2 .adfu h3{font-size:20px;font-weight:800;margin:0 auto 20px;max-width:540px;letter-spacing:-.01em}
    .aeo2 .ad-cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px}
    .aeo2 .ad-card{background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:20px;text-align:left}
    .aeo2 .ad-idx{font-size:12px;color:var(--muted);font-weight:700;letter-spacing:.05em}
    .aeo2 .ad-fig{font-size:34px;font-weight:800;letter-spacing:.1em;margin:6px 0 4px;color:var(--ink)}
    .aeo2 .ad-fig.blur{filter:blur(7px);user-select:none}
    .aeo2 .ad-lock{display:inline-block;font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
    .aeo2 .ad-label{font-weight:800;font-size:15px;margin-top:10px}
    .aeo2 .ad-card p{margin:4px 0 0;color:var(--muted);font-size:13px;line-height:1.5}
    @media(max-width:680px){.aeo2 .engines{grid-template-columns:1fr 1fr}.aeo2 .gatecard{grid-template-columns:1fr}.aeo2 .ad-cards{grid-template-columns:1fr}.aeo2 .hero{padding:42px 22px}}
    @media(max-width:460px){.aeo2 .engines{grid-template-columns:1fr}}`;
    const el = document.createElement("style");
    el.id = "aeo2-style"; el.textContent = css;
    document.head.appendChild(el);
  }

  // ── BOOT ─────────────────────────────────────────────────────────────────
  async function handleScanSubmit(e) {
    e.preventDefault();
    const input = $("#scanUrl");
    const url = (input && input.value || "").trim();
    if (!url) return;

    const parsed = parseScanInput(url);
    if (!parsed.ok) {
      showInputError(parsed.error);
      return;
    }
    clearInputError();

    showLoading(hostOf(parsed.solution_url));

    try {
      const data = await runLiveScan(parsed, (evt) => {
        if (typeof updateLoadingProgress === "function") updateLoadingProgress(evt);
      });
      // Fresh scan = fresh session state. Without this, the Genie kept serving the
      // LAST UNLOCKED brand (Kevin: "it gives the LL result regardless of page").
      try {
        localStorage.setItem("aeo_full", JSON.stringify(data));
        localStorage.removeItem("aeo_genie_result");
      } catch (_) {}
      renderFull(data);
    } catch (err) {
      stopLoading();
      const m = String(err && err.message || err);
      console.warn("scan failed:", m);
      if (m === "NO_SOLUTIONS") {
        renderUnreadable(hostOf(parsed.solution_url));
      } else if (m === "UNREACHABLE" || err.name === "AbortError") {
        renderUnreachable(hostOf(parsed.solution_url));
      } else if (m === "RATE_LIMIT") {
        // Re-show entry under a toast so they can adjust + retry.
        showEntry();
        toast("Too many scans. Give it a minute.");
      } else {
        renderGenericError("We hit an unexpected error running the scan. " + m);
      }
    }
  }

  function boot() {
    // Full report page (report.html): render the stashed scan response, ungated.
    if (document.body.hasAttribute("data-full-report")) {
      let data = null;
      try { data = JSON.parse(localStorage.getItem("aeo_full") || "null"); } catch (_) {}
      if (data && data.solutions) { renderFullReport(data); }
      else {
        const host = document.getElementById("report");
        if (host) host.innerHTML = `<div style="padding:80px 20px;text-align:center;color:#9b97a8">No report data found. <a href="scan.html" style="color:#c47bff;font-weight:700">Run a scan first</a>.</div>`;
      }
      return;
    }

    const form = $("#scanForm");
    if (form) form.addEventListener("submit", handleScanSubmit);

    const scanAnother = $("#scanAnotherBtn");
    if (scanAnother) {
      scanAnother.addEventListener("click", () => {
        showEntry();
        window.scrollTo({ top: 0 });
      });
    }

    // ?state= switch — debug-only, renders mock data without live fetch.
    const state = getState();
    if (state !== "default") {
      const mock = window.AEO_SCAN_MOCK;
      if (!mock) {
        console.warn("AEO_SCAN_MOCK not loaded — cannot render ?state=" + state);
        showEntry();
        return;
      }
      switch (state) {
        case "unreadable":
          renderUnreadable("lean-labs.com");
          return;
        case "unreachable":
          renderUnreachable("lean-labs.com");
          return;
        case "mock":
        case "results":
          renderFull(mock);
          return;
        case "loading":
          showLoading("lean-labs.com");
          return;
        default:
          renderFull(mock);
          return;
      }
    }
    showEntry();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
