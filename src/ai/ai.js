/* =====================================================================
   WALL RUSH — AI OPPONENTS (two-player board)

   Advanced  One-move lookahead with real route analysis. It blocks along
             the opponent's shortest routes, rushes when it is ahead, reacts
             to how the human plays (racer vs. wall-builder), and makes the
             occasional human-like slip. Beatable by design.

   Expert    Iterative-deepening alpha-beta search (up to 4 plies) over
             pawn moves and walls on the opponent's route network. It
             models the opponent's best replies, counts alternative routes,
             treats each wall as a resource to conserve, and breaks near-ties
             at random so it is consistent but not predictable.
   ===================================================================== */

/* All edges lying on any shortest route of player pi, as wall candidates. */
function routeWallCandidates(s, pi) {
  const n = s.n, m = n - 1;
  const f = fieldsFor(s)[pi];
  const p = s.players[pi];
  const seenCell = new Uint8Array(n * n);
  const seenWall = new Set();
  const out = [];
  const stack = [[p.r, p.c]];
  seenCell[p.r * n + p.c] = 1;
  while (stack.length) {
    const [r, c] = stack.pop();
    const d = f[r * n + c];
    if (d <= 0) continue;
    for (const [dr, dc] of DIRS) {
      if (isBlocked(s, r, c, dr, dc)) continue;
      const r2 = r + dr, c2 = c + dc;
      if (f[r2 * n + c2] !== d - 1) continue;
      // wall slots that cut this edge
      const slots = [];
      if (dr !== 0) {
        const wr = Math.min(r, r2);
        slots.push(['h', wr, c - 1], ['h', wr, c]);
      } else {
        const wc = Math.min(c, c2);
        slots.push(['v', r - 1, wc], ['v', r, wc]);
      }
      for (const [o, wr, wc] of slots) {
        if (wr < 0 || wc < 0 || wr >= m || wc >= m) continue;
        const key = o + wr * 16 + wc;
        if (seenWall.has(key)) continue;
        seenWall.add(key);
        out.push({ type: 'wall', o, r: wr, c: wc });
      }
      if (!seenCell[r2 * n + c2]) { seenCell[r2 * n + c2] = 1; stack.push([r2, c2]); }
    }
  }
  return out;
}

/* Apply a move for search. Returns child state or null when illegal. */
function searchApply(s, move) {
  const pi = s.turn;
  const ns = cloneState(s);
  const p = ns.players[pi];
  if (move.type === 'move') {
    p.r = move.r; p.c = move.c;
    if (atGoal(p)) ns.winner = pi;
  } else {
    const m = s.n - 1;
    if (p.walls <= 0) return null;
    if (wallProblem(s, move.o, move.r, move.c)) return null;
    (move.o === 'h' ? ns.h : ns.v)[move.r * m + move.c] = 1;
    p.walls--;
    ns._F = null;
  }
  if (ns.winner < 0) ns.turn = (pi + 1) % ns.players.length;
  return ns;
}

/* Static evaluation from player x's point of view (antisymmetric). */
function staticEval(s, x) {
  const y = 1 - x;
  const F = fieldsFor(s);
  const n = s.n;
  const px = s.players[x], py = s.players[y];
  const dx = F[x][px.r * n + px.c], dy = F[y][py.r * n + py.c];
  let flex = 0;
  const mx = pawnMoves(s, x), my = pawnMoves(s, y);
  for (const t of mx) if (F[x][t.r * n + t.c] < dx) flex++;
  for (const t of my) if (F[y][t.r * n + t.c] < dy) flex--;
  let v = (dy - dx) + 0.12 * (px.walls - py.walls) + 0.1 * flex;
  // With no walls left an opponent can only race; nothing to fear from behind.
  if (py.walls === 0 && dy > dx) v += 0.4;
  v += s.turn === x ? 0.4 : -0.4;
  return v;
}

/* Ordered, trimmed move list for the side to move. */
function orderedMoves(s, K, me) {
  const pi = s.turn, opp = 1 - pi;
  const list = [];
  for (const t of pawnMoves(s, pi)) {
    const ch = searchApply(s, { type: 'move', r: t.r, c: t.c });
    if (!ch) continue;
    ch._F = s._F;
    list.push({ move: { type: 'move', r: t.r, c: t.c }, child: ch });
  }
  if (s.players[pi].walls > 0) {
    fieldsFor(s);
    for (const w of routeWallCandidates(s, opp)) {
      const ch = searchApply(s, w);
      if (ch) list.push({ move: w, child: ch });
    }
  }
  for (const e of list) {
    e.score = e.child.winner >= 0 ? 1000 : staticEvalFor(e.child, pi);
  }
  list.sort((a, b) => b.score - a.score);
  return K ? list.slice(0, K) : list;
}

