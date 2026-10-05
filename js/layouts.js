// Text layouts under (or beside) the sky: stack, atlas, ink, titleblock, terminal and vertical.
import {
  POSTER_W, isLatin, spacedText, glowText, font, paint, cnCoord, TAU, crossStitchText, stitchPattern,
  spacingFor, rng, hashString,
} from './draw.js';
import { STR, formatDateLine, formatCoords, lunarDate, moonPhaseName, cnNumeralDate, shichen } from './i18n.js';
import { formatUtcOffset, tzOffsetMinutes } from './astro.js';
import { instantGeometry } from './decor.js';

// ---------- picking fonts ----------

const pick = (base, cjk, latin, str) => (isLatin(str) ? (latin || base) : (cjk || base));

function titleSpec(theme, str) { const T = theme.text; return pick(T.title, T.titleCjk, T.titleLatin, str); }
function messageSpec(theme, str) { const T = theme.text; return pick(T.message, T.messageCjk, T.messageLatin, str); }
function infoSpec(theme, lang) { const T = theme.text; return lang === 'zh' ? (T.infoCjk || T.info) : (T.infoLatin || T.info); }

export function birthdayStarName(lang, culture, star) {
  if (lang !== 'zh') return star.en;
  return (culture === 'chinese' && star.cn) ? star.cn : star.zh;
}

export function formatLy(lang, ly) {
  return lang === 'zh' ? `${ly.toFixed(1)} 光年` : `${ly.toFixed(1)} light-years`;
}

function birthdayLine(lang, culture, birthday) {
  const L = STR[lang];
  const name = birthdayStarName(lang, culture, birthday.star);
  return (birthday.visible ? L.birthdayLineVisible : L.birthdayLineHidden)
    .replace('{name}', name).replace('{ly}', formatLy(lang, birthday.star.ly));
}

function moonLine(lang, moon) {
  const name = moonPhaseName(lang, moon.phaseDeg, moon.fraction);
  const pct = Math.round(moon.fraction * 100);
  return lang === 'zh' ? `月相：${name}（${pct}%）` : `Moon: ${name}, ${pct}% illuminated`;
}

// ---------- title + ornament ----------

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
  const [a, b, c, d] = seal.text; // traditional order: right column top→bottom, then left column
  const q = size / 4;
  ctx.fillText(a, x + 3 * q, y + q + 1);
  ctx.fillText(b, x + 3 * q, y + 3 * q - 1);
  ctx.fillText(c, x + q, y + q + 1);
  ctx.fillText(d, x + q, y + 3 * q - 1);
  ctx.restore();
}

