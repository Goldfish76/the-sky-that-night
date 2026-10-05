// Decorations: paper, sky backgrounds, Milky Way styles, guide lines, frames and star shapes.
// Every effect is selected by name from a theme (see themes.js) and uses only the Canvas 2D
// subset that svg.js can record, so PNG and SVG exports match.
import { TAU, POSTER_W, BASE_R, rng, hashString, wobble, spacedText, glowText, paint, isLatin } from './draw.js';
import { eclipticLine } from './astro.js';
import { STR } from './i18n.js';

const d3 = window.d3;
const blur = (ctx, v) => `blur(${(v * (ctx.__scale || 1)).toFixed(2)}px)`;

// ---------- paper ----------

export function drawPaper(ctx, scene, H, charts = []) {
  const theme = scene.theme, P = theme.paper;
  const r = rng(hashString(theme.id) + 17);
  const density = H / 1414;
  ctx.fillStyle = P.base;
  ctx.fillRect(0, 0, POSTER_W, H);

  if (P.gradient) {
    const g = P.gradient.type === 'linear'
      ? ctx.createLinearGradient(0, 0, POSTER_W * 0.3, H)
      : ctx.createRadialGradient(POSTER_W / 2, H * 0.42, 0, POSTER_W / 2, H * 0.42, H * 0.75);
    P.gradient.stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, POSTER_W, H);
  }
  for (const gl of P.glows || []) {
    const x = gl.x * POSTER_W, y = gl.y * H, rad = gl.r * POSTER_W;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, gl.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  if (P.blotches) {
    const [cr, cg, cb] = P.blotchRgb || [150, 105, 45];
    for (let i = 0; i < P.blotches * density; i++) {
      const x = r() * POSTER_W, y = r() * H, rad = 60 + r() * 220;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${(0.03 + r() * 0.04) * (P.blotchStrength || 1)})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  if (P.weave) weave(ctx, 0, 0, POSTER_W, H, P.weave, r);
  if (P.fibers) {
    ctx.lineCap = 'round';
    for (let i = 0; i < P.fibers * density; i++) {
      const x = r() * POSTER_W, y = r() * H;
      const len = 8 + r() * 26, ang = r() * TAU, bend = (r() - 0.5) * 10;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(ang) * len / 2 + bend, y + Math.sin(ang) * len / 2 - bend,
        x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.strokeStyle = P.fiberColor ? P.fiberColor : `rgba(80,70,52,${0.05 + r() * 0.07})`;
      ctx.lineWidth = 0.3 + r() * 0.5;
      ctx.stroke();
    }
  }
  if (P.grid) {
    const G = P.grid;
    for (const [step, color, width] of [[G.minor, G.color, 0.5], [G.major, G.majorColor, 0.8]]) {
      ctx.beginPath();
      for (let x = 0; x <= POSTER_W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y <= H; y += step) { ctx.moveTo(0, y); ctx.lineTo(POSTER_W, y); }
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    }
  }
  if (P.speckles && !ctx.isVector) {
    // Paper grain: thousands of specks look right in pixels but would bloat a vector file.
    ctx.fillStyle = P.speckle;
    for (let i = 0; i < P.speckles * density; i++) {
      const s = 0.5 + r() * 1.3;
      ctx.fillRect(r() * POSTER_W, r() * H, s, s);
    }
  }
  if (P.scanlines) {
    ctx.beginPath();
    for (let y = 0; y <= H; y += P.scanlines.step) { ctx.moveTo(0, y); ctx.lineTo(POSTER_W, y); }
    ctx.strokeStyle = P.scanlines.color; ctx.lineWidth = P.scanlines.width || 1; ctx.stroke();
  }
  if (P.vignette) {
    const v = ctx.createRadialGradient(POSTER_W / 2, H / 2, H * 0.3, POSTER_W / 2, H / 2, H * 0.82);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, P.vignette);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, POSTER_W, H);
  }
  if (P.edges) scrollEdges(ctx, H, P.edges, r);
  if (P.frame === 'blueprint') blueprintSheet(ctx, scene, H);
  if (P.frame === 'deco') decoSheet(ctx, scene, H);
  if (P.frame === 'stamp') stampSheet(ctx, scene, H, charts);
}

// The outline of a perforated stamp: straight edges with a semicircular bite at every hole.
function perforated(ctx, x0, y0, x1, y1, r, pitch) {
  const nx = Math.max(2, Math.round((x1 - x0) / pitch)), ny = Math.max(2, Math.round((y1 - y0) / pitch));
  const sx = (x1 - x0) / nx, sy = (y1 - y0) / ny;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 0; i < nx; i++) { const c = x0 + (i + 0.5) * sx; ctx.lineTo(c - r, y0); ctx.arc(c, y0, r, Math.PI, 0, true); }
  ctx.lineTo(x1, y0);
  for (let i = 0; i < ny; i++) { const c = y0 + (i + 0.5) * sy; ctx.lineTo(x1, c - r); ctx.arc(x1, c, r, -Math.PI / 2, Math.PI / 2, true); }
  ctx.lineTo(x1, y1);
  for (let i = nx - 1; i >= 0; i--) { const c = x0 + (i + 0.5) * sx; ctx.lineTo(c + r, y1); ctx.arc(c, y1, r, 0, Math.PI, true); }
  ctx.lineTo(x0, y1);
  for (let i = ny - 1; i >= 0; i--) { const c = y0 + (i + 0.5) * sy; ctx.lineTo(x0, c + r); ctx.arc(x0, c, r, Math.PI / 2, -Math.PI / 2, true); }
  ctx.closePath();
}

// A commemorative stamp on an envelope: perforated paper, a printed frame, an engraved
// (hatched) picture area around the sky, and the year as the face value.
function stampSheet(ctx, scene, H, charts) {
  const S = scene.theme.paper.stamp;
  const x0 = S.inset, y0 = S.inset, x1 = POSTER_W - S.inset, y1 = H - S.inset;
  ctx.save();
  ctx.filter = blur(ctx, 4);
  ctx.fillStyle = S.shadow;
  ctx.translate(2.5, 4);
  perforated(ctx, x0, y0, x1, y1, S.hole, S.pitch); ctx.fill();
  ctx.restore();
  ctx.fillStyle = S.color;
  perforated(ctx, x0, y0, x1, y1, S.hole, S.pitch); ctx.fill();

  const fx0 = x0 + S.margin, fy0 = y0 + S.margin, fx1 = x1 - S.margin, fy1 = y1 - S.margin;
  // the engraved picture area ends under the sky (and, on a two-sky phone wallpaper, under its caption)
  const below = scene.format === 'phone' && charts.length > 1 ? 124 : 42;
  const bottom = Math.min(fy1 - 40, Math.max(...charts.map(c => c.cy + c.R)) + below);
  // engraving: fine horizontal lines over the picture area (the sky disc covers them)
  ctx.beginPath();
  for (let y = fy0 + 8; y < bottom - 2; y += S.hatch) { ctx.moveTo(fx0 + 7, y); ctx.lineTo(fx1 - 7, y); }
  ctx.strokeStyle = S.engrave; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.strokeStyle = S.ink;
  ctx.lineWidth = 2.2; ctx.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
  ctx.lineWidth = 0.7; ctx.strokeRect(fx0 + 6, fy0 + 6, fx1 - fx0 - 12, fy1 - fy0 - 12);
  ctx.beginPath(); ctx.moveTo(fx0 + 6, bottom); ctx.lineTo(fx1 - 6, bottom); ctx.moveTo(fx0 + 6, bottom + 4); ctx.lineTo(fx1 - 6, bottom + 4);
  ctx.lineWidth = 0.7; ctx.stroke();
  // face value: the year of the (first) night
  const year = scene.skies[0]?.local?.y;
  if (year) {
    ctx.fillStyle = S.red;
    ctx.textBaseline = 'alphabetic';
    spacedText(ctx, String(year), fx0 + 20, fy0 + 52, { font: '"Cormorant Garamond", serif', weight: 600, size: 40, spacing: 0.02 }, { align: 'left' });
  }
}

