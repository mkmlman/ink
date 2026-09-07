# ink

Standalone WebGL fluid ink background with tunable dials.

> **Live demo:** https://mkmlman.github.io/ink/

Move the pointer (or drag on touch) to paint. Use the **Burst** and **Pause**
controls, or `Space` to burst and `P` to pause. Dial changes persist locally in
the browser.

## Files

- `fluid.js` — WebGL fluid simulation with a WebGL1 fallback (auto-starts on `<canvas id="fluid">`)
- `dials.js` — 10-slider panel wired to `#fluid-dialers` (persists to `localStorage ink:fluid-dials-v1`)
- `ink.css` — full-bleed canvas + responsive control dock
- `LDR_LLL1_0.png` — dithering texture
- `index.html` — minimal black demo

## Quick embed (classic)

```html
<link rel="stylesheet" href="ink.css">
<canvas class="fluid-canvas" id="fluid"></canvas>
<!-- optional panel; copy the #fluid-dialers block from index.html -->
<script src="fluid.js" defer></script>
<script src="dials.js" defer></script>
```

ESM side-effect import also works (same globals, no named exports):

```js
import 'https://unpkg.com/ink@latest/fluid.js';
import 'https://unpkg.com/ink@latest/dials.js';
```

Keep `fluid.js` before `dials.js`. The dithering LUT (`LDR_LLL1_0.png`) resolves
relative to `fluid.js` itself, so CDN embeds work — no need to host it next to
the page. Override when needed:

```html
<canvas class="fluid-canvas" id="fluid" data-texture="/assets/LDR_LLL1_0.png"></canvas>
<script>window.inkDitherUrl = '/assets/LDR_LLL1_0.png';</script>
```

If the texture 404s (or CORS blocks it), ink warns and continues without
dithering — the sim still runs.

## API

Primary global is `window.inkFluid`.

```js
inkFluid.show();
inkFluid.hide();
inkFluid.splat(0.5, 0.5, dx, dy); // normalized coords + velocity delta
inkFluid.burst(8);                // random splats
inkFluid.pause();
inkFluid.resume();
inkFluid.setConfig('CURL', 6);
inkFluid.setConfig({ BRIGHTNESS: 2.5, BLOOM_INTENSITY: 0.4 });
console.log(inkFluid.config, inkFluid.paused);
```

Panel helper (`window.inkDials`):

```js
inkDials.set('bloom', 0.6);
inkDials.get('bloom');
inkDials.reset();
```

### `setConfig` keys

| Key | Default | Notes |
| --- | --- | --- |
| `SPLAT_RADIUS` | `0.40` | dial `radius` |
| `CURL` | `4` | dial `curl` (`CURL_STRENGTH` aliases it) |
| `DENSITY_SLIDER` | via dial | maps to `DENSITY_DISSIPATION = 1 - v*0.02` |
| `PRESSURE_DISSIPATION` | `0.08` | also derives `PRESSURE` |
| `VELOCITY_DISSIPATION` | `0` | dial `velocity` |
| `PRESSURE_ITERATIONS` | `16` | dial `iterations` |
| `SPLAT_FORCE` | `12000` | dial `splatForce` |
| `BRIGHTNESS` | `3` | dial `brightness` |
| `IDLE_INJECTION` | `0` | dial `idle`; random ambient splats when > 0 |
| `BLOOM_INTENSITY` | `0.30` | dial `bloom` |
| `BLOOM` / `SHADING` / `SUNRAYS` | `true` | toggle keywords |
| `SIM_RESOLUTION` / `DYE_RESOLUTION` | `256` / `1024` (`512` on mobile) | re-inits buffers |
| `BACK_COLOR` | `{r:10,g:10,b:10}` | follows `data-theme="light"` when set |

## Behavior notes

- DPR is capped (`1.5x` mobile, `2x` desktop); loop skips all GL work when the
  tab is hidden or the canvas is hidden.
- `prefers-reduced-motion` hides the canvas *and* the dial panel, pauses GL
  work, and follows live changes.
- Pointer / touch handlers ignore `#fluid-dialers`, topbar, footer, and form controls, so dragging a slider never paints behind it and the mobile control dock keeps native scrolling.
- Missing WebGL hides the canvas with a console warning instead of throwing;
  a lost GL context pauses, and restores via reload.

## Troubleshooting

- **Black page / no ink:** WebGL is disabled or blocked — check the console for
  the `ink:` warning. Corporate policies and some privacy extensions disable it.
- **Opened via `file://`:** serve over http(s) (`npm run dev`) — the dithering
  texture won't load from `file://`, and ES module imports forbid it entirely.
- **Dials don't persist:** private browsing blocks `localStorage` — ink falls
  back to defaults silently.

## Dev

```sh
npm run dev   # python3 -m http.server 8080
npm run check # node --check fluid.js + dials.js
```

MIT
