# AEO Scanner: Content + Citation Pillars (frontend-only) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two new pillars to the scanner for a more robust score, computed entirely in the frontend, with ZERO backend changes and NO new UI components: (A) "Answer-ready content" (GEO content levers) and (B) "AI source mix" (engine-response analytics).

**Architecture (revised 2026-06-02):** Split by where the data lives.
- **Pillar A (Answer-ready content)** is computed in the **BACKEND** (`factor8-aeo`), which already scrapes the solution HTML during the scan. It is returned as a new `content_geo` check category in the scan response. The frontend renders it automatically — `renderFull`/`renderFullReport` already render every check category except `ai_citations`, through the existing hero donuts + scorecard. No browser re-fetch, no CORS proxy. (This replaces the earlier browser-proxy approach and is the reason overall confidence rises from ~75% to ~90%.)
- **Pillar B (AI source mix)** + the **three Baseline sections** (Citation Gap, Query Map, Competitor Benchmark) are produced in **`scan.js`** from the scan response (`evidence.runs`, `evidence.prompts`, `sol.competitor_stats`) — verified present 2026-06-02. No fetch. Pillar B is a `CheckCategory` spliced into `checks[]` so it renders as a hero donut + scorecard group; the three sections are small report blocks.

**Constraints (from Ralph):**
- Backend MAY be extended, but surgically — do NOT change the working pillars/citation/prompt logic. Pillar A is additive: one pure function + one new check category + a few wiring lines.
- Stack the new pillars into the Pillars section (hero donuts + scorecard). No new pillar UI.
- No major UI changes.

**Tech Stack:** Vanilla JS in `scan.js`, `DOMParser` for A, the existing pillar render path. Local test = `node --check` + `python -m http.server` + `?state=mock` + Playwright DOM assertions. Sources for `CHECK_GUIDE` entries were web-verified 2026-06-02 (Princeton GEO paper + industry studies).

**Pillar/CheckCategory shape the render expects** (match exactly):
```js
{ key: "content_geo", name: "Answer-ready content", score: 0-100,
  subchecks: [ { key, name, status: "pass"|"fail", goal, result?, issue?, how_to_implement?, resources? } ] }
```
`heroPillarsHtml`/`scorecardHtml` use `CAT_LABELS[c.key] || [c.name||c.key]` for the display name, `tone(c.score)` for the donut color, and `pass/total` from subchecks. `subCard` pulls how-to + resources from `CHECK_GUIDE[sub.key]` for failed checks.

---

## Task 1: Bucket B pillar — "AI source mix" (frontend, from `evidence.runs`)

No fetch. Analyze the engine answers + cited sources already in the scan response.

**Files:** Modify `scan.js` — add `AUTHORITY_DOMAINS`, `_hostOf`, `buildCitationFootprint`, helpers; add `CAT_LABELS` entry + `CHECK_GUIDE` entries; splice in `renderFull`/`renderFullReport` (Task 3).

**Step 1: Add the builder + helpers** (near the other render helpers)

