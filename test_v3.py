"""Click through the v3 prototype + screenshot each step.

Tests:
1. Entry → click "Walk Through" → Step 1 visible, progress dot 1 active
2. Step 1 → click "See what buyers see" → Step 2 visible, AI response box rendered
3. Step 2 → click "See what we found" → Step 3 visible, tally bar 0/5
4. Step 3 → click "Fix this" on f1 + f2 → tally 2/5, CTA enabled
5. Step 3 → click "See your options" → Step 4 visible, tier grid rendered
"""
from playwright.sync_api import sync_playwright


def main():
    console = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("console", lambda m: console.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: console.append(f"[PAGEERROR] {e}"))

        # ── Entry ──────────────────────────────────────────
        page.goto("http://localhost:8765/report-v3.html", wait_until="networkidle")
        # Clear any prior localStorage state for clean test
        page.evaluate("() => localStorage.removeItem('aeo-v3-state')")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(500)
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step0_entry.png", full_page=True)
        assert page.locator(".v3-step-entry.active").count() == 1, "entry step not active"
        print("step 0 entry: active OK")

        # ── Step 1 ──────────────────────────────────────────
        page.locator('button[data-go="1"]').click()
        page.wait_for_selector('.v3-step[data-step="1"].active', timeout=3000)
        page.wait_for_timeout(500)
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step1_where_you_stand.png", full_page=True)
        donut_count = page.locator(".v3-donut").count()
        assert donut_count == 3, f"expected 3 donuts, got {donut_count}"
        print(f"step 1: 3 score donuts visible OK")

        # ── Step 2 ──────────────────────────────────────────
        page.locator('button[data-go="2"]').click()
        page.wait_for_selector('.v3-step[data-step="2"].active', timeout=3000)
        page.wait_for_timeout(500)
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step2_what_buyers_see.png", full_page=True)
        not_mentioned = page.locator(".v3-not-mentioned").inner_text()
        assert "not mentioned" in not_mentioned.lower(), "not-mentioned callout missing"
        print("step 2: AI response + not-mentioned callout OK")

        # ── Step 3 ──────────────────────────────────────────
        page.locator('button[data-go="3"]').click()
        page.wait_for_selector('.v3-step[data-step="3"].active', timeout=3000)
        page.wait_for_timeout(500)

        # Initial tally = 0
        tally_initial = page.locator("#tallyN").inner_text()
        assert tally_initial == "0", f"tally should start at 0, got {tally_initial}"

        # Toggle f1 and f2
        page.locator('button[data-toggle="f1"]').click()
        page.wait_for_timeout(200)
        page.locator('button[data-toggle="f2"]').click()
        page.wait_for_timeout(300)
        tally_after = page.locator("#tallyN").inner_text()
        assert tally_after == "2", f"tally should be 2, got {tally_after}"
        print(f"step 3: micro-commitments work, tally = {tally_after}/5 OK")

        # CTA should now be enabled
        cta_disabled = page.locator("#step3Cta").get_attribute("disabled")
        assert cta_disabled is None, "CTA should be enabled with savings"
        print("step 3: CTA enabled after 1+ saves OK")

        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step3_what_we_found.png", full_page=True)

        # ── Step 4 ──────────────────────────────────────────
        page.locator("#step3Cta").click()
        page.wait_for_selector('.v3-step[data-step="4"].active', timeout=3000)
        page.wait_for_timeout(500)
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step4_math_options.png", full_page=True)

        tier_count = page.locator(".v3-tier").count()
        assert tier_count == 2, f"expected 2 tiers, got {tier_count}"
        step4_tally = page.locator("#step4Tally").inner_text()
        assert step4_tally == "2", f"step 4 tally line should carry 2, got {step4_tally}"
        print(f"step 4: 2 tiers + carried tally ({step4_tally}/5) OK")

        # Back button works
        page.locator("#navBack").click()
        page.wait_for_selector('.v3-step[data-step="3"].active', timeout=3000)
        print("nav back: step 4 -> step 3 OK")

        browser.close()

    print("\nConsole errors:")
    errs = [m for m in console if "[PAGEERROR]" in m or "[error]" in m]
    if errs:
        for m in errs:
            print(f"  {m}")
    else:
        print("  (none)")


if __name__ == "__main__":
    main()
