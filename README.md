# AV

UPIC is a live audiovisual instrument for cryptocurrency markets. Market activity
drives musical timing and visual motion; price direction, liquidity, market cap
and holder data shape the sound and image.

Live site: https://nchrl01.github.io/rhosnei.gr/

## Technology

- **Audio:** Web Audio API, Pure Data, libpd-wasm, ENVION and MusicRNN
- **Visuals:** WebGL, Canvas, React and Motion
- **Market connections:** JSON-RPC, WebSocket, REST and CCXT
- **Charts:** Lightweight Charts
- **Type:** NDS12

The audiovisual lab uses the same audio and visual engines as the main player.
Its patch cables route shared market signals into both engines. Lab market
values are simulated; the live player uses received market data.

## Run locally

Requires Node.js and npm.

```sh
npm start
```

Open http://localhost:4173 and press **Listen**. Audio playback starts after
that user action so the browser can enable sound.

## Build assets

```sh
npm run build:ui
npm run build:ccxt
python3 build-envion.py
python3 build-orchestra.py
```

The website is a static application in `public/`. GitHub Pages publishes that
folder from the `main` branch. Browser code and assets are public because the
browser must download them to run the site.

## Main folders

- `public/` — website, audio engines, visuals and browser assets
- `public/patches/` — Pure Data patches and ENVION
- `native/` — standalone ENVION and browser MusicRNN build sources
- `scripts/` — asset build helpers
- `cloudflare/` — optional InsightX data worker

Third-party license and attribution notices remain with their corresponding
assets and libraries.
