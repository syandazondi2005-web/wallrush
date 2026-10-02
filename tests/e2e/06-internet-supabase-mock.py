"""Tests the Supabase internet-play wiring WITHOUT a real Supabase project.
The Supabase library and the config file are replaced by test doubles, so this proves the game's own
connector, lobby, room flow and error messages work. It cannot prove your real project is set up correctly.
Run:  python3 tests/e2e/06-internet-supabase-mock.py   (needs Playwright, see README)"""
import asyncio, os, pathlib, threading, functools, http.server
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
class Quiet(handler.func):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/index.html'

FAKE_LIB = """window.supabase = { createClient(url, key) {
  window.__fakeArgs = { url, key };
  return {
    channel(topic) { const bc = new BroadcastChannel('fake:' + topic); let h; const ch = {
      on(type, filter, cb) { h = cb; return ch; },
      subscribe(cb) { bc.onmessage = e => h && h({ payload: e.data }); setTimeout(() => cb('%STATUS%'), 30); return ch; },
      send(m) { bc.postMessage(m.payload); return Promise.resolve('ok'); }, _bc: bc }; return ch; },
    removeChannel(ch) { ch._bc.close(); } }; } };"""

errs = []
async def setup(ctx, status='SUBSCRIBED', lib=True, configured=True):
    async def cfg(route):
        r = await route.fetch(); body = await r.text()
        if configured: body = body.replace("supabase: { url: '', anonKey: '' }", "supabase: { url: 'https://example-project.supabase.co', anonKey: 'public-test-key' }")
        await route.fulfill(response=r, body=body)
    await ctx.route('**/src/config.js', cfg)
    if lib: await ctx.route('**/npm/@supabase/supabase-js@2', lambda r: r.fulfill(content_type='application/javascript', body=FAKE_LIB.replace('%STATUS%', status)))
    else: await ctx.route('**/npm/@supabase/supabase-js@2', lambda r: r.abort())

async def lobby(pg):
    await pg.goto(URL); await pg.click('#skip'); await pg.click('[data-nav="online"]'); await pg.wait_for_timeout(200)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- A: configured, full internet-style match through the connector ----
        ctx = await b.new_context(viewport={'width':1280,'height':900}); await setup(ctx)
        a = await ctx.new_page(); g = await ctx.new_page()
        for x in (a, g): x.on('pageerror', lambda e: errs.append('A ' + str(e)))
        await lobby(a)
        t = (await a.locator('main').inner_text()).lower()
        print('A internet option enabled & default:', not await a.locator('[data-cm="server"]').is_disabled(), '| selected:', await a.locator('[data-cm="server"]').get_attribute('aria-pressed'))
        print('A "not available yet" notice gone:', 'not available yet' not in t, '| test-mode notice hidden:', 'matches in this mode are not added' not in t)
        await a.fill('#nm', 'Host'); await a.click('#create'); await a.wait_for_timeout(500)
        code = (await a.locator('[aria-label^="Room code"]').inner_text()).strip()
        await lobby(g); await g.fill('#nm', 'Guest'); await g.fill('#code', code); await g.click('#join'); await a.wait_for_timeout(1800)
        print('A both in game:', await a.locator('#turn .who').inner_text(), '/', await g.locator('#turn .who').inner_text(), '| badge:', await a.locator('#g-conn').inner_text())
        print('A key/url reached the library:', await a.evaluate('JSON.stringify(window.__fakeArgs)'))
        await a.evaluate("Store.set('wr.stats.v1', null); Stats.load()"); await g.evaluate("Store.set('wr.stats.v1', null); Stats.load()")
        pages = [a, g]
        for i in range(40):
            if await a.evaluate('App.view.state.winner') >= 0: break
            seat = await a.evaluate('App.view.state.turn'); cur = pages[seat]
            m = await cur.evaluate("""() => { const s = App.view.state, F = fieldsFor(s), me = s.turn;
                return pawnMoves(s, me).map(t => ({r:t.r,c:t.c,d:F[me][t.r*s.n+t.c]})).sort((x,y)=>x.d-y.d)[0]; }""")
            await cur.locator(f'.b-target[data-r="{m["r"]}"][data-c="{m["c"]}"]').click(); await a.wait_for_timeout(120)
        await a.wait_for_timeout(1000)
        da = await a.locator('.overlay .dialog.win').inner_text(); dg = await g.locator('.overlay .dialog.win h2').inner_text()
        print('A match finished | host:', da.split('\n')[0], '| guest:', dg, '| says same-device test:', 'Same-device' in da)
        print('A stats recorded (real internet mode):', await a.evaluate('JSON.stringify(Stats.d.online)'), '/', await g.evaluate('JSON.stringify(Stats.d.online)'))
        await ctx.close()
        # ---- B: library cannot be loaded ----
        ctx = await b.new_context(); await setup(ctx, lib=False); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append('B ' + str(e)))
        await lobby(pg); await pg.click('#create'); await pg.wait_for_timeout(600)
        print('B library blocked ->', (await pg.locator('[role=alert]').inner_text()).replace('\n', ' '))
        await ctx.close()
        # ---- C: service refuses the channel (e.g. public access disabled) ----
        ctx = await b.new_context(); await setup(ctx, status='CHANNEL_ERROR'); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append('C ' + str(e)))
        await lobby(pg); await pg.click('#create'); await pg.wait_for_timeout(600)
        print('C channel refused ->', (await pg.locator('[role=alert]').inner_text()).replace('\n', ' '))
        await ctx.close()
        # ---- D: not configured stays disabled ----
        ctx = await b.new_context(); await setup(ctx, configured=False); pg = await ctx.new_page()
        await lobby(pg)
        print('D unconfigured: internet disabled =', await pg.locator('[data-cm="server"]').is_disabled(), '| default mode =', await pg.locator('[data-cm="tab"]').get_attribute('aria-pressed') == 'true' and 'same-device test')
        await ctx.close()
        print('ERRORS:', errs or 'none')
        await b.close()
asyncio.run(main())
