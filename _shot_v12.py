"""Playwright shot — v12 single citation table under "What we found".

Runs a LIVE scan against https://www.hubspot.com/products/marketing
(cached server-side, fast), then asserts the page renders exactly ONE
citation view: the simple 4-column `table.prompts-table` inside the
"What we found" section. The old `.prompts-panel` drill-down must be
gone.

Saves:
  * `_scan_v12_table.png`        full page
  * `_scan_v12_table_focus.png`  the table region only

Console errors MUST be ZERO.
"""
import time

from playwright.sync_api import sync_playwright

SOLUTION_URL = "https://www.hubspot.com/products/marketing"


def _ascii(s: str) -> str:
    return s.encode("ascii", "replace").decode("ascii")


with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--disable-web-security"])
    pg = b.new_page(viewport={"width": 1280, "height": 900})

    errs: list[str] = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))

    pg.goto("http://127.0.0.1:8766/scan.html", wait_until="networkidle")
    pg.fill("#scanUrl", SOLUTION_URL)

    t0 = time.monotonic()
    pg.click("#scanForm button[type=submit]")
    # Wait for the simple table to render — that's the success signal.
    pg.wait_for_selector("table.prompts-table", state="visible", timeout=240_000)
    elapsed = time.monotonic() - t0
    print(f"=== FRONTEND scan wall-clock: {elapsed:.1f}s ===")

    pg.wait_for_timeout(600)
    pg.locator("table.prompts-table").scroll_into_view_if_needed()
    pg.evaluate("window.scrollBy(0, -80)")
    pg.wait_for_timeout(300)

    # ── Full-page shot ─────────────────────────────────────────────────────
    pg.screenshot(path="_scan_v12_table.png", full_page=True)
    # ── Focused shot of the table only ─────────────────────────────────────
    pg.locator(".prompts-table-wrap").first.screenshot(path="_scan_v12_table_focus.png")

    # ── Assertions ────────────────────────────────────────────────────────
    panel_count = pg.locator(".prompts-panel").count()
    table_count = pg.locator("table.prompts-table").count()
    row_count = pg.locator("table.prompts-table tbody tr").count()

    print(f".prompts-panel count: {panel_count}")
    print(f"table.prompts-table count: {table_count}")
    print(f"tbody row count: {row_count}")

    assert panel_count == 0, f"expected 0 .prompts-panel, got {panel_count}"
    assert table_count == 1, f"expected 1 table.prompts-table, got {table_count}"
    assert row_count == 8, f"expected 8 tbody rows, got {row_count}"

    # ── Capture columns ───────────────────────────────────────────────────
    headers = [
        _ascii(pg.locator("table.prompts-table thead th").nth(i).inner_text())
        for i in range(4)
    ]
    print(f"\nHEADER cells: {headers}")

    print("\nSAMPLE rows (1 & 2):")
    for ri in range(2):
        cells = [
            _ascii(pg.locator(f"table.prompts-table tbody tr").nth(ri).locator("td").nth(ci).inner_text())
            for ci in range(4)
        ]
        print(f"  row {ri + 1}: #={cells[0]!r} | Q={cells[1][:80]!r}... | "
              f"Comp={cells[2]!r} | Cited={cells[3]!r}")

    print("\nConsole errors:", errs or "NONE")
    print("Shots: _scan_v12_table.png, _scan_v12_table_focus.png")
    assert len(errs) == 0, f"console errors: {errs}"

    b.close()
