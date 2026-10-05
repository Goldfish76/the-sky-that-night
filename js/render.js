// Poster renderer. Draws everything onto a 2D canvas in poster units: 1000 wide,
// 1414 tall for the A-series poster or 2167 tall for a phone wallpaper.
import { makeProjection, isAboveHorizon, eclipticLine } from './astro.js';
import {
  STR, CONSTELLATION_ZH, LABELED_ASTERISMS,
  formatDateLine, formatCoords, lunarDate, moonPhaseName,
} from './i18n.js';

const d3 = window.d3;

export const POSTER_W = 1000;
const BASE_R = 395;
const TAU = Math.PI * 2;

// Chart geometry per format and layout.
export const FORMATS = {
  // A-series poster (1 : √2). "double" is a zigzag with captions beside each sky.
  poster: {
    h: 1414,
    single: [{ cx: 500, cy: 520, R: BASE_R }],
    double: [{ cx: 360, cy: 330, R: 248 }, { cx: 640, cy: 858, R: 248 }],
    captions: 'side',
  },
  // Phone wallpaper (1290 × 2796). The top stays clear for the lock-screen clock.
  phone: {
    h: 2796 * 1000 / 1290,
    single: [{ cx: 500, cy: 1150, R: 430 }],
    double: [{ cx: 500, cy: 780, R: 270 }, { cx: 500, cy: 1530, R: 270 }],
    captions: 'below',
  },
};
export const POSTER_H = FORMATS.poster.h;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function font({ font, weight = 400, size, italic = false }) {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
}

function isLatin(str) {
  return !/[㐀-鿿豈-﫿]/.test(str);
}

// Letter spacing in em; CJK text can use its own (usually tighter) spacing.
function spacingFor(spec, str) {
  return isLatin(str) ? (spec.spacing || 0) : (spec.cjkSpacing ?? spec.spacing ?? 0);
}

function measureSpaced(ctx, str, spec) {
  const chars = Array.from(spec.upper ? str.toUpperCase() : str);
  ctx.font = font(spec);
  const gap = spacingFor(spec, str) * spec.size;
  return chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + gap * Math.max(0, chars.length - 1);
}

// Draw text with letter spacing (canvas letterSpacing is not supported everywhere).
function spacedText(ctx, str, x, y, spec, opts = {}) {
  const { align = 'center', maxWidth = Infinity } = opts;
  let size = spec.size;
  const chars = Array.from(spec.upper ? str.toUpperCase() : str);
  const em = spacingFor(spec, str);
  let widths, gap, total;
  for (let i = 0; i < 6; i++) {
    ctx.font = font({ ...spec, size });
    gap = em * size;
    widths = chars.map(ch => ctx.measureText(ch).width);
    total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, chars.length - 1);
    if (total <= maxWidth) break;
    size *= maxWidth / total * 0.98;
  }
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + gap; });
  return total;
}

function scaled(spec, k) {
  return { ...spec, size: Math.max(8, spec.size * k) };
}

// Keeps labels from overlapping each other, bright stars, or the chart edge,
// and never draws the same text twice (e.g. a star and its asterism are both "织女").
class Placer {
  constructor(chart) { this.chart = chart; this.boxes = []; this.texts = new Set(); }
  free(b) {
    const { cx, cy, R } = this.chart;
    const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]];
    if (!corners.every(([x, y]) => Math.hypot(x - cx, y - cy) < R - 6)) return false;
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

// ---------- paper ----------