// Linen or canvas: crossing threads plus a few thicker slubs.
function weave(ctx, x0, y0, w, h, W, r) {
  for (const [dir, color] of [['h', W.color], ['v', W.color2 || W.color]]) {
    ctx.beginPath();
    if (dir === 'h') for (let y = y0; y <= y0 + h; y += W.step) { ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); }
    else for (let x = x0; x <= x0 + w; x += W.step) { ctx.moveTo(x, y0); ctx.lineTo(x, y0 + h); }
    ctx.strokeStyle = color; ctx.lineWidth = W.width || 0.8; ctx.stroke();
  }
  if (W.slubs) {
    ctx.beginPath();
    for (let i = 0; i < W.slubs * (w * h) / (1000 * 1414); i++) {
      const x = x0 + r() * w, y = y0 + r() * h, len = 6 + r() * 18;
      if (r() < 0.5) { ctx.moveTo(x, y); ctx.lineTo(x + len, y); } else { ctx.moveTo(x, y); ctx.lineTo(x, y + len); }
    }
    ctx.strokeStyle = W.slubColor || W.color; ctx.lineWidth = (W.width || 0.8) * 1.6; ctx.stroke();
  }
}

// Aged scroll: darker, uneven edges and a few age spots.
function scrollEdges(ctx, H, E, r) {
  const band = E.band || 70;
  const sides = [
    [0, 0, POSTER_W, band, 0, 0, 0, band], [0, H - band, POSTER_W, band, 0, H, 0, H - band],
    [0, 0, band, H, 0, 0, band, 0], [POSTER_W - band, 0, band, H, POSTER_W, 0, POSTER_W - band, 0],
  ];
  for (const [x, y, w, h, gx0, gy0, gx1, gy1] of sides) {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, E.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  // Foxing: little clusters of rust-coloured specks, as on old paper.
  const [sr, sg, sb] = E.spotRgb || [146, 92, 38];
  for (let i = 0; i < (E.spots || 0) * H / 1414; i++) {
    const x = r() * POSTER_W, y = r() * H;
    const n = 1 + Math.floor(r() * 5);
    for (let j = 0; j < n; j++) {
      const sx = x + (r() - 0.5) * 26, sy = y + (r() - 0.5) * 26;
      const rad = j === 0 ? 2.2 + r() * 3.8 : 0.7 + r() * 1.8;
      const a = (E.spotAlpha ?? 0.3) * (0.5 + r() * 0.5);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
      g.addColorStop(0, `rgba(${sr},${sg},${sb},${a.toFixed(3)})`);
      g.addColorStop(0.6, `rgba(${sr},${sg},${sb},${(a * 0.45).toFixed(3)})`);
      g.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, rad, 0, TAU); ctx.fill();
    }
  }
}

// Technical-drawing sheet: double border with zone letters and numbers.
function blueprintSheet(ctx, scene, H) {
  const c = scene.theme.border.color;
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.4; ctx.strokeRect(24, 24, POSTER_W - 48, H - 48);
  ctx.lineWidth = 0.5; ctx.strokeRect(32, 32, POSTER_W - 64, H - 64);
  ctx.fillStyle = c;
  ctx.textBaseline = 'middle';
  const spec = { font: '"Space Mono", monospace', size: 9, weight: 400, spacing: 0 };
  const cols = 8, rows = Math.round((H - 64) / ((POSTER_W - 64) / cols));
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 1; i < cols; i++) {
    const x = 32 + i * (POSTER_W - 64) / cols;
    ctx.moveTo(x, 24); ctx.lineTo(x, 32); ctx.moveTo(x, H - 32); ctx.lineTo(x, H - 24);
  }
  for (let j = 1; j < rows; j++) {
    const y = 32 + j * (H - 64) / rows;
    ctx.moveTo(24, y); ctx.lineTo(32, y); ctx.moveTo(POSTER_W - 32, y); ctx.lineTo(POSTER_W - 24, y);
  }
  ctx.stroke();
  for (let i = 0; i < cols; i++) {
    const x = 32 + (i + 0.5) * (POSTER_W - 64) / cols;
    spacedText(ctx, String(i + 1), x, 28, spec);
    spacedText(ctx, String(i + 1), x, H - 28, spec);
  }
  for (let j = 0; j < rows; j++) {
    const y = 32 + (j + 0.5) * (H - 64) / rows;
    const L = String.fromCharCode(65 + (j % 26));
    spacedText(ctx, L, 28, y, spec);
    spacedText(ctx, L, POSTER_W - 28, y, spec);
  }
}

// Art Deco sheet: stepped double frame with fan ornaments in the corners.
function decoSheet(ctx, scene, H) {
  const gold = paint(scene, '@gold');
  ctx.strokeStyle = gold;
  const frame = (inset, step) => {
    const x0 = inset, y0 = inset, x1 = POSTER_W - inset, y1 = H - inset;
    ctx.beginPath();
    ctx.moveTo(x0 + step, y0); ctx.lineTo(x1 - step, y0); ctx.lineTo(x1 - step, y0 + step / 2);
    ctx.lineTo(x1 - step / 2, y0 + step / 2); ctx.lineTo(x1 - step / 2, y0 + step); ctx.lineTo(x1, y0 + step);
    ctx.lineTo(x1, y1 - step); ctx.lineTo(x1 - step / 2, y1 - step); ctx.lineTo(x1 - step / 2, y1 - step / 2);
    ctx.lineTo(x1 - step, y1 - step / 2); ctx.lineTo(x1 - step, y1); ctx.lineTo(x0 + step, y1);
    ctx.lineTo(x0 + step, y1 - step / 2); ctx.lineTo(x0 + step / 2, y1 - step / 2); ctx.lineTo(x0 + step / 2, y1 - step);
    ctx.lineTo(x0, y1 - step); ctx.lineTo(x0, y0 + step); ctx.lineTo(x0 + step / 2, y0 + step);
    ctx.lineTo(x0 + step / 2, y0 + step / 2); ctx.lineTo(x0 + step, y0 + step / 2); ctx.closePath();
    ctx.stroke();
  };
  ctx.lineWidth = 1.6; frame(26, 28);
  ctx.lineWidth = 0.7; frame(36, 20);
  // corner fans
  ctx.lineWidth = 0.6;
  for (const [x, y, a0] of [[58, 58, 0], [POSTER_W - 58, 58, Math.PI / 2], [POSTER_W - 58, H - 58, Math.PI], [58, H - 58, Math.PI * 1.5]]) {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (i / 8) * (Math.PI / 2);
      ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
      ctx.lineTo(x + Math.cos(a) * (i % 2 ? 26 : 34), y + Math.sin(a) * (i % 2 ? 26 : 34));
    }
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fillStyle = gold; ctx.fill();
  }
}

