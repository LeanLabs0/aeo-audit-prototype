"""Verify restructure — defects from 2026-05-28 round all fixed.

Asserts:
  - #heroCallout section is removed (or empty + hidden)
  - 'Surfaced by AI:' chip row does NOT render anywhere
  - The standalone bottom 'What we found' (#checks) section is removed
  - 'What we found' is now the heading above the 4-tile row
  - 4 category groups render under it; AI Citations is one of them
  - AI Citations group body contains the per-prompt table (prompts-table)
  - Page layout order: score < 'What we found' header < tiles < 4 groups < CTA
"""
import asyncio
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8766/scan.html?v=20260528"
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

        # 1. No #heroCallout content
        callout_present = await page.evaluate(
            "() => !!document.querySelector('#heroCallout') || !!document.querySelector('.cite-callout')"
        )
        assert not callout_present, "verbatim callout still rendering"

        # 2. No 'Surfaced by AI:' chip row
        chip_label = await page.evaluate(
            "() => !!document.querySelector('.sol-competitors-label')"
        )
        assert not chip_label, "'Surfaced by AI' chip row still rendering"

        # 3. No bottom #checks duplicate
        bottom_checks = await page.evaluate(
            "() => !!document.querySelector('#checks')"
        )
        assert not bottom_checks, "bottom #checks section still rendering"

        # 4. 'What we found' is the heading above the 4-tile row
        title = await page.evaluate(
            "() => document.querySelector('#categoriesTitle').textContent.trim()"
        )
        assert title == "What we found", f"title wrong: {title!r}"

        # 5. 4 category groups under it
        group_count = await page.evaluate(
            "() => document.querySelectorAll('#categoryDetails .check-group').length"
        )
        assert group_count == 4, f"expected 4 groups, got {group_count}"

        # 6. AI Citations group present and contains the prompts table
        ai_has_table = await page.evaluate("""() => {
            const groups = [...document.querySelectorAll('#categoryDetails .check-group')];
            const ai = groups.find(g => /ai citations/i.test(g.querySelector('.check-group-name').textContent));
            if (!ai) return { found: false };
            const table = ai.querySelector('table.prompts-table');
            const rows = table ? table.querySelectorAll('tbody tr').length : 0;
            return { found: true, hasTable: !!table, rows };
        }""")
        assert ai_has_table["found"], "AI Citations group missing"
        assert ai_has_table["hasTable"], "AI Citations group has no prompts-table"
        assert ai_has_table["rows"] >= 4, f"prompts-table has too few rows: {ai_has_table['rows']}"

        # 7. AI Citations tile click expands the AI Citations group
        await page.evaluate("""() => {
            const groups = [...document.querySelectorAll('#categoryDetails .check-group')];
            const ai = groups.find(g => /ai citations/i.test(g.querySelector('.check-group-name').textContent));
            if (ai) {
                ai.classList.remove('open');
                ai.querySelector('.check-group-head').setAttribute('aria-expanded', 'false');
            }
        }""")
        await page.evaluate("""() => {
            const tile = [...document.querySelectorAll('.cat-tile')]
                .find(t => /ai citations/i.test(t.querySelector('.cat-label').textContent));
            if (tile) tile.click();
        }""")
        await page.wait_for_timeout(400)
        ai_open = await page.evaluate("""() => {
            const groups = [...document.querySelectorAll('#categoryDetails .check-group')];
            const ai = groups.find(g => /ai citations/i.test(g.querySelector('.check-group-name').textContent));
            return ai ? ai.classList.contains('open') : false;
        }""")
        assert ai_open, "AI Citations tile click did not expand the group"

        # 8. Layout order
        positions = await page.evaluate("""() => {
            const r = (sel) => {
                const el = document.querySelector(sel);
                return el ? el.getBoundingClientRect().top : null;
            };
            return {
                score: r('.score-section'),
                title: r('#categoriesTitle'),
                tiles: r('#categories'),
                groups: r('#categoryDetails'),
                cta: r('.cta-band'),
            };
        }""")
        assert positions["score"] < positions["title"] < positions["tiles"] < positions["groups"] < positions["cta"], \
            f"layout order wrong: {positions}"

        await page.screenshot(path="_scan_v15_restructure.png", full_page=True)
        print("OK — restructure verified")
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
