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

  // How many prompt-table rows stay visible before the gate.
  const VISIBLE_PROMPT_ROWS = 2;

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

  // ── PROMPT TRACKING (derived from runs at render time) ───────────────────
  function buildPromptTracking(sol) {
    if (sol.prompt_tracking && sol.prompt_tracking.length) return sol.prompt_tracking;
    const prompts = (sol.evidence && sol.evidence.prompts) || [];
    const runs = (sol.evidence && sol.evidence.runs) || [];
    return prompts.map((p) => {
      const row = { prompt: p.prompt, intent: p.intent };
      for (const eng of ENGINE_ORDER) {
        const hit = runs.find((r) => r.prompt_id === p.id && r.engine === eng && r.mentioned);
        row[eng] = hit
          ? { status: "Cited", rank: hit.rank || null }
          : { status: "Omitted", rank: null };
      }
      return row;
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

  function promptTableHtml(sol) {
    const rows = buildPromptTracking(sol);
    if (!rows.length) return "";
    const cell = (e) => {
      const s = e && e.status ? e.status : "Omitted";
      const klass = s === "Cited" ? "pt-cited" : "pt-omitted";
      const rank = e && e.rank ? ` <span class="pt-rank">#${e.rank}</span>` : "";
      return `<td><span class="${klass}">${esc(s)}</span>${rank}</td>`;
    };
    const trs = rows.map((r, i) => `
      <tr class="${i >= VISIBLE_PROMPT_ROWS ? "locked" : ""}">
        <td class="col-prompt">"${esc(r.prompt)}"</td>
        <td class="col-intent"><span class="pt-intent">${esc(r.intent)}</span></td>
        ${cell(r.chatgpt)}${cell(r.claude)}${cell(r.perplexity)}${cell(r.gemini)}
      </tr>`).join("");

    return `
      <div class="cite-table-wrap">
        <table class="prompt-table">
          <thead>
            <tr>
              <th class="th-prompt">Prompt</th>
              <th class="th-intent">Intent</th>
              <th>ChatGPT</th><th>Claude</th><th>Perplexity</th><th>Gemini</th>
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
      </div>`;
  }

  function gateHtml(sol, idx) {
    const total = (sol.evidence && sol.evidence.prompts || []).length || 8;
    const hidden = Math.max(0, total - VISIBLE_PROMPT_ROWS);
    if (hidden === 0) return "";
    return `
      <div class="cite-gate" data-cite-gate="${idx}">
        <div class="cite-gate-lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h4 class="cite-gate-title">Which buyer questions is AI hiding you from?</h4>
        <p class="cite-gate-sub">Unlock all ${total} prompts across ChatGPT, Claude, Perplexity &amp; Gemini — and get your full report by email.</p>
        <form class="cite-gate-form" data-cite-gate-form="${idx}" autocomplete="off">
          <input type="email" class="cite-gate-email" placeholder="you@company.com" required>
          <button type="submit" class="btn-primary cite-gate-submit">Email me the full report</button>
        </form>
      </div>
      <div class="cite-gate-confirm" data-cite-gate-confirm="${idx}" hidden></div>`;
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
        ${calloutHtml(sol, brand)}
        ${promptTableHtml(sol)}
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

    wireGroups();
    wireCiteGates();
  }

  // ── WIRING ───────────────────────────────────────────────────────────────
  function openGroup(group) {
    group.classList.add("open");
    const head = group.querySelector(".check-group-head");
    if (head) head.setAttribute("aria-expanded", "true");
  }

  function wireGroups() {
    document.querySelectorAll(".check-group-head").forEach((head) => {
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
  async function runLiveScan(targetUrl) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 270000); // 270s — cold first scans take ~4 min
    try {
      const r = await fetch(API.url, {
        method: "POST",
        signal: ctl.signal,
        headers: { "Content-Type": "application/json", "X-API-Key": API.key },
        body: JSON.stringify({ url: targetUrl }),
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

  // ── MAIN RENDER ──────────────────────────────────────────────────────────
  function renderFull(data) {
    stopLoading();
    showResults();
    $("#scanState").setAttribute("hidden", "");
    $("#report").removeAttribute("hidden");

    // Compact header URL
    const urlEl = $("#compactUrl");
    const scannedUrl = data.url || ($("#scanUrl") && $("#scanUrl").value) || "https://lean-labs.com";
    if (urlEl) urlEl.textContent = scannedUrl;

    // "Results for [domain]" subtitle
    const subEl = $("#scoreSubtitle");
    if (subEl) subEl.textContent = "Results for " + hostOf(scannedUrl);

    const score = Number.isFinite(data.overall_score) ? data.overall_score : 0;
    renderGauge(score);
    $("#levelLabel").textContent = levelText(score);
    renderBrandContext(data.brand_context);

    renderSolutionTiles(data.solutions || []);
    renderSolutionSections(data);
  }

  // ── BOOT ─────────────────────────────────────────────────────────────────
  async function handleScanSubmit(e) {
    e.preventDefault();
    const input = $("#scanUrl");
    const url = (input && input.value || "").trim();
    if (!url) return;

    showLoading(hostOf(url));

    try {
      const data = await runLiveScan(url);
      renderFull(data);
    } catch (err) {
      stopLoading();
      const m = String(err && err.message || err);
      console.warn("scan failed:", m);
      if (m === "NO_SOLUTIONS") {
        renderUnreadable(hostOf(url));
      } else if (m === "UNREACHABLE" || err.name === "AbortError") {
        renderUnreachable(hostOf(url));
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