// ---------- sky backgrounds (drawn under the stars) ----------

// Called before the chart is clipped: lets a background spill past the horizon circle.
export function drawSkyUnderlay(ctx, scene, chart, seed) {
  const S = scene.theme.sky;
  if (S.mode === 'watercolor') watercolorWash(ctx, chart, seed, S);
  if (S.mode === 'halftone') halftoneDisc(ctx, chart, S);
  if (scene.theme.border.kind === 'instant') instantCard(ctx, scene, chart);
}

// ---------- instant photo ----------

// Where the photo and the white card sit for a chart. In the single layout the card's
// bottom strip runs down to near the poster's foot, leaving room for the handwriting.
export function instantGeometry(scene, chart) {
  const { cx, cy, R } = chart;
  const k = R / BASE_R;
  const pad = 18 * k, b = 26 * k;
  const photo = { x: cx - R - pad, y: cy - R - pad, s: 2 * (R + pad) };
  const single = scene.skies.length === 1;
  const strip = single ? scene.H - 100 - (photo.y + photo.s) : (scene.format === 'phone' ? 150 * k : 4.2 * b);
  return { photo, card: { x: photo.x - b, y: photo.y - b, w: photo.s + 2 * b, h: photo.s + b + strip }, strip, k };
}

function instantCard(ctx, scene, chart) {
  const B = scene.theme.border;
  const { photo, card, k } = instantGeometry(scene, chart);
  ctx.save();
  ctx.filter = blur(ctx, 7 * k);
  ctx.fillStyle = B.shadow;
  ctx.fillRect(card.x + 5 * k, card.y + 9 * k, card.w, card.h);
  ctx.restore();
  const g = ctx.createLinearGradient(0, card.y, 0, card.y + card.h);
  g.addColorStop(0, B.card); g.addColorStop(1, B.cardShade);
  ctx.fillStyle = g;
  ctx.fillRect(card.x, card.y, card.w, card.h);
  ctx.fillStyle = B.photo;
  ctx.fillRect(photo.x, photo.y, photo.s, photo.s);
}

