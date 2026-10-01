# $AV — music-only prototype

Static web instrument running an original vanilla Pure Data patch through libpd-wasm. No wallet, transactions, microphone permission, or VST installation required.

## Local preview

Run `python3 build-patch.py` after editing the patch builder, then `npm start`. Open http://localhost:4173 and press Listen. Audio starts only after a user gesture. Start with a low output level.

## Hosting on GitHub Pages

Publish the `public/` directory with the included GitHub Actions workflow. In the repository's Settings → Pages, select GitHub Actions. The browser generates audio locally; the hosting service only serves static files. No secret API keys are needed.

## Robinhood v4 direct RPC and chart timezone (v8)

The token `0x87ec194b106f7a6a3bf8eb7cdd6cac0f5e9c5520` resolves to Robin Hood (HOOD) on Robinhood Chain. The selected high-liquidity Uniswap market is the 32-byte v4 pool identifier `0xa3fb3aef3524f8bf3a50024b6baa1d2cdca82c570952230929fcdb4cc458be67`. Prior adapters handled seven chains' V2/V3 pools and could not subscribe to this market. Indexed fallback did not establish real-time coverage here.

`v4.js` adds Robinhood Chain direct HTTP RPC polling, using its documented public RPC, chain ID 4663 and Uniswap's deployed PoolManager/StateView. Startup checks the chain ID and verifies the pool's Initialize event currencies before reading decimals (native ETH uses 18). Initialize lookback is bounded to eight queries of up to ten million blocks. StateView supplies the current on-chain pool price immediately; startup does not sound historical swaps. New Swap logs are filtered by both manager and pool ID, decoded for amount/direction and Q64.96 post-swap price, and sent to the chart/music. The v4 caller-delta sign convention is distinct from V2/V3. USD conversion and liquidity still use market snapshots.

The adapter checks the head and logs every two seconds after each successful poll, plus network time. It catches up in chunks of up to 10,000 blocks, overlaps 64 blocks for late log availability and deduplicates by transaction hash/log index. Block timestamps arrive asynchronously for telemetry and chart placement. Quiet periods query pool state about every ten seconds; these are explicit state observations, not manufactured trades, and never increase the trade count or trigger immediate trade accents. Failures back off and retain indexed fallback. This is direct chain polling, not a WebSocket stream, and provides no guaranteed end-to-end latency. Reorganization deletions are not comprehensively reconciled by the HTTP route; already-played audio cannot be reversed.

Chart tick labels and crosshair timestamps now both use the browser's local timezone, displayed below the chart. The previous library defaults used UTC for axis labels while tooltip text used local time. No evidence established an exact two-hour transport delay; this mismatch could look like a fixed-hour lag independently of real source staleness.

Read-only provider diagnostics returned: the official chain head; a matching pool Initialize event; valid StateView price; a real six-word v4 Swap log for this token; and 52 recent matching chain logs. The direct RPC returned 200 and wildcard CORS with AV's origin. The latest sampled chain swap was later than the latest sampled GeckoTerminal trade. These diagnostics check provider data, not the deployed browser adapter. No automated tests were added/run, and browser/audio verification remains unavailable.

References: https://docs.robinhood.com/chain/connecting/ and https://developers.uniswap.org/docs/protocols/v4/deployments and https://github.com/Uniswap/v4-core/blob/main/src/interfaces/IPoolManager.sol.

## Direct Orca swaps and update visibility (v7)

The supplied PSOL token `pSo1f9nQXWgXibFtKf7NWYxb5enAM4qfP6UJSiXRQfL` resolves to Phantom Staked SOL. Its highest-liquidity discovery result is the PSOL/SOL Orca Whirlpool `3XLkRVg69AgwKAbnSjJpm3PB4QgVeXFEjiXfw5shWMBT`. The former Solana adapter observed transaction activity without decoding prices; its chart still depended on cached polling.

`orca.js` now verifies the pool owner, 653-byte Whirlpool layout, account discriminator, mint addresses and parsed mint decimals via public Solana RPC. It subscribes to confirmed pool logs and decodes Orca's 121-byte Traded events only while Orca is the active program invocation and the embedded pool address matches. Swap amounts, direction and the post-swap Q64.64 square-root price feed the app directly, without requesting each transaction or waiting for REST trade polling. Multiple swaps within a transaction retain their log indexes. Amounts use the reported event amounts; prices/volumes in USD use snapshot quote conversion. Native event timestamps are receipt times; there is no measured end-to-end latency for this adapter. Unsupported Orca layouts retain fallback rather than guessed decoding. Other Solana DEXes still need their own decoders.

The default chart now opens on the latest one-minute candles. Origin history loads separately and still sets the music's historical reference. Chart telemetry shows the most recently received price, age and observation count, including explicit snapshot/demo source labels. Prices display greater precision so small PSOL changes remain visible. Direct-route errors are visible alongside the fallback feed.

GeckoTerminal's current free API docs state a one-minute response cache and an approximate ten-requests-per-minute limit: https://api.geckoterminal.com/docs/index.html. History and trade polling now share a request queue with at least eight seconds between requests; cancelled requests leave the queue. HTTP trade polling remains cached and must not be described as real-time streaming. Older sections below describing five-second trade polling refer to previous versions; market snapshot polling still uses five seconds.

