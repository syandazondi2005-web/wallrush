/* =====================================================================
   WALL RUSH — CONTROLLERS
   BoardController: pointer/keyboard interaction shared by matches,
   practice and lessons. Subclasses decide who may act and what happens.
   ===================================================================== */

const cellName = (n, r, c) => `${'ABCDEFGHI'[c]}${n - r}`;

class BoardController {
  constructor(host, state, opts = {}) {
    this.state = state;
    this.mode = 'move';        // 'move' | 'wall'
    this.selected = null;
    this.ghost = null;         // { o, r, c, valid, code }
    this.last = null;
    this.showRoutes = !!opts.routes;
    this.free = !!opts.free;   // practice / lessons: unlimited walls
    this.kbSlot = { o: 'h', r: 3, c: 3 };
    this.hint = opts.onHint || (() => {});
    this.board = new Board(host, {
      n: state.n, count: state.count, labels: Settings.v.labels, label: opts.label,
      onCell: (r, c) => this.onCell(r, c),
      onPawn: i => this.onPawn(i),
      onClick: (pt, e) => this.onBoardClick(pt, e),
      onHover: pt => this.onHover(pt),
      onKey: e => this.onKey(e)
    });
  }

  /* --- to be provided by subclasses --- */
  actor() { return this.state.turn; }           // seat allowed to act right now, or -1
  canAct() { return this.state.winner < 0; }
  commit(move) { return { ok: false, code: 'badmove' }; }
  viewExtras() { return {}; }

  targets() {
    if (!this.canAct()) return [];
    return pawnMoves(this.state, this.state.turn);
  }

  render() {
    const s = this.state;
    const acting = this.canAct();
    const view = {
      turn: s.turn,
      selected: acting && this.mode === 'move' ? this.selected : null,
      targets: acting && this.mode === 'move' ? this.targets() : [],
      strong: this.selected != null,
      ghost: acting && this.mode === 'wall' ? this.ghost : null,
      last: this.last,
      routes: this.showRoutes ? s.players.map((_, pi) => ({ pi, cells: shortestRoute(s, pi) })) : [],
      ...this.viewExtras()
    };
    this.board.update(s, view);
  }

  setMode(m) {
    this.mode = m; this.selected = null;
    this.ghost = null;   // nothing is previewed until the player points, taps or presses a key
    this.render(); this.afterModeChange && this.afterModeChange();
  }

  setGhost(slot) {
    if (!slot) { this.ghost = null; this.hint('', ''); return; }
    const s = this.state;
    const code = this.free ? wallProblem(s, slot.o, slot.r, slot.c) : wallCheck(s, slot.o, slot.r, slot.c);
    this.ghost = { ...slot, code, valid: !code, pi: s.turn };
    this.kbSlot = { ...slot };
    if (code) this.hint(WALL_MESSAGES[code], 'bad');
    else this.hint(this.wallImpact(slot), 'good');
  }

  /* Tell the player what a valid wall would do to each route. */
  wallImpact(slot) {
    const s = this.state;
    const t = cloneState(s); t._F = null;
    (slot.o === 'h' ? t.h : t.v)[slot.r * (s.n - 1) + slot.c] = 1;
    const parts = [];
    s.players.forEach((p, i) => {
      const before = routeLength(s, i), after = routeLength(t, i);
      const d = after - before;
      if (i === s.turn && d === 0) return;
      const who = i === s.turn ? 'your' : `${PLAYERS[i].name}'s`;
      parts.push(d === 0 ? `${who} route unchanged` : `${who} route ${d > 0 ? '+' : ''}${d} step${Math.abs(d) === 1 ? '' : 's'}`);
    });
    const detail = parts.join(' · ') || 'No route changes.';
    return 'Valid wall. ' + detail.charAt(0).toUpperCase() + detail.slice(1);
  }

  fail(code) {
    const msg = WALL_MESSAGES[code] || 'That action is not allowed.';
    toast(msg, 'bad'); Sound.play('invalid'); this.board.shake(); this.hint(msg, 'bad');
  }

