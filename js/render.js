// Poster renderer. Draws everything onto a 2D canvas in poster units: 1000 wide,
// 1414 tall for the A-series poster or 2167.4 tall for a phone wallpaper.
// The look comes from the theme (themes.js); decor.js and layouts.js hold the effects.
import { makeProjection, isAboveHorizon } from './astro.js';
import { STR, CONSTELLATION_ZH, LABELED_ASTERISMS, moonPhaseName } from './i18n.js';
import { POSTER_W, BASE_R, TAU, Placer, scaled, isLatin, paint, hashString } from './draw.js';
import {
  drawPaper, drawSkyUnderlay, drawSkyBackground, drawMilkyWay, drawGuides, drawLines,
  drawStarShape, asterismStars, drawPigmentStar, drawFrame,
} from './decor.js';
import { drawTextSingle, drawTextDouble, drawCredit, drawOverlay, birthdayStarName, formatLy } from './layouts.js';
import { makeHorizon } from './horizon.js';

export { POSTER_W, birthdayStarName };

const d3 = window.d3;

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

export function posterHeight(format = 'poster') {
  return (FORMATS[format] || FORMATS.poster).h;
}

function starRadius(mag) {
  return Math.max(0.42, Math.pow(Math.max(0, 6.4 - mag), 1.32) * 0.4);
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
  ctx.strokeStyle = colors.edge || colors.dark;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.restore();
}

function labelSpec(spec, text) {
  if (!isLatin(text)) {
    // Chinese has no true italics; draw it upright in a CJK face.
    return spec.italic ? { ...spec, italic: false, font: spec.cjkFont || '"Noto Serif SC", serif' } : spec;
  }
  // Brush and handwriting fonts look odd on Latin letters; use the theme's Latin face instead.
  if (spec.latinFont) return { ...spec, font: spec.latinFont, italic: spec.latinItalic ?? spec.italic };
  if (/Ma Shan Zheng/.test(spec.font)) return { ...spec, font: '"Cormorant Garamond", serif', italic: true };
  return spec;
}