// Film look over the finished photo: lifted blacks, a light leak, vignette, grain and tape.
function instantFinish(ctx, scene, chart, seed, index) {
  const B = scene.theme.border;
  const { photo, card, k } = instantGeometry(scene, chart);
  const { x, y, s } = photo;
  const r = rng(seed);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = B.fade;
  ctx.fillRect(x, y, s, s);
  const lx = r() < 0.5 ? x + s * 0.92 : x + s * 0.08, ly = y + s * (0.05 + r() * 0.2);
  const leak = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * 0.55);
  leak.addColorStop(0, B.leak); leak.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leak;
  ctx.fillRect(x, y, s, s);
  ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createRadialGradient(x + s / 2, y + s / 2, s * 0.42, x + s / 2, y + s / 2, s * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(x, y, s, s);
  if (!ctx.isVector) {
    for (let i = 0; i < 9000 * k * k; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(x + r() * s, y + r() * s, 0.8, 0.8);
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
  ctx.strokeRect(x, y, s, s);
  // the camera's date imprint in the dark corner of the frame
  const local = scene.skies[index]?.local;
  if (local && B.imprint) {
    const pad = n => String(n).padStart(2, '0');
    const text = `'${String(local.y).slice(-2)} ${pad(local.m)} ${pad(local.d)}`;
    sevenSegment(ctx, text, x + s - 26 * k, y + s - 24 * k, 15 * k, B.imprint);
  }
  // two strips of tape holding the card
  for (const [tx, ang] of [[card.x + 34 * k, -0.62 + r() * 0.12], [card.x + card.w - 34 * k, 0.62 - r() * 0.12]]) {
    tape(ctx, tx, card.y + 4 * k, 128 * k, 34 * k, ang, B.tape, r);
  }
}

// Seven-segment digits, right-aligned with their bottom at y, slanted like an LCD date back.
const SEGMENTS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};
function sevenSegment(ctx, text, right, bottom, h, color) {
  const w = h * 0.52, t = h * 0.13, gap = h * 0.36, slant = 0.16;
  const chars = Array.from(text);
  const width = chars.reduce((a, ch) => a + (ch === ' ' ? gap : ch === "'" ? w * 0.45 : w + gap * 0.55), 0);
  let x0 = right - width;
  const top = bottom - h;
  const P = (x, y) => [x + (bottom - y) * slant, y];
  ctx.beginPath();
  const seg = (xa, ya, xb, yb) => { const [p, q] = P(xa, ya), [u, v] = P(xb, yb); ctx.moveTo(p, q); ctx.lineTo(u, v); };
  for (const ch of chars) {
    if (ch === ' ') { x0 += gap; continue; }
    if (ch === "'") { seg(x0 + t, top, x0, top + h * 0.28); x0 += w * 0.45; continue; }
    const on = SEGMENTS[ch] || '';
    const m = top + h / 2, e = t * 0.9;
    if (on.includes('a')) seg(x0 + e, top, x0 + w - e, top);
    if (on.includes('b')) seg(x0 + w, top + e, x0 + w, m - e);
    if (on.includes('c')) seg(x0 + w, m + e, x0 + w, bottom - e);
    if (on.includes('d')) seg(x0 + e, bottom, x0 + w - e, bottom);
    if (on.includes('e')) seg(x0, m + e, x0, bottom - e);
    if (on.includes('f')) seg(x0, top + e, x0, m - e);
    if (on.includes('g')) seg(x0 + e, m, x0 + w - e, m);
    x0 += w + gap * 0.55;
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.filter = blur(ctx, h * 0.18);
  ctx.strokeStyle = color.glow; ctx.lineWidth = t * 2.2; ctx.stroke();
  ctx.filter = 'none';
  ctx.strokeStyle = color.ink; ctx.lineWidth = t; ctx.stroke();
  ctx.restore();
}

function tape(ctx, x, y, w, h, angle, color, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const edge = side => {
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push([side * w / 2 + (r() - 0.5) * 3.2, -h / 2 + (h * i) / 6]);
    return pts;
  };
  const left = edge(-1), right = edge(1).reverse();
  ctx.beginPath();
  [...left, ...right].forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.save();
  ctx.filter = blur(ctx, 1.5);
  ctx.fillStyle = 'rgba(60,45,30,0.16)';
  ctx.translate(1, 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// ---------- risograph ----------

// A tint printed as a halftone: dots on a rotated grid, bigger towards the horizon.
// Vector exports get a flat tint instead of tens of thousands of dots.
function halftoneDisc(ctx, chart, S) {
  const { cx, cy, R } = chart;
  const k = R / BASE_R;
  const [mx, my] = (S.mis || [0, 0]).map(v => v * k);
  if (ctx.isVector) {
    ctx.fillStyle = S.flat;
    ctx.beginPath(); ctx.arc(cx + mx, cy + my, R, 0, TAU); ctx.fill();
    return;
  }
  dots(ctx, cx + mx, cy + my, R, S.spacing * k, S.angle, (dx, dy) => {
    const t = Math.hypot(dx, dy) / R;
    return (S.min + (S.max - S.min) * t * t) * k;
  }, S.color);
}

function dots(ctx, cx, cy, R, step, angleDeg, radiusAt, color) {
  const a = (angleDeg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const n = Math.ceil(R / step) + 1;
  ctx.beginPath();
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const u = i * step, v = j * step;
      const dx = u * ca - v * sa, dy = u * sa + v * ca;
      if (dx * dx + dy * dy > R * R) continue;
      const rr = radiusAt(dx, dy);
      if (rr < 0.12) continue;
      ctx.moveTo(cx + dx + rr, cy + dy);
      ctx.arc(cx + dx, cy + dy, rr, 0, TAU);
    }
  }
  ctx.fillStyle = color;
  ctx.fill();
}

// The Milky Way as halftone dots whose size follows its brightness (raster only).
function halftoneMilkyWay(ctx, scene, proj, chart, mw) {
  const { cx, cy, R } = chart;
  const k = R / BASE_R;
  const N = 260;
  const mask = document.createElement('canvas');
  mask.width = mask.height = N;
  const m = mask.getContext('2d');
  const sc = N / (2 * R);
  m.setTransform(sc, 0, 0, sc, -(cx - R) * sc, -(cy - R) * sc);
  // a soft mask, so dot sizes change smoothly instead of stepping at each contour
  m.filter = `blur(${(mw.soften * sc * k).toFixed(2)}px)`;
  const p = d3.geoPath(proj, m);
  m.fillStyle = 'rgba(0,0,0,0.2)';
  for (const f of scene.data.mw.features) { m.beginPath(); p(f); m.fill(); }
  const px = m.getImageData(0, 0, N, N).data;
  const [mx, my] = (mw.mis || [0, 0]).map(v => v * k);
  ctx.save();
  if (mw.blend) ctx.globalCompositeOperation = mw.blend;
  dots(ctx, cx + mx, cy + my, R, mw.spacing * k, mw.angle, (dx, dy) => {
    const ix = Math.min(N - 1, Math.max(0, Math.floor((dx + R) * sc))), iy = Math.min(N - 1, Math.max(0, Math.floor((dy + R) * sc)));
    const dens = px[(iy * N + ix) * 4 + 3] / 255;
    return mw.max * k * Math.pow(Math.min(1, dens * 1.4), 0.75);
  }, mw.color);
  ctx.restore();
}

// Called inside the clipped chart.
export function drawSkyBackground(ctx, scene, chart, seed) {
  const S = scene.theme.sky;
  const { cx, cy, R } = chart;
  if (S.mode === 'none' || S.mode === 'watercolor' || S.mode === 'halftone') return;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, S.inner);
  g.addColorStop(1, S.outer);
  ctx.fillStyle = g;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  if (S.mode === 'fabric') weave(ctx, cx - R, cy - R, 2 * R, 2 * R, S.weave, rng(seed));
  if (S.airglow) {
    const a = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
    a.addColorStop(0, 'rgba(0,0,0,0)');
    S.airglow.forEach(([o, c]) => a.addColorStop(o, c));
    ctx.fillStyle = a;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  }
}

// A watercolour stain: base wash, pigment pools, lighter blooms and a darker tide line,
// shaped by a wobbly outline. Seeded by the poster so every poster gets its own wash.
function watercolorWash(ctx, chart, seed, S) {
  const { cx, cy, R } = chart;
  const k = R / BASE_R;
  const r = rng(seed);
  const edge = wobble(seed, 5);
  const outline = () => {
    ctx.beginPath();
    for (let i = 0; i <= 180; i++) {
      const t = (i / 180) * TAU;
      const rr = R * (1.035 + 0.03 * edge(t));
      if (i) ctx.lineTo(cx + rr * Math.cos(t), cy + rr * Math.sin(t));
      else ctx.moveTo(cx + rr * Math.cos(t), cy + rr * Math.sin(t));
    }
    ctx.closePath();
  };
  const blob = (x, y, rad, sd) => {
    const w = wobble(sd, 3);
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * TAU, rr = rad * (1 + 0.25 * w(t));
      if (i) ctx.lineTo(x + rr * Math.cos(t), y + rr * Math.sin(t));
      else ctx.moveTo(x + rr * Math.cos(t), y + rr * Math.sin(t));
    }
    ctx.closePath();
  };
  ctx.save();
  outline();
  ctx.clip();
  ctx.filter = blur(ctx, 2.5 * k);
  ctx.fillStyle = S.base;
  outline(); ctx.fill();
  for (let i = 0; i < S.pools; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R * 0.85;
    const color = S.palette[Math.floor(r() * S.palette.length)];
    ctx.filter = blur(ctx, (14 + r() * 16) * k);
    ctx.fillStyle = color.replace('A', (0.12 + r() * 0.2).toFixed(2));
    blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.22 + r() * 0.45), seed + i * 31);
    ctx.fill();
  }
  for (let i = 0; i < S.blooms; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R * 0.8;
    ctx.filter = blur(ctx, (8 + r() * 10) * k);
    ctx.fillStyle = `rgba(255,255,255,${(0.06 + r() * 0.08).toFixed(2)})`;
    blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.08 + r() * 0.16), seed + 900 + i);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.filter = blur(ctx, 1.2 * k);
  ctx.strokeStyle = S.tide;
  ctx.lineWidth = 2.4 * k;
  outline(); ctx.stroke();
  ctx.restore();
}

// ---------- Milky Way ----------

