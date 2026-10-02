"""Browser regression test. Needs Python 3 + Playwright (pip install playwright && playwright install chromium).
Run from the project root:   python3 tests/e2e/05-credit-labels-online.py
Optional env: WR_URL (default: the local index.html), WR_SHOTS (screenshot folder, default test-output)."""
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = os.environ.get('WR_URL', ROOT.joinpath('index.html').as_uri())
SHOTS = os.environ.get('WR_SHOTS', str(ROOT / 'test-output'))
os.makedirs(SHOTS, exist_ok=True)
import asyncio
from playwright.async_api import async_playwright
errs=[]
async def credit_report(pg, label):
    r = await pg.evaluate("""() => { const vis = e => e.offsetParent !== null && e.getBoundingClientRect().width > 0;
      const t = Array.from(document.querySelectorAll('.lockup .t')).filter(vis), b = Array.from(document.querySelectorAll('.lockup .by')).filter(vis);
      const sz = e => parseFloat(getComputedStyle(e).fontSize);
      return { titles: t.length, credits: b.length, text: b.map(e => e.textContent.trim()), titleSize: t[0] ? sz(t[0]) : 0, creditSize: b[0] ? sz(b[0]) : 0,
               below: t[0] && b[0] ? b[0].getBoundingClientRect().top >= t[0].getBoundingClientRect().bottom - 2 : null }; }""")
    ok = r['titles'] == r['credits'] and all(x == 'by Zondi' for x in r['text']) and (r['titles'] == 0 or (r['creditSize'] >= 11 and r['creditSize'] < r['titleSize'] / 2 and r['below']))
    print(f"  credit [{label}]: titles={r['titles']} credits={r['credits']} size {r['creditSize']:.1f}px vs title {r['titleSize']:.0f}px below={r['below']} -> {'OK' if ok else 'PROBLEM'}")
    if not ok: errs.append('credit problem '+label)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, vp, mob in [('desktop', {'width':1280,'height':860}, False), ('phone', {'width':390,'height':844}, True)]:
            print('==', name)
            ctx = await b.new_context(viewport=vp, has_touch=mob, is_mobile=mob)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e, n=name: errs.append(n+' '+str(e)))
            await pg.goto(URL); await pg.wait_for_timeout(500); await credit_report(pg, 'loading')
            await pg.click('#skip'); await pg.wait_for_timeout(250); await credit_report(pg, 'menu')
            for nav in ['setup-ai','setup-local','online','learn','rules','heritage','stats','settings']:
                await pg.goto(URL); await pg.click('#skip'); await pg.click(f'[data-nav="{nav}"]'); await pg.wait_for_timeout(200)
                await credit_report(pg, nav)
            await pg.goto(URL); await pg.click('#skip'); await pg.click('[data-nav="setup-ai"]'); await pg.click('#go'); await pg.wait_for_timeout(300); await credit_report(pg, 'game')
            await ctx.close()

        ctx = await b.new_context(viewport={'width':1280,'height':900})
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append('X '+str(e)))
        await pg.goto(URL); await pg.click('#skip'); await pg.click('[data-nav="rules"]')
        print('== labels')
        print('  rules provisional banner:', 'provisional' in (await pg.locator('.notice').first.inner_text()).lower(), '|', (await pg.locator('.notice').first.inner_text())[:60].replace('\n',' '))
        await pg.goto(URL); await pg.click('#skip'); await pg.click('[data-nav="heritage"]')
        h = await pg.locator('.herit .card').first.inner_text()
        print('  heritage documented:', h.replace('\n',' | ')[:150])
        print('  invented history check: documented list entries =', await pg.evaluate("WR_CONFIG.heritage.documented.length"))
        await pg.goto(URL); await pg.click('#skip'); await pg.click('[data-nav="online"]')
        t = (await pg.locator('main').inner_text()).replace('\n',' ')
        for needle in ['Internet multiplayer is not available yet','Same-device test','TEST ONLY','NOT AVAILABLE YET','not internet play']:
            print(f'  online text has "{needle}":', needle.lower() in t.lower())
        print('  internet option disabled:', await pg.locator('[data-cm="server"]').is_disabled())
        print('  menu door text:', (await (await (await ctx.new_page()).goto(URL)) .text() if False else ''), end='')
        # ---------- same-device test match, two tabs, to completion ----------
        await pg.evaluate("Store.set('wr.stats.v1', null)")
        await pg.fill('#nm','Host'); await pg.click('#create'); await pg.wait_for_timeout(300)
        print('  hosting text:', (await pg.locator('main .card').inner_text()).replace('\n',' ')[-190:])
        code = (await pg.locator('[aria-label^="Room code"]').inner_text()).strip()
        g = await ctx.new_page(); g.on('pageerror', lambda e: errs.append('G '+str(e)))
        await g.goto(URL); await g.click('#skip'); await g.click('[data-nav="online"]'); await g.fill('#nm','Guest'); await g.fill('#code', code); await g.click('#join')
        await pg.wait_for_timeout(1500)
        print('  in-game badge host/guest:', await pg.locator('#g-conn').inner_text(), '/', await g.locator('#g-conn').inner_text())
        pages = [pg, g]
        for i in range(40):
            if await pg.evaluate('App.view.state.winner') >= 0: break
            seat = await pg.evaluate('App.view.state.turn'); cur = pages[seat]
            t = await cur.evaluate("""() => { const v = App.view, s = v.state, F = fieldsFor(s), me = s.turn;
                return pawnMoves(s, me).map(t => ({r:t.r,c:t.c,d:F[me][t.r*s.n+t.c]})).sort((a,b)=>a.d-b.d)[0]; }""")
            await cur.locator(f'.b-target[data-r="{t["r"]}"][data-c="{t["c"]}"]').click(); await pg.wait_for_timeout(120)
        await pg.wait_for_timeout(1000)
        dlg = await pg.locator('.overlay .dialog.win').inner_text()
        print('  tab match finished; dialog:', dlg.replace('\n',' | ')[:170])
        print('  guest also sees result:', (await g.locator('.overlay .dialog.win h2').inner_text()))
        print('  stats after tab match (should be unchanged/zero):', await pg.evaluate("JSON.stringify(Stats.d.online)"))
        await pg.screenshot(path=SHOTS+'/final_online_end.png')
        await ctx.close()
        print('ERRORS:', errs or 'none')
        await b.close()
asyncio.run(main())
