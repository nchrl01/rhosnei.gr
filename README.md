# $AV — music-only prototype

Static web instrument running an original vanilla Pure Data patch through libpd-wasm. No wallet, transactions, microphone permission, or VST installation required.

## Local preview

Run `python3 build-patch.py` after editing the patch builder, then `npm start`. Open http://localhost:4173 and press Listen. Audio starts only after a user gesture. Start with a low output level.

## Hosting on GitHub Pages

Publish the `public/` directory with the included GitHub Actions workflow. In the repository's Settings → Pages, select GitHub Actions. The browser generates audio locally; the hosting service only serves static files. No secret API keys are needed.

## Responsiveness and timing indicators (v4)

Default chart view now shows every received price observation as a tick trace; observed ten-second candles remain an option. The old candle interval grouped observations but did not delay incoming updates. Telemetry shows the age and count of received trades, and timestamp-to-receipt delay where available. Native EVM block timestamps are fetched asynchronously after the trade has already been emitted; block-to-receipt values are approximate and include block timestamp granularity and local clock differences. They are not measured audio latency. Polled trades use the provider's trade timestamp. Unknown timing is shown explicitly.

Immediate note accents now use the logarithmic change between received execution prices rather than the generative sequencer's step index. Continuous layers still express rolling market behavior. This does not make polled or cached data into a streaming source; exact-token diagnosis is needed to identify the active feed and its delay.

## Multi-chain chart and trades (v3)

The UI discovers networks and pools for an exact token identifier from DEX Screener search results. It supports chain-specific identifiers beyond EVM/Solana address shapes and matches either side of a pair. Quote-side selections invert the displayed pair price and buy/sell counts; their five-minute change is marked unavailable because it cannot be inferred from the original base-token change. Results remain provider-limited; this is not an exhaustive registry of all blockchains or tokens. Users choose the network and pool, which remain pinned during polling.

The session chart groups received observations into ten-second candles. No historical candles are fabricated or loaded. The graph is a view of data received by this browser, not complete exchange OHLCV history. It shares trade observations with the music. Snapshot-only sources plot snapshots. Rendering is coalesced through animation frames; chart samples are bounded. EVM reorganization removals remove matching observations, though already-played sound cannot be reversed.

Native EVM swap adapters: Ethereum, Base, BNB Smart Chain, Arbitrum One, Polygon, Optimism and Avalanche C-Chain, using free PublicNode WebSockets and standard JSON-RPC. The adapter checks pool token0/token1 and decimals before subscribing to standard V2/V3 Swap topics. It decodes amounts, derives executed quote-per-base price, base size, and buy/sell direction. Prices in USD use the current snapshot quote conversion and are estimates. Nonstandard pool ABIs (including V4 pool managers) require another decoder. Unsupported pools keep the fallback feeds.

Broad trade fallback: GeckoTerminal's public REST pool-trades API is polled every five seconds with a small network-ID alias map; otherwise the discovered chain ID is tried directly. It provides observed trade price, USD volume, and direction for pools it indexes across chains. Its initial response is a baseline; old trades are not sounded. HTTP 429 backs off, 404 stops the unavailable feed, and missing token-address/amount fields are not guessed. This route is polling, not streaming, and provider caching/indexing adds delay. Unknown or unindexed networks/pools remain snapshot-only. No API key is embedded and no additional server is required. The fallback is cancelled when native swaps begin and restarted after native disconnection.

Events are deduplicated within a feed. Cross-feed handover uses transaction signatures to avoid replaying the same transaction; this may omit additional swaps within that transaction during handover. Reconnection gaps are not comprehensively backfilled. Trade metrics use thirty seconds of received observations, pool activity uses ten seconds, snapshot aggregates use five minutes. Activity and traded USD volume are normalized as per-second rates before setting musical levels. These are partial observed windows during warm-up. Snapshot-derived liquidity and USD conversion become stale after failed updates, causing levels to fade. High-rate events are coalesced to a maximum of 25 immediate melodic excitations per second while all received observations still affect activity metrics.

