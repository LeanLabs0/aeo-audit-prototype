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

function renderDimensions() {
  const host = document.getElementById('dimGrid');
  if (!host || !window.AEO_REPORT_DATA) return;
  host.innerHTML = window.AEO_REPORT_DATA.dimensions.map(d => `
    <div class="full-dim-card${d.warn ? ' warn' : ''}${d.estimated ? ' estimated' : ''}">
      <div class="full-dim-head">
        <span class="full-dim-name">${d.name}</span>
        ${d.warn ? '<span class="full-dim-warn">!</span>' : ''}
        ${d.estimated ? '<span class="full-dim-est">est.</span>' : ''}
      </div>
      <div class="full-dim-score">${d.score}<span>/100</span></div>
      <div class="full-dim-bar"><div class="full-dim-bar-fill" style="width:${d.score}%"></div></div>
      <p class="full-dim-desc">${d.desc}</p>
    </div>
  `).join('');
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

function renderSources() {
  const host = document.getElementById('sourceGrid');
  if (!host || !window.AEO_REPORT_DATA) return;
  host.innerHTML = window.AEO_REPORT_DATA.citation_sources.map(s => `
    <div class="full-source-row">
      <div class="full-source-head">
        <span class="full-source-label">${s.label}</span>
        <span class="full-source-pct">${s.pct}%</span>
      </div>
      <div class="full-source-bar"><div class="full-source-bar-fill" style="width:${s.pct}%"></div></div>
      <div class="full-source-note">${s.note}</div>
    </div>
  `).join('');
}

function renderRecs() {
  const host = document.getElementById('recGrid');
  if (!host || !window.AEO_REPORT_DATA) return;
  const impactRank = { High: 0, Medium: 1, Low: 2 };
  const effortRank = { Low: 0, Medium: 1, High: 2 };
  const sorted = [...window.AEO_REPORT_DATA.recommendations].sort((a, b) => {
    if (impactRank[a.impact] !== impactRank[b.impact]) return impactRank[a.impact] - impactRank[b.impact];
    return effortRank[a.effort] - effortRank[b.effort];
  });
  host.innerHTML = sorted.map((r, i) => `
    <div class="full-rec-card">
      <div class="full-rec-num">${i + 1}</div>
      <div class="full-rec-body">
        <h4 class="full-rec-title">${r.title}</h4>
        <p class="full-rec-why">${r.why}</p>
        <div class="full-rec-tags">
          <span class="full-rec-tag tag-effort tag-effort-${r.effort.toLowerCase()}">${r.effort} effort</span>
          <span class="full-rec-tag tag-impact tag-impact-${r.impact.toLowerCase()}">${r.impact} impact</span>
        </div>
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
  renderDimensions();
  renderPromptTable();
  renderSources();
  renderRecs();
  wireCopyButtons();
});
