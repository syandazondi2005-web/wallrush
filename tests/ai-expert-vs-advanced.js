const E = require('../src/rules/engine.js'); Object.assign(global, E);
const A = require('../src/ai/ai.js'); Object.assign(global, A);
function game(lv0, lv1) {
  let st = newGame(2), plies = 0; const lv = [lv0, lv1];
  while (st.winner < 0 && plies < 250) {
    if (mustPass(st)) { st = passTurn(st); continue; }
    const mv = aiChoose(st, lv[st.turn], { humanWallsUsed: 0 });
    if (!mv) { st = passTurn(st); continue; }
    const r = play(st, st.turn, mv); if (!r.ok) throw new Error('illegal ' + JSON.stringify(mv));
    st = r.state; plies++;
  }
  return st.winner;
}
let exp = 0, adv = 0, none = 0;
const N = 30;
for (let g = 0; g < N; g++) {
  const expSeat = g % 2;
  const w = expSeat === 0 ? game('expert', 'advanced') : game('advanced', 'expert');
  if (w < 0) none++; else if (w === expSeat) exp++; else adv++;
}
console.log(`Expert ${exp}  Advanced ${adv}  unfinished ${none}  (of ${N})`);