```javascript
  const AUTHORITY_DOMAINS = ["wikipedia.org","reddit.com","linkedin.com","youtube.com",
    "g2.com","capterra.com","trustpilot.com","trustradius.com","clutch.co","gartner.com",
    "forbes.com","github.com","medium.com","quora.com","producthunt.com","techcrunch.com"];
  const POS_WORDS = ["best","leading","top","trusted","recommended","popular","strong","excellent","reliable","proven","preferred","standout","robust"];
  const NEG_WORDS = ["lacks","limited","expensive","weak","outdated","avoid","worse","drawback","downside","poor","clunky","confusing"];

  function _hostOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch (_) { return ""; }
  }
  function _sub(key, name, pass, goal, ok, bad) {
    return pass
      ? { key, name, status: "pass", goal, result: ok }
      : { key, name, status: "fail", goal, issue: bad };
  }

  // CheckCategory from the engine responses we already collect. Pure, no I/O.
  function buildCitationFootprint(ev, brand, compStats) {
    const runs = (ev && ev.runs) || [];
    if (!runs.length) return null;
    const brandL = (brand || "").toLowerCase();
    const compNames = (compStats || []).map((c) => (c.name || "").toLowerCase()).filter(Boolean);

    // 1. cited domains across all runs
    const domains = {};
    let authorityHits = 0, ownedHits = 0, thirdPartyHits = 0;
    const ownedHost = _hostOf((ev.prompts && ev.prompts[0] && "") || "");
    runs.forEach((r) => {
      (r.sources || []).forEach((u) => {
        const h = _hostOf(u);
        if (!h) return;
        domains[h] = (domains[h] || 0) + 1;
        if (AUTHORITY_DOMAINS.some((d) => h === d || h.endsWith("." + d))) authorityHits++;
      });
    });
    const distinctAuthority = Object.keys(domains).filter((h) =>
      AUTHORITY_DOMAINS.some((d) => h === d || h.endsWith("." + d)));

    // 2. share of voice: brand mentions / (brand + competitor mentions)
    let brandM = 0, compM = 0;
    runs.forEach((r) => {
      const t = (r.raw_response || "").toLowerCase();
      if (brandL && t.includes(brandL)) brandM++;
      compNames.forEach((c) => { if (t.includes(c)) compM++; });
    });
    const sov = (brandM + compM) ? Math.round((brandM / (brandM + compM)) * 100) : 0;

    // 3. sentiment around brand mentions (lexicon, no API)
    let pos = 0, neg = 0;
    runs.forEach((r) => {
      const t = (r.raw_response || "").toLowerCase();
      if (!brandL || !t.includes(brandL)) return;
      const i = t.indexOf(brandL);
      const win = t.slice(Math.max(0, i - 160), i + 160);
      if (POS_WORDS.some((w) => win.includes(w))) pos++;
      if (NEG_WORDS.some((w) => win.includes(w))) neg++;
    });
    const sentiment = neg > pos ? "negative" : (pos > 0 ? "positive" : "neutral");

    const subs = [];
    subs.push(_sub("authority_sources", "AI pulls from authority sources", distinctAuthority.length >= 2,
      "Be present where AI looks: high-trust domains (Wikipedia, Reddit, G2, LinkedIn).",
      `Answers in your space cite ${distinctAuthority.length} authority domains (${distinctAuthority.slice(0,4).join(", ")}).`,
      `AI answers in your space cite few high-trust sources (${distinctAuthority.length}). Earning placements there lifts citations.`));
    subs.push(_sub("share_of_voice", "Share of voice vs competitors", sov >= 25,
      "Win a meaningful slice of the brand mentions in AI answers.",
      `You hold ${sov}% share of voice across the answers (mentioned ${brandM}, competitors ${compM}).`,
      `Low share of voice (${sov}%): competitors are named ${compM} times to your ${brandM}.`));
    subs.push(_sub("sentiment", "Positive brand sentiment", sentiment !== "negative",
      "Be described positively when AI does mention you.",
      `Brand sentiment in answers reads ${sentiment}.`,
      `Brand sentiment in answers reads negative; the framing around your name is unfavorable.`));
    subs.push(_sub("source_mix", "Third-party sources vouch for you", authorityHits > 0,
      "Get cited by third-party/editorial sources, not just your own site.",
      `Answers cite ${authorityHits} third-party/authority source references in your space.`,
      `Answers lean on owned/thin sources; little third-party validation is being cited.`));

    const pass = subs.filter((s) => s.status === "pass").length;
    return { key: "citation_footprint", name: "AI source mix",
      score: Math.round((pass / subs.length) * 100), subchecks: subs };
  }
```

**Step 2:** Add the `CAT_LABELS` entry (in the `CAT_LABELS` object):
```javascript
    citation_footprint: ["Where AI gets answers", "AI source mix"],
```

