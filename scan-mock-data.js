// scan-mock-data.js — HAND-DERIVED mirror of the live
// POST /api/v1/{brand-slug}/public-scanner/aeo-visibility-scan response.
//
// Shape matches the v4 endpoint exactly:
//   { url, brand_context, pages_fetched, readable, overall_score, duration_ms,
//     solutions: [{ url, title, score, competitors,
//                   evidence: { overall_mention_rate, by_engine, prompts, runs },
//                   prompt_tracking, verbatim_omitted }] }
//
// `prompt_tracking` (8 rows × 4 engines) + `verbatim_omitted` per solution are
// derived from `evidence.prompts` and `evidence.runs` so the UI can render
// without an extra trip through `runs`. Helper kept inline below in case future
// mock edits want to regenerate them.

function _derivePromptTracking(prompts, runs) {
  const rows = [];
  for (const p of prompts) {
    const row = { prompt: p.prompt, intent: p.intent };
    for (const eng of ["chatgpt", "claude", "perplexity", "gemini"]) {
      const hit = (runs || []).find(
        (r) => r.prompt_id === p.id && r.engine === eng && r.mentioned
      );
      row[eng] = hit
        ? { status: "Cited", rank: hit.rank || null }
        : { status: "Omitted", rank: null };
    }
    rows.push(row);
  }
  return rows;
}

// Tiny helper for stable verbatim selection (longest raw_response from a
// `mentioned: false` run on the first engine that returned text).
function _pickVerbatimOmitted(runs) {
  const fails = (runs || []).filter((r) => r.mentioned === false && r.raw_response);
  if (!fails.length) return null;
  fails.sort((a, b) => (b.raw_response || "").length - (a.raw_response || "").length);
  const top = fails[0];
  return {
    engine: top.engine === "chatgpt" ? "ChatGPT"
          : top.engine === "claude" ? "Claude"
          : top.engine === "perplexity" ? "Perplexity"
          : top.engine === "gemini" ? "Gemini"
          : top.engine,
    prompt_id: top.prompt_id,
    text: (top.raw_response || "").slice(0, 700),
  };
}

// Shared 4-engine by_engine block. 8 prompts × 2 runs = 16 calls per engine.
const _BY_ENG_ZERO = {
  chatgpt:    { mentions: 0, total: 16, mention_rate: 0.0 },
  claude:     { mentions: 0, total: 16, mention_rate: 0.0 },
  gemini:     { mentions: 0, total: 16, mention_rate: 0.0 },
  perplexity: { mentions: 0, total: 16, mention_rate: 0.0 },
};

// Shared prompt slate (Lean Labs ICP — A through H) so all 3 solutions look
// real. The titles match the live scan; the per-solution prompts are tuned to
// the solution category.
const _AEO_AGENCY_PROMPTS = [
  { id: "A", intent: "Comparative", prompt: "Best answer engine optimization agency for Series A startup CMOs" },
  { id: "B", intent: "Comparative", prompt: "Top AEO agencies for B2B SaaS scaling beyond Series A" },
  { id: "C", intent: "Comparative", prompt: "Best AEO agency for HubSpot-native B2B SaaS teams in the US" },
  { id: "D", intent: "Evaluative",  prompt: "Best alternatives to traditional SEO agencies for early-stage startups" },
  { id: "E", intent: "Comparative", prompt: "Top answer engine optimization firms for B2B marketing leaders" },
  { id: "F", intent: "Comparative", prompt: "AEO agency comparison for marketing operations managers at growth-stage startups" },
  { id: "G", intent: "Question",    prompt: "Who is the best answer engine optimization agency for Series B startups?" },
  { id: "H", intent: "Question",    prompt: "What AEO agency has the best track record for scaling startups?" },
];