Sources:

- https://publicnode.com/
- https://github.com/Uniswap/v2-core/blob/master/contracts/UniswapV2Pair.sol
- https://github.com/Uniswap/v3-core/blob/main/contracts/interfaces/pool/IUniswapV3PoolEvents.sol
- https://api.geckoterminal.com/docs/index.html
- https://docs.dexscreener.com/api/reference

This update has been reviewed by reading the implementation. No automated tests or browser playback verification were performed.

## Automatic mix and free streaming (v2)

The instrument exposes one listening-volume slider. Melody, pad, drums, bass, space and energy follow market metrics automatically; read-only meters show their current normalized levels. Traded 5-minute USD volume controls musical energy and layer amplitudes. Activity controls density and loudness; price movement, liquidity and buy/sell balance distinguish layers. These are authored mappings with explicit fixed normalization ranges, not objective acoustic properties of a token. Snapshot-derived values fade when their data becomes stale.

Solana pools subscribe directly to free `wss://solana-rpc.publicnode.com` via `logsSubscribe`, with `confirmed` commitment, filtered by the selected pool address. Successful pool transactions drive a rolling ten-second activity estimate and immediate melodic excitations. Pool transactions are not decoded swaps, trade size or buy/sell direction. Signatures are deduplicated; disconnects reconnect with exponential backoff. A slot subscription provides a heartbeat; an unresponsive connection reconnects after 30 seconds. Errors retain their reason and display the retry delay. Public endpoints can block or throttle browser connections. No API key or separate server is required for this prototype; public RPC availability is not guaranteed. Stream state is explicit, and activity falls back to snapshots when disconnected. Price and trade-volume information still comes from DEX Screener. Production trade-level sonification needs protocol-specific swap decoding and a reliable RPC connection.

Origin diagnostic: the original Solana Foundation endpoint returned HTTP 403 with `Origin: https://nchrl01.github.io`, despite accepting a connection without that browser origin. PublicNode accepted the origin handshake (HTTP 101) and a separate log-subscription probe. This validates the connection path from the development machine, not every visitor's network. Provider: https://solana.publicnode.com/

References: https://solana.com/docs/rpc/websocket/logssubscribe and https://solana.com/docs/rpc

## Data

DEX Screener search resolves exact base-token contract matches across indexed chains and selects the highest USD liquidity pool. Polls every 5 seconds; snapshots are aggregates, not a trade stream. Missing markets show an error. Demo mode is explicitly synthetic. Absolute 5-minute price change is used as a motion proxy, not statistically measured volatility. Snapshot activity derives from 5-minute trade counts; buy/sell balance from those counts; liquidity shapes resonance filtering. A contract-derived seed sets register and note-generation probabilities. Each instrument has a four-phase recurring motif.

## Engine

`public/patches/market.pd` contains sine-based melodic excitation with filtered feedback delay, two-tone sustained atmosphere, enveloped bass, synthesized kick, noise snare and hats. UI and market mapping send Pd messages; a browser timer drives sequencing. This is an original starting instrument, not a reconstruction of either reference. Browser timer jitter and suspended background tabs can affect rhythm. Deterministic replay is not implemented.

Recording saves browser-supported audio and a separate JSON log of snapshots and controls. Download links remain until page refresh. The log is useful provenance, not a guaranteed bit-identical replay format.

## Runtime attribution

Vendored `libpd-wasm` browser artifacts from https://github.com/hyrfilm/libpd-wasm, commit recorded in `public/vendor/SOURCE.txt`. Preserve its LICENSE.txt when distributing. PlugData is an optional desktop Pd/plugin host; it is not required for this web version.

Computer Use could not connect to its native service during creation, so local Pd UI interaction was unavailable. Browser/audio behavior has not been manually verified.
