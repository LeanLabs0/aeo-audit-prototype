/* ============================================================
   AEO Audit — Prototype app.js
   3-screen state machine. Calls live factor8 endpoint.
   Pattern mirrors schemarocket + reputation-rocket-prototype.
   ============================================================ */

const CONFIG = {
  API_URL: 'https://factor8-agent-sdk.fly.dev/api/v1/brand-slug/lean-labs/aeo-audit',
  API_KEY: '594aa935e360c9bf28f97437c1dddea9',
  CTA_URL: 'https://calendly.com/leanlabs',
  AEO_URL: 'https://www.leanlabs.com/aeo-accelerator',
  // Real endpoint takes ~15s. Scan screen runs until response arrives.
  SCAN_MIN_MS: 4000,
};

const GRADE_COLORS = {
  'A+': '#6bc950', 'A':  '#6bc950',
  'B+': '#7612fa', 'B':  '#7612fa',
  'C+': '#f59e0b', 'C':  '#f59e0b',
  'D':  '#ff6221',
  'F':  '#ef4444',
};

// ── Pillar label map ────────────────────────────────────────
const PILLAR_LABELS = {
  extractability: 'Content Extractability',
  schema:         'Schema Coverage',
  crawler_access: 'AI Crawler Access',
  entity:         'Entity & Brand Authority',
  eeat:           'E-E-A-T Signals',
  citation:       'Live Citation Test',
  freshness:      'Freshness Signals',
  faq_coverage:   'FAQ Coverage',
  llms_txt:       'llms.txt Presence',
};

// ── Boot ──────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
let stepTimer = null;
let currentStep = 0;

document.addEventListener('DOMContentLoaded', () => {
  $('#scoreBtn').addEventListener('click', handleScore);
  $('#urlField').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleScore();
  });
  $$('[data-cta="book"]').forEach((b) => b.addEventListener('click', () => window.open(CONFIG.CTA_URL, '_blank')));
  $$('[data-cta="aeo"]').forEach((b) => b.addEventListener('click', () => window.open(CONFIG.AEO_URL, '_blank')));
  showScreen('INPUT');
});