  attempt(move) {
    if (!this.canAct()) { this.fail(this.state.winner >= 0 ? 'over' : 'turn'); return; }
    const res = this.commit(move);
    if (!res.ok) this.fail(res.code);
    return res;
  }

  onPawn(i) {
    if (this.mode !== 'move' || !this.canAct()) return;
    if (i !== this.state.turn) { this.fail('turn'); return; }
    this.selected = this.selected === i ? null : i;
    this.render();
  }
  onCell(r, c) {
    if (this.mode !== 'move') return;
    this.attempt({ type: 'move', r, c });
  }
  onBoardClick(pt) {
    if (!this.canAct()) { if (this.state.winner < 0) this.fail('turn'); return; }
    if (this.mode === 'wall') {
      const slot = this.board.slotAt(pt, this.ghost && this.ghost.o);
      const same = this.ghost && this.ghost.o === slot.o && this.ghost.r === slot.r && this.ghost.c === slot.c;
      if (Settings.wantsConfirm() && !same) { this.setGhost(slot); this.render(); return; }
      this.setGhost(slot);
      this.confirmWall();
    } else {
      const cell = this.board.cellAt(pt);
      if (cell) this.attempt({ type: 'move', r: cell.r, c: cell.c });
      else { this.selected = null; this.render(); }
    }
  }
  onHover(pt) {
    if (this.mode !== 'wall' || !this.canAct() || Settings.wantsConfirm()) return;
    if (!pt) { this.ghost = null; this.hint('', ''); this.render(); return; }
    const slot = this.board.slotAt(pt, this.ghost && this.ghost.o);
    if (this.ghost && this.ghost.o === slot.o && this.ghost.r === slot.r && this.ghost.c === slot.c) return;
    this.setGhost(slot); this.render();
  }
  rotateGhost() {
    if (this.mode !== 'wall') return;
    const g = this.ghost || this.kbSlot;
    this.setGhost({ o: g.o === 'h' ? 'v' : 'h', r: g.r, c: g.c }); this.render();
  }
  confirmWall() {
    const g = this.ghost;
    if (!g) { this.hint('Choose where to place the wall first.', 'bad'); return; }
    this.attempt({ type: 'wall', o: g.o, r: g.r, c: g.c });
  }

  onKey(e) {
    if (!this.canAct()) return;
    const m = this.state.n - 2;
    if (this.mode === 'wall') {
      const s = this.ghost || this.kbSlot;
      let { o, r, c } = s;
      if (e.key === 'ArrowLeft') c = clamp(c - 1, 0, m);
      else if (e.key === 'ArrowRight') c = clamp(c + 1, 0, m);
      else if (e.key === 'ArrowUp') r = clamp(r - 1, 0, m);
      else if (e.key === 'ArrowDown') r = clamp(r + 1, 0, m);
      else if (e.key === 'r' || e.key === 'R') o = o === 'h' ? 'v' : 'h';
      else if (e.key === 'Enter') { e.preventDefault(); this.confirmWall(); return; }
      else return;
      e.preventDefault();
      this.setGhost({ o, r, c }); this.render();
    } else if (e.key.startsWith('Arrow')) {
      const p = this.state.players[this.state.turn];
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      const hit = this.targets().find(t => Math.sign(t.r - p.r) === d[0] && Math.sign(t.c - p.c) === d[1] && (d[0] === 0 || t.c === p.c) && (d[1] === 0 || t.r === p.r));
      e.preventDefault();
      if (hit) this.attempt({ type: 'move', r: hit.r, c: hit.c });
      else this.fail('badmove');
    }
  }

  destroy() {}
}

/* =====================================================================
   GameView — a full match screen.
   kind: 'ai' | 'local2' | 'local4' | 'online' | 'practice'
   ===================================================================== */
