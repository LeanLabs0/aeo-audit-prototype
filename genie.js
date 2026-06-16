/* genie.js — AEO Genie preview (Phase 0).
 * Self-contained dark-themed renderer. Data is REAL Lean Labs scan output
 * (loop-marketing / AI-powered marketing for startups), hardcoded for the
 * preview per Kevin's "build a preview, not a functional prototype".
 * Methodology spine: grounding -> corroboration -> prominence (Kevin's workshop).
 * No em dashes anywhere (esc strips them).
 */
(function () {
  "use strict";

  // ── DATA ─────────────────────────────────────────────────────────────────
  // Seed values are the Lean Labs preview (Phase 0). When a Baseline scan is in
  // sessionStorage, boot() fetches the live /aeo-genie moves and overwrites DATA +
  // MOVES with the real per-brand result (see loadDynamic / applyGenieResponse).
  let DATA = {
    brand: "Lean Labs",
    category: "AI-powered marketing agency for startups",
    url: "https://www.leanlabs.com/solutions/loop-marketing",
    score: 41,
    // Kevin's pyramid, mapped from the Baseline pillars
    scores: [
      { key: "structured", name: "Structured Data", lever: "grounding", val: 90, note: "Machine-readable signals that tell AI what you offer." },
      { key: "grounding", name: "Grounding Pages", lever: "grounding", val: 38, note: "Authoritative pages AI can cite as its source." },
      { key: "corroboration", name: "Corroboration", lever: "off-site", val: 75, note: "Third-party sources that verify your claims." },
      { key: "prominence", name: "Prominence", lever: "off-site", val: 11, note: "How often you surface in AI answers for your space." },
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

  // The 10 moves. DYNAMIC by design: which moves surface, in what order, and the
  // numbers inside them are driven by the brand's own scan (weaknesses first). This
  // Phase 0 preview hardcodes Lean Labs values pulled from DATA above. Copy per Ryan
  // (evens) + Jonathan (odds): lead with the VALUE so the collapsed card sells the
  // move before the user opens it (Kevin: "the closed accordion is the most important
  // view"). Each move = name (the play) + hook (the so-what, shown collapsed) + why
  // (the reason) + how (the exact, executable steps).
  let MOVES = [
    // ── ON-SITE: 5 moves on your own site ──────────────────────────────────
    { side: "on-site", name: "Create better corroboration",
      hook: "Make AI trust you instantly with made-for-AI identity links.",
      why: "AI can't easily confirm the identity and credibility of your business. Linking out proves it, and corroboration is what AI weighs most.",
      how: "Add made-for-AI links (\"sameAs\" JSON-LD) to your site that let AI understand the most important aspects of your business in seconds, and tie that data to review sites like G2, Crunchbase and LinkedIn so what you claim is substantiated.",
      impact: "Instant AI trust" },
    { side: "on-site", name: "Create content answering these 5 questions",
      hook: "AI named a competitor, not you, on 9 of 12 buyer questions.",
      why: "Out of the most common questions your buyers ask, AI named your competitors and not you 9 out of 12 times.",
      how: "Create AI-optimized content answering the exact buyer questions you're invisible on:",
      how_items: [
        "What are the best AI marketing agencies for Series A startups?",
        "Best HubSpot marketing agencies with AI automation",
        "Top AI marketing agencies for early-stage founders",
        "Who are the best growth marketing agencies for SaaS?",
        "Most trusted HubSpot partner agencies for startup CMOs",
      ],
      impact: "Up to 5 query placements" },
    { side: "on-site", name: "Tell customers why they'd choose a competitor",
      hook: "Naming rivals where they win makes AI trust you more.",
      why: "Unbiased content that names competitors for the specific areas where they perform better actually helps you show up in AI answers.",
      how: "Publish content naming a relevant competitor as the leader for a particular service or product, with your brand as #2 or #3. The impartial stance increases AI's trust in you.",
      impact: "Win vs/alternatives queries" },
    { side: "on-site", name: "Build an AI-marketing grounding foundation",
      hook: "Your site is too thin for AI to cite. Grounding score: 38/100.",
      why: "Your grounding content scored only 38/100. That means your site content is too thin for AI to consider it authoritative enough to cite.",
      how: "Create a cluster of pillar and supporting pages around your core topic so AI comes to see topical depth and expertise, not one-off posts.",
      impact: "Grounding 38 to 80+" },
    { side: "on-site", name: "Structure your data so AI can read it",
      hook: "Schema lets AI understand and quote you correctly.",
      why: "AI-readable language called \"schema\" lets AI engines understand your pages and quote you correctly in their recommendations.",
      how: "Select the right schema for your site and each key page, then deploy it with an llms.txt file built for AI that optimizes token usage for easy ingestion.",
      impact: "Structured data 90 to 95" },
    // ── OFF-SITE: 5 moves across the web (~90% of the game) ─────────────────
    { side: "off-site", name: "Leverage external content AI already loves",
      hook: "You're in none of the sources AI cites. Get into them.",
      why: "You're in none of the sources AI cites for your most relevant queries. It's faster to gain authority by getting into the content AI already cites than to build it from scratch.",
      how: "Contact these publishers, highest-frequency first, and pitch your solution as a relevant inclusion:",
      how_items: [
        "rzlt.io (cited in 4 of your queries)",
        "tripledart.com (cited in 3)",
        "blendb2b.com (cited in 2)",
        "pitchkitchen.com (cited in 2)",
      ],
      impact: "Corroboration across cited queries" },
    { side: "off-site", name: "Claim your reputation",
      hook: "Anchor to a 3rd-party source of truth AI already trusts.",
      why: "Claiming your Wikipedia and creating a Wikidata entity anchors your business to a third-party source of trust, adding further credibility and corroboration.",
      how: "Wikipedia was cited in 4 of your queries. Create a company Wikidata entity to give AI engines a canonical source of truth about you.",
      impact: "Canonical entity" },
    { side: "off-site", name: "Get reviews on external websites (no longer optional)",
      hook: "Reviews drive AI sentiment, with a fast time-to-effect.",
      why: "Reputable review sites are powerful at driving AI sentiment. Reviews build brand authority and act fast on AI platforms.",
      how: "Get 5+ G2/Clutch reviews that name the solution, the buyer, the outcome and the decision factors, not just stars. (Reputation Rocket.)",
      impact: "Sentiment + authority" },
    { side: "off-site", name: "When buyers talk, it should be about you",
      hook: "AI weighs what customers say about you in the wild.",
      why: "AI cares not just about what you say about your business, but what any collective group of customers says in online forums or communities.",
      how: "Set up and maintain a system to monitor where your business is mentioned online and what is being said. AI reads these as a measure of your prominence.",
      impact: "Raises prominence" },
    { side: "off-site", name: "Build a case-study co-marketing loop",
      hook: "Turn happy clients into corroborated prominence, cheaply.",
      why: "The closest experts on your value are your customers. Case studies are an inexpensive way to manufacture the corroborated prominence AI holds in high regard.",
      how: "Tie a modest discount to a recent client posting results on their site, a review site and a relevant Reddit thread. You can write it, they must approve it.",
      impact: "Compounding mentions" },
  ];

  const SECTIONS = [
    { id: "gen-moves", label: "Your moves" },
    { id: "gen-stack", label: "Citation Stack" },
    { id: "gen-money", label: "Money Model" },
    { id: "gen-scores", label: "Four AEO Levers" },
  ];

  // ── helpers ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/[—–]/g, "-")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  const tone = (v) => (v >= 70 ? "ok" : v >= 40 ? "warn" : "bad");
  // Render text with [anchor](url) markdown links; any bare URL that slips through
  // becomes a contextual "this article" link (Kevin: naked URLs say "move on").
  function linky(str) {
    const stash = [];
    let h = esc(str);
    h = h.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (m, t, u) => {
      stash.push(`<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
      return `\u0000${stash.length - 1}\u0000`;
    });
    h = h.replace(/(^|[\s(>])(https?:\/\/[^\s<)]+)/g, (m, pre, u) => {
      stash.push(`<a href="${u}" target="_blank" rel="noopener">this article</a>`);
      return `${pre}\u0000${stash.length - 1}\u0000`;
    });
    return h.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[+i]);
  }
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
      `<a class="gnav-link" href="#${s.id}" data-target="#${s.id}"><span class="gnav-t">${esc(s.id === "gen-moves" ? `Your ${MOVES.length} genius moves` : s.label)}</span></a>`).join("");
    return `<nav class="gnav" id="gnav" aria-label="Genie sections">
      <div class="gnav-h">Your<br>AEO Genie</div><div class="gnav-links">${links}</div></nav>`;
  }

  function heroHtml() {
    // Kevin's "3 wishes" top: the hero sells the WHOLE report (clickable wishes jump
    // to their sections); the moves get introduced ONCE, in section 1, not twice.
    const wishes = [
      { n: 1, t: `${MOVES.length} genius moves to make now`, h: "#gen-moves" },
      { n: 2, t: "A genius citation strategy", h: "#gen-stack" },
      { n: 3, t: "A genius AEO money model", h: "#gen-money" },
    ].map((w) => `<a class="gwish" href="${w.h}"><span class="gwish-n">${w.n}</span><span class="gwish-t">${esc(w.t)}</span><span class="gwish-go">&darr;</span></a>`).join("");
    return `<div class="ghead">
      <img class="g-genie" src="genie-img.png" alt="" aria-hidden="true">
      <div class="g-eyebrow">AEO Genie</div>
      <h1 class="g-title">The AEO Genie granted you<br>3 wishes</h1>
      <p class="g-sub">Everything <b>${esc(DATA.brand)}</b> needs to get cited, recommended, and named first across the AI answer engines your buyers already trust.</p>
      <div class="gwishes">${wishes}</div>
      ${DATA.url ? `<div class="g-runfor">Run for <b>${esc(String(DATA.url).replace(/^https?:\/\//, ""))}</b></div>` : ""}
    </div>`;
  }

  const PHASES = [
    { side: "on-site", title: "On-site moves", tag: "your website",
      lift: "Lifts your Grounding and Structured Data scores." },
    { side: "off-site", title: "Off-site moves", tag: "across the web",
      lift: "Lifts your Corroboration and Prominence scores. This is roughly 90% of the game." },
  ];

  function moveRow(m, n, side, open) {
    // Collapsed view leads with name + hook (the so-what) so the user wants to open.
    return `<div class="mrow${open ? " open" : ""}">
      <button class="mrow-head" type="button">
        <span class="mrow-n">${String(n).padStart(2, "0")}</span>
        <span class="mrow-headtext">
          <span class="mrow-name">${esc(m.name)}</span>
          <span class="mrow-hook">${esc(m.hook)}</span>
        </span>
        ${m.impact ? `<span class="mrow-impact">${esc(m.impact)}</span>` : ""}
        <span class="mrow-chev">&#9662;</span>
      </button>
      <div class="mrow-body">
        <div class="mrow-line"><span class="mrow-lbl why">Why</span><span>${esc(m.why)}</span></div>
        <div class="mrow-line"><span class="mrow-lbl how">How</span><span>${linky(m.how)}${(m.how_items && m.how_items.length) ? `<ul class="mrow-items">${m.how_items.map((it) => `<li>${linky(it)}</li>`).join("")}</ul>` : ""}</span></div>
      </div>
    </div>`;
  }

  function movesHtml() {
    let n = 0;
    const blocks = PHASES.map((ph) => {
      const rows = MOVES.filter((m) => m.side === ph.side)
        .map((m) => moveRow(m, ++n, ph.side, n === 1)).join("");
      return `<div class="mphase">
        <div class="mphase-h">
          <span class="mphase-lever">${esc(ph.title)}</span>
          <span class="mphase-tag ${ph.side === "on-site" ? "on" : "off"}">${esc(ph.tag)}</span>
          <div class="mphase-lift">${esc(ph.lift)}</div>
        </div>
        <div class="mphase-rows">${rows}</div></div>`;
    }).join("");
    return `<div class="gsec"><h2 id="gen-moves" class="g-h2">Your ${MOVES.length} genius moves</h2>
      <p class="g-h2sub">${MOVES.length} specific plays to get ${esc(DATA.brand)} recommended by AI, drawn from your scan and ordered by impact. Each one names the move, why it matters, and exactly how to do it. Tap any move.</p>
      ${blocks}</div>`;
  }

  function stackHtml() {
    // Truth-first stack: own site excluded; competitor domains excluded; the rest
    // split by VERIFIED presence (we fetch and read each cited page server-side):
    //   mentioned===true  -> "Already citing you" (Kevin's congrats view)
    //   mentioned===false -> verified absent -> the outreach list
    //   mentioned===null  -> shown in the list with an honest "unverified" tag
    const pool = DATA.citationStack.filter((s) => !s.you && !s.competitor);
    const inIt = pool.filter((s) => s.mentioned === true);
    const out = pool.filter((s) => s.mentioned !== true);
    const max = Math.max(1, ...pool.map((s) => s.n));
    const bar = (s) => `<td class="cs-bar"><span class="cs-track"><i style="width:${Math.round((s.n / max) * 100)}%"></i></span><b>${s.n}x</b></td>`;
    const srcCell = (s) => `<td class="cs-src"><a class="cs-link" href="${esc((s.urls && s.urls[0]) || ("https://" + s.src))}" target="_blank" rel="noopener">${esc(s.src)}<span class="cs-ext">&#8599;</span></a><small>${esc(s.kind)}</small></td>`;
    const inRows = inIt.map((s) =>
      `<tr>${srcCell(s)}${bar(s)}<td class="cs-you"><span class="cs-yes">&#10003; Cites you</span></td></tr>`).join("");
    const inBlock = inIt.length ? `
      <h3 class="cs-subhead in">Already citing you</h3>
      <div class="cs-wrap"><table class="cs-table"><thead><tr><th>Source</th><th>Cited in your queries</th><th></th></tr></thead>
        <tbody>${inRows}</tbody></table></div>` : "";
    const SHOW = 10;
    const outRow = (s, hidden) =>
      `<tr${hidden ? ' class="cs-more" hidden' : ""}>${srcCell(s)}${bar(s)}<td class="cs-you">${s.mentioned === false ? '<span class="cs-no">Not in it</span>' : '<span class="cs-unk">Unverified</span>'}</td></tr>`;
    const outRows = out.map((s, i) => outRow(s, i >= SHOW)).join("");
    const more = out.length > SHOW
      ? `<div class="cs-morewrap"><button type="button" class="cs-morebtn" id="csMoreBtn">Show all ${out.length} sources</button></div>` : "";
    const summary = inIt.length
      ? `AI cites ${pool.length} third-party sources when buyers ask about your category. You're already in ${inIt.length} of them. Below are the ones to win next, ranked by how many of your queries each shows up in.`
      : `These are the third-party sources AI actually cites when buyers ask about your category, ranked by how many of your queries each shows up in. Get into the top ones first.`;
    return `<div class="gsec"><h2 id="gen-stack" class="g-h2">Your Genius Citation Strategy</h2>
      <p class="g-h2sub">From our research, the single biggest lever is off-site citations. ${summary}</p>
      ${inBlock}
      ${inIt.length ? '<h3 class="cs-subhead out">The ones to win next</h3>' : ""}
      <div class="cs-wrap"><table class="cs-table"><thead><tr><th>Source</th><th>Cited in your queries</th><th>You</th></tr></thead>
        <tbody>${outRows}</tbody></table>${more}</div></div>`;
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
    return `<div class="gsec"><h2 id="gen-money" class="g-h2">Your Genius Money Model</h2>
      <p class="g-h2sub">We did some research for you. Here is what becoming the AEO authority for <span class="catq">"${esc(DATA.category)}"</span> is worth to ${esc(DATA.brand)}.</p>
      <div class="mm-card">
        <div class="mm-q">What's one new customer worth to you?</div>
        <div class="mm-opts" id="mmOpts">${opts}<span class="mm-or">or</span><span class="mm-custom">$<input id="mmCustom" type="number" min="0" step="1000" placeholder="your number"></span></div>
        <div class="mm-tiers" id="mmTiers">${tiers}</div>
        <div class="mm-demand-h">There is more than enough demand to exceed these numbers.</div>
        <div class="mm-demand">${demand}</div>
      </div></div>`;
  }

  function scoresHtml() {
    const cards = DATA.scores.map((s, i) =>
      `<div class="sc-card"><div class="sc-donut">${donut(s.val)}</div>
        <div class="sc-name">${esc(s.name)}</div><div class="sc-note">${esc(s.note)}</div></div>`).join("");
    return `<div class="gsec"><h2 id="gen-scores" class="g-h2">Four AEO Levers</h2>
      <p class="g-h2sub">Improve these four scores, in this order. Every lever is moveable, and the three wishes above are how it's done.</p>
      <div class="sc-grid">${cards}</div></div>`;
  }

  function ctaHtml() {
    return `<div class="gnext">
      <div class="gnext-done"><span class="gnext-check">&#10003;</span> You've run the AEO Genie. Your wishes are granted.</div>
      <h3 class="gnext-h">Ready to become the AEO Authority in your space?</h3>
      <div class="gnext-cards">
        <div class="gnext-card">
          <div class="gnext-eyebrow">AEO Accelerator</div>
          <div class="gnext-title">Join a free live session to master the 4 levers of AEO.</div>
          <p>A one-day live session with Kevin Barber, Lean Labs' Head of AI Growth. Master the 4 AEO levers and leave with a GTM plan you can run.</p>
          <div class="gnext-when">Free to attend live &middot; capped at 5 brands/week</div>
          <p class="gnext-who"><b>Who is this for:</b> Marketers who want to learn AEO from the source and build their own plan.</p>
          <a class="gnext-btn" href="#">Save my seat</a>
        </div>
        <div class="gnext-card">
          <div class="gnext-eyebrow">AEO Strategy Call</div>
          <div class="gnext-title">Book a 30-minute call with our Head of AI Growth.</div>
          <p>Talk one-to-one with Kevin Barber. See where you stand in AI answers, your biggest opportunities, and the fastest path to the authority.</p>
          <div class="gnext-when">Free &middot; 30 minutes on Google Meet</div>
          <p class="gnext-who"><b>Who is this for:</b> Marketers who want a direct, personalized read on their next move.</p>
          <a class="gnext-btn alt" href="#">Book an AEO Strategy Call</a>
        </div>
      </div>
    </div>`;
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
    /* loading */
    .gen .g-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:60vh;padding:40px 20px}
    .gen .g-spin{width:44px;height:44px;border-radius:50%;border:4px solid var(--card2);border-top-color:var(--g1);animation:gspin .9s linear infinite}
    @keyframes gspin{to{transform:rotate(360deg)}}
    .gen .g-load-h{font-size:22px;font-weight:800;margin-top:22px;letter-spacing:-.01em}
    .gen .g-load-sub{font-size:14.5px;color:var(--muted);margin-top:8px;max-width:420px;line-height:1.5}
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
    .gen .ghead{position:relative;overflow:hidden;background:var(--card);border:1px solid var(--line);border-radius:26px;padding:236px 40px 40px;margin-top:18px;text-align:center;box-shadow:var(--sh)}
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
    .gen .g-sample{background:rgba(245,166,35,.1);border:1px solid rgba(245,166,35,.4);border-radius:13px;padding:13px 18px;margin-top:14px;font-size:13.5px;color:#f0d9b0;line-height:1.5}
    .gen .g-sample b{color:var(--warn)}
    .gen .g-sample a{color:var(--g1);font-weight:800;text-decoration:none;margin-left:6px;white-space:nowrap}
    /* hero wishes */
    .gen .g-genie{position:absolute;left:50%;top:-12px;transform:translateX(-50%);width:min(420px,80%);opacity:.5;mix-blend-mode:screen;pointer-events:none;user-select:none;animation:gfloat 6s ease-in-out infinite}
    @keyframes gfloat{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-10px)}}
    .gen .gwishes{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:26px;padding-top:24px;border-top:1px solid var(--line)}
    .gen .gwish{display:flex;align-items:center;gap:11px;width:min(440px,100%);text-decoration:none;color:var(--ink);background:var(--card2);border:1px solid var(--line);border-radius:13px;padding:13px 18px;font-weight:700;font-size:14px;transition:transform .15s,border-color .15s}
    .gen .gwish .gwish-go{margin-left:auto}
    .gen .gwish:hover{transform:translateY(-2px);border-color:rgba(118,18,250,.5)}
    .gen .gwish-n{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:8px;background:var(--grad);color:#fff;font-size:12px;font-weight:800;flex:0 0 auto}
    .gen .gwish-go{color:var(--muted);font-size:13px}
    .gen .mrow-line a,.gen .mrow-items a{color:var(--g1);font-weight:700;text-decoration:none;border-bottom:1px solid rgba(196,123,255,.4)}
    .gen .mrow-line a:hover,.gen .mrow-items a:hover{border-bottom-color:var(--g1)}
    .gen .cs-yours{display:flex;align-items:flex-start;gap:10px;background:rgba(52,201,138,.08);border:1px solid rgba(52,201,138,.3);border-radius:12px;padding:13px 16px;margin-bottom:14px;font-size:13.5px;color:#cfe9dc;line-height:1.5}
    .gen .cs-yours b{color:var(--ink)}
    .gen .cs-check{color:var(--ok);font-weight:800;flex:0 0 auto}
    .gen .cs-link{color:var(--ink);text-decoration:none;border-bottom:1px solid transparent}
    .gen .cs-link:hover{color:var(--g1);border-bottom-color:rgba(196,123,255,.5)}
    .gen .cs-ext{font-size:11px;color:var(--muted);margin-left:5px;vertical-align:super}
    .gen .cs-link:hover .cs-ext{color:var(--g1)}
    .gen .cs-subhead{font-size:15px;font-weight:800;margin:18px 2px 10px;letter-spacing:-.01em}
    .gen .cs-subhead.in{color:var(--ok)}
    .gen .cs-subhead.out{color:var(--ink)}
    .gen .cs-yes{font-size:12px;font-weight:800;color:var(--ok);background:rgba(52,201,138,.12);border:1px solid rgba(52,201,138,.3);border-radius:7px;padding:3px 9px;white-space:nowrap}
    .gen .cs-unk{font-size:12px;font-weight:700;color:var(--muted);background:var(--card2);border:1px solid var(--line);border-radius:7px;padding:3px 9px;white-space:nowrap}
    .gen .g-runfor{position:relative;margin-top:16px;font-size:13px;color:var(--muted)}
    .gen .g-runfor b{color:#cfccd9}
    .gen .cs-morewrap{text-align:center;padding:14px 0 6px}
    .gen .cs-morebtn{background:var(--card2);border:1px solid var(--line);color:#cfccd9;font-weight:700;font-size:13px;padding:9px 18px;border-radius:10px;cursor:pointer}
    .gen .cs-morebtn:hover{border-color:rgba(118,18,250,.5);color:var(--ink)}
    /* sections */
    .gen .gsec{margin-top:40px}
    .gen .g-h2{font-size:clamp(22px,2.6vw,28px);font-weight:800;letter-spacing:-.02em;margin:0 0 6px;display:flex;align-items:center}
    .gen .g-n{display:inline-flex;align-items:center;justify-content:center;min-width:1.7em;height:1.7em;padding:0 .45em;margin-right:.5em;border-radius:8px;background:rgba(118,18,250,.14);border:1px solid rgba(118,18,250,.35);color:var(--g1);font-size:.6em;font-weight:800;font-variant-numeric:tabular-nums}
    .gen .g-h2sub{margin:0 0 20px;color:var(--muted);font-size:14.5px;line-height:1.5;max-width:680px}
    /* moves: phased roadmap of expandable rows */
    .gen .mphase{margin-bottom:26px}
    .gen .mphase-h{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px;margin:0 2px 12px;padding-bottom:10px;border-bottom:1px solid var(--line)}
    .gen .mphase-lever{font-size:18px;font-weight:800;letter-spacing:-.01em}
    .gen .mphase-tag{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:3px 9px;border-radius:7px;margin-left:auto}
    .gen .mphase-tag.on{color:#c9a6ff;background:rgba(118,18,250,.16)}.gen .mphase-tag.off{color:#ffb38a;background:rgba(255,98,33,.14)}
    .gen .mphase-lift{flex-basis:100%;margin-top:2px;font-size:13px;color:var(--muted);line-height:1.45}
    .gen .mphase-rows{display:flex;flex-direction:column;gap:8px}
    .gen .mrow{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:var(--shs);transition:border-color .15s}
    .gen .mrow:hover{border-color:#3a3a44}
    .gen .mrow-head{display:flex;align-items:flex-start;gap:14px;width:100%;background:none;border:none;color:var(--ink);text-align:left;cursor:pointer;padding:15px 18px;font-family:inherit}
    .gen .mrow-n{font-size:13px;font-weight:800;color:var(--g1);font-variant-numeric:tabular-nums;flex:0 0 auto;padding-top:2px}
    .gen .mrow-headtext{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
    .gen .mrow-name{font-size:15.5px;font-weight:700;letter-spacing:-.01em;line-height:1.3}
    .gen .mrow-hook{font-size:13px;color:var(--muted);line-height:1.4}
    .gen .mrow-impact{font-size:12px;font-weight:800;color:var(--ok);background:rgba(52,201,138,.12);padding:4px 10px;border-radius:8px;white-space:nowrap}
    .gen .mrow-chev{color:var(--muted);font-size:13px;transition:transform .15s;flex:0 0 auto}
    .gen .mrow.open .mrow-chev{transform:rotate(180deg)}
    .gen .mrow-body{display:none;padding:0 18px 18px 46px}
    .gen .mrow.open .mrow-body{display:block}
    .gen .mrow-line{display:flex;gap:12px;font-size:13.5px;line-height:1.55;color:#cfccd9;margin-bottom:10px}
    .gen .mrow-line>span:last-child{white-space:pre-line}
    .gen .mrow-lbl{flex:0 0 34px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding-top:2px}
    .gen .mrow-lbl.why{color:var(--g1)}.gen .mrow-lbl.how{color:#7ee8b6}
    .gen .mrow-items{list-style:none;margin:10px 0 2px;padding:0;display:flex;flex-direction:column;gap:7px}
    .gen .mrow-items li{position:relative;padding:9px 12px 9px 30px;background:var(--card2);border:1px solid var(--line);border-radius:9px;font-size:13px;line-height:1.4;color:var(--ink)}
    .gen .mrow-items li::before{content:"";position:absolute;left:12px;top:14px;width:6px;height:6px;border-radius:50%;background:var(--g1)}
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
    .gen .mm-or{color:var(--muted);font-weight:700;font-size:13px;align-self:center}
    .gen .mm-custom{display:inline-flex;align-items:center;gap:4px;background:var(--card2);border:1px solid var(--line);border-radius:11px;padding:0 14px;font-weight:800;font-size:15px;color:#cfccd9}
    .gen .mm-custom:focus-within{border-color:var(--g1)}
    .gen .mm-custom input{width:120px;background:none;border:none;color:var(--ink);font:inherit;font-weight:800;padding:11px 0;outline:none}
    .gen .mm-custom input::placeholder{color:#6f6b7e;font-weight:600}
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
    .gen .sc-card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px 18px;text-align:center;box-shadow:var(--shs)}
    .gen .sc-rank{position:absolute;top:12px;left:14px;width:22px;height:22px;border-radius:7px;background:rgba(118,18,250,.14);border:1px solid rgba(118,18,250,.35);color:var(--g1);font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center}
    .gen .sc-donut{width:56px;margin:0 auto 10px}
    .gen .sc-name{font-weight:800;font-size:15px}
    .gen .sc-note{font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.45;min-height:54px}
    .gen .sc-lever{display:inline-block;margin-top:8px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:3px 9px;border-radius:7px}
    .gen .sc-lever.g{color:#c9a6ff;background:rgba(118,18,250,.16)}.gen .sc-lever.o{color:#ffb38a;background:rgba(255,98,33,.14)}
    /* cta */
    .gen .gnext{margin-top:44px;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:34px;box-shadow:var(--sh)}
    .gen .gnext-done{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--ok);background:rgba(52,201,138,.12);border:1px solid rgba(52,201,138,.3);border-radius:999px;padding:7px 14px}
    .gen .gnext-h{font-size:24px;font-weight:800;letter-spacing:-.01em;margin:16px 0 20px}
    .gen .gnext-cards{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    @media(max-width:680px){.gen .gnext-cards{grid-template-columns:1fr}}
    .gen .gnext-card{background:var(--card2);border:1px solid var(--line);border-radius:16px;padding:24px;display:flex;flex-direction:column}
    .gen .gnext-card:first-child{border-color:rgba(118,18,250,.4)}
    .gen .gnext-eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--g1)}
    .gen .gnext-title{font-size:18px;font-weight:800;margin:6px 0 8px;letter-spacing:-.01em}
    .gen .gnext-card p{font-size:13.5px;color:#cfccd9;line-height:1.5;margin:0 0 14px;flex:1}
    .gen .gnext-when{font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:14px}
    .gen .gnext-who{font-size:12.5px;color:var(--muted);line-height:1.45;margin:0 0 16px;flex:none}
    .gen .gnext-who b{color:#cfccd9;font-weight:800}
    .gen .gnext-btn{display:inline-block;text-align:center;background:var(--grad);color:#fff;font-weight:800;padding:13px 22px;border-radius:11px;text-decoration:none;transition:transform .15s}
    .gen .gnext-btn.alt{background:var(--card);border:1px solid var(--line)}
    .gen .gnext-btn:hover{transform:translateY(-2px)}`;
    const el = document.createElement("style");
    el.id = "genie-style"; el.textContent = css;
    document.head.appendChild(el);
  }

  // ── wiring ───────────────────────────────────────────────────────────────
  function wire() {
    // citation stack: Show all expander
    const csBtn = document.getElementById("csMoreBtn");
    if (csBtn) csBtn.addEventListener("click", () => {
      document.querySelectorAll(".gen .cs-more").forEach((tr) => tr.removeAttribute("hidden"));
      csBtn.parentElement.remove();
    });
    // move rows: click head to expand/collapse
    document.querySelectorAll(".gen .mrow-head").forEach((h) =>
      h.addEventListener("click", () => h.parentElement.classList.toggle("open")));
    // money model value selector
    const setPer = (v, fromCustom) => {
      v = Math.max(0, Math.round(v) || 0);
      DATA.money.perCustomer = v;
      document.querySelectorAll("#mmTiers .mm-rev").forEach((r) =>
        r.textContent = usd(v * Number(r.getAttribute("data-c"))));
      document.querySelectorAll(".mm-opt").forEach((o) =>
        o.classList.toggle("on", !fromCustom && Number(o.getAttribute("data-v")) === v));
    };
    const opts = document.getElementById("mmOpts");
    if (opts) opts.addEventListener("click", (e) => {
      const b = e.target.closest(".mm-opt"); if (!b) return;
      const ci = document.getElementById("mmCustom"); if (ci) ci.value = "";
      setPer(Number(b.getAttribute("data-v")), false);
    });
    const customInput = document.getElementById("mmCustom");
    if (customInput) customInput.addEventListener("input", () => {
      if (customInput.value === "") return;
      const v = parseFloat(customInput.value);
      setPer(isFinite(v) ? v : 0, true);
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

  // ── dynamic data: fetch the live per-brand moves ─────────────────────────
  const API = {
    url: "https://factor8-agent-sdk.fly.dev/api/v1/brand-slug/public-scanner/aeo-genie",
    key: "594aa935e360c9bf28f97437c1dddea9",
  };

  // Map the /aeo-genie response onto DATA + MOVES. Money + demand stay as the
  // preview defaults (not measured by the scan).
  function applyGenieResponse(d) {
    const noteByKey = {
      structured_data: "Machine-readable signals that tell AI what you offer.",
      grounding_pages: "Authoritative pages AI can cite as its source.",
      corroboration: "Third-party sources that verify your claims.",
      prominence: "How often you surface in AI answers for your space.",
    };
    const leverSide = { structured_data: "grounding", grounding_pages: "grounding", corroboration: "off-site", prominence: "off-site" };
    if (d.brand) DATA.brand = d.brand;
    if (d.category) DATA.category = d.category;
    if (typeof d.visibility_pct === "number") DATA.score = d.visibility_pct;
    if (Array.isArray(d.levers) && d.levers.length)
      DATA.scores = d.levers.map((lv) => ({ key: lv.key, name: lv.name, lever: leverSide[lv.key] || "grounding", val: lv.score, note: noteByKey[lv.key] || "" }));
    if (Array.isArray(d.citation_stack) && d.citation_stack.length)
      DATA.citationStack = d.citation_stack.map((s) => ({ src: s.src, n: s.n, you: !!s.you, competitor: !!s.competitor, mentioned: (s.mentioned === true ? true : s.mentioned === false ? false : null), kind: s.kind || "", urls: s.urls || [] }));
    if (d.scan_url) DATA.url = d.scan_url;
    if (Array.isArray(d.competitors) && d.competitors.length)
      DATA.competitors = d.competitors.map((c) => [c.name, c.count]);
    if (Array.isArray(d.moves) && d.moves.length)
      MOVES = d.moves.map((m) => ({ side: m.side, name: m.title, hook: m.hook, why: m.why, how: m.how, how_items: m.how_items || [], impact: "" }));
  }

  function loadingHtml() {
    return `<div class="gen"><div class="g-loading">
      <div class="g-spin"></div>
      <div class="g-load-h">The Genie is granting your wishes</div>
      <div class="g-load-sub">Reading your scan and writing your genius moves. About a minute.</div>
    </div></div>`;
  }

  // Returns true if it rendered live data; false to fall back to the preview.
  async function loadDynamic(host) {
    let scan = null;
    try { scan = JSON.parse(localStorage.getItem("aeo_full") || "null"); } catch (_) {}
    const scanUrl = scan ? ((scan.solutions && scan.solutions[0] && scan.solutions[0].url) || scan.url || "") : "";
    // Prefetched result ready? Use it ONLY if it belongs to the CURRENT scan -- a stale
    // result from a previous brand must never win (Kevin's always-Lean-Labs bug).
    try {
      const pre = JSON.parse(localStorage.getItem("aeo_genie_result") || "null");
      if (pre && pre.moves && pre.moves.length && (!pre.__scan_url || pre.__scan_url === scanUrl)) {
        applyGenieResponse(pre); return true;
      }
    } catch (_) {}
    if (!scan) return false; // no Baseline scan in this session -> preview fallback
    injectStyles();
    host.innerHTML = loadingHtml();
    try {
      const r = await fetch(API.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API.key },
        body: JSON.stringify({ scan_result: scan }),
      });
      if (!r.ok) throw new Error("genie " + r.status);
      const d = await r.json();
      applyGenieResponse(d);
      return true;
    } catch (e) {
      try { console.error("genie load failed, using preview:", e); } catch (_) {}
      return false;
    }
  }

  async function boot() {
    injectStyles();
    const host = document.getElementById("genie");
    if (!host) return;
    const live = await loadDynamic(host); // overwrites DATA/MOVES with live data when available
    const sampleBanner = live ? "" : `<div class="g-sample">
      <b>You're viewing a sample report</b> (Lean Labs). To generate yours, run a free
      Baseline scan first, then hit "Run the AEO Genie" at the bottom of your report.
      <a href="scan.html">Run my scan &rarr;</a></div>`;
    host.innerHTML = `<div class="gen">` + sampleBanner +
      sidebarHtml() + heroHtml() + movesHtml() + stackHtml() + moneyHtml() + scoresHtml() + ctaHtml() +
      `</div>`;
    wire();
    window.scrollTo({ top: 0 });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