**Step 3:** Add `CHECK_GUIDE` entries for the failed checks (append to `CHECK_GUIDE`):
```javascript
    authority_sources: { how_to: "Earn placements on the domains AI answer engines cite most for B2B: get listed/reviewed on G2, Capterra and TrustRadius; build an authoritative Wikipedia/Wikidata entity; participate in relevant Reddit and LinkedIn discussions; and publish to YouTube. AI engines disproportionately cite Reddit, YouTube, LinkedIn and review platforms, so a presence there is a direct path into generated answers in your category.", resources: [{label:"Search Engine Land - AI search engines cite Reddit, YouTube and LinkedIn most",url:"https://searchengineland.com/ai-search-engines-cite-reddit-youtube-and-linkedin-most-study-473138"},{label:"Peec AI - Top domains cited by AI search (30M sources)",url:"https://peec.ai/blog/top-domains-cited-by-ai-search-analysis-based-on-30m-sources"}] },
    share_of_voice: { how_to: "Share of voice is your brand mentions divided by all brand mentions (you + competitors) across the AI answers. Lift it by winning the buyer-intent prompts where competitors currently dominate: publish comparison and 'best X for Y' assets, strengthen the on-page answer-ready content for those queries, and earn third-party citations on the sources those answers pull from. Track it per prompt to see exactly which queries to target.", resources: [{label:"HubSpot AEO Grader - Share of Voice",url:"https://www.hubspot.com/aeo-grader/share-of-voice"}] },
    sentiment: { how_to: "When AI describes your brand unfavorably it usually echoes negative third-party content (reviews, forum threads, comparison posts). Audit what the engines cite around your name, address the substantive complaints, refresh outdated third-party pages where possible, and publish strong first-party proof (case studies, outcomes, named customers) so engines have positive, quotable material to synthesize.", resources: [{label:"HubSpot AEO Grader - Brand Sentiment Analysis",url:"https://www.hubspot.com/aeo-grader/brand-sentiment-analysis"}] },
    source_mix: { how_to: "When answers cite only your own site (or thin sources), engines have little independent validation of your claims. Build third-party citations: directory/review profiles, partner and integration pages, guest articles, podcast/press mentions, and Wikipedia. A healthy mix of owned + independent sources is what makes an engine confident enough to recommend you.", resources: [{label:"Discovered Labs - AEO performance metrics & citations",url:"https://discoveredlabs.com/blog/aeo-performance-metrics-what-to-measure-and-how-to-track-ai-citations"}] },
```

**Step 4: Verify** (after Task 3 splice) — `node --check scan.js`; mock render; assert a `citation_footprint` donut appears in the hero and a matching scorecard group.

**Step 5: Commit** — `git commit -m "feat(scanner): AI source mix pillar from engine responses (frontend-only)"`

---

## Task 2: Bucket A pillar — "Answer-ready content" (BACKEND, surgical)

Compute the GEO content levers (statistics, citations/quotes, lists/tables, heading hierarchy, readability, definitions/comparison) in the backend, which ALREADY scrapes the solution HTML during the scan. Return them as a `content_geo` check category; the frontend renders it automatically (it renders every check except `ai_citations`). No browser fetch, no proxy. This is additive: it does not change any existing pillar, citation, or prompt logic.

**Files:**
- Create: `factor8-aeo/src/factor8/aeo_audit/content_signals.py` (pure function).
- Create: `factor8-aeo/tests/aeo_audit/test_content_signals.py`.
- Modify: `factor8-aeo/src/factor8/aeo_audit/checks_builder.py` (`_build_content_geo` + `build_checks` arg).
- Modify: `factor8-aeo/src/factor8/aeo_audit/multi_solution_citation.py` (compute in `_prepare_one`, thread to `_cite_one`, pass to `build_checks`).
- Frontend `scan.js`: ONLY `CAT_LABELS` + `CHECK_GUIDE` (Steps 3-4 below). No fetch/parse code.

**Step 1: Pure signal function** — `content_signals.py`

