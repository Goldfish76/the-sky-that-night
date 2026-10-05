# 那晚星空 · The Sky That Night

**输入日期和地点，生成那一刻头顶真实星空的海报，可直接打印。**
免费、开源，所有计算都在你的浏览器里完成，日期和地点不会被上传。

**在线使用：https://goldfish76.github.io/the-sky-that-night/**

[English](README.md)

![五种风格：敦煌古星图、邮票、林间、刺绣、孔版印刷](docs/hero.jpg)

## 特点

- **真实的天空，不是随手画的装饰图。** 星星、月亮和行星都按你给的日期、时刻和地点精确计算。
- **17 种风格**，从极简到手作，[全部在下面](#风格)。
- **两种星座体系：** 西方 88 星座，或中国传统星官（二十八宿、北斗、织女、牛郎……）。
- **天体：** 月亮的月相和亮面朝向都是对的；也会画出五颗肉眼可见的行星和银河。
- **真实的当地时间：** 浏览器自带的时区数据库会处理历史上的夏令时（包括中国 1986–1991 年实行过的夏令时）。
- **光年生日星：** 填上生日，海报会标出一颗肉眼可见的星，它离地球的距离（以光年计）约等于你那晚的年龄。那晚你看到的它的光，正是在你出生那年出发的。
- **两片星空：** 一张海报上放两片星空，比如两个人各自出生的那晚，日期和地点各不相同。
- **全球任意地点：** 离线搜索 3.4 万个城市，自动带出时区；也可以手动输入经纬度。
- **打印级导出：** PNG、PDF 或 SVG，A4 / A3，300 DPI。SVG 是全矢量的（内嵌字体），可以二次编辑，也可以直接用于激光雕刻。
- **手机壁纸：** 1290 × 2796 竖版，顶部留出锁屏时钟的位置。

## 风格

![17 种风格，同一晚纽约的星空](docs/styles-zh.jpg)

- **极简：** 极简黑、极简白。
- **复古：** 复古羊皮纸（老星图）、鎏金（装饰艺术风格）、蓝图（工程图纸，带标题栏）、邮票（带齿孔的邮票，邮戳上盖着你的日期和地点）。
- **中式：** 水墨（宣纸配朱红印章）、敦煌古星图（仿唐代敦煌星图：三色星点、二十八宿、天河画成两道线之间的带子，文字竖排）。
- **手作：** 水彩（每张海报的水彩晕染都不一样）、刺绣（绣绷、回针绣的星座连线、十字绣的标题）、孔版印刷（两种油墨、网点、略微错版）、拍立得（胶带贴着的相片，手写说明）。
- **摄影：** 银河摄影（天文摄影的质感）、林间（躺在林中空地上看天，树梢围成一圈）、城市（在高楼之间抬头看天，只有亮星透得过城市的光）。
- **屏幕：** 霓虹、终端（把海报写成一段命令行）。

树梢和楼群是按地点的经纬度生成的：同一个地点永远是同一圈树、同一片楼，被它们挡住的星星也会像真实的全天空照片一样看不见。

点海报可以直接在网页里打开同一张。

| [林间 · 优胜美地](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=en&th=forest&cu=w&o=lmbc&d=2026-08-12&t=23%3A30&lat=37.745&lon=-119.593&tz=America%2FLos_Angeles&pn=Yosemite+Valley&msg=Under+the+Perseids) | [邮票 · 里斯本](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=en&th=stamp&cu=w&o=lmbc&d=2026-07-18&t=22%3A30&lat=38.722&lon=-9.139&tz=Europe%2FLisbon&pn=Lisbon&pz=%E9%87%8C%E6%96%AF%E6%9C%AC&msg=Wish+you+were+here) | [刺绣 · 杭州](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=zh&th=embroidery&cu=w&o=lmbc&d=2026-05-20&t=21%3A00&lat=30.274&lon=120.155&tz=Asia%2FShanghai&pn=Hangzhou&pz=%E6%9D%AD%E5%B7%9E&msg=%E4%BA%94%E6%9C%88%E4%BA%8C%E5%8D%81%E6%97%A5%EF%BC%8C%E8%A5%BF%E6%B9%96%E8%BE%B9) |
|---|---|---|
| [![林间](docs/samples/forest-yosemite.jpg)](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=en&th=forest&cu=w&o=lmbc&d=2026-08-12&t=23%3A30&lat=37.745&lon=-119.593&tz=America%2FLos_Angeles&pn=Yosemite+Valley&msg=Under+the+Perseids) | [![邮票](docs/samples/stamp-lisbon.jpg)](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=en&th=stamp&cu=w&o=lmbc&d=2026-07-18&t=22%3A30&lat=38.722&lon=-9.139&tz=Europe%2FLisbon&pn=Lisbon&pz=%E9%87%8C%E6%96%AF%E6%9C%AC&msg=Wish+you+were+here) | [![刺绣](docs/samples/embroidery-hangzhou.jpg)](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=zh&th=embroidery&cu=w&o=lmbc&d=2026-05-20&t=21%3A00&lat=30.274&lon=120.155&tz=Asia%2FShanghai&pn=Hangzhou&pz=%E6%9D%AD%E5%B7%9E&msg=%E4%BA%94%E6%9C%88%E4%BA%8C%E5%8D%81%E6%97%A5%EF%BC%8C%E8%A5%BF%E6%B9%96%E8%BE%B9) |

| [敦煌古星图 · 中秋](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=zh&th=dunhuang&cu=cn&o=lnmbc&d=2026-09-25&t=21%3A00&lat=40.142&lon=94.662&tz=Asia%2FShanghai&pn=Dunhuang&pz=%E6%95%A6%E7%85%8C&msg=%E6%B5%B7%E4%B8%8A%E7%94%9F%E6%98%8E%E6%9C%88%EF%BC%8C%E5%A4%A9%E6%B6%AF%E5%85%B1%E6%AD%A4%E6%97%B6) | [城市 · 跨年夜](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=en&th=city&cu=w&o=lbsc&ti=The+Last+Night+of+2026&msg=One+minute+to+midnight&d=2026-12-31&t=23%3A59&lat=40.758&lon=-73.986&tz=America%2FNew_York&pn=New+York&pz=%E7%BA%BD%E7%BA%A6&pl=Times+Square) | [拍立得 · 巴黎](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=en&th=instant&cu=w&o=lmbc&d=2026-06-14&t=23%3A30&lat=48.857&lon=2.352&tz=Europe%2FParis&pn=Paris&pz=%E5%B7%B4%E9%BB%8E&msg=Our+first+night+in+Paris) |
|---|---|---|
| [![敦煌古星图](docs/samples/dunhuang-mid-autumn.jpg)](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=zh&th=dunhuang&cu=cn&o=lnmbc&d=2026-09-25&t=21%3A00&lat=40.142&lon=94.662&tz=Asia%2FShanghai&pn=Dunhuang&pz=%E6%95%A6%E7%85%8C&msg=%E6%B5%B7%E4%B8%8A%E7%94%9F%E6%98%8E%E6%9C%88%EF%BC%8C%E5%A4%A9%E6%B6%AF%E5%85%B1%E6%AD%A4%E6%97%B6) | [![城市](docs/samples/city-new-years-eve.jpg)](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=en&th=city&cu=w&o=lbsc&ti=The+Last+Night+of+2026&msg=One+minute+to+midnight&d=2026-12-31&t=23%3A59&lat=40.758&lon=-73.986&tz=America%2FNew_York&pn=New+York&pz=%E7%BA%BD%E7%BA%A6&pl=Times+Square) | [![拍立得](docs/samples/instant-paris.jpg)](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=en&th=instant&cu=w&o=lmbc&d=2026-06-14&t=23%3A30&lat=48.857&lon=2.352&tz=Europe%2FParis&pn=Paris&pz=%E5%B7%B4%E9%BB%8E&msg=Our+first+night+in+Paris) |

> 敦煌那张是 2026 年中秋（9 月 25 日）晚上九点的敦煌：满月当空，用的是中国传统星官。

| 光年生日星 | 两片星空（羊皮纸） | 两片星空（水墨） |
|---|---|---|
| ![光年生日星](docs/samples/birthday-star-ink.jpg) | ![两片星空](docs/samples/two-skies-parchment.jpg) | ![两片星空 水墨](docs/samples/two-skies-ink.jpg) |

## 试试这些"名场面"之夜

点链接会直接打开设置好的星空。

| [七夕 · 北京](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=zh&th=ink&cu=cn&o=lnmbsc&d=2026-08-19&t=21%3A00&lat=39.904&lon=116.407&tz=Asia%2FShanghai&pn=Beijing&pz=%E5%8C%97%E4%BA%AC&ti=%E9%82%A3%E6%99%9A%E7%9A%84%E6%98%9F%E7%A9%BA&msg=%E8%BF%A2%E8%BF%A2%E7%89%B5%E7%89%9B%E6%98%9F%EF%BC%8C%E7%9A%8E%E7%9A%8E%E6%B2%B3%E6%B1%89%E5%A5%B3) | [登月那一刻](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=en&th=noir&cu=w&o=lmbsc&d=1969-07-20&t=21%3A56&lat=29.76&lon=-95.37&tz=America%2FChicago&pn=Houston&pz=%E4%BC%91%E6%96%AF%E6%95%A6&ti=One+Small+Step&msg=The+Moon%2C+23%C2%B0+above+Houston%2C+as+Armstrong+stepped+onto+it) | [圣雷米，1889](https://goldfish76.github.io/the-sky-that-night/#v=1&lang=en&th=parchment&cu=w&o=lnmbgsc&d=1889-06-19&t=03%3A00&lat=43.789&lon=4.832&tz=Europe%2FParis&pn=Saint-R%C3%A9my-de-Provence&ti=Saint-R%C3%A9my%2C+1889&msg=Before+dawn%2C+the+month+Van+Gogh+painted+The+Starry+Night) |
|---|---|---|
| ![2026 年七夕的北京](docs/samples/ink-beijing-qixi.jpg) | ![1969 年 7 月 20 日的休斯敦](docs/samples/famous-apollo11-houston.jpg) | ![1889 年 6 月的圣雷米](docs/samples/famous-starry-night-1889.jpg) |
| 2026 年七夕晚上九点的北京：织女星和牛郎星分列银河两岸，月亮正好是上弦月。 | 1969 年 7 月 20 日晚 9:56 的休斯敦，阿姆斯特朗踏上月球的那一刻：月亮就挂在西边 23° 的高度。 | 梵高画《星月夜》的那个月，圣雷米黎明前的天空：画里那颗明亮的"启明星"金星，正从东方升起。 |

![手机壁纸](docs/samples/phone-wallpaper-ink.jpg)

## 本地运行

纯静态网页，不需要构建：

```bash
git clone https://github.com/Goldfish76/the-sky-that-night
cd the-sky-that-night
python -m http.server 8000
```

然后在浏览器打开 http://localhost:8000 即可。

## 有多准？

1. **星表：** 用 [d3-celestial](https://github.com/ofrohn/d3-celestial) 提供的星表，来自依巴谷（Hipparcos）星表，J2000 坐标。
2. **天顶和方位：** 用 [Astronomy Engine](https://github.com/cosinekitty/astronomy) 把你所在位置的天顶和地平线正北点换算到同一坐标系，确定星图的中心和旋转角度。
3. **投影方式：** 以天顶为中心的球极投影，相当于你躺在地上看天。圆周就是地平线，上北下南，左东右西。
4. **月亮和行星：** 按观测者所在位置计算，月相和亮面朝向都准确。
5. **校验结果：** 和独立的天文计算对比亮星的高度角与方位角，最大误差约 **0.005°**。
6. **尚未模拟大气折射：** 真实天空中，地平线附近的星星看起来会高约 0.5°。
7. **光年生日星的距离：** 来自 [HYG 数据库](https://github.com/astronexus/HYG-Database)（依巴谷视差）。较暗的星，距离误差可能有几光年。

## 做一个自己的风格

每种风格就是 [`js/themes.js`](js/themes.js) 里的一个对象：颜色、字体，以及按名字挑选的效果（纸张质感、星点形状、边框、文字版式）。效果的实现在 [`js/decor.js`](js/decor.js)、[`js/layouts.js`](js/layouts.js) 和 [`js/horizon.js`](js/horizon.js)。复制一个主题、改一改、把它的 id 加进 `THEME_ORDER`，再用 `python -m http.server` 打开就能看到。欢迎提交新风格的 PR。

## 重新生成数据

运行 `python tools/build_data.py`，会下载公开数据源，重新生成 `data/` 里的星名、生日星距离、全球城市和二十八宿文件。
运行 `python tools/build_fonts.py`（需要先 `pip install fonttools brotli`），会重新生成 `fonts/` 里的自托管字体。

## 致谢与许可

代码采用 [MIT 许可证](LICENSE)。数据、第三方库和字体各有许可，见 [ATTRIBUTION.md](ATTRIBUTION.md)。

其中中国星官数据来自 Stellarium，采用 **CC BY-SA** 许可。使用中国星官的海报会在底部署名中自动注明出处。
