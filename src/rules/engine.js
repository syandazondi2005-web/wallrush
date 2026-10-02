/* =====================================================================
   WALL RUSH — RULES ENGINE
   Pure game logic. No DOM. Everything the UI needs to know about what
   is legal lives here, so the interface can never allow an illegal act.

   RULESET STATUS: PROVISIONAL.
   No Wall Rush rules file was available in the project, so every number
   below is isolated in RULES and can be replaced without touching the
   engine, AI or UI. The Rules screen reads these values directly.
   ===================================================================== */

const RULES = {
  provisional: true,
  wallLength: 2, // a wall spans two tiles
  modes: {
    2: { size: 9, wallsEach: 10, sides: ['S', 'N'] },
    4: { size: 9, wallsEach: 5, sides: ['S', 'W', 'N', 'E'] }
  },
  // Movement: one tile up/down/left/right. An adjacent pawn may be jumped;
  // if the jump is blocked, a sideways step around that pawn is allowed.
  // Winning: first pawn to reach the opposite edge.
  // Walls: may not overlap, cross, or leave any pawn without a route.
  // Extra: if a player has no legal action at all, the turn passes.
};

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function makePlayers(n, count, first) {
  const mid = (n - 1) >> 1;
  const sides = RULES.modes[count].sides;
  return sides.map((side, id) => {
    const base = { id, side, walls: RULES.modes[count].wallsEach };
    if (side === 'S') return { ...base, r: n - 1, c: mid, goal: { axis: 'r', val: 0 } };
    if (side === 'N') return { ...base, r: 0, c: mid, goal: { axis: 'r', val: n - 1 } };
    if (side === 'W') return { ...base, r: mid, c: 0, goal: { axis: 'c', val: n - 1 } };
    return { ...base, r: mid, c: n - 1, goal: { axis: 'c', val: 0 } };
  });
}

function newGame(count, opts = {}) {
  const cfg = RULES.modes[count];
  const n = opts.size || cfg.size;
  const m = n - 1;
  return {
    n,
    count,
    players: makePlayers(n, count),
    h: new Uint8Array(m * m), // horizontal wall at (r,c): between rows r and r+1, spans cols c..c+1
    v: new Uint8Array(m * m), // vertical wall at (r,c): between cols c and c+1, spans rows r..r+1
    turn: opts.first || 0,
    winner: -1,
    plies: 0,
    _F: null
  };
}

function cloneState(s) {
  return {
    n: s.n, count: s.count,
    players: s.players.map(p => ({ ...p })),
    h: s.h.slice(), v: s.v.slice(),
    turn: s.turn, winner: s.winner, plies: s.plies,
    _F: s._F
  };
}

/* ---------- geometry ---------- */

function isBlocked(s, r, c, dr, dc) {
  const n = s.n, m = n - 1;
  const r2 = r + dr, c2 = c + dc;
  if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n) return true;
  if (dr !== 0) {
    const wr = dr < 0 ? r - 1 : r;
    if (c < m && s.h[wr * m + c]) return true;
    if (c > 0 && s.h[wr * m + c - 1]) return true;
  } else {
    const wc = dc < 0 ? c - 1 : c;
    if (r < m && s.v[r * m + wc]) return true;
    if (r > 0 && s.v[(r - 1) * m + wc]) return true;
  }
  return false;
}

function occupiedBy(s, r, c) {
  for (let i = 0; i < s.players.length; i++) {
    const p = s.players[i];
    if (p.r === r && p.c === c) return i;
  }
  return -1;
}

function atGoal(p) {
  return p.goal.axis === 'r' ? p.r === p.goal.val : p.c === p.goal.val;
}

/* Legal pawn destinations for player pi (jump and side-step rules included). */
function pawnMoves(s, pi) {
  const p = s.players[pi];
  const out = [];
  const seen = new Set();
  const add = (r, c) => {
    const k = r * 32 + c;
    if (!seen.has(k)) { seen.add(k); out.push({ r, c }); }
  };
  for (const [dr, dc] of DIRS) {
    if (isBlocked(s, p.r, p.c, dr, dc)) continue;
    const r1 = p.r + dr, c1 = p.c + dc;
    if (occupiedBy(s, r1, c1) < 0) { add(r1, c1); continue; }
    if (!isBlocked(s, r1, c1, dr, dc) && occupiedBy(s, r1 + dr, c1 + dc) < 0) {
      add(r1 + dr, c1 + dc);
    } else {
      const sides = dr !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
      for (const [er, ec] of sides) {
        if (isBlocked(s, r1, c1, er, ec)) continue;
        if (occupiedBy(s, r1 + er, c1 + ec) < 0) add(r1 + er, c1 + ec);
      }
    }
  }
  return out;
}

/* ---------- routes ---------- */

/* Distance field: steps from every tile to the player's goal edge, walls only. */
function distField(s, pi) {
  const n = s.n, g = s.players[pi].goal;
  const f = new Int16Array(n * n).fill(-1);
  const q = new Int16Array(n * n);
  let qh = 0, qt = 0;
  for (let i = 0; i < n; i++) {
    const idx = g.axis === 'r' ? g.val * n + i : i * n + g.val;
    f[idx] = 0; q[qt++] = idx;
  }
  while (qh < qt) {
    const cur = q[qh++];
    const r = (cur / n) | 0, c = cur - r * n;
    const d = f[cur] + 1;
    for (let k = 0; k < 4; k++) {
      const dr = DIRS[k][0], dc = DIRS[k][1];
      if (isBlocked(s, r, c, dr, dc)) continue;
      const nx = (r + dr) * n + (c + dc);
      if (f[nx] < 0) { f[nx] = d; q[qt++] = nx; }
    }
  }
  return f;
}