```python
"""GEO content signals from a scraped page. Pure, no I/O. Uses beautifulsoup4 (already a dep)."""
from __future__ import annotations
import re
from urllib.parse import urlparse
from bs4 import BeautifulSoup

_STAT = re.compile(r"\d+(?:\.\d+)?%|\$\s?\d|\b\d+(?:\.\d+)?\s?x\b|\b(?:19|20)\d{2}\b", re.I)
_ATTR = re.compile(r"according to|\bsaid\b|reports?\b", re.I)
_DEF = re.compile(r"\b[A-Z][\w-]+ (?:is|are|means|refers to)\b")
_CMP = re.compile(r"\b(?:vs|versus|alternative|compare|comparison)\b", re.I)


def _flesch(text: str) -> int:
    words = re.findall(r"[A-Za-z]+", text)
    sentences = max(1, len(re.findall(r"[.!?]+", text)))
    syll = sum(max(1, len(re.findall(r"[aeiouy]+", re.sub(r"e$", "", w.lower())))) for w in words)
    W = max(1, len(words))
    return round(206.835 - 1.015 * (W / sentences) - 84.6 * (syll / W))


def compute_content_signals(html: str, url: str = "") -> dict:
    if not html:
        return {}
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        t.decompose()
    text = " ".join((soup.get_text(" ") or "").split())
    words = max(1, len(text.split()))
    per500 = words / 500
    try:
        host = (urlparse(url).hostname or "").replace("www.", "").lower()
    except Exception:
        host = ""
    outbound = sum(
        1 for a in soup.find_all("a", href=True)
        if a["href"].startswith("http") and host and host not in a["href"]
    )
    heads = [int(h.name[1]) for h in soup.find_all(["h1", "h2", "h3", "h4"])]
    skips = sum(1 for i in range(1, len(heads)) if heads[i] - heads[i - 1] > 1)
    title = soup.title.get_text() if soup.title else ""
    h2h3 = " ".join(h.get_text() for h in soup.find_all(["h2", "h3"]))
    stats = len(_STAT.findall(text))
    return {
        "words": words, "stats": stats, "stats_per500": round(stats / per500, 2),
        "quotes": len(soup.find_all(["blockquote", "q"])) + len(_ATTR.findall(text)),
        "outbound": outbound, "lists": len(soup.find_all(["ul", "ol", "table", "dl"])),
        "h1s": len(soup.find_all("h1")), "heading_skips": skips, "flesch": _flesch(text),
        "comparison": bool(_CMP.search((url or "") + " " + title + " " + h2h3)),
        "definition": bool(soup.find("dl")) or bool(_DEF.search(text)),
    }
```
Test (`test_content_signals.py`): feed a small HTML snippet with one `<h1>`, a `<ul>`, a `5%` stat and a `<blockquote>`; assert `stats >= 1`, `lists >= 1`, `h1s == 1`, `quotes >= 1`.

**Step 2: Check category + wiring**

`checks_builder.py` — add the builder (keys EXACTLY `stats_density, citations_quotes, lists_tables, heading_hierarchy, readability, def_comparison` so they match the frontend `CHECK_GUIDE`):
```python
def _build_content_geo(sig: dict) -> CheckCategory:
    s = sig
    def mk(key, name, ok, goal, result, issue, how_to):
        return (_passed(key, name, goal=goal, result=result) if ok
                else _failed(key, name, goal=goal, issue=issue, how_to=how_to))
    subs = [
        mk("stats_density", "Quotable statistics", s.get("stats_per500", 0) >= 2,
           "Carry concrete numbers (%, $, units, years) AI can quote as evidence.",
           f"{s.get('stats',0)} statistics (~{s.get('stats_per500',0)} per 500 words).",
           f"Few statistics ({s.get('stats',0)}); the strongest GEO content lever.",
           "Add quotable stats (%, $, multipliers, year-stamped data)."),
        mk("citations_quotes", "Cites sources + quotes", (s.get("quotes",0) + s.get("outbound",0)) >= 2,
           "Attribute claims and quote experts; link out to credible domains.",
           f"{s.get('quotes',0)} quote/attribution cues and {s.get('outbound',0)} outbound links.",
           "Page makes claims with little attribution or sourcing.",
           "Cite sources and add an attributed expert quote."),
        mk("lists_tables", "Lists & tables", s.get("lists",0) >= 2,
           "Break content into lists/tables engines lift verbatim.",
           f"{s.get('lists',0)} lists/tables present.",
           "Content is mostly prose; few lists/tables.",
           "Convert key sections into bulleted lists and comparison tables."),
        mk("heading_hierarchy", "Clean heading outline", s.get("h1s",0) == 1 and s.get("heading_skips",0) == 0,
           "Exactly one H1 and no skipped levels so engines chunk sections.",
           "Heading outline is clean (1 H1, no skipped levels).",
           f"Heading outline is off ({s.get('h1s',0)} H1s, {s.get('heading_skips',0)} skipped levels).",
           "Use one H1 and a logical H2>H3 outline with no skipped levels."),
        mk("readability", "Readable, quotable sentences", 45 <= s.get("flesch",0) <= 75,
           "Keep clear, self-contained sentences (Flesch ~50-70).",
           f"Readability in band (Flesch {s.get('flesch',0)}).",
           f"Readability out of band (Flesch {s.get('flesch',0)}).",
           "Tune toward clear, quotable sentences (Flesch ~50-70)."),
        mk("def_comparison", "Definitions & comparisons", s.get("definition") or s.get("comparison"),
           "Define key terms and offer comparison/'vs' content.",
           "Page includes definitional/comparison content.",
           "No definitional or comparison content found.",
           "Add a crisp definition near the top and a comparison/'vs' asset."),
    ]
    return _category("content_geo", "Answer-ready content", subs)
```
Then make `build_checks` accept the signals and append the category:
```python
def build_checks(pillars, content_signals: dict | None = None):
    ...
    if content_signals:
        out.append(_build_content_geo(content_signals))
    return out
```

