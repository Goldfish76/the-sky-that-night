// Vector export. SvgContext implements the subset of the Canvas 2D API that render.js uses and records
// every call as SVG, so the same renderer produces both the PNG and the SVG. Fonts actually used by the
// text are embedded (only the needed unicode-range slices), so the file renders the same in any browser.

const TAU = Math.PI * 2;

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const n = v => (Math.round(v * 100) / 100).toString();

// Split "rgba(r,g,b,a)" etc. into an SVG colour plus opacity (some editors ignore rgba()).
function paint(c) {
  if (typeof c !== 'string') return { color: c, opacity: 1 };
  const m = c.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map(x => x.trim());
    return { color: `rgb(${r},${g},${b})`, opacity: parseFloat(a) };
  }
  return { color: c, opacity: 1 };
}

class Gradient {
  constructor(ctx, x0, y0, r0, x1, y1, r1) {
    this.ctx = ctx;
    this.m = ctx.state.m.slice();
    Object.assign(this, { x0, y0, r0, x1, y1, r1 });
    this.stops = [];
  }
  addColorStop(offset, color) { this.stops.push([offset, color]); }
  ref() {
    if (!this.id) {
      const id = this.ctx.newId('g');
      const [a, b, c, d, e, f] = this.m;
      const k = Math.hypot(a, b);
      const tp = (x, y) => [a * x + c * y + e, b * x + d * y + f];
      const [cx, cy] = tp(this.x1, this.y1), [fx, fy] = tp(this.x0, this.y0);
      const stops = this.stops.map(([o, col]) => {
        const p = paint(col);
        return `<stop offset="${n(o)}" stop-color="${p.color}" stop-opacity="${n(p.opacity)}"/>`;
      }).join('');
      this.ctx.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}" r="${n(this.r1 * k)}" fx="${n(fx)}" fy="${n(fy)}" fr="${n(this.r0 * k)}">${stops}</radialGradient>`);
      this.id = id;
    }
    return `url(#${this.id})`;
  }
}

export class SvgContext {
  constructor() {
    this.isVector = true;
    this.defs = [];
    this.body = [];
    this.count = 0;
    this.fonts = new Map(); // "family|weight|style" -> Set of characters
    this.stack = [];
    this.state = {
      fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', dash: [],
      font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', globalAlpha: 1, filter: 'none',
      m: [1, 0, 0, 1, 0, 0], clip: null,
    };
    this.d = '';
    this.hasPoint = false;
    this.measurer = document.createElement('canvas').getContext('2d');
  }

  newId(p) { return `${p}${++this.count}`; }

  // --- state ---
  get fillStyle() { return this.state.fillStyle; } set fillStyle(v) { this.state.fillStyle = v; }
  get strokeStyle() { return this.state.strokeStyle; } set strokeStyle(v) { this.state.strokeStyle = v; }
  get lineWidth() { return this.state.lineWidth; } set lineWidth(v) { this.state.lineWidth = v; }
  get lineCap() { return this.state.lineCap; } set lineCap(v) { this.state.lineCap = v; }
  get lineJoin() { return this.state.lineJoin; } set lineJoin(v) { this.state.lineJoin = v; }
  get font() { return this.state.font; } set font(v) { this.state.font = v; }
  get textAlign() { return this.state.textAlign; } set textAlign(v) { this.state.textAlign = v; }
  get textBaseline() { return this.state.textBaseline; } set textBaseline(v) { this.state.textBaseline = v; }
  get globalAlpha() { return this.state.globalAlpha; } set globalAlpha(v) { this.state.globalAlpha = v; }
  get filter() { return this.state.filter; } set filter(v) { this.state.filter = v; }
  setLineDash(a) { this.state.dash = a.slice(); }
  save() { this.stack.push({ ...this.state, m: this.state.m.slice(), dash: this.state.dash.slice() }); }
  restore() { if (this.stack.length) this.state = this.stack.pop(); }
  setTransform(a, b, c, d, e, f) { this.state.m = [a, b, c, d, e, f]; }
  translate(x, y) { const [a, b, c, d, e, f] = this.state.m; this.state.m = [a, b, c, d, a * x + c * y + e, b * x + d * y + f]; }
  rotate(t) {
    const [a, b, c, d, e, f] = this.state.m, cs = Math.cos(t), sn = Math.sin(t);
    this.state.m = [a * cs + c * sn, b * cs + d * sn, -a * sn + c * cs, -b * sn + d * cs, e, f];
  }
  tp(x, y) { const [a, b, c, d, e, f] = this.state.m; return [a * x + c * y + e, b * x + d * y + f]; }
  scale() { const [a, b] = this.state.m; return Math.hypot(a, b); }
  angle() { const [a, b] = this.state.m; return Math.atan2(b, a); }

