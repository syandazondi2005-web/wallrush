/* =====================================================================
   WALL RUSH — APP: router + screens
   ===================================================================== */

const ICONS = {
  ai: '<path d="M6 8h12v9H6z M9 8V5h6v3 M9 12h.01 M15 12h.01 M9 20v-3 M15 20v-3"/>',
  local: '<circle cx="8" cy="9" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M2.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5 M14 19c.4-2.2 1.8-3.4 3.6-3.4 1.900 0 3.100 1.200 3.500 3.400"/>',
  online: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18"/>',
  learn: '<path d="M3 6l9-3 9 3-9 3z M7 9v5c0 1.500 2.300 3 5 3s5-1.500 5-3V9 M21 6v6"/>',
  rules: '<path d="M6 3h9l4 4v14H6z M15 3v4h4 M9 12h7 M9 16h7"/>',
  heritage: '<path d="M3 21h18 M5 21V10 M9 21V10 M15 21V10 M19 21V10 M2 10l10-7 10 7z"/>',
  stats: '<path d="M4 20V10 M10 20V4 M16 20v-7 M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2"/>'
};
const ico = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const App = {
  view: null, current: null, params: {},

  go(name, params = {}, push = true) {
    if (this.view && this.view.destroy) this.view.destroy();
    this.view = null; this.current = name; this.params = params;
    $$('.overlay').forEach(o => o.remove());
    const root = $('#app');
    window.scrollTo(0, 0);
    const fn = this.screens[name] || this.screens.menu;
    root.innerHTML = '';
    const sc = document.createElement('div');
    sc.className = 'screen ' + name;
    root.appendChild(sc);
    fn.call(this, sc, params);
    if (push) { try { history.pushState({ s: name }, ''); } catch (e) { /* sandboxed */ } }
    const h = $('h2, h1', sc); if (h && name !== 'game') { h.setAttribute('tabindex', '-1'); }
  },

  topbar(title, back = 'menu', extra = '') {
    return `<header class="topbar"><button class="btn ghost" data-nav="${back}" aria-label="Back">← Back</button>${lockup('sm')}<span class="spacer"></span>${extra}</header>`;
  },
  wireNav(root) {
    $$('[data-nav]', root).forEach(b => { b.onclick = () => this.go(b.dataset.nav, b.dataset.params ? JSON.parse(b.dataset.params) : {}); });
  },

  screens: {
    /* ---------- loading / title ---------- */
    loading(sc) {
      sc.innerHTML = `<div class="loading" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;gap:1.6rem;text-align:center;padding:1rem">
        ${lockup('lg')}<div class="meter" role="progressbar" aria-label="Loading"><i></i></div><p>Setting the stones…</p>
        <button class="btn ghost" id="skip">Skip</button></div>`;
      const done = () => { clearTimeout(t); App.go('menu', {}, false); };
      const t = setTimeout(done, 1500);
      $('#skip', sc).onclick = done;
    },

    /* ---------- main menu ---------- */
    menu(sc) {
      const door = (nav, icon, n, d, cls = '') => `<button class="door ${cls}" data-nav="${nav}">${ico(icon)}<span class="n">${n}</span><span class="d">${d}</span></button>`;
      sc.innerHTML = `<main class="menu-grid">
        <section class="menu-hero">${lockup('lg')}
          <p class="tagline">Traditional knowledge, redesigned for a new generation.</p>
          <p class="sub">A game of paths and barriers from the Indigenous Games System. Reach the far edge before your rival does, and build walls to slow them down.</p></section>
        <nav class="doors" aria-label="Main menu">
          ${door('setup-ai', 'ai', 'Play vs Computer', 'Face the Advanced or Expert opponent', 'feature')}
          ${door('setup-local', 'local', 'Local multiplayer', 'Two or four players, one device')}
          ${door('online', 'online', 'Online', 'Internet play not connected yet; same-device test only')}
          ${door('learn', 'learn', 'Learn Wall Rush', 'Interactive lessons and practice')}
          ${door('rules', 'rules', 'Rules', 'Provisional ruleset, all on one page')}
          ${door('heritage', 'heritage', 'About / History', 'Heritage and cultural context')}
          ${door('stats', 'stats', 'Statistics', 'Your record and best results')}
          ${door('settings', 'settings', 'Settings', 'Sound, theme and display')}
        </nav></main>`;
      App.wireNav(sc);
      const first = $('.door', sc); if (first && !isCoarse()) first.focus({ preventScroll: true });
    },

    /* ---------- vs computer setup ---------- */
    'setup-ai'(sc) {
      const cfg = { level: Store.get('wr.lastLevel', 'advanced'), first: 0 };
      const draw = () => {
        sc.innerHTML = `${App.topbar()}<main class="page"><h2>Play vs Computer</h2><p class="lede">You play Gold, the diamond, from the bottom edge. The computer plays Sky, the hexagon, from the top.</p>
          <div class="setup-group"><h3>Difficulty</h3><div class="choices" role="group" aria-label="Difficulty">
            <button class="choice" data-lv="advanced" aria-pressed="${cfg.level === 'advanced'}"><span class="n">Advanced <span class="check">✓ Selected</span></span><span class="d">Reads routes and blocks with purpose. Adapts to how you play and sometimes slips. Challenging but beatable.</span></button>
            <button class="choice" data-lv="expert" aria-pressed="${cfg.level === 'expert'}"><span class="n">Expert <span class="check">✓ Selected</span></span><span class="d">Searches several moves ahead, expects your replies, weighs alternative routes and rations its walls. Far harder.</span></button></div></div>
          <div class="setup-group"><h3>Who moves first</h3><div class="choices" role="group" aria-label="First move">
            <button class="choice" data-first="0" aria-pressed="${cfg.first === 0}"><span class="n">You <span class="check">✓ Selected</span></span><span class="d">Take the opening move.</span></button>
            <button class="choice" data-first="1" aria-pressed="${cfg.first === 1}"><span class="n">Computer <span class="check">✓ Selected</span></span><span class="d">Let the computer open.</span></button></div></div>
          <div class="row"><button class="btn primary" id="go">Start match</button><button class="btn ghost" data-nav="learn">New here? Learn first</button></div></main>`;
        App.wireNav(sc);
        $$('[data-lv]', sc).forEach(b => b.onclick = () => { cfg.level = b.dataset.lv; Store.set('wr.lastLevel', cfg.level); draw(); $(`[data-lv="${cfg.level}"]`, sc).focus(); });
        $$('[data-first]', sc).forEach(b => b.onclick = () => { cfg.first = +b.dataset.first; draw(); $(`[data-first="${cfg.first}"]`, sc).focus(); });
        $('#go', sc).onclick = () => App.go('game', { kind: 'ai', level: cfg.level, first: cfg.first });
      };
      draw();
    },

    /* ---------- local setup ---------- */
    'setup-local'(sc) {
      sc.innerHTML = `${App.topbar()}<main class="page"><h2>Local multiplayer</h2><p class="lede">Everyone plays on this device and passes it between turns. Each player has their own colour, shape and mark.</p>
        <div class="choices">
          <button class="choice" data-k="local2"><span class="n">Two players</span><span class="d">The two-player board. ${RULES.modes[2].wallsEach} walls each. Gold ${pawnIcon(0, 'pawn-ico').replace('class="pawn-ico"', 'width="24" height="24" style="vertical-align:middle"')} against Sky ${pawnIcon(1, 'pawn-ico').replace('class="pawn-ico"', 'width="24" height="24" style="vertical-align:middle"')}.</span></button>
          <button class="choice" data-k="local4"><span class="n">Four players</span><span class="d">The four-player board with a goal edge for each side. ${RULES.modes[4].wallsEach} walls each. Turns run clockwise: Gold, Sky, Jade, Rose.</span></button></div></main>`;
      App.wireNav(sc);
      $$('[data-k]', sc).forEach(b => b.onclick = () => App.go('game', { kind: b.dataset.k }));
    },

    /* ---------- game ---------- */
    game(sc, p) {
      App.view = new GameView(sc, p);
    },

    /* ---------- practice board ---------- */
    practice(sc) {
      App.view = new GameView(sc, { kind: 'practice' });
      toast('Practice board: unlimited walls, and every action can be undone.');
    },

    /* ---------- online lobby ---------- */
    online(sc) {
      const serverOk = !!WR_CONFIG.online.endpoint || SupabaseTransport.available();
      const st = { mode: serverOk ? 'server' : (TabTransport.supported() ? 'tab' : 'server'), phase: 'idle', code: '', err: '', name: Store.get('wr.name', '') };
      let client = null, joinTimer = 0;
      const cleanup = () => { clearTimeout(joinTimer); if (client) { client.close(); client = null; } };
      sc.destroyHook = cleanup;
      App.view = { destroy: () => { if (client && st.phase !== 'started') cleanup(); } };

      const connectionChoice = () => `<div class="setup-group"><h3>Connection type</h3><div class="choices" role="group" aria-label="Connection type">
          <button class="choice" data-cm="tab" aria-pressed="${st.mode === 'tab'}" ${TabTransport.supported() ? '' : 'disabled'}><span class="n">Same-device test <span class="tag interp" style="font-size:.7rem">TEST ONLY</span><span class="check">✓ Selected</span></span><span class="d">Checks the room flow between two tabs of this browser on this device. This is <b>not internet play</b>: nobody on another device can join.</span></button>
          <button class="choice" data-cm="server" aria-pressed="${st.mode === 'server'}" ${serverOk ? '' : 'disabled'}><span class="n">Internet multiplayer ${serverOk ? '' : '<span class="tag" style="font-size:.7rem;color:var(--bad)">NOT AVAILABLE YET</span>'}<span class="check">✓ Selected</span></span><span class="d">${serverOk ? 'Play a remote opponent on another device through the room server.' : 'No room server is connected yet, so remote opponents cannot join. The interface is ready for one.'}</span></button></div></div>`;

      const draw = () => {
        let body = '';
        if (st.phase === 'idle') {
          body = `<p class="lede">Two-player rooms. The host plays Gold and moves first; the guest plays Sky. Both boards validate every move.</p>
            ${!serverOk ? '<div class="notice"><span aria-hidden="true">ⓘ</span><span><b>Internet multiplayer is not available yet.</b> No room server is connected, so you cannot play someone on another device. The same-device test below only checks the room flow between two tabs of this browser. It is not remote play.</span></div>' : ''}
            ${st.mode === 'tab' ? '<div class="notice" style="border-style:solid"><span aria-hidden="true">⚠</span><span><b>Same-device test selected.</b> Matches in this mode are not added to your statistics.</span></div>' : ''}
            ${connectionChoice()}
            <div class="field"><label for="nm">Your name</label><input id="nm" type="text" maxlength="14" value="${esc(st.name)}" placeholder="Guest" autocomplete="nickname"></div>
            ${st.err ? `<div class="notice" role="alert" style="border-color:var(--bad)"><span aria-hidden="true">✕</span><span>${esc(st.err)}</span></div>` : ''}
            <div class="setup-group"><div class="row"><button class="btn primary" id="create">Create room</button></div></div>
            <div class="setup-group"><h3>Join a room</h3><div class="field"><label for="code">Room code</label><input id="code" class="code-input" type="text" maxlength="5" inputmode="text" autocapitalize="characters" autocomplete="off" placeholder="•••••" aria-describedby="codehelp"><small id="codehelp">Ask the host for their five-character code.</small></div>
            <button class="btn" id="join">Join room</button></div>`;
        } else if (st.phase === 'hosting') {
          body = `<div class="card" style="text-align:center;max-width:520px"><span class="conn wait"><i></i><span>Waiting for an opponent${st.mode === 'tab' ? ' (second tab)' : ''}</span></span>
            <p style="margin:1rem 0 .2rem;color:var(--ink-dim)">Room code</p><div style="font-family:var(--font-display);font-weight:900;font-size:3.6rem;letter-spacing:.25em;padding-left:.25em" aria-label="Room code ${st.code.split('').join(' ')}">${st.code}</div>
            <div class="row" style="justify-content:center;margin-top:.6rem"><button class="btn" id="copy">Copy code</button><button class="btn ghost" id="cancel">Cancel room</button></div>
            <p style="color:var(--ink-dim);margin-top:1rem;font-size:.92rem">${st.mode === 'tab' ? '<b>Same-device test room.</b> Open this page in another tab of this browser, choose Online, then Join room with this code. People on other devices cannot join this room.' : 'Share this code with your opponent.'}</p></div>`;
        } else if (st.phase === 'joining') {
          body = `<div class="card" style="text-align:center;max-width:520px"><span class="conn wait"><i></i><span>Connecting to room ${esc(st.code)}…</span></span><div class="row" style="justify-content:center;margin-top:1rem"><button class="btn ghost" id="cancel">Cancel</button></div></div>`;
        }
        sc.innerHTML = `${App.topbar()}<main class="page"><h2>Online</h2>${body}</main>`;
        App.wireNav(sc);
        wire();
      };

      const start = (seat, peerName, first) => {
        st.phase = 'started';
        const c = client; client = null;
        App.go('game', { kind: 'online', first, online: { seat, peerName, client: c, room: st.code, mode: st.mode } });
      };

      const open = async (code, hosting) => {
        const name = ($('#nm', sc) ? $('#nm', sc).value.trim() : st.name) || 'Guest';
        st.name = name; Store.set('wr.name', name); st.code = code; st.err = '';
        try {
          const tr = st.mode === 'tab' ? new TabTransport(code) : (SupabaseTransport.available() ? new SupabaseTransport(WR_CONFIG.online.supabase, code) : new SocketTransport(WR_CONFIG.online.endpoint, code));
          await tr.open();
          client = new RoomClient(tr, code, name);
        } catch (e) { st.phase = 'idle'; st.err = 'Could not connect: ' + (e.message || 'unknown error') + ' Check your connection and try again.'; draw(); return; }
        if (hosting) {
          st.phase = 'hosting'; draw();
          let peer = null;
          client.onLobby = m => {
            if (m.t === 'join') {
              if (peer) { client.send({ t: 'full', to: m.from }); return true; }
              peer = m.from;
              client.send({ t: 'welcome', to: m.from, hostName: name, guestName: m.name, first: 0 });
              client.startHeartbeat();
              start(0, m.name || 'Guest', 0);
              return true;
            }
            return false;
          };
        } else {
          st.phase = 'joining'; draw();
          client.onLobby = m => {
            if (m.t === 'welcome' && m.to === client.id) { clearTimeout(joinTimer); client.startHeartbeat(); start(1, m.hostName || 'Host', m.first || 0); return true; }
            if (m.t === 'full' && m.to === client.id) { clearTimeout(joinTimer); cleanup(); st.phase = 'idle'; st.err = 'That room already has two players.'; draw(); return true; }
            return false;
          };
          client.send({ t: 'join', name });
          joinTimer = setTimeout(() => { cleanup(); st.phase = 'idle'; st.err = st.mode === 'tab' ? `No room ${code} was found on this device. Create it in another tab first, then join.` : `Room ${code} was not found, or the server did not answer.`; draw(); }, 4000);
        }
      };

      const wire = () => {
        $$('[data-cm]', sc).forEach(b => b.onclick = () => { st.name = ($('#nm', sc) || {}).value || st.name; st.mode = b.dataset.cm; draw(); });
        const create = $('#create', sc); if (create) create.onclick = () => open(makeRoomCode(), true);
        const join = $('#join', sc);
        if (join) join.onclick = () => {
          const code = ($('#code', sc).value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (code.length !== 5) { st.name = ($('#nm', sc) || {}).value || st.name; st.err = 'Enter the five-character room code from your host.'; draw(); return; }
          open(code, false);
        };
        const cancel = $('#cancel', sc); if (cancel) cancel.onclick = () => { cleanup(); st.phase = 'idle'; st.err = ''; draw(); };
        const copy = $('#copy', sc); if (copy) copy.onclick = () => { try { navigator.clipboard.writeText(st.code); toast('Room code copied.', 'good'); } catch (e) { toast('Copy failed. Read the code aloud instead.', 'bad'); } };
      };
      draw();
    },

    /* ---------- learn ---------- */
    learn(sc, p) {
      const done = new Set(Store.get('wr.learn.v1', []));
      let li = clamp(p.lesson || 0, 0, LESSONS.length - 1), si = clamp(p.step || 0, 0, LESSONS[li].steps.length - 1);
      let view = null, stepDone = false;

      const render = () => {
        const L = LESSONS[li], S = L.steps[si];
        const last = li === LESSONS.length - 1 && si === L.steps.length - 1;
        sc.innerHTML = `${App.topbar()}<main class="page"><h2>Learn Wall Rush</h2><p class="lede">Eight short lessons on a real board. Try each task; the game explains every refusal. Lessons follow the provisional ruleset described on the Rules page.</p>
          <div class="learn" style="margin-top:1.2rem">
            <ol class="lessons" aria-label="Lessons">${LESSONS.map((x, i) => `<li><button data-l="${i}" class="${done.has(x.id) ? 'done' : ''}" ${i === li ? 'aria-current="step"' : ''}><span class="num">${done.has(x.id) ? '✓' : i + 1}</span><span>${esc(x.title)}</span></button></li>`).join('')}
              <li><button data-nav="practice"><span class="num">★</span><span>Practice board</span></button></li></ol>
            <section class="lesson-body" aria-label="${esc(L.title)}">
              <div class="card text"><div class="tag interp" style="margin-bottom:.5rem">Lesson ${li + 1} of ${LESSONS.length}${L.steps.length > 1 ? ` · step ${si + 1} of ${L.steps.length}` : ''}</div>${S.html}
                ${S.quiz ? `<div class="task" id="quiz"><b class="state">Question</b>${esc(S.quiz.q)}<div class="quiz" role="group" aria-label="Answers">${S.quiz.options.map((o, i) => `<button class="btn" data-q="${i}">${esc(o)}</button>`).join('')}</div><p id="qres" style="margin:.5rem 0 0"></p></div>` : ''}
                ${S.task ? `<div class="task" id="task"><b class="state" id="tstate">Your task</b><span id="ttext">${esc(S.task.prompt)}</span></div>` : ''}
                ${S.finale ? `<div class="row"><button class="btn primary" data-nav="practice">Open practice board</button><button class="btn" data-nav="setup-ai">Play vs Computer</button></div>` : ''}</div>
              <div id="lv"></div>
              <div class="row" style="justify-content:space-between"><button class="btn" id="prev" ${li === 0 && si === 0 ? 'disabled' : ''}>← Previous</button>
                ${last ? '' : `<button class="btn primary" id="next" ${S.task ? 'disabled' : ''}>Next →</button>`}</div>
            </section></div></main>`;
        App.wireNav(sc);
        stepDone = !S.task;
        const setInfo = (msg, kind) => {
          const t = $('#task', sc); if (!t) return;
          $('#ttext', sc).textContent = msg;
          t.classList.toggle('done', kind === 'good');
          $('#tstate', sc).textContent = kind === 'good' ? '✓ Done' : (kind === 'bad' ? '✕ Not quite' : 'Your task');
          announce(msg);
        };
        const markDone = () => {
          stepDone = true;
          const next = $('#next', sc); if (next) { next.disabled = false; next.focus(); }
          if (si === L.steps.length - 1) { done.add(L.id); Store.set('wr.learn.v1', Array.from(done)); const b = $(`[data-l="${li}"]`, sc); if (b) { b.classList.add('done'); $('.num', b).textContent = '✓'; } }
        };
        view = new LessonView($('#lv', sc), S, { onInfo: setInfo, onDone: markDone, onReset: () => { const t = $('#task', sc); if (t) { t.classList.remove('done'); $('#ttext', sc).textContent = S.task.prompt; $('#tstate', sc).textContent = 'Your task'; } const n = $('#next', sc); if (n && S.task) n.disabled = true; } });
        if (S.quiz) { view.quizOk = false; view.render(); }
        if (!S.task) { if (si === L.steps.length - 1) { done.add(L.id); Store.set('wr.learn.v1', Array.from(done)); } }
        $$('[data-q]', sc).forEach(b => b.onclick = () => {
          const ok = +b.dataset.q === S.quiz.answer;
          $('#qres', sc).innerHTML = ok ? `<b style="color:var(--good)">✓ Correct.</b> ${esc(S.quiz.explain)}` : `<b style="color:var(--bad)">✕ Not quite.</b> Count each pawn's steps and remember who moves first, then try again.`;
          if (ok) { $$('[data-q]', sc).forEach(x => x.disabled = true); b.setAttribute('aria-pressed', 'true'); view.unlock(); }
        });
        $$('[data-l]', sc).forEach(b => b.onclick = () => { li = +b.dataset.l; si = 0; render(); });
        $('#prev', sc).onclick = () => { if (si > 0) si--; else { li--; si = LESSONS[li].steps.length - 1; } render(); };
        const nx = $('#next', sc); if (nx) nx.onclick = () => { if (si < L.steps.length - 1) si++; else { li++; si = 0; } render(); window.scrollTo(0, 0); };
      };
      render();
    },

    /* ---------- rules ---------- */
    rules(sc) {
      const two = RULES.modes[2], four = RULES.modes[4];
      const R = [
        ['Objective', 'Move your pawn to the opposite edge of the board before any other player. The coloured bands on the frame mark each player\'s goal edge.'],
        ['One action per turn', 'On your turn, do exactly one thing: move your pawn, or place a wall. Then the next player acts. You cannot act out of turn.'],
        ['Moving', 'Move one tile up, down, left or right. Walls and the board edge block movement.'],
        ['Jumping', 'If a pawn stands directly in front of you, jump straight over it. If a wall or the edge blocks that jump, step diagonally to either side of that pawn instead, if those sides are open.'],
        ['Walls', `A wall is ${RULES.wallLength} tiles long and sits in the grooves between tiles. In a two-player match each player has ${two.wallsEach} walls; in a four-player match each has ${four.wallsEach}. Placed walls stay for the rest of the match.`],
        ['Wall limits', 'Walls may not overlap and may not cross. A wall is also illegal if it would leave any pawn with no route to its goal edge. The game shows the reason when it refuses a wall.'],
        ['Four-player boards', 'Turns run clockwise: Gold (bottom), Sky (left), Jade (top), Rose (right). Each player races to the edge opposite their start.'],
        ['No legal action', 'If a player has no legal move and no legal wall, their turn passes. This is rare and added by this build to prevent a stalled match.']
      ];
      sc.innerHTML = `${App.topbar()}<main class="page"><h2>Rules</h2><p class="lede">Everything the game enforces, in one place.</p>
        ${RULES.provisional ? `<div class="notice"><span aria-hidden="true">ⓘ</span><span><b>Ruleset status: provisional.</b> No official Wall Rush rules file was available in the project when this was built, so the numbers above are a working configuration kept in one place in the code (<code>RULES</code>). Replace them with the project's rules and the whole game follows.</span></div>` : ''}
        <div class="rule-list">${R.map(([h, t]) => `<div class="card"><h3>${esc(h)}</h3><p>${esc(t)}</p></div>`).join('')}</div>
        <div class="row" style="margin-top:1.4rem"><button class="btn primary" data-nav="learn">Learn by playing</button><button class="btn" data-nav="setup-ai">Play vs Computer</button></div></main>`;
      App.wireNav(sc);
    },

    /* ---------- heritage ---------- */
    heritage(sc) {
      const H = WR_CONFIG.heritage;
      const block = (tagCls, tagText, items, emptyHtml) => `<section class="card">${tagText ? `<span class="tag ${tagCls}">${tagText}</span>` : ''}
        ${items.length ? items.map(i => `<h3>${esc(i.title)}</h3><p style="color:var(--ink-dim)">${esc(i.text)}${i.source ? `<br><small>Source: ${esc(i.source)}</small>` : ''}</p>`).join('') : emptyHtml}</section>`;
      sc.innerHTML = `${App.topbar()}<main class="page"><h2>About / History</h2><p class="lede">Indigenous games are not merely entertainment. They can carry knowledge, strategy, community values and cultural memory. This page keeps three kinds of statement clearly apart.</p>
        <div class="herit">
          ${block('doc', '✓ Documented history · needs verified sources', H.documented, '<div class="empty" style="margin-top:.8rem"><b>Needs verified sources.</b> No documented history has been supplied for Wall Rush yet, so none is shown. Nothing here has been written from memory or assumption. Verified entries added to the project will appear in this section together with their sources.</div>')}
          ${block('interp', '◇ Cultural interpretation', H.interpretation, '')}
          ${block('sys', '', H.system, '')}
        </div></main>`;
      App.wireNav(sc);
    },

    /* ---------- statistics ---------- */
    stats(sc) {
      const D = Stats.load();
      const pct = (w, p) => p ? Math.round(w / p * 100) + '%' : '–';
      const rows = [['Advanced', D.advanced], ['Expert', D.expert], ['Online', D.online]];
      const played = rows.reduce((a, r) => a + r[1].played, 0), wins = rows.reduce((a, r) => a + r[1].wins, 0), losses = rows.reduce((a, r) => a + r[1].losses, 0);
      const localPlayed = D.local2.played + D.local4.played;
      const any = played + localPlayed > 0;
      sc.innerHTML = `${App.topbar()}<main class="page"><h2>Statistics</h2><p class="lede">Your record against the computer and online opponents. Local matches share one device, so they are counted separately.</p>
        ${!Store.ok ? '<div class="notice"><span aria-hidden="true">ⓘ</span><span>This browser is not allowing saved data, so statistics will reset when you close the page.</span></div>' : ''}
        ${any ? `<div class="tiles"><div class="card tile-stat"><b>${played}</b><span>Games played</span></div><div class="card tile-stat"><b>${wins}</b><span>Wins</span></div><div class="card tile-stat"><b>${losses}</b><span>Losses</span></div><div class="card tile-stat"><b>${pct(wins, played)}</b><span>Win rate</span></div></div>
        <div class="card table-scroll"><table class="stats"><caption class="sr-only">Results by mode</caption><thead><tr><th scope="col">Mode</th><th scope="col">Played</th><th scope="col">Wins</th><th scope="col">Losses</th><th scope="col">Win rate</th><th scope="col">Fastest win (turns)</th></tr></thead><tbody>
          ${rows.map(([n, r]) => `<tr><th scope="row">${n}</th><td>${r.played}</td><td>${r.wins}</td><td>${r.losses}</td><td>${pct(r.wins, r.played)}</td><td>${r.best == null ? '–' : r.best}</td></tr>`).join('')}</tbody></table></div>
        <div class="card" style="margin-top:1rem"><h3>Local matches</h3><p style="color:var(--ink-dim);margin:.3rem 0 0">Two-player: ${D.local2.played} played${D.local2.played ? ` (Gold ${D.local2.seatWins[0]}, Sky ${D.local2.seatWins[1]})` : ''}. Four-player: ${D.local4.played} played${D.local4.played ? ` (Gold ${D.local4.seatWins[0]}, Sky ${D.local4.seatWins[1]}, Jade ${D.local4.seatWins[2]}, Rose ${D.local4.seatWins[3]})` : ''}.</p></div>
        <div class="row" style="margin-top:1.2rem"><button class="btn danger" id="reset">Reset statistics</button></div>` : `<div class="empty" style="margin-top:1.2rem"><b>No matches recorded yet.</b> Finish a game and your results will appear here.<div class="row" style="margin-top:.8rem"><button class="btn primary" data-nav="setup-ai">Play vs Computer</button><button class="btn" data-nav="learn">Learn Wall Rush</button></div></div>`}
        </main>`;
      App.wireNav(sc);
      const rs = $('#reset', sc);
      if (rs) rs.onclick = () => App.confirm('Reset all statistics?', 'This clears every recorded result on this device.', 'Reset', () => { Stats.reset(); App.go('stats', {}, false); toast('Statistics reset.'); });
    },

    /* ---------- settings ---------- */
    settings(sc) {
      sc.innerHTML = `${App.topbar()}<main class="page"><h2>Settings</h2><div class="card" style="margin-top:1rem;max-width:720px">${App.settingsMarkup()}</div></main>`;
      App.wireNav(sc); App.wireSettings(sc);
    }
  },

  settingsMarkup() {
    const v = Settings.v;
    const sw = (id, label, note, on) => `<div class="switch"><div class="lab"><label for="${id}">${label}</label><small>${note}</small></div><span class="toggle"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span><b class="t on" aria-hidden="true">ON</b><b class="t off" aria-hidden="true">OFF</b></span></div>`;
    const seg = (id, label, note, opts, cur) => `<div class="switch"><div class="lab"><span id="${id}-l">${label}</span><small>${note}</small></div><div class="seg" role="group" aria-labelledby="${id}-l">${opts.map(([k, t]) => `<button data-seg="${id}" data-val="${k}" aria-pressed="${cur === k}">${t}</button>`).join('')}</div></div>`;
    return `${sw('s-sound', 'Sound', 'Subtle tones for moves, walls and results.', v.sound)}
      <div class="switch"><div class="lab"><label for="s-vol">Volume</label><small>Applies to all sounds.</small></div><input type="range" id="s-vol" min="0" max="1" step="0.05" value="${v.volume}"></div>
      ${seg('s-theme', 'Theme', 'Night courtyard or day plaster.', [['night', 'Night'], ['day', 'Day']], v.theme)}
      ${sw('s-labels', 'Board coordinates', 'Letters and numbers on the frame (next match).', v.labels)}
      ${sw('s-routes', 'Show routes by default', 'Dotted lines for each pawn\'s shortest route.', v.routes)}
      ${seg('s-confirm', 'Confirm wall placement', 'Preview first, then confirm. Auto uses this on touch screens.', [['auto', 'Auto'], ['always', 'Always'], ['never', 'Never']], v.confirmWalls)}
      ${sw('s-motion', 'Reduce motion', 'Calms animations and transitions.', v.motion === 'reduce')}
      ${sw('s-contrast', 'High contrast', 'Stronger borders and brighter text.', v.contrast)}
      ${sw('s-large', 'Larger text', 'Increases text size across the game.', v.large)}`;
  },
  wireSettings(root) {
    const on = (id, fn) => { const el = $('#' + id, root); if (el) el.onchange = () => fn(el); };
    on('s-sound', el => { Settings.set('sound', el.checked); if (el.checked) Sound.play('turn'); });
    on('s-vol', el => { Settings.set('volume', +el.value); Sound.play('move'); });
    on('s-labels', el => Settings.set('labels', el.checked));
    on('s-routes', el => Settings.set('routes', el.checked));
    on('s-motion', el => Settings.set('motion', el.checked ? 'reduce' : 'auto'));
    on('s-contrast', el => Settings.set('contrast', el.checked));
    on('s-large', el => Settings.set('large', el.checked));
    $$('[data-seg]', root).forEach(b => b.onclick = () => {
      const map = { 's-theme': 'theme', 's-confirm': 'confirmWalls' };
      Settings.set(map[b.dataset.seg], b.dataset.val);
      $$(`[data-seg="${b.dataset.seg}"]`, root).forEach(x => x.setAttribute('aria-pressed', x === b));
    });
  },
  settingsDialog(after) {
    const o = document.createElement('div');
    o.className = 'overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Settings');
    o.innerHTML = `<div class="dialog" style="text-align:left;max-height:90vh;overflow:auto"><h2>Settings</h2>${this.settingsMarkup()}<div class="stack"><button class="btn primary" id="sd-close">Done</button></div></div>`;
    document.body.appendChild(o);
    this.wireSettings(o);
    const close = () => { o.remove(); after && after(); };
    $('#sd-close', o).onclick = close; $('#sd-close', o).focus();
    o.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  },
  confirm(title, text, yes, fn) {
    const o = document.createElement('div');
    o.className = 'overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', title);
    o.innerHTML = `<div class="dialog"><h2>${esc(title)}</h2><p style="color:var(--ink-dim)">${esc(text)}</p><div class="stack"><button class="btn danger" id="cf-y">${esc(yes)}</button><button class="btn ghost" id="cf-n">Cancel</button></div></div>`;
    document.body.appendChild(o);
    $('#cf-n', o).focus();
    $('#cf-n', o).onclick = () => o.remove();
    $('#cf-y', o).onclick = () => { o.remove(); fn(); };
    o.addEventListener('keydown', e => { if (e.key === 'Escape') o.remove(); });
  },

  boot() {
    Settings.apply(); Stats.load();
    document.body.insertAdjacentHTML('afterbegin', sharedDefs());
    window.addEventListener('popstate', () => {
      const v = this.view;
      if (v instanceof GameView && !v.over && v.state.plies > 0 && v.kind !== 'practice') { try { history.pushState({ s: 'game' }, ''); } catch (e) { /* ignore */ } v.confirmLeave(); return; }
      this.go(this.current === 'menu' ? 'menu' : 'menu', {}, false);
    });
    try { history.replaceState({ s: 'loading' }, ''); } catch (e) { /* sandboxed */ }
    document.addEventListener('pointerdown', () => Sound.ensure(), { once: true });
    this.go('loading', {}, false);
  }
};