export function drawMilkyWay(ctx, scene, path, proj, chart) {
  const mw = scene.theme.milkyWay;
  const feats = scene.data.mw.features;
  const k = chart.R / BASE_R;
  const level = i => mw.alphas[i] ?? mw.alphas[mw.alphas.length - 1];
  const fillLevels = (rgbFor, blurFor) => {
    feats.forEach((f, i) => {
      ctx.save();
      const b = blurFor(i);
      if (b) ctx.filter = blur(ctx, b * k);
      if (mw.blend) ctx.globalCompositeOperation = mw.blend;
      ctx.beginPath(); path(f);
      ctx.fillStyle = `rgba(${rgbFor(i)},${level(i)})`;
      ctx.fill();
      ctx.restore();
    });
  };

  if (mw.mode === 'none') return;
  if (mw.mode === 'halftone' && !ctx.isVector) { halftoneMilkyWay(ctx, scene, proj, chart, mw); return; }
  if (mw.mode === 'photo') {
    fillLevels(i => mw.colors[i] || mw.colors[mw.colors.length - 1], i => mw.blurs[i] ?? mw.blur);
    if (!ctx.isVector && mw.dust) starDust(ctx, scene, proj, chart, mw.dust);
    return;
  }
  fillLevels(() => mw.rgb, () => mw.blur);
  if (mw.mode === 'outline') {
    ctx.save();
    ctx.setLineDash(mw.dash.map(v => v * k));
    ctx.strokeStyle = mw.stroke; ctx.lineWidth = mw.width * k;
    for (const i of mw.outlineLevels) { ctx.beginPath(); path(feats[i]); ctx.stroke(); }
    ctx.restore();
  } else if (mw.mode === 'double') {
    // 天河 as drawn on old Chinese charts: a band between two ink lines.
    const f = feats[mw.outlineLevel ?? 0];
    ctx.strokeStyle = mw.stroke; ctx.lineWidth = mw.width * 3 * k;
    ctx.beginPath(); path(f); ctx.stroke();
    ctx.strokeStyle = mw.inner; ctx.lineWidth = mw.width * 1.2 * k;
    ctx.beginPath(); path(f); ctx.stroke();
  }
}

// Faint unresolved stars, denser inside the Milky Way (raster only).
function starDust(ctx, scene, proj, chart, D) {
  const { cx, cy, R } = chart;
  const N = 220;
  const mask = document.createElement('canvas');
  mask.width = mask.height = N;
  const m = mask.getContext('2d');
  const sc = N / (2 * R);
  m.setTransform(sc, 0, 0, sc, -(cx - R) * sc, -(cy - R) * sc);
  const p = d3.geoPath(proj, m);
  m.fillStyle = 'rgba(255,255,255,0.35)';
  for (const f of scene.data.mw.features) { m.beginPath(); p(f); m.fill(); }
  const px = m.getImageData(0, 0, N, N).data;
  const r = rng(hashString(scene.theme.id) + 5);
  const n = D.count * (R / BASE_R) ** 2;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    const ix = Math.min(N - 1, Math.floor((x - cx + R) * sc)), iy = Math.min(N - 1, Math.floor((y - cy + R) * sc));
    const dens = px[(iy * N + ix) * 4 + 3] / 255; // 0 outside, up to ~0.83 in the core
    if (r() > 0.08 + dens * 1.1) continue;
    ctx.fillStyle = `rgba(${D.rgb},${(0.15 + r() * 0.55).toFixed(2)})`;
    ctx.fillRect(x, y, 0.35 + r() * 0.6, 0.35 + r() * 0.6);
  }
}

// ---------- guide lines (grid, ecliptic, Chinese chart lines) ----------

export function drawGuides(ctx, scene, path, sky, chart) {
  const { theme, opts, data } = scene;
  const km = Math.pow(chart.R / BASE_R, 0.8);
  if (opts.grid) {
    ctx.save();
    if (theme.grid.dash) ctx.setLineDash(theme.grid.dash.map(v => v * km));
    ctx.beginPath(); path(d3.geoGraticule().step([15, 10])());
    ctx.strokeStyle = paint(scene, theme.grid.color); ctx.lineWidth = theme.grid.width * km; ctx.stroke();
    ctx.restore();
    if (theme.ecliptic) {
      ctx.save();
      ctx.setLineDash(theme.ecliptic.dash.map(v => v * km));
      ctx.beginPath(); path(eclipticLine());
      ctx.strokeStyle = paint(scene, theme.ecliptic.color); ctx.lineWidth = theme.ecliptic.width * km; ctx.stroke();
      ctx.restore();
    }
  }
  const X = theme.extras;
  if (!X) return;
  if (X.mansions && data.mansions) {
    // 宿度: hour circles through the determinative star of each lunar mansion.
    ctx.beginPath();
    for (const m of data.mansions) {
      path({ type: 'LineString', coordinates: d3.range(-89, 90, 2).map(dec => [m.c[0], dec]) });
    }
    ctx.strokeStyle = X.mansions.color; ctx.lineWidth = X.mansions.width * km; ctx.stroke();
  }
  if (X.equator) {
    ctx.beginPath();
    path({ type: 'LineString', coordinates: d3.range(-180, 181, 2).map(lon => [lon, 0]) });
    ctx.strokeStyle = X.equator.color; ctx.lineWidth = X.equator.width * km; ctx.stroke();
  }
  if (X.ecliptic) {
    ctx.save();
    if (X.ecliptic.dash) ctx.setLineDash(X.ecliptic.dash.map(v => v * km));
    ctx.beginPath(); path(eclipticLine());
    ctx.strokeStyle = X.ecliptic.color; ctx.lineWidth = X.ecliptic.width * km; ctx.stroke();
    ctx.restore();
  }
  if (X.circumpolar && Math.abs(sky.lat) > 1) {
    // 内规: the circle of stars that never set at this latitude.
    ctx.save();
    if (X.circumpolar.dash) ctx.setLineDash(X.circumpolar.dash.map(v => v * km));
    ctx.beginPath();
    path(d3.geoCircle().center([0, sky.lat > 0 ? 90 : -90]).radius(Math.abs(sky.lat)).precision(2)());
    ctx.strokeStyle = X.circumpolar.color; ctx.lineWidth = X.circumpolar.width * km; ctx.stroke();
    ctx.restore();
  }
}

// ---------- constellation lines ----------

