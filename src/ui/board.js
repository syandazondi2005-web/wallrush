/* =====================================================================
   WALL RUSH — BOARD RENDERER (presentation only; never decides legality)
   ===================================================================== */

const CS = 100;      // tile size
const GR = 16;       // groove (wall channel) width
const PITCH = CS + GR;
const FR = 72;       // frame thickness

class Board {
  /* opts: { n, count, host, labels, onCell(r,c), onPawn(i), onClick(pt,e), onHover(pt|null), onKey(e), label } */
  constructor(host, opts) {
    this.host = host; this.o = opts;
    this.n = opts.n; this.count = opts.count;
    this.inner = this.n * CS + (this.n - 1) * GR;
    this.size = this.inner + FR * 2;
    this.wallKeys = new Set();
    this.build();
  }

  tx(c) { return FR + c * PITCH; }
  ty(r) { return FR + r * PITCH; }

  wallRect(o, r, c) {
    if (o === 'h') return { x: this.tx(c), y: this.ty(r) + CS - 3, w: 2 * CS + GR, h: GR + 6 };
    return { x: this.tx(c) + CS - 3, y: this.ty(r), w: GR + 6, h: 2 * CS + GR };
  }

  build() {
    const n = this.n, S = this.size, I = this.inner;
    let tiles = '', starts = '', labels = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      tiles += `<rect class="b-tile ${(r + c) % 2 ? 'alt' : ''}" x="${this.tx(c)}" y="${this.ty(r)}" width="${CS}" height="${CS}" rx="11"/>`;
    }
    const seats = RULES.modes[this.count].sides;
    const mid = (n - 1) >> 1;
    const startCell = side => side === 'S' ? [n - 1, mid] : side === 'N' ? [0, mid] : side === 'W' ? [mid, 0] : [mid, n - 1];
    seats.forEach((side, i) => {
      const [r, c] = startCell(side);
      starts += `<rect class="b-start" data-start="${i}" x="${this.tx(c) + 8}" y="${this.ty(r) + 8}" width="${CS - 16}" height="${CS - 16}" rx="12" stroke="${PLAYERS[i].dark}"/>`;
    });

    // goal bands on the frame, one per player, always labelled and shaped
    let bands = '';
    const bandT = 24, off = 8;
    seats.forEach((side, i) => {
      const P = PLAYERS[i], edge = GOAL_EDGE[side];
      const label = `${P.name.toUpperCase()} GOAL`;
      const glyph = (cx, cy) => `<g transform="translate(${cx - 12} ${cy - 12}) scale(.24)"><path d="${SHAPE_PATH[P.shape]}" fill="${P.dark}" stroke="#fff" stroke-opacity=".7" stroke-width="6" stroke-linejoin="round"/></g>`;
      let x, y, w, h, rot = 0;
      if (edge === 'top') { x = FR; y = off; w = I; h = bandT; }
      if (edge === 'bottom') { x = FR; y = S - FR + FR - off - bandT; w = I; h = bandT; }
      if (edge === 'left') { x = off; y = FR; w = bandT; h = I; rot = -90; }
      if (edge === 'right') { x = S - off - bandT; y = FR; w = bandT; h = I; rot = 90; }
      const long = rot ? h : w;
      const cx = x + w / 2, cy = y + h / 2;
      const inner = `<text class="band-label" x="0" y="7" text-anchor="middle">${label}</text>${glyph(-long / 2 + 40, 0)}${glyph(long / 2 - 40, 0)}${glyph(-150, 0)}${glyph(150, 0)}`;
      bands += `<g data-goal="${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="url(#pg${i})" stroke="${P.dark}" stroke-width="2.5"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="url(#pp${i})" opacity=".5"/><g transform="translate(${cx} ${cy}) rotate(${rot})">${inner}</g></g>`;
    });

    if (this.o.labels) {
      const letters = 'ABCDEFGHI';
      for (let c = 0; c < n; c++) labels += `<text class="b-label" x="${this.tx(c) + CS / 2}" y="${S - FR + 24}" text-anchor="middle">${letters[c]}</text>`;
      for (let r = 0; r < n; r++) labels += `<text class="b-label" x="${FR - 24}" y="${this.ty(r) + CS / 2 + 7}" text-anchor="middle">${n - r}</text>`;
    }