`multi_solution_citation.py` (3 small edits):
- import: `from factor8.aeo_audit.content_signals import compute_content_signals`
- in `_prepare_one`, after `html = await _fetch_solution_html(solution["url"])`: `content_sig = compute_content_signals(html, solution["url"])`; add `"content_signals": content_sig` to the returned (non-cached) prepared bundle.
- in `_cite_one`: `content_sig = prepared.get("content_signals")`; change `build_checks(all_pillars)` to `build_checks(all_pillars, content_signals=content_sig)`. The `content_geo` category then flows into `checks_dump`, the cache, and the response automatically.

**Backend test + deploy:** `pytest tests/aeo_audit/test_content_signals.py`; run a local scan and assert `content_geo` is in `solutions[0].checks`; then commit on `feat/citation-multi-solution`, cherry-pick onto `main`, push (Fly deploy) - same flow as prior backend changes.

The ONLY frontend change for Pillar A is the label + guide:

**Step 3:** `CAT_LABELS` entry:
```javascript
    content_geo: ["Answer-ready content", "Content extractability"],
```

**Step 4:** `CHECK_GUIDE` entries (append):
```javascript
    stats_density: { how_to: "Add concrete, quotable statistics to the page body: percentages, dollar figures, multipliers ('3x faster'), and year-stamped data points, ideally tied to your own outcomes or cited research. The Princeton GEO study found adding statistics was the single strongest content lever, raising a source's visibility in generated answers by ~30-40%, because LLMs preferentially quote concrete numbers as the evidence line of an answer.", resources: [{label:"Princeton - GEO: Generative Engine Optimization (paper)",url:"https://arxiv.org/abs/2311.09735"},{label:"GEO paper, plain English",url:"https://derivatex.agency/blog/princeton-geo-paper-plain-english/"}] },
    citations_quotes: { how_to: "Attribute claims to credible sources and include at least one expert quote with a name/title; link out to primary sources (research, .gov/.edu/.org, vendor docs). In the GEO study, adding citations and quotations each lifted visibility ~30-40% (up to ~100%+ for lower-ranked pages) because engines treat well-sourced, quotable content as synthesis-ready.", resources: [{label:"Princeton GEO paper",url:"https://arxiv.org/abs/2311.09735"},{label:"GEO factors explained",url:"https://www.stackmatix.com/blog/generative-engine-optimization-paper"}] },
    lists_tables: { how_to: "Convert wall-of-text sections into scannable structure: ordered lists for steps/processes, unordered lists for feature/benefit sets, and HTML tables for comparisons and specs. AI engines extract from specific sections and lift lists and tables far more reliably than prose, and pages cited in AI Overviews score materially better on structural formatting.", resources: [{label:"How to structure content for AEO/GEO",url:"https://pathfinderseo.com/blog/how-to-structure-content-for-aeo-and-geo/"}] },
    heading_hierarchy: { how_to: "Use exactly one H1 (the page title), then a logical H2 > H3 outline with no skipped levels and headings used for structure (not styling). A clean outline lets engines chunk the page into sections and pull the right passage; pages cited in AI Overviews score ~20% better on heading hierarchy and navigation.", resources: [{label:"Structure content for Google AI Overviews",url:"https://www.serpwizard.com/how-to-structure-content-for-google-ai-overviews-feature/"}] },
    readability: { how_to: "Tune body copy toward clear, self-contained sentences: aim Flesch Reading Ease ~50-70 (grade ~8-12) and average sentence length ~15-25 words. The GEO study's 'fluency optimization' delivered a consistent ~15-30% visibility lift, while naive over-simplification did not, so target the band rather than 'simpler is better.' Short, declarative sentences are the most quotable unit for an answer.", resources: [{label:"Flesch Reading Ease / Flesch-Kincaid explained",url:"https://readable.com/readability/flesch-reading-ease-flesch-kincaid-grade-level/"},{label:"Princeton GEO paper",url:"https://arxiv.org/abs/2311.09735"}] },
    def_comparison: { how_to: "Add a crisp definition of your core term/category near the top ('X is a ...') and publish comparison assets ('X vs Y', 'best X for [persona]') with a verdict line and a feature table. These map directly to bottom-funnel buyer queries; a brand with no comparison/definition content is structurally absent from 'what is X' and 'X vs Y' answers regardless of mention rate.", resources: [{label:"Comparison / vs-page patterns for AEO",url:"https://citevera.com/blog/comparison-pages-aeo-vs-page-patterns"},{label:"HubSpot - AEO page structure",url:"https://blog.hubspot.com/marketing/aeo-page-structure"}] },
```