class GameView extends BoardController {
  constructor(root, cfg) {
    const count = cfg.kind === 'local4' ? 4 : 2;
    const state = newGame(count, { first: cfg.first || 0 });
    root.innerHTML = GameView.template(cfg);
    super($('#board', root), state, { routes: Settings.v.routes || cfg.kind === 'practice', free: cfg.kind === 'practice', onHint: (t, k) => this.setHint(t, k), label: 'Wall Rush board' });
    this.root = root; this.cfg = cfg; this.kind = cfg.kind;
    this.humanSeat = cfg.kind === 'ai' ? 0 : -1;
    this.mySeat = cfg.kind === 'online' ? cfg.online.seat : -1;
    this.counts = new Array(count).fill(0);   // turns taken per seat
    this.log = [];
    this.history = [];      // for practice undo
    this.thinking = false; this.paused = false; this.over = false;
    this.aiTimer = 0; this.dead = false;
    this.wallsUsedByHuman = 0;
    this.tabTest = cfg.kind === 'online' && cfg.online.mode === 'tab';
    this.connBase = this.tabTest ? 'Same-device test' : 'Connected';
    this.conn = cfg.kind === 'online' ? { state: 'ok', text: this.connBase } : null;
    this.bind();
    this.render();
    this.refresh();
    if (this.kind === 'ai' && this.state.turn !== this.humanSeat) this.scheduleAI();
    if (this.kind === 'online') this.hookOnline();
    announce(this.turnText().who);
  }

  static template(cfg) {
    const practice = cfg.kind === 'practice';
    return `
    <header class="topbar">
      <button class="btn ghost" id="g-back" aria-label="Leave match and return to menu">← Menu</button>
      ${lockup('sm')}
      <span class="spacer"></span>
      ${cfg.kind === 'online' ? `<span class="conn ok" id="g-conn" title="${cfg.online.mode === 'tab' ? 'Same-device test between two tabs. Not internet play.' : 'Connected to the room server'}"><i></i><span>${cfg.online.mode === 'tab' ? 'Same-device test' : 'Connected'}</span></span>` : ''}
      ${practice ? '<button class="btn icon" id="g-undo" aria-label="Undo last action" title="Undo">↶</button>' : ''}
      <button class="btn icon" id="g-sound" aria-label="Sound" aria-pressed="${Settings.v.sound}" title="Sound">${Settings.v.sound ? '♪' : '✕'}</button>
      <button class="btn icon" id="g-pause" aria-label="Pause menu" title="Pause">❚❚</button>
    </header>
    <main class="game-main">
      <section class="board-col">
        <div class="turn-banner" id="turn" aria-live="off"></div>
        <div class="board-host" id="board"></div>
        <div class="hint-line" id="hint" aria-hidden="true"></div>
      </section>
      <aside class="side" aria-label="Match panel">
        <div id="cards" style="display:grid;gap:.6rem"></div>
        <div class="actions" id="actions">
          <button class="btn" id="a-move" aria-pressed="true">Move pawn</button>
          <button class="btn" id="a-wall" aria-pressed="false">Place wall</button>
          <button class="btn" id="a-rot" hidden>⟳ Rotate wall</button>
          <button class="btn primary" id="a-ok" hidden>Place wall</button>
          <button class="btn full" id="a-routes" aria-pressed="false">Show routes</button>
        </div>
        <div class="card log" id="log" aria-label="Move history"><ol id="loglist"></ol></div>
        <div class="row"><button class="btn" id="g-restart">Restart</button><button class="btn ghost" id="g-set">Settings</button></div>
        <p style="font-size:.82rem;color:var(--ink-dim);margin:0">Keyboard: arrow keys move your pawn. In wall mode, arrows move the wall, R rotates it, Enter places it.</p>
      </aside>
    </main>`;
  }

  /* ---------- who may act ---------- */
  actor() {
    if (this.over || this.paused || this.thinking) return -1;
    if (this.kind === 'ai') return this.state.turn === this.humanSeat ? this.humanSeat : -1;
    if (this.kind === 'online') return this.state.turn === this.mySeat && this.conn.state !== 'bad' ? this.mySeat : -1;
    return this.state.turn;
  }
  canAct() { return this.state.winner < 0 && this.actor() === this.state.turn; }

