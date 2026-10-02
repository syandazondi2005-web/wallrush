const E = require('../src/rules/engine.js');
Object.assign(global, E);
const A = require('../src/ai/ai.js');
Object.assign(global, A);

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

// --- basic setup
let s = newGame(2);
ok(s.players[0].r === 8 && s.players[0].c === 4, 'P1 starts bottom middle');
ok(s.players[1].r === 0 && s.players[1].c === 4, 'P2 starts top middle');
ok(pawnMoves(s, 0).length === 3, 'start has 3 moves (edge)');
ok(routeLength(s, 0) === 8 && routeLength(s, 1) === 8, 'route length 8 each');

// --- turn enforcement, out of board, double move
let r = play(s, 1, { type: 'move', r: 1, c: 4 });
ok(!r.ok && r.code === 'turn', 'cannot act out of turn');
r = play(s, 0, { type: 'move', r: 9, c: 4 });
ok(!r.ok && r.code === 'badmove', 'cannot move outside the board');
r = play(s, 0, { type: 'move', r: 6, c: 4 });
ok(!r.ok, 'cannot move two tiles');
r = play(s, 0, { type: 'move', r: 7, c: 4 });
ok(r.ok && r.state.turn === 1, 'legal move passes turn');
r = play(r.state, 0, { type: 'move', r: 6, c: 4 });
ok(!r.ok && r.code === 'turn', 'no second move in a turn');

// --- wall legality
s = newGame(2);
let w = play(s, 0, { type: 'wall', o: 'h', r: 3, c: 3 });
ok(w.ok && w.state.players[0].walls === 9, 'wall placed, count decremented');
let s2 = w.state; s2.turn = 0;
ok(wallCheck(s2, 'h', 3, 3) === 'overlap', 'same slot overlap');
ok(wallCheck(s2, 'h', 3, 4) === 'overlap', 'shifted overlap right');
ok(wallCheck(s2, 'h', 3, 2) === 'overlap', 'shifted overlap left');
ok(wallCheck(s2, 'v', 3, 3) === 'cross', 'crossing');
ok(wallCheck(s2, 'h', 3, 5) === null, 'adjacent non-overlap ok');
ok(wallCheck(s2, 'h', 8, 0) === 'bounds', 'out of bounds');

// --- trap prevention: box P2 in at top middle
s = newGame(2); s.turn = 0;
const put = (o, r, c) => { const m = s.n - 1; (o === 'h' ? s.h : s.v)[r * m + c] = 1; s._F = null; };
// P2 at (0,4). Wall it: v walls left and right, h wall below
put('v', 0, 3); put('v', 0, 4); // left & right of (0,4) rows 0..1
ok(wallCheck(s, 'h', 1, 3) === 'trap', 'sealing a pocket around a pawn is refused');
ok(wallCheck(s, 'h', 0, 3) === 'cross', 'crossing takes priority in that slot');
ok(wallProblem(s, 'h', 5, 0) === null, 'unrelated wall fine');

// --- jumps & side-steps
s = newGame(2);
s.players[0].r = 4; s.players[0].c = 4; s.players[1].r = 3; s.players[1].c = 4;
let mv = pawnMoves(s, 0).map(t => t.r + ',' + t.c).sort();
ok(mv.includes('2,4'), 'straight jump over adjacent pawn');
put('h', 2, 4); // wall behind opponent (between rows 2 and 3), covers cols 4-5
mv = pawnMoves(s, 0).map(t => t.r + ',' + t.c).sort();
ok(!mv.includes('2,4') && mv.includes('3,3') && mv.includes('3,5'), 'diagonal side-steps when jump blocked');

// --- win detection
s = newGame(2);
s.players[0].r = 1; s.players[0].c = 4; s.players[1].r = 0; s.players[1].c = 0;
r = play(s, 0, { type: 'move', r: 0, c: 4 });
ok(r.ok && r.state.winner === 0, 'reaching far edge wins');
ok(!play(r.state, 1, { type: 'move', r: 1, c: 0 }).ok, 'no play after win');

// --- 4-player
s = newGame(4);
ok(s.players.length === 4 && s.players[1].side === 'W', '4p seats S,W,N,E');
ok(routeLength(s, 1) === 8 && routeLength(s, 3) === 8, '4p route lengths');
let t = s;
for (let i = 0; i < 4; i++) { const mvv = pawnMoves(t, t.turn)[0]; t = play(t, t.turn, { type: 'move', r: mvv.r, c: mvv.c }).state; }
ok(t.turn === 0, '4p turn order cycles');

// --- AI sanity: legality over many random games + timing
function playGame(levelA, levelB, maxPlies = 300) {
  let st = newGame(2), plies = 0, times = { advanced: [], expert: [] };
  const lv = [levelA, levelB];
  while (st.winner < 0 && plies < maxPlies) {
    if (mustPass(st)) { st = passTurn(st); continue; }
    const level = lv[st.turn];
    const t0 = Date.now();
    const mvv = aiChoose(st, level, { humanWallsUsed: 0 });
    times[level].push(Date.now() - t0);
    if (!mvv) { st = passTurn(st); continue; }
    const res = play(st, st.turn, mvv);
    if (!res.ok) { console.log('AI made ILLEGAL move', mvv, res.code); fails++; return null; }
    st = res.state; plies++;
  }
  return { winner: st.winner, plies, times };
}
let wins = { adv: 0, exp: 0, draw: 0 }, maxT = 0, avgT = [];
for (let g = 0; g < 6; g++) {
  const expFirst = g % 2 === 0;
  const res = expFirst ? playGame('expert', 'advanced') : playGame('advanced', 'expert');
  if (!res) continue;
  const expIdx = expFirst ? 0 : 1;
  if (res.winner < 0) wins.draw++; else if (res.winner === expIdx) wins.exp++; else wins.adv++;
  res.times.expert.forEach(x => { maxT = Math.max(maxT, x); avgT.push(x); });
  console.log(`game ${g}: winner=${res.winner} expertSeat=${expIdx} plies=${res.plies}`);
}
console.log('Expert vs Advanced', wins, 'expert max ms', maxT, 'avg', Math.round(avgT.reduce((a,b)=>a+b,0)/avgT.length));
console.log('(Expert vs Advanced is sampled in bench.js; 6 games is too few to assert on)');

// --- fuzz: random legal play in 2p and 4p never breaks the route invariant
function fuzz(count, games) {
  for (let g = 0; g < games; g++) {
    let st = newGame(count), guard = 0;
    while (st.winner < 0 && guard++ < 400) {
      if (mustPass(st)) { st = passTurn(st); continue; }
      const acts = [];
      pawnMoves(st, st.turn).forEach(t => acts.push({ type: 'move', r: t.r, c: t.c }));
      if (Math.random() < 0.5 && st.players[st.turn].walls > 0) {
        const o = Math.random() < 0.5 ? 'h' : 'v';
        acts.push({ type: 'wall', o, r: (Math.random() * 8) | 0, c: (Math.random() * 8) | 0 });
      }
      const a = acts[(Math.random() * acts.length) | 0];
      const res = play(st, st.turn, a);
      if (!res.ok) continue;
      st = res.state;
      for (let pi = 0; pi < st.players.length; pi++)
        if (routeLength(st, pi) < 0) { fails++; console.log('ROUTE BROKEN', count, g); return; }
    }
  }
  console.log('fuzz ok', count + 'p');
}
fuzz(2, 60); fuzz(4, 60);
console.log(fails ? `${fails} FAILURES` : 'ALL PASSED');