function ornament(ctx, scene, mid, y) {
  const T = scene.theme.text;
  const color = paint(scene, T.rule || T.sub);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  switch (T.ornament) {
    case 'rule':
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mid - 32, y); ctx.lineTo(mid + 32, y); ctx.stroke();
      break;
    case 'diamond':
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(mid - 90, y); ctx.lineTo(mid - 10, y); ctx.moveTo(mid + 10, y); ctx.lineTo(mid + 90, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mid, y - 5); ctx.lineTo(mid + 5, y); ctx.lineTo(mid, y + 5); ctx.lineTo(mid - 5, y); ctx.closePath(); ctx.fill();
      break;
    case 'deco':
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(mid - 120, y); ctx.lineTo(mid - 22, y); ctx.moveTo(mid + 22, y); ctx.lineTo(mid + 120, y);
      ctx.moveTo(mid - 100, y - 4); ctx.lineTo(mid - 30, y - 4); ctx.moveTo(mid + 30, y - 4); ctx.lineTo(mid + 100, y - 4);
      ctx.moveTo(mid - 100, y + 4); ctx.lineTo(mid - 30, y + 4); ctx.moveTo(mid + 30, y + 4); ctx.lineTo(mid + 100, y + 4);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mid, y - 9); ctx.lineTo(mid + 9, y); ctx.lineTo(mid, y + 9); ctx.lineTo(mid - 9, y); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(mid - 16, y, 2.2, 0, TAU); ctx.arc(mid + 16, y, 2.2, 0, TAU); ctx.fill();
      break;
    case 'heart': {
      const X = { ...T.xstitch, ...T.heart };
      stitchPattern(ctx, ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], mid, y, X.cell * 0.8, X);
      break;
    }
    case 'riso': {
      // three shapes in the two inks
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = T.riso.over;
      ctx.beginPath(); ctx.arc(mid - 30, y, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = T.riso.under;
      ctx.fillRect(mid - 7, y - 7, 14, 14);
      ctx.fillStyle = T.riso.over;
      ctx.beginPath(); ctx.moveTo(mid + 23, y + 7); ctx.lineTo(mid + 30, y - 7); ctx.lineTo(mid + 37, y + 7); ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    }
    case 'pines':
      // three little firs
      for (const [dx, s] of [[-20, 0.72], [0, 1], [20, 0.72]]) {
        const x0 = mid + dx, yb = y + 8 * s, h = 18 * s, w = 11 * s;
        ctx.beginPath();
        for (let t = 0; t < 3; t++) {
          const tb = yb - t * h * 0.27, tw = w * (1 - t * 0.24);
          ctx.moveTo(x0 - tw / 2, tb); ctx.lineTo(x0, tb - h * 0.46); ctx.lineTo(x0 + tw / 2, tb); ctx.closePath();
        }
        ctx.fill();
        ctx.fillRect(x0 - 0.9 * s, yb, 1.8 * s, 3 * s);
      }
      break;
    case 'skyline': {
      // a tiny skyline
      const hs = [9, 15, 11, 22, 13, 18, 8];
      let x0 = mid - (hs.length * 10) / 2;
      hs.forEach(h => { ctx.fillRect(x0 + 1, y + 6 - h, 8, h); x0 += 10; });
      break;
    }
    case 'stars':
      for (const dx of [-26, 0, 26]) {
        const L = dx ? 5 : 8;
        ctx.beginPath();
        ctx.moveTo(mid + dx, y - L); ctx.quadraticCurveTo(mid + dx, y, mid + dx + L, y);
        ctx.quadraticCurveTo(mid + dx, y, mid + dx, y + L); ctx.quadraticCurveTo(mid + dx, y, mid + dx - L, y);
        ctx.quadraticCurveTo(mid + dx, y, mid + dx, y - L);
        ctx.fill();
      }
      break;
    default: break;
  }
}

function drawTitleBlock(ctx, scene, top, maxW) {
  const { theme, text } = scene;
  const T = theme.text;
  const mid = POSTER_W / 2;
  const title = text.title || '';
  ctx.fillStyle = paint(scene, T.titleColor || T.color);
  let width = 0;
  if (title && T.titleStyle === 'riso') {
    const spec = titleSpec(theme, title), [ox, oy] = T.riso.offset;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = T.riso.under;
    spacedText(ctx, title, mid + ox, top + oy, spec, { maxWidth: T.titleMax || maxW });
    ctx.fillStyle = T.riso.over;
    width = spacedText(ctx, title, mid, top, spec, { maxWidth: T.titleMax || maxW });
    ctx.restore();
  } else if (title && T.titleStyle === 'xstitch') width = crossStitchText(ctx, title, mid, top, titleSpec(theme, title), T.xstitch, { maxWidth: T.titleMax || maxW });
  else if (title) width = glowText(ctx, title, mid, top, titleSpec(theme, title), T.glow, { maxWidth: T.titleMax || maxW });
  if (T.ornament === 'seal' && theme.seal) {
    drawSeal(ctx, Math.min(mid + width / 2 + 22, POSTER_W - 90), top - 44, 50, theme.seal);
  } else {
    ornament(ctx, scene, mid, top + (T.ornamentGap ?? 30));
  }
  return width;
}

// ---------- single-sky layouts ----------

export function drawTextSingle(ctx, scene, chart, H) {
  const layout = scene.theme.text.layout;
  if (layout === 'titleblock') return titleblock(ctx, scene, chart, H);
  if (layout === 'terminal') return terminal(ctx, scene, chart, H);
  if (layout === 'instant') return instant(ctx, scene, chart, H);
  if (layout === 'vertical' && scene.lang === 'zh') return vertical(ctx, scene, chart, H);
  return stacked(ctx, scene, chart);
}