// Draws one sky disc. `chart` is {cx, cy, R}. Returns a few stats for the text layouts.
function drawSky(ctx, scene, sky, chart, birthday, seed) {
  const { data, theme, opts, lang } = scene;
  const { cx, cy, R } = chart;
  const k = R / BASE_R;
  const km = Math.pow(k, 0.8); // marks and text shrink less than the chart
  const proj = makeProjection(sky.zenith, cx, cy, R, sky.north);
  const path = d3.geoPath(proj, ctx);
  const zenith = sky.zenith;
  const isUp = c => isAboveHorizon(c, zenith);
  // Trees or buildings around the horizon (seeded by the place, not the time).
  const horizon = makeHorizon(scene, chart, hashString(`${sky.lat.toFixed(2)},${sky.lon.toFixed(2)}`));
  const hidden = (x, y) => !!horizon && horizon.occludes(x, y);
  const placer = new Placer(chart, horizon);
  const stats = { stars: 0 };

  drawSkyUnderlay(ctx, scene, chart, seed);

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  drawSkyBackground(ctx, scene, chart, seed);
  if (opts.milkyWay) drawMilkyWay(ctx, scene, path, proj, chart);
  drawGuides(ctx, scene, path, sky, chart);

  const fc = opts.culture === 'chinese' ? data.linesCn : data.lines;
  if (opts.lines) drawLines(ctx, scene, path, proj, chart, fc, isUp);

  const bright = [];
  if (theme.star.source === 'asterisms') {
    // Ancient-chart style: only the stars of the drawn asterisms, in pigment colours.
    for (const st of asterismStars(scene, fc)) {
      if (!isUp(st.c)) continue;
      const [x, y] = proj(st.c);
      drawPigmentStar(ctx, scene, x, y, st, km);
      stats.stars++;
    }
    for (const f of data.stars.features) {
      if (f.properties.mag >= 1.5 || !isUp(f.geometry.coordinates)) continue;
      const [x, y] = proj(f.geometry.coordinates);
      const r = 3.6 * km;
      placer.add({ x: x - r - 1.5, y: y - r - 1.5, w: 2 * r + 3, h: 2 * r + 3 });
      bright.push({ f, x, y, r });
    }
  } else {
    const maxMag = theme.star.maxMag ?? 99;
    ctx.save();
    if (theme.star.blend) ctx.globalCompositeOperation = theme.star.blend; // printed inks overprint
    for (const f of data.stars.features) {
      const c = f.geometry.coordinates;
      const mag = f.properties.mag;
      if (mag > maxMag || !isUp(c)) continue;
      const [x, y] = proj(c);
      const r = starRadius(mag) * theme.star.sizeScale * km;
      drawStarShape(ctx, scene, x, y, r, f.properties, km);
      stats.stars++;
      if (mag < 2.6) {
        placer.add({ x: x - r - 1.5, y: y - r - 1.5, w: 2 * r + 3, h: 2 * r + 3 });
        bright.push({ f, x, y, r });
      }
    }
    ctx.restore();
  }

  ctx.textBaseline = 'middle';
  const L = STR[lang];
  const accent = paint(scene, theme.accent);

  // Light-year birthday star: drawn first so its label wins any placement conflict.
  if (birthday && birthday.visible && !hidden(...proj(birthday.star.c))) {
    const st = birthday.star;
    const [x, y] = proj(st.c);
    const r = starRadius(st.mag) * theme.star.sizeScale * km;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.3 * km;
    ctx.beginPath(); ctx.arc(x, y, r + 5 * km, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.8 * km;
    ctx.beginPath(); ctx.arc(x, y, r + 10 * km, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    placer.add({ x: x - r - 11 * km, y: y - r - 11 * km, w: 2 * r + 22 * km, h: 2 * r + 22 * km });
    const text = `${birthdayStarName(lang, opts.culture, st)} · ${formatLy(lang, st.ly).replace(' light-years', ' ly')}`;
    const sp = labelSpec(scaled({ ...theme.starNames, color: accent, spacing: 0.03, cjkSpacing: 0.04, size: theme.starNames.size + 1 }, km), text);
    ctx.fillStyle = accent;
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
    if (m.alt > 0 && !hidden(...proj(m.coord))) {
      const [x, y] = proj(m.coord);
      const toward = d3.geoInterpolate(m.coord, sky.sun.coord)(0.02);
      const [tx, ty] = proj(toward);
      const mr = 11 * km;
      if (bc.moonGlow) {
        const g = ctx.createRadialGradient(x, y, mr, x, y, mr * 3);
        g.addColorStop(0, bc.moonGlow); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, mr * 3, 0, TAU); ctx.fill();
      }
      drawMoon(ctx, x, y, mr, m.fraction, Math.atan2(ty - y, tx - x), { ...bc, lit: paint(scene, bc.lit) });
      placer.add({ x: x - mr - 2, y: y - mr - 2, w: 2 * mr + 4, h: 2 * mr + 4 });
      items.push({ x, y, r: mr, text: `${moonPhaseName(lang, m.phaseDeg, m.fraction)} ${Math.round(m.fraction * 100)}%` });
    }
    for (const p of sky.planets) {
      if (p.alt <= 0) continue;
      const [x, y] = proj(p.coord);
      if (hidden(x, y)) continue;
      const pc = paint(scene, bc.planet);
      ctx.fillStyle = pc;
      ctx.beginPath(); ctx.arc(x, y, 2.8 * km, 0, TAU); ctx.fill();
      ctx.strokeStyle = pc; ctx.lineWidth = 0.7 * km;
      ctx.beginPath(); ctx.arc(x, y, 5.2 * km, 0, TAU); ctx.stroke();
      placer.add({ x: x - 6 * km, y: y - 6 * km, w: 12 * km, h: 12 * km });
      items.push({ x, y, r: 5.2 * km, text: L.bodies[p.name] });
    }
    ctx.fillStyle = paint(scene, bc.label);
    for (const it of items) {
      let text = it.text;
      if (theme.starNames.lower) text = text.toLowerCase();
      const sp = labelSpec(spec, text), g = it.r + 5 * km;
      placer.place(ctx, text, sp, [
        [it.x + g, it.y, 'left'], [it.x - g, it.y, 'right'],
        [it.x, it.y + g + sp.size * 0.6, 'center'], [it.x, it.y - g - sp.size * 0.6, 'center'],
      ]);
    }
  }

  if (opts.starNames) {
    const spec = scaled({ ...theme.starNames, spacing: 0.02, cjkSpacing: 0.04 }, km);
    ctx.fillStyle = paint(scene, spec.color);
    for (const { f, x, y, r } of bright.slice().sort((a, b) => a.f.properties.mag - b.f.properties.mag)) {
      if (f.properties.mag > 1.5 || hidden(x, y)) continue;
      const n = data.starNames[String(f.id)];
      if (!n) continue;
      let text = lang === 'zh' ? (opts.culture === 'chinese' ? (n.cn || n.zh) : (n.zh || n.cn)) : n.en;
      if (theme.starNames.lower) text = text.toLowerCase();
      const sp = labelSpec(spec, text), g = r + 4 * km, dy = sp.size * 0.55;
      placer.place(ctx, text, sp, [
        [x + g, y - dy, 'left'], [x + g, y + dy, 'left'], [x - g, y - dy, 'right'], [x - g, y + dy, 'right'],
      ]);
    }
  }

  if (opts.names) {
    const spec = scaled(theme.labels, km);
    ctx.fillStyle = paint(scene, spec.color);
    const d = 14 * km, dx = 26 * km;
    const tries = (x, y) => [[x, y, 'center'], [x, y - d, 'center'], [x, y + d, 'center'], [x - dx, y, 'center'], [x + dx, y, 'center']];
    if (opts.culture === 'chinese') {
      for (const f of data.consCn.features) {
        const name = f.properties.name;
        if (!LABELED_ASTERISMS.has(name)) continue;
        const c = f.geometry.coordinates;
        if (!isAboveHorizon(c, zenith, 4)) continue;
        const [x, y] = proj(c);
        const sp = /Ma Shan Zheng|KaiTi|Long Cang|ZCOOL/.test(spec.font) ? spec : { ...spec, font: spec.cjkFont || '"Noto Serif SC", serif', italic: false };
        placer.place(ctx, name, sp, tries(x, y));
      }
    } else {
      const maxRank = theme.labels.maxRank ?? 1;
      for (const f of data.cons.features) {
        if (+f.properties.rank > maxRank) continue;
        const c = f.geometry.coordinates;
        if (!isAboveHorizon(c, zenith, 4)) continue;
        const [x, y] = proj(c);
        let text = lang === 'zh' ? (CONSTELLATION_ZH[f.id] || f.properties.zh) : f.properties.name;
        if (theme.labels.lower) text = text.toLowerCase();
        const sp = isLatin(text) ? labelSpec(spec, text) : { ...spec, italic: false, font: spec.cjkFont || spec.font };
        placer.place(ctx, text, sp, tries(x, y));
      }
    }
  }

  if (horizon) horizon.draw(ctx);
  ctx.restore();
  return stats;
}

// Shared paints, e.g. the metallic gold gradient, created once per render.
function makePaints(ctx, theme, H) {
  const paints = {};
  if (theme.goldStops) {
    const g = ctx.createLinearGradient(0, 0, POSTER_W, H * 0.6);
    theme.goldStops.forEach(([o, c]) => g.addColorStop(o, c));
    paints.gold = g;
  }
  return paints;
}

// scene.skies: [{ sky, local, utc, tz, place, caption }] — one entry for the single layout, two for the double layout.
// scene.format: 'poster' (default) or 'phone'. `canvas` may also be the SVG recorder from svg.js.
export function renderPoster(canvas, scene) {
  const ctx = canvas.getContext('2d');
  const F = FORMATS[scene.format] || FORMATS.poster;
  const H = F.h;
  const s = canvas.width / POSTER_W;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.__scale = s;
  ctx.clearRect(0, 0, POSTER_W, H);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  scene = { ...scene, paints: makePaints(ctx, scene.theme, H), H };
  const layout = scene.skies.length > 1 ? 'double' : 'single';
  const charts = F[layout];
  drawPaper(ctx, scene, H, charts);
  const stats = scene.skies.map((sk, i) => {
    const seed = hashString(`${sk.local.y}-${sk.local.m}-${sk.local.d}-${sk.local.hh}-${sk.place.lat}-${sk.place.lon}-${i}`);
    const st = drawSky(ctx, scene, sk.sky, charts[i], layout === 'single' ? scene.birthday : null, seed);
    drawFrame(ctx, scene, charts[i], 4242 + i * 77, i);
    return st;
  });
  if (layout === 'single') {
    const sk = scene.skies[0];
    drawTextSingle(ctx, { ...scene, sky: sk.sky, local: sk.local, place: sk.place, utc: sk.utc, tz: sk.tz, stats: stats[0] }, charts[0], H);
  } else {
    drawTextDouble(ctx, scene, charts, F.captions);
  }
  drawOverlay(ctx, scene, H, charts);
  if (scene.opts.credit) drawCredit(ctx, scene, H);
}