function showScreen(name) {
  $$('.screen').forEach((el) => el.classList.remove('active'));
  ({
    INPUT: () => $('#screen-input'),
    SCANNING: () => $('#screen-scanning'),
    RESULTS: () => $('#screen-results'),
  })[name]().classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Score click → scan → live API call → reveal ──────────
async function handleScore() {
  const raw = $('#urlField').value.trim();
  if (!raw) { $('#urlField').focus(); return; }
  let url = raw;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const companyName = inferCompanyName(url);

  resetScanSteps();
  $('#scanUrlText').textContent = url.replace(/^https?:\/\//, '');
  showScreen('SCANNING');
  startStepTimer();

  const startedAt = Date.now();
  let payload = null;
  let fetchError = null;
  try {
    payload = await fetchAudit(url, companyName);
  } catch (err) {
    fetchError = err;
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed < CONFIG.SCAN_MIN_MS) {
    await delay(CONFIG.SCAN_MIN_MS - elapsed);
  }
  completeAllSteps();
  await delay(400);

  if (fetchError || !payload) {
    alert('Audit failed: ' + (fetchError?.message || 'unknown error'));
    showScreen('INPUT');
    return;
  }
  renderResults(payload, url);
  showScreen('RESULTS');
}

function inferCompanyName(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const root = host.split('.').slice(-2, -1)[0] || host;
    return root.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } catch {
    return 'Your Company';
  }
}

async function fetchAudit(url, companyName) {
  const resp = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CONFIG.API_KEY,
    },
    body: JSON.stringify({ url, company_name: companyName }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API returned ${resp.status}: ${text.slice(0, 200)}`);
  }
  return await resp.json();
}

// ── Scanning step animation ──────────────────────────────
const STEP_COUNT = 5;
const STEP_INTERVAL = 1000;

function resetScanSteps() {
  currentStep = 0;
  const steps = $$('#scanSteps .scan-step');
  steps.forEach((step) => {
    step.className = 'scan-step';
    const check = step.querySelector('.scan-check');
    check.className = 'scan-check';
    check.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/></svg>';
  });
  $('.scan-progress-fill').style.width = '0%';
}

function startStepTimer() {
  advanceStep();
  stepTimer = setInterval(() => {
    if (currentStep < STEP_COUNT) advanceStep();
    else clearInterval(stepTimer);
  }, STEP_INTERVAL);
}

function advanceStep() {
  const steps = $$('#scanSteps .scan-step');
  const checks = $$('#scanSteps .scan-check');
  if (currentStep > 0) {
    const prev = currentStep - 1;
    steps[prev].className = 'scan-step done';
    checks[prev].className = 'scan-check done';
    checks[prev].innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  }
  if (currentStep < steps.length) {
    steps[currentStep].className = 'scan-step active';
    checks[currentStep].className = 'scan-check active';
    checks[currentStep].innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/></svg>';
  }
  const pct = Math.min(((currentStep + 1) / STEP_COUNT) * 100, 95);
  $('.scan-progress-fill').style.width = pct + '%';
  currentStep++;
}

function completeAllSteps() {
  clearInterval(stepTimer);
  const steps = $$('#scanSteps .scan-step');
  const checks = $$('#scanSteps .scan-check');
  steps.forEach((step, i) => {
    step.className = 'scan-step done';
    checks[i].className = 'scan-check done';
    checks[i].innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  });
  $('.scan-progress-fill').style.width = '100%';
}

// ── Render results from live API payload ─────────────────
function renderResults(payload, url) {
  const report = payload.report;
  const company = report.company_name;
  const grade = report.grade;
  const composite = report.composite_score;

  // Grade circle
  $('#gradeLetterEl').textContent = grade;
  $('#gradeScoreEl').textContent = `${composite}/100`;
  $('#gradeUrlEl').textContent = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // Verdict — derived from pillar extremes
  const sortedPillars = [...report.pillars].sort((a, b) => a.score - b.score);
  const weakest = sortedPillars[0];
  const strongest = sortedPillars[sortedPillars.length - 1];
  const verdict = `${company} scored ${composite}/100. Weakest: ${PILLAR_LABELS[weakest.pillar]} (${weakest.score}). Strongest: ${PILLAR_LABELS[strongest.pillar]} (${strongest.score}). ${report.top_findings.length} prioritized fixes below.`;
  $('#verdictEl').textContent = verdict;

  const color = GRADE_COLORS[grade] || '#7612fa';
  const circle = $('#gradeCircle');
  circle.style.borderColor = color;
  circle.style.boxShadow = `0 0 40px ${color}33, 0 0 80px ${color}18`;

  renderPillars(report.pillars);
  renderFindings(report.top_findings.slice(0, 4));
  renderCitation(report.pillars.find(p => p.pillar === 'citation'));
}

function renderPillars(pillars) {
  const container = $('#pillarsContainer');
  container.innerHTML = '';
  pillars.forEach((p) => {
    const grade = gradeFromScore(p.score);
    const letter = grade.charAt(0);
    const label = PILLAR_LABELS[p.pillar] || p.pillar;
    const weightPct = Math.round((p.weight || 0) * 100);
    const row = document.createElement('div');
    row.className = 'pillar-row';
    row.innerHTML = `
      <div class="pillar-info">
        <div class="pillar-name-row">
          <span class="pillar-name">${label}</span>
          <span class="pillar-weight">${weightPct}% weight</span>
        </div>
        <div class="pillar-bar">
          <div class="pillar-fill fill-${letter}" style="width: ${p.score}%"></div>
        </div>
      </div>
      <div class="pillar-score-cell">
        ${p.score}<span class="pillar-grade g-${letter}">${grade}</span>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderFindings(findings) {
  const container = $('#findingsContainer');
  container.innerHTML = '';
  findings.forEach((f, i) => {
    const card = document.createElement('div');
    card.className = `gap-card gap-${f.severity}`;
    const agentChip = f.remediation_agent
      ? `<span class="gap-agent-chip">One-click fix: <strong>${f.remediation_agent}</strong></span>`
      : '';
    const pillarLabel = PILLAR_LABELS[f.pillar] || f.pillar;
    card.innerHTML = `
      <div class="gap-priority">${(i+1)}. ${f.severity.toUpperCase()} · +${f.score_lift} points</div>
      <h4 class="gap-title">${escapeHtml(f.title)}</h4>
      <p class="gap-pillar"><strong>Pillar:</strong> ${pillarLabel}</p>
      <p class="gap-desc"><strong>Why it matters:</strong> ${escapeHtml(f.why_it_matters)}</p>
      <p class="gap-desc"><strong>Fix:</strong> ${escapeHtml(f.fix_hint)}</p>
      ${agentChip}
    `;
    container.appendChild(card);
  });
}

function renderCitation(citationPillar) {
  // Update engine card scores from real evidence
  if (!citationPillar?.evidence?.engines) return;
  const engines = citationPillar.evidence.engines;
  const cards = document.querySelectorAll('.engine-card');
  const order = ['chatgpt', 'claude', 'perplexity', 'gemini'];
  cards.forEach((card, i) => {
    const key = order[i];
    if (!engines[key]) return;
    const score = engines[key].score ?? 0;
    const rate = engines[key].mention_rate ?? 0;
    const grade = gradeFromScore(score).charAt(0);
    const scoreEl = card.querySelector('.engine-score');
    if (scoreEl) {
      scoreEl.className = `engine-score grade-${grade}`;
      scoreEl.innerHTML = `${score}<span>/100</span>`;
    }
    const rateEl = card.querySelector('.engine-rate');
    if (rateEl) rateEl.innerHTML = `Mention rate: <strong>${Math.round(rate * 100)}%</strong>`;
  });
  // Mark "estimated" badge on best card if pillar is placeholder
  if (citationPillar.evidence.estimated) {
    cards.forEach((card) => {
      const badge = card.querySelector('.engine-badge');
      if (badge) badge.textContent = 'Estimated';
    });
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ── Helpers ──────────────────────────────────────────────
function gradeFromScore(s) {
  if (s >= 90) return 'A+';
  if (s >= 80) return 'A';
  if (s >= 70) return 'B+';
  if (s >= 60) return 'B';
  if (s >= 50) return 'C+';
  if (s >= 40) return 'C';
  if (s >= 30) return 'D';
  return 'F';
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