export function drawLines(ctx, scene, path, proj, chart, fc, isUp) {
  const L = scene.theme.lines;
  const k = chart.R / BASE_R, km = Math.pow(k, 0.8);
  if (L.style === 'stitch') return stitchLines(ctx, scene, proj, fc, isUp, km);
  if (L.glow) {
    ctx.save();
    ctx.filter = blur(ctx, L.glow.blur * km);
    ctx.globalAlpha = L.glow.alpha ?? 0.6;
    ctx.beginPath(); path(fc);
    ctx.strokeStyle = L.glow.color; ctx.lineWidth = L.glow.width * km;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  if (L.dash) ctx.setLineDash(L.dash.map(v => v * km));
  if (L.blend) ctx.globalCompositeOperation = L.blend;
  ctx.beginPath(); path(fc);
  ctx.strokeStyle = paint(scene, L.color); ctx.lineWidth = L.width * km;
  ctx.lineJoin = 'round'; ctx.lineCap = L.cap || 'round';
  ctx.stroke();
  ctx.restore();
}

// Back stitch: each line becomes a row of short thread stitches with a sheen.
function stitchLines(ctx, scene, proj, fc, isUp, km) {
  const L = scene.theme.lines;
  const len = L.stitch * km, gap = L.gap * km;
  const stitches = [];
  for (const f of fc.features) {
    for (const line of f.geometry.coordinates) {
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        if (!isUp(a) || !isUp(b)) continue;
        const [x0, y0] = proj(a), [x1, y1] = proj(b);
        const d = Math.hypot(x1 - x0, y1 - y0);
        if (d < 1) continue;
        const n = Math.max(1, Math.round(d / (len + gap)));
        const ux = (x1 - x0) / d, uy = (y1 - y0) / d, step = d / n;
        for (let j = 0; j < n; j++) {
          const s0 = j * step + gap / 2, s1 = (j + 1) * step - gap / 2;
          stitches.push([x0 + ux * s0, y0 + uy * s0, x0 + ux * s1, y0 + uy * s1]);
        }
      }
    }
  }
  ctx.lineCap = 'round';
  for (const [color, width, dx] of [[L.shadow, L.width * 1.25, 0.5], [L.color, L.width, 0], [L.sheen, L.width * 0.35, -0.25]]) {
    ctx.beginPath();
    for (const [a, b, c, d] of stitches) { ctx.moveTo(a + dx * km, b + dx * km); ctx.lineTo(c + dx * km, d + dx * km); }
    ctx.strokeStyle = color; ctx.lineWidth = width * km; ctx.stroke();
  }
}

// ---------- star shapes ----------

function starColor(theme, bv) {
  const S = theme.star;
  if (!S.tint) return S.color;
  const b = parseFloat(bv);
  if (isNaN(b)) return S.color;
  const T = S.tints || { hot: '#dce6ff', warm: '#fff1dc', cool: '#ffd9b0' };
  if (b < 0) return T.hot;
  if (b > 1.2) return T.cool;
  if (b > 0.6) return T.warm;
  return S.color;
}

const ASCII = [[0.5, '@'], [1.6, '*'], [2.8, '+'], [4.0, '·'], [99, '.']];

export function drawStarShape(ctx, scene, x, y, r, props, km) {
  const theme = scene.theme, S = theme.star;
  const mag = props.mag;
  const color = paint(scene, starColor(theme, props.bv));
  switch (S.shape) {
    case 'ascii': {
      const ch = ASCII.find(([m]) => mag < m)[1];
      const size = Math.max(7, (16 - mag * 2.2)) * km;
      ctx.textBaseline = 'middle';
      ctx.font = `400 ${size}px ${S.font}`;
      ctx.textAlign = 'center';
      if (mag < 2) {
        ctx.save(); ctx.filter = blur(ctx, 2.2 * km); ctx.fillStyle = S.glowColor; ctx.fillText(ch, x, y); ctx.restore();
      }
      ctx.fillStyle = mag < 4 ? color : S.faint;
      ctx.fillText(ch, x, y);
      return;
    }
    case 'riso': {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (mag < 1.8) {
        const [mx, my] = S.mis;
        ctx.strokeStyle = S.ring; ctx.lineWidth = 1.3 * km;
        ctx.beginPath(); ctx.arc(x + mx * km, y + my * km, r + 3.6 * km, 0, TAU); ctx.stroke();
      }
      return;
    }
    case 'stitch': {
      ctx.lineCap = 'round';
      if (mag < 2.2) {
        const L = r * 2.4 + 2 * km;
        const arms = [[1, 0], [0, 1], [0.7, 0.7], [0.7, -0.7]];
        for (const [c, w, o] of [[S.shadow, 1.5, 0.4], [color, 1.1, 0], [S.sheen, 0.4, -0.2]]) {
          ctx.beginPath();
          arms.forEach(([dx, dy], i) => {
            const l = i < 2 ? L : L * 0.7;
            ctx.moveTo(x - dx * l + o * km, y - dy * l + o * km); ctx.lineTo(x + dx * l + o * km, y + dy * l + o * km);
          });
          ctx.strokeStyle = c; ctx.lineWidth = w * km; ctx.stroke();
        }
      } else if (mag < 4) {
        const L = r + 1.4 * km;
        for (const [c, w, o] of [[S.shadow, 1.2, 0.35], [color, 0.9, 0], [S.sheen, 0.35, -0.2]]) {
          ctx.beginPath();
          ctx.moveTo(x - L + o * km, y - L + o * km); ctx.lineTo(x + L + o * km, y + L + o * km);
          ctx.moveTo(x - L + o * km, y + L + o * km); ctx.lineTo(x + L + o * km, y - L + o * km);
          ctx.strokeStyle = c; ctx.lineWidth = w * km; ctx.stroke();
        }
      } else {
        const rr = Math.max(0.8, r) * 1.1;
        ctx.fillStyle = S.shadow; ctx.beginPath(); ctx.arc(x + 0.35 * km, y + 0.35 * km, rr, 0, TAU); ctx.fill();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
        ctx.fillStyle = S.sheen; ctx.beginPath(); ctx.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.35, 0, TAU); ctx.fill();
      }
      return;
    }
    default: break;
  }

  if (S.glow && mag < (S.glowMag ?? 2.4)) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4.2);
    g.addColorStop(0, S.glowColor || 'rgba(255,255,255,0.32)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 4.2, 0, TAU); ctx.fill();
  }
  if (S.bleed) {
    const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 1.9);
    g.addColorStop(0, S.bleed);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, TAU); ctx.fill();
  }
  if (S.shape === 'sparkle' && mag < 1.8) {
    const L = r * 3.4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - L);
    ctx.quadraticCurveTo(x, y, x + L, y);
    ctx.quadraticCurveTo(x, y, x, y + L);
    ctx.quadraticCurveTo(x, y, x - L, y);
    ctx.quadraticCurveTo(x, y, x, y - L);
    ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.fill();
    return;
  }
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (S.ring && mag < 1.6) {
    ctx.strokeStyle = color; ctx.lineWidth = 0.6 * km;
    ctx.beginPath(); ctx.arc(x, y, r + 1.8 * km, 0, TAU); ctx.stroke();
  }
  if (S.shape === 'cross' && mag < 1.6) {
    const L = r + 5 * km;
    ctx.strokeStyle = color; ctx.lineWidth = 0.6 * km;
    ctx.beginPath();
    ctx.moveTo(x - L, y); ctx.lineTo(x - r - 1.5 * km, y); ctx.moveTo(x + r + 1.5 * km, y); ctx.lineTo(x + L, y);
    ctx.moveTo(x, y - L); ctx.lineTo(x, y - r - 1.5 * km); ctx.moveTo(x, y + r + 1.5 * km); ctx.lineTo(x, y + L);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r + 2.6 * km, 0, TAU); ctx.stroke();
  }
  if (S.shape === 'spikes' && mag < 1.3) {
    const L = r * (6 + (1.3 - mag) * 2.5);
    ctx.lineWidth = 0.55 * km;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const g = ctx.createLinearGradient(x, y, x + dx * L, y + dy * L);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * L, y + dy * L); ctx.stroke();
    }
  }
}