  // --- paths (stored in user space) ---
  beginPath() { this.d = ''; this.hasPoint = false; }
  moveTo(x, y) { const [X, Y] = this.tp(x, y); this.d += `M${n(X)} ${n(Y)}`; this.hasPoint = true; }
  lineTo(x, y) {
    const [X, Y] = this.tp(x, y);
    this.d += `${this.hasPoint ? 'L' : 'M'}${n(X)} ${n(Y)}`;
    this.hasPoint = true;
  }
  quadraticCurveTo(cx, cy, x, y) {
    const [CX, CY] = this.tp(cx, cy), [X, Y] = this.tp(x, y);
    this.d += `Q${n(CX)} ${n(CY)} ${n(X)} ${n(Y)}`;
    this.hasPoint = true;
  }
  closePath() { this.d += 'Z'; }
  arc(x, y, r, a0, a1, ccw = false) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw = false) {
    const pt = t => this.tp(x + rx * Math.cos(t) * Math.cos(rot) - ry * Math.sin(t) * Math.sin(rot),
      y + rx * Math.cos(t) * Math.sin(rot) + ry * Math.sin(t) * Math.cos(rot));
    let delta = a1 - a0;
    if (!ccw && delta >= TAU) delta = TAU;
    else if (ccw && -delta >= TAU) delta = -TAU;
    else if (!ccw) delta = ((delta % TAU) + TAU) % TAU;
    else delta = -((((-delta) % TAU) + TAU) % TAU);
    const [sx, sy] = pt(a0);
    this.d += `${this.hasPoint ? 'L' : 'M'}${n(sx)} ${n(sy)}`;
    this.hasPoint = true;
    const k = this.scale();
    const deg = (rot + this.angle()) * 180 / Math.PI;
    const sweep = delta > 0 ? 1 : 0;
    const steps = Math.abs(delta) >= TAU - 1e-9 ? 2 : 1; // a full turn needs two arcs
    for (let i = 1; i <= steps; i++) {
      const t = a0 + delta * i / steps;
      const [ex, ey] = pt(t);
      const large = Math.abs(delta / steps) > Math.PI ? 1 : 0;
      this.d += `A${n(rx * k)} ${n(ry * k)} ${n(deg)} ${large} ${sweep} ${n(ex)} ${n(ey)}`;
    }
  }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }

  common() {
    let s = '';
    if (this.state.globalAlpha < 1) s += ` opacity="${n(this.state.globalAlpha)}"`;
    if (this.state.clip) s += ` clip-path="url(#${this.state.clip})"`;
    const m = /blur\(([\d.]+)px\)/.exec(this.state.filter || '');
    if (m && +m[1] > 0) {
      const id = this.newId('f');
      this.defs.push(`<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${n(+m[1])}"/></filter>`);
      s += ` filter="url(#${id})"`;
    }
    return s;
  }
  fillAttrs(style) {
    if (style instanceof Gradient) return `fill="${style.ref()}"`;
    const p = paint(style);
    return `fill="${p.color}"${p.opacity < 1 ? ` fill-opacity="${n(p.opacity)}"` : ''}`;
  }
  fill() { if (this.d) this.body.push(`<path d="${this.d}" ${this.fillAttrs(this.state.fillStyle)}${this.common()}/>`); }
  stroke() {
    if (!this.d) return;
    const p = paint(this.state.strokeStyle), k = this.scale();
    let s = `<path d="${this.d}" fill="none" stroke="${p.color}" stroke-width="${n(this.state.lineWidth * k)}"`;
    if (p.opacity < 1) s += ` stroke-opacity="${n(p.opacity)}"`;
    if (this.state.lineCap !== 'butt') s += ` stroke-linecap="${this.state.lineCap}"`;
    if (this.state.lineJoin !== 'miter') s += ` stroke-linejoin="${this.state.lineJoin}"`;
    if (this.state.dash.length) s += ` stroke-dasharray="${this.state.dash.map(v => n(v * k)).join(' ')}"`;
    this.body.push(`${s}${this.common()}/>`);
  }
  clip() {
    const id = this.newId('c');
    const parent = this.state.clip ? ` clip-path="url(#${this.state.clip})"` : '';
    this.defs.push(`<clipPath id="${id}"${parent}><path d="${this.d}"/></clipPath>`);
    this.state.clip = id;
  }
  fillRect(x, y, w, h) { const d = this.d, hp = this.hasPoint; this.beginPath(); this.rect(x, y, w, h); this.fill(); this.d = d; this.hasPoint = hp; }
  strokeRect(x, y, w, h) { const d = this.d, hp = this.hasPoint; this.beginPath(); this.rect(x, y, w, h); this.stroke(); this.d = d; this.hasPoint = hp; }
  clearRect() {}

  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new Gradient(this, x0, y0, r0, x1, y1, r1); }

  // --- text ---
  parseFont() {
    const m = this.state.font.match(/^(italic\s+)?(\d{3})?\s*([\d.]+)px\s+(.+)$/);
    if (!m) return { italic: false, weight: 400, size: 10, family: 'sans-serif' };
    return { italic: !!m[1], weight: m[2] ? +m[2] : 400, size: +m[3], family: m[4] };
  }
  measureText(text) { this.measurer.font = this.state.font; return this.measurer.measureText(text); }
  fillText(text, x, y) {
    const f = this.parseFont();
    const [X, Y] = this.tp(x, y);
    const k = this.scale();
    const anchor = { center: 'middle', right: 'end', end: 'end' }[this.state.textAlign] || 'start';
    const base = { middle: ' dominant-baseline="central"', top: ' dominant-baseline="hanging"' }[this.state.textBaseline] || '';
    const p = paint(this.state.fillStyle);
    const family = f.family.replace(/"/g, "'");
    this.body.push(`<text x="${n(X)}" y="${n(Y)}" font-family="${esc(family)}" font-size="${n(f.size * k)}"`
      + `${f.weight !== 400 ? ` font-weight="${f.weight}"` : ''}${f.italic ? ' font-style="italic"' : ''}`
      + ` fill="${p.color}"${p.opacity < 1 ? ` fill-opacity="${n(p.opacity)}"` : ''}`
      + `${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${base}${this.common()}>${esc(text)}</text>`);
    // Remember which characters each face needs, for font embedding.
    for (const fam of f.family.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))) {
      const key = `${fam}|${f.weight}|${f.italic ? 'italic' : 'normal'}`;
      if (!this.fonts.has(key)) this.fonts.set(key, new Set());
      for (const ch of text) this.fonts.get(key).add(ch);
    }
  }

  toString(width, height, physical) {
    const size = physical ? ` width="${physical[0]}" height="${physical[1]}"` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
      + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"${size}>\n`
      + `<defs>\n${this.defs.join('\n')}\n</defs>\n${this.body.join('\n')}\n</svg>\n`;
  }
}

