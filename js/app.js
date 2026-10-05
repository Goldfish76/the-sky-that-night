import {
  loadData, computeSky, zonedToUtc, tzOffsetMinutes, formatUtcOffset, ageInYears, findBirthdayStar,
} from './astro.js';
import { renderPoster, POSTER_W, POSTER_H, birthdayStarName } from './render.js';
import { THEMES, THEME_ORDER } from './themes.js';
import { STR } from './i18n.js';
import { CITIES } from './cities.js';
import { searchPlaces, loadWorld, placeName, countryName } from './places.js';
import { canvasToPdf, PAGE_SIZES_PT } from './pdf.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const SIZES = { a4: [2480, 3508], a3: [3508, 4961], web: [1240, 1754] };
const pad = n => String(n).padStart(2, '0');
const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();

function curatedPlace(c) {
  return { name: c[0], zh: c[1], lat: c[2], lon: c[3], tz: c[4], cc: '' };
}

function newSky(place) {
  return { date: today, time: '21:00', place, lat: place.lat, lon: place.lon, tz: place.tz, custom: false,
    label: '', labelEdited: false, caption: '', captionEdited: false };
}

const state = {
  lang: (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en',
  layout: 'single',
  skies: [],
  theme: 'noir',
  opts: { ...THEMES.noir.defaults, credit: true },
  title: '',
  titleEdited: false,
  message: '',
  birthdayOn: false,
  birthday: '',
  size: 'a4',
};

let data = null;
let lastBirthday = null;

const t = key => STR[state.lang][key];

// ---------- i18n ----------

function applyI18n() {
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-theme-name]').forEach(el => { el.textContent = STR[state.lang].themes[el.dataset.themeName]; });
  $$('[data-size]').forEach(el => { el.textContent = STR[state.lang].sizes[el.dataset.size]; });
  $$('.lang button').forEach(b => b.classList.toggle('active', b.dataset.lang === state.lang));
  if (!state.titleEdited) { state.title = t('defaultTitle'); $('#title').value = state.title; }
  state.skies.forEach((sk, i) => {
    $(`#city${sfx(i)}`).value = sk.custom ? '' : placeName(sk.place, state.lang);
    if (!sk.labelEdited) syncLabel(i);
    if (!sk.captionEdited) { sk.caption = t(i === 0 ? 'captionDefaultA' : 'captionDefaultB'); $(`#caption${sfx(i)}`).value = sk.caption; }
  });
  updateTzNotes();
  updateBirthdayNote();
}

const sfx = i => (i === 0 ? '' : '-b');

function syncLabel(i) {
  const sk = state.skies[i];
  sk.label = sk.custom ? (sk.label || t('myLocation')) : placeName(sk.place, state.lang);
  $(`#place-label${sfx(i)}`).value = sk.label;
}

// ---------- time & place ----------

function localParts(sk) {
  const [y, m, d] = (sk.date || today).split('-').map(Number);
  const [hh, mm] = (sk.time || '00:00').split(':').map(Number);
  return { y, m, d, hh: hh || 0, mm: mm || 0 };
}

function updateTzNotes() {
  state.skies.forEach((sk, i) => {
    const note = $(`#tz-note${sfx(i)}`);
    if (!note) return;
    try {
      const utc = zonedToUtc(localParts(sk), sk.tz);
      note.textContent = `${sk.tz} · ${formatUtcOffset(tzOffsetMinutes(utc, sk.tz))}`;
    } catch {
      note.textContent = sk.tz;
    }
  });
}

function setPlace(i, place) {
  const sk = state.skies[i];
  sk.place = place;
  sk.custom = false;
  sk.lat = place.lat; sk.lon = place.lon; sk.tz = place.tz;
  if (i === 0) {
    $('#custom').checked = false;
    $('#custom-fields').hidden = true;
    syncCoordInputs();
  }
  $(`#city${sfx(i)}`).value = placeName(place, state.lang);
  if (!sk.labelEdited) syncLabel(i);
  updateTzNotes();
}

