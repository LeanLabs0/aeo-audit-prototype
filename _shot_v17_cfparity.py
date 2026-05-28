"""Verify CF parity restyle — visual + interaction acceptance criteria."""
import asyncio
import re
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8766/scan.html?v=20260530"
TARGET = "https://www.leanlabs.com/solutions/growth-driven-design"


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()
        await page.goto(URL, wait_until="domcontentloaded")
        await page.fill("#scanUrl", TARGET)
        await page.click(".scan-submit")
        await page.wait_for_selector("#categoryDetails .check-group", timeout=180_000)

        # 1. No Pass/Fix text pill
        pills = await page.evaluate(
            "() => document.querySelectorAll('.card-badge').length"
        )
        assert pills == 0, f"Pass/Fix pills still rendering: {pills}"

        # 2. LEVEL pill present
        level_pill = await page.evaluate(
            "() => !!document.querySelector('.level-pill')"
        )
        assert level_pill, "LEVEL pill missing"

        # 3. Improve the score CTA shows count
        cta_text = await page.evaluate(
            "() => document.querySelector('.improve-cta')?.textContent?.trim() || ''"
        )
        assert "Improve the score" in cta_text, f"Improve CTA missing: {cta_text!r}"
        count = await page.evaluate(
            "() => document.querySelector('.improve-cta-count')?.textContent?.trim() || ''"
        )
        assert count.isdigit() and int(count) > 0, f"Improve CTA count missing: {count!r}"

        # 4. Cards collapsed by default
        open_cards = await page.evaluate(
            "() => document.querySelectorAll('.scan-card.open').length"
        )
        assert open_cards == 0, f"some cards already open: {open_cards}"

        # 5. Clicking a card head expands it
        # Cards live under .check-group-body which is display:none unless the
        # group is .open. The first group (AI Citations) has no .scan-card, so
        # find the first group that does and expand it before clicking the card.
        group_head = await page.evaluate_handle(
            """() => {
              for (const g of document.querySelectorAll('.check-group')) {
                if (g.querySelector('.scan-card')) {
                  return g.classList.contains('open') ? null : g.querySelector('.check-group-head');
                }
              }
              return null;
            }"""
        )
        if group_head and await group_head.evaluate("el => !!el"):
            await group_head.as_element().scroll_into_view_if_needed()
            await group_head.as_element().click(force=True)
            await page.wait_for_timeout(200)
        first_card = await page.evaluate_handle(
            """() => {
              for (const g of document.querySelectorAll('.check-group.open')) {
                const h = g.querySelector('.scan-card .scan-card-head');
                if (h) return h;
              }
              return document.querySelector('.scan-card .scan-card-head');
            }"""
        )
        first_card = first_card.as_element()
        if first_card:
            await first_card.scroll_into_view_if_needed()
            # Sticky compact-header can occlude — click via force after scroll.
            await first_card.click(force=True)
            await page.wait_for_timeout(300)
            now_open = await page.evaluate(
                "(h) => h.closest('.scan-card').classList.contains('open')",
                first_card,
            )
            assert now_open, "card did not open on click"

        # 6. Fail rows have Copy prompt button
        copy_btns = await page.evaluate(
            "() => document.querySelectorAll('[data-copy-prompt]').length"
        )
        assert copy_btns > 0, "no Copy prompt buttons rendered"

        # 7. Every row has Audit details button
        details_btns = await page.evaluate(
            "() => document.querySelectorAll('[data-audit-details]').length"
        )
        assert details_btns > 0, "no Audit details buttons rendered"

        # 8. Section header shows colored X/Y fraction
        frac = await page.evaluate(
            "() => document.querySelector('.check-group-frac')?.textContent?.trim() || ''"
        )
        assert re.match(r"^\d+/\d+$", frac), f"section fraction wrong: {frac!r}"

        # 9. Footer disclaimer present
        disclaimer = await page.evaluate(
            "() => !!document.querySelector('.footer-disclaimer')"
        )
        assert disclaimer, "footer disclaimer missing"

        # 10. Scan another site ghost button at bottom
        scan_another = await page.evaluate(
            "() => document.querySelector('#scanAnotherBottomBtn')?.classList?.contains('ghost-btn')"
        )
        assert scan_another, "ghost Scan another button missing"

        # 11. Last scanned timestamp visible
        ts = await page.evaluate(
            "() => document.querySelector('#scoreTimestamp')?.textContent?.trim() || ''"
        )
        assert ts.startswith("Last scanned"), f"timestamp wrong: {ts!r}"

        await page.screenshot(path="_scan_v17_cfparity.png", full_page=True)
        print("OK — CF parity verified")
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
