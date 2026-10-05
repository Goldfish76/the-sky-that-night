"""Build the self-hosted web fonts: fonts/*.woff2 and fonts/fonts.css.

    pip install fonttools brotli
    python tools/build_fonts.py

Fonts come from github.com/google/fonts (SIL Open Font License 1.1). Variable fonts are pinned to
the weights the app uses. Chinese fonts are cut into small slices with `unicode-range`, so a
browser only downloads the slices for the characters on screen (the technique Google Fonts uses).
Self-hosting keeps the app working where Google Fonts is blocked and avoids third-party requests.
"""
import json
import re
import shutil
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "fonts"
CACHE = Path(__file__).resolve().parent / ".cache" / "fonts"
G = "https://raw.githubusercontent.com/google/fonts/main/ofl/"

# (css family, google/fonts path, weights, italic, cjk)
FONTS = [
    ("Jost", "jost/Jost%5Bwght%5D.ttf", [300, 400, 500, 700], False, False),
    ("Jost", "jost/Jost-Italic%5Bwght%5D.ttf", [400], True, False),
    ("Cormorant Garamond", "cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf", [400, 500, 600], False, False),
    ("Cormorant Garamond", "cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf", [400, 500], True, False),
    ("Noto Sans SC", "notosanssc/NotoSansSC%5Bwght%5D.ttf", [300, 400], False, True),
    ("Noto Serif SC", "notoserifsc/NotoSerifSC%5Bwght%5D.ttf", [400, 600], False, True),
    ("Ma Shan Zheng", "mashanzheng/MaShanZheng-Regular.ttf", [400], False, True),
    ("Space Mono", "spacemono/SpaceMono-Regular.ttf", [400], False, False),
    ("Space Mono", "spacemono/SpaceMono-Bold.ttf", [700], False, False),
    ("VT323", "vt323/VT323-Regular.ttf", [400], False, False),
    ("Poiret One", "poiretone/PoiretOne-Regular.ttf", [400], False, False),
    ("Great Vibes", "greatvibes/GreatVibes-Regular.ttf", [400], False, False),
    ("Oxanium", "oxanium/Oxanium%5Bwght%5D.ttf", [400, 700], False, False),
    ("Long Cang", "longcang/LongCang-Regular.ttf", [400], False, True),
    ("ZCOOL QingKe HuangYou", "zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf", [400], False, True),
    ("Caveat", "caveat/Caveat%5Bwght%5D.ttf", [400, 600], False, False),
]
LICENSE_DIRS = ["jost", "cormorantgaramond", "notosanssc", "notoserifsc", "mashanzheng",
                "spacemono", "vt323", "poiretone", "greatvibes", "oxanium", "longcang", "zcoolqingkehuangyou", "caveat"]

LATIN = (list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + list(range(0x370, 0x400))
         + list(range(0x2000, 0x2070)) + list(range(0x2070, 0x20A0)) + [0x20AC, 0x2122, 0x2190, 0x2192, 0x2605])
# What CJK fonts need besides Chinese: digits, Latin letters and punctuation in mixed lines.
LATIN_CJK = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x2000, 0x2070))
SLICE = 150


def fetch(url, name):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        print(f"downloading {url}")
        with urllib.request.urlopen(url, timeout=600) as r:
            path.write_bytes(r.read())
    return path


def gb2312():
    chars = []
    for b1 in range(0xB0, 0xF8):
        for b2 in range(0xA1, 0xFF):
            try:
                chars.append(bytes([b1, b2]).decode("gb2312"))
            except UnicodeDecodeError:
                pass
    return chars


def cjk_chars(paths):
    text = "".join(p.read_text(encoding="utf-8") for p in paths)
    return {ch for ch in text if ord(ch) >= 0x2E80}


