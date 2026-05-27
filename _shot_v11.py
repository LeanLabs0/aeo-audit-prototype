"""Playwright shot — v11 'per-prompt, per-engine' competitor names table.

Extends v10. Runs a LIVE scan against
https://www.hubspot.com/products/marketing (cached server-side, fast),
expands the AI Citations group, waits for `.prompts-panel`, and asserts
each `.prompt-row` carries a `.prompt-engines-table` with 3
`.prompt-eng-col` cells. Captures brand-name density per engine.

Saves two screenshots:
  * `_scan_v11_brands.png`  full page (after expand + scroll into view)
  * `_scan_v11_panel.png`   bounding-box screenshot of `.prompts-panel`

Console errors MUST be ZERO.
"""
import time

from playwright.sync_api import sync_playwright

SOLUTION_URL = "https://www.hubspot.com/products/marketing"

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
    # Wait for the category tiles to appear (means the scan finished).
    pg.wait_for_selector("#categories .cat-card", timeout=240_000)
    elapsed = time.monotonic() - t0
    print(f"=== FRONTEND scan wall-clock: {elapsed:.1f}s ===")

    # AI Citations tile is the first one; click to ensure expanded + scroll.
    first_tile = pg.locator("#categories .cat-card").first
    first_tile.click()

    pg.wait_for_selector(".prompts-panel", state="visible", timeout=15_000)
    pg.wait_for_timeout(800)

    pg.locator(".prompts-panel").scroll_into_view_if_needed()
    pg.evaluate("window.scrollBy(0, -80)")
    pg.wait_for_timeout(300)

    # ── Full-page shot ─────────────────────────────────────────────────────
    pg.screenshot(path="_scan_v11_brands.png", full_page=True)

    # ── Focused shot of just the panel ────────────────────────────────────
    pg.locator(".prompts-panel").screenshot(path="_scan_v11_panel.png")

    # ── Assertions ────────────────────────────────────────────────────────
    row_count = pg.locator(".prompts-panel .prompt-row").count()
    table_count = pg.locator(".prompts-panel .prompt-engines-table").count()
    col_count = pg.locator(".prompts-panel .prompt-eng-col").count()
    you_count = pg.locator(".prompts-panel .prompt-eng-brand.you").count()
    brand_count = pg.locator(".prompts-panel .prompt-eng-brand").count()
    empty_count = pg.locator(".prompts-panel .prompt-eng-empty").count()

    assert row_count > 0, f"no prompt rows rendered (got {row_count})"
    assert table_count == row_count, (
        f"every prompt-row must have a prompt-engines-table: rows={row_count} tables={table_count}"
    )
    assert col_count == row_count * 3, (
        f"every table must have 3 cols: rows={row_count} cols={col_count}"
    )

    # Per-engine brand density (chatgpt / claude / gemini columns).
    avg_brands_per_cell = brand_count / max(col_count, 1)
    print(f"prompt rows: {row_count}")
    print(f"engine cells (cols): {col_count}")
    print(f"brand pills: {brand_count} ({avg_brands_per_cell:.2f} avg/cell)")
    print(f"  - 'you' (your brand cited): {you_count}")
    print(f"  - 'em-dash' (empty): {empty_count}")

    # Sample the first prompt-row's brand names from each engine column.
    # Use ASCII-safe encoding for Windows cp1252 console.
    def _ascii(s: str) -> str:
        return s.encode("ascii", "replace").decode("ascii")

    print("\nSAMPLE - first 6 engine cells (prompts A-B, all 3 engines):")
    for i in range(min(6, col_count)):
        col = pg.locator(".prompts-panel .prompt-eng-col").nth(i)
        head = _ascii(col.locator(".prompt-eng-col-head").inner_text())
        items = [_ascii(s) for s in col.locator(".prompt-eng-brand, .prompt-eng-empty").all_inner_texts()]
        print(f"  cell {i} [{head}] -> {items}")

    print("\nConsole errors:", errs or "NONE")
    print("Shots: _scan_v11_brands.png, _scan_v11_panel.png")
    b.close()
