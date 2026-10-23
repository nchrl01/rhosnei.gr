# AV

UPIC is a live audiovisual instrument for cryptocurrency markets. Market activity
drives musical timing and visual motion; price direction, liquidity, market cap
and holder data shape the sound and image.

Live site: https://upic-art.github.io/rhosnei.gr/

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

This starts the live static instrument at http://localhost:4173. Press **Listen**. Audio playback starts after
that user action so the browser can enable sound.

The separate collection platform remains available with `npm run start:platform`
(or its existing `npm run dev:web` command). Its API starts with `npm run dev:api`.
Those platform commands and workspace build scripts are preserved.

See [main and collection integration](docs/main-platform-integration.md) for the
current boundary, preserved platform work and cleanup inventory.

## Build assets

```sh
npm run build:site
npm run build:ui
npm run build:ccxt
python3 build-envion.py
python3 build-orchestra.py
```

The website is a static application in `apps/web/public/`. GitHub Pages publishes that
folder from the `main` branch. Browser code and assets are public because the
browser must download them to run the site.

## Main folders

- `apps/web/public/` — website, audio engines, visuals and browser assets
- `apps/web/public/patches/` — Pure Data patches and ENVION
- `native/` — standalone ENVION and browser MusicRNN build sources
- `scripts/` — static shell and asset build helpers
- `apps/web/legacy/site/` — shared header and footer templates
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

Marketplace artwork is copied from the actual live player using received market and individual-holder data. Paused, replay, test, empty and simulated seed frames are excluded. Captures keep their render timestamp and exact network/address. Missing data remains pending.

Only identities in the bundled catalogue can be stored in Cloudflare. The shared service retains one latest WebP per identity; older results cannot replace newer frames. The gallery reads shared metadata on opening, every minute while visible, and when it regains focus. Visitor browsers do not archive captures or run a background capture player. Legacy browser capture storage is deleted on loading the updated site.

The `Refresh shared live captures` GitHub workflow runs hourly with 40 bounded attempts and two isolated players. Scheduled and ordinary manual runs reserve up to half the batch for old captures and use remaining slots for coins without captures. Manual runs default to 100 attempts. The top-1,000 mode covers four consecutive rank groups, tries alternate listed networks after a failed capture, and preserves coverage reports in the workflow. Each group uses two players; groups run sequentially. Currently 819 of the top 1,000 have compatible holder sources; the other 181 remain pending genuine source support. Publishing uses a short-lived GitHub Actions identity restricted to this repository, workflow and main branch; no public upload key is embedded in the site. Provider failures retain the previous capture and its original timestamp. Refresh is periodic, not guaranteed real time for every coin.

`node scripts/capture-marketplace-live.mjs --limit 5` creates development artifacts in a temporary directory. Playwright must be installed or supplied through `UPIC_PLAYWRIGHT_MODULE`. `--publish` requires the workflow identity. Native assets without issued-token identifiers and networks without an observed-holder source are reported without inventing frames. Current source coverage is 820 catalogue coins across 1,809 supported identities; supported does not guarantee provider availability.

About this coin shows a compact source-provided project description matched to the exact token identity. AI can select background sentences; it cannot invent the displayed wording. The description cache lasts 30 minutes. Missing project evidence hides the section; market-stat cards are not used as a substitute. Source claims are not independently verified.

Capture reliability checks run before every capture workflow. They cover sparse
observed-holder artwork, blank frames, stale or mismatched identities, transport
state and changes while encoding. Cloud metadata, publisher authentication and
publication retry temporary network errors and HTTP 408/425/429/5xx up to three
times with bounded delays. Authorization/validation errors remain visible failures;
previous captures are retained. Capture reports include the player's rejection
reason rather than only a timeout. External data availability is still required.

## Collectible contract links

Every enabled collectible opens an exact contract/token identifier plus network.
Native coins use verified wrapped/bridged counterparts where available, with the
actual counterpart name and network displayed. Unverified targets remain pending;
there is no native-pair fallback. Previews match the selected contract exactly.
See [routing and capture integration](docs/collectible-contract-routing.md).