// Stars of the drawn asterisms only, in the three pigments of early Chinese star charts.
export function asterismStars(scene, fc) {
  const data = scene.data;
  if (!data.__magByPos) {
    data.__magByPos = new Map(data.stars.features.map(f => [`${f.geometry.coordinates[0].toFixed(2)},${f.geometry.coordinates[1].toFixed(2)}`, f.properties.mag]));
  }
  const names = new Map((scene.opts.culture === 'chinese' ? data.consCn : data.cons).features.map(f => [String(f.id), f.properties.name]));
  const seen = new Set();
  const out = [];
  for (const f of fc.features) {
    const name = names.get(String(f.id)) || String(f.id);
    const group = /宿$/.test(name) ? 0 : /垣|北斗|北极|勾陈/.test(name) ? 1 : (hashString(name) % 10 < 7 ? 1 : 2);
    for (const line of f.geometry.coordinates) {
      for (const c of line) {
        const key = `${c[0].toFixed(2)},${c[1].toFixed(2)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ c, group, mag: data.__magByPos.get(key) ?? 4.5 });
      }
    }
  }
  return out;
}

export function drawPigmentStar(ctx, scene, x, y, star, km) {
  const P = scene.theme.star.palette[star.group];
  const r = Math.max(1.7, Math.min(4.2, 2.5 + (3 - star.mag) * 0.45)) * km;
  ctx.fillStyle = P.fill;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (P.stroke) { ctx.strokeStyle = P.stroke; ctx.lineWidth = 0.8 * km; ctx.stroke(); }
}

// ---------- frames ----------

function azPoint(chart, az, r) {
  const a = az * Math.PI / 180;
  return [chart.cx - Math.sin(a) * r, chart.cy - Math.cos(a) * r]; // north up, east left
}

export function drawFrame(ctx, scene, chart, seed = 4242, index = 0) {
  const { theme, lang } = scene;
  const { cx, cy, R } = chart;
  const k = R / BASE_R, km = Math.pow(k, 0.8);
  const b = theme.border;
  const stroke = paint(scene, b.color);
  ctx.strokeStyle = stroke;
  let compassDist = R + 26 * km;

  switch (b.kind) {
    case 'thin':
      ctx.lineWidth = b.width * km;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.6 * km; ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.arc(cx, cy, R + 9 * km, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    case 'atlas':
      ctx.lineWidth = b.width * km;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R + 18 * km, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.7 * km;
      ticks(ctx, chart, 5, az => (az % 30 === 0 ? 18 : az % 15 === 0 ? 11 : 6) * km, R);
      compassDist = R + 38 * km;
      break;
    case 'brush': brushRing(ctx, chart, b, seed, k, km); compassDist = R + 30 * km; break;
    case 'blueprint': {
      ctx.lineWidth = b.width * km;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.6 * km;
      ctx.beginPath(); ctx.arc(cx, cy, R + 16 * km, 0, TAU); ctx.stroke();
      ticks(ctx, chart, 1, az => (az % 10 === 0 ? 10 : az % 5 === 0 ? 6 : 3) * km, R + 16 * km, -1);
      ctx.fillStyle = stroke;
      ctx.textBaseline = 'middle';
      for (let az = 0; az < 360; az += 30) {
        if (az % 90 === 0) continue;
        const [x, y] = azPoint(chart, az, R + 30 * km);
        spacedText(ctx, String(az).padStart(3, '0'), x, y, { font: '"Space Mono", monospace', size: 9 * km, weight: 400, spacing: 0 });
      }
      for (const az of [0, 90, 180, 270]) {
        const [x, y] = azPoint(chart, az, R + 18 * km);
        const a = az * Math.PI / 180;
        const tx = -Math.sin(a), ty = -Math.cos(a), nx = Math.cos(a), ny = -Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(x + tx * 9 * km, y + ty * 9 * km);
        ctx.lineTo(x + nx * 4 * km, y + ny * 4 * km);
        ctx.lineTo(x - nx * 4 * km, y - ny * 4 * km);
        ctx.closePath(); ctx.fill();
      }
      compassDist = R + 46 * km;
      break;
    }
    case 'deco': {
      const gold = paint(scene, '@gold');
      ctx.strokeStyle = gold;
      ctx.lineWidth = 1.4 * km;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.7 * km;
      ctx.beginPath(); ctx.arc(cx, cy, R + 8 * km, 0, TAU); ctx.stroke();
      ctx.beginPath();
      for (let az = 0; az < 360; az += 2.5) {
        const long = Math.round(az / 2.5) % 2 === 0;
        const [x1, y1] = azPoint(chart, az, R + 13 * km), [x2, y2] = azPoint(chart, az, R + (long ? 34 : 24) * km);
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      }
      ctx.lineWidth = 0.5 * km; ctx.stroke();
      ctx.fillStyle = gold;
      for (const az of [0, 90, 180, 270]) {
        const [x, y] = azPoint(chart, az, R + 8 * km);
        ctx.beginPath();
        ctx.moveTo(x, y - 6 * km); ctx.lineTo(x + 6 * km, y); ctx.lineTo(x, y + 6 * km); ctx.lineTo(x - 6 * km, y); ctx.closePath();
        ctx.fill();
      }
      compassDist = R + 50 * km;
      break;
    }
    case 'neon': {
      for (const [rr, color, glowColor, w] of [[R, b.color, b.glow, 1.6], [R + 13 * km, b.color2, b.glow2, 1]]) {
        ctx.save();
        ctx.filter = blur(ctx, 5 * km);
        ctx.strokeStyle = glowColor; ctx.lineWidth = w * 4 * km; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = color; ctx.lineWidth = w * km;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
      }
      ctx.strokeStyle = b.color2; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.6 * km;
      ticks(ctx, chart, 5, az => (az % 30 === 0 ? 9 : 4) * km, R + 18 * km);
      ctx.globalAlpha = 1;
      ctx.fillStyle = b.color2;
      ctx.textBaseline = 'middle';
      for (let az = 30; az < 360; az += 30) {
        if (az % 90 === 0) continue;
        const [x, y] = azPoint(chart, az, R + 36 * km);
        spacedText(ctx, String(az).padStart(3, '0'), x, y, { font: '"Oxanium", sans-serif', size: 9 * km, weight: 400, spacing: 0.1 });
      }
      compassDist = R + 40 * km;
      break;
    }
    case 'terminal': {
      ctx.save();
      ctx.setLineDash([2.5 * km, 4 * km]);
      ctx.lineWidth = b.width * km;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = stroke;
      ctx.textBaseline = 'middle';
      for (let az = 30; az < 360; az += 30) {
        if (az % 90 === 0) continue;
        const [x, y] = azPoint(chart, az, R + 22 * km);
        spacedText(ctx, String(az).padStart(3, '0'), x, y, { font: '"VT323", monospace', size: 15 * km, weight: 400, spacing: 0 });
      }
      compassDist = R + 24 * km;
      break;
    }
    case 'hoop': hoop(ctx, scene, chart, km); compassDist = R + 58 * km; break;
    case 'instant': instantFinish(ctx, scene, chart, seed, index); compassDist = R + 30 * km; break;
    case 'riso': {
      const [mx, my] = b.mis.map(v => v * km);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = b.pink; ctx.lineWidth = 5 * km;
      ctx.beginPath(); ctx.arc(cx + mx, cy + my, R + 9 * km, 0, TAU); ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = 1.2 * km;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.restore();
      compassDist = R + 30 * km;
      break;
    }
    case 'stamp':
      ctx.lineWidth = 1.6 * km;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.6 * km;
      ctx.beginPath(); ctx.arc(cx, cy, R + 7 * km, 0, TAU); ctx.stroke();
      compassDist = R + 24 * km;
      break;
    case 'soft': {
      const g = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.002);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, b.fade);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R + 1, 0, TAU); ctx.fill();
      compassDist = R + 22 * km;
      break;
    }
    default: compassDist = R + 24 * km; break;
  }

  const spec = theme.compass;
  if (!spec || spec.format === 'none') return;
  if (spec.dist) compassDist = R + spec.dist * km;
  const C = STR[lang].compass;
  ctx.fillStyle = paint(scene, spec.color);
  ctx.textBaseline = 'middle';
  for (const [key, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
    const [x, y] = azPoint(chart, az, compassDist);
    let text = C[key];
    if (spec.format === 'bracket') text = `[${text}]`;
    let sp = { font: spec.font, size: spec.size * km, weight: spec.weight || 500, spacing: 0 };
    if (isLatin(text) && /Ma Shan Zheng/.test(spec.font)) sp = { ...sp, font: '"Cormorant Garamond", serif', italic: true };
    if (spec.glow) glowText(ctx, text, x, y, sp, spec.glow);
    else spacedText(ctx, text, x, y, sp);
  }
}

function ticks(ctx, chart, step, lengthOf, base, dir = 1) {
  ctx.beginPath();
  for (let az = 0; az < 360; az += step) {
    const len = lengthOf(az);
    const [x1, y1] = azPoint(chart, az, base), [x2, y2] = azPoint(chart, az, base + dir * len);
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  }
  ctx.stroke();
}

function brushRing(ctx, chart, b, seed, k, km) {
  const { cx, cy, R } = chart;
  const r = rng(seed);
  const phases = [r() * TAU, r() * TAU, r() * TAU];
  const n = Math.round(420 * Math.max(0.6, k));
  ctx.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * TAU, t1 = ((i + 1.3) / n) * TAU;
      const wob = t => (1.6 * Math.sin(3 * t + phases[0]) + 0.9 * Math.sin(7 * t + phases[1]) + pass * 1.4) * km;
      const dry = Math.sin(2 * t0 + phases[2]) > 0.93 ? 0.25 : 1;
      ctx.lineWidth = b.width * km * (0.55 + 0.6 * (0.5 + 0.5 * Math.sin(5 * t0 + phases[1]))) * (pass ? 0.45 : 1);
      ctx.globalAlpha = (pass ? 0.35 : 0.9) * dry;
      ctx.beginPath();
      ctx.moveTo(cx + (R + wob(t0)) * Math.cos(t0), cy + (R + wob(t0)) * Math.sin(t0));
      ctx.lineTo(cx + (R + wob(t1)) * Math.cos(t1), cy + (R + wob(t1)) * Math.sin(t1));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// A wooden embroidery hoop with a brass clamp at the top.
function hoop(ctx, scene, chart, km) {
  const { cx, cy, R } = chart;
  const H = scene.theme.border;
  const wood = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  H.wood.forEach(([o, c]) => wood.addColorStop(o, c));
  // soft shadow on the fabric
  ctx.save();
  ctx.filter = blur(ctx, 6 * km);
  ctx.strokeStyle = 'rgba(40,25,10,0.35)'; ctx.lineWidth = 26 * km;
  ctx.beginPath(); ctx.arc(cx + 3 * km, cy + 5 * km, R + 20 * km, 0, TAU); ctx.stroke();
  ctx.restore();
  // inner ring peeking out, then the outer ring
  ctx.strokeStyle = wood; ctx.lineWidth = 9 * km;
  ctx.beginPath(); ctx.arc(cx, cy, R + 5 * km, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,35,15,0.55)'; ctx.lineWidth = 0.8 * km;
  ctx.beginPath(); ctx.arc(cx, cy, R + 0.5 * km, 0, TAU); ctx.stroke();
  ctx.strokeStyle = wood; ctx.lineWidth = 22 * km;
  ctx.beginPath(); ctx.arc(cx, cy, R + 21 * km, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,35,15,0.6)'; ctx.lineWidth = 0.9 * km;
  for (const rr of [R + 10 * km, R + 32 * km]) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke(); }
  // grain and highlight
  const gr = rng(77);
  ctx.strokeStyle = 'rgba(90,55,25,0.25)'; ctx.lineWidth = 0.5 * km;
  for (let i = 0; i < 9; i++) {
    const rr = R + (13 + gr() * 16) * km, a0 = gr() * TAU, a1 = a0 + 0.3 + gr() * 0.9;
    ctx.beginPath(); ctx.arc(cx, cy, rr, a0, a1); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,240,215,0.45)'; ctx.lineWidth = 2 * km;
  ctx.beginPath(); ctx.arc(cx, cy, R + 27 * km, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
  // brass clamp
  const top = cy - R - 33 * km;
  const brass = ctx.createLinearGradient(cx - 20 * km, 0, cx + 20 * km, 0);
  H.brass.forEach(([o, c]) => brass.addColorStop(o, c));
  ctx.fillStyle = brass;
  ctx.strokeStyle = 'rgba(70,50,20,0.7)'; ctx.lineWidth = 0.8 * km;
  for (const dx of [-14, 6]) {
    ctx.beginPath(); ctx.rect(cx + dx * km, top - 10 * km, 8 * km, 22 * km); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.rect(cx - 24 * km, top - 7 * km, 48 * km, 7 * km); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + 30 * km, top - 3.5 * km, 6 * km, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,250,230,0.6)'; ctx.lineWidth = 0.8 * km;
  ctx.beginPath(); ctx.moveTo(cx - 22 * km, top - 6 * km); ctx.lineTo(cx + 22 * km, top - 6 * km); ctx.stroke();
}
