/* scan.js — static AEO scanner mockup renderer (Jonathan v3).
 * No network calls. Reads window.AEO_SCAN_MOCK + ?state= switch.
 *
 * v3 changes:
 *  - No letter grade chip; eyebrow "OVERALL SCORE" above the gauge.
 *  - 5 categories render as clickable SUMMARY TILES (donut + name + score +
 *    one-line summary). Detail blocks below are COLLAPSED by default.
 *  - AI Citations detail block is open by default as the hook (unblurred):
 *    callout + verbatim + prompt table with first 2 rows shown, rest .locked.
 *  - Teaser: exactly 2 sub-check cards unblurred across the rest of the report
 *    (one passing green, one failing red). Everything else is .locked (blurred).
 *  - One email gate (#gateBanner) over the blurred region; on submit it removes
 *    .locked everywhere, hides the gate, shows a "Sent to {email}" confirmation.
 *  - No per-card "Book a meeting" button. One consolidated CTA up near summaries.
 */
(function () {
  "use strict";

  const ENGINE_LABELS = { chatgpt: "ChatGPT", claude: "Claude", perplexity: "Perplexity", gemini: "Gemini" };

  // The 2 unblurred teaser cards (one pass, one fail) by subcheck key.
  const TEASER_PASS_KEY = "organization_schema"; // green teaser
  const TEASER_FAIL_KEY = "wikidata";            // red teaser

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

  function passCount(cat) {
    const subs = cat.subchecks || [];
    const pass = subs.filter((s) => s.status === "pass").length;
    return { pass, total: subs.length };
  }

  // Derive the one-line summary text shown under each category tile.
  function summaryLine(cat, masked) {
    if (masked) return "AI citation test at capacity — try again later.";
    const { pass, total } = passCount(cat);
    if (cat.key === "ai_citations") return `Cited in ${pass} of 4 AI engines`;
    return `${pass} of ${total} checks passing`;
  }

  // ── State switch ───────────────────────────────────────────────────────
  function getState() {
    const m = new URLSearchParams(window.location.search).get("state");
    return m || "default";
  }

  // ── GAUGE (no grade chip) ──────────────────────────────────────────────
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
    host.innerHTML = `
      <div class="brand-line">Detected: <b>${esc(ctx.category)}</b> for <b>${esc(ctx.icp)}</b>
        · <button type="button" class="link-btn" id="refineBtn">refine</button></div>`;
    const btn = $("#refineBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        // "refine" reveals + scrolls to the same pre-run inputs in the hero.
        const panel = $("#ctxPanel"), toggle = $("#ctxToggle");
        if (panel && panel.hasAttribute("hidden")) openCtxPanel(panel, toggle);
        const hero = $(".hero-context");
        if (hero) hero.scrollIntoView({ behavior: "smooth", block: "center" });
        const cat = $("#inputCategory");
        if (cat) cat.focus();
      });
    }
  }

  // ── PRE-RUN OPTIONAL INPUTS (hero) ──────────────────────────────────────
  function openCtxPanel(panel, toggle) {
    panel.removeAttribute("hidden");
    toggle.setAttribute("aria-expanded", "true");
    const sign = toggle.querySelector(".ctx-toggle-sign");
    if (sign) sign.textContent = "–";
  }
  function closeCtxPanel(panel, toggle) {
    panel.setAttribute("hidden", "");
    toggle.setAttribute("aria-expanded", "false");
    const sign = toggle.querySelector(".ctx-toggle-sign");
    if (sign) sign.textContent = "+";
  }
  function wireCtxToggle() {
    const toggle = $("#ctxToggle"), panel = $("#ctxPanel");
    if (!toggle || !panel) return;
    toggle.addEventListener("click", () => {
      if (panel.hasAttribute("hidden")) openCtxPanel(panel, toggle);
      else closeCtxPanel(panel, toggle);
    });
  }

  // ── CATEGORY SUMMARY TILES ──────────────────────────────────────────────
  function donutSvg(score, masked) {
    const r = 26, c = 2 * Math.PI * r;
    const pct = masked ? 0 : Math.max(0, Math.min(100, score)) / 100;
    const dash = c * pct;
    const display = masked ? "—" : score;
    return `
      <svg viewBox="0 0 64 64" class="donut-svg ${masked ? "donut-masked" : tintClass(score)}" aria-hidden="true">
        <circle cx="32" cy="32" r="${r}" fill="none" stroke="#e8e8ef" stroke-width="6"/>
        <circle class="donut-ring" cx="32" cy="32" r="${r}" fill="none" stroke="currentColor" stroke-width="6"
                stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${c.toFixed(2)}"
                transform="rotate(-90 32 32)"/>
        <text x="32" y="32" class="donut-num" text-anchor="middle" dominant-baseline="central">${display}</text>
      </svg>`;
  }

  function renderCategories(checks, opts) {
    const host = $("#categories");
    const capacityCitations = opts && opts.citationCapacity;
    host.innerHTML = checks.map((cat) => {
      const masked = capacityCitations && cat.key === "ai_citations";
      const line = summaryLine(cat, masked);
      const scoreChip = masked
        ? `<span class="cat-score-chip tint-muted">—</span>`
        : `<span class="cat-score-chip ${tintClass(cat.score)}">${cat.score}</span>`;
      return `
        <button type="button" class="cat-card" data-cat-tile data-target="cat-${esc(cat.key)}" aria-expanded="false">
          <div class="cat-donut">${donutSvg(cat.score, masked)}</div>
          <div class="cat-label">${esc(cat.name)}</div>
          ${scoreChip}
          <span class="cat-summary">${esc(line)}</span>
        </button>`;
    }).join("");

    host.querySelectorAll("[data-cat-tile]").forEach((tile) => {
      tile.addEventListener("click", () => {
        const target = tile.getAttribute("data-target");
        const group = document.getElementById(target);
        if (!group) return;
        // Expand the detail block + smooth scroll to it.
        openGroup(group);
        host.querySelectorAll("[data-cat-tile]").forEach((t) =>
          t.setAttribute("aria-expanded", t === tile ? "true" : t.getAttribute("aria-expanded")));
        tile.setAttribute("aria-expanded", "true");
        group.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // ── CITATION EXTRA (Jonathan block, inside AI Citations) ─────────────────
  // First 2 prompt rows unblurred; remaining rows get .locked.
  function citationExtraHtml(data) {
    const extra = data.citation_extra;
    if (!extra) return "";
    const v = extra.verbatim_omitted;
    const brand = data.brand_context.brand;
    const category = data.brand_context.category;

    const cell = (engine) => {
      const s = engine.status;
      const klass = s === "Cited" ? "pt-cited" : "pt-omitted";
      const rank = engine.rank ? ` <span class="pt-rank">#${engine.rank}</span>` : "";
      return `<td><span class="${klass}">${esc(s)}</span>${rank}</td>`;
    };

    const rows = extra.prompt_tracking.map((r, i) => `
      <tr class="${i >= 2 ? "locked" : ""}">
        <td class="col-prompt">"${esc(r.prompt)}"</td>
        <td class="col-intent"><span class="pt-intent">${esc(r.intent)}</span></td>
        ${cell(r.chatgpt)}${cell(r.claude)}${cell(r.perplexity)}${cell(r.gemini)}
      </tr>`).join("");

    return `
      <div class="cite-extra">
        <div class="cite-callout">
          <div class="cite-callout-head">When buyers ask AI about <b>${esc(category)}</b>, here's what they see —</div>
          <div class="cite-verbatim"><span class="cite-engine">${esc(ENGINE_LABELS[String(v.engine).toLowerCase()] || v.engine)}</span>${esc(v.text)}</div>
          <div class="cite-omitted-line">${esc(brand)} was not mentioned. Your competitors were.</div>
        </div>

        <div class="cite-table-wrap">
          <table class="prompt-table">
            <thead>
              <tr>
                <th class="th-prompt">Prompt</th>
                <th class="th-intent">Intent</th>
                <th>ChatGPT</th><th>Claude</th><th>Perplexity</th><th>Gemini</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── SUB-CHECK CARDS (no per-card book button) ────────────────────────────
  function iconSvg(pass) {
    if (pass) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 2.5 2.5L16 9"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6m0-6 6 6"/></svg>`;
  }

  function resourcesHtml(resources) {
    if (!resources || !resources.length) return "";
    const chips = resources.map((r) =>
      `<a class="resource-chip" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7m0 0H8m9 0v9"/></svg>
      </a>`).join("");
    return `
      <div class="card-section">
        <div class="card-label">Resources</div>
        <div class="resource-chips">${chips}</div>
      </div>`;
  }

  // teaser = true → unblurred & expanded; teaser = false → blurred (.locked) & collapsed.
  function cardHtml(sub, teaser) {
    const pass = sub.status === "pass";
    const openClass = teaser ? " open" : "";
    const lockedClass = teaser ? "" : " locked";
    const expanded = teaser ? "true" : "false";

    let body = `
      <div class="card-section">
        <div class="card-label">Goal</div>
        <p class="card-text">${esc(sub.goal)}</p>
      </div>`;

    if (pass) {
      body += `
        <div class="card-section">
          <div class="card-label">Result</div>
          <p class="result-text">${esc(sub.result)}</p>
        </div>`;
    } else {
      body += `
        <div class="card-section">
          <div class="card-label">Issue</div>
          <p class="issue-text">${esc(sub.issue)}</p>
        </div>
        <div class="card-section">
          <div class="card-label">How to implement</div>
          <p class="card-text">${esc(sub.how_to_implement)}</p>
        </div>`;
    }

    body += resourcesHtml(sub.resources);

    return `
      <div class="scan-card scan-card--${pass ? "pass" : "fail"}${openClass}${lockedClass}" data-card>
        <button type="button" class="scan-card-head" aria-expanded="${expanded}">
          <span class="card-status ${pass ? "status-pass" : "status-fail"}" aria-hidden="true">${iconSvg(pass)}</span>
          <span class="card-name">${esc(sub.name)}</span>
          <span class="card-badge ${pass ? "badge-pass" : "badge-fail"}">${pass ? "Pass" : "Fail"}</span>
          <svg class="card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="scan-card-body">${body}</div>
      </div>`;
  }

  // ── DETAIL REGION (one collapsible block per category) ───────────────────
  function openGroup(group) {
    group.classList.add("open");
    const head = group.querySelector(".check-group-head");
    if (head) head.setAttribute("aria-expanded", "true");
  }

  function renderChecks(data, opts) {
    const host = $("#checks");
    const checks = data.checks || [];
    const capacityCitations = opts && opts.citationCapacity;

    host.innerHTML = checks.map((cat, idx) => {
      const { pass, total } = passCount(cat);
      const isCitations = cat.key === "ai_citations";
      const subs = cat.subchecks || [];
      const hasTeaser = subs.some((s) => s.key === TEASER_PASS_KEY || s.key === TEASER_FAIL_KEY);
      // Open by default: AI Citations (the hook) + any group holding a teaser
      // card, so the first compact view shows the unblurred "some good, some
      // bad" teaser. All other groups stay collapsed (summaries only).
      const openClass = (isCitations || hasTeaser) ? " open" : "";
      const headExpanded = (isCitations || hasTeaser) ? "true" : "false";

      const cards = subs.map((sub) => {
        const teaser = sub.key === TEASER_PASS_KEY || sub.key === TEASER_FAIL_KEY;
        return cardHtml(sub, teaser);
      }).join("");

      const extra = (isCitations && !capacityCitations) ? citationExtraHtml(data) : "";

      const capacityNote = (isCitations && capacityCitations)
        ? `<div class="cat-capacity-note">AI citation test is at capacity right now — these results will refresh once it's available again.</div>`
        : "";

      return `
        <div class="check-group${openClass}" id="cat-${esc(cat.key)}">
          <button type="button" class="check-group-head" aria-expanded="${headExpanded}">
            <span class="check-group-name">${esc(cat.name)}</span>
            <span class="check-group-meta">
              <span class="check-group-passing">${pass} of ${total} passing</span>
              <span class="check-group-score ${tintClass(cat.score)}">${cat.score}</span>
              <svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </span>
          </button>
          <div class="check-group-body">
            ${capacityNote}
            ${extra}
            <div class="card-stack">${cards}</div>
          </div>
        </div>`;
    }).join("");

    wireGroups();
    wireCards();
  }

  // Category detail headers toggle open/closed.
  function wireGroups() {
    document.querySelectorAll(".check-group-head").forEach((head) => {
      head.addEventListener("click", () => {
        const group = head.closest(".check-group");
        const open = group.classList.toggle("open");
        head.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  // Individual sub-check cards toggle open/closed (blurred ones are pointer-none).
  function wireCards() {
    document.querySelectorAll(".scan-card-head").forEach((head) => {
      head.addEventListener("click", () => {
        const card = head.closest("[data-card]");
        const open = card.classList.toggle("open");
        head.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  // ── EMAIL GATE ───────────────────────────────────────────────────────────
  function wireGate() {
    const banner = $("#gateBanner");
    if (banner) banner.removeAttribute("hidden");
    const form = $("#gateForm");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = ($("#gateEmail").value || "").trim() || "you@company.com";
      // Reveal everything: drop .locked from cards + rows.
      document.querySelectorAll(".locked").forEach((el) => el.classList.remove("locked"));
      // Hide the gate form, show confirmation.
      form.setAttribute("hidden", "");
      const lock = $(".gate-lock"), title = $(".gate-title"), sub = $(".gate-sub");
      if (lock) lock.setAttribute("hidden", "");
      if (title) title.setAttribute("hidden", "");
      if (sub) sub.setAttribute("hidden", "");
      const confirm = $("#gateConfirm");
      if (confirm) {
        confirm.innerHTML = `<span class="gate-check">✓</span> Sent to <b>${esc(email)}</b>`;
        confirm.removeAttribute("hidden");
      }
      banner.classList.add("gate-banner--done");
    });
  }

  // ── STATE RENDERERS (error / empty) ──────────────────────────────────────
  function showStateCard(html) {
    $("#results").setAttribute("hidden", "");
    const sec = $("#scanState");
    sec.removeAttribute("hidden");
    sec.innerHTML = html;
    const again = sec.querySelector("[data-scan-again]");
    if (again) again.addEventListener("click", () => { window.location.search = ""; });
  }

  function renderUnreadable() {
    showStateCard(`
      <div class="state-card state-card--bad">
        <div class="state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><path d="m2 2 20 20"/></svg>
        </div>
        <h2 class="state-title">We couldn't read <b>lean-labs.com</b></h2>
        <p class="state-text">It may block crawlers or render content with JavaScript — that's itself a critical AEO problem: AI engines see the same empty page.</p>
        <button type="button" class="btn-primary" data-scan-again>Scan another site</button>
      </div>`);
  }

  function renderUnreachable() {
    showStateCard(`
      <div class="state-card state-card--bad">
        <div class="state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="4"/></svg>
        </div>
        <h2 class="state-title">We couldn't reach lean-labs.com</h2>
        <p class="state-text">Check the URL is public and try again.</p>
        <button type="button" class="btn-primary" data-scan-again>Try again</button>
      </div>`);
  }

  // ── MAIN RENDER ──────────────────────────────────────────────────────────
  function renderFull(data, opts) {
    opts = opts || {};
    $("#scanState").setAttribute("hidden", "");
    $("#results").removeAttribute("hidden");

    const report = data.report;

    renderGauge(report.composite_score);
    $("#levelLabel").textContent = levelText(report.composite_score);
    renderBrandContext(data.brand_context);

    renderCategories(data.checks, { citationCapacity: opts.citationCapacity });
    renderChecks(data, { citationCapacity: opts.citationCapacity });
    wireGate();
  }

  // ── BOOT ─────────────────────────────────────────────────────────────────
  function boot() {
    wireCtxToggle();

    const mock = window.AEO_SCAN_MOCK;
    if (!mock) { console.warn("AEO_SCAN_MOCK not loaded"); return; }

    const form = $("#scanForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        renderFull(mock);
        $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    const state = getState();
    switch (state) {
      case "unreadable":
        renderUnreadable();
        break;
      case "unreachable":
        renderUnreachable();
        break;
      case "citation-capacity":
        renderFull(mock, { citationCapacity: true });
        break;
      default:
        renderFull(mock);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
