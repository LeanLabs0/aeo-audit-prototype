"""Proof shots for the multi-solution AEO scanner wired to the live backend.

v4 wiring (this script):
  - Entry → click "Scan my site" with https://lean-labs.com
  - Wait up to 280s for results to render (live POST to factor8-agent-sdk)
  - Capture entry, results (desktop + mobile)
  - Fail loud on any console errors

Starts its own static HTTP server in the background on port 8780.
"""
from __future__ import annotations

import http.server
import socketserver
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path("C:/Users/Sistemas/aeo-audit-prototype")
PORT = 8780
BASE = f"http://127.0.0.1:{PORT}"

DESKTOP = {"width": 1280, "height": 900}
MOBILE = {"width": 390, "height": 844}

written: list[str] = []
all_console: list[str] = []


class _Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):  # silence
        pass


def serve_in_background() -> socketserver.TCPServer:
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), _Handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def grab(page, path, full_page=True):
    page.screenshot(path=path, full_page=full_page)
    written.append(path)
    print(f"  wrote {path}")


def main() -> int:
    httpd = serve_in_background()
    print(f"Static server on {BASE} (root={ROOT})")
    try:
        with sync_playwright() as p:
            # Disable CORS for the proof shots — the production page will live on
            # an origin allowlisted by the backend, so this is a test-rig only
            # concern. Chrome flags below skip the preflight/origin check.
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--disable-web-security",
                    "--disable-features=IsolateOrigins,site-per-process",
                ],
            )

            def new(viewport):
                ctx = browser.new_context(
                    viewport=viewport,
                    bypass_csp=True,
                )
                pg = ctx.new_page()
                pg.on("console", lambda m: all_console.append(f"[{m.type}] {m.text}"))
                pg.on("pageerror", lambda e: all_console.append(f"[PAGEERROR] {e}"))
                return pg

            # 1. ENTRY (desktop, viewport only — not full page)
            pg = new(DESKTOP)
            pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
            pg.wait_for_timeout(500)
            grab(pg, str(ROOT / "_scan_v4_entry.png"), full_page=False)

            # 2. Submit → loading → wait for results
            pg.fill("#scanUrl", "https://lean-labs.com")
            t0 = time.time()
            pg.locator("#scanForm button[type=submit]").click()
            # Confirm loading appears
            pg.wait_for_selector(".state-card--loading", timeout=10_000)
            print("  loading shown — waiting for results (up to 280s)…")

            # 3. Poll for results — either #checks .check-group or scanState back
            #    in error mode.
            deadline = time.time() + 280
            success = False
            errored = False
            while time.time() < deadline:
                group_count = pg.locator(".check-group.sol-group").count()
                err_card = pg.locator("#scanState .state-card--bad").count()
                if group_count > 0:
                    success = True
                    break
                if err_card > 0:
                    errored = True
                    break
                pg.wait_for_timeout(500)
            elapsed = time.time() - t0
            print(f"  live scan took {elapsed:.1f}s (success={success}, errored={errored})")

            # Settle (gauge animation, donuts)
            pg.wait_for_timeout(1200)

            grab(pg, str(ROOT / "_scan_v4_results.png"), full_page=True)
            pg.close()

            # 4. Mobile shot — re-run by reloading and re-firing on a mobile-sized page.
            pg = new(MOBILE)
            pg.goto(f"{BASE}/scan.html", wait_until="networkidle")
            pg.wait_for_timeout(400)
            pg.fill("#scanUrl", "https://lean-labs.com")
            pg.locator("#scanForm button[type=submit]").click()
            pg.wait_for_selector(".state-card--loading", timeout=10_000)
            deadline = time.time() + 280
            while time.time() < deadline:
                if pg.locator(".check-group.sol-group").count() > 0:
                    break
                if pg.locator("#scanState .state-card--bad").count() > 0:
                    break
                pg.wait_for_timeout(500)
            pg.wait_for_timeout(1200)
            grab(pg, str(ROOT / "_scan_v4_results_mobile.png"), full_page=True)
            pg.close()

            browser.close()

        errs = [m for m in all_console if "PAGEERROR" in m or m.startswith("[error]")]
        print("\nScreenshots:")
        for w in written:
            print(f"  {w}")
        if errs:
            print("\nCONSOLE ERRORS:")
            for m in errs:
                print(f"  {m}")
            return 2
        print("\nConsole errors: NONE")
        return 0
    finally:
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    raise SystemExit(main())
