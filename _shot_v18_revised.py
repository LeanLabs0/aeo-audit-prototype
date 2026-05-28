"""Verify revised CF parity — gradient CTAs back + per-LLM tables."""
import asyncio
from playwright.async_api import async_playwright  # ty: ignore[unresolved-import]

URL = "http://127.0.0.1:8766/scan.html?v=20260531"
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

        # Block-level: gradient CTAs back
        cta_band = await page.evaluate("() => !!document.querySelector('.cta-band')")
        assert cta_band, "mid .cta-band missing"
        footer_cta = await page.evaluate("() => !!document.querySelector('.footer-cta')")
        assert footer_cta, "bottom .footer-cta missing"

        # Ghost footer + disclaimer gone
        results_footer = await page.evaluate("() => !!document.querySelector('.results-footer')")
        assert not results_footer, ".results-footer should be deleted"
        ghost = await page.evaluate("() => !!document.querySelector('.ghost-btn')")
        assert not ghost, "ghost button should be gone"

        # Per-LLM tables: 3 inside AI Citations group
        engine_tables = await page.evaluate("""() => {
          const groups = [...document.querySelectorAll('#categoryDetails .check-group')];
          const ai = groups.find(g => /ai citations/i.test(g.querySelector('.check-group-name').textContent));
          if (!ai) return { found: false };
          const blocks = ai.querySelectorAll('.engine-table-block');
          const titles = [...blocks].map(b => b.querySelector('.engine-table-title')?.textContent?.trim() || '');
          return { found: true, count: blocks.length, titles };
        }""")
        assert engine_tables["found"], "AI Citations group missing"
        assert engine_tables["count"] == 3, f"expected 3 engine tables, got {engine_tables}"
        assert engine_tables["titles"] == ["ChatGPT", "Claude", "Gemini"], f"titles wrong: {engine_tables['titles']}"

        # Improve CTA still present (Task 3 kept)
        improve = await page.evaluate("() => !!document.querySelector('.improve-cta')")
        assert improve, "Improve CTA missing"

        # LEVEL pill still present (Task 2)
        level = await page.evaluate("() => !!document.querySelector('.level-pill')")
        assert level, "LEVEL pill missing"

        await page.screenshot(path="_scan_v18_revised.png", full_page=True)
        print("OK — revisions verified")
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
