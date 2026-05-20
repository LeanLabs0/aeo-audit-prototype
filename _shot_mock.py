"""Throwaway proof-shot script for the reworked static AEO scanner mockup (v2).
Open per-check cards (Goal/Result/Issue/How-to/Resources), no email gate.
Captures console errors; there must be NONE.

Run server first (background):
  python -m http.server 8772 --bind 127.0.0.1 --directory "C:/Users/Sistemas/aeo-audit-prototype"
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8772"
OUT = "C:/Users/Sistemas/aeo-audit-prototype"

DESKTOP = {"width": 1280, "height": 900}
MOBILE = {"width": 390, "height": 844}

written = []
all_console = []


def grab(page, path, full_page=True):
    page.screenshot(path=path, full_page=full_page)
    written.append(path)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        def new(viewport):
            pg = browser.new_page(viewport=viewport)
            pg.on("console", lambda m: all_console.append(f"[{m.type}] {m.text}"))
            pg.on("pageerror", lambda e: all_console.append(f"[PAGEERROR] {e}"))
            return pg

        # 1. default desktop
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(1300)
        grab(pg, f"{OUT}/_scan_v2_desktop.png")
        pg.close()

        # 2. default mobile
        pg = new(MOBILE)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(1300)
        grab(pg, f"{OUT}/_scan_v2_mobile.png")
        pg.close()

        # 3. unreadable
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html?state=unreadable", wait_until="networkidle")
        pg.wait_for_timeout(700)
        grab(pg, f"{OUT}/_scan_v2_unreadable.png")
        pg.close()

        # 4. citation-capacity
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html?state=citation-capacity", wait_until="networkidle")
        pg.wait_for_timeout(1300)
        grab(pg, f"{OUT}/_scan_v2_capacity.png")
        pg.close()

        # 5. cards: one passing card expanded AND one failing card expanded.
        # Failing cards start expanded by default. Open the FIRST passing
        # (collapsed) card so the shot shows both a Result and an Issue body.
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(1300)
        # First passing card lives in AI Citations (Cited by Claude). It is
        # collapsed by default — click its head to expand it.
        passing = pg.locator(".scan-card--pass:not(.open) .scan-card-head").first
        passing.click()
        pg.wait_for_timeout(400)
        grab(pg, f"{OUT}/_scan_v2_cards.png")
        pg.close()

        browser.close()

    errs = [m for m in all_console if "PAGEERROR" in m or "[error]" in m]
    print("Screenshots written:")
    for w in written:
        print(f"  {w}")
    if errs:
        print("\nCONSOLE ERRORS:")
        for m in errs:
            print(f"  {m}")
    else:
        print("\nConsole errors: NONE")


if __name__ == "__main__":
    main()
