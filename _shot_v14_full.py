"""End-to-end verification — defects A/B/C/D all fixed.

Runs a real scan against the deployed factor8 endpoint with the fixed
backend, then asserts every fix criterion."""
import asyncio
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8766/scan.html?v=20260527"
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
        await page.wait_for_selector(".prompts-table tbody tr", timeout=10_000)

        # === DEFECT A: groups expand on click ===
        first = await page.query_selector("#categoryDetails .check-group:not(.open) .check-group-head")
        if first:
            await first.click()
            await page.wait_for_timeout(300)
            opened = await page.evaluate(
                "(h) => h.closest('.check-group').classList.contains('open')",
                first,
            )
            assert opened, "DEFECT A — category group did not expand on click"

        # === DEFECT B: no AI Citations drill anywhere ===
        ai_drill = await page.evaluate("""() => {
            const inDetails = [...document.querySelectorAll('#categoryDetails .check-group-name')]
              .filter(n => /ai citations/i.test(n.textContent)).length;
            const citedCards = [...document.querySelectorAll('.card-name')]
              .filter(n => /^Cited by /i.test(n.textContent)).length;
            const oldPanel = document.body.innerText.includes('Prompts we asked across ChatGPT, Claude');
            return { inDetails, citedCards, oldPanel };
        }""")
        assert ai_drill["inDetails"] == 0, f"DEFECT B — AI Citations drill: {ai_drill}"
        assert ai_drill["citedCards"] == 0, f"DEFECT B — 'Cited by X' cards: {ai_drill}"
        assert not ai_drill["oldPanel"], f"DEFECT B — old archetype panel: {ai_drill}"

        # === DEFECT C: callout sits between score and tiles ===
        positions = await page.evaluate("""() => {
            const r = (sel) => {
                const el = document.querySelector(sel);
                return el ? el.getBoundingClientRect().top : null;
            };
            return {
                score: r('.score-section'),
                callout: r('#heroCallout .cite-callout'),
                tiles: r('#categoriesSection'),
                whatWeFound: r('#checks'),
            };
        }""")
        assert positions["callout"] is not None, "DEFECT C — hero callout missing"
        assert positions["score"] < positions["callout"] < positions["tiles"] < positions["whatWeFound"], \
            f"DEFECT C — wrong order: {positions}"

        # Callout must NOT appear twice (no duplicate inside #checks).
        callout_count = await page.evaluate(
            "() => document.querySelectorAll('.cite-callout').length"
        )
        assert callout_count == 1, f"DEFECT C — callout rendered {callout_count} times"

        # === DEFECT D: no section labels in competitors column ===
        comps = await page.evaluate("""() => {
            const cells = [...document.querySelectorAll('.prompts-table .col-comp')]
              .map(td => td.textContent.trim().toLowerCase());
            return cells.join(' | ');
        }""")
        noise_terms = [
            "clear value proposition", "hero section", "foundation",
            "contact/demo", "core philosophy",
            "brand voice", "ai features", "data-driven marketing",
            "testing, approach", "flexibility, agile",
        ]
        leaked = [t for t in noise_terms if t in comps]
        assert not leaked, f"DEFECT D — noise leaked: {leaked}\ncells: {comps}"

        # Column header reads 'Competitors Mentioned', not 'Likely Competitors Mentioned'
        header = await page.evaluate(
            "() => document.querySelector('.prompts-table th.col-comp').textContent.trim()"
        )
        assert header.lower() == "competitors mentioned", f"DEFECT D — header: {header!r}"

        # Top "Surfaced by AI:" chips also clean
        chips = await page.evaluate("""() => {
            const c = [...document.querySelectorAll('.competitor-chip')].map(x => x.textContent.trim().toLowerCase());
            return c.join(' | ');
        }""")
        leaked_chips = [t for t in noise_terms if t in chips]
        assert not leaked_chips, f"DEFECT D — noise in 'Surfaced by AI' chips: {leaked_chips}"

        await page.screenshot(path="_scan_v14_all_fixed.png", full_page=True)
        print("OK — defects A + B + C + D all fixed")
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