def app_chars():
    """(core, extra): characters the UI and star names always need, and the rarer ones in city names."""
    core = cjk_chars(list((ROOT / "js").glob("*.js")) + [ROOT / "index.html"]
                     + [ROOT / "data" / n for n in ["constellations.cn.json", "starnames.bright.json"]])
    extra = cjk_chars([ROOT / "data" / n for n in ["cities.json", "lightyear.json"]]) - core
    return core, extra


def ranges(codepoints):
    cps = sorted(set(codepoints))
    out, start, prev = [], cps[0], cps[0]
    for cp in cps[1:] + [None]:
        if cp is not None and cp == prev + 1:
            prev = cp
            continue
        out.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
        if cp is not None:
            start = prev = cp
    return ", ".join(out)


def subset_to(font_path, unicodes, out_path):
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.hinting = False
    options.desubroutinize = True
    # A fixed timestamp keeps rebuilds byte-identical, so git only sees fonts that really changed.
    font = TTFont(font_path, recalcTimestamp=False)
    sub = subset.Subsetter(options)
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    font["head"].modified = font["head"].created
    font.flavor = "woff2"
    font.save(out_path)
    return out_path.stat().st_size


def static_instance(src, weight, tag):
    path = CACHE / f"{tag}-{weight}.ttf"
    if path.exists():
        return path
    font = TTFont(src)
    if "fvar" in font:
        axes = {a.axisTag: (a.minValue, a.maxValue) for a in font["fvar"].axes}
        lo, hi = axes["wght"]
        font = instancer.instantiateVariableFont(font, {"wght": max(lo, min(hi, weight))})
    font.save(path)
    return path


def main():
    (OUT / "licenses").mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.woff2"):
        old.unlink()
    for d in LICENSE_DIRS:
        shutil.copy(fetch(G + d + "/OFL.txt", f"{d}-OFL.txt"), OUT / "licenses" / f"{d}-OFL.txt")

    core_chars, city_chars = app_chars()
    hanzi = gb2312()
    core = sorted({ord(c) for c in core_chars} | set(LATIN_CJK) | set(range(0x3000, 0x3040)) | set(range(0xFF00, 0xFF5F)))
    core_set = set(core)
    # The other slices are fixed runs of GB2312 (then the rarer city characters), minus whatever
    # the core slice already has. New UI text then changes only the core and the runs it touches.
    rest = [ord(c) for c in hanzi]
    rest_set = set(rest)
    rest += sorted(ord(c) for c in city_chars if ord(c) not in rest_set)
    slices = [core] + [[c for c in rest[i:i + SLICE] if c not in core_set] for i in range(0, len(rest), SLICE)]
    print(f"core slice: {len(core)} code points; {len(slices) - 1} more slices of up to {SLICE}")

    css, total = [], 0
    for family, path, weights, italic, cjk in FONTS:
        src = fetch(G + path, path.split("/")[-1].replace("%5B", "[").replace("%5D", "]"))
        slug = family.lower().replace(" ", "-") + ("-italic" if italic else "")
        for w in weights:
            inst = static_instance(src, w, f"{slug}-{src.stem}")
            cmap = set(TTFont(inst)["cmap"].getBestCmap().keys())
            parts = slices if cjk else [LATIN]
            for i, cps in enumerate(parts):
                cps = [c for c in cps if c in cmap]
                if not cps:
                    continue
                name = f"{slug}-{w}{f'-{i:02d}' if cjk else ''}.woff2"
                total += subset_to(inst, cps, OUT / name)
                css.append(
                    f'@font-face{{font-family:"{family}";font-style:{"italic" if italic else "normal"};'
                    f'font-weight:{w};font-display:swap;src:url("{name}") format("woff2");'
                    f'unicode-range:{ranges(cps)};}}')
            print(f"{family} {w}{' italic' if italic else ''}: done")
    (OUT / "fonts.css").write_text(
        "/* Generated by tools/build_fonts.py. Fonts: SIL Open Font License 1.1, see fonts/licenses/. */\n"
        + "\n".join(css) + "\n", encoding="utf-8")
    print(f"{len(css)} font files, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
