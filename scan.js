/* scan.js — static AEO scanner mockup renderer.
 * No network calls. Reads window.AEO_SCAN_MOCK + ?state= switch.
 */
(function () {
  "use strict";

  // ── Config: pillar metadata + category grouping ───────────────────────
  const PILLAR_LABEL = {
    extractability: "Content Extractability",
    schema: "Schema Coverage",
    crawler_access: "AI Crawler Access",
    entity: "Entity & Brand Authority",
    citation: "Live Citation Test",
    eeat: "E-E-A-T Signals",
    faq_coverage: "FAQ Coverage",
    freshness: "Freshness Signals",
    llms_txt: "llms.txt Presence",
  };

  // 5 categories, each mapping to one-or-more pillars.
  const CATEGORIES = [
    { key: "discoverability", label: "Discoverability & Access", pillars: ["crawler_access", "llms_txt"] },
    { key: "content",         label: "Content & Answers",        pillars: ["extractability", "faq_coverage", "freshness"] },
    { key: "structured",      label: "Structured Data",          pillars: ["schema"] },
    { key: "authority",       label: "Authority & Trust",        pillars: ["entity", "eeat"] },
    { key: "citations",       label: "AI Citations",             pillars: ["citation"] },
  ];

  const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

  const ENGINE_LABELS = { chatgpt: "ChatGPT", claude: "Claude", perplexity: "Perplexity", gemini: "Gemini" };

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

  function weightedAvg(pillars) {
    let num = 0, den = 0;
    pillars.forEach((p) => { num += p.score * p.weight; den += p.weight; });
    return den ? Math.round(num / den) : 0;
  }

  // ── State switch (clone + mutate the mock for synthetic states) ────────
  function getState() {
    const m = new URLSearchParams(window.location.search).get("state");
    return m || "default";
  }

  function buildAllGreenData(base) {
    // Clone the mock, bump pillar scores high, empty most findings.
    const data = JSON.parse(JSON.stringify(base));
    data.report.composite_score = 90;
    data.report.grade = "A-";
    data.report.pillars.forEach((p) => {
      p.score = Math.max(p.score, 88);
      p.findings = []; // all green → "no issues found" rows everywhere
    });
    data.citation.score = 88;
    data.citation.evidence.overall_mention_rate = 0.82;
    return data;
  }

  // ── GAUGE ──────────────────────────────────────────────────────────────
  function renderGauge(score, grade) {
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
          <div class="gauge-grade tint-${tintClass(score).replace("tint-", "")}">${esc(grade)}</div>
        </div>
      </div>`;
    // Animate the arc after paint.
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
        · <button type="button" class="link-btn" id="refineBtn">not right? refine</button></div>
      <div class="refine-panel" id="refinePanel" hidden>
        <label class="refine-field">Category
          <input type="text" class="refine-input" value="${esc(ctx.category)}">
        </label>
        <label class="refine-field">Ideal customer
          <input type="text" class="refine-input" value="${esc(ctx.icp)}">
        </label>
        <button type="button" class="btn-secondary refine-apply">Re-scan with these</button>
      </div>`;
    const btn = $("#refineBtn"), panel = $("#refinePanel");
    btn.addEventListener("click", () => {
      const open = panel.hasAttribute("hidden");
      if (open) panel.removeAttribute("hidden"); else panel.setAttribute("hidden", "");
    });
  }

  // ── CATEGORY DONUTS ─────────────────────────────────────────────────────
  function categoryData(data) {
    const byKey = {};
    data.report.pillars.forEach((p) => { byKey[p.pillar] = p; });
    return CATEGORIES.map((cat) => {
      const pillars = cat.pillars.map((k) => byKey[k]).filter(Boolean);
      const score = weightedAvg(pillars);
      const issues = pillars.reduce((n, p) => n + (p.findings ? p.findings.length : 0), 0);
      return { ...cat, score, issues, pillars };
    });
  }

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

  function renderCategories(cats, opts) {
    const host = $("#categories");
    const capacityCitations = opts && opts.citationCapacity;
    host.innerHTML = cats.map((cat) => {
      const masked = capacityCitations && cat.key === "citations";
      const sub = masked
        ? `<span class="cat-note">AI citation test at capacity — try again later.</span>`
        : (cat.issues === 0
            ? `<span class="cat-issues cat-issues--ok">No issues</span>`
            : `<span class="cat-issues">${cat.issues} issue${cat.issues === 1 ? "" : "s"}</span>`);
      return `
        <div class="cat-card">
          <div class="cat-donut">${donutSvg(cat.score, masked)}</div>
          <div class="cat-label">${esc(cat.label)}</div>
          ${sub}
        </div>`;
    }).join("");
  }

  // ── CHECK ROWS ───────────────────────────────────────────────────────────
  function dotClass(sev) {
    if (sev === "critical" || sev === "high") return "dot-bad";
    if (sev === "medium") return "dot-warn";
    return "dot-ok";
  }

  function buildPrompt(url, f) {
    return `I run ${url}. An AEO audit found: ${f.title}. Why it matters: ${f.why_it_matters} Recommended fix: ${f.fix_hint} Write the exact code/content to implement this, ready to paste.`;
  }

  function renderChecks(cats, url) {
    const host = $("#checks");
    host.innerHTML = cats.map((cat) => {
      // Gather + sort findings across this category's pillars.
      let findings = [];
      cat.pillars.forEach((p) => {
        (p.findings || []).forEach((f) => findings.push(f));
      });
      findings.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

      const rows = findings.length === 0
        ? `<div class="check-row check-row--clean">
             <span class="check-dot dot-ok"></span>
             <span class="check-title">No issues found</span>
             <svg class="check-clean-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
           </div>`
        : findings.map((f, i) => {
            const prompt = buildPrompt(url, f);
            const sevTag = `<span class="check-sev sev-${f.severity}">${f.severity}</span>`;
            const pageLink = f.page_url
              ? `<a class="check-page" href="${esc(f.page_url)}" target="_blank" rel="noopener">${esc(f.page_url.replace(/^https?:\/\//, ""))}</a>`
              : "";
            return `
              <div class="check-row" data-row>
                <button type="button" class="check-head" aria-expanded="false">
                  <span class="check-dot ${dotClass(f.severity)}"></span>
                  <span class="check-title">${esc(f.title)}</span>
                  ${sevTag}
                  <svg class="check-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                <div class="check-body">
                  <p class="check-why"><span class="check-why-label">Why it matters</span>${esc(f.why_it_matters)}</p>
                  ${pageLink ? `<div class="check-pageline">Affected page: ${pageLink}</div>` : ""}
                  <div class="fix-block locked">
                    <div class="lock-badge" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Unlock with email
                    </div>
                    <div class="fix-inner">
                      <div class="fix-label">How to fix</div>
                      <p class="fix-hint">${esc(f.fix_hint)}</p>
                      <details class="fix-prompt">
                        <summary>Get the copy-paste AI prompt</summary>
                        <textarea class="prompt-text" readonly rows="4">${esc(prompt)}</textarea>
                        <button type="button" class="copy-btn" data-copy>Copy prompt</button>
                      </details>
                    </div>
                  </div>
                </div>
              </div>`;
          }).join("");

      return `
        <div class="check-group">
          <div class="check-group-head">
            <span class="check-group-name">${esc(cat.label)}</span>
            <span class="check-group-score ${tintClass(cat.score)}">${cat.score}</span>
          </div>
          ${rows}
        </div>`;
    }).join("");

    wireChecks();
  }

  function wireChecks() {
    document.querySelectorAll(".check-head").forEach((head) => {
      head.addEventListener("click", () => {
        const row = head.closest("[data-row]");
        const open = row.classList.toggle("open");
        head.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
    document.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ta = btn.parentElement.querySelector(".prompt-text");
        if (!ta) return;
        const done = () => {
          const orig = btn.textContent;
          btn.textContent = "✓ Copied";
          btn.classList.add("copied");
          setTimeout(() => { btn.textContent = orig; btn.classList.remove("copied"); }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ta.value).then(done).catch(done);
        } else {
          ta.select(); done();
        }
      });
    });
  }

  // ── CITATION SECTION ─────────────────────────────────────────────────────
  function renderCitation(data) {
    const host = $("#citationSection");
    const ev = data.citation.evidence;
    const v = ev.verbatim_omitted;
    const brand = data.brand_context.brand;
    const category = data.brand_context.category;

    const cell = (engine) => {
      const s = engine.status;
      const klass = s === "Cited" ? "pt-cited" : "pt-omitted";
      const rank = engine.rank ? ` <span class="pt-rank">#${engine.rank}</span>` : "";
      return `<td><span class="${klass}">${esc(s)}</span>${rank}</td>`;
    };

    const rows = ev.prompt_tracking.map((r) => `
      <tr>
        <td class="col-prompt">"${esc(r.prompt)}"</td>
        <td class="col-intent"><span class="pt-intent">${esc(r.intent)}</span></td>
        ${cell(r.chatgpt)}${cell(r.claude)}${cell(r.perplexity)}${cell(r.gemini)}
      </tr>`).join("");

    const ratePct = Math.round(ev.overall_mention_rate * 100);

    host.innerHTML = `
      <h2 class="block-title">What AI engines say about you</h2>
      <p class="block-sub">Across ${esc(ev.prompts.length)} buyer prompts × 4 engines · you were named <b>${ratePct}%</b> of the time.</p>

      <div class="cite-callout">
        <div class="cite-callout-head">When buyers ask AI about <b>${esc(category)}</b>, here's what they see —</div>
        <div class="cite-verbatim"><span class="cite-engine">${esc(ENGINE_LABELS[v.engine] || v.engine)}</span>${esc(v.text)}</div>
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
      </div>`;
  }

  // ── EMAIL GATE ───────────────────────────────────────────────────────────
  function wireGate() {
    const banner = $("#gateBanner");
    const form = $("#gateForm");
    if (!banner || !form) return;
    banner.removeAttribute("hidden");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // Visual unlock: drop .locked from every fix block with a fade.
      document.querySelectorAll(".fix-block.locked").forEach((el) => {
        el.classList.add("unlocking");
        // allow the fade transition to start, then strip locked.
        requestAnimationFrame(() => el.classList.remove("locked"));
      });
      banner.classList.add("dismissed");
      setTimeout(() => banner.setAttribute("hidden", ""), 280);
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

    const url = $("#scanUrl") ? $("#scanUrl").value : "https://lean-labs.com";
    const report = data.report;

    renderGauge(report.composite_score, report.grade);
    $("#levelLabel").textContent = levelText(report.composite_score);
    renderBrandContext(data.brand_context);

    const cats = categoryData(data);
    renderCategories(cats, { citationCapacity: opts.citationCapacity });
    renderChecks(cats, url);

    if (opts.citationCapacity) {
      $("#citationSection").setAttribute("hidden", "");
    } else {
      $("#citationSection").removeAttribute("hidden");
      renderCitation(data);
    }

    wireGate();
  }

  // ── BOOT ─────────────────────────────────────────────────────────────────
  function boot() {
    const mock = window.AEO_SCAN_MOCK;
    if (!mock) { console.warn("AEO_SCAN_MOCK not loaded"); return; }

    // Re-scanning from the hero form: in the mock this just re-renders.
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
      case "all-green":
        renderFull(buildAllGreenData(mock));
        break;
      default:
        renderFull(mock);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