    const ring = `M12 12 H${S - 12} V${S - 12} H12 Z M${FR - 14} ${FR - 14} V${S - FR + 14} H${S - FR + 14} V${FR - 14} Z`;
    this.host.innerHTML = `
      <svg viewBox="0 0 ${S} ${S}" role="group" tabindex="0" aria-label="${esc(this.o.label || 'Wall Rush board')}">
        <rect width="${S}" height="${S}" rx="34" fill="url(#frameGrad)"/>
        <rect width="${S}" height="${S}" rx="34" fill="#000" filter="url(#woodgrain)" opacity=".5"/>
        <path d="${ring}" fill="url(#lattice)" fill-rule="evenodd"/>
        <rect x="5" y="5" width="${S - 10}" height="${S - 10}" rx="30" fill="none" stroke="rgba(255,225,160,.35)" stroke-width="2.5"/>
        ${bands}${labels}
        <rect x="${FR - 7}" y="${FR - 7}" width="${I + 14}" height="${I + 14}" rx="12" fill="var(--groove)" stroke="rgba(0,0,0,.6)" stroke-width="3"/>
        <g data-layer="grooves"></g>
        ${tiles}
        <rect x="${FR}" y="${FR}" width="${I}" height="${I}" rx="10" fill="#000" filter="url(#grain)" opacity=".55" pointer-events="none"/>
        ${starts}
        <g data-layer="hilite"></g>
        <g data-layer="last"></g>
        <g data-layer="routes"></g>
        <g data-layer="targets"></g>
        <g data-layer="walls"></g>
        <g data-layer="ghost"></g>
        <g data-layer="pawns"></g>
      </svg>`;
    this.svg = $('svg', this.host);
    this.L = {};
    $$('[data-layer]', this.svg).forEach(g => { this.L[g.dataset.layer] = g; });
    this.pawnEls = [];
    this.L.pawns.innerHTML = RULES.modes[this.count].sides.map((_, i) =>
      `<g class="pawn" data-pawn="${i}" role="button" aria-label="${esc(pdesc(i))} pawn"><circle class="turnring" cx="50" cy="50" r="47" stroke="${PLAYERS[i].light}"/><circle class="selring" cx="50" cy="50" r="46"/>${pawnArt(i)}</g>`).join('');
    this.pawnEls = $$('.pawn', this.L.pawns);

