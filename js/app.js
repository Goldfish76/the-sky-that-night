import { loadData, computeSky, zonedToUtc, tzOffsetMinutes, formatUtcOffset } from './astro.js';
import { renderPoster, POSTER_W, POSTER_H } from './render.js';
import { THEMES, THEME_ORDER } from './themes.js';
import { STR } from './i18n.js';
import { CITIES, cityLabel, findCity } from './cities.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const SIZES = { a4: [2480, 3508], a3: [3508, 4961], web: [1240, 1754] };

const pad = n => String(n).padStart(2, '0');
const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const state = {
  lang: (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en',
  date: '',
  time: '21:00',
  city: null,
  custom: false,
  lat: 0,
  lon: 0,
  tz: browserTz,
  placeLabel: '',
  placeLabelEdited: false,
  theme: 'noir',
  opts: { ...THEMES.noir.defaults, credit: true },
  title: '',
  titleEdited: false,
  message: '',
  size: 'a4',
};

let data = null;

function t(key) {
  return STR[state.lang][key];
}

function applyI18n() {
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-theme-name]').forEach(el => { el.textContent = STR[state.lang].themes[el.dataset.themeName]; });
  $$('[data-size]').forEach(el => { el.textContent = STR[state.lang].sizes[el.dataset.size]; });
  $$('.lang button').forEach(b => b.classList.toggle('active', b.dataset.lang === state.lang));
  const dl = $('#city-list');
  dl.innerHTML = CITIES.map(c => `<option value="${cityLabel(c, state.lang)}"></option>`).join('');
  if (state.city) $('#city').value = cityLabel(state.city, state.lang);
  if (!state.titleEdited) { state.title = t('defaultTitle'); $('#title').value = state.title; }
  if (!state.placeLabelEdited) syncPlaceLabel();
  updateTzNote();
}

function syncPlaceLabel() {
  if (state.custom) state.placeLabel = state.placeLabel || t('myLocation');
  else if (state.city) state.placeLabel = state.lang === 'zh' ? state.city[1] : state.city[0];
  $('#place-label').value = state.placeLabel;
}

function setCity(c) {
  state.city = c;
  state.custom = false;
  state.lat = c[2]; state.lon = c[3]; state.tz = c[4];
  $('#custom').checked = false;
  $('#custom-fields').hidden = true;
  if (!state.placeLabelEdited) syncPlaceLabel();
  syncCoordInputs();
}

function syncCoordInputs() {
  $('#lat').value = state.lat;
  $('#lon').value = state.lon;
  $('#tz').value = state.tz;
}

function localParts() {
  const [y, m, d] = state.date.split('-').map(Number);
  const [hh, mm] = state.time.split(':').map(Number);
  return { y, m, d, hh: hh || 0, mm: mm || 0 };
}

function updateTzNote() {
  if (!state.date) return;
  try {
    const utc = zonedToUtc(localParts(), state.tz);
    $('#tz-note').textContent = `${state.tz} · ${formatUtcOffset(tzOffsetMinutes(utc, state.tz))}`;
  } catch {
    $('#tz-note').textContent = state.tz;
  }
}

function buildScene() {
  const local = localParts();
  const utc = zonedToUtc(local, state.tz);
  const sky = computeSky(utc, state.lat, state.lon);
  return {
    data, sky, lang: state.lang, local,
    theme: THEMES[state.theme],
    opts: state.opts,
    text: { title: state.title, message: state.message },
    place: { label: state.placeLabel, lat: state.lat, lon: state.lon },
  };
}

// Load the web-font slices needed for the strings we are about to draw.
async function ensureFonts(scene) {
  if (!document.fonts || !document.fonts.load) return false;
  const sample = [scene.text.title, scene.text.message, scene.place.label, STR[scene.lang].credit,
    '北东南西 NESW 0123456789 农历年月日时宿星那晚空', ...Object.values(STR[scene.lang].bodies)].join(' ');
  const families = ['"Jost"', '"Noto Sans SC"', '"Noto Serif SC"', '"Cormorant Garamond"', '"Ma Shan Zheng"'];
  const before = families.map(f => document.fonts.check(`16px ${f}`, sample));
  try {
    await Promise.race([
      Promise.all(families.flatMap(f => [
        document.fonts.load(`400 16px ${f}`, sample),
        document.fonts.load(`italic 500 16px ${f}`, sample),
      ])),
      new Promise(res => setTimeout(res, 4000)),
    ]);
  } catch { /* offline: fall back to system fonts */ }
  const after = families.map(f => document.fonts.check(`16px ${f}`, sample));
  return after.some((v, i) => v && !before[i]);
}

let pending = false;
function scheduleRender() {
  if (pending) return;
  pending = true;
  // requestAnimationFrame pauses in hidden tabs; the timeout keeps rendering going there too.
  const run = () => { if (pending) { pending = false; renderPreview(); } };
  requestAnimationFrame(run);
  setTimeout(run, 80);
}

async function renderPreview() {
  if (!data || !state.date) return;
  const canvas = $('#poster');
  const wrap = $('.poster-wrap');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = wrap.clientWidth;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssW * dpr * POSTER_H / POSTER_W);
  try {
    const scene = buildScene();
    renderPoster(canvas, scene);
    window.__tstn = { scene, state };
    if (await ensureFonts(scene)) renderPoster(canvas, buildScene());
    $('#status').textContent = '';
  } catch (err) {
    console.error(err);
    $('#status').textContent = String(err.message || err);
  }
}

