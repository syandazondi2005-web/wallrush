/* =====================================================================
   WALL RUSH — CORE: settings, storage, sound, identity art, stats
   (deployment config lives in src/config.js)
   ===================================================================== */

/* ---------- tiny helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const isCoarse = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

/* ---------- safe storage (private mode, blocked storage, etc.) ---------- */
const Store = {
  mem: {}, ok: true,
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { this.ok = false; return key in this.mem ? this.mem[key] : fallback; }
  },
  set(key, val) {
    this.mem[key] = val;
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { this.ok = false; }
  }
};

/* ---------- settings ---------- */
const DEFAULT_SETTINGS = { sound: true, volume: 0.6, theme: 'night', labels: true, routes: false, motion: 'auto', contrast: false, large: false, confirmWalls: 'auto' };
const Settings = {
  v: { ...DEFAULT_SETTINGS, ...Store.get('wr.settings.v1', {}) },
  set(k, val) { this.v[k] = val; Store.set('wr.settings.v1', this.v); this.apply(); },
  apply() {
    const d = document.documentElement;
    d.dataset.theme = this.v.theme;
    d.dataset.motion = this.v.motion === 'reduce' ? 'reduce' : 'auto';
    d.dataset.contrast = this.v.contrast ? 'high' : 'normal';
    d.classList.toggle('large', !!this.v.large);
  },
  wantsConfirm() { return this.v.confirmWalls === 'always' || (this.v.confirmWalls === 'auto' && isCoarse()); }
};

/* ---------- sound (all synthesised, all optional) ---------- */
const Sound = {
  ctx: null,
  ensure() {
    if (!Settings.v.sound) return null;
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch (e) { return null; }
  },
  tone(freq, dur, type = 'sine', vol = .5, delay = 0, slideTo = null) {
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const peak = vol * Settings.v.volume * .32;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), t0 + .012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + .03);
  },
  noise(dur, vol = .4, delay = 0, cutoff = 700) {
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain(); g.gain.value = vol * Settings.v.volume * .4;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0);
  },
  play(kind) {
    if (!Settings.v.sound) return;
    switch (kind) {
      case 'move': this.tone(330, .09, 'triangle', .7, 0, 210); this.noise(.05, .25, 0, 1800); break;
      case 'jump': this.tone(300, .08, 'triangle', .7, 0, 200); this.tone(420, .1, 'triangle', .6, .07, 300); break;
      case 'wall': this.tone(120, .18, 'sine', 1, 0, 70); this.noise(.14, .8, 0, 600); break;
      case 'invalid': this.tone(170, .13, 'square', .35, 0, 130); this.tone(150, .13, 'square', .3, .1, 110); break;
      case 'turn': this.tone(520, .12, 'sine', .35); this.tone(690, .16, 'sine', .3, .09); break;
      case 'win': [392, 494, 587, 784].forEach((f, i) => this.tone(f, .34, 'triangle', .7, i * .13)); break;
      case 'lose': [330, 277, 233].forEach((f, i) => this.tone(f, .3, 'sine', .55, i * .16)); break;
    }
  }
};

/* ---------- live region + toast ---------- */
let _toastTimer = 0;
function toast(msg, kind = '') {
  const el = $('#toast');
  el.className = 'toast show ' + kind;
  el.textContent = msg;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), kind === 'bad' ? 3400 : 2400);
  announce(msg);
}
function announce(msg) { const l = $('#live'); if (l) { l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); } }

