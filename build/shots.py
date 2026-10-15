"""Capture README screenshots headless: EN widget, AR widget, settings sheet."""
import asyncio
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch()
        except Exception as e:
            print("LAUNCH-FAIL", str(e)[:300])
            return
        page = await browser.new_page(viewport={"width": 560, "height": 700})
        await page.goto("http://127.0.0.1:3127/index.html")
        await page.evaluate("localStorage.clear();")
        await page.reload()
        await page.wait_for_selector("#timeline .t-cell", timeout=30000)
        await page.wait_for_timeout(1500)
        el = await page.query_selector(".stage")
        await el.screenshot(path="docs/screenshot-en.png")
        print("en ok")
        # Arabic RTL view
        await page.click("#btnSettings")
        await page.select_option("#inLang", "ar")
        await page.click("#btnSave")
        await page.wait_for_timeout(2000)
        await el.screenshot(path="docs/screenshot-ar.png")
        print("ar ok")
        # settings sheet (back to English for legibility)
        await page.click("#btnSettings")
        await page.select_option("#inLang", "en")
        await page.click("#btnSave")
        await page.wait_for_timeout(1000)
        await page.click("#btnSettings")
        await page.wait_for_timeout(600)
        await el.screenshot(path="docs/screenshot-settings.png")
        print("settings ok")
        await browser.close()


asyncio.run(main())
