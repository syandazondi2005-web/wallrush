"""Browser regression test. Needs Python 3 + Playwright (pip install playwright && playwright install chromium).
Run from the project root:   python3 tests/e2e/01-core-flows.py
Optional env: WR_URL (default: the local index.html), WR_SHOTS (screenshot folder, default test-output)."""
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = os.environ.get('WR_URL', ROOT.joinpath('index.html').as_uri())
SHOTS = os.environ.get('WR_SHOTS', str(ROOT / 'test-output'))
os.makedirs(SHOTS, exist_ok=True)
import asyncio, sys
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1280,'height':860})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' and 'fonts' not in m.text and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
        await pg.goto(URL)
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=SHOTS+'/s_loading.png')
        await pg.click('#skip')
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=SHOTS+'/s_menu.png')
        print('menu ok', await pg.locator('.door').count())
        # vs computer
        await pg.click('[data-nav="setup-ai"]')
        await pg.click('[data-lv="expert"]')
        await pg.click('#go')
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=SHOTS+'/s_game.png')
        print('targets', await pg.locator('.b-target').count())
        # move forward
        await pg.locator('.b-target').first.click()
        await pg.wait_for_timeout(2500)
        print('log', await pg.locator('#loglist li').all_inner_texts())
        # wall mode + hover
        await pg.click('#a-wall')
        box = await pg.locator('#board svg').bounding_box()
        await pg.mouse.move(box['x']+box['width']*0.5, box['y']+box['height']*0.45)
        await pg.wait_for_timeout(300)
        print('hint:', await pg.locator('#hint').inner_text())
        await pg.screenshot(path=SHOTS+'/s_wall_hover.png')
        await pg.mouse.click(box['x']+box['width']*0.5, box['y']+box['height']*0.45)
        await pg.wait_for_timeout(2500)
        print('log', await pg.locator('#loglist li').all_inner_texts())
        await pg.screenshot(path=SHOTS+'/s_after.png')
        # screens
        for nav in ['learn','rules','heritage','stats','settings','online','setup-local']:
            await pg.goto(URL)
            await pg.click('#skip'); await pg.wait_for_timeout(200)
            await pg.click(f'[data-nav="{nav}"]'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=SHOTS+f'/s_{nav}.png', full_page=False)
        # 4 player
        await pg.goto(URL); await pg.click('#skip')
        await pg.click('[data-nav="setup-local"]'); await pg.click('[data-k="local4"]'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=SHOTS+'/s_4p.png')
        # mobile
        m = await b.new_page(viewport={'width':390,'height':844}, has_touch=True, is_mobile=True)
        m.on('pageerror', lambda e: errs.append('MOBILE PAGEERR '+str(e)))
        await m.goto(URL); await m.click('#skip'); await m.wait_for_timeout(300)
        await m.screenshot(path=SHOTS+'/m_menu.png')
        await m.click('[data-nav="setup-local"]'); await m.click('[data-k="local2"]'); await m.wait_for_timeout(500)
        await m.screenshot(path=SHOTS+'/m_game.png')
        print('ERRORS:', errs or 'none')
        await b.close()
asyncio.run(main())
