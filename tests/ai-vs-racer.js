const E = require('../src/rules/engine.js'); Object.assign(global, E);
const A = require('../src/ai/ai.js'); Object.assign(global, A);
function racer(s) { const me = s.turn, F = fieldsFor(s); const ts = pawnMoves(s, me).sort((a,b)=>F[me][a.r*s.n+a.c]-F[me][b.r*s.n+b.c]); return { type:'move', r:ts[0].r, c:ts[0].c }; }
function game(level, aiSeat) {
  let st = newGame(2), plies = 0;
  while (st.winner < 0 && plies < 250) {
    if (mustPass(st)) { st = passTurn(st); continue; }
    const mv = st.turn === aiSeat ? aiChoose(st, level, { humanWallsUsed: 0 }) : racer(st);
    const r = play(st, st.turn, mv); if (!r.ok) throw new Error('illegal'); st = r.state; plies++;
  }
  return st.winner === aiSeat;
}
for (const level of ['advanced', 'expert']) { let w = 0; const N = 30; for (let g = 0; g < N; g++) if (game(level, g % 2)) w++; console.log(level, 'vs pure racer:', w + '/' + N); }
