"""E2E test for AEO Audit prototype against live factor8 endpoint."""
from playwright.sync_api import sync_playwright


def main():
    console_messages = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_messages.append(f"[PAGEERROR] {err}"))

        page.goto("http://localhost:8765/", wait_until="networkidle")
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_screen_input.png", full_page=True)

        # URL field is pre-filled with lean-labs.com; click the score button
        btn = page.locator("#scoreBtn")
        assert btn.is_visible(), "scoreBtn not visible"
        btn.click()

        # Scanning screen should activate
        page.wait_for_selector("#screen-scanning.active", timeout=5000)
        page.wait_for_timeout(2000)
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_screen_scanning.png", full_page=True)

        # Dismiss any alerts (failure modal)
        page.on("dialog", lambda d: d.dismiss())

        # Wait for results screen (factor8 endpoint takes ~15s)
        page.wait_for_selector("#screen-results.active", timeout=60000)
        page.wait_for_timeout(1500)  # settle
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_screen_results.png", full_page=True)

        # Verify content rendered
        grade_letter = page.locator("#gradeLetterEl").inner_text()
        grade_score = page.locator("#gradeScoreEl").inner_text()
        verdict = page.locator("#verdictEl").inner_text()
        pillar_rows = page.locator(".pillar-row").count()
        finding_cards = page.locator(".gap-card").count()
        engine_cards = page.locator(".engine-card").count()

        print(f"grade_letter: {grade_letter!r}")
        print(f"grade_score:  {grade_score!r}")
        print(f"verdict:      {verdict[:80]!r}...")
        print(f"pillar rows:  {pillar_rows}")
        print(f"finding cards: {finding_cards}")
        print(f"engine cards: {engine_cards}")

        # Grab pillar names + scores
        pillars = page.locator(".pillar-row").all()
        print("\nPillars rendered:")
        for row in pillars:
            name = row.locator(".pillar-name").inner_text()
            score = row.locator(".pillar-score-cell").inner_text()
            print(f"  {name}: {score}")

        # First top finding
        if finding_cards > 0:
            first_card = page.locator(".gap-card").first
            title = first_card.locator(".gap-title").inner_text()
            print(f"\nFirst finding: {title!r}")

        # Engine card scores
        print("\nEngine cards:")
        for i in range(engine_cards):
            card = page.locator(".engine-card").nth(i)
            head = card.locator(".engine-head span").inner_text()
            score = card.locator(".engine-score").inner_text()
            rate = card.locator(".engine-rate").inner_text()
            print(f"  {head}: {score.strip()} | {rate}")

        # ── Stage 2: email submit → thank-you screen ─────────
        page.locator("#emailField").fill("ralph@lean-labs.com")
        page.locator("#emailForm button[type='submit']").click()
        page.wait_for_selector("#screen-thankyou.active", timeout=5000)
        page.wait_for_timeout(800)
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_screen_thankyou.png", full_page=True)
        echoed_email = page.locator("#thankyouEmail").inner_text()
        print(f"\nThank-you screen echoed email: {echoed_email!r}")
        assert "ralph@lean-labs.com" in echoed_email

        browser.close()

    print("\nConsole messages:")
    for msg in console_messages:
        print(f"  {msg}")

    print("\nScreenshots saved:")
    print("  _screen_input.png")
    print("  _screen_scanning.png")
    print("  _screen_results.png")


if __name__ == "__main__":
    main()