  /* ---------- wiring ---------- */
  bind() {
    const R = this.root;
    $('#a-move', R).onclick = () => this.setMode('move');
    $('#a-wall', R).onclick = () => { if (!this.canAct()) { this.fail('turn'); return; } if (this.state.players[this.state.turn].walls <= 0 && !this.free) { this.fail('nowalls'); return; } this.setMode('wall'); };
    $('#a-rot', R).onclick = () => this.rotateGhost();
    $('#a-ok', R).onclick = () => this.confirmWall();
    $('#a-routes', R).onclick = () => { this.showRoutes = !this.showRoutes; this.render(); this.refresh(); };
    $('#g-pause', R).onclick = () => this.pauseMenu();
    $('#g-set', R).onclick = () => this.pauseMenu();
    $('#g-restart', R).onclick = () => this.confirmRestart();
    $('#g-back', R).onclick = () => this.confirmLeave();
    $('#g-sound', R).onclick = e => { Settings.set('sound', !Settings.v.sound); e.currentTarget.setAttribute('aria-pressed', Settings.v.sound); e.currentTarget.textContent = Settings.v.sound ? '♪' : '✕'; if (Settings.v.sound) Sound.play('turn'); };
    const undo = $('#g-undo', R); if (undo) undo.onclick = () => this.undo();
    this._esc = e => { if (e.key === 'Escape' && !$('.overlay') && !this.dead) this.pauseMenu(); };
    document.addEventListener('keydown', this._esc);
    if (window.matchMedia) this._vis = () => { if (document.hidden && !this.over && this.kind !== 'online' && !this.dead && !$('.overlay')) this.pauseMenu(); };
    document.addEventListener('visibilitychange', this._vis);
  }
  destroy() {
    this.dead = true; clearTimeout(this.aiTimer);
    document.removeEventListener('keydown', this._esc);
    document.removeEventListener('visibilitychange', this._vis);
    if (this.online) this.online.close();
  }

  /* ---------- text helpers ---------- */
  seatName(i) {
    const P = PLAYERS[i];
    if (this.kind === 'ai') return i === this.humanSeat ? 'You' : (this.cfg.level === 'expert' ? 'Expert' : 'Advanced');
    if (this.kind === 'online') return i === this.mySeat ? 'You' : (this.cfg.online.peerName || 'Opponent');
    return P.name;
  }
  turnText() {
    const s = this.state, i = s.turn, P = PLAYERS[i];
    if (s.winner >= 0) return { who: `${P.name} reaches the goal`, what: 'Match over', me: false };
    if (this.kind === 'ai') {
      if (i === this.humanSeat) return { who: 'Your turn', what: `Move your pawn or place a wall. You are ${P.name} (${P.shapeName}).`, me: true };
      return { who: `${this.seatName(i)} is thinking…`, what: `${this.seatName(i)} plays ${P.name} (${P.shapeName}).`, me: false, spin: true };
    }
    if (this.kind === 'online') {
      if (this.conn.state === 'bad') return { who: 'Connection lost', what: 'Waiting for the connection to return…', me: false, spin: true };
      if (i === this.mySeat) return { who: 'Your turn', what: `You are ${P.name} (${P.shapeName}). Move or place a wall.`, me: true };
      return { who: `Waiting for ${this.seatName(i)}`, what: `${this.seatName(i)} plays ${P.name} (${P.shapeName}).`, me: false, spin: true };
    }
    if (this.kind === 'practice') return { who: `${P.name} to act`, what: 'Practice board: unlimited walls, undo any time.', me: true };
    return { who: `${P.name}'s turn`, what: `Pass the device to ${P.name} (${P.shapeName}). Move or place a wall.`, me: true };
  }
  setHint(text, kind) {
    const el = $('#hint', this.root);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'hint-line ' + (kind || '');
  }

