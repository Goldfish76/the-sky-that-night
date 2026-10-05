// Offline place search: the curated city list plus ~34,000 GeoNames cities (loaded on first use).
import { CITIES } from './cities.js';

const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const curated = CITIES.map(([name, zh, lat, lon, tz]) => ({ name, zh, lat, lon, tz, cc: '', pop: 0, curated: true }));

let world = null;
let loading = null;

export function loadWorld(base = 'data/') {
  if (world) return Promise.resolve(world);
  if (!loading) {
    loading = fetch(base + 'cities.json').then(r => r.json()).then(d => {
      world = d.c.map(([name, zh, lat, lon, tzi, cc, popK]) => ({ name, zh, lat, lon, tz: d.tz[tzi], cc, pop: popK * 1000, key: fold(name) }));
      return world;
    });
  }
  return loading;
}

export function placeName(p, lang) {
  return lang === 'zh' ? (p.zh || p.name) : p.name;
}

export function countryName(cc, lang) {
  if (!cc) return '';
  try {
    return new Intl.DisplayNames([lang === 'zh' ? 'zh-CN' : 'en'], { type: 'region' }).of(cc);
  } catch {
    return cc;
  }
}

function near(a, b) {
  return Math.abs(a.lat - b.lat) < 0.3 && Math.abs(a.lon - b.lon) < 0.3;
}

// Best matches first: curated cities, then exact name matches, then prefix matches, then by population.
export async function searchPlaces(query, limit = 8) {
  const q = query.trim();
  if (!q) return [];
  const fq = fold(q);
  const cjk = /[㐀-鿿]/.test(q);
  const matchRank = p => {
    const key = p.key || fold(p.name);
    if (key === fq || p.zh === q) return 0;
    if (key.startsWith(fq) || (cjk && p.zh && p.zh.startsWith(q))) return 1;
    if (fq.length >= 3 && key.includes(fq)) return 2;
    if (cjk && p.zh && p.zh.includes(q)) return 2;
    return -1;
  };
  const results = [];
  for (const p of curated) {
    const r = matchRank(p);
    if (r >= 0) results.push({ p, r, cur: 0 });
  }
  const all = await loadWorld();
  for (const p of all) {
    const r = matchRank(p);
    if (r < 0) continue;
    const dup = results.find(x => x.p.curated && near(x.p, p) && (fold(x.p.name) === p.key || x.p.zh === p.zh));
    if (dup) { if (!dup.p.cc) dup.p.cc = p.cc; continue; }
    results.push({ p, r, cur: 1 });
  }
  results.sort((a, b) => a.r - b.r || a.cur - b.cur || b.p.pop - a.p.pop);
  return results.slice(0, limit).map(x => x.p);
}
