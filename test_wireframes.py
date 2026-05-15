"""Screenshot all 5 wireframes for Kevin/Jonathan review."""
from playwright.sync_api import sync_playwright

PAGES = [
    ("index.html", "_wf_index.png"),
    ("01-where-you-stand.html", "_wf_01_where_you_stand.png"),
    ("02-what-buyers-see.html", "_wf_02_what_buyers_see.png"),
    ("03-what-we-found.html", "_wf_03_what_we_found.png"),
    ("04-math-and-options.html", "_wf_04_math_and_options.png"),
]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        for url_path, out_path in PAGES:
            page.goto(f"http://localhost:8765/wireframes/{url_path}", wait_until="networkidle")
            page.screenshot(
                path=f"C:/Users/Sistemas/aeo-audit-prototype/{out_path}",
                full_page=True,
            )
            print(f"{url_path} -> {out_path}")
        browser.close()


if __name__ == "__main__":
    main()