**Step 5: Commit** — `git commit -m "feat(aeo-scan): content_geo pillar (GEO content levers, backend) + frontend label/guide"`

---

## Task 3: Splice Pillar B into the render (Pillar A renders automatically from the backend)

Pillar A (`content_geo`) arrives in `sol.checks` from the backend (Task 2), so it already flows through the hero donuts + scorecard with NO frontend splice. Only Pillar B (`citation_footprint`, computed in the browser from `evidence.runs`) needs splicing. No page fetch, no proxy, no `_pageHtml`.

**Files:** Modify `scan.js` — `renderFull`, `renderFullReport` (+ the `CAT_LABELS`/`CHECK_GUIDE` entries from Tasks 1-2).

**Step 1: Splice B in `renderFull`** — right after `const checks = (sol.checks || []).filter((c) => c.key !== "ai_citations");` add:
```javascript
    const cf = buildCitationFootprint(ev, brand, compStats);
    const checks2 = cf ? [...checks, cf] : checks;
```
Then use `checks2` in the render (the `heroHtml(..., checks2)` call and the gated `scorecardHtml(checks2, true, true)`). `content_geo` is already inside `checks` from the backend, so BOTH new pillars render.

**Step 2: Same in `renderFullReport`** — add the same `cf`/`checks2` and use `checks2` in `heroHtml(..., checks2)` + `scorecardHtml(checks2, false, false)`.

**Step 3: Labels + guides** — confirm `CAT_LABELS` has both new keys (`content_geo`, `citation_footprint`) and `CHECK_GUIDE` has the 6 content + 4 citation entries (Tasks 1 + 2). These are the only data the frontend adds for Pillar A.

**Step 4: Verify** — `node --check scan.js`; serve; `scan.html?state=mock`: the mock predates the backend change so it won't contain `content_geo` (only the `citation_footprint` donut shows there - fine). Then run a REAL scan against `https://www.lean-labs.com/growth-driven-design` AFTER the backend deploy and confirm BOTH new donuts appear (5 total), colored, and the full report shows their how-to + resources. No console errors, no em dashes.

**Step 5: Commit + cache-bust + deploy (frontend)**
```bash
sed -i 's/scan\.js?v=20260602[a-z]/scan.js?v=20260603a/' scan.html full-report.html
git add scan.js scan.html full-report.html docs/plans/2026-06-02-content-and-citation-pillars.md
git commit -m "feat(scanner): AI source mix pillar + content_geo label/guides + Baseline sections"
git push origin feat/aeo-scanner
```
Poll Pages for the new `?v=`; hard-refresh; live-verify.

**Deploy order:** ship the BACKEND (Task 2, Fly) FIRST, then the frontend (Pages). Until the backend ships, `content_geo` simply is not in `checks` and Pillar A is absent (graceful) - nothing breaks.

---

## Open questions / risks for Ralph

