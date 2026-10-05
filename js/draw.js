// Small drawing toolkit shared by the renderer, the decorations and the text layouts.

export const POSTER_W = 1000;
export const BASE_R = 395;
export const TAU = Math.PI * 2;

// Deterministic pseudo-random numbers (mulberry32), so a poster always looks the same.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Smooth 1-D value noise on a circle, for hand-drawn wobbles.
export function wobble(seed, harmonics = 4) {
  const r = rng(seed);
  const terms = Array.from({ length: harmonics }, (_, i) => ({ f: i + 2, a: r() / (i + 1), p: r() * TAU }));
  const norm = terms.reduce((s, t) => s + t.a, 0) || 1;
  return t => terms.reduce((s, q) => s + q.a * Math.sin(q.f * t + q.p), 0) / norm;
}

export function font({ font, weight = 400, size, italic = false }) {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
}

export function isLatin(str) {
  return !/[㐀-鿿豈-﫿]/.test(str);
}

// Letter spacing in em; CJK text can use its own (usually tighter) spacing.
export function spacingFor(spec, str) {
  return isLatin(str) ? (spec.spacing || 0) : (spec.cjkSpacing ?? spec.spacing ?? 0);
}

function caseOf(spec, str) {
  if (spec.upper) return str.toUpperCase();
  if (spec.lower) return str.toLowerCase();
  return str;
}

// Letter-spaced text is laid out one character at a time; unspaced text in whole words,
// which keeps kerning and the joins of script fonts. spec.wordSpacing (em) widens the spaces.
function runs(ctx, str, spec, size) {
  const text = caseOf(spec, str);
  const em = spacingFor(spec, str);
  const units = em ? Array.from(text) : text.split(/( )/).filter(Boolean);
  ctx.font = font({ ...spec, size });
  const word = (spec.wordSpacing || 0) * size;
  const widths = units.map(u => ctx.measureText(u).width + (u === ' ' ? word : 0));
  const gap = em * size;
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, units.length - 1);
  return { units, widths, gap, total, size };
}

export function measureSpaced(ctx, str, spec) {
  return runs(ctx, str, spec, spec.size).total;
}

// Draw text with letter spacing (canvas letterSpacing is not supported everywhere).
// Returns the drawn width. Shrinks the font to fit maxWidth.
export function spacedText(ctx, str, x, y, spec, opts = {}) {
  const { align = 'center', maxWidth = Infinity, stroke = false } = opts;
  let L = runs(ctx, str, spec, spec.size);
  for (let i = 0; i < 5 && L.total > maxWidth; i++) L = runs(ctx, str, spec, L.size * (maxWidth / L.total) * 0.98);
  let cx = align === 'center' ? x - L.total / 2 : align === 'right' ? x - L.total : x;
  ctx.textAlign = 'left';
  L.units.forEach((u, i) => {
    if (u !== ' ') {
      ctx.fillText(u, cx, y);
      if (stroke) ctx.strokeText(u, cx, y);
    }
    cx += L.widths[i] + L.gap;
  });
  return L.total;
}

// Text with a soft glow: a blurred copy underneath, then the crisp text.
export function glowText(ctx, str, x, y, spec, glow, opts = {}) {
  if (glow) {
    ctx.save();
    ctx.filter = `blur(${glow.blur * (ctx.__scale || 1)}px)`;
    ctx.fillStyle = glow.color;
    ctx.globalAlpha = glow.alpha ?? 0.9;
    spacedText(ctx, str, x, y, spec, opts);
    ctx.restore();
  }
  return spacedText(ctx, str, x, y, spec, opts);
}

// ---------- cross stitch ----------