// ---------- font embedding ----------

let faceCache = null;

async function fontFaces(cssUrl) {
  if (!faceCache) {
    const css = await fetch(cssUrl).then(r => r.text());
    faceCache = [...css.matchAll(/@font-face\{([^}]*)\}/g)].map(([, body]) => {
      const get = re => (body.match(re) || [])[1];
      const ranges = (get(/unicode-range:([^;]+)/) || '').split(',').map(r => r.trim().replace('U+', '').split('-').map(h => parseInt(h, 16)));
      return {
        family: get(/font-family:"([^"]+)"/), style: get(/font-style:(\w+)/), weight: +get(/font-weight:(\d+)/),
        url: new URL(get(/url\("([^"]+)"\)/), cssUrl).href, ranges: ranges.map(([a, b]) => [a, b ?? a]),
      };
    });
  }
  return faceCache;
}

const covers = (face, cp) => face.ranges.some(([a, b]) => cp >= a && cp <= b);

async function dataUrl(url) {
  const buf = new Uint8Array(await fetch(url).then(r => r.arrayBuffer()));
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return `data:font/woff2;base64,${btoa(bin)}`;
}

// Returns a <style> block with @font-face rules for every slice the drawn text needs.
export async function embeddedFontStyle(ctx, cssUrl = new URL('fonts/fonts.css', document.baseURI).href) {
  const faces = await fontFaces(cssUrl);
  const chosen = new Set();
  for (const [key, chars] of ctx.fonts) {
    const [family, weight, style] = key.split('|');
    const candidates = faces.filter(f => f.family === family && f.style === style);
    if (!candidates.length) continue;
    const weights = [...new Set(candidates.map(f => f.weight))];
    const w = weights.reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a));
    for (const ch of chars) {
      const face = candidates.find(f => f.weight === w && covers(f, ch.codePointAt(0)));
      if (face) chosen.add(face);
    }
  }
  const rules = await Promise.all([...chosen].map(async f => `@font-face{font-family:"${f.family}";font-style:${f.style};`
    + `font-weight:${f.weight};src:url(${await dataUrl(f.url)}) format("woff2");`
    + `unicode-range:${f.ranges.map(([a, b]) => (a === b ? `U+${a.toString(16)}` : `U+${a.toString(16)}-${b.toString(16)}`)).join(',')};}`));
  return rules.length ? `<style>\n${rules.join('\n')}\n</style>` : '';
}

// Render a scene to an SVG string with embedded fonts.
export async function renderSvg(renderPoster, scene, width, height, physical) {
  const ctx = new SvgContext();
  renderPoster({ width, getContext: () => ctx }, scene);
  const style = await embeddedFontStyle(ctx);
  return ctx.toString(width, height, physical).replace('<defs>\n', `<defs>\n${style}\n`);
}
