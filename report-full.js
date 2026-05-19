/* Full report — render functions + copy-snippet buttons.
 * Data source: window.AEO_REPORT_DATA (see report-data.js).
 */

function renderKpiStrip() {
  const host = document.getElementById('kpiStrip');
  if (!host || !window.AEO_REPORT_DATA) return;
  host.innerHTML = window.AEO_REPORT_DATA.kpis.map(k => `
    <div class="full-kpi-card${k.negative ? ' negative' : ''}">
      <div class="full-kpi-value">${k.value}</div>
      <div class="full-kpi-label">${k.label}</div>
      <div class="full-kpi-note">${k.note}</div>
    </div>
  `).join('');
}

function renderPillars() {
  const host = document.getElementById('pillarGrid');
  if (!host || !window.AEO_REPORT_DATA) return;
  const statusClass = (s) => ({
    Strong: "ok", Solid: "ok", Partial: "mid", Drag: "bad",
  })[s] || "mid";
  host.innerHTML = window.AEO_REPORT_DATA.pillars.map(p => {
    const warn = p.score < 60;
    return `
    <div class="full-dim-card${warn ? ' warn' : ''}">
      <div class="full-dim-head">
        <span class="full-dim-name">${p.name}</span>
        <span class="full-pillar-status pill-${statusClass(p.status)}">${p.status}</span>
      </div>
      <div class="full-dim-score">${p.score}<span>/100</span></div>
      <div class="full-dim-bar"><div class="full-dim-bar-fill" style="width:${p.score}%"></div></div>
      <div class="full-pillar-weight">${p.weight}% of composite</div>
    </div>`;
  }).join('');
}

function renderPromptTable() {
  const tbody = document.querySelector('#promptTable tbody');
  if (!tbody || !window.AEO_REPORT_DATA) return;
  const rows = window.AEO_REPORT_DATA.prompt_tracking;
  const cell = (engine) => {
    const s = engine.status;
    const klass = `pt-${s.toLowerCase()}`;
    const rank = engine.rank ? ` <span class="pt-rank">#${engine.rank}</span>` : '';
    return `<td><span class="${klass}">${s}</span>${rank}</td>`;
  };
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="col-prompt">"${r.prompt}"</td>
      <td class="col-intent"><span class="pt-intent">${r.intent}</span></td>
      ${cell(r.chatgpt)}
      ${cell(r.claude)}
      ${cell(r.perplexity)}
      ${cell(r.gemini)}
    </tr>
  `).join('');
}

function renderRecs() {
  const host = document.getElementById('recGrid');
  if (!host || !window.AEO_REPORT_DATA) return;
  host.innerHTML = window.AEO_REPORT_DATA.recommendations.map((r, i) => `
    <div class="full-rec-card">
      <div class="full-rec-num">${i + 1}</div>
      <div class="full-rec-body">
        <h4 class="full-rec-title">${r.title}</h4>
        <p class="full-rec-why">${r.why}</p>
      </div>
    </div>
  `).join('');
}

function wireCopyButtons() {
  document.querySelectorAll('.full-copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const snippet = btn.parentElement.querySelector('.full-code code');
      if (!snippet) return;
      const text = snippet.innerText;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          const original = btn.textContent;
          btn.textContent = '✓ Copied';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('copied');
          }, 1800);
        });
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderKpiStrip();
  renderPillars();
  renderPromptTable();
  renderRecs();
  wireCopyButtons();
});
