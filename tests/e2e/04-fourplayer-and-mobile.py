"""Browser regression test. Needs Python 3 + Playwright (pip install playwright && playwright install chromium).
Run from the project root:   python3 tests/e2e/04-fourplayer-and-mobile.py
Optional env: WR_URL (default: the local index.html), WR_SHOTS (screenshot folder, default test-output)."""
import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = os.environ.get('WR_URL', ROOT.joinpath('index.html').as_uri())
SHOTS = os.environ.get('WR_SHOTS', str(ROOT / 'test-output'))
os.makedirs(SHOTS, exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs=[]
        # ---------- four-player full game through the real UI ----------
        pg = await b.new_page(viewport={'width':1280,'height':900})
        pg.on('pageerror', lambda e: errs.append('4P '+str(e)))
        await pg.goto(URL); await pg.click('#skip')
        await pg.evaluate("Store.set('wr.stats.v1', null)")
        await pg.click('[data-nav="setup-local"]'); await pg.click('[data-k="local4"]'); await pg.wait_for_timeout(400)
        print('4p cards:', await pg.locator('.pcard').count(), '| pawns on board:', await pg.locator('.pawn').count(), '| goal bands:', await pg.locator('[data-goal]').count())

        # out-of-turn pawn click is refused with a message
        await pg.locator('.pawn[data-pawn="1"]').click(force=True); await pg.wait_for_timeout(150)
        print('out-of-turn toast:', await pg.locator('#toast').inner_text())

        walls_ok = walls_refused = 0
        for turn in range(400):
            if await pg.evaluate('App.view.state.winner') >= 0:
                await pg.wait_for_timeout(900); break
            info = await pg.evaluate("""() => { const v = App.view, s = v.state; const F = fieldsFor(s); const me = s.turn;
                const ts = pawnMoves(s, me).map(t => ({r:t.r,c:t.c,d:F[me][t.r*s.n+t.c]})).sort((a,b)=>a.d-b.d);
                return { me, plies: s.plies, best: ts[0], ok: s.players.every((_,i)=>routeLength(s,i)>=0), walls: s.players.map(p=>p.walls) }; }""")
            if not info['ok']: errs.append('ROUTE BROKEN at ply %d' % info['plies']); break
            if turn % 4 == 3 and info['walls'][info['me']] > 0:
                # try a wall via keyboard on the board: wall mode, arrows, Enter
                await pg.click('#a-wall'); await pg.locator('#board svg').focus()
                for k in ['ArrowRight','ArrowDown','ArrowDown']: await pg.keyboard.press(k)
                if turn % 8 == 7: await pg.keyboard.press('r')
                before = (await pg.evaluate("App.view.state.plies"))
                await pg.keyboard.press('Enter'); await pg.wait_for_timeout(120)
                after = (await pg.evaluate("App.view.state.plies"))
                if after > before: walls_ok += 1
                else:
                    walls_refused += 1
                    await pg.click('#a-move')
                    await pg.evaluate("1")
                    info = await pg.evaluate("""() => { const v = App.view, s = v.state; const F = fieldsFor(s); const me = s.turn;
                        const ts = pawnMoves(s, me).map(t => ({r:t.r,c:t.c,d:F[me][t.r*s.n+t.c]})).sort((a,b)=>a.d-b.d); return { best: ts[0] }; }""")
                    await pg.locator(f'.b-target[data-r="{info["best"]["r"]}"][data-c="{info["best"]["c"]}"]').click()
                await pg.wait_for_timeout(60); continue
            t = info['best']
            loc = pg.locator(f'.b-target[data-r="{t["r"]}"][data-c="{t["c"]}"]')
            if await loc.count() == 0:
                dbg = await pg.evaluate("({mode: App.view.mode, turn: App.view.state.turn, paused: App.view.paused, over: App.view.over, thinking: App.view.thinking, canAct: App.view.canAct(), plies: App.view.state.plies, targets: App.view.targets().length, overlays: document.querySelectorAll('.overlay').length})")
                print('NO TARGET', t, dbg); break
            await loc.click()
            await pg.wait_for_timeout(40)
        won = await pg.locator('.overlay .dialog.win h2').count()
        print('4p finished:', bool(won), '| title:', (await pg.locator('.overlay .dialog.win h2').inner_text()) if won else None, '| walls placed:', walls_ok, 'refused:', walls_refused)
        await pg.screenshot(path=SHOTS+'/p4_end.png')
        print('stats saved:', json.dumps(await pg.evaluate("Stats.d.local4")))
        # rematch rotates first player, new game state
        await pg.click('#w-rematch'); await pg.wait_for_timeout(300)
        print('after rematch turn text:', await pg.locator('#turn .who').inner_text(), '| walls left cards:', await pg.locator('.pcard .pips b').all_inner_texts())

        # ---------- mobile / tablet / landscape ----------
        sizes = [('phone',390,844),('small',360,640),('tablet',768,1024),('landscape',844,390)]
        for name,w,h in sizes:
            ctx = await b.new_context(viewport={'width':w,'height':h}, has_touch=True, is_mobile=True, device_scale_factor=2)
            m = await ctx.new_page(); m.on('pageerror', lambda e, n=name: errs.append(n+' '+str(e)))
            await m.goto(URL); await m.click('#skip'); await m.wait_for_timeout(250)
            ov_menu = await m.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            await m.screenshot(path=SHOTS+f'/mob_{name}_menu.png')
            await m.click('[data-nav="setup-local"]'); await m.click('[data-k="local2"]'); await m.wait_for_timeout(300)
            ov_game = await m.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            small = await m.evaluate("""() => Array.from(document.querySelectorAll('button, .b-target')).filter(e => !e.hidden && e.offsetParent !== null && e.getBoundingClientRect().height>0).map(e => ({t:(e.textContent||'').trim().slice(0,18), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width})).filter(x => x.h < 44 || x.w < 44)""")
            bw = await m.evaluate("document.querySelector('#board').getBoundingClientRect().width")
            print(f'{name} {w}x{h}: h-overflow menu={ov_menu} game={ov_game} | board width={bw:.0f} | controls under 44px: {small or "none"}')
            if name == 'phone':
                # touch wall flow: tap groove -> preview -> confirm
                await m.tap('#a-wall'); await m.evaluate('window.scrollTo(0,0)'); await m.wait_for_timeout(200)
                box = await m.locator('#board svg').bounding_box(); u = box['width']/1172
                await m.touchscreen.tap(box['x']+528*u, box['y']+528*u); await m.wait_for_timeout(250)
                print('  touch preview hint:', await m.locator('#hint').inner_text(), '| confirm enabled:', await m.locator('#a-ok').is_enabled(), '| plies still', await m.evaluate("App.view.state.plies"))
                await m.screenshot(path=SHOTS+'/mob_phone_preview.png')
                await m.tap('#a-ok'); await m.wait_for_timeout(300)
                print('  after confirm plies:', await m.evaluate("App.view.state.plies"), '| turn:', await m.locator('#turn .who').inner_text())
                # invalid tap: same place now overlaps
                await m.tap('#a-wall'); await m.evaluate('window.scrollTo(0,0)'); await m.wait_for_timeout(200)
                box = await m.locator('#board svg').bounding_box()
                await m.touchscreen.tap(box['x']+528*u, box['y']+528*u); await m.wait_for_timeout(250)
                print('  invalid preview:', await m.locator('#hint').inner_text(), '| confirm enabled:', await m.locator('#a-ok').is_enabled())
                await m.screenshot(path=SHOTS+'/mob_phone_invalid.png')
            if name == 'landscape': await m.screenshot(path=SHOTS+'/mob_landscape_game.png')
            if name == 'tablet': await m.screenshot(path=SHOTS+'/mob_tablet_game.png')
            await ctx.close()
        print('ERRORS:', errs or 'none')
        await b.close()
asyncio.run(main())
