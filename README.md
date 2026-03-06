# CS2 Map Icons

<div align="center">

[![Update Status](https://github.com/MurkyYT/cs2-map-icons/actions/workflows/update-icons.yml/badge.svg)](https://github.com/MurkyYT/cs2-map-icons/actions/workflows/update-icons.yml)
[![Last Update](https://img.shields.io/github/last-commit/MurkyYT/cs2-map-icons/main?path=static/manifest.txt&label=Last%20Update&color=brightgreen&style=flat-square)](https://github.com/MurkyYT/cs2-map-icons/commits/main)
[![Map Count](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/available.json&query=$.count&label=Maps&color=orange&style=flat-square)](data/available.json)

**Automatically updated Counter-Strike 2 map icons including radar overheads and in-game thumbnails,  
scraped daily from the official game depot.**

</div>


## Available Assets

| Type | Path pattern | Notes |
|------|-------------|-------|
| **Icon** | `/images/<map>.png` | Always available |
| **Radar** | `/images/radars/<map>_radar_psd.png` | Multi-level maps include `_lower_` variant |
| **Thumbnail** | `/images/thumbs/<map>_N_png.png` | Multiple screenshots per map |

## Usage

### Direct URLs

**Icons**
```
https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_dust2.png
https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/de_mirage.png
```

**Radars**
```
https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/radars/de_dust2_radar_psd.png
https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/radars/de_nuke_lower_radar_psd.png
```

**Thumbnails**
```
https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_dust2_1_png.png
https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs/de_inferno_3_png.png
```


## Full Map List

Auto-updated list of all maps ever scraped:

[![CSV](https://img.shields.io/badge/CSV-view-lightgrey?style=flat-square)](data/available.csv)
[![JSON](https://img.shields.io/badge/JSON-view-lightgrey?style=flat-square)](data/available.json)
[![MD](https://img.shields.io/badge/Markdown-view-lightgrey?style=flat-square)](data/available.md)


## License

Map icons are property of **Valve Corporation**. This repository simply provides automated access to publicly available resources.


## Contributing

Found a bug or want to improve the scraper? Pull requests are welcome!

---

<div align="center">

If you find this useful, please **star the repo!**

</div>
