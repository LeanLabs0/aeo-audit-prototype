"""Verify SSE progress UI — real phase updates land on the stepped loader."""
import asyncio
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8766/scan.html?v=20260529"
TARGET = "https://www.leanlabs.com/solutions/growth-driven-design"


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()
        await page.goto(URL, wait_until="domcontentloaded")
        await page.fill("#scanUrl", TARGET)
        await page.click(".scan-submit")

        # Wait for loader to appear
        await page.wait_for_selector("#scanSteps", timeout=10_000)

        # Initial state — all steps pending
        initial = await page.evaluate("""() => {
          const steps = [...document.querySelectorAll('.scan-step')];
          return steps.map(s => ({ done: s.classList.contains('done'), active: s.classList.contains('active') }));
        }""")
        assert all(not s["done"] and not s["active"] for s in initial), f"steps should start pending: {initial}"

        # Wait for at least one step to become active
        await page.wait_for_function("""() => {
          return [...document.querySelectorAll('.scan-step.active')].length > 0;
        }""", timeout=30_000)

        # Wait for progress bar to advance past 10%
        await page.wait_for_function("""() => {
          const fill = document.getElementById('scanProgressFill');
          if (!fill) return false;
          const pct = parseFloat(fill.style.width);
          return pct >= 10;
        }""", timeout=60_000)

        # Wait for the scan to complete and the results to render
        await page.wait_for_selector("#categoryDetails .check-group", timeout=180_000)

        # Confirm loader is gone (results screen replaced state)
        loader_visible = await page.evaluate(
            "() => !!document.querySelector('.state-card--loading') && !document.getElementById('scanState').hasAttribute('hidden')"
        )
        assert not loader_visible, "loader still visible after scan completed"

        # Confirm 4 category groups rendered (sanity check that final result landed)
        group_count = await page.evaluate(
            "() => document.querySelectorAll('#categoryDetails .check-group').length"
        )
        assert group_count == 4, f"expected 4 groups, got {group_count}"

        await page.screenshot(path="_scan_v16_progress.png", full_page=True)
        print("OK — SSE progress verified")
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
