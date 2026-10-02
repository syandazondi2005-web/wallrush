/* =====================================================================
   WALL RUSH — LEARN: interactive lessons on a real board
   Every task is checked against the same engine the matches use.
   ===================================================================== */

/* Build a lesson position: pawn spots and pre-placed walls. */
function scene({ p1, p2, walls = [], turn = 0 }) {
  const s = newGame(2, { first: turn });
  if (p1) { s.players[0].r = p1[0]; s.players[0].c = p1[1]; }
  if (p2) { s.players[1].r = p2[0]; s.players[1].c = p2[1]; }
  const m = s.n - 1;
  walls.forEach(([o, r, c]) => { (o === 'h' ? s.h : s.v)[r * m + c] = 1; });
  s._F = null;
  return s;
}

const LESSONS = [
  {
    id: 'objective', title: 'The objective',
    steps: [{
      html: `<h3>Cross the board before your rival does</h3>
        <p>Each pawn starts in the middle of one edge and must reach the <b>opposite edge</b>. The first pawn to arrive wins.</p>
        <p>You are <b>Gold</b>, the diamond with the sun mark, starting at the bottom. Sky, the hexagon with the wave mark, starts at the top. The coloured bands on the board frame show each player's goal edge, and they are labelled with the player's name and shape.</p>`,
      setup: () => scene({}), tools: 'none', hilite: { goals: true, starts: true }, task: null
    }]
  },
  {
    id: 'layout', title: 'The board',
    steps: [{
      html: `<h3>Tiles, grooves and edges</h3>
        <p>The board is a 9 by 9 grid of stone tiles. Between the tiles run narrow <b>grooves</b>. Pawns stand on tiles; walls sit in grooves.</p>
        <p>Use the buttons under the board to light up each part.</p>`,
      setup: () => scene({}), tools: 'none', toggles: true, task: null
    }]
  },
  {
    id: 'movement', title: 'Moving your pawn',
    steps: [
      {
        html: `<h3>One tile at a time</h3>
          <p>On your turn you may move your pawn one tile up, down, left or right, as long as no wall or board edge is in the way. The glowing diamonds show every tile you can reach.</p>`,
        setup: () => scene({}), tools: 'move', autoPass: true,
        task: {
          prompt: 'Move your pawn forward three times. Click a glowing tile each time.',
          check: (ev, c) => {
            if (ev.type !== 'ok') return null;
            c.count = (c.count || 0) + 1;
            return c.count >= 3 ? { done: true, msg: 'Three moves made. Each turn is one action, so a long trip takes many turns.' } : { msg: `Move ${c.count} of 3.` };
          }
        }
      },
      {
        html: `<h3>Jumping over a pawn</h3>
          <p>If a pawn stands directly in front of you, you may <b>jump</b> straight over it to the tile behind, provided nothing blocks that jump.</p>`,
        setup: () => scene({ p1: [5, 4], p2: [4, 4] }), tools: 'move', autoPass: true,
        task: { prompt: 'Jump over Sky. Click the glowing tile behind their pawn.', check: ev => ev.type === 'ok' ? (ev.event.jumped ? { done: true, msg: 'Jumped. That saved you a step.' } : { msg: 'That was a plain step. Try the tile behind Sky.' }) : null }
      },
      {
        html: `<h3>Stepping around a pawn</h3>
          <p>If a wall or the board edge blocks the jump, you may step <b>diagonally</b>: to the side of the pawn in front of you, when nothing blocks that side step.</p>`,
        setup: () => scene({ p1: [5, 4], p2: [4, 4], walls: [['h', 3, 4]] }), tools: 'move', autoPass: true,
        task: { prompt: 'A wall sits behind Sky, so a straight jump is blocked. Step diagonally around them.', check: ev => ev.type === 'ok' ? (ev.event.to.c !== 4 ? { done: true, msg: 'Side-step made. Blocked jumps become diagonal steps.' } : { msg: 'Pick one of the diagonal tiles beside Sky.' }) : null }
      }
    ]
  },
  {
    id: 'walls', title: 'Placing a wall',
    steps: [{
      html: `<h3>Spend your turn on a barrier</h3>
        <p>Instead of moving, you may place one wall. A wall is <b>two tiles long</b> and sits in the grooves. Each player has a limited stock: 10 walls in a two-player match, 5 in a four-player match.</p>
        <p>With a mouse, point at a groove and click. On a touch screen, tap a groove to preview, use <b>Rotate wall</b> to change direction, then confirm.</p>`,
      setup: () => scene({}), tools: 'both', autoPass: true, startMode: 'wall',
      task: {
        prompt: 'Place a wall directly in front of Sky to lengthen their route.',
        check: (ev, c) => {
          if (ev.type !== 'ok' || ev.event.type !== 'wall') return null;
          const a = routeLength(ev.before, 1), b = routeLength(ev.after, 1);
          return b > a ? { done: true, msg: `Sky's route grew from ${a} to ${b} steps.` } : { msg: 'That wall did not slow Sky down. Reset the step and place it right in front of their pawn.' };
        }
      }
    }]
  },
  {
    id: 'legal', title: 'Legal and illegal walls',
    steps: [
      {
        html: `<h3>Rule 1: walls never overlap</h3>
          <p>Two walls cannot share the same stretch of groove. Even sliding a wall one tile along still overlaps if it covers part of the old one.</p>`,
        setup: () => scene({ walls: [['h', 3, 3]] }), tools: 'wall', autoPass: true, startMode: 'wall',
        task: { prompt: 'Try to place a horizontal wall that overlaps the existing wall.', check: ev => ev.type === 'fail' ? (ev.code === 'overlap' ? { done: true, msg: 'Refused: overlapping walls are illegal.' } : { msg: 'Refused, but for a different reason. Aim along the existing horizontal wall.' }) : (ev.type === 'ok' ? { msg: 'That wall was legal. Reset the step and aim at the existing wall.' } : null) }
      },
      {
        html: `<h3>Rule 2: walls never cross</h3>
          <p>A vertical wall cannot cut through the middle of a horizontal wall, and the other way round.</p>`,
        setup: () => scene({ walls: [['h', 3, 3]] }), tools: 'wall', autoPass: true, startMode: 'wall',
        task: { prompt: 'Try to place a vertical wall through the middle of the existing wall.', check: ev => ev.type === 'fail' ? (ev.code === 'cross' ? { done: true, msg: 'Refused: walls may not cross.' } : { msg: 'Refused, but not for crossing. Aim at the exact middle of the existing wall.' }) : (ev.type === 'ok' ? { msg: 'That wall was legal. Reset the step and aim at the middle of the existing wall.' } : null) }
      },
      {
        html: `<h3>Rule 3: never seal a pawn in</h3>
          <p>Every pawn must always keep at least one open route to its goal edge. A wall that would close the last route is refused.</p>`,
        setup: () => scene({ p2: [0, 4], walls: [['v', 0, 3], ['v', 0, 4]] }), tools: 'wall', autoPass: true, startMode: 'wall',
        task: { prompt: 'Sky is in a narrow corridor. Try to close the gap below it, between the second and third rows.', check: ev => ev.type === 'fail' ? (ev.code === 'trap' ? { done: true, msg: 'Refused: that would leave Sky with no route to the goal.' } : { msg: 'Refused for another reason. Aim just below the corridor walls, spanning both columns.' }) : (ev.type === 'ok' ? { msg: 'That wall was legal. Reset the step and close the corridor below Sky.' } : null) }
      }
    ]
  },
  {
    id: 'blocking', title: 'Blocking strategy',
    steps: [{
      html: `<h3>Make their journey longer than yours</h3>
        <p>A good wall does not just stand in the way: it forces a <b>detour</b>. The dotted lines show each pawn's shortest route right now. Watch how they change as you build.</p>
        <p>Walls that extend an existing barrier usually force the longest detours.</p>`,
      setup: () => scene({ p1: [7, 4], p2: [3, 4], walls: [['h', 4, 2]] }), tools: 'both', autoPass: true, startMode: 'wall', routes: true,
      task: {
        prompt: 'Sky is ahead in the race. Place a wall that adds at least 2 steps to Sky\'s route.',
        check: ev => {
          if (ev.type !== 'ok' || ev.event.type !== 'wall') return null;
          const d = routeLength(ev.after, 1) - routeLength(ev.before, 1);
          return d >= 2 ? { done: true, msg: `Excellent: Sky now needs ${d} extra steps.` } : { msg: `That adds ${d} step${d === 1 ? '' : 's'}. Reset the step and try extending the existing barrier.` };
        }
      }
    }]
  },
  {
    id: 'planning', title: 'Planning ahead',
    steps: [{
      html: `<h3>Count the race before every turn</h3>
        <p>Compare the number of steps each pawn still needs, and remember <b>who moves next</b>. If both simply run, the pawn with fewer steps left wins, and on a tie the player to move wins.</p>`,
      setup: () => scene({ p1: [5, 6], p2: [4, 2], walls: [['h', 4, 0]] }), tools: 'both', autoPass: false, startMode: 'wall', routes: true,
      quiz: { q: 'Gold needs 5 steps, Sky needs 4, and Gold moves first. If nobody builds any walls, who wins?', options: ['Gold', 'Sky', 'It is a tie'], answer: 1, explain: 'Sky wins. Gold makes its 5th move only after Sky has already made its 4th, so Sky arrives first.' },
      task: {
        prompt: 'Turn the race around: place one wall so Gold now wins a straight race.',
        check: ev => {
          if (ev.type !== 'ok' || ev.event.type !== 'wall') return null;
          const g = routeLength(ev.after, 0), k = routeLength(ev.after, 1);
          return g < k ? { done: true, msg: `Gold needs ${g}, Sky needs ${k} and Sky moves next. Gold wins the race. That is planning ahead.` } : { msg: `Gold needs ${g}, Sky needs ${k}, and Sky moves next. Sky still wins. Reset the step and look for a wall that costs Sky 2 steps.` };
        }
      }
    }]
  },
  {
    id: 'win', title: 'How to win',
    steps: [{
      html: `<h3>Put it together</h3>
        <p>Reach the opposite edge first. On every turn, do the one thing that improves the race the most: advance, jump, or spend a wall to cost your rival more steps than it costs you.</p>
        <p>Walls are limited, so save them for moments that swing the race. When you are ready, try the practice board, where walls are unlimited and any action can be undone.</p>`,
      setup: () => scene({}), tools: 'none', finale: true, task: null
    }]
  }
];

