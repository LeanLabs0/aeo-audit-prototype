"""Click through the v3 prototype + screenshot each step.

Lead-magnet flow (no pricing, no money):
  0 entry → 1 scores → 2 buyers see → 3 findings → 4 fix plan + email → 5 thanks + Kevin
"""
from playwright.sync_api import sync_playwright


def main():
    console = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("console", lambda m: console.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: console.append(f"[PAGEERROR] {e}"))

        # Clean state
        page.goto("http://localhost:8765/report-v3.html", wait_until="networkidle")
        page.evaluate("() => localStorage.removeItem('aeo-v3-state')")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(400)

        # Step 0
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step0_entry.png", full_page=True)
        assert page.locator(".v3-step-entry.active").count() == 1
        print("step 0 entry OK")

        # Step 1 — new 3 AEO pillars
        page.locator('button[data-go="1"]').click()
        page.wait_for_selector('.v3-step[data-step="1"].active', timeout=3000)
        page.wait_for_timeout(400)
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step1_where_you_stand.png", full_page=True)
        names = [el.inner_text().lower() for el in page.locator(".v3-score-name").all()]
        print(f"step 1 score cards: {names}")
        assert "content extractability" in names
        assert "citation performance" in names
        assert "entity authority" in names
        print("step 1: 3 AEO pillars OK")

        # Step 2
        page.locator('button[data-go="2"]').click()
        page.wait_for_selector('.v3-step[data-step="2"].active', timeout=3000)
        page.wait_for_timeout(400)
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step2_what_buyers_see.png", full_page=True)
        assert "not mentioned" in page.locator(".v3-not-mentioned").inner_text().lower()
        print("step 2: AI response + not-mentioned OK")

        # Step 3 — relabeled CTAs + add 3 to plan
        page.locator('button[data-go="3"]').click()
        page.wait_for_selector('.v3-step[data-step="3"].active', timeout=3000)
        page.wait_for_timeout(400)
        first_btn_text = page.locator('button[data-toggle="f3"] .v3-toggle-default').inner_text()
        assert "Add to plan" in first_btn_text, f"expected 'Add to plan', got '{first_btn_text}'"
        print("step 3: CTA copy relabeled OK")

        page.locator('button[data-toggle="f1"]').click()
        page.locator('button[data-toggle="f2"]').click()
        page.locator('button[data-toggle="f4"]').click()
        page.wait_for_timeout(300)
        assert page.locator("#tallyN").inner_text() == "3"
        cta_disabled = page.locator("#step3Cta").get_attribute("disabled")
        assert cta_disabled is None
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step3_what_we_found.png", full_page=True)
        print("step 3: 3 of 5 tagged, CTA enabled OK")

        # Step 4 — fix plan + email gate (NO PRICING)
        page.locator("#step3Cta").click()
        page.wait_for_selector('.v3-step[data-step="4"].active', timeout=3000)
        page.wait_for_timeout(400)

        # Verify NO pricing elements
        assert page.locator(".v3-tier").count() == 0, "step 4 should have NO pricing tiers"
        assert page.locator(".v3-tier-roi-num").count() == 0, "step 4 should have NO ROI numbers"
        # Verify plan card + email form present
        assert page.locator(".v3-plan-card").count() == 1
        assert page.locator(".v3-email-form").count() == 1
        # Verify plan tally text reflects 3
        plan_tally = page.locator("#planTallyText").inner_text()
        assert "3" in plan_tally, f"plan tally should reflect 3, got '{plan_tally}'"
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step4_fix_plan.png", full_page=True)
        print(f"step 4: fix plan + email gate (no pricing). plan tally = '{plan_tally}' OK")

        # Submit email
        page.locator("#planEmail").fill("ralph@lean-labs.com")
        page.locator('button[type="submit"].v3-email-submit').click()
        page.wait_for_selector('.v3-step[data-step="5"].active', timeout=3000)
        page.wait_for_timeout(500)

        # Step 5 — thanks + Kevin
        page.screenshot(path="C:/Users/Sistemas/aeo-audit-prototype/_v3_step5_thanks.png", full_page=True)
        thanks_email = page.locator("#thanksEmail").inner_text()
        assert "ralph@lean-labs.com" in thanks_email
        kevin_cta_count = page.locator(".v3-kevin-cta").count()
        assert kevin_cta_count == 1
        print(f"step 5: email echoed '{thanks_email}', Kevin CTA present OK")

        browser.close()

    print("\nConsole errors:")
    errs = [m for m in console if "[PAGEERROR]" in m or "[error]" in m]
    if errs:
        for m in errs: print(f"  {m}")
    else:
        print("  (none)")


if __name__ == "__main__":
    main()
