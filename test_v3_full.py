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

        # 5-KPI strip
        kpi_count = page.locator(".full-kpi-card").count()
        assert kpi_count == 5, f"expected 5 KPIs, got {kpi_count}"
        kpi_labels = [el.inner_text() for el in page.locator(".full-kpi-label").all()]
        assert "UNIFIED AEO SCORE" in kpi_labels
        assert "SCHEMA VALIDITY" in kpi_labels
        # Competitor Gap should be negative-styled
        assert page.locator(".full-kpi-card.negative").count() == 1
        print(f"5-KPI strip OK: {kpi_labels}")

        # 6 dimension cards
        dim_count = page.locator(".full-dim-card").count()
        assert dim_count == 6, f"expected 6 dimension cards, got {dim_count}"
        warn_count = page.locator(".full-dim-card.warn").count()
        assert warn_count >= 3, f"expected >=3 warning dimensions, got {warn_count}"
        assert page.locator(".full-dim-est").count() >= 1, "expected at least 1 estimated marker"
        print(f"6 dimension cards OK: {warn_count} warn, estimated marker present")

        # Highest-impact gaps (kept)
        gap_count = page.locator(".full-gap").count()
        assert gap_count == 7, f"expected 7 gaps, got {gap_count}"
        print(f"highest-impact gaps OK: {gap_count}")

        # Matrix 1 + Matrix 2 (kept)
        m1 = page.locator(".full-matrix").nth(0).locator("tbody tr").count()
        m2 = page.locator(".full-matrix").nth(1).locator("tbody tr").count()
        assert m1 == 10 and m2 == 10, f"matrices: m1={m1}, m2={m2}"
        print(f"matrices OK: m1={m1}, m2={m2}")

        # Prompt tracking table
        pt_rows = page.locator("#promptTable tbody tr").count()
        assert pt_rows == 5, f"expected 5 prompt rows, got {pt_rows}"
        cited_accurate = page.locator(".pt-cited").count() + page.locator(".pt-accurate").count()
        omitted = page.locator(".pt-omitted").count()
        hallucinated = page.locator(".pt-hallucinated").count()
        assert cited_accurate >= 4, f"expected >=4 cited/accurate, got {cited_accurate}"
        assert omitted >= 3, f"expected >=3 omitted, got {omitted}"
        assert hallucinated >= 1, f"expected >=1 hallucinated, got {hallucinated}"
        print(f"prompt tracking OK: cited/accurate={cited_accurate}, omitted={omitted}, hallucinated={hallucinated}")

        # Citation source breakdown — 4 rows + estimated pill
        src_rows = page.locator(".full-source-row").count()
        assert src_rows == 4, f"expected 4 source rows, got {src_rows}"
        assert page.locator(".full-est-pill").count() == 1, "expected 1 Estimated pill"
        print(f"citation source breakdown OK: {src_rows} rows + estimated pill")

        # Snippets (kept)
        snippet_count = page.locator(".full-snippet").count()
        assert snippet_count == 5, f"expected 5 snippets, got {snippet_count}"
        print(f"snippets OK: {snippet_count}")

        # Effort x impact recommendations
        rec_count = page.locator(".full-rec-card").count()
        assert rec_count == 5, f"expected 5 recs, got {rec_count}"
        # First card MUST be Low effort + High impact (sorted)
        first = page.locator(".full-rec-card").nth(0)
        first_txt = first.inner_text().lower()
        assert "low effort" in first_txt, f"first rec should be Low effort: {first_txt[:200]}"
        assert "high impact" in first_txt, f"first rec should be High impact: {first_txt[:200]}"
        print(f"effort x impact recs OK: {rec_count}, first = Low+High")

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
