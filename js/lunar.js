// Chinese lunisolar calendar (农历), computed from the Sun and the Moon with Astronomy Engine
// by the rules of GB/T 33661-2017:
// - a month begins on the day of the new moon (when the Moon's apparent longitude equals the Sun's);
// - days run from midnight China Standard Time (UTC+8);
// - the month that contains the winter solstice is month 11;
// - when 13 months lie between one month 11 and the next, the first of them without a principal
//   solar term (中气: the Sun's apparent longitude reaches a multiple of 30°) is a leap month,
//   numbered like the month before it;
// - the year changes on the first day of month 1.
// The browser's built-in Chinese calendar (Intl) is not used: it starts some months a day early
// or late when the new moon falls near midnight in China (Chinese New Year 2027, for one).
// Checked day by day against the Hong Kong Observatory's tables for 1901–2100.
const A = window.Astronomy;
const DAY = 86400000;
const UTC8 = 8 * 3600000;

// From 1912 to 1928 the official calendar was reckoned in Beijing local time (116°23′ E),
// about 14 minutes behind UTC+8.
const BEIJING_LOCAL = (7 * 3600 + 45 * 60 + 32) * 1000;
const LOCAL_FROM = Date.UTC(1912, 0, 1) - UTC8, LOCAL_TO = Date.UTC(1929, 0, 1) - UTC8;
const offsetAt = ms => (ms >= LOCAL_FROM && ms < LOCAL_TO ? BEIJING_LOCAL : UTC8);

// Day number (days since 1970-01-01) on which an instant falls in China.
const chinaDay = time => {
  const ms = time.date.getTime();
  return Math.floor((ms + offsetAt(ms)) / DAY);
};
// The instant at which a day number begins in China.
const chinaMidnight = day => A.MakeTime(new Date(day * DAY - offsetAt(day * DAY - UTC8)));

// The Moon's apparent longitude minus the Sun's, in degrees within ±180.
function elongation(time) {
  const d = A.EclipticGeoMoon(time).lon - A.SunPosition(time).elon;
  return d - 360 * Math.round(d / 360);
}

// The first new moon after `time`. SearchMoonPhase compares geometric longitudes, which puts the
// conjunction about 40 seconds late, so its result is refined to the apparent conjunction.
function nextNewMoon(time) {
  const geometric = A.SearchMoonPhase(0, time, 40);
  return A.Search(elongation, geometric.AddDays(-0.01), geometric.AddDays(0.01), { dt_tolerance_seconds: 0.1 });
}

// The Hong Kong Observatory's table starts the month of 2057-09-28 a day earlier than this
// computation does: that new moon falls within seconds of midnight, closer than the ephemerides
// can settle. Follow the published table.
const PUBLISHED_FIRST_DAYS = new Set(['2057-09-28'].map(iso => Date.parse(iso) / DAY));

// Days on which months begin (the day of each new moon), from `from` (inclusive) to before `to`.
function newMoonDays(from, to) {
  const days = [];
  let t = chinaMidnight(from);
  for (;;) {
    const nm = nextNewMoon(t);
    let day = chinaDay(nm);
    if (PUBLISHED_FIRST_DAYS.has(day - 1)) day -= 1;
    if (day >= to) return days;
    if (day >= from) days.push(day);
    t = nm.AddDays(20);
  }
}

// Days of the principal solar terms from `from` (inclusive) to before `to`.
function principalTermDays(from, to) {
  const days = [];
  let t = chinaMidnight(from);
  let lon = (Math.floor(A.SunPosition(t).elon / 30) + 1) * 30 % 360;
  for (;;) {
    const term = A.SearchSunLongitude(lon, t, 40);
    const day = chinaDay(term);
    if (day >= to) return days;
    days.push(day);
    t = term.AddDays(20);
    lon = (lon + 30) % 360;
  }
}

// The day on which the month containing the December solstice of `year` begins.
const month11Cache = new Map();
function month11Start(year) {
  if (!month11Cache.has(year)) {
    const december1 = new Date(0);
    december1.setUTCFullYear(year, 11, 1); // unlike Date.UTC, keeps years 0–99 as they are
    const solstice = chinaDay(A.SearchSunLongitude(270, A.MakeTime(december1), 40));
    const moons = newMoonDays(solstice - 31, solstice + 1);
    month11Cache.set(year, moons[moons.length - 1]);
  }
  return month11Cache.get(year);
}

// The months from the month 11 of `year` up to (not including) the next month 11.
const suiCache = new Map();
function sui(year) {
  if (suiCache.has(year)) return suiCache.get(year);
  const start = month11Start(year), end = month11Start(year + 1);
  const starts = newMoonDays(start, end);
  const terms = principalTermDays(start, end);
  const next = i => (i + 1 < starts.length ? starts[i + 1] : end);
  let leap = -1;
  if (starts.length === 13) {
    leap = starts.findIndex((s, i) => i > 0 && !terms.some(t => t >= s && t < next(i)));
  }
  let number = 10;
  const months = starts.map((s, i) => {
    const isLeap = i === leap;
    if (!isLeap) number = number % 12 + 1;
    return { start: s, end: next(i), month: number, leap: isLeap };
  });
  // The year changes at the start of month 1; months 11 and 12 belong to the previous year.
  const newYear = months.find(m => m.month === 1 && !m.leap).start;
  const result = { months, newYear, newYearGregorian: new Date(newYear * DAY).getUTCFullYear() };
  suiCache.set(year, result);
  return result;
}

// Lunar date of a civil (Gregorian) date: { year, month, leap, day }, where `year` is the
// Gregorian year in which that lunar year begins.
export function lunarDateOf({ y, m, d }) {
  const day = Date.UTC(y, m - 1, d) / DAY;
  // Date.UTC reads years 0–99 as 1900–1999, as the rest of the app does; follow the year it used.
  const year = new Date(day * DAY).getUTCFullYear();
  const s = sui(day >= month11Start(year) ? year : year - 1);
  const month = s.months.find(mo => day >= mo.start && day < mo.end);
  return {
    year: day >= s.newYear ? s.newYearGregorian : s.newYearGregorian - 1,
    month: month.month,
    leap: month.leap,
    day: day - month.start + 1,
  };
}

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '腊月'];
const DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

// Sexagenary name of a lunar year, e.g. 2026 → 丙午.
export function ganzhi(year) {
  const i = ((year - 4) % 60 + 60) % 60;
  return STEMS[i % 10] + BRANCHES[i % 12];
}

// e.g. "丙午年七月初七" or "乙巳年闰六月初一".
export function formatLunar({ year, month, leap, day }) {
  return `${ganzhi(year)}年${leap ? '闰' : ''}${MONTHS[month - 1]}${DAYS[day - 1]}`;
}