function drawPaper(ctx, theme, H) {
  const P = theme.paper;
  ctx.fillStyle = P.base;
  ctx.fillRect(0, 0, POSTER_W, H);
  const r = rng(theme.id.length * 9973 + 17);
  const density = H / FORMATS.poster.h;

  if (P.blotches) {
    for (let i = 0; i < P.blotches * density; i++) {
      const x = r() * POSTER_W, y = r() * H, rad = 60 + r() * 220;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(150,105,45,${0.03 + r() * 0.04})`);
      g.addColorStop(1, 'rgba(150,105,45,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  if (P.fibers) {
    ctx.lineCap = 'round';
    for (let i = 0; i < P.fibers * density; i++) {
      const x = r() * POSTER_W, y = r() * H;
      const len = 8 + r() * 26, ang = r() * TAU, bend = (r() - 0.5) * 10;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(ang) * len / 2 + bend, y + Math.sin(ang) * len / 2 - bend,
        x + Math.cos(ang) * len, y + Math.sin(ang) * len,
      );
      ctx.strokeStyle = `rgba(80,70,52,${0.05 + r() * 0.07})`;
      ctx.lineWidth = 0.3 + r() * 0.5;
      ctx.stroke();
    }
  }
  ctx.fillStyle = P.speckle;
  if (!ctx.isVector) {
    // Paper grain: thousands of specks look right in pixels but would bloat a vector file.
    for (let i = 0; i < P.speckles * density; i++) {
      const s = 0.5 + r() * 1.3;
      ctx.fillRect(r() * POSTER_W, r() * H, s, s);
    }
  }
  const v = ctx.createRadialGradient(POSTER_W / 2, H / 2, H * 0.3, POSTER_W / 2, H / 2, H * 0.82);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, P.vignette);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, POSTER_W, H);
}

// ---------- sky ----------

function starRadius(mag) {
  return Math.max(0.42, Math.pow(Math.max(0, 6.4 - mag), 1.32) * 0.4);
}

function starColor(theme, bv) {
  if (!theme.star.tint) return theme.star.color;
  const b = parseFloat(bv);
  if (isNaN(b)) return theme.star.color;
  if (b < 0) return '#dce6ff';
  if (b > 1.2) return '#ffd9b0';
  if (b > 0.6) return '#fff1dc';
  return theme.star.color;
}

function drawStar(ctx, x, y, r, props, theme) {
  const mag = props.mag;
  if (theme.star.glow && mag < 2.4) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4.2);
    g.addColorStop(0, 'rgba(255,255,255,0.32)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 4.2, 0, TAU); ctx.fill();
  }
  if (theme.star.bleed) {
    const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 1.9);
    g.addColorStop(0, 'rgba(22,19,15,0.35)');
    g.addColorStop(1, 'rgba(22,19,15,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = starColor(theme, props.bv);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (theme.id === 'parchment' && mag < 1.6) {
    ctx.strokeStyle = theme.star.color;
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(x, y, r + 1.8, 0, TAU); ctx.stroke();
  }
}

function drawMoon(ctx, x, y, r, fraction, angle, colors) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = colors.dark;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  const k = Math.min(1, Math.max(0, fraction));
  const rx = r * Math.abs(1 - 2 * k);
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); // bright limb faces +x (towards the Sun)
  if (k < 0.5) ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, -Math.PI / 2, true);
  else ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, Math.PI * 1.5, false);
  ctx.closePath();
  ctx.fillStyle = colors.lit;
  ctx.fill();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = colors.dark;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.restore();
}

function labelSpec(spec, text) {
  if (!isLatin(text)) {
    // Chinese has no true italics; draw it upright in a CJK face.
    return spec.italic ? { ...spec, italic: false, font: spec.cjkFont || '"Noto Serif SC", serif' } : spec;
  }
  // Brush/Kai fonts look odd on Latin letters; use an elegant serif instead.
  if (/Ma Shan Zheng/.test(spec.font)) return { ...spec, font: '"Cormorant Garamond", serif', italic: true };
  return spec;
}

export function birthdayStarName(lang, culture, star) {
  if (lang !== 'zh') return star.en;
  return (culture === 'chinese' && star.cn) ? star.cn : star.zh;
}

function formatLy(lang, ly) {
  return lang === 'zh' ? `${ly.toFixed(1)} 光年` : `${ly.toFixed(1)} light-years`;
}

// Draws one sky disc. `chart` is {cx, cy, R}; `k` scales marks and labels for smaller charts.
function drawSky(ctx, scene, s, sky, chart, birthday) {
  const { data, theme, opts, lang } = scene;
  const { cx, cy, R } = chart;
  const k = R / BASE_R;
  const km = Math.pow(k, 0.8); // marks and text shrink less than the chart
  const proj = makeProjection(sky.zenith, cx, cy, R, sky.north);
  const path = d3.geoPath(proj, ctx);
  const zenith = sky.zenith;
  const placer = new Placer(chart);

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();

  const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  sg.addColorStop(0, theme.sky.inner);
  sg.addColorStop(1, theme.sky.outer);
  ctx.fillStyle = sg;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  if (opts.milkyWay) {
    const mw = theme.milkyWay;
    ctx.save();
    if (mw.blur && 'filter' in ctx) ctx.filter = `blur(${(mw.blur * k * s).toFixed(1)}px)`;
    data.mw.features.forEach((f, i) => {
      ctx.beginPath(); path(f);
      ctx.fillStyle = `rgba(${mw.rgb},${mw.alphas[i] ?? mw.alphas[mw.alphas.length - 1]})`;
      ctx.fill();
    });
    ctx.restore();
  }

  if (opts.grid) {
    ctx.beginPath(); path(d3.geoGraticule().step([15, 10])());
    ctx.strokeStyle = theme.grid.color; ctx.lineWidth = theme.grid.width * km; ctx.stroke();
    if (theme.ecliptic) {
      ctx.save();
      ctx.setLineDash(theme.ecliptic.dash.map(v => v * km));
      ctx.beginPath(); path(eclipticLine());
      ctx.strokeStyle = theme.ecliptic.color; ctx.lineWidth = theme.ecliptic.width * km; ctx.stroke();
      ctx.restore();
    }
  }

  if (opts.lines) {
    ctx.beginPath(); path(opts.culture === 'chinese' ? data.linesCn : data.lines);
    ctx.strokeStyle = theme.lines.color; ctx.lineWidth = theme.lines.width * km;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
  }

  const maxMag = theme.star.maxMag ?? 99;
  const bright = [];
  for (const f of data.stars.features) {
    const c = f.geometry.coordinates;
    const mag = f.properties.mag;
    if (mag > maxMag || !isAboveHorizon(c, zenith)) continue;
    const [x, y] = proj(c);
    const r = starRadius(mag) * theme.star.sizeScale * km;
    drawStar(ctx, x, y, r, f.properties, theme);
    if (mag < 2.6) {
      placer.add({ x: x - r - 1.5, y: y - r - 1.5, w: 2 * r + 3, h: 2 * r + 3 });
      bright.push({ f, x, y, r });
    }
  }

  ctx.textBaseline = 'middle';
  const L = STR[lang];

  // Light-year birthday star: drawn first so its label wins any placement conflict.
  if (birthday && birthday.visible) {
    const st = birthday.star;
    const [x, y] = proj(st.c);
    const r = starRadius(st.mag) * theme.star.sizeScale * km;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.3 * km;
    ctx.beginPath(); ctx.arc(x, y, r + 5 * km, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.8 * km;
    ctx.beginPath(); ctx.arc(x, y, r + 10 * km, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    placer.add({ x: x - r - 11 * km, y: y - r - 11 * km, w: 2 * r + 22 * km, h: 2 * r + 22 * km });
    const text = `${birthdayStarName(lang, opts.culture, st)} · ${formatLy(lang, st.ly).replace(' light-years', ' ly')}`;
    const sp = labelSpec(scaled({ ...theme.starNames, color: theme.accent, spacing: 0.03, cjkSpacing: 0.04, size: theme.starNames.size + 1 }, km), text);
    ctx.fillStyle = theme.accent;
    const g = r + 13 * km;
    placer.place(ctx, text, sp, [
      [x + g, y, 'left'], [x - g, y, 'right'], [x, y - g - sp.size * 0.4, 'center'], [x, y + g + sp.size * 0.4, 'center'],
    ]);
  }

  if (opts.bodies) {
    const bc = theme.bodies;
    const spec = scaled({ ...theme.starNames, spacing: 0.04, cjkSpacing: 0.04 }, km);
    const m = sky.moon;
    const items = [];
    if (m.alt > 0) {
      const [x, y] = proj(m.coord);
      const toward = d3.geoInterpolate(m.coord, sky.sun.coord)(0.02);
      const [tx, ty] = proj(toward);
      const mr = 11 * km;
      drawMoon(ctx, x, y, mr, m.fraction, Math.atan2(ty - y, tx - x), bc);
      placer.add({ x: x - mr - 2, y: y - mr - 2, w: 2 * mr + 4, h: 2 * mr + 4 });
      items.push({ x, y, r: mr, text: `${moonPhaseName(lang, m.phaseDeg, m.fraction)} ${Math.round(m.fraction * 100)}%` });
    }
    for (const p of sky.planets) {
      if (p.alt <= 0) continue;
      const [x, y] = proj(p.coord);
      ctx.fillStyle = bc.planet;
      ctx.beginPath(); ctx.arc(x, y, 2.8 * km, 0, TAU); ctx.fill();
      ctx.strokeStyle = bc.planet; ctx.lineWidth = 0.7 * km;
      ctx.beginPath(); ctx.arc(x, y, 5.2 * km, 0, TAU); ctx.stroke();
      placer.add({ x: x - 6 * km, y: y - 6 * km, w: 12 * km, h: 12 * km });
      items.push({ x, y, r: 5.2 * km, text: L.bodies[p.name] });
    }
    ctx.fillStyle = bc.label;
    for (const it of items) {
      const sp = labelSpec(spec, it.text), g = it.r + 5 * km;
      placer.place(ctx, it.text, sp, [
        [it.x + g, it.y, 'left'], [it.x - g, it.y, 'right'],
        [it.x, it.y + g + sp.size * 0.6, 'center'], [it.x, it.y - g - sp.size * 0.6, 'center'],
      ]);
    }
  }

  if (opts.starNames) {
    const spec = scaled({ ...theme.starNames, spacing: 0.02, cjkSpacing: 0.04 }, km);
    ctx.fillStyle = spec.color;
    for (const { f, x, y, r } of bright.slice().sort((a, b) => a.f.properties.mag - b.f.properties.mag)) {
      if (f.properties.mag > 1.5) continue;
      const n = data.starNames[String(f.id)];
      if (!n) continue;
      const text = lang === 'zh' ? (opts.culture === 'chinese' ? (n.cn || n.zh) : (n.zh || n.cn)) : n.en;
      const sp = labelSpec(spec, text), g = r + 4 * km, dy = sp.size * 0.55;
      placer.place(ctx, text, sp, [
        [x + g, y - dy, 'left'], [x + g, y + dy, 'left'], [x - g, y - dy, 'right'], [x - g, y + dy, 'right'],
      ]);
    }
  }

  if (opts.names) {
    const spec = scaled(theme.labels, km);
    ctx.fillStyle = spec.color;
    const d = 14 * km, dx = 26 * km;
    const tries = (x, y) => [[x, y, 'center'], [x, y - d, 'center'], [x, y + d, 'center'], [x - dx, y, 'center'], [x + dx, y, 'center']];
    if (opts.culture === 'chinese') {
      for (const f of data.consCn.features) {
        const name = f.properties.name;
        if (!LABELED_ASTERISMS.has(name)) continue;
        const c = f.geometry.coordinates;
        if (!isAboveHorizon(c, zenith, 4)) continue;
        const [x, y] = proj(c);
        const sp = /Ma Shan Zheng|KaiTi/.test(spec.font) ? spec : { ...spec, font: '"Noto Serif SC", serif', italic: false };
        placer.place(ctx, name, sp, tries(x, y));
      }
    } else {
      const maxRank = theme.id === 'parchment' ? 2 : 1;
      for (const f of data.cons.features) {
        if (+f.properties.rank > maxRank) continue;
        const c = f.geometry.coordinates;
        if (!isAboveHorizon(c, zenith, 4)) continue;
        const [x, y] = proj(c);
        const text = lang === 'zh' ? (CONSTELLATION_ZH[f.id] || f.properties.zh) : f.properties.name;
        const sp = isLatin(text) ? labelSpec(spec, text) : { ...spec, italic: false, font: spec.cjkFont || spec.font };
        placer.place(ctx, text, sp, tries(x, y));
      }
    }
  }

  ctx.restore();
  return proj;
}

// ---------- frame ----------

function azPoint(chart, az, r) {
  const a = az * Math.PI / 180;
  return [chart.cx - Math.sin(a) * r, chart.cy - Math.cos(a) * r]; // north up, east left
}

function drawFrame(ctx, scene, chart, seed = 4242) {
  const { theme, lang } = scene;
  const { cx, cy, R } = chart;
  const k = R / BASE_R, km = Math.pow(k, 0.8);
  const b = theme.border;
  ctx.strokeStyle = b.color;

  if (b.kind === 'thin') {
    ctx.lineWidth = b.width * km;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = 0.6 * km; ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.arc(cx, cy, R + 9 * km, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (b.kind === 'atlas') {
    ctx.lineWidth = b.width * km;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R + 18 * km, 0, TAU); ctx.stroke();
    ctx.lineWidth = 0.7 * km;
    for (let az = 0; az < 360; az += 5) {
      const len = (az % 30 === 0 ? 18 : az % 15 === 0 ? 11 : 6) * km;
      const [x1, y1] = azPoint(chart, az, R), [x2, y2] = azPoint(chart, az, R + len);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  } else if (b.kind === 'brush') {
    const r = rng(seed);
    const phases = [r() * TAU, r() * TAU, r() * TAU];
    const n = Math.round(420 * Math.max(0.6, k));
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const t0 = (i / n) * TAU, t1 = ((i + 1.3) / n) * TAU;
        const wob = t => (1.6 * Math.sin(3 * t + phases[0]) + 0.9 * Math.sin(7 * t + phases[1]) + pass * 1.4) * km;
        const dry = Math.sin(2 * t0 + phases[2]) > 0.93 ? 0.25 : 1;
        const w = b.width * km * (0.55 + 0.6 * (0.5 + 0.5 * Math.sin(5 * t0 + phases[1]))) * (pass ? 0.45 : 1);
        ctx.lineWidth = w;
        ctx.globalAlpha = (pass ? 0.35 : 0.9) * dry;
        ctx.beginPath();
        ctx.moveTo(cx + (R + wob(t0)) * Math.cos(t0), cy + (R + wob(t0)) * Math.sin(t0));
        ctx.lineTo(cx + (R + wob(t1)) * Math.cos(t1), cy + (R + wob(t1)) * Math.sin(t1));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Compass points
  const C = STR[lang].compass;
  const spec = theme.compass;
  const dist = R + (b.kind === 'atlas' ? 38 : b.kind === 'brush' ? 30 : 26) * km;
  ctx.fillStyle = spec.color;
  ctx.textBaseline = 'middle';
  for (const [key, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
    const [x, y] = azPoint(chart, az, dist);
    const text = C[key];
    spacedText(ctx, text, x, y, labelSpec({ font: spec.font, size: spec.size * km, weight: 500, spacing: 0 }, text));
  }
}

// ---------- text ----------

function drawSeal(ctx, x, y, size, seal) {
  ctx.save();
  ctx.fillStyle = seal.color;
  const r = 5;
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + size - r, y); ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r); ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size); ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,245,235,0.85)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);
  ctx.fillStyle = '#fff6ee';
  ctx.font = `400 ${size * 0.36}px "Ma Shan Zheng", "KaiTi", "STKaiti", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const [a, b2, c, d] = seal.text; // traditional order: right column top→bottom, then left column
  const q = size / 4;
  ctx.fillText(a, x + 3 * q, y + q + 1);
  ctx.fillText(b2, x + 3 * q, y + 3 * q - 1);
  ctx.fillText(c, x + q, y + q + 1);
  ctx.fillText(d, x + q, y + 3 * q - 1);
  ctx.restore();
}

function moonLine(lang, moon) {
  const name = moonPhaseName(lang, moon.phaseDeg, moon.fraction);
  const pct = Math.round(moon.fraction * 100);
  return lang === 'zh' ? `月相：${name}（${pct}%）` : `Moon: ${name}, ${pct}% illuminated`;
}

function birthdayLine(lang, culture, birthday) {
  const name = birthdayStarName(lang, culture, birthday.star);
  const ly = formatLy(lang, birthday.star.ly);
  const L = STR[lang];
  return (birthday.visible ? L.birthdayLineVisible : L.birthdayLineHidden).replace('{name}', name).replace('{ly}', ly);
}

// Fonts for the small info lines, per theme and language.
function infoSpec(theme, lang) {
  const T = theme.text;
  if (theme.id === 'noir') return { ...T.info, upper: lang !== 'zh' };
  if (theme.id === 'parchment') {
    return lang === 'zh' ? { ...T.info, font: '"Noto Serif SC", "Songti SC", serif', size: T.info.size - 2, spacing: 0.06 } : T.info;
  }
  return lang === 'zh' ? T.info : { ...T.messageLatin, size: 18, italic: false, spacing: 0.06 };
}

function titleSpec(theme, title) {
  const T = theme.text;
  return theme.id === 'ink' && isLatin(title) ? T.titleLatin : T.title;
}

function messageSpec(theme, message) {
  const T = theme.text;
  if (theme.id === 'ink') return isLatin(message) ? T.messageLatin : T.message;
  if (theme.id === 'parchment' && !isLatin(message)) return { ...T.message, italic: false, font: '"Noto Serif SC", serif', size: T.message.size - 3 };
  return T.message;
}

// Title (+ ornament / seal) centred at `top`; returns the title width.
function drawTitleBlock(ctx, scene, top, maxW) {
  const { theme, text } = scene;
  const T = theme.text;
  const mid = POSTER_W / 2;
  const title = text.title || '';
  ctx.fillStyle = T.color;
  let titleWidth = 0;
  if (title) titleWidth = spacedText(ctx, title, mid, top, titleSpec(theme, title), { maxWidth: theme.id === 'ink' ? 700 : maxW });
  if (theme.id === 'noir') {
    ctx.strokeStyle = T.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mid - 32, top + 30); ctx.lineTo(mid + 32, top + 30); ctx.stroke();
  } else if (theme.id === 'parchment') {
    ctx.strokeStyle = T.rule; ctx.fillStyle = T.rule; ctx.lineWidth = 0.9;
    const oy = top + 26;
    ctx.beginPath(); ctx.moveTo(mid - 90, oy); ctx.lineTo(mid - 10, oy); ctx.moveTo(mid + 10, oy); ctx.lineTo(mid + 90, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mid, oy - 5); ctx.lineTo(mid + 5, oy); ctx.lineTo(mid, oy + 5); ctx.lineTo(mid - 5, oy); ctx.closePath(); ctx.fill();
  } else if (theme.seal) {
    const size = 50;
    const sx = Math.min(mid + titleWidth / 2 + 22, POSTER_W - 90);
    drawSeal(ctx, sx, top - 44, size, theme.seal);
  }
  return titleWidth;
}

function drawTextSingle(ctx, scene, chart) {
  const { theme, lang, text, local, place, sky, opts, birthday } = scene;
  const T = theme.text;
  const mid = POSTER_W / 2;
  const maxW = 820;
  ctx.textBaseline = 'alphabetic';
  const message = text.message || '';
  const dateLine = formatDateLine(lang, local, theme.id);
  const coords = formatCoords(lang, place.lat, place.lon);
  const top = chart.cy + chart.R + 122 + (theme.id === 'ink' ? 10 : 0);
  const info = infoSpec(theme, lang);

  drawTitleBlock(ctx, scene, top, maxW);
  if (message) {
    ctx.fillStyle = T.color;
    spacedText(ctx, message, mid, top + (theme.id === 'ink' ? 62 : 78), messageSpec(theme, message), { maxWidth: maxW });
  }
  ctx.fillStyle = T.sub;
  let y = top + (message ? 128 : 102) - (theme.id === 'ink' ? 6 : 0);
  const lines = [];
  if (theme.id === 'noir') lines.push(place.label, dateLine, coords);
  else if (theme.id === 'parchment') lines.push(`${place.label}  ·  ${dateLine}`, coords, moonLine(lang, sky.moon));
  else {
    const lunar = lunarDate(local);
    lines.push(dateLine);
    if (lang === 'zh') lines.push(`${lunar ? `农历${lunar}  ·  ` : ''}${place.label}`, coords);
    else lines.push(`${place.label}  ·  ${coords}`);
  }
  const step = theme.id === 'parchment' ? 28 : 30;
  lines.forEach((ln, i) => {
    const isMoon = theme.id === 'parchment' && i === 2;
    spacedText(ctx, ln, mid, y, isMoon ? { ...info, italic: lang !== 'zh', size: info.size - 1 } : info, { maxWidth: maxW });
    y += step;
  });
  if (birthday) {
    ctx.fillStyle = theme.accent;
    const spec = { ...info, upper: false, italic: lang !== 'zh' && theme.id !== 'noir', size: info.size, spacing: Math.min(info.spacing || 0, 0.06) };
    spacedText(ctx, birthdayLine(lang, opts.culture, birthday), mid, y + 12, spec, { maxWidth: maxW });
  }
}

function drawTextDouble(ctx, scene, charts, captions) {
  const { theme, lang, text, skies } = scene;
  const T = theme.text;
  const [A, B] = charts;
  const info = infoSpec(theme, lang);
  const capBase = titleSpec(theme, text.title || '');
  ctx.textBaseline = 'alphabetic';

  if (captions === 'below') {
    // Phone wallpaper: a caption and one info line centred under each sky.
    skies.forEach((sk, i) => {
      const chart = charts[i];
      const capSpec = { ...capBase, size: Math.min(capBase.size * 0.5, 32), upper: false, spacing: theme.id === 'noir' ? 0.12 : capBase.spacing };
      let y = chart.cy + chart.R + 68;
      if (sk.caption) {
        ctx.fillStyle = T.color;
        spacedText(ctx, sk.caption, POSTER_W / 2, y, capSpec, { maxWidth: 820 });
        y += 34;
      }
      ctx.fillStyle = T.sub;
      spacedText(ctx, `${sk.place.label}  ·  ${formatDateLine(lang, sk.local, theme.id)}`, POSTER_W / 2, y,
        { ...info, size: info.size - 1 }, { maxWidth: 820 });
    });
    const top = B.cy + B.R + 205;
    drawTitleBlock(ctx, scene, top, 820);
    if (text.message) {
      ctx.fillStyle = T.color;
      spacedText(ctx, text.message, POSTER_W / 2, top + (theme.id === 'ink' ? 58 : 72), messageSpec(theme, text.message), { maxWidth: 820 });
    }
    return;
  }

  skies.forEach((sk, i) => {
    const chart = i === 0 ? A : B;
    const leftSide = i === 1; // second sky sits on the right, so its caption goes on the left
    const x = leftSide ? chart.cx - chart.R - 60 : chart.cx + chart.R + 60;
    const align = leftSide ? 'right' : 'left';
    const maxW = leftSide ? x - 40 : POSTER_W - 40 - x;
    const caption = sk.caption || '';
    const capSpec = { ...capBase, size: Math.min(capBase.size * 0.58, 36), upper: false, spacing: theme.id === 'noir' ? 0.12 : capBase.spacing };
    const lines = [formatDateLine(lang, sk.local, theme.id)];
    if (theme.id === 'ink' && lang === 'zh') {
      const lunar = lunarDate(sk.local);
      if (lunar) lines.push(`农历${lunar}`);
    }
    lines.push(sk.place.label, formatCoords(lang, sk.place.lat, sk.place.lon));
    const blockH = 44 + lines.length * 27;
    let y = chart.cy - blockH / 2 + 24;
    if (caption) {
      ctx.fillStyle = T.color;
      spacedText(ctx, caption, x, y, capSpec, { align, maxWidth: maxW });
      y += 42;
    }
    ctx.fillStyle = T.sub;
    const small = { ...info, size: info.size - 1 };
    for (const ln of lines) {
      spacedText(ctx, ln, x, y, small, { align, maxWidth: maxW });
      y += 27;
    }
  });

  const top = B.cy + B.R + 118;
  drawTitleBlock(ctx, scene, top, 820);
  const message = text.message || '';
  if (message) {
    ctx.fillStyle = T.color;
    spacedText(ctx, message, POSTER_W / 2, top + (theme.id === 'ink' ? 58 : 72), messageSpec(theme, message), { maxWidth: 820 });
  }
}

function drawCredit(ctx, scene, H) {
  const { theme, lang, opts } = scene;
  ctx.fillStyle = theme.credit;
  ctx.textBaseline = 'alphabetic';
  const spec = { font: '"Jost", "Noto Sans SC", sans-serif', weight: 400, size: 11, spacing: 0.12, cjkSpacing: 0.12 };
  let credit = STR[lang].credit;
  // The Chinese asterism data comes from Stellarium's sky culture (CC BY-SA), which asks for attribution.
  if (opts.culture === 'chinese' && (opts.lines || opts.names)) credit += STR[lang].creditChinese;
  spacedText(ctx, credit, POSTER_W / 2, H - 38, spec, { maxWidth: 900 });
}

export function posterHeight(format = 'poster') {
  return (FORMATS[format] || FORMATS.poster).h;
}

// scene.skies: [{ sky, local, place, caption }] — one entry for the single layout, two for the double layout.
// scene.format: 'poster' (default) or 'phone'. `canvas` may also be the SVG recorder from svg.js.
export function renderPoster(canvas, scene) {
  const ctx = canvas.getContext('2d');
  const F = FORMATS[scene.format] || FORMATS.poster;
  const H = F.h;
  const s = canvas.width / POSTER_W;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.clearRect(0, 0, POSTER_W, H);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  drawPaper(ctx, scene.theme, H);
  const layout = scene.skies.length > 1 ? 'double' : 'single';
  const charts = F[layout];
  scene.skies.forEach((sk, i) => {
    drawSky(ctx, scene, s, sk.sky, charts[i], layout === 'single' ? scene.birthday : null);
    drawFrame(ctx, scene, charts[i], 4242 + i * 77);
  });
  if (layout === 'single') {
    const sk = scene.skies[0];
    drawTextSingle(ctx, { ...scene, sky: sk.sky, local: sk.local, place: sk.place }, charts[0]);
  } else {
    drawTextDouble(ctx, scene, charts, F.captions);
  }
  if (scene.opts.credit) drawCredit(ctx, scene, H);
}