function stacked(ctx, scene, chart) {
  const { theme, lang, text, local, place, sky, opts, birthday } = scene;
  const T = theme.text;
  const layout = T.layout === 'vertical' ? 'ink' : T.layout;
  const mid = POSTER_W / 2;
  const maxW = 820;
  ctx.textBaseline = 'alphabetic';
  const message = text.message || '';
  const dateLine = formatDateLine(lang, local, layout === 'ink' ? 'ink' : theme.id);
  const coords = formatCoords(lang, place.lat, place.lon);
  const top = chart.cy + chart.R + (T.top ?? 122);
  const info = infoSpec(theme, lang);

  drawTitleBlock(ctx, scene, top, maxW);
  if (message) {
    ctx.fillStyle = paint(scene, T.color);
    spacedText(ctx, message, mid, top + (T.messageGap ?? 78), messageSpec(theme, message), { maxWidth: maxW });
  }
  ctx.fillStyle = paint(scene, T.sub);
  let y = top + (message ? (T.infoGap ?? 128) : (T.infoGapNoMessage ?? 102));
  const lines = [];
  if (layout === 'atlas') lines.push(`${place.label}  ·  ${dateLine}`, coords, moonLine(lang, sky.moon));
  else if (layout === 'ink') {
    const lunar = lunarDate(local);
    lines.push(dateLine);
    if (lang === 'zh') lines.push(`${lunar ? `农历${lunar}  ·  ` : ''}${place.label}`, coords);
    else lines.push(`${place.label}  ·  ${coords}`);
  } else lines.push(place.label, dateLine, coords);
  const step = T.lineStep ?? 30;
  lines.forEach((ln, i) => {
    const isMoon = layout === 'atlas' && i === 2;
    spacedText(ctx, ln, mid, y, isMoon ? { ...info, italic: lang !== 'zh', size: info.size - 1 } : info, { maxWidth: maxW });
    y += step;
  });
  if (birthday) {
    ctx.fillStyle = paint(scene, theme.accent);
    const spec = { ...info, upper: false, italic: lang !== 'zh' && !!T.birthdayItalic, spacing: Math.min(info.spacing || 0, 0.06) };
    spacedText(ctx, birthdayLine(lang, opts.culture, birthday), mid, y + 12, spec, { maxWidth: maxW });
  }
}

// Instant photo: everything handwritten on the card's bottom strip, with the coordinates
// in small print as if stamped by the lab.
function instant(ctx, scene, chart, H) {
  const { theme, lang, text, local, place, opts, birthday } = scene;
  const T = theme.text;
  const { photo, strip } = instantGeometry(scene, chart);
  const y0 = photo.y + photo.s;
  const mid = POSTER_W / 2;
  const maxW = photo.s - 60;
  const hand = (str, y, spec, color, tilt) => {
    ctx.save();
    ctx.translate(mid, y); ctx.rotate(tilt);
    ctx.fillStyle = paint(scene, color);
    spacedText(ctx, str, 0, 0, spec, { maxWidth: maxW });
    ctx.restore();
  };
  ctx.textBaseline = 'alphabetic';
  const info = infoSpec(theme, lang);
  if (text.title) hand(text.title, y0 + strip * 0.31, titleSpec(theme, text.title), T.color, -0.022);
  if (text.message) hand(text.message, y0 + strip * 0.47, messageSpec(theme, text.message), T.color, 0.01);
  hand(`${formatDateLine(lang, local, theme.id)} · ${place.label}`, y0 + strip * (text.message ? 0.62 : 0.52), info, T.sub, -0.008);
  if (birthday) hand(birthdayLine(lang, opts.culture, birthday), y0 + strip * 0.74, { ...info, size: info.size * 0.85 }, theme.accent, 0.006);
  ctx.fillStyle = paint(scene, T.print.color);
  spacedText(ctx, formatCoords(lang, place.lat, place.lon), mid, y0 + strip - 26, T.print, { maxWidth: maxW });
}

