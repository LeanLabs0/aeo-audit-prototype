"""Playwright shot — v10 'Prompts we asked' panel inside AI Citations.

Runs a LIVE scan against https://www.hubspot.com/products/marketing (cached
server-side from earlier tests, so fast), expands the AI Citations group via
the category tile, waits for `.prompts-panel`, and saves two screenshots:

  * `_scan_v10_prompts.png`        full page (after expand + scroll into view)
  * `_scan_v10_prompts_focus.png`  bounding-box screenshot of `.prompts-panel`

Captures console errors. Should be ZERO.
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
    # Wait for the results to render — category tiles appear when scan finishes.
    pg.wait_for_selector("#categories .cat-card", timeout=240_000)
    elapsed = time.monotonic() - t0
    print(f"=== FRONTEND scan wall-clock: {elapsed:.1f}s ===")

    # The AI Citations tile is the first one — click to expand its group.
    # (renderCategoryDetails opens it by default, but clicking the tile also
    # scrolls + ensures aria-expanded=true on the head.)
    first_tile = pg.locator("#categories .cat-card").first
    first_tile.click()

    # Wait for the prompts panel to be present.
    pg.wait_for_selector(".prompts-panel", state="visible", timeout=15_000)
    pg.wait_for_timeout(800)  # settle animations

    # Scroll the panel into view before the full-page shot. Use evaluate to
    # nudge a bit higher so the panel head isn't clipped under the compact nav.
    pg.locator(".prompts-panel").scroll_into_view_if_needed()
    pg.evaluate("window.scrollBy(0, -80)")
    pg.wait_for_timeout(300)

    # ── Full-page shot ─────────────────────────────────────────────────────
    pg.screenshot(path="_scan_v10_prompts.png", full_page=True)

    # ── Focused shot of just the panel ────────────────────────────────────
    pg.locator(".prompts-panel").screenshot(path="_scan_v10_prompts_focus.png")

    # ── Verification: count prompt rows + engine pills ───────────────────
    row_count = pg.locator(".prompts-panel .prompt-row").count()
    pill_count = pg.locator(".prompts-panel .prompt-eng").count()
    hit_count = pg.locator(".prompts-panel .prompt-eng.hit").count()
    miss_count = pg.locator(".prompts-panel .prompt-eng.miss").count()
    print(f"prompt rows: {row_count}  pills: {pill_count}  hit: {hit_count}  miss: {miss_count}")

    print("Console errors:", errs or "NONE")
    print("Shots: _scan_v10_prompts.png, _scan_v10_prompts_focus.png")
    b.close()
