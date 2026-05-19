// report-data.js — real Lean Labs audit, baked for static rendering.
// GROUND TRUTH ONLY. Every value traces to a real tool output:
//   - composite + pillar scores: factor8 aeo_audit pipeline
//   - schema validity: pages_with_jsonld / total_pages
//   - AI Citations + prompt_tracking: docs/specs/citation_audit_lean_labs_real.json
//       (real OpenRouter run, 10 prompts × 4 engines × N=3 = 120 calls, 2026-05-19)
// KILLED (ungrounded, deferred to v2): Competitor Gap, Position Zero,
//   Citation Source Breakdown — no tool wired to verify them yet.
window.AEO_REPORT_DATA = {
  meta: {
    url: "lean-labs.com",
    company: "Lean Labs",
    generated: "May 19, 2026",
    pages_audited: 10,
    pillars_scored: 9
  },
  composite: { score: 58, grade: "C+" },

  // 3-KPI strip — only real, verifiable signals
  kpis: [
    { label: "Unified AEO Score", value: "58/100", note: "Composite of 9 pillars" },
    { label: "Schema Validity",   value: "80%",    note: "8 of 10 pages carry valid JSON-LD" },
    { label: "AI Citations",      value: "5 / 10", note: "buyer prompts where AI named you (25% mention rate across 120 queries)" }
  ],

  // Real 9-pillar breakdown (replaces the arbitrary 6-bucket cards)
  pillars: [
    { name: "Content Extractability",   score: 34,  weight: 20, status: "Drag" },
    { name: "Schema Coverage",          score: 92,  weight: 15, status: "Strong" },
    { name: "AI Crawler Access",        score: 100, weight: 12, status: "Strong" },
    { name: "Entity & Brand Authority", score: 34,  weight: 12, status: "Drag" },
    { name: "Live Citation Test",       score: 50,  weight: 12, status: "Partial" },
    { name: "E-E-A-T Signals",          score: 70,  weight: 10, status: "Solid" },
    { name: "FAQ Coverage",             score: 45,  weight: 8,  status: "Partial" },
    { name: "Freshness Signals",        score: 10,  weight: 6,  status: "Drag" },
    { name: "llms.txt Presence",        score: 80,  weight: 5,  status: "Strong" }
  ],

  highest_impact_gaps: [
    { title: "FAQPage schema · site-wide",                       severity: "critical" },
    { title: "Wikidata Q-ID · brand entity",                     severity: "high" },
    { title: "Answer-first first paragraph · /pricing",          severity: "high" },
    { title: "Answer-first first paragraph · /solutions/*",      severity: "high" },
    { title: "sameAs links · LinkedIn / Crunchbase / G2",        severity: "med" },
    { title: "dateModified · /pricing + /solutions + /blog",     severity: "med" },
    { title: "Author bylines · /pricing + /solutions",           severity: "med" }
  ],

  // Prompt tracking — REAL results from docs/specs/citation_audit_lean_labs_real.json
  prompt_tracking: [
    {
      prompt: "What are the best HubSpot growth marketing agency options for B2B SaaS?",
      intent: "Comparative",
      chatgpt:    { status: "Omitted", rank: null },
      claude:     { status: "Cited",   rank: null },
      perplexity: { status: "Omitted", rank: null },
      gemini:     { status: "Cited",   rank: 7 }
    },
    {
      prompt: "Top 5 HubSpot growth marketing agency companies serving B2B SaaS",
      intent: "Comparative",
      chatgpt:    { status: "Omitted", rank: null },
      claude:     { status: "Cited",   rank: null },
      perplexity: { status: "Cited",   rank: 2 },
      gemini:     { status: "Omitted", rank: null }
    },
    {
      prompt: "Which HubSpot growth marketing agency should I hire for B2B SaaS?",
      intent: "Comparative",
      chatgpt:    { status: "Omitted", rank: null },
      claude:     { status: "Omitted", rank: null },
      perplexity: { status: "Cited",   rank: null },
      gemini:     { status: "Cited",   rank: 7 }
    },
    {
      prompt: "How to choose a HubSpot growth marketing agency for B2B SaaS",
      intent: "Evaluative",
      chatgpt:    { status: "Omitted", rank: null },
      claude:     { status: "Omitted", rank: null },
      perplexity: { status: "Omitted", rank: null },
      gemini:     { status: "Omitted", rank: null }
    },
    {
      prompt: "Tell me about Lean Labs",
      intent: "Branded",
      chatgpt:    { status: "Cited", rank: 3 },
      claude:     { status: "Cited", rank: 1 },
      perplexity: { status: "Cited", rank: 1 },
      gemini:     { status: "Cited", rank: null }
    }
  ],

  // Priority recommendations (no effort/impact tags — those were judgment, not rubric)
  recommendations: [
    {
      title: "Add FAQPage schema to /pricing + /solutions/*",
      why:   "Engines extract Q&A blocks directly. Your pages already answer the questions; just wrap them."
    },
    {
      title: "Add sameAs links to Organization schema",
      why:   "LinkedIn, Crunchbase, G2 missing. Cheapest way to bind brand to canonical profiles."
    },
    {
      title: "Add author + dateModified to blog Article schema",
      why:   "Freshness signal weighted heavily. Named authors lift E-E-A-T trust ranking."
    },
    {
      title: "Rewrite first 500 tokens of /pricing as a definitive answer",
      why:   "Brand narrative loses AI engines before the value statement. Lead with the answer."
    },
    {
      title: "File Wikidata entry for Lean Labs",
      why:   "No canonical Q-ID = AI engines fall back to fuzzy matching. Adds entity anchor."
    }
  ]
};