function applyThemeDefaults(id) {
  state.theme = id;
  state.opts = { ...THEMES[id].defaults, credit: state.opts.credit };
  $$('.theme-card').forEach(el => el.classList.toggle('active', el.dataset.theme === id));
  syncOptionInputs();
}

function syncOptionInputs() {
  $$('[data-opt]').forEach(el => { el.checked = !!state.opts[el.dataset.opt]; });
  $$('input[name="culture"]').forEach(el => { el.checked = el.value === state.opts.culture; });
}

async function exportPng() {
  const btn = $('#export');
  const [w, h] = SIZES[state.size];
  btn.disabled = true;
  $('#status').textContent = t('exporting');
  await new Promise(r => setTimeout(r, 30));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const scene = buildScene();
    await ensureFonts(scene);
    renderPoster(canvas, scene);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `the-sky-that-night-${state.date}-${state.theme}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    $('#status').textContent = t('exported');
  } catch (err) {
    console.error(err);
    $('#status').textContent = String(err.message || err);
  } finally {
    btn.disabled = false;
  }
}

function initControls() {
  const now = new Date();
  state.date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  $('#date').value = state.date;
  $('#time').value = state.time;

  const tzs = (Intl.supportedValuesOf && Intl.supportedValuesOf('timeZone')) || [browserTz, 'UTC'];
  $('#tz').innerHTML = tzs.map(z => `<option value="${z}">${z}</option>`).join('');

  const startCity = CITIES.find(c => c[4] === browserTz)
    || (state.lang === 'zh' ? CITIES[1] : CITIES.find(c => c[0] === 'New York'));
  setCity(startCity);
  $('#city').value = cityLabel(startCity, state.lang);

  $$('.lang button').forEach(b => b.addEventListener('click', () => {
    state.lang = b.dataset.lang;
    applyI18n();
    scheduleRender();
  }));

  $('#date').addEventListener('input', e => { state.date = e.target.value; updateTzNote(); scheduleRender(); });
  $('#time').addEventListener('input', e => { state.time = e.target.value || '00:00'; updateTzNote(); scheduleRender(); });

  $('#city').addEventListener('change', e => {
    const c = findCity(e.target.value);
    if (c) { setCity(c); e.target.value = cityLabel(c, state.lang); updateTzNote(); scheduleRender(); }
  });

  $('#custom').addEventListener('change', e => {
    state.custom = e.target.checked;
    $('#custom-fields').hidden = !state.custom;
    if (state.custom && !state.placeLabelEdited) { state.placeLabel = t('myLocation'); $('#place-label').value = state.placeLabel; }
    if (!state.custom && state.city) setCity(state.city);
    updateTzNote(); scheduleRender();
  });
  const readCoords = () => {
    const la = parseFloat($('#lat').value), lo = parseFloat($('#lon').value);
    if (Number.isFinite(la) && Math.abs(la) <= 90) state.lat = la;
    if (Number.isFinite(lo) && Math.abs(lo) <= 180) state.lon = lo;
    state.tz = $('#tz').value || state.tz;
    updateTzNote(); scheduleRender();
  };
  ['#lat', '#lon', '#tz'].forEach(s => $(s).addEventListener('change', readCoords));

  $('#locate').addEventListener('click', () => {
    if (!navigator.geolocation) { $('#status').textContent = t('locateFailed'); return; }
    $('#status').textContent = t('locating');
    navigator.geolocation.getCurrentPosition(pos => {
      state.custom = true;
      $('#custom').checked = true;
      $('#custom-fields').hidden = false;
      state.lat = +pos.coords.latitude.toFixed(4);
      state.lon = +pos.coords.longitude.toFixed(4);
      state.tz = browserTz;
      if (!state.placeLabelEdited) state.placeLabel = t('myLocation');
      $('#place-label').value = state.placeLabel;
      syncCoordInputs(); updateTzNote();
      $('#status').textContent = '';
      scheduleRender();
    }, () => { $('#status').textContent = t('locateFailed'); }, { timeout: 10000 });
  });

  $('#place-label').addEventListener('input', e => {
    state.placeLabel = e.target.value; state.placeLabelEdited = true; scheduleRender();
  });
  $('#title').addEventListener('input', e => { state.title = e.target.value; state.titleEdited = true; scheduleRender(); });
  $('#message').addEventListener('input', e => { state.message = e.target.value; scheduleRender(); });

  $$('.theme-card').forEach(el => el.addEventListener('click', () => { applyThemeDefaults(el.dataset.theme); scheduleRender(); }));
  $$('input[name="culture"]').forEach(el => el.addEventListener('change', () => { state.opts.culture = el.value; scheduleRender(); }));
  $$('[data-opt]').forEach(el => el.addEventListener('change', () => { state.opts[el.dataset.opt] = el.checked; scheduleRender(); }));

  $('#size').addEventListener('change', e => { state.size = e.target.value; });
  $('#export').addEventListener('click', exportPng);

  window.addEventListener('resize', scheduleRender);
}

async function main() {
  initControls();
  applyThemeDefaults(THEME_ORDER[0]);
  applyI18n();
  $('#status').textContent = t('loading');
  try {
    data = await loadData();
    $('#status').textContent = '';
    scheduleRender();
  } catch (err) {
    console.error(err);
    $('#status').textContent = String(err.message || err);
  }
}

main();
