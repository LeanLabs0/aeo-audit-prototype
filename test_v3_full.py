"""Snap Step 4 (w/ matrix preview) + the full deliverable report."""
from playwright.sync_api import sync_playwright


def main():
    console = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("console", lambda m: console.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: console.append(f"[PAGEERROR] {e}"))

        # ── Step 4 walkthrough check ────────────────────────
        page.goto("http://localhost:8765/report-v3.html", wait_until="networkidle")
        page.evaluate("() => localStorage.setItem('aeo-v3-state', JSON.stringify({savedFixes:['f1','f2']}))")
        page.goto("http://localhost:8765/report-v3.html#step-4", wait_until="networkidle")
        page.wait_for_timeout(800)
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step4_with_matrix.png", full_page=True)
        matrix_visible = page.locator(".v3-matrix-preview").count() == 1
        assert matrix_visible, "matrix preview missing on Step 4"
        print("step 4: matrix preview rendered OK")

        # ── Full deliverable report ─────────────────────────
        page.goto("http://localhost:8765/report-full.html", wait_until="networkidle")
        page.wait_for_timeout(800)
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_full_report.png", full_page=True)
        signal_matrix_rows = page.locator(".full-matrix").nth(0).locator("tbody tr").count()
        schema_matrix_rows = page.locator(".full-matrix").nth(1).locator("tbody tr").count()
        snippet_count = page.locator(".full-snippet").count()
        assert signal_matrix_rows == 10, f"signal matrix rows expected 10, got {signal_matrix_rows}"
        assert schema_matrix_rows == 10, f"schema matrix rows expected 10, got {schema_matrix_rows}"
        assert snippet_count == 5, f"expected 5 ready-to-ship snippets, got {snippet_count}"
        print(f"full report: signal matrix {signal_matrix_rows} rows, schema matrix {schema_matrix_rows} rows, {snippet_count} snippets OK")

        browser.close()

    errs = [m for m in console if "PAGEERROR" in m or "[error]" in m]
    if errs:
        print("\nConsole errors:")
        for m in errs:
            print(f"  {m}")
    else:
        print("\nConsole errors: none")


if __name__ == "__main__":
    main()
