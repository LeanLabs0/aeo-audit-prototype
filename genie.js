/* genie.js — AEO Genie preview (Phase 0).
 * Self-contained dark-themed renderer. Data is REAL Lean Labs scan output
 * (loop-marketing / AI-powered marketing for startups), hardcoded for the
 * preview per Kevin's "build a preview, not a functional prototype".
 * Methodology spine: grounding -> corroboration -> prominence (Kevin's workshop).
 * No em dashes anywhere (esc strips them).
 */
(function () {
  "use strict";

  // ── REAL DATA (Lean Labs scan) ───────────────────────────────────────────
  const DATA = {
    brand: "Lean Labs",
    category: "AI-powered marketing agency for startups",
    url: "https://www.leanlabs.com/solutions/loop-marketing",
    score: 41,
    // Kevin's pyramid, mapped from the Baseline pillars
    scores: [
      { key: "structured", name: "Structured Data", lever: "grounding", val: 75, note: "Machine-readable signals that tell AI what you offer." },
      { key: "grounding", name: "Grounding Pages", lever: "grounding", val: 50, note: "Authoritative pages AI can cite as its source." },
      { key: "corroboration", name: "Corroboration", lever: "off-site", val: 33, note: "Third-party sources that verify your claims." },
      { key: "prominence", name: "Prominence", lever: "off-site", val: 22, note: "How often you surface in AI answers for your space." },
    ],
    competitors: [["SmartBug Media", 11], ["GrowthSpree", 9], ["NoGood", 8], ["Tuff Growth", 4], ["Huble", 3]],
    // Citation Stack: sources AI cites for your queries, by frequency. You are in NONE.
    citationStack: [
      { src: "growthspreeofficial.com", n: 9, you: false, kind: "competitor roundup" },
      { src: "reddit.com", n: 4, you: false, kind: "community" },
      { src: "rzlt.io", n: 4, you: false, kind: "best-of roundup" },
      { src: "en.wikipedia.org", n: 4, you: false, kind: "entity source" },
      { src: "nogood.io", n: 3, you: false, kind: "competitor roundup" },
      { src: "tripledart.com", n: 3, you: false, kind: "best-of roundup" },
      { src: "blendb2b.com", n: 2, you: false, kind: "best-of roundup" },
      { src: "pitchkitchen.com", n: 2, you: false, kind: "best-of roundup" },
    ],
    money: { perCustomer: 25000, tiers: [{ label: "GET THE BALL ROLLING", customers: 10 }, { label: "OUR TARGET FOR YOU", customers: 20 }, { label: "CATEGORY LEADER", customers: 40 }] },
    demand: [["120+", "buyer questions in play", "distinct prompts your buyers ask AI about your category"], ["8,400+", "monthly AI-driven searches", "buyers researching your category across ChatGPT, Claude, Gemini and Perplexity"], ["+78%", "demand growth, YoY", "year-over-year rise in AI-driven research for your category"]],
  };

  // The 10 Genius Moves, grounded in the real scan. Ordered grounding -> corroboration -> prominence.
  const MOVES = [
    // ON-SITE (grounding)
    { side: "on-site", lever: "Grounding", name: "Fix your entity record",
      asset: "Add sameAs JSON-LD linking your site to G2, LinkedIn, Crunchbase and your HubSpot partner listing. State plainly who you are and who you are not.",
      why: "Entity & Authority scored 33/100. AI can't confirm Lean Labs is a distinct, credible entity, so it hedges.",
      impact: "Unlocks corroboration", effort: "1-2 days" },
    { side: "on-site", lever: "Grounding", name: "Answer the 9 questions you lose",
      asset: "Build grounding answers for the exact prompts you're invisible on: \"Best AI marketing agencies for Series A startup CMOs\", \"Best HubSpot marketing agencies with AI automation\", \"AI marketing agencies for early-stage founders\" (plus 6 more).",
      why: "AI named a competitor and not you on 9 of 12 buyer questions.",
      impact: "Up to 9 query placements", effort: "1 week" },
    { side: "on-site", lever: "Grounding", name: "Publish the honest comparison",
      asset: "Write \"Lean Labs vs SmartBug Media vs GrowthSpree\", a fair comparison naming the competitors AI recommends instead of you.",
      why: "SmartBug (11x) and GrowthSpree (9x) win the best/alternatives answers. Under 20% of agencies name competitors; doing it helps AI place you.",
      impact: "Win vs + alternatives queries", effort: "2-3 days" },
    { side: "on-site", lever: "Grounding", name: "Build the AI-marketing grounding hub",
      asset: "Cluster a definitive \"What is AI-powered marketing for startups\" pillar plus supporting pages so AI sees topical depth, not one-offs.",
      why: "Grounding Pages scored 50/100. Thin authoritative content for AI to cite.",
      impact: "Grounding 50 to 80+", effort: "2-3 weeks" },
    { side: "on-site", lever: "Grounding", name: "Add the schema + llms.txt layer",
      asset: "Ship FAQ + HowTo + Organization schema and an llms.txt so models can read and quote you token-efficiently.",
      why: "Structured Data is 75/100. Close, but the machine-readable answer layer is incomplete.",
      impact: "Structured data 75 to 95", effort: "2-3 days" },
    // OFF-SITE (corroboration)
    { side: "off-site", lever: "Corroboration", name: "Get into the articles AI already cites",
      asset: "You're absent from every top-cited source for your queries. Highest-frequency first: rzlt.io (4x), tripledart.com (3x), blendb2b.com (2x), pitchkitchen.com (2x). Pitch for inclusion.",
      why: "Corroboration scored 33/100. These are the exact pages LLMs pull from when buyers ask about your category, and you're in none. See the Citation Stack below.",
      impact: "Corroborates you across each source's queries", effort: "ongoing" },
    { side: "off-site", lever: "Corroboration", name: "Claim your Wikipedia / Wikidata entity",
      asset: "en.wikipedia.org is cited in 4 of your queries. Establish a Wikidata entity with notable references so AI has a canonical record of you.",
      why: "Anchors corroboration and entity at the source AI trusts most.",
      impact: "Canonical entity", effort: "1-2 weeks" },
    { side: "off-site", lever: "Corroboration", name: "Win the review insights game",
      asset: "Get 5+ G2/Clutch reviews that name the solution, the buyer, the outcome and the decision factors, not just stars. (Reputation Rocket.)",
      why: "Review sites drive AI sentiment, and a specific review can get cited within a day of posting.",
      impact: "Sentiment + corroboration", effort: "2-4 weeks" },
    // OFF-SITE (prominence)
    { side: "off-site", lever: "Prominence", name: "Get mentioned where buyers talk",
      asset: "reddit.com shows in 4 of your queries (Reddit appears in 10-21% of AI answers). Run a mention monitor on the marketing and HubSpot subreddits and join threads authentically.",
      why: "Prominence scored 22/100. AI rarely surfaces you; mentions in cited communities lift it fastest.",
      impact: "Raises prominence", effort: "ongoing" },
    { side: "off-site", lever: "Prominence", name: "Run the case-study co-marketing loop",
      asset: "Tie a modest discount to a recent client posting results on their site, a review site and a relevant Reddit thread. You write it, they approve.",
      why: "The cheapest way to manufacture corroborated prominence from happy clients.",
      impact: "Compounding mentions", effort: "per client" },
  ];

  const SECTIONS = [
    { id: "gen-moves", label: "Your 10 moves" },
    { id: "gen-stack", label: "Citation Stack" },
    { id: "gen-money", label: "Money Model" },
    { id: "gen-scores", label: "The Bottom Line" },
  ];

  // ── helpers ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/[—–]/g, "-")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  const tone = (v) => (v >= 70 ? "ok" : v >= 40 ? "warn" : "bad");
  const usd = (n) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M" : Math.round(n / 1000) + "K");

  function donut(val) {
    const v = Math.max(0, Math.min(100, Number(val) || 0));
    const r = 22, c = 2 * Math.PI * r, dash = c * (v / 100);
    return `<svg viewBox="0 0 56 56" class="gpd ${tone(v)}" aria-hidden="true">
      <circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--track)" stroke-width="5"/>
      <circle cx="28" cy="28" r="${r}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 28 28)"/>
      <text x="28" y="28" class="gpn" text-anchor="middle" dominant-baseline="central">${v}</text></svg>`;
  }

  // ── sections ─────────────────────────────────────────────────────────────
  function sidebarHtml() {
    const links = SECTIONS.map((s, i) =>
      `<a class="gnav-link" href="#${s.id}" data-target="#${s.id}"><span class="gnav-n">${String(i + 1).padStart(2, "0")}</span><span class="gnav-t">${esc(s.label)}</span></a>`).join("");
    return `<nav class="gnav" id="gnav" aria-label="Genie sections">
      <div class="gnav-h">Your<br>AEO Genie</div><div class="gnav-links">${links}</div></nav>`;
  }

  function heroHtml() {
    return `<div class="ghead">
      <div class="g-eyebrow">AEO Genie &middot; output</div>
      <h1 class="g-title">10 "Genius" moves to get<br>recommended by LLMs</h1>
      <p class="g-sub">The exact plays to get <b>${esc(DATA.brand)}</b> cited, recommended, and named first across the AI answer engines your buyers already trust.</p>
      <div class="g-note">Grounding, then corroboration, then prominence. Off-site is roughly 90% of the game.</div>
    </div>`;
  }

  const PHASES = [
    { lever: "Grounding", side: "on-site", tag: "the foundation" },
    { lever: "Corroboration", side: "off-site", tag: "the bigger game" },
    { lever: "Prominence", side: "off-site", tag: "win the category" },
  ];

  function moveRow(m, n, side, open) {
    return `<div class="mrow${open ? " open" : ""}">
      <button class="mrow-head" type="button">
        <span class="mrow-n">${String(n).padStart(2, "0")}</span>
        <span class="mrow-name">${esc(m.name)}</span>
        <span class="mrow-impact">${esc(m.impact)}</span>
        <span class="mrow-chev">&#9662;</span>
      </button>
      <div class="mrow-body">
        <div class="mrow-asset">${esc(m.asset)}</div>
        <div class="mrow-why"><b>Why:</b> ${esc(m.why)}</div>
        <div class="mrow-foot"><span class="mc-tag ${side === "on-site" ? "on" : "off"}">${esc(side)}</span><span class="mc-effort">${esc(m.effort)}</span></div>
      </div>
    </div>`;
  }

  function movesHtml() {
    let n = 0;
    const blocks = PHASES.map((ph, pi) => {
      const rows = MOVES.filter((m) => m.lever === ph.lever)
        .map((m) => moveRow(m, ++n, ph.side, n === 1)).join("");
      return `<div class="mphase">
        <div class="mphase-h"><span class="mphase-n">Phase ${pi + 1}</span>
          <span class="mphase-lever">${esc(ph.lever)}</span>
          <span class="mphase-tag">${esc(ph.side)} &middot; ${esc(ph.tag)}</span></div>
        <div class="mphase-rows">${rows}</div></div>`;
    }).join("");
    return `<div class="gsec"><h2 id="gen-moves" class="g-h2"><span class="g-n">01</span>Your 10 "Genius" moves</h2>
      <p class="g-h2sub">Ordered the way AI rewards it: grounding first, then corroboration, then prominence. Tap a move to see the exact play. Figures are illustrative.</p>
      ${blocks}</div>`;
  }

  function stackHtml() {
    const max = Math.max(...DATA.citationStack.map((s) => s.n));
    const rows = DATA.citationStack.map((s) =>
      `<tr><td class="cs-src">${esc(s.src)}<small>${esc(s.kind)}</small></td>
        <td class="cs-bar"><span class="cs-track"><i style="width:${Math.round((s.n / max) * 100)}%"></i></span><b>${s.n}x</b></td>
        <td class="cs-you"><span class="cs-no">Not in it</span></td></tr>`).join("");
    return `<div class="gsec"><h2 id="gen-stack" class="g-h2"><span class="g-n">02</span>The Citation Stack</h2>
      <p class="g-h2sub">The sources AI actually cites when buyers ask about your category, ranked by how many of your queries each shows up in. You are in none of them yet. Get into the top ones first.</p>
      <div class="cs-wrap"><table class="cs-table"><thead><tr><th>Source</th><th>Cited in your queries</th><th>You</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`;
  }

  function moneyHtml() {
    const m = DATA.money;
    const opts = [10000, 25000, 50000, 100000].map((v) =>
      `<button class="mm-opt${v === m.perCustomer ? " on" : ""}" data-v="${v}">${usd(v)}</button>`).join("");
    const tiers = m.tiers.map((t) => {
      const rev = m.perCustomer * t.customers;
      return `<div class="mm-tier"><div class="mm-tlabel">${esc(t.label)}</div>
        <div class="mm-rev" data-c="${t.customers}">${usd(rev)}</div><div class="mm-sub">net new revenue / yr</div>
        <div class="mm-meta">${(t.customers / 12).toFixed(1)} deals a month &middot; ${t.customers} customers a year</div></div>`;
    }).join("");
    const demand = DATA.demand.map((d) =>
      `<div class="mm-d"><div class="mm-dnum">${esc(d[0])}</div><div class="mm-dlabel">${esc(d[1])}</div><div class="mm-ddesc">${esc(d[2])}</div></div>`).join("");
    return `<div class="gsec"><h2 id="gen-money" class="g-h2"><span class="g-n">03</span>The Money Model</h2>
      <p class="g-h2sub">What becoming the AEO authority for <span class="catq">"${esc(DATA.category)}"</span> is worth to ${esc(DATA.brand)}.</p>
      <div class="mm-card">
        <div class="mm-q">What's one new customer worth to you?</div>
        <div class="mm-opts" id="mmOpts">${opts}</div>
        <div class="mm-tiers" id="mmTiers">${tiers}</div>
        <div class="mm-demand-h">There is more than enough demand to exceed these numbers.</div>
        <div class="mm-demand">${demand}</div>
      </div></div>`;
  }

  function scoresHtml() {
    const cards = DATA.scores.map((s) =>
      `<div class="sc-card"><div class="sc-donut">${donut(s.val)}</div>
        <div class="sc-name">${esc(s.name)}</div><div class="sc-note">${esc(s.note)}</div>
        <div class="sc-lever ${s.lever === "grounding" ? "g" : "o"}">${s.lever === "grounding" ? "Grounding" : "Off-site"}</div></div>`).join("");
    return `<div class="gsec"><h2 id="gen-scores" class="g-h2"><span class="g-n">04</span>The Bottom Line</h2>
      <p class="g-h2sub">Improve these four scores, in this order, to displace your competition and become the AEO authority in your space. Every one is fixable, and the moves above are how.</p>
      <div class="sc-grid">${cards}</div></div>`;
  }

  function ctaHtml() {
    return `<div class="gcta"><div class="gcta-eyebrow">Ready to run the playbook?</div>
      <h3>You've got the 10 moves. We build them for you.</h3>
      <p>This is the plan. The hard part is execution. Book a call and we'll turn these moves into your AEO Blueprint, prioritized and done with you.</p>
      <a class="gcta-btn" href="#">Book an AEO Strategy Call</a></div>`;
  }

  // ── styles ───────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("genie-style")) return;
    const css = `
    .gen{--ink:#f3f2f6;--muted:#9b97a8;--line:#2a2a30;--card:#141417;--card2:#1b1b20;--track:#2c2c33;
      --bad:#e5484d;--warn:#f5a623;--ok:#34c98a;--g1:#c47bff;--grad:linear-gradient(100deg,#7612fa,#c109af 52%,#ff6221);
      --sh:0 1px 2px rgba(0,0,0,.4),0 20px 44px -24px rgba(0,0,0,.7);--shs:0 1px 2px rgba(0,0,0,.3),0 10px 26px -18px rgba(0,0,0,.6);
      color:var(--ink);max-width:920px;margin:0 auto;padding:8px 16px 100px}
    .gen *{box-sizing:border-box}
    html{scroll-behavior:smooth}.gen [id^="gen-"]{scroll-margin-top:24px}
    .gen .catq{color:var(--g1);font-weight:800}
    /* sidebar */
    .gen .gnav{display:none;position:fixed;left:16px;top:50%;transform:translateY(-50%);width:184px;z-index:40;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 14px;box-shadow:var(--sh)}
    .gen .gnav-h{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--g1);line-height:1.25;margin:2px 4px 12px}
    .gen .gnav-links{display:flex;flex-direction:column;gap:2px}
    .gen .gnav-link{display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;text-decoration:none;color:var(--muted);transition:background .15s,color .15s;position:relative}
    .gen .gnav-link:hover,.gen .gnav-link.active{background:var(--card2);color:var(--ink)}
    .gen .gnav-n{font-size:11px;font-weight:800;color:#5f5b6e;flex:0 0 18px}
    .gen .gnav-link.active .gnav-n{color:var(--g1)}
    .gen .gnav-t{font-size:13px;font-weight:700;line-height:1.2}
    .gen .gnav-link.active::before{content:"";position:absolute;left:-14px;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--grad)}
    @media(min-width:1300px){.gen .gnav{display:block}}
    /* hero */
    .gen .ghead{position:relative;overflow:hidden;background:var(--card);border:1px solid var(--line);border-radius:26px;padding:48px 40px 40px;margin-top:18px;text-align:center;box-shadow:var(--sh)}
    .gen .ghead::before{content:"";position:absolute;left:-10%;right:30%;top:-50%;height:120%;background:radial-gradient(50% 60% at 40% 50%,rgba(118,18,250,.22),rgba(255,98,33,.10) 40%,transparent 70%);pointer-events:none}
    .gen .g-eyebrow{position:relative;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--g1)}
    .gen .g-title{position:relative;font-size:clamp(30px,4.4vw,46px);font-weight:800;letter-spacing:-.02em;margin:10px 0 0;line-height:1.05}
    .gen .g-sub{position:relative;font-size:16px;color:#cfccd9;margin:14px auto 0;max-width:620px;line-height:1.55}.gen .g-sub b{color:var(--ink)}
    .gen .ghero-pills{position:relative;display:flex;justify-content:center;flex-wrap:wrap;gap:16px;margin-top:28px;padding-top:24px;border-top:1px solid var(--line)}
    .gen .gpill{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:96px;text-decoration:none;color:inherit;border-radius:12px;padding:8px 6px;transition:background .15s,transform .15s}
    .gen .gpill:hover{background:var(--card2);transform:translateY(-2px)}
    .gen .gpd{width:56px;height:56px}.gen .gpd.bad{color:var(--bad)}.gen .gpd.warn{color:var(--warn)}.gen .gpd.ok{color:var(--ok)}
    .gen .gpn{font-size:16px;font-weight:800;fill:var(--ink)}
    .gen .gpname{font-weight:700;font-size:12.5px;text-align:center;max-width:110px;line-height:1.2;color:var(--muted)}
    .gen .g-note{position:relative;margin-top:18px;font-size:13px;color:var(--muted)}
    /* sections */
    .gen .gsec{margin-top:40px}
    .gen .g-h2{font-size:clamp(22px,2.6vw,28px);font-weight:800;letter-spacing:-.02em;margin:0 0 6px;display:flex;align-items:center}
    .gen .g-n{display:inline-flex;align-items:center;justify-content:center;min-width:1.7em;height:1.7em;padding:0 .45em;margin-right:.5em;border-radius:8px;background:rgba(118,18,250,.14);border:1px solid rgba(118,18,250,.35);color:var(--g1);font-size:.6em;font-weight:800;font-variant-numeric:tabular-nums}
    .gen .g-h2sub{margin:0 0 20px;color:var(--muted);font-size:14.5px;line-height:1.5;max-width:680px}
    /* moves: phased roadmap of expandable rows */
    .gen .mphase{margin-bottom:26px}
    .gen .mphase-h{display:flex;align-items:baseline;gap:10px;margin:0 2px 12px;padding-bottom:10px;border-bottom:1px solid var(--line)}
    .gen .mphase-n{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--g1)}
    .gen .mphase-lever{font-size:18px;font-weight:800;letter-spacing:-.01em}
    .gen .mphase-tag{font-size:12.5px;color:var(--muted);font-weight:600;margin-left:auto}
    .gen .mphase-rows{display:flex;flex-direction:column;gap:8px}
    .gen .mrow{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:var(--shs);transition:border-color .15s}
    .gen .mrow:hover{border-color:#3a3a44}
    .gen .mrow-head{display:flex;align-items:center;gap:14px;width:100%;background:none;border:none;color:var(--ink);text-align:left;cursor:pointer;padding:15px 18px;font-family:inherit}
    .gen .mrow-n{font-size:13px;font-weight:800;color:var(--g1);font-variant-numeric:tabular-nums;flex:0 0 auto}
    .gen .mrow-name{font-size:15.5px;font-weight:800;flex:1;letter-spacing:-.01em}
    .gen .mrow-impact{font-size:12px;font-weight:800;color:var(--ok);background:rgba(52,201,138,.12);padding:4px 10px;border-radius:8px;white-space:nowrap}
    .gen .mrow-chev{color:var(--muted);font-size:13px;transition:transform .15s;flex:0 0 auto}
    .gen .mrow.open .mrow-chev{transform:rotate(180deg)}
    .gen .mrow-body{display:none;padding:0 18px 18px 46px}
    .gen .mrow.open .mrow-body{display:block}
    .gen .mrow-asset{font-size:14px;line-height:1.55;color:#cfccd9}
    .gen .mrow-why{font-size:13px;line-height:1.5;color:var(--muted);margin-top:10px}.gen .mrow-why b{color:#cfccd9}
    .gen .mrow-foot{display:flex;align-items:center;gap:10px;margin-top:14px}
    .gen .mc-tag{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border-radius:7px}
    .gen .mc-tag.on{color:#c9a6ff;background:rgba(118,18,250,.16)}.gen .mc-tag.off{color:#ffb38a;background:rgba(255,98,33,.14)}
    .gen .mc-effort{font-size:12px;color:var(--muted);font-weight:700;margin-left:auto}
    @media(max-width:480px){.gen .mrow-impact{display:none}}
    /* citation stack */
    .gen .cs-wrap{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:8px 22px 18px;box-shadow:var(--shs)}
    .gen .cs-table{width:100%;border-collapse:collapse}
    .gen .cs-table th{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;text-align:left;padding:14px 8px 10px}
    .gen .cs-table td{padding:12px 8px;border-top:1px solid var(--line);vertical-align:middle}
    .gen .cs-src{font-weight:800;font-size:14.5px}.gen .cs-src small{display:block;font-weight:600;color:var(--muted);font-size:12px;margin-top:2px}
    .gen .cs-bar{display:flex;align-items:center;gap:12px;min-width:200px}
    .gen .cs-track{flex:1;height:10px;background:var(--card2);border-radius:999px;overflow:hidden;max-width:260px}
    .gen .cs-track i{display:block;height:100%;background:var(--grad);border-radius:999px}
    .gen .cs-bar b{font-weight:800;font-size:14px;flex:0 0 30px}
    .gen .cs-no{font-size:12px;font-weight:800;color:#f3a0a2;background:rgba(229,72,77,.12);border:1px solid rgba(229,72,77,.25);border-radius:7px;padding:3px 9px;white-space:nowrap}
    /* money model */
    .gen .mm-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:28px;box-shadow:var(--shs)}
    .gen .mm-q{font-size:18px;font-weight:800;text-align:center;margin-bottom:16px}
    .gen .mm-opts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:26px}
    .gen .mm-opt{background:var(--card2);border:1px solid var(--line);color:#cfccd9;font-weight:800;font-size:15px;padding:11px 20px;border-radius:11px;cursor:pointer;transition:.15s}
    .gen .mm-opt.on{background:var(--grad);color:#fff;border-color:transparent}
    .gen .mm-tiers{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
    @media(max-width:680px){.gen .mm-tiers{grid-template-columns:1fr}}
    .gen .mm-tier{background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:20px;text-align:center}
    .gen .mm-tier:nth-child(2){border-color:rgba(118,18,250,.4)}
    .gen .mm-tlabel{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
    .gen .mm-rev{font-size:40px;font-weight:800;letter-spacing:-.02em;margin:8px 0 2px;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
    .gen .mm-sub{font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    .gen .mm-meta{font-size:12.5px;color:#cfccd9;margin-top:10px}
    .gen .mm-demand-h{text-align:center;font-weight:800;font-size:16px;margin:26px 0 16px}
    .gen .mm-demand{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
    @media(max-width:680px){.gen .mm-demand{grid-template-columns:1fr}}
    .gen .mm-d{text-align:center;padding:6px}
    .gen .mm-dnum{font-size:30px;font-weight:800;color:var(--g1);letter-spacing:-.02em}
    .gen .mm-dlabel{font-weight:800;font-size:13.5px;margin-top:2px}
    .gen .mm-ddesc{font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.45}
    /* scores */
    .gen .sc-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px}
    @media(max-width:760px){.gen .sc-grid{grid-template-columns:1fr 1fr}}
    .gen .sc-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px 18px;text-align:center;box-shadow:var(--shs)}
    .gen .sc-donut{width:56px;margin:0 auto 10px}
    .gen .sc-name{font-weight:800;font-size:15px}
    .gen .sc-note{font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.45;min-height:54px}
    .gen .sc-lever{display:inline-block;margin-top:8px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:3px 9px;border-radius:7px}
    .gen .sc-lever.g{color:#c9a6ff;background:rgba(118,18,250,.16)}.gen .sc-lever.o{color:#ffb38a;background:rgba(255,98,33,.14)}
    /* cta */
    .gen .gcta{margin-top:44px;background:var(--grad);border-radius:22px;padding:42px;text-align:center;color:#fff;box-shadow:0 26px 54px -22px rgba(193,9,175,.6)}
    .gen .gcta-eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;opacity:.9}
    .gen .gcta h3{font-size:26px;margin:8px 0;font-weight:800;letter-spacing:-.01em}
    .gen .gcta p{margin:0 auto 22px;max-width:520px;opacity:.95;line-height:1.55}
    .gen .gcta-btn{display:inline-block;background:#fff;color:#7612fa;font-weight:800;padding:15px 30px;border-radius:12px;text-decoration:none;transition:transform .15s}
    .gen .gcta-btn:hover{transform:translateY(-2px)}`;
    const el = document.createElement("style");
    el.id = "genie-style"; el.textContent = css;
    document.head.appendChild(el);
  }

  // ── wiring ───────────────────────────────────────────────────────────────
  function wire() {
    // move rows: click head to expand/collapse
    document.querySelectorAll(".gen .mrow-head").forEach((h) =>
      h.addEventListener("click", () => h.parentElement.classList.toggle("open")));
    // money model value selector
    const opts = document.getElementById("mmOpts");
    if (opts) opts.addEventListener("click", (e) => {
      const b = e.target.closest(".mm-opt"); if (!b) return;
      const v = Number(b.getAttribute("data-v"));
      opts.querySelectorAll(".mm-opt").forEach((o) => o.classList.toggle("on", o === b));
      DATA.money.perCustomer = v;
      document.querySelectorAll("#mmTiers .mm-rev").forEach((r) => {
        r.textContent = usd(v * Number(r.getAttribute("data-c")));
      });
    });
    // sidebar scrollspy
    const nav = document.getElementById("gnav");
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll(".gnav-link"));
    const byId = {};
    const setActive = (a) => { links.forEach((l) => l.classList.remove("active")); if (a) a.classList.add("active"); };
    links.forEach((a) => { byId[a.getAttribute("data-target").replace("#", "")] = a; a.addEventListener("click", () => setActive(a)); });
    const targets = Object.keys(byId).map((id) => document.getElementById(id)).filter(Boolean);
    if (targets.length) setActive(byId[targets[0].id]);
    if (!("IntersectionObserver" in window) || !targets.length) return;
    const vis = new Set();
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) vis.add(e.target.id); else vis.delete(e.target.id); });
      let best = null, top = Infinity;
      vis.forEach((id) => { const el = document.getElementById(id); if (el) { const t = el.getBoundingClientRect().top; if (t < top) { top = t; best = id; } } });
      if (best && byId[best]) setActive(byId[best]);
    }, { rootMargin: "0px 0px -65% 0px", threshold: 0 });
    targets.forEach((t) => io.observe(t));
  }

  function boot() {
    injectStyles();
    const host = document.getElementById("genie");
    if (!host) return;
    host.innerHTML = `<div class="gen">` +
      sidebarHtml() + heroHtml() + movesHtml() + stackHtml() + moneyHtml() + scoresHtml() + ctaHtml() +
      `</div>`;
    wire();
    window.scrollTo({ top: 0 });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
