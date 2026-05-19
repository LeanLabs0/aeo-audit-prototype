// report-data.js — real Lean Labs audit, baked for static rendering.
// One source of truth. Future re-render = swap this file only.
window.AEO_REPORT_DATA = {
  meta: {
    url: "lean-labs.com",
    company: "Lean Labs",
    generated: "May 19, 2026",
    pages_audited: 10,
    pillars_scored: 9
  },
  composite: { score: 58, grade: "C+" },

  // 5-KPI strip (first audit — no MoM trends)
  kpis: [
    { label: "Unified AEO Score", value: "58/100", note: "Composite of 9 pillars" },
    { label: "Schema Validity",   value: "80%",    note: "8 of 10 pages carry JSON-LD" },
    { label: "Competitor Gap",    value: "-7 pts", note: "vs estimated benchmark 65", negative: true },
    { label: "AI Citations",      value: "2 / 10", note: "of 10 buyer prompts tested" },
    { label: "Position Zero",     value: "0%",     note: "AI answer-box appearances" }
  ],

  // 6 dimension cards (Jonathan's bucket pattern)
  // warn = score < 60 → yellow ! marker
  // estimated = signal not fully wired yet
  dimensions: [
    { name: "Overall Visibility",   score: 60, desc: "Baseline visibility across AI search engines and llms.txt index.",                    warn: false },
    { name: "AI Search Presence",   score: 50, desc: "How often you appear in AI-generated answers across ChatGPT, Claude, Perplexity, Gemini.", warn: true,  estimated: true },
    { name: "Snippet Coverage",     score: 65, desc: "FAQ + schema-driven snippet capture across audited pages.",                            warn: false },
    { name: "Brand Citation",       score: 42, desc: "Entity recognition and citation authority across categories.",                          warn: true },
    { name: "Content Readiness",    score: 38, desc: "Answer-first paragraph structure, freshness signals, and named-author trust.",          warn: true },
    { name: "Competitive Position", score: 58, desc: "Your standing vs the estimated competitor average (65).",                              warn: true }
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

  // Prompt tracking table — 5 BOFU prompts × 4 engines
  prompt_tracking: [
    {
      prompt: "What are the best growth marketing agencies for B2B SaaS on HubSpot?",
      intent: "Comparative",
      chatgpt:    { status: "Omitted",  rank: null },
      claude:     { status: "Omitted",  rank: null },
      perplexity: { status: "Cited",    rank: 4 },
      gemini:     { status: "Omitted",  rank: null }
    },
    {
      prompt: "Top HubSpot certified partners for $5M–$50M ARR SaaS",
      intent: "Comparative",
      chatgpt:    { status: "Omitted",  rank: null },
      claude:     { status: "Omitted",  rank: null },
      perplexity: { status: "Omitted",  rank: null },
      gemini:     { status: "Omitted",  rank: null }
    },
    {
      prompt: "Growth-driven design agency vs traditional web design",
      intent: "Informational",
      chatgpt:    { status: "Hallucinated", rank: 2 },
      claude:     { status: "Omitted",      rank: null },
      perplexity: { status: "Cited",        rank: 3 },
      gemini:     { status: "Omitted",      rank: null }
    },
    {
      prompt: "Inbound marketing agencies that specialize in SaaS pricing pages",
      intent: "Evaluative",
      chatgpt:    { status: "Omitted",  rank: null },
      claude:     { status: "Cited",    rank: 5 },
      perplexity: { status: "Omitted",  rank: null },
      gemini:     { status: "Omitted",  rank: null }
    },
    {
      prompt: "Lean Labs HubSpot agency reviews",
      intent: "Branded",
      chatgpt:    { status: "Accurate", rank: 1 },
      claude:     { status: "Accurate", rank: 1 },
      perplexity: { status: "Accurate", rank: 1 },
      gemini:     { status: "Accurate", rank: 1 }
    }
  ],

  // Citation Source Breakdown (estimated until source-attribution wired)
  citation_sources: [
    { label: "Owned Content",       pct: 60, note: "your own pages + blog" },
    { label: "3rd Party Editorial", pct: 20, note: "industry publications + guest posts" },
    { label: "Review Sites",        pct: 15, note: "G2, Capterra, Clutch" },
    { label: "Social / UGC",        pct:  5, note: "LinkedIn, X, community forums" }
  ],

  // Priority Recommendations — effort × impact tagged
  recommendations: [
    {
      title: "Add FAQPage schema to /pricing + /solutions/*",
      why:   "Engines extract Q&A blocks directly. Your pages already answer the questions; just wrap them.",
      effort: "Low",
      impact: "High"
    },
    {
      title: "Add sameAs links to Organization schema",
      why:   "LinkedIn, Crunchbase, G2 missing. Cheapest way to bind brand to canonical profiles.",
      effort: "Low",
      impact: "Medium"
    },
    {
      title: "Add author + dateModified to blog Article schema",
      why:   "Freshness signal weighted heavily. Named authors lift E-E-A-T trust ranking.",
      effort: "Low",
      impact: "Medium"
    },
    {
      title: "Rewrite first 500 tokens of /pricing as a definitive answer",
      why:   "Brand narrative loses AI engines before the value statement. Lead with the answer.",
      effort: "Medium",
      impact: "High"
    },
    {
      title: "File Wikidata entry for Lean Labs",
      why:   "No canonical Q-ID = AI engines fall back to fuzzy matching. Adds entity anchor.",
      effort: "Medium",
      impact: "High"
    }
  ]
};