// Blueprint: an engineering title block.
function titleblock(ctx, scene, chart, H) {
  const { theme, lang, text, local, place, sky, opts, birthday, utc, tz } = scene;
  const T = theme.text;
  const L = STR[lang].titleblock;
  const color = paint(scene, T.color), sub = paint(scene, T.sub);
  const x0 = 90, x1 = POSTER_W - 90;
  const y0 = chart.cy + chart.R + 74, y1 = Math.min(H - 66, y0 + 380);
  const rowH = (y1 - y0 - 120) / 3;
  ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  const rows = [y0 + 120, y0 + 120 + rowH, y0 + 120 + 2 * rowH];
  rows.forEach(y => { ctx.moveTo(x0, y); ctx.lineTo(x1, y); });
  const w = (x1 - x0) / 3;
  for (const y of [rows[0]]) for (const i of [1, 2]) { ctx.moveTo(x0 + i * w, y); ctx.lineTo(x0 + i * w, y + 2 * rowH); }
  ctx.moveTo(x0 + 2 * w, rows[2]); ctx.lineTo(x0 + 2 * w, y1);
  ctx.stroke();

  const label = (s, x, y) => {
    ctx.fillStyle = sub;
    spacedText(ctx, s, x + 9, y + 14, { ...T.label, upper: true }, { align: 'left' });
  };
  const value = (s, x, y, h, spec = T.value, wmax = w - 18) => {
    ctx.fillStyle = color;
    spacedText(ctx, s, x + 9, y + h - 16, spec, { align: 'left', maxWidth: wmax });
  };
  ctx.textBaseline = 'alphabetic';
  label(L.title, x0, y0);
  const title = text.title || '';
  ctx.fillStyle = color;
  if (title) spacedText(ctx, title, POSTER_W / 2, y0 + 78, titleSpec(theme, title), { maxWidth: x1 - x0 - 40 });

  const pad = n => String(n).padStart(2, '0');
  const offset = formatUtcOffset(tzOffsetMinutes(utc, tz));
  const latStr = `${Math.abs(place.lat).toFixed(4)}° ${place.lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(place.lon).toFixed(4)}° ${place.lon >= 0 ? 'E' : 'W'}`;
  const cells = [
    [L.date, `${local.y}-${pad(local.m)}-${pad(local.d)}`], [L.time, `${pad(local.hh)}:${pad(local.mm)}  ${offset}`], [L.place, place.label],
    [L.lat, latStr], [L.lon, lonStr], [L.tz, tz],
  ];
  cells.forEach(([lb, v], i) => {
    const cx = x0 + (i % 3) * w, cy = rows[0] + Math.floor(i / 3) * rowH;
    label(lb, cx, cy); value(v, cx, cy, rowH);
  });
  // notes and drawing info
  label(L.notes, x0, rows[2]);
  const notes = text.message || moonLine(lang, sky.moon);
  value(notes, x0, rows[2], rowH * (birthday ? 0.62 : 1), T.value, 2 * w - 18);
  if (birthday) {
    ctx.fillStyle = paint(scene, theme.accent);
    spacedText(ctx, birthdayLine(lang, opts.culture, birthday), x0 + 9, rows[2] + rowH - 12, { ...T.value, size: T.value.size - 2 }, { align: 'left', maxWidth: 2 * w - 18 });
  }
  label(L.drawn, x0 + 2 * w, rows[2]);
  value(L.drawnBy, x0 + 2 * w, rows[2], rowH, { ...T.value, size: T.value.size - 2 });
}

