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

// ── Mock checks slate — 4 pillar categories mirroring the live backend
// (build_checks). Score per category = round(100 * pass / total). The mock
// targets: AI Citations 50, Structured Data 75, AI Crawler Access 86 (≈6/7),
// Entity & Authority 33.
const _MOCK_CHECKS = [
  {
    key: "ai_citations",
    name: "AI Citations",
    score: 50,
    subchecks: [
      {
        key: "cited_chatgpt", name: "Cited by ChatGPT", status: "fail",
        goal: "Get named when buyers ask ChatGPT for recommendations in your category.",
        result: null,
        issue: "Never surfaced on ChatGPT across 16 buyer prompts.",
        how_to_implement: "Citation lift lags fixes — improve the signals ChatGPT weighs (schema, extractability, entity authority), then re-test in ~30 days.",
        resources: [{ label: "What is AEO", url: "https://www.lean-labs.com/" }],
      },
      {
        key: "cited_claude", name: "Cited by Claude", status: "pass",
        goal: "Get named when buyers ask Claude for recommendations in your category.",
        result: "Mentioned in 13% of buyer prompts on Claude (2 of 16).",
        issue: null, how_to_implement: null,
        resources: [{ label: "What is AEO", url: "https://www.lean-labs.com/" }],
      },
      {
        key: "cited_perplexity", name: "Cited by Perplexity", status: "pass",
        goal: "Get named when buyers ask Perplexity for recommendations in your category.",
        result: "Mentioned in 6% of buyer prompts on Perplexity (1 of 16).",
        issue: null, how_to_implement: null,
        resources: [{ label: "What is AEO", url: "https://www.lean-labs.com/" }],
      },
      {
        key: "cited_gemini", name: "Cited by Gemini", status: "fail",
        goal: "Get named when buyers ask Gemini for recommendations in your category.",
        result: null,
        issue: "Never surfaced on Gemini across 16 buyer prompts.",
        how_to_implement: "Citation lift lags fixes — improve the signals Gemini weighs (schema, extractability, entity authority), then re-test in ~30 days.",
        resources: [{ label: "What is AEO", url: "https://www.lean-labs.com/" }],
      },
    ],
  },
  {
    key: "structured_data",
    name: "Structured Data",
    score: 75,
    subchecks: [
      {
        key: "organization_schema", name: "Organization schema", status: "pass",
        goal: "Publish Organization JSON-LD so engines know who you are.",
        result: "Organization schema present.",
        issue: null, how_to_implement: null,
        resources: [{ label: "schema.org/Organization", url: "https://schema.org/Organization" }],
      },
      {
        key: "page_schema", name: "Page-level schema", status: "pass",
        goal: "Mark up pages with WebSite/WebPage schema.",
        result: "Page-level schema present (WebSite, WebPage).",
        issue: null, how_to_implement: null, resources: [],
      },
      {
        key: "jsonld_coverage", name: "JSON-LD coverage", status: "pass",
        goal: "Carry valid JSON-LD on most pages.",
        result: "1 page carries valid JSON-LD (100% coverage).",
        issue: null, how_to_implement: null, resources: [],
      },
      {
        key: "freshness", name: "Content freshness", status: "fail",
        goal: "Show recent dateModified so engines trust content is current.",
        result: null,
        issue: "No publish/modified dates found.",
        how_to_implement: "Add dateModified to Article/WebPage schema; keep key pages updated.",
        resources: [],
      },
    ],
  },
  {
    key: "crawler_access",
    name: "AI Crawler Access",
    score: 86,
    subchecks: [
      {
        key: "bot_gptbot", name: "GPTBot can reach you", status: "pass",
        goal: "Let GPTBot fetch your pages.",
        result: "GPTBot reaches your site (HTTP 200).",
        issue: null, how_to_implement: null, resources: [],
      },
      {
        key: "bot_claudebot", name: "ClaudeBot can reach you", status: "pass",
        goal: "Let ClaudeBot fetch your pages.",
        result: "ClaudeBot reaches your site (HTTP 200).",
        issue: null, how_to_implement: null, resources: [],
      },
      {
        key: "bot_perplexitybot", name: "PerplexityBot can reach you", status: "pass",
        goal: "Let PerplexityBot fetch your pages.",
        result: "PerplexityBot reaches your site (HTTP 200).",
        issue: null, how_to_implement: null, resources: [],
      },
      {
        key: "bot_google_extended", name: "Google-Extended can reach you", status: "pass",
        goal: "Let Google-Extended fetch your pages.",
        result: "Google-Extended reaches your site (HTTP 200).",
        issue: null, how_to_implement: null, resources: [],
      },
      {
        key: "robots_ai", name: "robots.txt allows AI crawlers", status: "pass",
        goal: "Allow AI crawlers in robots.txt.",
        result: "robots.txt allows AI crawlers.",
        issue: null, how_to_implement: null,
        resources: [{ label: "robots.txt + AI bots", url: "https://platform.openai.com/docs/gptbot" }],
      },
      {
        key: "ssr", name: "Server-side rendering", status: "pass",
        goal: "Serve content without requiring JavaScript.",
        result: "Pages are server-rendered (content in initial HTML).",
        issue: null, how_to_implement: null, resources: [],
      },
      {
        key: "llms_txt", name: "llms.txt published", status: "fail",
        goal: "Publish /llms.txt summarizing key pages for AI agents.",
        result: null,
        issue: "No llms.txt found.",
        how_to_implement: "Add /llms.txt with an H1 and links to your key pages.",
        resources: [{ label: "llmstxt.org", url: "https://llmstxt.org" }],
      },
    ],
  },
  {
    key: "entity",
    name: "Entity & Authority",
    score: 33,
    subchecks: [
      {
        key: "wikidata", name: "Wikidata entity", status: "pass",
        goal: "Have a canonical Wikidata Q-ID for your brand.",
        result: "Wikidata entity found (Q123456).",
        issue: null, how_to_implement: null,
        resources: [{ label: "Wikidata", url: "https://www.wikidata.org" }],
      },
      {
        key: "sameas", name: "Canonical sameAs profiles", status: "fail",
        goal: "Bind your brand to canonical profiles via sameAs.",
        result: null,
        issue: "Only 1 of 3 canonical profiles linked (LinkedIn, Crunchbase, G2).",
        how_to_implement: "Add sameAs links (LinkedIn, Crunchbase, G2) to Organization schema.",
        resources: [],
      },
      {
        key: "authors", name: "Named authors", status: "fail",
        goal: "Attribute content to named authors.",
        result: null,
        issue: "No named authors/bylines — weak E-E-A-T signal.",
        how_to_implement: "Add author bylines + Person schema to articles.",
        resources: [],
      },
    ],
  },
];

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
  checks: _MOCK_CHECKS,
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
