"""Throwaway proof-shot script for the reworked static AEO scanner mockup (v4).

Jonathan v4: TWO screens (entry above the fold → results), always-on optional
inputs, hybrid gating (all category cards open/unblurred; only the deep extra
prompt-table rows gated behind one inline AI-citation email gate), BIG "Overall
Score" heading, CTA band as its own section.

Captures console errors; there must be NONE.

Run server first (background):
  python -m http.server 8774 --bind 127.0.0.1 --directory "C:/Users/Sistemas/aeo-audit-prototype"
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8774"
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

        # 1. ENTRY screen — desktop, VIEWPORT (not full page) to prove it sits
        #    above the fold: headline + URL input + always-on optional inputs.
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(700)
        grab(pg, f"{OUT}/_scan_v4_entry_desktop.png", full_page=False)
        pg.close()

        # 2. ENTRY screen — mobile, VIEWPORT
        pg = new(MOBILE)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(700)
        grab(pg, f"{OUT}/_scan_v4_entry_mobile.png", full_page=False)
        pg.close()

        # 3. RESULTS screen — desktop, FULL PAGE (after clicking "Scan my site").
        #    Compact header + big Overall Score + tiles + CTA band + all cards
        #    open + AI-citation table with first 2 rows visible, rest gated.
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(500)
        pg.locator("#scanForm button[type=submit]").click()
        pg.wait_for_timeout(1300)
        grab(pg, f"{OUT}/_scan_v4_results_desktop.png", full_page=True)
        pg.close()

        # 4. RESULTS screen — mobile, FULL PAGE
        pg = new(MOBILE)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(500)
        pg.locator("#scanForm button[type=submit]").click()
        pg.wait_for_timeout(1300)
        grab(pg, f"{OUT}/_scan_v4_results_mobile.png", full_page=True)
        pg.close()

        # 5. After submitting the inline AI-citation gate (remaining rows unblur,
        #    gate hidden, "Sent to {email}" shown) — desktop full page.
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(500)
        pg.locator("#scanForm button[type=submit]").click()
        pg.wait_for_timeout(1000)
        pg.locator("#citeGateEmail").fill("ralph@lean-labs.com")
        pg.locator("#citeGateForm button[type=submit]").click()
        pg.wait_for_timeout(600)
        grab(pg, f"{OUT}/_scan_v4_unlocked.png", full_page=True)
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