  /* ---------- panel refresh ---------- */
  refresh() {
    const R = this.root, s = this.state;
    const tt = this.turnText();
    const tb = $('#turn', R);
    tb.className = 'turn-banner' + (tt.me ? ' me' : '');
    tb.innerHTML = `${pawnIcon(s.turn)}<div><div class="who">${esc(tt.who)}</div><div class="what">${esc(tt.what)}</div></div>${tt.spin ? '<span class="spin" aria-hidden="true"></span>' : ''}`;

    const total = RULES.modes[s.count].wallsEach;
    $('#cards', R).innerHTML = s.players.map((p, i) => {
      const P = PLAYERS[i];
      const d = routeLength(s, i);
      const prog = clamp(1 - d / (s.n - 1), 0, 1);
      const pips = this.free ? `<b>Unlimited walls</b>` : `${Array.from({ length: total }, (_, k) => `<i class="${k < p.walls ? '' : 'off'}"></i>`).join('')}<b>${p.walls} wall${p.walls === 1 ? '' : 's'} left</b>`;
      const active = i === s.turn && s.winner < 0;
      return `<div class="pcard ${active ? 'active' : ''}" style="--pc:${P.color}" aria-label="${esc(P.name)}: ${p.walls} walls, ${d} steps to goal">
        ${pawnIcon(i)}
        <div class="nm">${esc(this.seatName(i))}<span class="badge">${esc(P.name)} ${esc(P.shapeName)}</span>${active ? '<span class="badge" style="background:#fff;color:#1b1108">Turn</span>' : ''}${s.winner === i ? '<span class="badge" style="background:#fff;color:#1b1108">Winner</span>' : ''}</div>
        <div class="pips">${pips}</div>
        <div class="prog"><span>Goal: ${GOAL_EDGE[p.side]} edge · <b>${d}</b> step${d === 1 ? '' : 's'}</span><span class="bar"><i style="width:${Math.round(prog * 100)}%"></i></span></div>
      </div>`;
    }).join('');

    const canWall = this.canAct() && (this.free || s.players[s.turn].walls > 0);
    const mv = $('#a-move', R), wl = $('#a-wall', R);
    mv.setAttribute('aria-pressed', this.mode === 'move'); wl.setAttribute('aria-pressed', this.mode === 'wall');
    wl.textContent = this.free ? 'Place wall' : `Place wall (${s.players[s.turn].walls})`;
    wl.disabled = !canWall; mv.disabled = !this.canAct();
    $('#a-rot', R).hidden = this.mode !== 'wall';
    const ok = $('#a-ok', R);
    ok.hidden = !(this.mode === 'wall' && Settings.wantsConfirm());
    ok.disabled = !(this.ghost && this.ghost.valid);
    $('#a-routes', R).setAttribute('aria-pressed', this.showRoutes);
    $('#a-routes', R).textContent = this.showRoutes ? 'Hide routes' : 'Show routes';
    const undo = $('#g-undo', R); if (undo) undo.disabled = !this.history.length;
    $('#loglist', R).innerHTML = this.log.slice(-40).map(x => `<li>${esc(x)}</li>`).join('') || '<li style="list-style:none;margin-left:-1.3rem">No moves yet. Make the first one.</li>';
    const lg = $('#log', R); lg.scrollTop = lg.scrollHeight;
  }
  afterModeChange() { this.refresh(); this.setHint(this.mode === 'wall' ? 'Point at a groove between tiles to preview a wall.' : '', ''); }
  render() { super.render(); if (this.root) this.refresh(); }

  /* ---------- actions ---------- */
  commit(move) {
    const s = this.state, seat = s.turn;
    const res = play(s, seat, move, { free: this.free });
    if (!res.ok) return res;
    if (this.free) this.history.push(s);
    this.applyResult(res, true);
    if (this.kind === 'online' && this.online) this.online.send({ t: 'move', ply: s.plies, move });
    return res;
  }

