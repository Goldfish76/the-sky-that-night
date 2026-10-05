// Silhouettes around the horizon, as in an all-sky photo taken from a forest clearing or a
// city street: a ring of trees or buildings seen from below, their tops pointing at the zenith.
// The ring is seeded by the place, so the same place always gets the same treeline or skyline.
import { TAU, BASE_R, rng, wobble } from './draw.js';

const BINS = 720;

export function makeHorizon(scene, chart, seed) {
  const Hz = scene.theme.horizon;
  if (!Hz) return null;
  return Hz.kind === 'city' ? city(chart, seed, Hz) : forest(chart, seed, Hz);
}

// Shared bookkeeping: shapes are polygons in poster units; `reach` records how far the
// silhouette reaches in from the horizon circle at each angle, for label placement.
function model(chart) {
  const { cx, cy, R } = chart;
  const reach = new Float32Array(BINS);
  const binOf = a => ((Math.round((a / TAU) * BINS) % BINS) + BINS) % BINS;
  const note = (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    if (d > R) return;
    const b = binOf(Math.atan2(y - cy, x - cx));
    if (R - d > reach[b]) reach[b] = R - d;
  };
  // Densify edges so wide, flat tops register in every bin they cover.
  const notePoly = pts => {
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.5));
      for (let j = 0; j < n; j++) note(x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n);
    }
  };
  const polar = (a, rad, v = 0) => [cx + Math.cos(a) * rad - Math.sin(a) * v, cy + Math.sin(a) * rad + Math.cos(a) * v];
  return {
    reach, binOf, notePoly, polar,
    // Is the point (with an optional margin) hidden behind the silhouette?
    occludes(x, y, margin = 0) {
      const d = Math.hypot(x - cx, y - cy);
      return d + margin > R - reach[binOf(Math.atan2(y - cy, x - cx))];
    },
  };
}

// All polygons are wound the same way, so one nonzero fill draws their union.
function fillPolys(ctx, polys, color) {
  ctx.beginPath();
  for (const poly of polys) {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
      area += x0 * y1 - x1 * y0;
    }
    const pts = area < 0 ? poly.slice().reverse() : poly;
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  ctx.fillStyle = color;
  ctx.fill();
}

// ---------- forest ----------

// A conifer as a polygon in tree coordinates: u runs from the base (0) to the tip (1),
// v is the sideways offset in poster units. Tiers of drooping branches, slightly ragged.
function pine(width, r) {
  const tiers = 6 + Math.floor(r() * 5);
  const trunk = Math.max(0.7, width * 0.05);
  const side = s => {
    const out = [[0, s * trunk], [0.08, s * trunk]];
    for (let t = 0; t < tiers; t++) {
      const f = t / tiers;
      const u0 = 0.08 + f * 0.86, u1 = u0 + 0.86 / tiers;
      const w = (width / 2) * (1 - f * 0.88) * (0.75 + r() * 0.5);
      out.push([u0 + 0.015, s * w * 0.32], [u0 - 0.012 - r() * 0.02, s * w], [u1, s * w * 0.22]);
    }
    out.push([1, s * 0.3]);
    return out;
  };
  return side(-1).concat(side(1).reverse());
}

// A broadleaf tree: a trunk and a crown of overlapping round clumps (several sub-polygons).
// `length` is the tree's full length in poster units, to keep the clumps round.
function broadleaf(length, width, r) {
  const parts = [];
  const trunk = Math.max(0.9, width * 0.05);
  parts.push([[0, -trunk], [0.5, -trunk * 0.7], [0.5, trunk * 0.7], [0, trunk]]);
  // many small, ragged clumps read as leaves; a few big round ones would read as rocks
  const clumps = 9 + Math.floor(r() * 6);
  for (let i = 0; i < clumps; i++) {
    const t0 = r() * TAU, d = Math.sqrt(r());
    const u = 0.66 + Math.cos(t0) * d * 0.22, v = Math.sin(t0) * d * width * 0.3;
    const rad = width * (0.1 + r() * 0.1);
    const pts = [];
    for (let j = 0; j < 18; j++) {
      const t = (j / 18) * TAU, rr = rad * (0.72 + r() * 0.5);
      pts.push([u + (Math.cos(t) * rr) / length, v + Math.sin(t) * rr]);
    }
    parts.push(pts);
  }
  return parts;
}

