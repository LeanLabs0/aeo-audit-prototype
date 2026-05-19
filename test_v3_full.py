"""E2E for the merged emailed-deliverable report.
Asserts every Jonathan-derived section is wired + every kept section renders.
"""
from playwright.sync_api import sync_playwright


def main():
    console = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("console", lambda m: console.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: console.append(f"[PAGEERROR] {e}"))

        page.goto("http://127.0.0.1:8765/report-full.html", wait_until="networkidle")
        page.wait_for_timeout(1500)

        # Cover
        assert page.locator(".full-cover-title").inner_text() == "lean-labs.com"
        assert page.locator(".full-cover-score").inner_text() == "58"
        print("cover OK")

        # 3-KPI strip (ground truth — Competitor Gap + Position Zero killed)
        kpi_count = page.locator(".full-kpi-card").count()
        assert kpi_count == 3, f"expected 3 KPIs after ungrounded strip, got {kpi_count}"
        kpi_labels = [el.inner_text() for el in page.locator(".full-kpi-label").all()]
        assert "UNIFIED AEO SCORE" in kpi_labels
        assert "SCHEMA VALIDITY" in kpi_labels
        assert "AI CITATIONS" in kpi_labels
        print(f"3-KPI strip OK: {kpi_labels}")

        # 9 real pillar cards (not 6 dimensions)
        pillar_count = page.locator("#pillarGrid .full-dim-card").count()
        assert pillar_count == 9, f"expected 9 pillar cards, got {pillar_count}"
        warn_count = page.locator("#pillarGrid .full-dim-card.warn").count()
        assert warn_count >= 3, f"expected >=3 warn pillars, got {warn_count}"
        print(f"9-pillar breakdown OK: {warn_count} warn")

        # Highest-impact gaps (kept)
        gap_count = page.locator(".full-gap").count()
        assert gap_count == 7, f"expected 7 gaps, got {gap_count}"
        print(f"highest-impact gaps OK: {gap_count}")

        # Matrix 1 + Matrix 2 (kept)
        m1 = page.locator(".full-matrix").nth(0).locator("tbody tr").count()
        m2 = page.locator(".full-matrix").nth(1).locator("tbody tr").count()
        assert m1 == 10 and m2 == 10, f"matrices: m1={m1}, m2={m2}"
        print(f"matrices OK: m1={m1}, m2={m2}")

        # Prompt tracking table (real data)
        pt_rows = page.locator("#promptTable tbody tr").count()
        assert pt_rows == 5, f"expected 5 prompt rows, got {pt_rows}"
        cited = page.locator(".pt-cited").count()
        omitted = page.locator(".pt-omitted").count()
        assert cited >= 4, f"expected >=4 cited, got {cited}"
        assert omitted >= 4, f"expected >=4 omitted, got {omitted}"
        print(f"prompt tracking OK: cited={cited}, omitted={omitted}")

        # Citation source breakdown — KILLED (ground-truth strip)
        assert page.locator(".full-source-row").count() == 0, "source breakdown should be removed"
        print("citation source breakdown removed OK")

        # Snippets (kept)
        snippet_count = page.locator(".full-snippet").count()
        assert snippet_count == 5, f"expected 5 snippets, got {snippet_count}"
        print(f"snippets OK: {snippet_count}")

        # Recommendations — tags dropped
        rec_count = page.locator(".full-rec-card").count()
        assert rec_count == 5, f"expected 5 recs, got {rec_count}"
        assert page.locator(".tag-effort-low").count() == 0, "effort tags should be gone"
        assert page.locator(".tag-impact-high").count() == 0, "impact tags should be gone"
        print(f"recommendations OK: {rec_count}, no effort/impact tags")

        # Kevin close (kept) — no pricing
        assert page.locator(".full-kevin-card").count() == 1
        body_text = page.inner_text("body").lower()
        for forbidden in ["$5k", "$50k", "annual roi", "pricing tier"]:
            assert forbidden not in body_text, f"forbidden token leaked into lead magnet: {forbidden}"
        print("kevin close OK + no pricing tokens leaked")

        # Old 9-pillar pill table should be GONE
        assert page.locator(".full-pillar-table").count() == 0, "old 9-pillar table still present"
        print("9-pillar pill table removed OK")

        # Full-page screenshot
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_full_report_v3.png", full_page=True)
        browser.close()

    print("\nPASS — all sections wired, no pricing leaked")
    errs = [m for m in console if "PAGEERROR" in m or "[error]" in m]
    if errs:
        print("Console errors:")
        for m in errs:
            print(f"  {m}")
    else:
        print("Console errors: none")


if __name__ == "__main__":
    main()
