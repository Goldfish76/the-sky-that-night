# Attribution

The code in this repository is MIT-licensed (see [LICENSE](LICENSE)). Data and libraries keep their own licenses.

| What | Files | Source | License |
|---|---|---|---|
| Star catalog (to magnitude 6), constellation lines and names, Milky Way outlines | `data/stars.6.json`, `data/constellations.json`, `data/constellations.lines.json`, `data/mw.json` | [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn. Star data derived from the ESA Hipparcos catalogue | BSD-3-Clause ([`data/LICENSE.d3-celestial`](data/LICENSE.d3-celestial)) |
| Bright star names (subset) | `data/starnames.bright.json` | Extracted from d3-celestial `starnames.json` and `starnames.cn.json` | BSD-3-Clause |
| Traditional Chinese asterisms (names and lines) | `data/constellations.cn.json`, `data/constellations.lines.cn.json` | Stellarium's "Chinese" sky culture, as packaged in d3-celestial | Text and lines **CC BY-SA** (per Stellarium's sky culture description) |
| Distances of naked-eye stars within 125 light-years (birthday star) | `data/lightyear.json` | [HYG database v4.1](https://github.com/astronexus/HYG-Database) by David Nash | **CC BY-SA 4.0** |
| World cities with population ≥ 15,000, with time zones | `data/cities.json` | [GeoNames](https://www.geonames.org/) `cities15000` | CC BY 4.0 |
| Traditional → simplified Chinese place names (build time only, not distributed) | `tools/build_data.py` | [OpenCC](https://github.com/BYVoid/OpenCC) `TSCharacters.txt` | Apache-2.0 |
| Astronomy calculations | `vendor/astronomy.browser.min.js` | [Astronomy Engine](https://github.com/cosinekitty/astronomy) by Don Cross | MIT (header in the file) |
| Projection and geometry | `vendor/d3.min.js` | [D3](https://d3js.org) by Mike Bostock | ISC ([`vendor/LICENSE.d3.txt`](vendor/LICENSE.d3.txt)) |
| Fonts | loaded from Google Fonts | Cormorant Garamond, Jost, Noto Sans SC, Noto Serif SC, Ma Shan Zheng | SIL Open Font License 1.1 |
| City coordinates and time zones | `js/cities.js` | Compiled for this project | MIT |

All derived files can be regenerated with `python tools/build_data.py`.

Because the Chinese asterism data is CC BY-SA, every poster that shows Chinese asterisms prints this attribution in its credit line: "Chinese asterisms: Stellarium (CC BY-SA)".