// Terminal: the poster's details as a shell session.
function terminal(ctx, scene, chart, H) {
  const { theme, lang, text, local, place, sky, opts, birthday, tz, stats } = scene;
  const T = theme.text;
  const L = STR[lang].terminal;
  const pad = n => String(n).padStart(2, '0');
  const x = 96;
  let y = chart.cy + chart.R + 62;
  const spec = T.info;
  const glow = T.glow;
  // Each line moves down by its own ascent first, so a big title never touches the line above.
  const line = (s, sp = spec, color = T.color, before = 4) => {
    y += before + sp.size * (isLatin(s) ? 0.82 : 0.92);
    ctx.fillStyle = paint(scene, color);
    glowText(ctx, s, x, y, sp, glow, { align: 'left', maxWidth: POSTER_W - 2 * x });
    y += sp.size * 0.24;
  };
  ctx.textBaseline = 'alphabetic';
  const quoted = place.label.replace(/"/g, "'");
  line(`$ sky --date ${local.y}-${pad(local.m)}-${pad(local.d)} --time ${pad(local.hh)}:${pad(local.mm)} --at "${quoted}"`, spec, T.sub, 0);
  if (text.title) line(text.title, titleSpec(theme, text.title), T.color, 14);
  if (text.message) line(text.message, messageSpec(theme, text.message), T.color, 12);
  y += 8;
  const planets = sky.planets.filter(p => p.alt > 0).map(p => STR[lang].bodies[p.name]);
  const phase = `${moonPhaseName(lang, sky.moon.phaseDeg, sky.moon.fraction)} ${Math.round(sky.moon.fraction * 100)}%`;
  line(`> ${L.coords} ${Math.abs(place.lat).toFixed(4)}${place.lat >= 0 ? 'N' : 'S'}  ${Math.abs(place.lon).toFixed(4)}${place.lon >= 0 ? 'E' : 'W'}  ${tz}`, spec, T.sub);
  line(`> ${L.moon} ${phase}   ${L.planets} ${planets.length ? planets.join(', ') : L.none}`, spec, T.sub);
  line(`> ${L.stars.replace('{n}', (stats?.stars ?? 0).toLocaleString('en-US'))}`, spec, T.sub);
  if (birthday) line(`> ${birthdayLine(lang, opts.culture, birthday)}`, spec, theme.accent);
  y += 10 + spec.size * 0.82;
  ctx.fillStyle = paint(scene, T.color);
  glowText(ctx, '$', x, y, spec, glow, { align: 'left' });
  ctx.fillRect(x + spec.size * 0.75, y - spec.size * 0.72, spec.size * 0.5, spec.size * 0.8);
}

// Vertical Chinese columns, read right to left (traditional scroll layout).
function vertical(ctx, scene, chart, H) {
  const { theme, text, local, place, opts, birthday } = scene;
  const T = theme.text;
  const top = chart.cy + chart.R + 78;
  const bottom = H - 86;
  const height = bottom - top;
  const columns = [];
  const add = (str, spec, color, gapAfter = 14) => {
    const step = spec.size * (spec.lead ?? 1.12);
    const per = Math.max(1, Math.floor(height / step));
    const chars = Array.from(str);
    for (let i = 0; i < chars.length; i += per) columns.push({ chars: chars.slice(i, i + per), spec, color, step, gap: i + per >= chars.length ? gapAfter : 6 });
  };
  const title = text.title || '';
  if (title) add(title, T.verticalTitle, T.color, 22);
  if (text.message) add(text.message.replace(/[，。,.]/g, ' ').replace(/\s+/g, ' ').trim(), T.verticalMessage, T.color, 18);
  add(`${cnNumeralDate(local)}${shichen(local.hh)}`, T.verticalInfo, T.sub);
  const lunar = lunarDate(local);
  if (lunar) add(`农历${lunar}`, T.verticalInfo, T.sub);
  add(place.label, T.verticalInfo, T.sub);
  add(cnCoord(place.lat, '北纬', '南纬'), T.verticalInfo, T.sub, 6);
  add(cnCoord(place.lon, '东经', '西经'), T.verticalInfo, T.sub);
  if (birthday) {
    const name = birthdayStarName('zh', opts.culture, birthday.star);
    add(`那晚你看到的${name}光是在你出生那年出发的`, T.verticalInfo, theme.accent);
  }
  const widths = columns.map(c => c.spec.size * 1.05);
  const total = widths.reduce((a, b) => a + b, 0) + columns.reduce((a, c, i) => a + (i < columns.length - 1 ? c.gap : 0), 0);
  let x = POSTER_W / 2 + total / 2;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  columns.forEach((col, i) => {
    const w = widths[i];
    const cx = x - w / 2;
    ctx.fillStyle = paint(scene, col.color);
    ctx.font = font(col.spec);
    let y = top + col.step / 2;
    for (const ch of col.chars) {
      if (ch === ' ') { y += col.step * 0.5; continue; }
      if (isLatin(ch) && /[A-Za-z0-9]/.test(ch)) {
        // Latin letters and digits lie sideways in vertical text.
        ctx.save(); ctx.translate(cx, y); ctx.rotate(Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore();
        y += col.spec.size * 0.62;
      } else {
        ctx.fillText(ch, cx, y);
        y += col.step;
      }
    }
    x -= w + col.gap;
  });
  if (theme.seal) drawSeal(ctx, x - 40, bottom - 46, 46, theme.seal);
}

// ---------- two-sky layout ----------

export function drawTextDouble(ctx, scene, charts, captions) {
  const { theme, lang, text, skies } = scene;
  const T = theme.text;
  const [A, B] = charts;
  const info = infoSpec(theme, lang);
  const capBase = titleSpec(theme, text.title || '');
  ctx.textBaseline = 'alphabetic';
  const color = paint(scene, T.color), sub = paint(scene, T.sub);

  if (captions === 'below') {
    skies.forEach((sk, i) => {
      const chart = charts[i];
      const capSpec = { ...capBase, size: Math.min(capBase.size * 0.5, 32), upper: false };
      let y = chart.cy + chart.R + 68;
      if (sk.caption) {
        ctx.fillStyle = color;
        spacedText(ctx, sk.caption, POSTER_W / 2, y, capSpec, { maxWidth: 820 });
        y += 34;
      }
      ctx.fillStyle = sub;
      spacedText(ctx, `${sk.place.label}  ·  ${formatDateLine(lang, sk.local, theme.id)}`, POSTER_W / 2, y, { ...info, size: info.size - 1 }, { maxWidth: 820 });
    });
    const top = B.cy + B.R + 205;
    drawTitleBlock(ctx, scene, top, 820);
    if (text.message) {
      ctx.fillStyle = color;
      spacedText(ctx, text.message, POSTER_W / 2, top + (T.messageGap ?? 72) - 6, messageSpec(theme, text.message), { maxWidth: 820 });
    }
    return;
  }

  skies.forEach((sk, i) => {
    const chart = i === 0 ? A : B;
    const leftSide = i === 1; // the second sky sits on the right, so its caption goes on the left
    const x = leftSide ? chart.cx - chart.R - 60 : chart.cx + chart.R + 60;
    const align = leftSide ? 'right' : 'left';
    const maxW = leftSide ? x - 40 : POSTER_W - 40 - x;
    const capSpec = { ...capBase, size: Math.min(capBase.size * 0.58, 36), upper: false };
    const lines = [formatDateLine(lang, sk.local, T.layout === 'ink' || T.layout === 'vertical' ? 'ink' : theme.id)];
    if ((T.layout === 'ink' || T.layout === 'vertical') && lang === 'zh') {
      const lunar = lunarDate(sk.local);
      if (lunar) lines.push(`农历${lunar}`);
    }
    lines.push(sk.place.label, formatCoords(lang, sk.place.lat, sk.place.lon));
    const blockH = 44 + lines.length * 27;
    let y = chart.cy - blockH / 2 + 24;
    if (sk.caption) {
      ctx.fillStyle = color;
      spacedText(ctx, sk.caption, x, y, capSpec, { align, maxWidth: maxW });
      y += 42;
    }
    ctx.fillStyle = sub;
    for (const ln of lines) {
      spacedText(ctx, ln, x, y, { ...info, size: info.size - 1 }, { align, maxWidth: maxW });
      y += 27;
    }
  });

  const top = B.cy + B.R + (T.doubleTop ?? 118);
  drawTitleBlock(ctx, scene, top, 820);
  if (text.message) {
    ctx.fillStyle = color;
    spacedText(ctx, text.message, POSTER_W / 2, top + (T.messageGap ?? 72) - 6, messageSpec(theme, text.message), { maxWidth: 820 });
  }
}

// ---------- overlays (drawn last, over everything) ----------

export function drawOverlay(ctx, scene, H, charts) {
  const O = scene.theme.overlay;
  if (O?.kind === 'postmark') postmark(ctx, scene, H, O, charts);
  if (O?.kind === 'grain' && !ctx.isVector) {
    // paper showing through the ink in tiny specks, as in a stencil print
    const r = rng(hashString(scene.theme.id) + 99);
    ctx.fillStyle = O.color;
    for (let i = 0; i < O.count * H / 1414; i++) {
      const s = 0.4 + r() * 0.9;
      ctx.fillRect(r() * POSTER_W, r() * H, s, s);
    }
  }
}

// Text along a circle, centred on angle `mid`: on the top arc it reads clockwise,
// on the bottom arc (outward = false) it reads left to right with the letters upright.
function arcText(ctx, str, cx, cy, r, mid, spec, outward = true, maxAngle = 2.6) {
  let sp = spec;
  const text = sp.upper ? str.toUpperCase() : str;
  const chars = Array.from(text);
  const lay = () => {
    ctx.font = font(sp);
    const gap = spacingFor(sp, str) * sp.size;
    const widths = chars.map(ch => ctx.measureText(ch).width);
    return { gap, widths, total: widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1) };
  };
  let L = lay();
  if (L.total / r > maxAngle) { sp = { ...sp, size: sp.size * (maxAngle * r) / L.total }; L = lay(); }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let s = -L.total / 2;
  chars.forEach((ch, i) => {
    const off = (s + L.widths[i] / 2) / r;
    const a = outward ? mid + off : mid - off;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(outward ? a + Math.PI / 2 : a - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    s += L.widths[i] + L.gap;
  });
}

// A circular date stamp, slightly tilted and unevenly inked, over the stamp's corner.
// It goes where the text is not: bottom right under one sky, top right (poster) or
// between the skies (phone) with two.
function postmark(ctx, scene, H, O, charts) {
  const sk = scene.skies[0];
  const { local, place } = sk;
  const zh = scene.lang === 'zh';
  const pad = n => String(n).padStart(2, '0');
  const r = rng(hashString(`${local.y}${local.m}${local.d}${place.label}`));
  const R = 74, cx = POSTER_W - 162;
  let cy = H - 150;
  if (charts.length > 1) {
    const [A, B] = charts;
    cy = scene.format === 'phone' ? (A.cy + A.R + B.cy - B.R) / 2 + 20 : 158;
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.2 + r() * 0.1);
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = O.ink; ctx.fillStyle = O.ink;
  // rings drawn in short arcs of varying strength, like a hand stamp
  const ring = (rad, width) => {
    const n = 36;
    ctx.lineWidth = width; ctx.lineCap = 'butt';
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = 0.6 + r() * 0.4;
      ctx.beginPath(); ctx.arc(0, 0, rad, (i / n) * TAU, ((i + 1) / n) * TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  ring(R, 2.4);
  ring(R - 25, 1.2);
  const serif = '"Cormorant Garamond", "Noto Serif SC", serif';
  const top = zh ? place.label : place.label.toUpperCase();
  arcText(ctx, top, 0, 0, R - 12.5, -Math.PI / 2, { font: zh ? '"Noto Serif SC", serif' : serif, weight: 600, size: zh ? 13 : 13.5, spacing: zh ? 0.3 : 0.12 }, true, 2.5);
  arcText(ctx, zh ? '那晚星空' : 'THE SKY THAT NIGHT', 0, 0, R - 12.5, Math.PI / 2,
    { font: zh ? '"Noto Serif SC", serif' : serif, weight: 600, size: zh ? 11 : 9.5, spacing: zh ? 0.4 : 0.14 }, false, 2.2);
  ctx.font = `400 10px ${serif}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★', -(R - 12.5), 0); ctx.fillText('★', R - 12.5, 0);
  // the date between two bars; Chinese postmarks read year.month.day.hour
  const inner = R - 25;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const y of [-12, 12]) { const w = Math.sqrt(inner * inner - y * y); ctx.moveTo(-w + 2, y); ctx.lineTo(w - 2, y); }
  ctx.stroke();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const date = zh ? `${local.y}.${pad(local.m)}.${pad(local.d)}.${pad(local.hh)}` : `${local.d} ${months[local.m - 1]} ${local.y}`;
  spacedText(ctx, date, 0, 0.5, { font: '"Space Mono", "Jost", monospace', weight: 700, size: zh ? 9.6 : 10.5, spacing: 0.02 }, { maxWidth: inner * 2 - 10 });
  spacedText(ctx, `${pad(local.hh)}:${pad(local.mm)}`, 0, -22, { font: '"Space Mono", "Jost", monospace', weight: 400, size: 9, spacing: 0.04 });
  spacedText(ctx, zh ? '寄' : 'POST', 0, 22, { font: zh ? '"Noto Serif SC", serif' : serif, weight: 600, size: zh ? 10 : 9, spacing: 0.2 });
  // wavy cancel lines running off the stamp
  ctx.lineWidth = 1.6;
  for (let j = -2; j <= 2; j++) {
    ctx.globalAlpha = 0.6 + r() * 0.35;
    ctx.beginPath();
    for (let x = R + 6; x <= R + 170; x += 3) {
      const y = j * 9 + Math.sin(x / 9) * 3.2;
      if (x === R + 6) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCredit(ctx, scene, H) {
  const { theme, lang, opts } = scene;
  ctx.fillStyle = paint(scene, theme.credit);
  ctx.textBaseline = 'alphabetic';
  const spec = theme.creditFont || { font: '"Jost", "Noto Sans SC", sans-serif', weight: 400, size: 11, spacing: 0.12, cjkSpacing: 0.12 };
  let credit = STR[lang].credit;
  // The Chinese asterism data comes from Stellarium's sky culture (CC BY-SA), which asks for attribution.
  if (opts.culture === 'chinese' && (opts.lines || opts.names)) credit += STR[lang].creditChinese;
  spacedText(ctx, credit, POSTER_W / 2, H - (theme.creditY ?? 38), spec, { maxWidth: 900 });
}