function syncCoordInputs() {
  const sk = state.skies[0];
  $('#lat').value = sk.lat;
  $('#lon').value = sk.lon;
  $('#tz').value = sk.tz;
}

// ---------- city search dropdown ----------

function setupCitySearch(i) {
  const input = $(`#city${sfx(i)}`);
  const menu = $(`#city${sfx(i)}-menu`);
  let items = [];
  let active = -1;
  let seq = 0;

  const close = () => { menu.hidden = true; active = -1; };
  const highlight = () => $$(`#city${sfx(i)}-menu li`).forEach((li, j) => li.classList.toggle('active', j === active));
  const pick = p => { setPlace(i, p); close(); scheduleRender(); };

  input.addEventListener('focus', () => { loadWorld().catch(() => {}); });
  input.addEventListener('input', async () => {
    const q = input.value;
    const my = ++seq;
    if (!q.trim()) { close(); return; }
    menu.hidden = false;
    menu.innerHTML = `<li class="muted">${t('searching')}</li>`;
    items = await searchPlaces(q).catch(() => []);
    if (my !== seq) return;
    active = items.length ? 0 : -1;
    menu.innerHTML = items.length
      ? items.map((p, j) => {
        const main = placeName(p, state.lang);
        const other = state.lang === 'zh' ? (p.zh ? p.name : '') : (p.zh || '');
        const country = countryName(p.cc, state.lang);
        const sub = [other, country].filter(Boolean).join(' · ');
        return `<li data-j="${j}"><span>${escapeHtml(main)}</span>${sub ? `<small>${escapeHtml(sub)}</small>` : ''}</li>`;
      }).join('')
      : `<li class="muted">${t('noMatch')}</li>`;
    highlight();
  });
  input.addEventListener('keydown', e => {
    if (menu.hidden || !items.length) return;
    if (e.key === 'ArrowDown') { active = (active + 1) % items.length; highlight(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = (active - 1 + items.length) % items.length; highlight(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (active >= 0) pick(items[active]); e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
  menu.addEventListener('mousedown', e => {
    const li = e.target.closest('li[data-j]');
    if (li) { e.preventDefault(); pick(items[+li.dataset.j]); }
  });
  input.addEventListener('blur', () => setTimeout(() => {
    close();
    const sk = state.skies[i];
    if (!sk.custom) input.value = placeName(sk.place, state.lang);
  }, 150));
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------- scene ----------

function buildScene() {
  const count = state.layout === 'double' ? 2 : 1;
  const skies = state.skies.slice(0, count).map(sk => {
    const local = localParts(sk);
    const utc = zonedToUtc(local, sk.tz);
    return {
      sky: computeSky(utc, sk.lat, sk.lon), utc, local,
      place: { label: sk.label, lat: sk.lat, lon: sk.lon },
      caption: sk.caption,
    };
  });
  let birthday = null;
  if (state.layout === 'single' && state.birthdayOn && state.birthday) {
    const age = ageInYears(state.birthday, skies[0].utc);
    birthday = findBirthdayStar(data.nearby, age, skies[0].sky.zenith);
    lastBirthday = { age, result: birthday };
  } else {
    lastBirthday = null;
  }
  return {
    data, lang: state.lang, skies, birthday,
    theme: THEMES[state.theme],
    opts: state.opts,
    text: { title: state.title, message: state.message },
  };
}

function updateBirthdayNote() {
  const note = $('#birthday-note');
  if (!note) return;
  if (state.layout === 'double') { note.textContent = t('birthdayDouble'); return; }
  if (!state.birthdayOn || !state.birthday || !lastBirthday) { note.textContent = t('birthdayHint'); return; }
  const { age, result } = lastBirthday;
  if (age == null) note.textContent = t('birthdayHint');
  else if (age <= 0) note.textContent = t('birthdayAfter');
  else if (age < 3.5) note.textContent = t('birthdayTooYoung');
  else if (!result) note.textContent = t('birthdayNone');
  else {
    const name = birthdayStarName(state.lang, state.opts.culture, result.star);
    const ly = state.lang === 'zh' ? `${result.star.ly.toFixed(1)} 光年` : `${result.star.ly.toFixed(1)} light-years`;
    note.textContent = t(result.visible ? 'birthdayFound' : 'birthdayFoundHidden').replace('{name}', name).replace('{ly}', ly);
  }
}

// Load the web-font slices needed for the strings we are about to draw.
async function ensureFonts(scene) {
  if (!document.fonts || !document.fonts.load) return false;
  const sample = [scene.text.title, scene.text.message, ...scene.skies.flatMap(s => [s.place.label, s.caption]),
    STR[scene.lang].credit, STR[scene.lang].birthdayLineVisible,
    '北东南西 NESW 0123456789 农历年月日时宿星那晚空光', ...Object.values(STR[scene.lang].bodies)].join(' ');
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
  if (!data) return;
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
    updateBirthdayNote();
    if (await ensureFonts(scene)) renderPoster(canvas, buildScene());
    $('#status').textContent = '';
  } catch (err) {
    console.error(err);
    $('#status').textContent = String(err.message || err);
  }
}

// ---------- controls ----------

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

function setLayout(layout) {
  state.layout = layout;
  $$('[data-layout]').forEach(b => b.classList.toggle('active', b.dataset.layout === layout));
  $('#sky-b-section').hidden = layout !== 'double';
  $('#caption-a-wrap').hidden = layout !== 'double';
  $('#birthday-fields').hidden = layout === 'double';
  updateBirthdayNote();
}

async function renderFull() {
  const [w, h] = SIZES[state.size];
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const scene = buildScene();
  await ensureFonts(scene);
  renderPoster(canvas, scene);
  return canvas;
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function exportFile(kind) {
  const buttons = [$('#export'), $('#export-pdf')];
  buttons.forEach(b => { b.disabled = true; });
  $('#status').textContent = t('exporting');
  await new Promise(r => setTimeout(r, 30));
  try {
    const canvas = await renderFull();
    const base = `the-sky-that-night-${state.skies[0].date}-${state.theme}`;
    if (kind === 'pdf') {
      const page = PAGE_SIZES_PT[state.size === 'a3' ? 'a3' : 'a4'];
      download(await canvasToPdf(canvas, page), `${base}.pdf`);
    } else {
      download(await new Promise(res => canvas.toBlob(res, 'image/png')), `${base}.png`);
    }
    $('#status').textContent = t('exported');
  } catch (err) {
    console.error(err);
    $('#status').textContent = String(err.message || err);
  } finally {
    buttons.forEach(b => { b.disabled = false; });
  }
}

function initControls() {
  const startCity = CITIES.find(c => c[4] === browserTz) || (state.lang === 'zh' ? CITIES[1] : CITIES.find(c => c[0] === 'New York'));
  const second = CITIES.find(c => c[0] === (state.lang === 'zh' ? 'Beijing' : 'London'));
  state.skies = [newSky(curatedPlace(startCity)), newSky(curatedPlace(second))];

  const tzs = (Intl.supportedValuesOf && Intl.supportedValuesOf('timeZone')) || [browserTz, 'UTC'];
  $('#tz').innerHTML = tzs.map(z => `<option value="${z}">${z}</option>`).join('');

  state.skies.forEach((sk, i) => {
    $(`#date${sfx(i)}`).value = sk.date;
    $(`#time${sfx(i)}`).value = sk.time;
    $(`#date${sfx(i)}`).addEventListener('input', e => { sk.date = e.target.value; updateTzNotes(); scheduleRender(); });
    $(`#time${sfx(i)}`).addEventListener('input', e => { sk.time = e.target.value || '00:00'; updateTzNotes(); scheduleRender(); });
    $(`#place-label${sfx(i)}`).addEventListener('input', e => { sk.label = e.target.value; sk.labelEdited = true; scheduleRender(); });
    $(`#caption${sfx(i)}`).addEventListener('input', e => { sk.caption = e.target.value; sk.captionEdited = true; scheduleRender(); });
    setupCitySearch(i);
    setPlace(i, sk.place);
  });

  $$('.lang button').forEach(b => b.addEventListener('click', () => {
    state.lang = b.dataset.lang;
    applyI18n();
    scheduleRender();
  }));

  // Custom coordinates (first sky)
  const skA = state.skies[0];
  $('#custom').addEventListener('change', e => {
    skA.custom = e.target.checked;
    $('#custom-fields').hidden = !skA.custom;
    if (skA.custom) {
      $('#city').value = '';
      if (!skA.labelEdited) { skA.label = t('myLocation'); $('#place-label').value = skA.label; }
    } else {
      setPlace(0, skA.place);
    }
    updateTzNotes(); scheduleRender();
  });
  const readCoords = () => {
    const la = parseFloat($('#lat').value), lo = parseFloat($('#lon').value);
    if (Number.isFinite(la) && Math.abs(la) <= 90) skA.lat = la;
    if (Number.isFinite(lo) && Math.abs(lo) <= 180) skA.lon = lo;
    skA.tz = $('#tz').value || skA.tz;
    updateTzNotes(); scheduleRender();
  };
  ['#lat', '#lon', '#tz'].forEach(s => $(s).addEventListener('change', readCoords));

  $('#locate').addEventListener('click', () => {
    if (!navigator.geolocation) { $('#status').textContent = t('locateFailed'); return; }
    $('#status').textContent = t('locating');
    navigator.geolocation.getCurrentPosition(pos => {
      skA.custom = true;
      $('#custom').checked = true;
      $('#custom-fields').hidden = false;
      $('#city').value = '';
      skA.lat = +pos.coords.latitude.toFixed(4);
      skA.lon = +pos.coords.longitude.toFixed(4);
      skA.tz = browserTz;
      if (!skA.labelEdited) skA.label = t('myLocation');
      $('#place-label').value = skA.label;
      syncCoordInputs(); updateTzNotes();
      $('#status').textContent = '';
      scheduleRender();
    }, () => { $('#status').textContent = t('locateFailed'); }, { timeout: 10000 });
  });

  $('#title').addEventListener('input', e => { state.title = e.target.value; state.titleEdited = true; scheduleRender(); });
  $('#message').addEventListener('input', e => { state.message = e.target.value; scheduleRender(); });

  $$('[data-layout]').forEach(b => b.addEventListener('click', () => { setLayout(b.dataset.layout); scheduleRender(); }));
  $$('.theme-card').forEach(el => el.addEventListener('click', () => { applyThemeDefaults(el.dataset.theme); scheduleRender(); }));
  $$('input[name="culture"]').forEach(el => el.addEventListener('change', () => { state.opts.culture = el.value; scheduleRender(); }));
  $$('[data-opt]').forEach(el => el.addEventListener('change', () => { state.opts[el.dataset.opt] = el.checked; scheduleRender(); }));

  $('#birthday-on').addEventListener('change', e => { state.birthdayOn = e.target.checked; scheduleRender(); updateBirthdayNote(); });
  $('#birthday').addEventListener('input', e => {
    state.birthday = e.target.value;
    if (state.birthday && !state.birthdayOn) { state.birthdayOn = true; $('#birthday-on').checked = true; }
    scheduleRender();
  });

  $('#size').addEventListener('change', e => { state.size = e.target.value; });
  $('#export').addEventListener('click', () => exportFile('png'));
  $('#export-pdf').addEventListener('click', () => exportFile('pdf'));

  window.addEventListener('resize', scheduleRender);
}

async function main() {
  initControls();
  applyThemeDefaults(THEME_ORDER[0]);
  setLayout('single');
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
