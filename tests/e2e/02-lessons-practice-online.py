"""Browser regression test. Needs Python 3 + Playwright (pip install playwright && playwright install chromium).
Run from the project root:   python3 tests/e2e/02-lessons-practice-online.py
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
        ctx = await b.new_context(viewport={'width':1280,'height':900})
        errs=[]
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto(URL); await pg.click('#skip')
        await pg.click('[data-nav="learn"]'); await pg.wait_for_timeout(300)
        # lesson 3 step 1: move three times
        await pg.click('[data-l="2"]'); await pg.wait_for_timeout(200)
        for i in range(3):
            await pg.locator('#lv .b-target').first.click(); await pg.wait_for_timeout(250)
        print('move task:', (await pg.locator('#tstate').inner_text()), '| next enabled:', await pg.locator('#next').is_enabled())
        await pg.click('#next'); await pg.wait_for_timeout(250)
        await pg.screenshot(path=SHOTS+'/l_jump.png')
        # jump: the target with the jump = farthest up
        tg = pg.locator('#lv .b-target'); n = await tg.count(); print('jump targets', n)
        await tg.first.click(); await pg.wait_for_timeout(250)
        print('jump task:', await pg.locator('#tstate').inner_text())
        # legal lesson overlap
        await pg.click('[data-l="5"]'); await pg.wait_for_timeout(250)
        box = await pg.locator('#lv svg').bounding_box()
        # slot h(3,3): groove below row 3, centre between col 3 and 4  -> board units
        S = 9*100+8*16+144; unit = box['width']/S
        x = (72 + 3*116 + 100 + 8)*unit + box['x']; y = (72 + 3*116 + 100 + 8)*unit + box['y']
        await pg.mouse.move(x, y); await pg.mouse.click(x, y); await pg.wait_for_timeout(300)
        print('overlap task:', await pg.locator('#tstate').inner_text(), '|', await pg.locator('#ttext').inner_text())
        await pg.screenshot(path=SHOTS+'/l_legal.png')
        # walk through every lesson for errors
        for i in range(8):
            await pg.click(f'[data-l="{i}"]'); await pg.wait_for_timeout(150)
        await pg.screenshot(path=SHOTS+'/l_last.png')
        # practice board win via keyboard
        await pg.goto(URL); await pg.click('#skip')
        await pg.click('[data-nav="learn"]'); await pg.click('[data-nav="practice"]'); await pg.wait_for_timeout(300)
        await pg.locator('#board svg').focus()
        for i in range(8):
            await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(120)
            await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(120)
        await pg.wait_for_timeout(1000)
        print('winner dialog:', await pg.locator('.dialog h2').first.inner_text())
        await pg.screenshot(path=SHOTS+'/win.png')
        # Online between two tabs
        a = await ctx.new_page(); c = await ctx.new_page()
        for pgx in (a,c): pgx.on('pageerror', lambda e: errs.append('ONLINE PAGEERR '+str(e)))
        await a.goto(URL); await a.click('#skip'); await a.click('[data-nav="online"]'); await a.fill('#nm','Host'); await a.click('#create')
        await a.wait_for_timeout(300)
        code = (await a.locator('[aria-label^="Room code"]').inner_text()).strip()
        print('room', code)
        await c.goto(URL); await c.click('#skip'); await c.click('[data-nav="online"]'); await c.fill('#nm','Guest'); await c.fill('#code', code); await c.click('#join')
        await a.wait_for_timeout(1500)
        print('host sees:', await a.locator('#turn .who').inner_text(), '| guest sees:', await c.locator('#turn .who').inner_text())
        await a.locator('.b-target').first.click(); await a.wait_for_timeout(600)
        print('after host move -> guest:', await c.locator('#turn .who').inner_text(), '| log', await c.locator('#loglist li').all_inner_texts())
        # guest out-of-turn attempt is blocked
        await a.screenshot(path=SHOTS+'/online_host.png')
        # bad code
        d = await ctx.new_page(); await d.goto(URL); await d.click('#skip'); await d.click('[data-nav="online"]'); await d.fill('#code','ZZZZZ'); await d.click('#join'); await d.wait_for_timeout(4400)
        print('bad room error:', await d.locator('[role=alert]').inner_text())
        print('ERRORS:', errs or 'none')
        await b.close()
asyncio.run(main())
