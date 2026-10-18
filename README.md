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
- **Type:** GNU Unifont

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
npm run build:site
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
- `scripts/` — static shell and asset build helpers
- `src/site/` — shared header and footer templates
- `cloudflare/` — optional InsightX worker and the market backend foundation
- `supabase/` — market observation database migration

The new market backend uses server-side GeckoTerminal/CoinGecko access and
Supabase storage, with optional QuickNode block context. See
[its setup guide](cloudflare/market/README.md). It can start with free development
access; NFT minting and permanent milestone verification are subsequent stages.

Third-party license and attribution notices remain with their corresponding
assets and libraries.

## Site architecture

All pages share the same navigation, typography and interaction rules. Header and
footer HTML is generated before deployment, so controls are present at startup.
See [site architecture](docs/site-architecture.md) for component ownership and
build details.

## Live marketplace captures

Marketplace artwork is copied from the same live player, using received market and individual-holder data. Paused, replay, test, empty and simulated seed frames are excluded. A single silent player refreshes visible cards; real captures keep their render timestamp and exact network/address. Missing data stays pending instead of receiving substitute artwork.

`node scripts/capture-marketplace-live.mjs --limit 5` gathers shared captures from the actual player. Playwright must be installed or supplied through `UPIC_PLAYWRIGHT_MODULE`. `--all` processes the supported catalogue identities with bounded concurrency; unsupported identities and provider failures are reported without inventing frames.

The AI investigator selects source-linked project, market and contract facts. Its public evidence cache lasts 30 minutes. If AI selection is unavailable, the interface labels the unchanged source facts as public evidence. This is not a social investigation or a contract security audit.