  applyResult(res, local) {
    const prev = this.state;
    this.state = res.state; this.selected = null; this.ghost = null;
    const ev = res.event, n = this.state.n;
    this.counts[ev.player]++;
    if (ev.type === 'move') { this.last = { from: ev.from, to: ev.to }; Sound.play(ev.jumped ? 'jump' : 'move'); this.log.push(`${this.seatName(ev.player)} ${ev.jumped ? 'jumped' : 'moved'} to ${cellName(n, ev.to.r, ev.to.c)}`); }
    else {
      Sound.play('wall'); this.last = null;
      this.log.push(`${this.seatName(ev.player)} placed a ${ev.o === 'h' ? 'horizontal' : 'vertical'} wall near ${cellName(n, ev.r + (ev.o === 'h' ? 1 : 0), ev.c)}`);
      if (this.kind === 'ai' && ev.player === this.humanSeat) this.wallsUsedByHuman++;
    }
    this.mode = 'move';
    this.setHint('', '');
    this.render();
    if (this.state.winner >= 0) { setTimeout(() => this.finish(), 650); return; }
    this.advanceTurn();
  }

  advanceTurn() {
    let guard = 0;
    while (mustPass(this.state) && guard++ < 4) {
      const who = this.seatName(this.state.turn);
      toast(`${who} has no legal action. The turn passes.`);
      this.log.push(`${who} had no legal action; turn passed`);
      this.state = passTurn(this.state);
    }
    this.render();
    if (this.kind === 'ai' && this.state.turn !== this.humanSeat) this.scheduleAI();
    else if (this.kind === 'local2' || this.kind === 'local4' || (this.kind === 'ai') || (this.kind === 'online' && this.state.turn === this.mySeat)) { Sound.play('turn'); announce(this.turnText().who); }
    else announce(this.turnText().who);
  }

  undo() {
    if (!this.history.length) return;
    this.state = this.history.pop(); this.state._F = null;
    this.log.pop(); this.selected = null; this.ghost = null; this.last = null; this.over = false;
    this.render(); toast('Last action undone.');
  }

  scheduleAI() {
    if (this.over || this.dead) return;
    this.thinking = true; this.render();
    const level = this.cfg.level;
    const minDelay = level === 'expert' ? 450 : 700 + Math.random() * 500;
    clearTimeout(this.aiTimer);
    this.aiTimer = setTimeout(() => {
      if (this.dead) return;
      if (this.paused) { this.thinking = false; this.aiTimer = setTimeout(() => { if (!this.dead && !this.over && !this.paused) this.scheduleAI(); }, 400); return; }
      const t0 = Date.now();
      let move = null;
      try { move = aiChoose(this.state, level, { humanWallsUsed: this.wallsUsedByHuman }); } catch (e) { console.error(e); }
      if (!move) { const mv = pawnMoves(this.state, this.state.turn)[0]; if (mv) move = { type: 'move', r: mv.r, c: mv.c }; }
      const wait = Math.max(0, minDelay - (Date.now() - t0));
      this.aiTimer = setTimeout(() => {
        if (this.dead) return;
        this.thinking = false;
        const seat = this.state.turn;
        const res = move && play(this.state, seat, move);
        if (res && res.ok) this.applyResult(res, false);
        else { toast('The computer could not find a legal action. The turn passes.'); this.state = passTurn(this.state); this.render(); }
      }, wait);
    }, 60);
  }

