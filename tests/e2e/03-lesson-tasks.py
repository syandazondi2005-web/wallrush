"""Browser regression test. Needs Python 3 + Playwright (pip install playwright && playwright install chromium).
Run from the project root:   python3 tests/e2e/03-lesson-tasks.py
Optional env: WR_URL (default: the local index.html), WR_SHOTS (screenshot folder, default test-output)."""
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = os.environ.get('WR_URL', ROOT.joinpath('index.html').as_uri())
SHOTS = os.environ.get('WR_SHOTS', str(ROOT / 'test-output'))
os.makedirs(SHOTS, exist_ok=True)
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1280,'height':1000})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.click('#skip'); await pg.click('[data-nav="learn"]')
        async def at(x,y):
            box = await pg.locator('#lv svg').bounding_box(); u = box['width']/1172
            await pg.mouse.move(box['x']+x*u, box['y']+y*u); await pg.mouse.click(box['x']+x*u, box['y']+y*u); await pg.wait_for_timeout(250)
        async def state(): return (await pg.locator('#tstate').inner_text()) + ' | ' + (await pg.locator('#ttext').inner_text())
        await pg.click('[data-l="3"]'); await pg.wait_for_timeout(200)
        await at(528,296+0)   # wall in front of Sky: groove below row 0 -> y = ty(0)+108 = 180
        print('wall(any pos):', await state())
        await pg.click('#l-reset'); await at(528,180); print('wall in front of Sky:', await state())
        await pg.click('[data-l="4"]'); await pg.wait_for_timeout(200)
        await at(528,528); print('overlap:', await state())
        await pg.click('#next'); await pg.wait_for_timeout(200)
        await pg.click('#l-rot'); await at(528,528); print('cross:', await state())
        await pg.click('#next'); await pg.wait_for_timeout(200)
        await at(528,296); print('trap:', await state())
        await pg.click('[data-l="5"]'); await pg.wait_for_timeout(200)
        await at(644,644); print('blocking:', await state())
        await pg.click('[data-l="6"]'); await pg.wait_for_timeout(200)
        await pg.click('[data-q="0"]'); print('quiz wrong:', await pg.locator('#qres').inner_text())
        await pg.click('[data-q="1"]'); print('quiz right:', await pg.locator('#qres').inner_text())
        await at(412,644); print('planning:', await state())
        await pg.screenshot(path=SHOTS+'/l_plan.png')
        print('ERRORS:', errs or 'none')
        await b.close()
asyncio.run(main())
