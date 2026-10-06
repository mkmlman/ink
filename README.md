# ink

An interactive fluid ink canvas to play with, shape, and explore. Move through the color, experiment with the brush and flow, and watch the motion evolve.

**Play:** [open the live canvas](https://mkmlman.github.io/ink/). **For developers:** [embed Ink in your site](#embed-in-your-site). It runs in the browser, needs no backend, and is MIT licensed.

Move your cursor over the canvas to paint; no click or drag is needed. On touchscreens, drag with one finger. Use the existing controls to tune the brush, flow, and glow; dial changes persist in this browser.

## Files

- `src/fluid.js` — WebGL fluid simulation with a WebGL1 fallback (auto-starts on `<canvas id="fluid">`)
- `src/dials.js` — 10-slider panel wired to `#fluid-dialers` (persists to `localStorage ink:fluid-dials-v1`)
- `src/angry-dials.js` — optional slingshot-thumb play layer for the dials (keyboard path untouched)
- `src/about.js` — progress bar, reveal-on-scroll, glow demo, and TOC scrollspy for `about.html`
- `src/ink.css` — full-bleed canvas + responsive control dock
- `src/bloom-dither.png` — dithering texture
- `src/og-image.png` — link-preview image (1200×630 droplet mark)
- `src/ink-icon.png`, `src/apple-touch-icon.png` — PNG favicon fallback + touch icon
- `src/fonts/DepartureMono-Regular.woff2` — self-hosted mono font (SIL OFL 1.1, see `src/fonts/OFL.txt`)
- `index.html` — demo page (published to GitHub Pages from the repo root)
- `about.html` — “How it works” explainer linked from the demo footer
- `404.html`, `robots.txt` — Pages fallback and crawler rules

## Embed in your site

Add the stylesheet, canvas, and two scripts. No build step or server component is required; the simulation runs on the page in the visitor's browser.

```html
<link rel="stylesheet" href="https://mkmlman.github.io/ink/src/ink.css">
<canvas class="fluid-canvas" id="fluid"></canvas>
<!-- optional panel; copy the #fluid-dialers block from index.html -->
<script src="https://mkmlman.github.io/ink/src/fluid.js" defer></script>
<script src="https://mkmlman.github.io/ink/src/dials.js" defer></script>
```

ESM side-effect import also works (same globals, no named exports):

```js
import 'https://mkmlman.github.io/ink/src/fluid.js';
import 'https://mkmlman.github.io/ink/src/dials.js';
```

Keep `fluid.js` before `dials.js`. The dithering LUT (`bloom-dither.png`) resolves
relative to `fluid.js` itself, so CDN embeds work — no need to host it next to
the page. Override when needed:

```html
<canvas class="fluid-canvas" id="fluid" data-texture="/assets/bloom-dither.png"></canvas>
<script>window.inkDitherUrl = '/assets/bloom-dither.png';</script>
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
inkFluid.clear();                 // clears dye and motion
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
| `CURL` | `4` | dial `curl` |
| `DENSITY_SLIDER` | `4.5` | maps to `DENSITY_DISSIPATION = 2.8 - v*0.53` |
| `PRESSURE_DISSIPATION` | `0.08` | also derives `PRESSURE` |
| `VELOCITY_DISSIPATION` | `0` | dial `velocity` × 2.5 |
| `PRESSURE_ITERATIONS` | `16` | dial `iterations` |
| `SPLAT_FORCE` | `12000` | dial `splatForce` |
| `BRIGHTNESS` | `3` | dial `brightness` |
| `IDLE_INJECTION` | `0.25` | dial `idle`; occasional ambient splats when > 0 |
| `BLOOM_INTENSITY` | `0.30` | dial `bloom` |
| `BLOOM` / `SHADING` / `SUNRAYS` | `true` | toggle keywords |
| `SIM_RESOLUTION` / `DYE_RESOLUTION` | `256` / `1024` (`512` on mobile) | re-inits buffers |
| `BACK_COLOR` | `{r:10,g:10,b:10}` | dark paper |

## Behavior notes

- DPR is capped (`1.5x` mobile, `2x` desktop); loop skips all GL work when the
  tab is hidden or the canvas is hidden.
- `prefers-reduced-motion` hides the canvas *and* the dial panel, pauses GL
  work, and follows live changes.
- Cursor movement paints without a click. Touch input paints while dragging.
  Entering the page or returning from outside it resets the stroke origin, so
  it won't draw a streak from the previous position. Pointer / touch handlers
  ignore `#fluid-dialers`, topbar, footer, and form controls, so adjusting a
  slider never paints behind it and the mobile control dock keeps native
  scrolling.
- Pause freezes the current image and ignores cursor movement and bursts until
  the simulation resumes. Use Clear (or `R`) to remove dye and motion.
- The control panel includes expressive presets and a persisted Low power mode,
  which lowers simulation resolution and disables bloom/sunrays to save battery.
- Ambient motion defaults to a subtle idle trickle; set it to `0` for a still canvas.
- `Space` bursts when focus is outside controls; `P` toggles pause except while typing.
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
npm run check # node --check fluid.js + dials.js + angry-dials.js + about.js
```

MIT
