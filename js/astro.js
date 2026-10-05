// Astronomy helpers: data loading, local-time → UTC, sky state and the sky projection.
// Coordinates follow the d3-celestial convention: [lon, lat] = [RA in degrees wrapped to ±180, Dec],
// equinox J2000.
const A = window.Astronomy;
const d3 = window.d3;

export const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export async function loadData(base = 'data/') {
  const get = name => fetch(base + name).then(r => {
    if (!r.ok) throw new Error(`Failed to load ${name}`);
    return r.json();
  });
  const [stars, lines, linesCn, cons, consCn, mw, starNames, nearby, mansions] = await Promise.all([
    get('stars.6.json'),
    get('constellations.lines.json'),
    get('constellations.lines.cn.json'),
    get('constellations.json'),
    get('constellations.cn.json'),
    get('mw.json'),
    get('starnames.bright.json'),
    get('lightyear.json'),
    get('mansions.json'),
  ]);
  stars.features.sort((a, b) => b.properties.mag - a.properties.mag); // faint first, bright on top
  fixWinding(mw);
  return { stars, lines, linesCn, cons, consCn, mw, starNames, nearby, mansions };
}

const MS_PER_YEAR = 365.2425 * 86400000;

// Age in years at the poster moment for someone born on the given local date (noon, to avoid off-by-one-day).
export function ageInYears(birthday, utcDate) {
  if (!birthday) return null;
  const [y, m, d] = birthday.split('-').map(Number);
  if (!y || !m || !d) return null;
  return (utcDate.getTime() - Date.UTC(y, m - 1, d, 12)) / MS_PER_YEAR;
}

// "Light-year birthday star": a naked-eye star whose distance in light-years matches the age,
// so the light seen at the poster moment left the star around the day the person was born.
// Prefers stars above the horizon, then a close distance match, then brightness.
export function findBirthdayStar(nearby, age, zenith) {
  if (age == null || age < 3.5) return null;
  const score = s => Math.abs(s.ly - age) + 0.25 * s.mag;
  const best = list => list.reduce((a, b) => (score(b) < score(a) ? b : a));
  for (const tol of [1, 2, 3.5]) {
    const visible = nearby.filter(s => Math.abs(s.ly - age) <= tol && isAboveHorizon(s.c, zenith, 3));
    if (visible.length) return { star: best(visible), visible: true, age };
  }
  const any = nearby.filter(s => Math.abs(s.ly - age) <= 3.5);
  return any.length ? { star: best(any), visible: false, age } : null;
}

// d3-geo fills the smaller side of a spherical ring; flip any polygon that would cover more than a hemisphere.
function fixWinding(fc) {
  for (const f of fc.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      if (d3.geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI) {
        poly.forEach(ring => ring.reverse());
      }
    }
  }
}

export function wrap180(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}

// Offset (minutes) of a time zone from UTC at a given instant, from the browser's tz database.
export function tzOffsetMinutes(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map(x => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Wall-clock time at a place → UTC instant (handles historical daylight saving via Intl).
export function zonedToUtc({ y, m, d, hh, mm }, tz) {
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let utc = wall;
  for (let i = 0; i < 3; i++) {
    utc = wall - tzOffsetMinutes(new Date(utc), tz) * 60000;
  }
  return new Date(utc);
}

export function formatUtcOffset(minutes) {
  const sign = minutes >= 0 ? '+' : '−';
  const a = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

function eqToCoord(eq) {
  return [wrap180(eq.ra * 15), eq.dec];
}

// Everything that depends on the moment and the place.
export function computeSky(utcDate, lat, lon) {
  const time = A.MakeTime(utcDate);
  const observer = new A.Observer(lat, lon, 0);

  // Zenith and the north point of the horizon, expressed in J2000 equatorial coordinates
  // (the frame of the star catalog). The north point fixes the map's rotation exactly.
  const horToEqj = A.Rotation_HOR_EQJ(time, observer);
  const fromHorizon = (alt, az) => eqToCoord(A.EquatorFromVector(
    A.RotateVector(horToEqj, A.VectorFromHorizon(new A.Spherical(alt, az, 1), time, undefined))));
  const zenith = fromHorizon(90, 0);
  const north = fromHorizon(0, 0);

  const bodyInfo = name => {
    const body = A.Body[name];
    const j2000 = A.Equator(body, time, observer, false, true);
    const ofDate = A.Equator(body, time, observer, true, true);
    const hor = A.Horizon(time, observer, ofDate.ra, ofDate.dec, undefined);
    let mag = null;
    try { mag = A.Illumination(body, time).mag; } catch { /* not available for every body */ }
    return { name, coord: eqToCoord(j2000), alt: hor.altitude, az: hor.azimuth, mag };
  };

  const moon = bodyInfo('Moon');
  moon.phaseDeg = A.MoonPhase(time);
  moon.fraction = A.Illumination(A.Body.Moon, time).phase_fraction;
  const sun = bodyInfo('Sun');
  const planets = PLANETS.map(bodyInfo);

  return { time, observer, lat, lon, zenith, north, moon, sun, planets };
}

// Zenith-centred stereographic projection: north up, east on the left (as seen looking up),
// horizon mapped to a circle of radius R around (cx, cy).
export function makeProjection(zenith, cx, cy, R, north = null) {
  const p = d3.geoStereographic()
    .reflectX(true)
    .rotate([-zenith[0], -zenith[1], 0])
    .clipAngle(90)
    .precision(0.15)
    .translate([0, 0])
    .scale(1);
  // Calibrate: a point exactly 90° from the zenith must land on the horizon circle.
  const edge = [wrap180(zenith[0] + 180), 90 - zenith[1]];
  const [ex, ey] = p(edge);
  p.scale(1 / Math.hypot(ex, ey));
  // Rotate so the horizon's north point sits exactly at the top
  // (J2000 north differs slightly from the north of the observing date).
  if (north) {
    const offset = () => { const [nx, ny] = p(north); return Math.atan2(nx, -ny) * 180 / Math.PI; };
    const off = offset();
    p.angle(-off);
    if (Math.abs(offset()) > Math.abs(off)) p.angle(off); // d3's angle sign depends on the reflection
  }
  return p.scale(R).translate([cx, cy]);
}

export function isAboveHorizon(coord, zenith, marginDeg = 0) {
  return d3.geoDistance(coord, zenith) < (Math.PI / 2) - marginDeg * Math.PI / 180;
}

// Ecliptic as a line in J2000 equatorial coordinates.
export function eclipticLine() {
  const eps = 23.4392911 * Math.PI / 180;
  const pts = [];
  for (let l = 0; l <= 360; l += 2) {
    const lam = l * Math.PI / 180;
    const ra = Math.atan2(Math.sin(lam) * Math.cos(eps), Math.cos(lam));
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    pts.push([wrap180(ra * 180 / Math.PI), dec * 180 / Math.PI]);
  }
  return { type: 'LineString', coordinates: pts };
}