/* ---------- player identity: colour + shape + symbol + pattern ---------- */
const PLAYERS = [
  { key: 'gold', name: 'Gold', color: '#E8A317', dark: '#7d4f04', light: '#ffe08f', shape: 'diamond', shapeName: 'diamond', symbol: 'sun', pattern: 0 },
  { key: 'sky',  name: 'Sky',  color: '#5AA9E6', dark: '#1b5688', light: '#c3e2fa', shape: 'hexagon', shapeName: 'hexagon', symbol: 'wave', pattern: 1 },
  { key: 'jade', name: 'Jade', color: '#3FB58A', dark: '#12603f', light: '#b6f0d6', shape: 'gable',   shapeName: 'gable',   symbol: 'chevron', pattern: 2 },
  { key: 'rose', name: 'Rose', color: '#D46A9A', dark: '#7b2a52', light: '#f6c4da', shape: 'block',   shapeName: 'block',   symbol: 'grid', pattern: 3 }
];
const SIDE_EDGE = { S: 'bottom', N: 'top', W: 'left', E: 'right' };
const GOAL_EDGE = { S: 'top', N: 'bottom', W: 'right', E: 'left' };
const pdesc = i => `${PLAYERS[i].name} ${PLAYERS[i].shapeName}`;

const SHAPE_PATH = {
  diamond: 'M50 10 L88 50 L50 90 L12 50 Z',
  hexagon: 'M50 10 L85 30 L85 70 L50 90 L15 70 L15 30 Z',
  gable: 'M50 10 L90 84 L10 84 Z',
  block: 'M26 16 H74 Q84 16 84 26 V74 Q84 84 74 84 H26 Q16 84 16 74 V26 Q16 16 26 16 Z'
};

function symbolMarkup(kind, dy = 0) {
  const ink = 'rgba(30,17,6,.82)', hi = 'rgba(255,255,255,.35)';
  const wrap = inner => `<g transform="translate(0 ${dy})" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(0.8 1.4)" stroke="${hi}" fill="${hi}">${inner}</g><g stroke="${ink}" fill="${ink}">${inner}</g></g>`;
  if (kind === 'sun') {
    let rays = '';
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; rays += `<line x1="${50 + Math.cos(a) * 12}" y1="${50 + Math.sin(a) * 12}" x2="${50 + Math.cos(a) * 19}" y2="${50 + Math.sin(a) * 19}" stroke-width="4"/>`; }
    return wrap(`<circle cx="50" cy="50" r="7" stroke="none"/>${rays}`);
  }
  if (kind === 'wave') return wrap('<polyline points="33,45 41.5,38 50,45 58.5,38 67,45" fill="none" stroke-width="4.5"/><polyline points="33,60 41.5,53 50,60 58.5,53 67,60" fill="none" stroke-width="4.5"/>');
  if (kind === 'chevron') return wrap('<polyline points="34,58 50,44 66,58" fill="none" stroke-width="5"/><polyline points="34,70 50,56 66,70" fill="none" stroke-width="5"/>');
  let dots = '';
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) dots += `<circle cx="${38 + a * 12}" cy="${38 + b * 12}" r="3.6" stroke="none"/>`;
  return wrap(dots);
}

/* Pawn artwork in a 0..100 box. */
function pawnArt(i) {
  const P = PLAYERS[i];
  const d = SHAPE_PATH[P.shape];
  const dy = P.shape === 'gable' ? 6 : 0;
  return `
    <ellipse cx="50" cy="88" rx="30" ry="7" fill="rgba(0,0,0,.38)"/>
    <g class="body">
      <path d="${d}" fill="url(#pg${i})" stroke="${P.dark}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="${d}" fill="url(#pp${i})" opacity=".55"/>
      <path d="${d}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2" transform="translate(50 50) scale(.86) translate(-50 -50)"/>
      ${symbolMarkup(P.symbol, dy)}
    </g>`;
}
function pawnIcon(i, cls = 'pawn-ico') {
  return `<svg class="${cls}" viewBox="0 0 100 100" role="img" aria-label="${esc(pdesc(i))}">${pawnArt(i)}</svg>`;
}

