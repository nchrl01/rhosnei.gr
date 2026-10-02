# $AV — market instrument

AV turns observed cryptocurrency market behavior into a Pure Data instrument.
The public prototype is https://nchrl01.github.io/rhosnei.gr/.

## Current implementation

- Contract lookup across DEX Screener indexed chains, with explicit network and pool selection.
- TradingView Lightweight Charts: candles, price line, timeframe, zoom/pan, logarithmic scale and available origin history.
- Browser Pd: 20 Karplus–Strong string voices, six PWM pad voices and stereo delay. Pd schedules the musical clock; JavaScript supplies market controls.
- Live signal map: selectable mappings, normalized controls, genotype/rule state and individual browser voice triggers.
- Browser audio recording with a separate session log. Deterministic replay is not implemented.
- Local desktop Pd output using a validated loopback UDP bridge and a 2.5-second heartbeat watchdog.

The music is an adaptation of Rolando Rampoldi's visible Gameta rules, not a verified reproduction of the complete patch or recording. See [reference details](public/patches/REFERENCE.md). GrundTon's original breakcore system and samples remain unresolved. There is no drum layer in the public browser engine.

The workspace's `native/` directory contains a prepared ZENOLOGY companion and a local VST host. Its kit selection, activation and audio have not been verified. ZENOLOGY cannot run inside GitHub Pages; the public map marks it as prepared. Plugin binaries, presets and samples are not published with the site.

## Run and deploy

Run `npm start`, then open http://localhost:4173. Choose Browser Pd and press Listen.
Audio requires a user gesture. Only master listening volume is manually adjusted; market data drives layer levels and musical controls.

For desktop Pd, open `public/patches/av-desktop.pd`, enable DSP, choose Native Pd on the local page, then Listen. Native recording uses Pd or a separate audio application. Closing the native client waits for pending controls and its stop packet. Connection failures still rely on the desktop watchdog. A backgrounded browser can suspend heartbeats; pause/resume on returning.

Edit `build-patch.py` and run `python3 build-patch.py` to regenerate the Pd files. Keep sibling abstractions together. `public/patches/av-gameta.zip` is the downloadable bundle and must be refreshed after patch edits.

The hosting repository is `nchrl01/rhosnei.gr`; its GitHub Actions workflow publishes `public/` to Pages. This workspace itself is not a Git checkout. The deployment checkout is `/private/tmp/av-host-repo`.

## Market data and freshness

Standard V2/V3 swaps have PublicNode WebSocket adapters for Ethereum, Base, BNB Chain, Arbitrum, Polygon, Optimism and Avalanche. Solana Orca Whirlpools decode confirmed swap logs. Other Solana pools provide transaction activity, without a general swap decoder. Robinhood Chain Uniswap v4 uses direct HTTP RPC polling at least two seconds apart, plus request duration.

Other indexed markets fall back to GeckoTerminal cached trade polling or DEX Screener snapshots. GeckoTerminal requests share a queue with at least eight seconds between starts; metadata, history and trending compete for that budget. Polling intervals are not end-to-end market latency guarantees. Coverage is not universal across every chain and DEX. WebSocket gaps are not backfilled; the v4 HTTP route does not comprehensively reconcile reorganizations.

Decoded trade controls use a rolling 30-second receipt window. Pool activity uses ten seconds. Snapshot fallback uses five-minute aggregates. Price movement is a proxy, not statistical volatility. A healthy decoded feed continues driving the music during snapshot outages. Snapshot-only signals remain fully weighted for 20 seconds, then fade over 40 seconds. Liquidity and native USD conversion retain their last snapshot values; their age is displayed when delayed. Quote conversion can therefore be stale even when new swaps arrive.

## Chart and musical history

Provider candle coverage takes precedence over older observations inside that coverage. The current candle can extend with observations after its request boundary, and new intervals remain live. Extended candle volume contains only received observations and is labelled partial. Acquisition boundaries are retained in the versioned history cache; provider-side caching can still make a current candle incomplete.

Origin means earliest available pool history, not a verified token launch. Missing coverage is explicit. The root register depends on price relative to the earliest available open. Historical backfill can change that reference. Chart controls do not change the music's historical timeframe.

## Signal-map feedback

Browser voice pulses come from actual Pd messages; percentage bars show control gains rather than measured loudness. The advancing Pd clock establishes feedback health. After 1.5 seconds without advancement, the map reports stale feedback, even if cached native values continue arriving. Native state is sampled every 250 ms and does not claim to show every note event. Changing coin or restarting playback resets the display counters.

## Verification

Run:

```sh
node --test checks/integration.mjs
python3 checks/gameta.py
```

The integration checks cover completed/current candle precedence, out-of-order timestamps and retiming, independent signal freshness, feedback expiry/recovery, and native shutdown during successful or failed in-flight requests. They use controlled data and mocked transport, not live provider availability.

The local browser was checked in Helium: playback advanced the Pd clock and note counters, selecting liquidity highlighted its connections and explanation, Pause showed zero output, and the compact voice layout was inspected visually. Native transport failures were exercised with controlled requests rather than a new desktop audio audition.

The Pd checks run actual patches with Pd 0.56.2: neutral-mutation state progression, repeat suppression, mutation effects, stereo rendering and silence at zero master. Set `PD_BIN` to use another Pd executable. These checks do not prove perceptual fidelity to the reference videos.

## Runtime attribution

The vendored libpd-wasm build and commit are recorded in `public/vendor/SOURCE.txt`, with its license alongside it. Lightweight Charts is vendored with its license and on-page TradingView attribution. Preserve these notices when distributing.