function forest(chart, seed, Hz) {
  const { R } = chart;
  const k = R / BASE_R;
  const r = rng(seed ^ 0x5eed);
  const M = model(chart);
  const tall = wobble(seed + 3, 3); // some stretches of the treeline are taller than others
  const layers = [[], []]; // back (further away, lighter), front
  const rb = R + 8 * k;

  // A tree standing at angle a, its base beyond the horizon and its tip `depth` inside it.
  const place = (a, depth, width, layer, kind) => {
    const length = rb - (R - depth);
    const toXY = ([u, v]) => M.polar(a, rb - u * length, v);
    const polys = kind === 'pine' ? [pine(width, r)] : broadleaf(length, width, r);
    for (const p of polys) {
      const pts = p.map(toXY);
      layers[layer].push(pts);
      M.notePoly(pts);
    }
  };

  const count = Math.round((Hz.trees ?? 120) * Math.max(0.5, k));
  for (const layer of [0, 1]) {
    const n = layer ? count : Math.round(count * 0.55);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (r() - 0.5) * (TAU / n) * 1.4;
      const h = 0.55 + 0.45 * (0.5 + 0.5 * tall(a));
      const size = Math.pow(r(), 1.5);
      const depth = (Hz.min + (Hz.max - Hz.min) * size) * h * k * (layer ? 1 : 1.12);
      const kind = r() < (Hz.broadleaf ?? 0.2) ? 'broadleaf' : 'pine';
      const width = depth * (kind === 'pine' ? 0.3 + r() * 0.16 : 0.62 + r() * 0.2);
      place(a, depth, width, layer, kind);
    }
  }
  // Undergrowth: a ring of low bushes so no sky shows between the trunks.
  const bushes = [];
  for (let i = 0; i < 160; i++) {
    const a = r() * TAU, rad = (6 + r() * 9) * k, d = R - (2 + r() * 7) * k;
    const pts = [];
    for (let j = 0; j < 10; j++) {
      const t = (j / 10) * TAU;
      const [x, y] = M.polar(a, d);
      pts.push([x + Math.cos(t) * rad * (0.8 + r() * 0.4), y + Math.sin(t) * rad * (0.8 + r() * 0.4)]);
    }
    bushes.push(pts);
    M.notePoly(pts);
  }
  const ring = [];
  for (let i = 0; i <= 240; i++) ring.push(M.polar((i / 240) * TAU, R - 5 * k));
  const outer = [];
  for (let i = 240; i >= 0; i--) outer.push(M.polar((i / 240) * TAU, R + 20 * k));
  M.notePoly(ring);

  return {
    ...M,
    draw(ctx) {
      fillPolys(ctx, layers[0], Hz.back);
      if (Hz.mist) {
        // a faint glow behind the front row, like haze over the treetops
        const g = ctx.createRadialGradient(chart.cx, chart.cy, R * 0.7, chart.cx, chart.cy, R);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, Hz.mist);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(chart.cx, chart.cy, R, 0, TAU); ctx.fill();
      }
      fillPolys(ctx, [...layers[1], ...bushes, ring.concat(outer)], Hz.front);
    },
  };
}

// ---------- city ----------

function city(chart, seed, Hz) {
  const { R } = chart;
  const k = R / BASE_R;
  const r = rng(seed ^ 0xc17);
  const M = model(chart);
  const zone = wobble(seed + 11, 3); // downtown here, low-rise there
  const rb = R + 8 * k;
  const facades = [], lit = { warm: [], cool: [] }, antennas = [], beacons = [];
  const shades = Hz.shades;

  // A block between two angles from the base up to radius `top` (smaller = taller).
  const block = (a0, a1, top) => {
    const pts = [M.polar(a0, rb), M.polar(a0, top)];
    const n = Math.max(2, Math.ceil(((a1 - a0) * top) / 4));
    for (let i = 1; i < n; i++) pts.push(M.polar(a0 + ((a1 - a0) * i) / n, top));
    pts.push(M.polar(a1, top), M.polar(a1, rb));
    return pts;
  };
  const cell = (a0, a1, r0, r1) => [M.polar(a0, r0), M.polar(a0, r1), M.polar(a1, r1), M.polar(a1, r0)];

  let a = r() * TAU;
  const end = a + TAU;
  while (a < end - 1e-3) {
    const w = (16 + r() * 44) * k;
    let da = w / R;
    if (a + da > end) da = end - a;
    const z = 0.5 + 0.5 * zone(a + da / 2);
    const tallness = Math.pow(r(), 2.2 - z * 1.2);
    const depth = (Hz.min + (Hz.max - Hz.min) * tallness) * k;
    const top = R - depth;
    const shade = shades[Math.floor(r() * shades.length)];
    const parts = [block(a, a + da, top)];
    let crown = top;
    if (tallness > 0.45 && r() < 0.45) {
      // setback: a narrower block on the roof
      const inset = da * (0.18 + r() * 0.12);
      crown = top - (8 + r() * 22) * k;
      parts.push(block(a + inset, a + da - inset, crown));
    }
    facades.push({ parts, shade });
    parts.forEach(M.notePoly);

    // windows in a polar grid; each building has its own share of lit rooms
    const cols = Math.max(1, Math.floor(w / (5.2 * k)));
    const rows = Math.floor((depth - 6 * k) / (6.4 * k));
    const p = 0.08 + r() * 0.3;
    const warm = r() < 0.75;
    const dA = da / cols;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (r() > p) continue;
        const r0 = R - 4 * k - j * 6.4 * k, r1 = r0 - 3.4 * k;
        if (r1 < top + 3 * k) continue;
        const a0 = a + i * dA + dA * 0.25, a1 = a + (i + 1) * dA - dA * 0.25;
        (warm ? lit.warm : lit.cool).push(cell(a0, a1, r0, r1));
      }
    }
    // an antenna with a red aircraft-warning light on some towers
    if (tallness > 0.55 && r() < 0.5) {
      const am = a + da / 2, len = (10 + r() * 22) * k;
      antennas.push([M.polar(am, crown + 1), M.polar(am, crown - len)]);
      beacons.push(M.polar(am, crown - len));
    }
    a += da;
  }

  return {
    ...M,
    draw(ctx) {
      for (const sh of shades) fillPolys(ctx, facades.filter(f => f.shade === sh).flatMap(f => f.parts), sh);
      fillPolys(ctx, lit.warm, Hz.warm);
      fillPolys(ctx, lit.cool, Hz.cool);
      ctx.strokeStyle = shades[0]; ctx.lineWidth = 1.7 * k; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [[x0, y0], [x1, y1]] of antennas) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
      ctx.stroke();
      for (const [x, y] of beacons) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 4.5 * k);
        g.addColorStop(0, Hz.beacon); g.addColorStop(1, 'rgba(255,40,30,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 4.5 * k, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff7a6e'; ctx.beginPath(); ctx.arc(x, y, 1.1 * k, 0, TAU); ctx.fill();
      }
    },
  };
}
