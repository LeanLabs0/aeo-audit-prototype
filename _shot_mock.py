"""Throwaway proof-shot script for the reworked static AEO scanner mockup (v3).

Jonathan v3: overall-score callout (no letter grade), pre-run optional inputs,
condensed category summary tiles, 2-card teaser + email gate (blur), single CTA.

Captures console errors; there must be NONE.

Run server first (background):
  python -m http.server 8773 --bind 127.0.0.1 --directory "C:/Users/Sistemas/aeo-audit-prototype"
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8773"
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

        # 1. default desktop (full page: overall score, summary tiles, CTA,
        #    AI-Citations hook open, teaser cards + blurred gate)
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(1300)
        grab(pg, f"{OUT}/_scan_v3_desktop.png")
        pg.close()

        # 2. default mobile
        pg = new(MOBILE)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(1300)
        grab(pg, f"{OUT}/_scan_v3_mobile.png")
        pg.close()

        # 3. optional inputs block expanded in the hero (click the toggle first)
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(800)
        pg.locator("#ctxToggle").click()
        pg.wait_for_timeout(500)
        grab(pg, f"{OUT}/_scan_v3_inputs.png")
        pg.close()

        # 4. after submitting the email gate (blur removed everywhere)
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(1300)
        pg.locator("#gateEmail").fill("ralph@lean-labs.com")
        pg.locator("#gateForm button[type=submit]").click()
        pg.wait_for_timeout(600)
        grab(pg, f"{OUT}/_scan_v3_unlocked.png")
        pg.close()

        # 5. unreadable error state
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html?state=unreadable", wait_until="networkidle")
        pg.wait_for_timeout(700)
        grab(pg, f"{OUT}/_scan_v3_unreadable.png")
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
