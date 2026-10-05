"""Rebuild the derived data files in data/ from their public sources.

    python tools/build_data.py

Downloads the sources into tools/.cache/ and writes:
  data/starnames.bright.json  bright-star names (d3-celestial, BSD-3-Clause)
  data/lightyear.json         naked-eye stars within 125 light-years (HYG v4.1, CC BY-SA 4.0)
  data/cities.json            world cities with population >= 15,000 (GeoNames, CC BY 4.0)
  data/mansions.json          the 28 lunar mansions and their boundary stars (Stellarium sky culture via d3-celestial)
"""
import csv
import io
import json
import re
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = Path(__file__).resolve().parent / ".cache"

SOURCES = {
    "stars": "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json",
    "starnames": "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/starnames.json",
    "starnames_cn": "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/starnames.cn.json",
    "constellations": "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json",
    "hyg": "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv",
    "geonames": "https://download.geonames.org/export/dump/cities15000.zip",
    # Used only at build time to turn traditional Chinese place names into simplified ones (Apache-2.0).
    "opencc_ts": "https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSCharacters.txt",
}

GREEK = {"Alp": "α", "Bet": "β", "Gam": "γ", "Del": "δ", "Eps": "ε", "Zet": "ζ", "Eta": "η", "The": "θ",
         "Iot": "ι", "Kap": "κ", "Lam": "λ", "Mu": "μ", "Nu": "ν", "Xi": "ξ", "Omi": "ο", "Pi": "π",
         "Rho": "ρ", "Sig": "σ", "Tau": "τ", "Ups": "υ", "Phi": "φ", "Chi": "χ", "Psi": "ψ", "Ome": "ω"}
SUPERSCRIPT = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def fetch(key):
    CACHE.mkdir(exist_ok=True)
    url = SOURCES[key]
    path = CACHE / url.rsplit("/", 1)[1]
    if not path.exists():
        print(f"downloading {url}")
        with urllib.request.urlopen(url, timeout=300) as r:
            path.write_bytes(r.read())
    return path


def load_json(key):
    return json.loads(fetch(key).read_text(encoding="utf-8"))


def constellation_zh():
    src = (ROOT / "js" / "i18n.js").read_text(encoding="utf-8")
    return dict(re.findall(r"(\w+): '([^']+座)'", src))


def build_bright_names():
    stars = {str(f["id"]): f for f in load_json("stars")["features"]}
    sn, sncn = load_json("starnames"), load_json("starnames_cn")
    out = {}
    for hip, f in stars.items():
        mag = f["properties"]["mag"]
        if mag > 2.1 and hip != "11767":  # bright stars plus Polaris
            continue
        n, c = sn.get(hip, {}), sncn.get(hip, {})
        if n.get("name"):
            out[hip] = {"en": n["name"], "zh": n.get("zh") or "", "cn": c.get("name") or "", "mag": mag}
    write("starnames.bright.json", out)
    print(f"starnames.bright.json: {len(out)} stars")


def greek(bayer):
    m = re.match(r"([A-Za-z]+)(\d*)", bayer or "")
    if not m or m.group(1) not in GREEK:
        return ""
    return GREEK[m.group(1)] + (m.group(2).translate(SUPERSCRIPT) if m.group(2) else "")


def build_lightyear():
    sn, sncn = load_json("starnames"), load_json("starnames_cn")
    cons = {f["id"]: f["properties"] for f in load_json("constellations")["features"]}
    zhmap = constellation_zh()
    out = []
    with fetch("hyg").open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            try:
                mag, dist = float(r["mag"]), float(r["dist"])
            except ValueError:
                continue
            if not r["hip"] or r["proper"] == "Sol" or mag > 5.5 or not 0 < dist < 100000:
                continue
            ly = dist * 3.26156
            if ly > 125:
                continue
            hip, con, flam = r["hip"], r["con"], r["flam"]
            g = greek(r["bayer"])
            gen = cons.get(con, {}).get("gen", con)
            en = r["proper"] or (f"{g} {gen}" if g else f"{flam} {gen}" if flam else f"HIP {hip}")
            n, c = sn.get(hip, {}), sncn.get(hip, {})
            czh = zhmap.get(con, "")
            zh = n.get("zh") or c.get("name") or (
                f"{czh}{g}" if g and czh else f"{czh}{flam}" if flam and czh else f"HIP {hip}")
            ra = float(r["ra"]) * 15.0
            out.append({"hip": int(hip), "ly": round(ly, 2), "mag": round(mag, 2), "en": en, "zh": zh,
                        "cn": c.get("name", ""), "c": [round(ra - 360 if ra > 180 else ra, 4), round(float(r["dec"]), 4)]})
    out.sort(key=lambda s: s["ly"])
    write("lightyear.json", out)
    print(f"lightyear.json: {len(out)} stars")


CJK = re.compile(r"^[㐀-鿿·]+$")


def build_cities():
    ts = {}
    for line in fetch("opencc_ts").read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#"):
            trad, simp = line.split("\t")
            ts[trad] = simp.split(" ")[0]
    to_simp = lambda s: "".join(ts.get(ch, ch) for ch in s)

    def chinese_name(alternates):
        cands = [a for a in alternates.split(",") if CJK.match(a)]
        if not cands:
            return ""
        simps = [to_simp(c) for c in cands]
        sset = set(simps)

        def score(i):
            c, s = cands[i], simps[i]
            main = (s + "市") in sset or (s.endswith("市") and s[:-1] in sset)
            return (3 if main else 0) + (2 if c == s else 0) - 0.01 * i

        s = simps[max(range(len(cands)), key=score)]
        return s[:-1] if s.endswith("市") and len(s) > 2 else s

    with zipfile.ZipFile(fetch("geonames")) as z:
        text = z.read("cities15000.txt").decode("utf-8")
    rows = []
    for line in text.splitlines():
        f = line.split("\t")
        rows.append((int(f[14] or 0), f[1], chinese_name(f[3]), round(float(f[4]), 2), round(float(f[5]), 2), f[17], f[8]))
    rows.sort(key=lambda r: -r[0])
    zones = sorted({r[5] for r in rows})
    zidx = {z: i for i, z in enumerate(zones)}
    cities = [[name, zh, lat, lon, zidx[tz], cc, pop // 1000] for pop, name, zh, lat, lon, tz, cc in rows]
    write("cities.json", {"tz": zones, "c": cities})
    print(f"cities.json: {len(cities)} cities, {len(zones)} time zones")


MANSIONS = "角亢氐房心尾箕斗牛女虚危室壁奎娄胃昴毕觜参井鬼柳星张翼轸"


def build_mansions():
    """Each mansion starts at the hour circle of its first star ("X宿一" in the Chinese sky culture)."""
    sncn = load_json("starnames_cn")
    stars = {str(f["id"]): f for f in load_json("stars")["features"]}
    by_name = {v["name"]: k for k, v in sncn.items()}
    out = []
    for m in MANSIONS:
        hip = by_name[m + "宿一"]
        ra, dec = stars[hip]["geometry"]["coordinates"]
        out.append({"n": m, "hip": int(hip), "c": [ra, dec]})
    write("mansions.json", out)
    print(f"mansions.json: {len(out)} mansions")


def write(name, obj):
    (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    build_bright_names()
    build_lightyear()
    build_cities()
    build_mansions()
