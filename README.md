# $AV — music-only prototype

Static web instrument running an original vanilla Pure Data patch through libpd-wasm. No wallet, transactions, microphone permission, or VST installation required.

## Local preview

Run `python3 build-patch.py` after editing the patch builder, then `npm start`. Open http://localhost:4173 and press Listen. Audio starts only after a user gesture. Start with a low output level.

## Hosting on GitHub Pages

Publish the `public/` directory with the included GitHub Actions workflow. In the repository's Settings → Pages, select GitHub Actions. The browser generates audio locally; the hosting service only serves static files. No secret API keys are needed.

## Automatic mix and free streaming (v2)

The instrument exposes one listening-volume slider. Melody, pad, drums, bass, space and energy follow market metrics automatically; read-only meters show their current normalized levels. Traded 5-minute USD volume controls musical energy and layer amplitudes. Activity controls density and loudness; price movement, liquidity and buy/sell balance distinguish layers. These are authored mappings with explicit fixed normalization ranges, not objective acoustic properties of a token. Snapshot-derived values fade when their data becomes stale.

Solana pools subscribe directly to public `wss://api.mainnet-beta.solana.com` via `logsSubscribe`, with `confirmed` commitment, filtered by the selected pool address. Successful pool transactions drive a rolling ten-second activity estimate and immediate melodic excitations. Pool transactions are not decoded swaps, trade size or buy/sell direction. Signatures are deduplicated; disconnects reconnect with exponential backoff. Public endpoints can block or throttle browser connections. No API key or separate server is required for this prototype; public RPC availability is not guaranteed. Stream state is explicit, and activity falls back to snapshots when disconnected. Price and trade-volume information still comes from DEX Screener. Production trade-level sonification needs protocol-specific swap decoding and a reliable RPC connection.

References: https://solana.com/docs/rpc/websocket/logssubscribe and https://solana.com/docs/rpc

## Data

DEX Screener search resolves exact base-token contract matches across indexed chains and selects the highest USD liquidity pool. Polls every 5 seconds; snapshots are aggregates, not a trade stream. Missing markets show an error. Demo mode is explicitly synthetic. Absolute 5-minute price change is used as a motion proxy, not statistically measured volatility. Snapshot activity derives from 5-minute trade counts; buy/sell balance from those counts; liquidity shapes resonance filtering. A contract-derived seed sets register and note-generation probabilities. Each instrument has a four-phase recurring motif.

## Engine

`public/patches/market.pd` contains sine-based melodic excitation with filtered feedback delay, two-tone sustained atmosphere, enveloped bass, synthesized kick, noise snare and hats. UI and market mapping send Pd messages; a browser timer drives sequencing. This is an original starting instrument, not a reconstruction of either reference. Browser timer jitter and suspended background tabs can affect rhythm. Deterministic replay is not implemented.

Recording saves browser-supported audio and a separate JSON log of snapshots and controls. Download links remain until page refresh. The log is useful provenance, not a guaranteed bit-identical replay format.

## Runtime attribution

Vendored `libpd-wasm` browser artifacts from https://github.com/hyrfilm/libpd-wasm, commit recorded in `public/vendor/SOURCE.txt`. Preserve its LICENSE.txt when distributing. PlugData is an optional desktop Pd/plugin host; it is not required for this web version.

Computer Use could not connect to its native service during creation, so local Pd UI interaction was unavailable. Browser/audio behavior has not been manually verified.
