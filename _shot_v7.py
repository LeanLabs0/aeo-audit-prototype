"""Playwright shot script — single-solution scan with the 4 AEO category tiles.

Verifies the 4-tile row renders for solutions[0].checks
(ai_citations, structured_data, crawler_access, entity), prints wall-clock
plus console errors, and saves a full-page screenshot.

Default mode: live POST to the backend.
Set MOCK=1 env var to use the local mock path (?state=mock) without burning
a real backend run. Useful when the backend hasn't shipped `checks` yet.
"""
import os
import time
from playwright.sync_api import sync_playwright

SOLUTION_URL = "https://lean-labs.com/solutions/answer-engine-optimization-agency"
USE_MOCK = os.environ.get("MOCK", "") == "1"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--disable-web-security"])

    # ── Desktop scan ───────────────────────────────────────────────────────
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))

    if USE_MOCK:
        t0 = time.monotonic()
        pg.goto("http://127.0.0.1:8766/scan.html?state=mock", wait_until="networkidle")
        pg.wait_for_selector("#categories .cat-card", timeout=15_000)
        elapsed = time.monotonic() - t0
        print(f"=== MOCK render wall-clock: {elapsed:.2f}s ===")
    else:
        pg.goto("http://127.0.0.1:8766/scan.html", wait_until="networkidle")
        pg.fill("#scanUrl", SOLUTION_URL)
        t0 = time.monotonic()
        pg.click("#scanForm button[type=submit]")
        pg.wait_for_selector("#categories .cat-card, .scan-card", timeout=180_000)
        elapsed = time.monotonic() - t0
        print(f"=== FRONTEND scan wall-clock: {elapsed:.1f}s ===")

    pg.wait_for_timeout(1200)  # let donut animations settle
    pg.screenshot(path="_scan_v9_full.png", full_page=True)
    pg.screenshot(path="_scan_v9_top.png")  # viewport top (1280x900)
    tile_count = pg.locator("#categories .cat-card").count()
    labels = pg.eval_on_selector_all(
        "#categories .cat-card .cat-label",
        "els => els.map(e => e.textContent.trim())",
    )
    print(f"Category tile count: {tile_count}")
    print(f"Category labels: {labels}")
    print("Console errors (desktop):", errs or "NONE")

    # ── Mobile (re-render with mock so we don't burn another live scan) ────
    mob = b.new_page(viewport={"width": 390, "height": 844})
    mob_errs = []
    mob.on("console", lambda m: mob_errs.append(m.text) if m.type == "error" else None)
    mob.on("pageerror", lambda e: mob_errs.append(str(e)))
    mob.goto("http://127.0.0.1:8766/scan.html?state=mock", wait_until="networkidle")
    mob.wait_for_selector("#categories .cat-card, .scan-card", timeout=30_000)
    mob.wait_for_timeout(600)
    mob.screenshot(path="_scan_v9_mobile.png", full_page=True)
    print("Console errors (mobile):", mob_errs or "NONE")

    print("Shots: _scan_v9_full.png, _scan_v9_top.png, _scan_v9_mobile.png")
    b.close()