  /* ---------- online hooks ---------- */
  hookOnline() {
    this.online = this.cfg.online.client;
    this.online.onMessage = m => this.onRemote(m);
    this.online.onStatus = st => { this.conn = st.state === 'ok' ? { state: 'ok', text: this.connBase } : st; this.updateConn(); this.render(); if (st.state === 'ok') toast('Connection restored.', 'good'); if (st.state === 'bad') toast('Connection lost. The match resumes when it returns.', 'bad'); };
    this.updateConn();
  }
  updateConn() {
    const el = $('#g-conn', this.root); if (!el || !this.conn) return;
    el.className = 'conn ' + this.conn.state;
    el.lastChild.textContent = this.conn.text;
  }
  onRemote(m) {
    if (m.t === 'move') {
      const s = this.state, seat = 1 - this.mySeat;
      if (m.ply !== s.plies || s.turn !== seat) { toast('The two boards disagree. Start a rematch to resync.', 'bad'); return; }
      const res = play(s, seat, m.move);
      if (!res.ok) { toast('Received an illegal move from the opponent. It was rejected.', 'bad'); return; }
      this.applyResult(res, false);
    } else if (m.t === 'leave') {
      toast(`${this.cfg.online.peerName || 'Your opponent'} left the room.`, 'bad');
      this.conn = { state: 'bad', text: 'Opponent left' }; this.updateConn(); this.render();
    } else if (m.t === 'rematch') {
      this.peerRematch = true;
      if (this.iRematch) this.doRematch(m.first);
      else { toast('Your opponent wants a rematch.'); const b = $('#w-rematch', document); if (b) b.textContent = 'Accept rematch'; }
    }
  }
  doRematch(first) {
    $('.overlay') && $('.overlay').remove();
    this.state = newGame(2, { first }); this.counts = [0, 0]; this.log = []; this.last = null; this.over = false;
    this.iRematch = this.peerRematch = false; this.mode = 'move'; this.selected = null; this.ghost = null;
    this.render(); toast('Rematch started.', 'good');
  }