function fieldsFor(s) {
  if (!s._F) s._F = s.players.map((_, i) => distField(s, i));
  return s._F;
}

function routeLength(s, pi) {
  const p = s.players[pi];
  return fieldsFor(s)[pi][p.r * s.n + p.c];
}

/* One shortest route as a list of tiles, start to goal. */
function shortestRoute(s, pi) {
  const f = fieldsFor(s)[pi], n = s.n;
  const p = s.players[pi];
  let r = p.r, c = p.c, d = f[r * n + c];
  const out = [{ r, c }];
  while (d > 0) {
    let moved = false;
    for (const [dr, dc] of DIRS) {
      if (isBlocked(s, r, c, dr, dc)) continue;
      if (f[(r + dr) * n + (c + dc)] === d - 1) {
        r += dr; c += dc; d--; out.push({ r, c }); moved = true; break;
      }
    }
    if (!moved) break;
  }
  return out;
}

/* ---------- walls ---------- */

/* Geometry-only wall check. Returns null when fine, otherwise a reason code:
   bounds | overlap | cross | trap */
function wallProblem(s, o, r, c) {
  const m = s.n - 1;
  if (r < 0 || c < 0 || r >= m || c >= m) return 'bounds';
  const same = o === 'h' ? s.h : s.v;
  const other = o === 'h' ? s.v : s.h;
  const i = r * m + c;
  if (same[i]) return 'overlap';
  if (o === 'h') {
    if (c > 0 && same[i - 1]) return 'overlap';
    if (c < m - 1 && same[i + 1]) return 'overlap';
  } else {
    if (r > 0 && same[i - m]) return 'overlap';
    if (r < m - 1 && same[i + m]) return 'overlap';
  }
  if (other[i]) return 'cross';
  same[i] = 1;
  let trapped = false;
  const t = { n: s.n, h: s.h, v: s.v, players: s.players, _F: null };
  for (let pi = 0; pi < s.players.length; pi++) {
    const p = s.players[pi];
    if (distField(t, pi)[p.r * s.n + p.c] < 0) { trapped = true; break; }
  }
  same[i] = 0;
  return trapped ? 'trap' : null;
}

/* Full check for the player whose turn it is. */
function wallCheck(s, o, r, c) {
  if (s.winner >= 0) return 'over';
  if (s.players[s.turn].walls <= 0) return 'nowalls';
  return wallProblem(s, o, r, c);
}

function anyLegalWall(s) {
  const m = s.n - 1;
  if (s.players[s.turn].walls <= 0) return false;
  for (const o of ['h', 'v'])
    for (let r = 0; r < m; r++)
      for (let c = 0; c < m; c++)
        if (wallProblem(s, o, r, c) === null) return true;
  return false;
}

/* ---------- playing a move ---------- */

/* move: {type:'move', r, c} | {type:'wall', o:'h'|'v', r, c}
   Returns {ok:true, state, event} or {ok:false, code}. */
function play(s, pi, move, opts = {}) {
  if (s.winner >= 0) return { ok: false, code: 'over' };
  if (pi !== s.turn) return { ok: false, code: 'turn' };
  const ns = cloneState(s);
  const p = ns.players[pi];
  let event;
  if (move.type === 'move') {
    const legal = pawnMoves(s, pi).some(t => t.r === move.r && t.c === move.c);
    if (!legal) return { ok: false, code: 'badmove' };
    const from = { r: p.r, c: p.c };
    const dist = Math.abs(from.r - move.r) + Math.abs(from.c - move.c);
    p.r = move.r; p.c = move.c;
    event = { type: 'move', player: pi, from, to: { r: p.r, c: p.c }, jumped: dist > 1 };
    if (atGoal(p)) ns.winner = pi;
  } else if (move.type === 'wall') {
    const code = opts.free ? wallProblem(s, move.o, move.r, move.c) : wallCheck(s, move.o, move.r, move.c);
    if (code) return { ok: false, code };
    const m = s.n - 1;
    (move.o === 'h' ? ns.h : ns.v)[move.r * m + move.c] = pi + 1; // owner, 1-based
    if (!opts.free) p.walls--;
    ns._F = null;
    event = { type: 'wall', player: pi, o: move.o, r: move.r, c: move.c };
  } else {
    return { ok: false, code: 'badmove' };
  }
  ns.plies = s.plies + 1;
  if (ns.winner < 0) ns.turn = (pi + 1) % ns.players.length;
  return { ok: true, state: ns, event };
}

/* True when the player to move has no legal action. */
function mustPass(s) {
  if (s.winner >= 0) return false;
  if (pawnMoves(s, s.turn).length) return false;
  return !anyLegalWall(s);
}

function passTurn(s) {
  const ns = cloneState(s);
  ns.turn = (s.turn + 1) % s.players.length;
  return ns;
}

const WALL_MESSAGES = {
  bounds: 'That wall would sit outside the board.',
  overlap: 'That wall overlaps another wall.',
  cross: 'That wall would cross another wall.',
  trap: 'That wall would leave a pawn with no route to its goal.',
  nowalls: 'You have no walls left. Move your pawn instead.',
  over: 'The match is over.',
  turn: 'It is not your turn.',
  badmove: 'Your pawn cannot move there.'
};

/* Node test hook */
if (typeof module !== 'undefined') {
  module.exports = {
    RULES, newGame, cloneState, isBlocked, pawnMoves, distField, fieldsFor, routeLength,
    shortestRoute, wallProblem, wallCheck, play, mustPass, passTurn, anyLegalWall, atGoal, occupiedBy, DIRS
  };
}