Read-only provider diagnostics: the pool account owner/layout and both nine-decimal token mints matched; a real confirmed transaction contained the expected 121-byte Traded event; metadata HTTP requests returned 200 with AV's origin and CORS support; the WebSocket handshake accepted that origin with HTTP 101. A separate Node subscription inspection received no events during its observation window, so live event delivery through the deployed adapter is not verified. No automated implementation tests were added or run. The browser plugin reported no available browser, preventing browser inspection and audio audition.

Sources: Orca account and event definitions at https://github.com/orca-so/whirlpools/tree/main/programs/whirlpool/src and Solana logsSubscribe at https://solana.com/docs/rpc/websocket/logssubscribe.

## Standard chart controls (v6)

TradingView Lightweight Charts 5.0.9 now supplies the chart UI, served from a local vendored ES module with its Apache 2.0 license and attribution notices. Candles are the default. Controls include 1m, 5m, 15m, 1h, 4h and 1d candles; closing-price line; crosshair OHLC and volume readings; mouse/touch zoom and pan; explicit zoom buttons; linear/log price scales; Fit history and Latest. Auto origin retains the age-based historical resolution. Selecting a timeframe fetches matching provider OHLCV, up to three pages, and never subdivides coarse historical candles into invented finer bars. Coverage messages stay visible. The chart timeframe does not change the music's origin baseline.

Incoming observations update the current candle; reorganization removals rebuild affected observations. Provider trade timestamps locate polled trades; native swaps first use receipt time and are relocated when an approximate block timestamp arrives. Historical volume is provider OHLCV. A candle receiving live observations shows only received swap volume, labelled partial, to avoid counting provider volume twice. Snapshots have unknown volume. Live candles are not a complete exchange feed. Time axes use the library's trading-bar spacing, so missing periods are not proportional calendar gaps; coverage dates remain the reference for missing history.

Chart data is bounded by the history pagination limit and 3,600 live observations. Browse/pan position is retained during updates; Fit history restores the full loaded range. This adds standard interaction but does not add TradingView drawing tools, token coverage or a faster market feed. No tests or browser verification were run for this update.

## Historical market context (v5)

The chart opens in Origin context and appends incoming observations to available GeckoTerminal OHLC history for the selected pool. Live detail remains selectable. First known market creation is the earliest pool creation date in the discovered results on the selected chain; those results are not exhaustive, and this is not a verified token mint or launch date. Earliest available price is shown separately. Gaps before available history remain empty.

Readings show current price relative to the earliest available candle open and to the highest loaded historical price. The instrument's melodic register uses the same historical open: a bounded offset of `round(12 * tanh(log(current / firstOpen)))` semitones. Immediate accents and layer activity retain their live market inputs. Partial history can change the baseline as older pages arrive; unavailable history leaves the original seeded register.

History uses minute candles for pools younger than one day, hourly candles below thirty days, otherwise daily candles. Requests paginate backward with up to 1,000 candles per page, ten seconds between pages, and a twenty-page limit. Completed results are cached locally for ten minutes. Provider retention, indexing and throttling can prevent reaching pool creation; status reports partial or unavailable coverage. Pool history does not reconstruct a coin's earlier trading on other pools or chains, and loading history does not reduce live-feed latency.

Implementation reviewed from source; no automated tests or browser verification were run for this change.

## Responsiveness and timing indicators (v4)

Default chart view now shows every received price observation as a tick trace; observed ten-second candles remain an option. The old candle interval grouped observations but did not delay incoming updates. Telemetry shows the age and count of received trades, and timestamp-to-receipt delay where available. Native EVM block timestamps are fetched asynchronously after the trade has already been emitted; block-to-receipt values are approximate and include block timestamp granularity and local clock differences. They are not measured audio latency. Polled trades use the provider's trade timestamp. Unknown timing is shown explicitly.

Immediate note accents now use the logarithmic change between received execution prices rather than the generative sequencer's step index. Continuous layers still express rolling market behavior. This does not make polled or cached data into a streaming source; exact-token diagnosis is needed to identify the active feed and its delay.

## Multi-chain chart and trades (v3)

The UI discovers networks and pools for an exact token identifier from DEX Screener search results. It supports chain-specific identifiers beyond EVM/Solana address shapes and matches either side of a pair. Quote-side selections invert the displayed pair price and buy/sell counts; their five-minute change is marked unavailable because it cannot be inferred from the original base-token change. Results remain provider-limited; this is not an exhaustive registry of all blockchains or tokens. Users choose the network and pool, which remain pinned during polling.

The live-detail chart groups received observations into ten-second candles. Origin context also loads available historical provider candles as described above. Received observations do not constitute complete exchange OHLCV history. It shares trade observations with the music. Snapshot-only sources plot snapshots. Rendering is coalesced through animation frames; chart samples are bounded. EVM reorganization removals remove matching observations, though already-played sound cannot be reversed.

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
