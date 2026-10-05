# The Sky That Night

**Pick a date and a place. Get a print-ready poster of the real night sky at that moment.**
Free, open source, and nothing ever leaves your browser.

**Try it: https://goldfish76.github.io/the-sky-that-night/**

[中文说明](README.zh-CN.md)

![Three posters: Noir, Parchment and Ink Wash](docs/hero.jpg)

## Features

- **The real sky, not a pretty guess.** Stars, Moon and planets are computed for your exact date, time and place.
- **Three styles:**
  - *Noir*: minimal black.
  - *Parchment*: an old star atlas, with a coordinate grid and the ecliptic.
  - *Ink Wash*: Chinese 水墨 painting with a red seal.
- **Two sky cultures.** Western constellations, or traditional Chinese asterisms (the 28 lunar mansions, 北斗, 织女, 牛郎…).
- **Moon with the right phase and orientation, plus the five naked-eye planets and the Milky Way.**
- **Real local time.** Your browser's time-zone database applies historical daylight-saving rules.
- **Bilingual (English / 中文).** The Ink style can show the Chinese lunar date and the traditional double-hour (时辰).
- **Light-year birthday star.** Enter a birthday and the poster marks a naked-eye star whose distance in light-years matches the age that night. The light you saw from it left the star the year you were born.
- **Two skies on one poster.** For example, the nights two people were born, each with its own date and place.
- **Any place on Earth.** Offline search over 34,000 cities with their time zones, or enter custom coordinates.
- **Print-ready PNG or PDF.** A4 or A3 at 300 DPI.
- **Private by design.** No account, no tracking, no uploads, no third-party requests. Fonts are self-hosted and city search runs offline.

| Noir | Parchment | Ink Wash |
|---|---|---|
| ![Noir](docs/samples/noir-new-york.jpg) | ![Parchment](docs/samples/parchment-london.jpg) | ![Ink Wash](docs/samples/ink-beijing-qixi.jpg) |

| Light-year birthday star | Two skies | 两片星空 |
|---|---|---|
| ![Birthday star](docs/samples/birthday-star-noir.jpg) | ![Two skies, Parchment](docs/samples/two-skies-parchment.jpg) | ![Two skies, Ink Wash](docs/samples/two-skies-ink.jpg) |

## Run it locally

It is a static site with no build step:

```bash
git clone https://github.com/Goldfish76/the-sky-that-night
cd the-sky-that-night
python -m http.server 8000
```

Then open http://localhost:8000. Any static file server works.

## How accurate is it?

1. **Star positions:** the Hipparcos-derived catalog bundled with [d3-celestial](https://github.com/ofrohn/d3-celestial), in J2000 coordinates.
2. **Orientation:** [Astronomy Engine](https://github.com/cosinekitty/astronomy) converts the zenith and the north point of the horizon into the same J2000 frame. That fixes the map's centre and its rotation for your moment.
3. **Projection:** zenith-centred stereographic, the way you see the sky lying on your back. The horizon is the circle, north is up and east is on the left.
4. **Moon and planets:** topocentric positions, with the Moon's phase and the direction of its lit side.
5. **Check:** compared against Astronomy Engine's own altitude/azimuth for bright stars, the largest error is about **0.005°**.
6. **Not modelled:** atmospheric refraction. Near the horizon, real stars appear up to ~0.5° higher.
7. **Birthday-star distances:** from the [HYG database](https://github.com/astronexus/HYG-Database) (Hipparcos parallaxes). For the fainter stars the uncertainty can be a few light-years.

## Roadmap

- [x] Light-year birthday star
- [x] Two skies on one poster
- [x] PDF export (300 DPI)
- [x] Offline search for any city
- [ ] Vector SVG export
- [x] Self-hosted fonts (no Google Fonts, works where it is blocked)
- [ ] Birthday stars in the two-sky layout
- [ ] More styles. Themes live in [`js/themes.js`](js/themes.js); pull requests welcome.

## Rebuilding the data

`python tools/build_data.py` downloads the public sources and regenerates the files in `data/` (star names, birthday-star distances, world cities).
`python tools/build_fonts.py` rebuilds the self-hosted fonts in `fonts/` (needs `pip install fonttools brotli`).

## Credits and license

The code is under the [MIT License](LICENSE). Data and libraries keep their own licenses, listed in [ATTRIBUTION.md](ATTRIBUTION.md). Note that the Chinese asterism data is **CC BY-SA**. Posters drawn with it carry that attribution in the credit line.