1. **Sentiment (Pillar B) is lexicon-based**, not an LLM call - free + frontend, but approximate. Fine for a binary "not negative" check; do not read it as precise.
2. **Pillar B source-URL checks are thin (verified).** `runs[].sources` (citation URLs) are present on only ~8 of 24 runs (mainly ChatGPT's `:online`); Claude/Gemini often omit them. So `authority_sources` + `source_mix` have partial data - lean them lighter or merge into one "third-party validation" check. Share-of-voice + sentiment run off `raw_response` (all 24 runs) and are solid.
3. **Competitor-name matching** in answers is substring-based; reuse a small variant helper (like the brand `name_variants`) so "SmartBug" matches "SmartBug Media".
4. **Pillar A thresholds** (stats >= 2 per 500, Flesch 45-75, lists >= 2, etc.) are first-pass cutoffs; expect one tuning round against real solution pages.
5. **Five donuts** in the hero now (3 existing + `content_geo` + `citation_footprint`). The row flex-wraps; no layout change.

---

## Appendix A: Boss's 6-feature "Get Your AEO Baseline" page

The boss's Step-2 mockup promises 6 features. Mapping to capability — all 6 are deliverable, all from data the scan already returns (no extra AI calls):

| Feature | Covered by | New work |
|---|---|---|
| AEO Visibility Score | Hero gauge + per-engine cards | none (live) |
| Share of Answer | Pillar B `share_of_voice` (Task 1) | none beyond Task 1 |
| Content Authority Audit | Scorecard pillars + Pillar A (Task 2) | none beyond Task 2 |
| Citation Gap Analysis | Task A1 below | small |
| High-Intent Query Map | Task A2 below | small |
| Competitor Benchmark | Task A3 below | small |

These three are small report SECTIONS (tables/lists), not pillar donuts. They reuse `ev.runs`, `ev.prompts`, and `sol.competitor_stats` — no new fetch, no new scan cost. Render them in the FULL report (and optionally a teased line in the preview). Each computes from the same `data` already passed to `renderFullReport`.

### Task A1: Citation Gap Analysis (full report section)

For each prompt, find where YOU are not cited on any engine but a competitor name appears in that prompt's answers.

```javascript
  function buildCitationGaps(ev, brand, compStats) {
    const prompts = (ev && ev.prompts) || [], runs = (ev && ev.runs) || [];
    const names = (compStats || []).map((c) => c.name).filter(Boolean);
    const byPrompt = {};
    runs.forEach((r) => { (byPrompt[r.prompt_id] = byPrompt[r.prompt_id] || []).push(r); });
    const gaps = [];
    prompts.forEach((p) => {
      const rs = byPrompt[p.id] || [];
      const youCited = rs.some((r) => r.mentioned);
      if (youCited) return;
      const text = rs.map((r) => (r.raw_response || "").toLowerCase()).join(" ");
      const winners = names.filter((n) => text.includes(n.toLowerCase()));
      if (winners.length) gaps.push({ q: p.prompt, winners: winners.slice(0, 3) });
    });
    return gaps; // [] -> section omitted
  }
```
Render: `<h2>Citation gaps</h2>` + a table of `question | who AI recommended instead`. Heading copy: "Questions where rivals get cited and you do not."

### Task A2: High-Intent Query Map (full report section)

Rank the generated buyer prompts by opportunity: not-cited first, then by intent weight (Comparative/Evaluative are bottom-funnel = highest intent).

```javascript
  const INTENT_WEIGHT = { Comparative: 3, Evaluative: 2, Question: 1 };
  function buildQueryMap(ev) {
    const prompts = (ev && ev.prompts) || [], runs = (ev && ev.runs) || [];
    const cited = {};
    runs.forEach((r) => { if (r.mentioned) cited[r.prompt_id] = true; });
    return prompts.map((p) => ({
      q: p.prompt, intent: p.intent || "Question", won: !!cited[p.id],
      w: (cited[p.id] ? 0 : 10) + (INTENT_WEIGHT[p.intent] || 1),
    })).sort((a, b) => b.w - a.w);
  }
```
Render: `<h2>The buyer questions to win first</h2>` + a list with an intent tag and a won/lost marker. Top of the list = highest-intent questions you are currently losing.

### Task A3: Competitor Benchmark (full report section)

Head-to-head mention ranking: you vs the top competitors, from counts we already have.

```javascript
  function buildBenchmark(citedCells, totalCells, brand, compStats) {
    const you = { name: brand, count: citedCells, you: true };
    const rivals = (compStats || []).slice(0, 3).map((c) => ({ name: c.name, count: c.count }));
    return [you, ...rivals].sort((a, b) => b.count - a.count);
  }
```
Render: `<h2>Head-to-head</h2>` + a ranked bar/table of `brand | times AI recommended it` with YOUR row highlighted, out of `totalCells` answers. Copy: "How you rank against your top 3 competitors in AI answers."

### Wiring (all three)
In `renderFullReport`, after the scorecard, insert the three sections (each returns "" when empty so they self-hide). No backend, no new scan. Use the existing `.sec2` / `.matrix` styles so there is no new CSS to speak of.

### Deferred (costs more)
"Competitor Benchmark — deep": a full AEO audit of each rival (their schema/visibility) needs a scan per competitor (3x cost + latency). Ships later as an opt-in; the mention-ranking above covers the mockup's promise for now.