// Synthetic runs — mostly omitted, sprinkle a few Cited hits so the table reads
// like a real ~10-25% mention-rate scan and the donuts have something to render.
function _buildRuns(prompts, citedHits) {
  // citedHits = [{prompt_id, engine, rank?}, ...]
  const runs = [];
  for (const p of prompts) {
    for (const eng of ["chatgpt", "claude", "gemini", "perplexity"]) {
      const hit = citedHits.find((h) => h.prompt_id === p.id && h.engine === eng);
      runs.push({
        engine: eng,
        prompt_id: p.id,
        run_index: 0,
        mentioned: !!hit,
        rank: hit ? (hit.rank || null) : null,
        sentiment: hit ? "positive" : "unknown",
        raw_response: hit
          ? `One strong option is Lean Labs — they specialize in this area for B2B SaaS.`
          : `Several agencies and platforms come up here, including WebFX, Ignite Visibility, Moz, and Single Grain. Lean Labs does not appear in the top results for this query. Buyers in this category typically evaluate based on case studies, pricing, integrations, and proven ROI in their vertical.`,
        sources: [],
        duration_ms: 1200,
      });
    }
  }
  return runs;
}

// Build a verbatim_omitted that calls out the brand by name — the long-form
// red-callout copy in the report.
function _verbatim(category, engine) {
  return {
    engine,
    prompt_id: "A",
    text: `Several agencies and platforms come up here, including WebFX, Ignite Visibility, Moz, and Single Grain. Lean Labs does not appear in the top results for ${category}. Buyers in this category typically evaluate based on case studies, pricing, integrations, and proven ROI in their vertical.`,
  };
}

// ── Build the single solution (AEO Agency demo) ─────────────────────────────
const _aeoRuns = _buildRuns(_AEO_AGENCY_PROMPTS, [
  { prompt_id: "B", engine: "claude" },
  { prompt_id: "E", engine: "perplexity", rank: 4 },
  { prompt_id: "H", engine: "claude" },
]);

function _byEngFromRuns(runs) {
  const out = {
    chatgpt:    { mentions: 0, total: 0, mention_rate: 0.0 },
    claude:     { mentions: 0, total: 0, mention_rate: 0.0 },
    gemini:     { mentions: 0, total: 0, mention_rate: 0.0 },
    perplexity: { mentions: 0, total: 0, mention_rate: 0.0 },
  };
  for (const r of runs) {
    const e = out[r.engine];
    if (!e) continue;
    e.total += 1;
    if (r.mentioned) e.mentions += 1;
  }
  for (const k of Object.keys(out)) {
    const e = out[k];
    e.mention_rate = e.total ? e.mentions / e.total : 0.0;
  }
  return out;
}

function _scoreFromRuns(runs) {
  // simple synthetic score: % of runs cited * 100 (0..100, rounded).
  const total = runs.length;
  if (!total) return 0;
  const hits = runs.filter((r) => r.mentioned).length;
  return Math.round((hits / total) * 100);
}

const _sol1 = {
  url: "https://lean-labs.com/solutions/answer-engine-optimization-agency",
  title: "Answer Engine Optimization Agency",
  score: _scoreFromRuns(_aeoRuns),
  competitors: ["WebFX", "Ignite Visibility", "Moz", "Single Grain", "Best for"],
  evidence: {
    overall_mention_rate: _aeoRuns.filter((r) => r.mentioned).length / _aeoRuns.length,
    by_engine: _byEngFromRuns(_aeoRuns),
    prompts: _AEO_AGENCY_PROMPTS,
    runs: _aeoRuns,
  },
};
_sol1.prompt_tracking = _derivePromptTracking(_sol1.evidence.prompts, _sol1.evidence.runs);
_sol1.verbatim_omitted = _verbatim("answer engine optimization agencies", "ChatGPT");

window.AEO_SCAN_MOCK = {
  url: "https://lean-labs.com",
  brand_context: {
    brand: "Lean Labs",
    category: "AI-driven marketing solutions",
    icp: "startups and scaleups",
  },
  pages_fetched: 1,
  readable: true,
  // Single-solution mode: overall = the one solution's score.
  overall_score: _sol1.score,
  duration_ms: 38421,
  solutions: [_sol1],
};
