import time
from playwright.sync_api import sync_playwright

SOLUTION_URL = "https://lean-labs.com/solutions/answer-engine-optimization-agency"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--disable-web-security"])
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))

    pg.goto("http://127.0.0.1:8766/scan.html", wait_until="networkidle")
    pg.fill("#scanUrl", SOLUTION_URL)

    t0 = time.monotonic()
    pg.click("#scanForm button[type=submit]")

    # Wait for the per-solution detail section to render. Single-solution
    # scans should land well under 90s on a warm backend.
    pg.wait_for_selector(".sol-group, .check-group", timeout=90_000, state="attached")
    elapsed = time.monotonic() - t0
    print(f"=== FRONTEND scan wall-clock: {elapsed:.1f}s ===")

    pg.wait_for_timeout(800)
    pg.screenshot(path="_scan_v8_single.png", full_page=True)
    pg.screenshot(path="_scan_v8_top.png")  # viewport top
    print("Console errors:", errs or "NONE")
    print("Shots: _scan_v8_single.png, _scan_v8_top.png")
    b.close()
