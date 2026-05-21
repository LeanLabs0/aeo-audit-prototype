"""Throwaway proof-shot script for the reworked static AEO scanner mockup (v5).

v5 changes captured here:
  - Every sub-check card now starts COLLAPSED (header row only). Clicking a card
    toggles its body open.
  - Sharpened CTA copy: the "Book my call" band + the inline AI-citation gate
    ("Which buyer questions is AI hiding you from?" / "Email me the full report").

Captures console errors; there must be NONE.

Run server first (background):
  python -m http.server 8775 --bind 127.0.0.1 --directory "C:/Users/Sistemas/aeo-audit-prototype"
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8775"
OUT = "C:/Users/Sistemas/aeo-audit-prototype"

DESKTOP = {"width": 1280, "height": 900}

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

        # 1. RESULTS — desktop, FULL PAGE. After "Scan my site", every sub-check
        #    card must be COLLAPSED (header row only).
        pg = new(DESKTOP)
        pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
        pg.wait_for_timeout(500)
        pg.locator("#scanForm button[type=submit]").click()
        pg.wait_for_timeout(1300)
        # Sanity: assert no card carries the .open class on initial render.
        open_cards = pg.locator(".scan-card.open").count()
        assert open_cards == 0, f"Expected 0 open cards, found {open_cards}"
        grab(pg, f"{OUT}/_scan_v5_results.png", full_page=True)

        # 2. Click ONE card open, screenshot the VIEWPORT.
        first_card_head = pg.locator(".scan-card-head").first
        first_card_head.scroll_into_view_if_needed()
        first_card_head.click()
        pg.wait_for_timeout(400)
        first_card_head.scroll_into_view_if_needed()
        pg.wait_for_timeout(300)
        grab(pg, f"{OUT}/_scan_v5_card_open.png", full_page=False)

        # 3. Screenshot the CTA band region (viewport around it).
        cta = pg.locator(".cta-band").first
        cta.scroll_into_view_if_needed()
        pg.wait_for_timeout(400)
        grab(pg, f"{OUT}/_scan_v5_cta.png", full_page=False)
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