  /* ---------- match end ---------- */
  finish() {
    if (this.over || this.dead) return;
    this.over = true;
    const s = this.state, w = s.winner, P = PLAYERS[w];
    let title, sub, won = null;
    if (this.kind === 'ai') { won = w === this.humanSeat; title = won ? 'You win' : `${this.seatName(w)} wins`; sub = won ? `You reached the ${GOAL_EDGE[s.players[w].side]} edge first.` : `${this.seatName(w)} reached the ${GOAL_EDGE[s.players[w].side]} edge first. Study its walls and try again.`; }
    else if (this.kind === 'online') { won = w === this.mySeat; title = won ? 'You win' : `${this.seatName(w)} wins`; sub = won ? 'Your route stayed open. Well played.' : 'They found the faster route this time.'; }
    else if (this.kind === 'practice') { title = 'Goal reached'; sub = `${P.name} crossed the board. Undo, reset or keep experimenting.`; }
    else { title = `${P.name} wins`; sub = `${P.name} (${P.shapeName}) reached the ${GOAL_EDGE[s.players[w].side]} edge first.`; }
    Sound.play(won === false ? 'lose' : 'win');
    announce(`${title}. ${sub}`);
    if (this.kind === 'ai') Stats.record({ kind: this.cfg.level, won, turns: this.counts[this.humanSeat] });
    else if (this.kind === 'online' && !this.tabTest) Stats.record({ kind: 'online', won, turns: this.counts[this.mySeat] });
    else if (this.kind === 'local2' || this.kind === 'local4') Stats.record({ kind: this.kind, winnerSeat: w });
    const o = document.createElement('div');
    o.className = 'overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', title);
    const rem = this.kind === 'online' ? 'Request rematch' : (this.kind === 'practice' ? 'Reset board' : 'Rematch');
    o.innerHTML = `<div class="dialog win">${pawnIcon(w, 'pawn-big')}<h2>${esc(title)}</h2><p style="color:var(--ink-dim);margin:0">${esc(sub)}</p>
      ${this.tabTest ? '<p style="color:var(--ink-dim);font-size:.85rem;margin:.6rem 0 0">Same-device test match: not added to your statistics.</p>' : ''}<div class="facts"><div><b>${this.counts[w]}</b>turns taken</div><div><b>${RULES.modes[s.count].wallsEach - s.players[w].walls}</b>walls used</div></div>
      <div class="stack"><button class="btn primary" id="w-rematch">${rem}</button>${this.kind === 'practice' ? '' : '<button class="btn" id="w-new">New game setup</button>'}<button class="btn ghost" id="w-menu">Main menu</button></div></div>`;
    document.body.appendChild(o);
    $('#w-rematch', o).focus();
    $('#w-rematch', o).onclick = () => {
      if (this.kind === 'online') {
        this.iRematch = true; const first = 1 - (this.cfg.first || 0);
        this.cfg.first = first;
        this.online.send({ t: 'rematch', first });
        if (this.peerRematch) this.doRematch(first);
        else { $('#w-rematch', o).textContent = 'Waiting for opponent…'; $('#w-rematch', o).disabled = true; }
        return;
      }
      o.remove(); this.restart(true);
    };
    const nw = $('#w-new', o); if (nw) nw.onclick = () => { o.remove(); App.go(this.kind === 'ai' ? 'setup-ai' : this.kind === 'online' ? 'online' : 'setup-local'); };
    $('#w-menu', o).onclick = () => { o.remove(); App.go('menu'); };
  }

  restart(swap) {
    clearTimeout(this.aiTimer);
    let first = this.cfg.first || 0;
    if (swap && this.kind !== 'practice') first = (first + 1) % this.state.count;
    this.cfg.first = first;
    this.state = newGame(this.state.count, { first });
    this.counts.fill(0); this.log = []; this.history = []; this.last = null; this.over = false; this.thinking = false;
    this.mode = 'move'; this.selected = null; this.ghost = null; this.wallsUsedByHuman = 0;
    this.render();
    if (this.kind === 'ai' && this.state.turn !== this.humanSeat) this.scheduleAI();
    announce('New match started. ' + this.turnText().who);
  }

  /* ---------- dialogs ---------- */
  dialog(html, wire) {
    const o = document.createElement('div');
    o.className = 'overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    o.innerHTML = `<div class="dialog">${html}</div>`;
    document.body.appendChild(o);
    const first = $('button', o); first && first.focus();
    o.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    const close = () => { o.remove(); this.paused = false; this.render(); if (this.kind === 'ai' && !this.over && this.state.turn !== this.humanSeat && !this.thinking) this.scheduleAI(); };
    wire(o, close);
    return o;
  }
  pauseMenu() {
    if (this.over || this.dead) return;
    if (this.kind !== 'online') this.paused = true;
    this.render();
    this.dialog(`<h2>Paused</h2><p style="color:var(--ink-dim)">${this.kind === 'online' ? 'The match keeps running online.' : 'The match is on hold.'}</p>
      <div class="stack"><button class="btn primary" id="p-res">Resume</button><button class="btn" id="p-rst">Restart match</button>
      <button class="btn" id="p-set">Settings</button><button class="btn ghost" id="p-menu">Leave to main menu</button></div>`, (o, close) => {
      $('#p-res', o).onclick = close;
      $('#p-rst', o).onclick = () => { o.remove(); this.paused = false; this.confirmRestart(); };
      $('#p-set', o).onclick = () => { o.remove(); this.paused = false; App.settingsDialog(() => this.pauseMenu()); };
      $('#p-menu', o).onclick = () => { o.remove(); this.paused = false; this.confirmLeave(); };
    });
  }
  confirmRestart() {
    if (this.kind === 'online') { toast('Use the rematch option when the match ends.'); return; }
    this.paused = true; this.render();
    this.dialog(`<h2>Restart match?</h2><p style="color:var(--ink-dim)">The current position will be lost.</p><div class="stack"><button class="btn primary" id="c-yes">Restart</button><button class="btn ghost" id="c-no">Keep playing</button></div>`, (o, close) => {
      $('#c-no', o).onclick = close;
      $('#c-yes', o).onclick = () => { o.remove(); this.paused = false; this.restart(false); };
    });
  }
  confirmLeave() {
    if (this.over || this.state.plies === 0 || this.kind === 'practice') { App.go(this.kind === 'practice' ? 'learn' : 'menu'); return; }
    this.paused = true; this.render();
    this.dialog(`<h2>Leave this match?</h2><p style="color:var(--ink-dim)">${this.kind === 'online' ? 'Your opponent will be told you left.' : 'Your progress in this match will be lost.'}</p><div class="stack"><button class="btn danger" id="c-yes">Leave match</button><button class="btn primary" id="c-no">Keep playing</button></div>`, (o, close) => {
      $('#c-no', o).onclick = close;
      $('#c-yes', o).onclick = () => { o.remove(); this.paused = false; App.go('menu'); };
    });
  }
}