function staticEvalFor(child, mover) { return staticEval(child, mover); }

let _deadline = 0;
function negamax(s, depth, alpha, beta) {
  // s.turn is the side to move. Returns score from their point of view.
  if (Date.now() > _deadline) throw new Error('timeout');
  const mvs = orderedMoves(s, depth >= 3 ? 10 : 8);
  if (!mvs.length) return -50;
  if (depth <= 1) return mvs[0].score;
  let best = -Infinity;
  for (const e of mvs) {
    let v;
    if (e.child.winner >= 0) v = 1000 + depth;
    else v = -negamax(e.child, depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function expertChoose(s, opts = {}) {
  const budget = opts.budgetMs || 900;
  const maxDepth = opts.maxDepth || 4;
  const margin = 0.22;
  _deadline = Date.now() + budget;
  const root = orderedMoves(s, 16);
  if (!root.length) return null;
  let best = { list: root.map(e => ({ move: e.move, score: e.score })), depth: 1 };
  // A move that wins now is always taken.
  const win = root.find(e => e.child.winner >= 0);
  if (win) return win.move;
  try {
    for (let depth = 2; depth <= maxDepth; depth++) {
      const scored = [];
      let top = -Infinity;
      for (const e of root) {
        const v = -negamax(e.child, depth - 1, -Infinity, -(top - margin));
        scored.push({ move: e.move, score: v });
        if (v > top) top = v;
      }
      best = { list: scored, depth };
    }
  } catch (err) {
    if (err.message !== 'timeout') throw err;
  }
  const top = Math.max(...best.list.map(x => x.score));
  const near = best.list.filter(x => x.score >= top - margin);
  // Near-equal moves: weighted random pick keeps play consistent but unpredictable.
  const weights = near.map(x => Math.exp((x.score - top) * 4));
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = Math.random() * total;
  for (let i = 0; i < near.length; i++) { pick -= weights[i]; if (pick <= 0) return near[i].move; }
  return near[0].move;
}

/* ---------------- Advanced ---------------- */

function advancedChoose(s, profile = {}) {
  const me = s.turn, opp = 1 - me;
  const n = s.n;
  const F = fieldsFor(s);
  const dm = F[me][s.players[me].r * n + s.players[me].c];
  const dop = F[opp][s.players[opp].r * n + s.players[opp].c];
  const myWalls = s.players[me].walls;

  // How the human plays shapes how freely the computer spends walls.
  const wallsUsed = profile.humanWallsUsed || 0;
  const humanBuilder = wallsUsed >= 5;
  let wallCost = 0.55;
  if (humanBuilder) wallCost = 0.9;          // human is boxing us in: keep running
  if (dop <= 3) wallCost = 0.1;               // human is close to winning: defend
  if (dop < dm) wallCost = Math.min(wallCost, 0.3); // behind in the race: block more

  const cands = [];
  for (const t of pawnMoves(s, me)) {
    const ch = searchApply(s, { type: 'move', r: t.r, c: t.c });
    if (!ch) continue;
    ch._F = s._F;
    const won = ch.winner >= 0;
    const nd = F[me][t.r * n + t.c];
    cands.push({ move: { type: 'move', r: t.r, c: t.c }, score: won ? 999 : (dop - nd) + 0.05 * (nd < dm ? 1 : 0), wall: false });
  }
  const skipWalls = Math.random() < 0.1 && dop > 3; // occasionally overlooks a block
  if (myWalls > 0 && !skipWalls) {
    for (const w of routeWallCandidates(s, opp)) {
      const ch = searchApply(s, w);
      if (!ch) continue;
      const F2 = fieldsFor(ch);
      const nop = F2[opp][ch.players[opp].r * n + ch.players[opp].c];
      const nme = F2[me][ch.players[me].r * n + ch.players[me].c];
      const gain = nop - dop, loss = nme - dm;
      if (gain - loss < 1) continue; // must actually cost the opponent tempo
      cands.push({ move: w, score: (nop - nme) - wallCost - 0.15 * loss, wall: true });
    }
  }
  if (!cands.length) return null;
  cands.forEach(c => { c.score += Math.random() * 0.25; });
  cands.sort((a, b) => b.score - a.score);
  // Human-like slip: sometimes plays the second or third best idea.
  if (cands.length > 1 && cands[0].score < 900 && Math.random() < 0.13) {
    return cands[1 + Math.floor(Math.random() * Math.min(2, cands.length - 1))].move;
  }
  return cands[0].move;
}

function aiChoose(s, level, profile) {
  return level === 'expert' ? expertChoose(s) : advancedChoose(s, profile);
}

if (typeof module !== 'undefined') {
  module.exports = { aiChoose, expertChoose, advancedChoose, routeWallCandidates };
}