// Draws X stitches centred on the given points: the bottom stitch (/), then the top stitch (\)
// with a darker edge and a thin sheen, so the crossing reads as thread.
export function drawCrosses(ctx, centers, cell, X) {
  const h = cell * 0.34;
  const pass = (color, width, dx, dy, which) => {
    if (!color) return;
    ctx.beginPath();
    for (const [x, y] of centers) {
      if (which !== 'top') { ctx.moveTo(x - h + dx, y + h + dy); ctx.lineTo(x + h + dx, y - h + dy); }
      if (which !== 'bottom') { ctx.moveTo(x - h + dx, y - h + dy); ctx.lineTo(x + h + dx, y + h + dy); }
    }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = 'round';
  pass(X.shadow, cell * 0.36, cell * 0.07, cell * 0.09, 'both');
  pass(X.color, cell * 0.27, 0, 0, 'bottom');
  pass(X.dark || X.color, cell * 0.33, 0, 0, 'top');
  pass(X.color, cell * 0.25, 0, 0, 'top');
  pass(X.sheen, cell * 0.08, -cell * 0.04, -cell * 0.05, 'top');
  ctx.restore();
}

// A small picture in cross stitch, given as rows of '#' (stitch) and '.' (empty), centred on x, y.
export function stitchPattern(ctx, rows, x, y, cell, X) {
  const w = rows[0].length * cell, h = rows.length * cell;
  const pts = [];
  rows.forEach((row, j) => Array.from(row).forEach((c, i) => {
    if (c === '#') pts.push([x - w / 2 + (i + 0.5) * cell, y - h / 2 + (j + 0.5) * cell]);
  }));
  drawCrosses(ctx, pts, cell, X);
}

// Cross-stitch lettering: the text is rasterised onto a coarse grid and every inked cell
// becomes one X. The baseline sits at y, like fillText. Returns the width.
export function crossStitchText(ctx, str, x, y, spec, X, opts = {}) {
  const { maxWidth = Infinity } = opts;
  const cell = isLatin(str) ? X.cell : (X.cellCjk || X.cell);
  const res = 6; // raster pixels per stitch
  const off = document.createElement('canvas');
  const oc = off.getContext('2d');
  let size = spec.size;
  let w = measureSpaced(oc, str, spec);
  if (w > maxWidth) { size *= maxWidth / w; w = measureSpaced(oc, str, { ...spec, size }); }
  const sp = { ...spec, size };
  const cols = Math.ceil(w / cell) + 4, rows = Math.ceil((size * 1.35) / cell) + 4;
  off.width = cols * res; off.height = rows * res;
  oc.setTransform(res / cell, 0, 0, res / cell, 0, 0);
  oc.fillStyle = '#000'; oc.strokeStyle = '#000';
  // Chinese strokes are thin and dense: no emboldening, a lower threshold.
  const latin = isLatin(str);
  const embolden = latin ? (X.embolden || 0) : (X.emboldenCjk ?? 0);
  oc.lineWidth = size * embolden; oc.lineJoin = 'round';
  oc.textBaseline = 'alphabetic';
  const base = 2 * cell + size * 1.02;
  spacedText(oc, str, (cols * cell) / 2, base, sp, { stroke: embolden > 0 });
  const px = oc.getImageData(0, 0, off.width, off.height).data;
  const thr = (latin ? (X.threshold ?? 0.45) : (X.thresholdCjk ?? 0.36)) * res * res * 255;
  const x0 = x - (cols * cell) / 2, y0 = y - base;
  const pts = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let sum = 0;
      for (let v = 0; v < res; v++) {
        const row = ((j * res + v) * off.width + i * res) * 4 + 3;
        for (let u = 0; u < res; u++) sum += px[row + u * 4];
      }
      if (sum > thr) pts.push([x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell]);
    }
  }
  drawCrosses(ctx, pts, cell, X);
  return w;
}

export function scaled(spec, k) {
  return { ...spec, size: Math.max(8, spec.size * k) };
}

// Keeps labels from overlapping each other, bright stars, or the chart edge,
// and never draws the same text twice (e.g. a star and its asterism are both "织女").
export class Placer {
  constructor(chart, horizon = null) { this.chart = chart; this.horizon = horizon; this.boxes = []; this.texts = new Set(); }
  free(b) {
    const { cx, cy, R } = this.chart;
    const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h], [b.x + b.w / 2, b.y], [b.x + b.w / 2, b.y + b.h]];
    if (!corners.every(([x, y]) => Math.hypot(x - cx, y - cy) < R - 6)) return false;
    if (this.horizon && corners.some(([x, y]) => this.horizon.occludes(x, y, 4))) return false;
    return !this.boxes.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
  }
  add(b) { this.boxes.push(b); }
  // Try candidate anchor points; draw at the first free one. Returns true if drawn.
  place(ctx, text, spec, candidates) {
    if (this.texts.has(text)) return false;
    const w = measureSpaced(ctx, text, spec);
    const h = spec.size * 1.05;
    for (const [x, y, align] of candidates) {
      const bx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
      const box = { x: bx - 1, y: y - h / 2 - 1, w: w + 2, h: h + 2 };
      if (this.free(box)) {
        this.add(box);
        this.texts.add(text);
        spacedText(ctx, text, x, y, spec, { align });
        return true;
      }
    }
    return false;
  }
}

// Theme colours may name a shared paint, e.g. '@gold' for the metallic gradient.
export function paint(scene, value) {
  if (typeof value === 'string' && value.startsWith('@')) return scene.paints[value.slice(1)] || '#000';
  return value;
}

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

// Chinese numerals for 0–999 (e.g. 116 → 一百一十六, 40 → 四十, 105 → 一百零五).
export function cnInt(n) {
  n = Math.round(n);
  if (n < 10) return CN[n];
  if (n < 20) return '十' + (n % 10 ? CN[n % 10] : '');
  if (n < 100) return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
  const h = Math.floor(n / 100), rest = n % 100;
  if (!rest) return CN[h] + '百';
  if (rest < 10) return CN[h] + '百零' + CN[rest];
  return CN[h] + '百' + CN[Math.floor(rest / 10)] + '十' + (rest % 10 ? CN[rest % 10] : '');
}

// Degrees and minutes in Chinese numerals, e.g. 北纬四十度四十三分.
export function cnCoord(value, pos, neg) {
  const a = Math.abs(value);
  let d = Math.floor(a), m = Math.round((a - d) * 60);
  if (m === 60) { d += 1; m = 0; }
  return `${value >= 0 ? pos : neg}${cnInt(d)}度${m ? cnInt(m) + '分' : ''}`;
}
