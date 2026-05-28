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

  // Live API config.
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
    if (score >= 80) return "Level 4 · AI-Optimized";
    if (score >= 60) return "Level 3 · AI-Aware";
    if (score >= 40) return "Level 2 · Basic Presence";
    return "Level 1 · Invisible to AI";
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
          <div class="gauge-score">${score}<span class="gauge-of">/100</span></div>
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
        // AI Citations tile scrolls to the bottom "What we found" table —
        // the drill-down panel for it is no longer rendered (data lives below).
        if (/^cat-ai-citations\b/.test(target || "")) {
          const checks = document.getElementById("checks");
          const firstSol = checks && checks.querySelector(".sol-group");
          const dest = firstSol || checks;
          if (dest) dest.scrollIntoView({ behavior: "smooth", block: "start" });
          host.querySelectorAll("[data-cat-tile]").forEach((t) =>
            t.setAttribute("aria-expanded", t === tile ? "true" : "false"));
          return;
        }
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
  function _subcheckCard(sub) {
    const isPass = sub.status === "pass";
    const statusIcon = isPass
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
    const badge = isPass
      ? `<span class="card-badge badge-pass">Pass</span>`
      : `<span class="card-badge badge-fail">Fix</span>`;
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
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1"/></svg>
           ${esc(r.label)}
         </a>`).join("");
      resourceBlock = `
        <div class="card-section">
          <div class="card-label">Resources</div>
          <div class="resource-chips">${chips}</div>
        </div>`;
    }
    return `
      <div class="scan-card ${isPass ? "" : "scan-card--fail"}">
        <div class="scan-card-head" role="presentation">
          <span class="card-status ${isPass ? "status-pass" : "status-fail"}" aria-hidden="true">${statusIcon}</span>
          <span class="card-name">${esc(sub.name || sub.key || "Check")}</span>
          ${badge}
        </div>
        <div class="scan-card-body subcheck-body-open">
          ${goalBlock}
          ${bodyBlocks}
          ${resourceBlock}
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
              <span class="check-group-passing">${pass} of ${total} passing</span>
              <span class="check-group-score ${tintClass(score)}">${score}/100</span>
              <svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          </button>
          <div class="check-group-body">${body}</div>
        </div>`;
    }).join("");

    wireGroups($("#categoryDetails"));
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

  // verbatim_omitted = longest raw_response from a mentioned:false run, or null.
  function buildVerbatim(sol) {
    if (sol.verbatim_omitted) return sol.verbatim_omitted;
    const runs = (sol.evidence && sol.evidence.runs) || [];
    const fails = runs.filter((r) => r.mentioned === false && r.raw_response);
    if (!fails.length) return null;
    fails.sort((a, b) => (b.raw_response || "").length - (a.raw_response || "").length);
    const top = fails[0];
    return {
      engine: ENGINE_LABELS[top.engine] || top.engine,
      text: (top.raw_response || "").slice(0, 700),
    };
  }

  // ── PER-SOLUTION SECTION (collapsible) ───────────────────────────────────
  function competitorsHtml(sol) {
    const list = (sol.competitors || []).filter(Boolean);
    if (!list.length) return "";
    const chips = list.map((c) => `<span class="competitor-chip">${esc(c)}</span>`).join("");
    return `
      <div class="sol-competitors">
        <span class="sol-competitors-label">Surfaced by AI:</span>
        <span class="competitor-chips">${chips}</span>
      </div>`;
  }

  function calloutHtml(sol, brand) {
    const v = buildVerbatim(sol);
    if (!v) return "";
    const buyerCategory = truncate(sol.title || "this solution", 60);
    return `
      <div class="cite-callout">
        <div class="cite-callout-head">When buyers ask AI about <b>${esc(buyerCategory)}</b>, here's what they see —</div>
        <div class="cite-verbatim"><span class="cite-engine">${esc(v.engine)}</span>${esc(v.text)}</div>
        <div class="cite-omitted-line">${esc(brand)} was not mentioned. Your competitors were.</div>
      </div>`;
  }

  function promptTableHtml(sol, brandName) {
    const ev = (sol && sol.evidence) || {};
    const prompts = ev.prompts || [];
    const runs = ev.runs || [];
    if (!prompts.length) return "";
    // Index brand mentions + per-prompt competitor list.
    const citedByPrompt = new Set();
    const brandsByPrompt = new Map(); // prompt_id -> Map(brand -> count)
    for (const r of runs) {
      if (!r) continue;
      if (r.mentioned) citedByPrompt.add(r.prompt_id);
      const brands = extractBrandsFromText(r.raw_response, brandName, 6);
      if (!brandsByPrompt.has(r.prompt_id)) brandsByPrompt.set(r.prompt_id, new Map());
      const map = brandsByPrompt.get(r.prompt_id);
      for (const b of brands) map.set(b, (map.get(b) || 0) + 1);
    }
    function topBrands(pid, n = 4) {
      const map = brandsByPrompt.get(pid) || new Map();
      return [...map.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name]) => name)
        .slice(0, n);
    }
    const brandLabel = brandName || "You";
    const headerCited = `${esc(brandLabel)} Cited`;
    return `
      <div class="prompts-table-wrap">
        <table class="prompts-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-q">Question</th>
              <th class="col-comp">Competitors Mentioned</th>
              <th class="col-cited">${headerCited}</th>
            </tr>
          </thead>
          <tbody>
            ${prompts.map((p, i) => {
              const comps = topBrands(p.id, 4);
              const cited = citedByPrompt.has(p.id);
              return `
                <tr>
                  <td class="col-num">${i + 1}</td>
                  <td class="col-q">${esc(p.prompt)}</td>
                  <td class="col-comp">${comps.length ? comps.map(esc).join(", ") : "<span class='muted'>—</span>"}</td>
                  <td class="col-cited ${cited ? "yes" : "no"}">${cited ? "Yes" : "No"}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function gateHtml(sol, idx) {
    // Email gate hidden for now — Ralph wants to gate later, not inline beneath
    // the prompts table. Keeping the function so callers don't need to change.
    return "";
  }

  function renderSolutionSections(data) {
    const host = $("#checks");
    const solutions = data.solutions || [];
    const brand = (data.brand_context && data.brand_context.brand) || "Your brand";

    if (!solutions.length) {
      host.innerHTML = `
        <div class="state-card state-card--bad inline-empty">
          <h2 class="state-title">No solution pages detected</h2>
          <p class="state-text">We couldn't pull solution pages from this homepage. Try a more specific URL — for example, a /solutions or /products page.</p>
        </div>`;
      return;
    }

    host.innerHTML = solutions.map((sol, i) => {
      const score = Number.isFinite(sol.score) ? sol.score : 0;
      const targetId = `sol-${i}-${slugify(sol.title || "solution").slice(0, 32)}`;
      const isFirst = i === 0;
      const title = truncate(sol.title || sol.url || `Solution ${i + 1}`, 80);

      const inner = `
        ${competitorsHtml(sol)}
        ${promptTableHtml(sol, brand)}
        ${gateHtml(sol, i)}
      `;

      return `
        <div class="check-group sol-group ${isFirst ? "open" : ""}" id="${esc(targetId)}">
          <button type="button" class="check-group-head" aria-expanded="${isFirst ? "true" : "false"}">
            <span class="check-group-name">${esc(title)}</span>
            <span class="check-group-meta">
              <span class="check-group-passing">Cited by ${enginesCited(sol)} of 4 engines</span>
              <span class="check-group-score ${tintClass(score)}">${score}/100</span>
              <svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          </button>
          <div class="check-group-body">${inner}</div>
        </div>`;
    }).join("");

    wireGroups(document.getElementById("checks"));
    wireCiteGates();
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

  function wireCiteGates() {
    document.querySelectorAll("[data-cite-gate-form]").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const idx = form.getAttribute("data-cite-gate-form");
        const group = form.closest(".check-group");
        if (group) group.querySelectorAll("tr.locked").forEach((tr) => tr.classList.remove("locked"));
        const gate = document.querySelector(`[data-cite-gate="${idx}"]`);
        if (gate) gate.setAttribute("hidden", "");
        const conf = document.querySelector(`[data-cite-gate-confirm="${idx}"]`);
        if (conf) {
          conf.innerHTML = `<span class="gate-check">✓</span> Sent — check your inbox.`;
          conf.removeAttribute("hidden");
        }
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

  // ── LOADING SCREEN (cycles messages every 4s) ────────────────────────────
  const LOADING_MESSAGES = [
    "Detecting your solutions…",
    "Asking ChatGPT, Claude, Perplexity & Gemini…",
    "Counting mentions across runs…",
    "Compiling your scan…",
  ];

  let _loadingTimer = null;

  function showLoading(url) {
    showResults();
    $("#report").setAttribute("hidden", "");
    const sec = $("#scanState");
    sec.removeAttribute("hidden");
    let idx = 0;
    sec.innerHTML = `
      <div class="state-card state-card--loading">
        <div class="loader-pulse" aria-hidden="true">
          <svg viewBox="0 0 60 60" class="loader-svg">
            <circle cx="30" cy="30" r="22" fill="none" stroke="url(#llGradLoad)" stroke-width="4" stroke-linecap="round" stroke-dasharray="60 200">
              <animateTransform attributeName="transform" type="rotate" from="0 30 30" to="360 30 30" dur="1.2s" repeatCount="indefinite"/>
            </circle>
            <defs>
              <linearGradient id="llGradLoad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#7612fa"/><stop offset="0.5" stop-color="#c109af"/><stop offset="1" stop-color="#ff6221"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h2 class="state-title">Scanning <b>${esc(url)}</b></h2>
        <p class="state-text loader-msg" id="loaderMsg">${esc(LOADING_MESSAGES[0])}</p>
        <p class="state-foot">This usually takes 30s–4 min. We're running real prompts against real AI engines.</p>
      </div>`;
    if (_loadingTimer) clearInterval(_loadingTimer);
    _loadingTimer = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      const el = document.getElementById("loaderMsg");
      if (el) el.textContent = LOADING_MESSAGES[idx];
    }, 4000);
  }

  function stopLoading() {
    if (_loadingTimer) {
      clearInterval(_loadingTimer);
      _loadingTimer = null;
    }
  }

  // ── LIVE FETCH ────────────────────────────────────────────────────────────
  // Single-solution payload — homepage drives brand inference, solutions=[ONE
  // deep URL] forces a one-solution scan. Optional category/icp overrides.
  async function runLiveScan(parsed) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 120000); // 120s — single-solution is fast
    const catInput = ($("#inputCategory") && $("#inputCategory").value || "").trim();
    const icpInput = ($("#inputIcp") && $("#inputIcp").value || "").trim();
    const body = {
      url: parsed.homepage,
      solutions: [parsed.solution_url],
    };
    if (catInput) body.category = catInput;
    if (icpInput) body.icp = icpInput;
    try {
      const r = await fetch(API.url, {
        method: "POST",
        signal: ctl.signal,
        headers: { "Content-Type": "application/json", "X-API-Key": API.key },
        body: JSON.stringify(body),
      });
      if (r.status === 429) throw new Error("RATE_LIMIT");
      if (r.status === 502) throw new Error("UNREACHABLE");
      if (r.status === 422) throw new Error("NO_SOLUTIONS");
      if (!r.ok) throw new Error(`scan ${r.status}`);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
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

  // ── MAIN RENDER ──────────────────────────────────────────────────────────
  function renderFull(data) {
    stopLoading();
    showResults();
    $("#scanState").setAttribute("hidden", "");
    $("#report").removeAttribute("hidden");

    const solutions = data.solutions || [];
    const isSingle = solutions.length === 1;

    // Compact header URL — show the deep solution URL when single-solution.
    const urlEl = $("#compactUrl");
    const fallbackUrl = ($("#scanUrl") && $("#scanUrl").value) || "https://lean-labs.com";
    const scannedUrl = isSingle
      ? (solutions[0].url || data.url || fallbackUrl)
      : (data.url || fallbackUrl);
    if (urlEl) urlEl.textContent = scannedUrl;

    // Subtitle — single-solution shows solution title; multi shows host.
    const subEl = $("#scoreSubtitle");
    if (subEl) {
      if (isSingle) {
        const title = truncate(solutions[0].title || solutions[0].url || "your solution", 60);
        subEl.textContent = "Results for " + title;
      } else {
        subEl.textContent = "Results for " + hostOf(scannedUrl);
      }
    }

    const score = Number.isFinite(data.overall_score) ? data.overall_score : 0;
    renderGauge(score);
    $("#levelLabel").textContent = levelText(score);
    renderBrandContext(data.brand_context);

    // Tiles row. Single-solution → 4 AEO category tiles from solutions[0].checks.
    // Multi-solution (rare) → one tile per solution.
    const tilesSection = document.getElementById("categoriesSection");
    const detailsSection = document.getElementById("categoryDetailsSection");
    const titleEl = document.getElementById("categoriesTitle");
    const subEl2 = document.getElementById("categoriesSub");
    const detailsHost = document.getElementById("categoryDetails");

    if (isSingle) {
      const checks = (solutions[0] && solutions[0].checks) || [];
      const brand = (data.brand_context && data.brand_context.brand) || "Your brand";
      if (tilesSection) tilesSection.removeAttribute("hidden");
      if (titleEl) titleEl.textContent = "What we found";
      if (subEl2) subEl2.textContent = "Tap a card to see every check and how to fix it.";
      renderCategoryTiles(checks);
      if (detailsSection) {
        if (checks.length) detailsSection.removeAttribute("hidden");
        else detailsSection.setAttribute("hidden", "");
      }
      renderCategoryDetails(checks, solutions[0], brand);
    } else {
      if (tilesSection) tilesSection.removeAttribute("hidden");
      if (titleEl) titleEl.textContent = "Your solutions in AI search";
      if (subEl2) subEl2.textContent = "Tap a solution to see the prompts, the verbatim AI response, and who got cited instead of you.";
      renderSolutionTiles(solutions);
      if (detailsSection) detailsSection.setAttribute("hidden", "");
      if (detailsHost) detailsHost.innerHTML = "";
    }

    renderSolutionSections(data);
    renderScanAnotherCta(isSingle);
  }

  // Render the secondary "Scan another solution" button in the CTA band when
  // single-solution. Removes it when not.
  function renderScanAnotherCta(isSingle) {
    const ctaInner = document.querySelector(".cta-band-inner");
    if (!ctaInner) return;
    let btn = document.getElementById("scanAnotherSolutionBtn");
    if (!isSingle) {
      if (btn) btn.remove();
      return;
    }
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "scanAnotherSolutionBtn";
      btn.type = "button";
      btn.className = "cta-band-secondary";
      btn.textContent = "Scan another solution →";
      ctaInner.appendChild(btn);
    }
    btn.onclick = () => {
      const input = document.getElementById("scanUrl");
      if (input) input.value = "";
      clearInputError();
      showEntry();
      window.scrollTo({ top: 0 });
      if (input) input.focus();
    };
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
      const data = await runLiveScan(parsed);
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
