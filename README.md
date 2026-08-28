# ink

Standalone WebGL fluid ink — extracted from [mkmlman/ink](https://github.com/mkmlman/ink).

> **Live demo:** https://mkmlman.github.io/ink/

## Files
- `fluid.js` — WebGL2 fluid simulation (`SIM 256`, `CURL 4`, `BRIGHTNESS 3`, `IDLE 0`)
- `dials.js` — 10-slider panel (`radius/curl/density/pressureDiss/velocity/iterations/splatForce/brightness/idle/bloom`) + `localStorage ink:fluid-dials-v1`
- `LDR_LLL1_0.png` — dithering texture
- `ink.css` — right fixed `176px` slider column, `Host Mono` style, `28px` native range hit-area
- `index.html` — minimal black demo

## Usage
```html
<link rel="stylesheet" href="ink.css">
<canvas class="fluid-canvas" id="fluid"></canvas>
<div class="fluid-dialers" id="fluid-dialers">…</div>
<script src="fluid.js"></script>
<script src="dials.js"></script>
```
Default `fluid` visible; set `localStorage ink:background` to `dappled|fluid|off`.

## Dev
```sh
python3 -m http.server 8080
```
MIT