    this.svg.addEventListener('click', e => {
      const t = e.target.closest('[data-move]');
      if (t) return this.o.onCell && this.o.onCell(+t.dataset.r, +t.dataset.c, e);
      const p = e.target.closest('[data-pawn]');
      if (p && this.o.onPawn) { this.o.onPawn(+p.dataset.pawn, e); return; }
      this.o.onClick && this.o.onClick(this.toSvg(e), e);
    });
    this.svg.addEventListener('pointermove', e => { if (e.pointerType !== 'touch' && this.o.onHover) this.o.onHover(this.toSvg(e)); });
    this.svg.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && this.o.onHover) this.o.onHover(null); });
    this.svg.addEventListener('keydown', e => this.o.onKey && this.o.onKey(e));
    this.L.targets.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.move != null) { e.preventDefault(); e.stopPropagation(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    });
  }

  toSvg(e) {
    const m = this.svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  /* The tile under a point, or null when over a groove or the frame. */
  cellAt(pt) {
    const lx = pt.x - FR, ly = pt.y - FR;
    if (lx < 0 || ly < 0) return null;
    const c = Math.floor(lx / PITCH), r = Math.floor(ly / PITCH);
    if (c >= this.n || r >= this.n) return null;
    if (lx - c * PITCH > CS || ly - r * PITCH > CS) return null;
    return { r, c };
  }

  /* Nearest wall slot to a point: snaps to the closest groove, 2 tiles long. */
  slotAt(pt, prefer) {
    const n = this.n, m = n - 1;
    const lx = clamp(pt.x - FR, 0, this.inner), ly = clamp(pt.y - FR, 0, this.inner);
    const gr = clamp(Math.round((ly - CS - GR / 2) / PITCH), 0, m - 1);   // horizontal groove line index
    const gc = clamp(Math.round((lx - CS - GR / 2) / PITCH), 0, m - 1);   // vertical groove line index
    const dh = Math.abs(ly - (gr * PITCH + CS + GR / 2));
    const dv = Math.abs(lx - (gc * PITCH + CS + GR / 2));
    let o = dh <= dv ? 'h' : 'v';
    if (Math.abs(dh - dv) < 8) o = prefer || 'h';   // near a crossing, keep the last orientation (default horizontal)
    if (o === 'h') return { o, r: gr, c: clamp(Math.round((lx - CS - GR / 2) / PITCH), 0, m - 1) };
    return { o, c: gc, r: clamp(Math.round((ly - CS - GR / 2) / PITCH), 0, m - 1) };
  }

  wallMarkup(o, r, c, owner, cls = '') {
    const { x, y, w, h } = this.wallRect(o, r, c);
    const P = PLAYERS[owner] || PLAYERS[0];
    const horiz = o === 'h';
    const grad = horiz ? 'woodH' : 'woodV';
    const inlay = horiz
      ? `<rect x="${x + 26}" y="${y + h / 2 - 3.5}" width="${w - 52}" height="7" rx="3.5" fill="${P.color}" stroke="${P.dark}" stroke-width="1"/><path d="M${x + w / 2 - 6} ${y + h / 2} l6 -6 l6 6 l-6 6 z" fill="${P.light}" stroke="${P.dark}" stroke-width="1"/>`
      : `<rect x="${x + w / 2 - 3.5}" y="${y + 26}" width="7" height="${h - 52}" rx="3.5" fill="${P.color}" stroke="${P.dark}" stroke-width="1"/><path d="M${x + w / 2} ${y + h / 2 - 6} l6 6 l-6 6 l-6 -6 z" fill="${P.light}" stroke="${P.dark}" stroke-width="1"/>`;
    const caps = horiz
      ? `<rect x="${x + 3}" y="${y + 3}" width="10" height="${h - 6}" rx="3" fill="url(#brass)"/><rect x="${x + w - 13}" y="${y + 3}" width="10" height="${h - 6}" rx="3" fill="url(#brass)"/>`
      : `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="10" rx="3" fill="url(#brass)"/><rect x="${x + 3}" y="${y + h - 13}" width="${w - 6}" height="10" rx="3" fill="url(#brass)"/>`;
    const shine = horiz
      ? `<rect x="${x + 16}" y="${y + 3}" width="${w - 32}" height="2.5" rx="1" fill="rgba(255,255,255,.3)"/>`
      : `<rect x="${x + 3}" y="${y + 16}" width="2.5" height="${h - 32}" rx="1" fill="rgba(255,255,255,.3)"/>`;
    return `<g class="wall ${cls}" data-o="${o}" data-r="${r}" data-c="${c}">
      <rect x="${x + 2}" y="${y + 5}" width="${w}" height="${h}" rx="9" fill="rgba(0,0,0,.42)"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="url(#${grad})" stroke="#1b1008" stroke-width="2.2"/>
      ${caps}${inlay}${shine}</g>`;
  }

  /* view: { targets, strong, ghost, routes, last, hilite, selected, turn, winner, focusTargets } */
  update(state, view = {}) {
    const n = this.n, m = n - 1;
    const doAnim = !this._first;
    this._first = true;

    // pawns (persistent elements so they glide between tiles)
    state.players.forEach((p, i) => {
      const el = this.pawnEls[i];
      el.style.transform = `translate(${this.tx(p.c)}px, ${this.ty(p.r)}px)`;
      el.classList.toggle('sel', view.selected === i);
      el.classList.toggle('turn', view.turn === i && state.winner < 0);
      el.classList.toggle('win', state.winner === i);
      el.setAttribute('aria-label', `${pdesc(i)} pawn at ${'ABCDEFGHI'[p.c]}${n - p.r}${view.selected === i ? ', selected' : ''}`);
    });
    // keep the acting pawn on top
    if (view.turn != null) this.L.pawns.appendChild(this.pawnEls[view.turn]);

    // walls
    const keys = new Set();
    let html = '';
    for (const o of ['h', 'v']) {
      const arr = o === 'h' ? state.h : state.v;
      for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) {
        const v = arr[r * m + c];
        if (!v) continue;
        const k = `${o}${r}_${c}`;
        keys.add(k);
        html += this.wallMarkup(o, r, c, v - 1, doAnim && !this.wallKeys.has(k) ? 'drop' : '');
      }
    }
    this.wallKeys = keys;
    this.L.walls.innerHTML = html;

    // legal targets
    let t = '';
    (view.targets || []).forEach(g => {
      const cx = this.tx(g.c), cy = this.ty(g.r);
      t += `<g class="b-target ${view.strong ? 'strong' : ''}" data-move="1" data-r="${g.r}" data-c="${g.c}" tabindex="0" role="button" aria-label="Move to ${'ABCDEFGHI'[g.c]}${n - g.r}">
        <rect x="${cx - 8}" y="${cy - 8}" width="${CS + 16}" height="${CS + 16}" rx="14" fill="transparent"/>
        <circle class="halo" cx="${cx + CS / 2}" cy="${cy + CS / 2}" r="${view.strong ? 24 : 18}"/><path class="dot" d="M${cx + 50} ${cy + 41} l9 9 l-9 9 l-9 -9 z"/></g>`;
    });
    this.L.targets.innerHTML = t;

    // last move
    this.L.last.innerHTML = view.last ? [view.last.from, view.last.to].map(q => `<rect class="b-last" x="${this.tx(q.c)}" y="${this.ty(q.r)}" width="${CS}" height="${CS}" rx="11"/>`).join('') : '';

    // routes
    this.L.routes.innerHTML = (view.routes || []).map(rt => {
      const pts = rt.cells.map(q => `${this.tx(q.c) + CS / 2},${this.ty(q.r) + CS / 2}`).join(' ');
      return `<polyline class="route" points="${pts}" stroke="${PLAYERS[rt.pi].light}" style="stroke:${PLAYERS[rt.pi].light}"/>`;
    }).join('');

    // highlights for lessons
    let hl = '', gr = '';
    const H = view.hilite || {};
    if (H.tiles) for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) hl += `<rect class="b-hl" x="${this.tx(c) + 3}" y="${this.ty(r) + 3}" width="${CS - 6}" height="${CS - 6}" rx="9" style="stroke-width:4"/>`;
    if (H.cells) H.cells.forEach(q => { hl += `<rect class="b-hl" x="${this.tx(q.c) + 3}" y="${this.ty(q.r) + 3}" width="${CS - 6}" height="${CS - 6}" rx="9"/>`; });
    if (H.grooves) {
      for (let i = 0; i < m; i++) {
        gr += `<rect class="b-hl" style="fill:rgba(255,213,122,.55);stroke:none" x="${FR}" y="${this.ty(i) + CS}" width="${this.inner}" height="${GR}"/>`;
        gr += `<rect class="b-hl" style="fill:rgba(255,213,122,.55);stroke:none" x="${this.tx(i) + CS}" y="${FR}" width="${GR}" height="${this.inner}"/>`;
      }
    }
    if (H.starts) $$('[data-start]', this.svg).forEach(el => { el.style.opacity = 1; el.style.strokeWidth = 7; });
    else $$('[data-start]', this.svg).forEach(el => { el.style.opacity = ''; el.style.strokeWidth = ''; });
    if (H.goals) $$('[data-goal]', this.svg).forEach(el => el.classList.add('b-hl-goal')); else $$('[data-goal]', this.svg).forEach(el => el.classList.remove('b-hl-goal'));
    this.L.hilite.innerHTML = hl;
    this.L.grooves.innerHTML = gr;

    // ghost wall
    const g = view.ghost;
    if (g) {
      const { x, y, w, h } = this.wallRect(g.o, g.r, g.c);
      const cx = x + w / 2, cy = y + h / 2;
      const P = PLAYERS[g.pi != null ? g.pi : state.turn];
      const badge = g.valid
        ? `<circle cx="${cx}" cy="${cy}" r="24" fill="#153b27" stroke="#c9ffe1" stroke-width="4"/><polyline points="${cx - 11},${cy} ${cx - 3},${cy + 9} ${cx + 12},${cy - 9}" fill="none" stroke="#c9ffe1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<circle cx="${cx}" cy="${cy}" r="24" fill="#4a120b" stroke="#ffd0c7" stroke-width="4"/><path d="M${cx - 10} ${cy - 10} L${cx + 10} ${cy + 10} M${cx + 10} ${cy - 10} L${cx - 10} ${cy + 10}" stroke="#ffd0c7" stroke-width="6" stroke-linecap="round"/>`;
      this.L.ghost.innerHTML = `<g class="${g.valid ? 'ghost-valid' : 'ghost-bad'}" pointer-events="none">
        <rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="11" fill="none" stroke="${g.valid ? P.light : '#ffd0c7'}" stroke-width="5" ${g.valid ? '' : 'stroke-dasharray="12 9"'}/>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${g.valid ? P.color : 'url(#hatch)'}" stroke="#1b1008" stroke-width="2"/>${badge}</g>`;
    } else this.L.ghost.innerHTML = '';
  }

  shake() {
    this.host.classList.remove('shake'); void this.host.offsetWidth; this.host.classList.add('shake');
    setTimeout(() => this.host.classList.remove('shake'), 400);
  }
}
