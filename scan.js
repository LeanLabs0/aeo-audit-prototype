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

  // Live API config.
  // PROD (2026-05-29): the AEO scanner is now merged to main and deployed on Fly.
  // gpt-5.1-chat / Claude Sonnet 4.6 / Gemini 3.1-flash-lite, all web-search.
  const API = {
    url: "https://factor8-agent-sdk.fly.dev/api/v1/brand-slug/public-scanner/aeo-visibility-scan",
    key: "594aa935e360c9bf28f97437c1dddea9",
  };

  // ── Small DOM helpers ─────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  function tintClass(score) {
    if (score >= 80) return "tint-ok";
    if (score >= 50) return "tint-warn";
    return "tint-bad";
  }

  function levelText(score) {
    let n, label;
    if (score >= 80)      { n = 4; label = "AI-Optimized"; }
    else if (score >= 60) { n = 3; label = "AI-Aware"; }
    else if (score >= 40) { n = 2; label = "Basic Presence"; }
    else                  { n = 1; label = "Invisible to AI"; }
    return { n, label };
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
      <div class="brand-line">Detected: <b>${esc(ctx.category || "—")}</b> for <b>${esc(ctx.icp || "—")}</b>
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
          toast("Prompt copied — paste into ChatGPT, Claude, or your LLM of choice.");
        } catch (_) {
          toast("Couldn't copy to clipboard — try selecting manually.");
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
        <p class="state-text">Try a more specific URL — for example, a /solutions or /products page. If the homepage renders content with JavaScript, that's itself an AEO problem: AI engines see the same empty page.</p>
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
    structured_data: ["Structured data", "Schema markup"],
    entity: ["Does AI know who you are?", "Entity and authority"],
    content: ["Answer-ready content", "Extractability"],
  };
  let _modalData = {};   // qid -> {question, byEngine:{engine:{cited,text}}}

  function _leadUrl() {
    return API.url.replace(/\/api\/v1\/.*$/, "/api/v1/aeo-scan/lead");
  }
  function tone(score) { return score >= 70 ? "ok" : score >= 40 ? "warn" : "bad"; }
  function engTone(cited, total) {
    if (cited <= 0) return ["no", "✕", "Never mentions you"];
    if (cited * 2 < total) return ["mid", "◑", "Rarely"];
    if (cited < total) return ["mid", "◑", "Sometimes"];
    return ["yes", "✓", "Recommends you"];
  }

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
    const checks = (sol.checks || []).filter((c) => c.key !== "ai_citations");

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
      verdict = `AI engines <span class="hl">rarely recommend ${b}</span> for ${c} — competitors dominate the answers.`;
    else if (rate < 0.50)
      verdict = `AI <span class="hl">sometimes recommends ${b}</span> for ${c}, but competitors still win most answers.`;
    else if (rate < 0.80)
      verdict = `AI engines <span class="good">often recommend ${b}</span> for ${c} — you're a frequent pick, with room to lead.`;
    else
      verdict = `AI engines <span class="good">consistently recommend ${b}</span> for ${c}. You own this conversation.`;

    injectAeoStyles();
    report.innerHTML =
      `<div class="aeo2">` +
        heroHtml(score, lvl, verdict, citedCells, totalCells, scannedUrl, category, icp) +
        (comps.length ? compHtml(comps, brand) : "") +
        engineHtml(engCount) +
        matrixHtml(prompts, cited, brand) +
        scorecardHtml(checks) +
        ctaHtml() +
      `</div>`;
    wireAeo(brand);
  }

  function heroHtml(score, lvl, verdict, citedCells, totalCells, url, category, icp) {
    const off = 100 - Math.max(0, Math.min(100, score));
    const pct = totalCells ? Math.round((citedCells / totalCells) * 100) : 0;
    const st = tone(score); // ok/warn/bad -> color the score + level by tier, not always red
    return `
    <div class="hero">
      <div class="eyebrow">Results for ${esc(url || "your solution")}</div>
      <div class="gauge2">
        <svg viewBox="0 0 200 120"><defs><linearGradient id="aeoG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#7612fa"/><stop offset=".5" stop-color="#c109af"/><stop offset="1" stop-color="#ff6221"/>
        </linearGradient></defs>
        <path d="M10,100 A90,90 0 0 1 190,100" fill="none" stroke="#e8e8ef" stroke-width="16" stroke-linecap="round"/>
        <path class="arc" d="M10,100 A90,90 0 0 1 190,100" fill="none" stroke="url(#aeoG)" stroke-width="16" stroke-linecap="round" pathLength="100" stroke-dasharray="100" style="--off:${off}" stroke-dashoffset="${off}"/></svg>
        <div class="num"><b class="t-${st}">${score}</b><span class="of">/100</span></div>
      </div>
      <div class="level2 t-${st}">${esc(lvl.label)}, Level ${lvl.n} of 4</div>
      <h1 class="verdict">${verdict}</h1>
      <div class="appeared">You appeared in <b>${citedCells} of ${totalCells}</b> buyer searches across ChatGPT, Claude and Gemini <b>(${pct}%)</b>.</div>
      <div class="detected">Detected: <b id="detCat">${esc(category)}</b> for <b id="detIcp">${esc(icp)}</b> &nbsp;&middot;&nbsp; <span class="link2" id="refineLink">Refine</span></div>
      <div class="refine-form" id="refineForm">
        <input id="catIn" value="${esc(category)}" placeholder="Category">
        <input id="icpIn" value="${esc(icp)}" placeholder="Ideal customer (ICP)">
        <button class="btn-sm" id="rescanBtn">Re-scan</button>
      </div>
    </div>`;
  }
  function compHtml(comps, brand) {
    return `<div class="sec2"><div class="comp">
      <p class="lead">When your buyers ask AI, here is who it recommends</p>
      <div class="chips">${comps.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>
    </div></div>`;
  }
  function engineHtml(engCount) {
    const cards = ENGINES2.map(([k, label]) => {
      const c = engCount[k], [cls, ic, v] = engTone(c.cited, c.total);
      return `<div class="eng ${cls}"><div class="ename">${label}</div><div class="eic">${ic}</div>
        <div class="ev2">${v}</div><div class="erate">${c.cited} of ${c.total} questions</div></div>`;
    }).join("");
    return `<div class="sec2"><h2>Are you recommended?</h2><div class="engines">${cards}</div></div>`;
  }
  function matrixRow(p, i, cited) {
    const dots = ENGINES2.map(([k]) =>
      `<td class="cell"><span class="cdot ${cited[k + "|" + p.id] ? "yes" : "no"}"></span></td>`).join("");
    return `<tr><td class="q">${esc(p.prompt)}</td>${dots}<td class="cell"><span class="link2 viewresp" data-q="${esc(p.id)}">View response</span></td></tr>`;
  }
  function matrixHtml(prompts, cited, brand) {
    const head = `<tr><th class="q">Question</th><th>ChatGPT</th><th>Claude</th><th>Gemini</th><th></th></tr>`;
    const open = prompts.slice(0, 4).map((p, i) => matrixRow(p, i, cited)).join("");
    const rest = prompts.slice(4).map((p, i) => matrixRow(p, i, cited)).join("");
    const gate = rest ? `
      <span class="moreBtn" id="moreBtn">See all ${prompts.length} questions buyers ask AI</span>
      <tbody class="locked blur" id="locked2">${rest}</tbody>` : "";
    // gate block lives after the table
    return `<div class="sec2"><h2>The real questions your buyers ask AI</h2>
      <div class="matrix"><table class="mx"><thead>${head}</thead><tbody>${open}</tbody>${rest ? `<tbody class="locked blur" id="locked2">${rest}</tbody>` : ""}</table>
      <div class="legend"><span><i class="y"></i>Recommended you</span><span><i class="n"></i>Did not mention you</span></div>
      ${rest ? `<span class="moreBtn" id="moreBtn">See all ${prompts.length} questions buyers ask AI</span>
      <div class="gate" id="gate"><p>Enter your email to unlock all the questions and see exactly where you are missing</p>
        <div class="grow"><input id="emailIn" type="email" placeholder="you@company.com"><button class="btn-sm" id="revealBtn">Reveal all questions</button></div></div>` : ""}
      </div></div>`;
  }
  function subCard(s) {
    const pass = s.status === "pass";
    const body = pass
      ? (s.result ? `<div class="lbl">Result</div><div>${esc(s.result)}</div>` : "")
      : `${s.issue ? `<div class="lbl issue">Issue</div><div class="issue">${esc(s.issue)}</div>` : ""}${s.how_to_implement ? `<div class="lbl">How to fix</div><div>${esc(s.how_to_implement)}</div>` : ""}`;
    const res = (s.resources || []).map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)}</a>`).join("");
    return `<div class="ccard"><div class="chead"><span class="cicon ${pass ? "ok" : "bad"}">${pass ? "✓" : "✕"}</span>
      <span class="cname">${esc(s.name || s.key)}${s.goal ? `<small>${esc(s.goal)}</small>` : ""}</span><span class="chev">▾</span></div>
      <div class="cbody">${body}${res ? `<div class="res">${res}</div>` : ""}</div></div>`;
  }
  function scorecardHtml(checks) {
    if (!checks.length) return "";
    const groups = checks.map((c) => {
      const [name] = CAT_LABELS[c.key] || [c.name || c.key];
      const subs = c.subchecks || [];
      const pass = subs.filter((s) => s.status === "pass").length;
      return `<div class="cgroup"><div class="cgh"><span class="cgn">${esc(name)}</span>
        <span class="cgf ${tone(c.score)}">${pass}/${subs.length}</span></div>
        <div class="cards2">${subs.map(subCard).join("")}</div></div>`;
    }).join("");
    return `<div class="sec2"><h2>Your AEO scorecard</h2>${groups}</div>`;
  }
  function ctaHtml() {
    return `<div class="cta2"><h3>Get recommended by AI, not your competitors.</h3>
      <p>Book a free 15 minute teardown. We will show you exactly how to get cited for the searches above.</p>
      <a class="btn2" href="#">Book my teardown</a></div>`;
  }

  function wireAeo(brand) {
    const $$ = (s) => document.querySelector(s);
    const refine = $$("#refineLink");
    if (refine) refine.addEventListener("click", () => $$("#refineForm").classList.toggle("open"));
    const rescan = $$("#rescanBtn");
    if (rescan) rescan.addEventListener("click", () => {
      const cat = ($$("#catIn") && $$("#catIn").value || "").trim();
      const ic = ($$("#icpIn") && $$("#icpIn").value || "").trim();
      const input = $("#scanUrl");
      const parsed = parseScanInput((input && input.value) || "");
      if (!parsed.ok) { showInputError(parsed.error); return; }
      showLoading(hostOf(parsed.solution_url));
      runLiveScan(parsed, updateLoadingProgress, { category: cat, icp: ic })
        .then(renderFull).catch((e) => renderGenericError(String(e && e.message || e)));
    });
    const more = $$("#moreBtn");
    if (more) more.addEventListener("click", function () {
      $$("#locked2").classList.add("open");
      $$("#gate").classList.add("show");
      this.style.display = "none";
    });
    const reveal = $$("#revealBtn");
    if (reveal) reveal.addEventListener("click", () => {
      const email = ($$("#emailIn").value || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("Enter a valid email"); return; }
      try {
        fetch(_leadUrl(), { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": API.key },
          body: JSON.stringify({ email: email, url: ($("#scanUrl") && $("#scanUrl").value) || "" }) }).catch(() => {});
      } catch (_) {}
      $$("#locked2").classList.remove("blur");
      $$("#gate").classList.remove("show");
      toast("Unlocked. Here is every question your buyers ask AI.");
    });
    document.querySelectorAll(".aeo2 .chead").forEach((h) =>
      h.addEventListener("click", () => h.parentElement.classList.toggle("open")));
    document.querySelectorAll(".aeo2 .viewresp").forEach((v) =>
      v.addEventListener("click", () => openRespModal(v.getAttribute("data-q"), brand)));
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
    .aeo2{--ink:#1a1726;--muted:#76728a;--line:#efedf4;--card:#fff;--bad:#d6453d;--warn:#cf8a1e;--ok:#1f9d61;
      --g1:#7612fa;--grad:linear-gradient(100deg,#7612fa,#c109af 52%,#ff6221);
      --sh:0 1px 2px rgba(26,23,38,.04),0 16px 36px -20px rgba(26,23,38,.20);
      --shs:0 1px 2px rgba(26,23,38,.05),0 8px 20px -14px rgba(26,23,38,.14);
      color:var(--ink);max-width:900px;margin:0 auto;padding:8px 0 90px;letter-spacing:.002em}
    .aeo2 *{box-sizing:border-box}
    .aeo2 .hero{position:relative;overflow:hidden;background:var(--card);border:1px solid var(--line);border-radius:26px;padding:60px 40px 52px;margin-top:18px;text-align:center;box-shadow:var(--sh)}
    .aeo2 .hero::before{content:"";position:absolute;left:0;right:0;top:-40%;height:90%;background:radial-gradient(50% 70% at 50% 50%,rgba(193,9,175,.08),transparent 65%);pointer-events:none}
    .aeo2 .eyebrow{font-size:11.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:600}
    .aeo2 .gauge2{width:258px;margin:28px auto 0;position:relative}
    .aeo2 .gauge2 svg{width:100%;display:block}
    .aeo2 .gauge2 .arc{filter:drop-shadow(0 5px 12px rgba(193,9,175,.32));animation:aeoArc 1.15s cubic-bezier(.22,1,.36,1) .25s both}
    @keyframes aeoArc{from{stroke-dashoffset:100}to{stroke-dashoffset:var(--off)}}
    .aeo2 .gauge2 .num{position:absolute;left:0;right:0;top:52%;text-align:center}
    .aeo2 .gauge2 .num b{font-size:58px;font-weight:800;letter-spacing:-.02em;color:var(--bad)}
    .aeo2 .gauge2 .num .of{font-size:16px;color:var(--muted);font-weight:600}
    .aeo2 .level2{font-weight:800;color:var(--bad);font-size:15px;margin-top:14px}
    .aeo2 .verdict{font-size:26px;line-height:1.26;font-weight:800;letter-spacing:-.02em;margin:24px auto 0;max-width:660px}
    .aeo2 .verdict .hl{color:var(--bad)}
    .aeo2 .appeared{font-size:16px;margin-top:18px}.aeo2 .appeared b{font-weight:800}
    .aeo2 .detected{margin-top:24px;font-size:14px;color:var(--muted)}.aeo2 .detected b{color:var(--ink)}
    .aeo2 .link2{color:var(--g1);font-weight:700;cursor:pointer}
    .aeo2 .refine-form{display:none;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:18px}
    .aeo2 .refine-form.open{display:flex}
    .aeo2 .refine-form input{padding:11px 13px;border:1px solid var(--line);border-radius:10px;font-size:14px;min-width:230px}
    .aeo2 .btn-sm{background:var(--grad);color:#fff;border:none;border-radius:10px;padding:11px 20px;font-weight:700;cursor:pointer;transition:transform .15s,filter .15s}
    .aeo2 .btn-sm:hover{transform:translateY(-1px);filter:brightness(1.05)}
    .aeo2 .sec2{margin-top:40px}
    .aeo2 .sec2 h2{font-size:24px;font-weight:800;letter-spacing:-.02em;margin:0 0 18px}
    .aeo2 .comp{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:26px 28px;box-shadow:var(--shs)}
    .aeo2 .comp .lead{font-size:20px;font-weight:800;margin:0 0 16px;letter-spacing:-.01em}
    .aeo2 .chips{display:flex;flex-wrap:wrap;gap:10px}
    .aeo2 .chip{padding:9px 16px;border-radius:999px;background:#f3f0fb;border:1px solid #e4ddf7;font-weight:700;font-size:15px;transition:transform .15s}
    .aeo2 .chip:hover{transform:translateY(-2px)}
    .aeo2 .chip:first-child{background:var(--grad);color:#fff;border:none;box-shadow:0 10px 22px -10px rgba(193,9,175,.6)}
    .aeo2 .engines{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
    .aeo2 .eng{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;text-align:center;box-shadow:var(--shs);transition:transform .18s,box-shadow .18s}
    .aeo2 .eng:hover{transform:translateY(-3px);box-shadow:var(--sh)}
    .aeo2 .ename{font-weight:800;font-size:15px}.aeo2 .eic{font-size:28px;line-height:1;margin:10px 0 5px}
    .aeo2 .ev2{font-weight:700;font-size:14px}
    .aeo2 .eng.no .ev2{color:var(--bad)}.aeo2 .eng.mid .ev2{color:var(--warn)}.aeo2 .eng.yes .ev2{color:var(--ok)}
    .aeo2 .erate{color:var(--muted);font-size:13px;margin-top:3px}
    .aeo2 .matrix{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:8px 24px 24px;box-shadow:var(--shs)}
    .aeo2 table.mx{width:100%;border-collapse:collapse}
    .aeo2 table.mx th{font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:14px 6px;text-align:center}
    .aeo2 table.mx th.q{text-align:left}
    .aeo2 table.mx td{padding:13px 6px;border-top:1px solid var(--line);font-size:14.5px;vertical-align:middle}
    .aeo2 table.mx td.q{padding-right:14px}.aeo2 table.mx td.cell{text-align:center;width:92px}
    .aeo2 .cdot{display:inline-block;width:16px;height:16px;border-radius:50%}
    .aeo2 .cdot.yes{background:var(--ok);box-shadow:0 0 0 4px rgba(31,157,97,.14)}
    .aeo2 .cdot.no{background:#fff;border:2px solid #e0dde9}
    .aeo2 .viewresp{font-weight:700;font-size:13px}
    .aeo2 .legend{display:flex;gap:18px;justify-content:flex-end;font-size:12px;color:var(--muted);margin-top:12px}
    .aeo2 .legend i{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;vertical-align:-1px}
    .aeo2 .legend .y{background:var(--ok)}.aeo2 .legend .n{background:#fff;border:2px solid #e0dde9}
    .aeo2 .moreBtn{display:inline-block;margin-top:16px;color:var(--g1);font-weight:700;font-size:14px;cursor:pointer}
    .aeo2 .locked{display:none}.aeo2 .locked.open{display:table-row-group}
    .aeo2 .locked.open.blur td.q,.aeo2 .locked.open.blur td.cell{filter:blur(5px)}
    .aeo2 .gate{display:none;margin-top:18px;background:#faf8ff;border:1px solid #e4ddf7;border-radius:14px;padding:22px;text-align:center}
    .aeo2 .gate.show{display:block}.aeo2 .gate p{margin:0 0 14px;font-weight:700}
    .aeo2 .gate .grow{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    .aeo2 .gate input{padding:12px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px;min-width:260px}
    .aeo2 .cgroup{margin-bottom:22px}
    .aeo2 .cgh{display:flex;justify-content:space-between;align-items:center;margin:0 4px 12px}
    .aeo2 .cgn{font-weight:800;font-size:16px}
    .aeo2 .cgf{font-weight:800;font-size:14px;padding:3px 10px;border-radius:8px}
    .aeo2 .cgf.ok{color:var(--ok);background:#eafaf1}.aeo2 .cgf.warn{color:var(--warn);background:#fdf3e3}.aeo2 .cgf.bad{color:var(--bad);background:#fdeced}
    .aeo2 .cards2{display:flex;flex-direction:column;gap:12px}
    .aeo2 .ccard{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:var(--shs);transition:box-shadow .18s}
    .aeo2 .ccard:hover{box-shadow:var(--sh)}
    .aeo2 .chead{display:flex;align-items:center;gap:14px;padding:16px 18px;cursor:pointer}
    .aeo2 .cicon{width:28px;height:28px;flex:0 0 28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}
    .aeo2 .cicon.ok{background:var(--ok)}.aeo2 .cicon.bad{background:var(--bad)}
    .aeo2 .cname{flex:1;font-weight:800;font-size:15.5px}
    .aeo2 .cname small{display:block;font-weight:600;color:var(--muted);font-size:12.5px;margin-top:1px}
    .aeo2 .chev{color:var(--muted);transition:transform .15s;font-size:13px}
    .aeo2 .ccard.open .chev{transform:rotate(180deg)}
    .aeo2 .cbody{display:none;padding:0 18px 18px 60px}.aeo2 .ccard.open .cbody{display:block}
    .aeo2 .cbody .lbl{font-weight:700;margin-top:12px}.aeo2 .cbody .issue{color:var(--bad)}
    .aeo2 .res{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .aeo2 .res a{font-size:13px;color:#ff6221;border:1px solid #f0d9cc;border-radius:8px;padding:5px 10px;text-decoration:none}
    .aeo2 .cta2{margin-top:42px;background:var(--grad);border-radius:22px;padding:40px;text-align:center;color:#fff;box-shadow:0 26px 54px -22px rgba(193,9,175,.6)}
    .aeo2 .cta2 h3{font-size:26px;margin:0 0 8px;font-weight:800;letter-spacing:-.01em}
    .aeo2 .cta2 p{margin:0 0 20px;opacity:.92}
    .aeo2 .btn2{display:inline-block;background:#fff;color:var(--g1);font-weight:800;padding:15px 30px;border-radius:12px;text-decoration:none;transition:transform .15s}
    .aeo2 .btn2:hover{transform:translateY(-2px)}
    .aeo2.overlay{display:none;position:fixed;inset:0;background:rgba(26,23,38,.55);z-index:9999;justify-content:center;padding:40px 16px;overflow:auto;max-width:none}
    .aeo2.overlay.show{display:flex}
    .aeo2 .modal{background:#fff;border-radius:18px;max-width:760px;width:100%;padding:24px 28px 28px;height:max-content;box-shadow:0 20px 60px rgba(0,0,0,.3)}
    .aeo2 .modal .x{float:right;cursor:pointer;color:var(--muted);font-size:24px;line-height:1;border:none;background:none}
    .aeo2 .modal .meyebrow{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
    .aeo2 .modal .mq{font-size:19px;font-weight:800;margin:4px 30px 4px 0}
    .aeo2 .eblock{margin-top:18px;border:1px solid var(--line);border-radius:14px;padding:16px 18px}
    .aeo2 .eblock .eh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
    .aeo2 .eblock .en{font-weight:800;font-size:15px}
    .aeo2 .eblock .cited{font-weight:800;font-size:13px;padding:4px 11px;border-radius:999px}
    .aeo2 .eblock .cited.no{color:var(--bad);background:#fbeae9}.aeo2 .eblock .cited.yes{color:var(--ok);background:#e7f6ee}
    .aeo2 .eblock .miss{background:#fdeced;color:var(--bad);font-weight:700;font-size:13px;border-radius:8px;padding:8px 12px;margin-bottom:10px}
    .aeo2 .eblock .resp{font-size:14px;line-height:1.6;color:#33303f;white-space:pre-wrap;max-height:230px;overflow:auto;background:#faf9fc;border-radius:10px;padding:12px 14px}
    .aeo2 mark.brand{background:#eafaf1;color:#176c43;font-weight:700;padding:0 3px;border-radius:3px}
    /* score/level/verdict tiered by result (not always red) */
    .aeo2 .gauge2 .num b.t-ok{color:var(--ok)} .aeo2 .gauge2 .num b.t-warn{color:var(--warn)} .aeo2 .gauge2 .num b.t-bad{color:var(--bad)}
    .aeo2 .level2.t-ok{color:var(--ok)} .aeo2 .level2.t-warn{color:var(--warn)} .aeo2 .level2.t-bad{color:var(--bad)}
    .aeo2 .verdict .good{color:var(--ok)}
    @media(max-width:640px){.aeo2 .engines{grid-template-columns:1fr}.aeo2 .hero{padding:40px 22px}}`;
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
        toast("Too many scans — give it a minute.");
      } else {
        renderGenericError("We hit an unexpected error running the scan. " + m);
      }
    }
  }

  function boot() {
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