class LessonView extends BoardController {
  constructor(root, step, cb) {
    const state = step.setup();
    root.innerHTML = `
      <div class="mini"><div class="board-host" id="lboard"></div></div>
      <div class="hint-line" id="lhint" aria-hidden="true"></div>
      <div class="row" id="ltools" style="justify-content:center"></div>`;
    super($('#lboard', root), state, { free: true, routes: !!step.routes, onHint: (t, k) => { const h = $('#lhint', root); if (h) { h.textContent = t || ''; h.className = 'hint-line ' + (k || ''); } }, label: 'Lesson board' });
    this.root = root; this.step = step; this.cb = cb;
    this.count = 0; this.done = !step.task; this.quizOk = !step.quiz;
    this.hl = { ...(step.hilite || {}) };
    this.buildTools();
    if (step.startMode === 'wall') {
      if (step.tools === 'both') this.lmode('wall');
      else this.mode = 'wall';
    }
    this.render();
  }
  canAct() { return this.step.tools !== 'none' && this.quizOk && this.state.winner < 0; }
  viewExtras() { return { hilite: this.hl }; }
  unlock() { this.quizOk = true; this.render(); }

  buildTools() {
    const T = $('#ltools', this.root), st = this.step;
    let h = '';
    if (st.tools === 'both') h += `<button class="btn" id="l-move" aria-pressed="true">Move pawn</button><button class="btn" id="l-wall" aria-pressed="false">Place wall</button>`;
    if (st.tools === 'wall' || st.tools === 'both') h += `<button class="btn" id="l-rot" ${st.tools === 'both' ? 'hidden' : ''}>⟳ Rotate wall</button>`;
    if (Settings.wantsConfirm() && (st.tools === 'wall' || st.tools === 'both')) h += `<button class="btn primary" id="l-ok" ${st.tools === 'both' ? 'hidden' : ''}>Place wall</button>`;
    if (st.toggles) h += ['tiles:Tiles', 'grooves:Grooves', 'starts:Start tiles', 'goals:Goal edges'].map(x => { const [k, l] = x.split(':'); return `<button class="btn" data-hl="${k}" aria-pressed="false">${l}</button>`; }).join('');
    if (st.task) h += `<button class="btn ghost" id="l-reset">Reset step</button>`;
    T.innerHTML = h;
    const q = id => $(id, T);
    if (q('#l-move')) q('#l-move').onclick = () => this.lmode('move');
    if (q('#l-wall')) q('#l-wall').onclick = () => this.lmode('wall');
    if (q('#l-rot')) q('#l-rot').onclick = () => this.rotateGhost();
    if (q('#l-ok')) q('#l-ok').onclick = () => this.confirmWall();
    if (q('#l-reset')) q('#l-reset').onclick = () => this.reset();
    $$('[data-hl]', T).forEach(b => { b.onclick = () => { const k = b.dataset.hl; this.hl[k] = !this.hl[k]; b.setAttribute('aria-pressed', !!this.hl[k]); this.render(); }; });
  }
  lmode(m) {
    this.setMode(m);
    const T = $('#ltools', this.root);
    $('#l-move', T) && $('#l-move', T).setAttribute('aria-pressed', m === 'move');
    $('#l-wall', T) && $('#l-wall', T).setAttribute('aria-pressed', m === 'wall');
    $('#l-rot', T) && ($('#l-rot', T).hidden = m !== 'wall');
    $('#l-ok', T) && ($('#l-ok', T).hidden = m !== 'wall');
  }
  reset() {
    this.state = this.step.setup(); this.count = 0; this.last = null; this.ghost = null; this.selected = null;
    this.mode = this.step.startMode || 'move';
    this.done = false; this.cb.onReset && this.cb.onReset();
    if (this.step.tools === 'both') this.lmode(this.mode);
    this.render();
  }

  commit(move) {
    const before = this.state;
    const res = play(before, before.turn, move, { free: true });
    if (!res.ok) { this.evalTask({ type: 'fail', code: res.code, move }); return res; }
    let after = res.state;
    if (this.step.autoPass && after.turn !== 0 && after.winner < 0) { after = cloneState(after); after.turn = 0; }
    this.state = after; this.selected = null; this.ghost = null;
    this.last = res.event.type === 'move' ? { from: res.event.from, to: res.event.to } : null;
    Sound.play(res.event.type === 'wall' ? 'wall' : (res.event.jumped ? 'jump' : 'move'));
    if (this.step.tools === 'wall') this.mode = 'wall';
    else if (this.step.tools === 'move') this.mode = 'move';
    this.render();
    this.evalTask({ type: 'ok', move, event: res.event, before, after });
    return res;
  }
  evalTask(ev) {
    const t = this.step.task; if (!t) return;
    const r = t.check(ev, this);
    if (!r) return;
    if (r.msg) this.cb.onInfo(r.msg, r.done ? 'good' : (ev.type === 'fail' || r.msg.includes('Reset') ? 'bad' : 'info'));
    if (r.done && !this.done) { this.done = true; Sound.play('win'); this.cb.onDone(); }
  }
}