/* Shared SVG definitions (gradients, patterns, filters) injected once. */
function sharedDefs() {
  let pg = '', pp = '';
  const patterns = [
    '<path d="M-2 14 L14 -2 M-2 8 L8 -2 M8 14 L14 8" stroke="#000" stroke-width="2.2" fill="none"/>',
    '<circle cx="4" cy="4" r="1.7" fill="#000"/><circle cx="10" cy="10" r="1.7" fill="#000"/>',
    '<path d="M0 3.5 H12 M0 9.5 H12" stroke="#000" stroke-width="2" fill="none"/>',
    '<path d="M0 6 H12 M6 0 V12" stroke="#000" stroke-width="1.6" fill="none"/>'
  ];
  PLAYERS.forEach((P, i) => {
    pg += `<linearGradient id="pg${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.light}"/><stop offset=".5" stop-color="${P.color}"/><stop offset="1" stop-color="${P.dark}"/></linearGradient>`;
    pp += `<pattern id="pp${i}" width="12" height="12" patternUnits="userSpaceOnUse" opacity=".4">${patterns[P.pattern]}</pattern>`;
  });
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    ${pg}${pp}
    <linearGradient id="stoneGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--stone-a)"/><stop offset="1" style="stop-color:var(--stone-b)"/></linearGradient>
    <linearGradient id="stoneGrad2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--stone-a)"/><stop offset="1" style="stop-color:var(--stone-b)"/></linearGradient>
    <linearGradient id="frameGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--frame-a)"/><stop offset="1" style="stop-color:var(--frame-b)"/></linearGradient>
    <linearGradient id="woodH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a32"/><stop offset=".45" style="stop-color:var(--wood-a)"/><stop offset="1" style="stop-color:var(--wood-b)"/></linearGradient>
    <linearGradient id="woodV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5a32"/><stop offset=".45" style="stop-color:var(--wood-a)"/><stop offset="1" style="stop-color:var(--wood-b)"/></linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6a3"/><stop offset=".5" stop-color="#dda83f"/><stop offset="1" stop-color="#8e5f14"/></linearGradient>
    <pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#8e1f12"/><rect width="6" height="14" fill="#ff8a75" opacity=".85"/></pattern>
    <pattern id="lattice" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M18 3 L33 18 L18 33 L3 18Z" fill="none" stroke="rgba(255,225,160,.22)" stroke-width="1.6"/><path d="M18 12 L24 18 L18 24 L12 18Z" fill="rgba(255,225,160,.22)"/></pattern>
    <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 .2  0 0 0 0 .13  0 0 0 0 .05  0 0 0 .7 -.22"/></filter>
    <filter id="woodgrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".008 .16" numOctaves="3" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 -.32"/></filter>
  </defs></svg>`;
}

/* ---------- statistics ---------- */
const emptyRec = () => ({ played: 0, wins: 0, losses: 0, best: null });
const Stats = {
  d: null,
  load() {
    const base = { v: 1, advanced: emptyRec(), expert: emptyRec(), online: emptyRec(), local2: { played: 0, seatWins: [0, 0] }, local4: { played: 0, seatWins: [0, 0, 0, 0] } };
    this.d = Object.assign(base, Store.get('wr.stats.v1', {}));
    return this.d;
  },
  save() { Store.set('wr.stats.v1', this.d); },
  /* turns = how many turns the winner took; only wins set a "best". */
  record({ kind, won, turns, winnerSeat }) {
    if (!this.d) this.load();
    const D = this.d;
    if (kind === 'local2' || kind === 'local4') {
      D[kind].played++; D[kind].seatWins[winnerSeat] = (D[kind].seatWins[winnerSeat] || 0) + 1;
    } else {
      const r = D[kind]; r.played++;
      if (won) { r.wins++; if (r.best == null || turns < r.best) r.best = turns; } else r.losses++;
    }
    this.save();
  },
  reset() { Store.set('wr.stats.v1', null); this.d = null; this.load(); }
};

/* title lockup: used on every screen where the title is presented */
function lockup(size = 'md', extra = '') {
  return `<span class="lockup ${size} ${extra}"><span class="sr-only">Wall Rush by Zondi</span><span class="t" aria-hidden="true">${size === 'lg' ? 'WALL<br>RUSH' : 'WALL RUSH'}</span><span class="steps" aria-hidden="true"></span><span class="by" aria-hidden="true">by Zondi</span></span>`;
}
