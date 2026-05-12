"""Snapshot the email mockup + hosted report page for Kevin review."""
from playwright.sync_api import sync_playwright


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Email preview
        page = browser.new_page(viewport={"width": 700, "height": 1200})
        page.goto("http://localhost:8765/email.html", wait_until="networkidle")
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_email.png", full_page=True)
        print("email screenshot saved: _email.png")

        # Hosted report
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto("http://localhost:8765/report.html", wait_until="networkidle")
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_report.png", full_page=True)
        print("report screenshot saved: _report.png")

        browser.close()


if __name__ == "__main__":
    main()
