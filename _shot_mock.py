"""Throwaway proof-shot script for the static AEO scanner mockup.
Assumes a static server is already running on 127.0.0.1:8770 serving the
prototype dir. Captures console errors; there must be NONE.
Run server first (background):
  python -m http.server 8770 --bind 127.0.0.1 --directory "C:/Users/Sistemas/aeo-audit-prototype"
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8770"
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
        grab(pg, f"{OUT}/_scan_mock_default_desktop.png")
        pg.close()

        # 2. default mobile
        pg = new(MOBILE)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(1300)
        grab(pg, f"{OUT}/_scan_mock_default_mobile.png")
        pg.close()

        # 3. unreadable
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html?state=unreadable", wait_until="networkidle")
        pg.wait_for_timeout(700)
        grab(pg, f"{OUT}/_scan_mock_unreadable.png")
        pg.close()

        # 4. citation-capacity
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html?state=citation-capacity", wait_until="networkidle")
        pg.wait_for_timeout(1300)
        grab(pg, f"{OUT}/_scan_mock_capacity.png")
        pg.close()

        # 5. all-green
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html?state=all-green", wait_until="networkidle")
        pg.wait_for_timeout(1300)
        grab(pg, f"{OUT}/_scan_mock_allgreen.png")
        pg.close()

        # 6. unlocked: open a check row, submit the gate, then shoot
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(1300)
        # open the first check row (a real finding)
        pg.locator(".check-row[data-row] .check-head").first.click()
        pg.wait_for_timeout(300)
        # submit the gate to unlock fixes
        pg.fill("#gateEmail", "ralph@lean-labs.com")
        pg.click(".gate-submit")
        pg.wait_for_timeout(500)
        grab(pg, f"{OUT}/_scan_mock_unlocked.png")
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
