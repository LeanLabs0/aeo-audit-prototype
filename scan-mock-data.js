// scan-mock-data.js — FAKE Lean Labs data shaped EXACTLY like the live AEO
// scanner API will return. Static mockup only — no network, no backend.
window.AEO_SCAN_MOCK = {
  brand_context: { brand: "Lean Labs", category: "HubSpot growth marketing agency", icp: "B2B SaaS companies" },
  pages_fetched: 10,
  readable: true,
  report: {
    composite_score: 58, grade: "C+",
    pillars: [
      // 9 pillars. fields: pillar, score, weight, findings[]
      { pillar:"extractability", score:34, weight:0.20, findings:[
        { severity:"critical", title:"Pages bury the answer below the fold", why_it_matters:"AI engines extract the first answer-shaped paragraph; yours start with brand narrative so they grab nothing.", fix_hint:"Rewrite the first 500 tokens of /pricing and /solutions/* as a direct answer.", page_url:"https://lean-labs.com/pricing" },
        { severity:"high", title:"Paragraphs too long to quote", why_it_matters:"Long paragraphs aren't cleanly quotable, so engines skip them.", fix_hint:"Break into 1-2 sentence atomic paragraphs.", page_url:null }
      ]},
      { pillar:"schema", score:92, weight:0.15, findings:[] },
      { pillar:"crawler_access", score:100, weight:0.12, findings:[] },
      { pillar:"entity", score:34, weight:0.12, findings:[
        { severity:"high", title:"No Wikidata entity for the brand", why_it_matters:"Without a canonical Q-ID, AI engines fall back to fuzzy name matching and may confuse you with others.", fix_hint:"File a Wikidata entry for Lean Labs.", page_url:null },
        { severity:"medium", title:"Missing sameAs links (LinkedIn, Crunchbase, G2)", why_it_matters:"sameAs binds your brand to canonical profiles engines already trust.", fix_hint:"Add sameAs array to Organization JSON-LD.", page_url:null }
      ]},
      { pillar:"citation", score:50, weight:0.12, findings:[
        { severity:"critical", title:"AI engines cite you in only 25% of buyer prompts", why_it_matters:"Buyers using AI search rarely see you surfaced as a recommendation.", fix_hint:"Ship schema + extractability + entity fixes, then re-test in 30 days.", page_url:null }
      ]},
      { pillar:"eeat", score:70, weight:0.10, findings:[
        { severity:"medium", title:"Blog posts lack named authors", why_it_matters:"Named authors lift E-E-A-T trust ranking.", fix_hint:"Add author + dateModified to Article schema.", page_url:null }
      ]},
      { pillar:"faq_coverage", score:45, weight:0.08, findings:[
        { severity:"critical", title:"No FAQPage schema site-wide", why_it_matters:"Engines extract Q&A blocks directly; you answer the questions but never wrap them.", fix_hint:"Add FAQPage schema to /pricing + /solutions/*.", page_url:null }
      ]},
      { pillar:"freshness", score:10, weight:0.06, findings:[
        { severity:"medium", title:"Pages missing dateModified", why_it_matters:"Freshness is weighted heavily; undated pages look stale to engines.", fix_hint:"Add dateModified to pricing, solutions, and blog.", page_url:null }
      ]},
      { pillar:"llms_txt", score:80, weight:0.05, findings:[] }
    ]
  },
  // citation evidence — shape mirrors the real engine output
  citation: {
    score: 50,
    evidence: {
      overall_mention_rate: 0.25,
      by_engine: { chatgpt:{total:30, mention_rate:0.13}, claude:{total:30, mention_rate:0.40}, perplexity:{total:30, mention_rate:0.30}, gemini:{total:30, mention_rate:0.17} },
      prompts: [
        { prompt:"What are the best HubSpot growth marketing agency options for B2B SaaS?", intent:"Comparative" },
        { prompt:"Top 5 HubSpot growth marketing agency companies serving B2B SaaS", intent:"Comparative" },
        { prompt:"Which HubSpot growth marketing agency should I hire for B2B SaaS?", intent:"Comparative" },
        { prompt:"How to choose a HubSpot growth marketing agency for B2B SaaS", intent:"Evaluative" },
        { prompt:"Tell me about Lean Labs", intent:"Branded" }
      ],
      // per-prompt per-engine status for the table (Cited/Omitted + optional rank)
      prompt_tracking: [
        { prompt:"What are the best HubSpot growth marketing agency options for B2B SaaS?", intent:"Comparative", chatgpt:{status:"Omitted",rank:null}, claude:{status:"Cited",rank:null}, perplexity:{status:"Omitted",rank:null}, gemini:{status:"Cited",rank:7} },
        { prompt:"Top 5 HubSpot growth marketing agency companies serving B2B SaaS", intent:"Comparative", chatgpt:{status:"Omitted",rank:null}, claude:{status:"Cited",rank:null}, perplexity:{status:"Cited",rank:2}, gemini:{status:"Omitted",rank:null} },
        { prompt:"Which HubSpot growth marketing agency should I hire for B2B SaaS?", intent:"Comparative", chatgpt:{status:"Omitted",rank:null}, claude:{status:"Omitted",rank:null}, perplexity:{status:"Cited",rank:null}, gemini:{status:"Cited",rank:7} },
        { prompt:"How to choose a HubSpot growth marketing agency for B2B SaaS", intent:"Evaluative", chatgpt:{status:"Omitted",rank:null}, claude:{status:"Omitted",rank:null}, perplexity:{status:"Omitted",rank:null}, gemini:{status:"Omitted",rank:null} },
        { prompt:"Tell me about Lean Labs", intent:"Branded", chatgpt:{status:"Cited",rank:3}, claude:{status:"Cited",rank:1}, perplexity:{status:"Cited",rank:1}, gemini:{status:"Cited",rank:null} }
      ],
      // one verbatim "buyers see this" response where brand was OMITTED (for the red callout)
      verbatim_omitted: { engine:"chatgpt", prompt:"What are the best HubSpot growth marketing agency options for B2B SaaS?", text:"Here are strong options for B2B SaaS growth on HubSpot: 1) New Breed, 2) SmartBug Media, 3) Six & Flow, 4) Kalungi, 5) Refine Labs. Each has documented HubSpot expertise and SaaS case studies." }
    }
  }
};
