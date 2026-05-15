/* ============================================================
   AEO Audit Report v3 — state machine
   - 5 steps (0 entry + 1..4 content)
   - Step 3 finding micro-commitments tally + gate Step 4 CTA
   - URL hash sync so refresh stays put + back-button works
   ============================================================ */

(function () {
  const TOTAL_STEPS = 4; // progress-counted steps (1-4). Step 5 = post-conversion.
  const FINAL_STEP = 5;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const state = {
    step: 0,
    savedFixes: new Set(),
  };

  // ── Persistence (localStorage) ──────────────────────────
  function loadState() {
    try {
      const raw = localStorage.getItem('aeo-v3-state');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.savedFixes) state.savedFixes = new Set(parsed.savedFixes);
    } catch (e) { /* noop */ }
  }
  function saveState() {
    try {
      localStorage.setItem('aeo-v3-state', JSON.stringify({
        savedFixes: Array.from(state.savedFixes),
      }));
    } catch (e) { /* noop */ }
  }

  // ── Step navigation ─────────────────────────────────────
  function goToStep(n, opts = {}) {
    const target = Math.max(0, Math.min(FINAL_STEP, n));
    state.step = target;

    $$('.v3-step').forEach((el) => el.classList.remove('active'));
    const node = document.querySelector(`.v3-step[data-step="${target}"]`);
    if (node) node.classList.add('active');

    // Progress bar visible on steps 1-4
    const progressBar = $('#progressBar');
    if (target >= 1 && target <= TOTAL_STEPS) {
      progressBar.hidden = false;
      $('#stepCurrent').textContent = String(target);
      $$('.v3-dot').forEach((dot) => {
        const i = parseInt(dot.dataset.dot, 10);
        dot.classList.remove('active', 'done');
        if (i < target) dot.classList.add('done');
        if (i === target) dot.classList.add('active');
      });
    } else {
      progressBar.hidden = true;
    }

    // Tally bar visible only on step 3
    $('#tallyBar').hidden = target !== 3;

    // Back button in nav visible after step 0
    $('#navBack').hidden = target === 0;

    // Sync step 4 tally line + plan summary line
    if (target === 4) {
      const n = state.savedFixes.size;
      $('#step4Tally').textContent = String(n);
      const tt = document.getElementById('planTallyText');
      if (tt) tt.textContent = `${n} tagged priorit${n === 1 ? 'y' : 'ies'}`;
    }

    // Nav back button hidden on the post-conversion thank-you screen
    if (target === FINAL_STEP) {
      $('#navBack').hidden = true;
    }

    // URL hash sync
    if (!opts.skipHash) {
      const newHash = target === 0 ? '' : `#step-${target}`;
      if (window.location.hash !== newHash) {
        history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
      }
    }

    // Scroll to top of new step
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Step 3 micro-commitment toggles ─────────────────────
  function applySavedUI() {
    $$('.v3-finding').forEach((el) => {
      const id = el.dataset.id;
      if (state.savedFixes.has(id)) el.classList.add('saved');
      else el.classList.remove('saved');
    });
    $('#tallyN').textContent = String(state.savedFixes.size);
    const cta = $('#step3Cta');
    const hint = $('#step3CtaHint');
    if (state.savedFixes.size > 0) {
      cta.disabled = false;
      hint.textContent = `${state.savedFixes.size} fix${state.savedFixes.size === 1 ? '' : 'es'} on your list — keep going or continue`;
    } else {
      cta.disabled = true;
      hint.textContent = 'Save at least 1 fix to continue';
    }
  }

  function toggleFix(id) {
    if (state.savedFixes.has(id)) {
      state.savedFixes.delete(id);
    } else {
      state.savedFixes.add(id);
    }
    saveState();
    applySavedUI();
  }

  function skipFix(id) {
    if (state.savedFixes.has(id)) {
      state.savedFixes.delete(id);
      saveState();
    }
    applySavedUI();
    // Light visual feedback: dim the card briefly
    const card = document.querySelector(`.v3-finding[data-id="${id}"]`);
    if (card) {
      card.style.opacity = '0.5';
      setTimeout(() => { card.style.opacity = ''; }, 400);
    }
  }

  // ── Wire events ─────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    loadState();
    applySavedUI();

    // CTAs that advance the step
    $$('[data-go]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = parseInt(btn.dataset.go, 10);
        if (btn.disabled) return;
        goToStep(target);
      });
    });

    // Nav back button
    $('#navBack').addEventListener('click', () => {
      goToStep(state.step - 1);
    });

    // Email gate submit on step 4
    const planForm = document.getElementById('planEmailForm');
    if (planForm) {
      planForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = (document.getElementById('planEmail').value || '').trim();
        if (!email) return;
        const target = document.getElementById('thanksEmail');
        if (target) target.textContent = email;
        goToStep(FINAL_STEP);
      });
    }

    // "Audit another URL" link on thank-you screen
    const restart = document.getElementById('scoreAnotherLink');
    if (restart) {
      restart.addEventListener('click', (e) => {
        e.preventDefault();
        state.savedFixes.clear();
        saveState();
        applySavedUI();
        const fld = document.getElementById('planEmail');
        if (fld) fld.value = '';
        goToStep(0);
      });
    }

    // Finding toggles
    $$('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => toggleFix(btn.dataset.toggle));
    });

    // Finding skips
    $$('[data-skip]').forEach((btn) => {
      btn.addEventListener('click', () => skipFix(btn.dataset.skip));
    });

    // Initial step from URL hash
    const m = window.location.hash.match(/^#step-(\d)$/);
    const initial = m ? parseInt(m[1], 10) : 0;
    goToStep(initial, { skipHash: true });

    // Back-button browser nav
    window.addEventListener('popstate', () => {
      const m2 = window.location.hash.match(/^#step-(\d)$/);
      const n = m2 ? parseInt(m2[1], 10) : 0;
      goToStep(n, { skipHash: true });
    });
  });
})();
