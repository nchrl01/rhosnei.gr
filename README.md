# $AV — market instrument

AV turns observed cryptocurrency market behavior into a Pure Data instrument.
The public prototype is https://nchrl01.github.io/rhosnei.gr/.

## Automatic orchestra

The browser now combines Gameta strings and pads, ZERO100 tonal lanes,
polyrhythms and resonant filtering, and Perc Generator synthesized percussion.
All parts run together with one clock and pitch family. A rule-based conductor
changes roles every two bars and allocates a shared gain budget from activity,
traded volume, movement and liquidity. There is no instrument preset chooser.
Master adjusts listening volume. The black-and-white signal map shows each
mapping, actual voice activity and measured stereo output.

The hidden original Gen algorithms were unavailable. These are independent
adaptations, not verified identical reproductions. GrundTon breakcore remains
an aesthetic reference; its original samples/system are not included. ZENOLOGY
requires the local plugin host and is not part of browser audio. No commercial
plugin binaries or presets are published. See
[orchestra notes](public/patches/orchestra/ORCHESTRA.txt) and the standalone
studies in `native/zero100/` and `native/perc-generator/`.

Chart, contract lookup, recording and market adapters remain available.
Recording has a separate session log; deterministic replay is not implemented.

## Run and deploy

Run `npm start`, open http://localhost:4173, then press Listen.
For native output, open `public/patches/orchestra/av-desktop.pd`, enable DSP,
choose Native Pd on the local website, then Listen. Keep abstractions together.
The loopback bridge validates the orchestra identity and has a 2.5-second
heartbeat watchdog. Background browser suspension can trigger it.

Rebuild with `python3 build-orchestra.py`. The downloadable ensemble is
`public/patches/av-orchestra.zip`. Standalone patch studies remain separate.
The repository `nchrl01/rhosnei.gr` publishes `public/` through GitHub Pages.

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
node checks/orchestra.mjs
python3 checks/gameta.py
```

The integration checks cover completed/current candle precedence, out-of-order timestamps and retiming, independent signal freshness, feedback expiry/recovery, and native shutdown during successful or failed in-flight requests. They use controlled data and mocked transport, not live provider availability.

Earlier Gameta-only playback was checked in Helium: playback advanced the Pd clock and note counters, selecting liquidity highlighted its connections and explanation, Pause showed zero output, and the compact voice layout was inspected visually. Native transport failures were exercised with controlled requests rather than a new desktop audio audition.

The Pd checks run actual patches with Pd 0.56.2: neutral-mutation state progression, repeat suppression, mutation effects, stereo rendering and silence at zero master. Set `PD_BIN` to use another Pd executable. These checks do not prove perceptual fidelity to the reference videos.

## Runtime attribution

The vendored libpd-wasm build and commit are recorded in `public/vendor/SOURCE.txt`, with its license alongside it. Lightweight Charts is vendored with its license and on-page TradingView attribution. Preserve these notices when distributing.

The combined orchestra is checked headlessly against the actual browser WASM:
each part renders finite audio, the ensemble reports voice/output feedback, and
Stop and zero master produce silence. No new GUI audition or visual check was
performed under the current computer-control restriction.

## Dynamic market sketch

The monochrome Canvas visualization follows the chart’s visible price history.
The chart’s linear/log scale sets geometry, actual candle volume marks the path, Pd clock
and voice events leave short-lived traces, and a Web Audio analyser displays
actual post-master browser spectrum/waveform. The clock scans the path as a
visual correspondence; this does not sonify/replay old candles. Native mode
shows Pd output meters without inventing a frequency spectrum. Pausing sound
leaves the market path live. Reduced-motion users receive slower redraws and
no expanding trade rings. No random animation or new sound generator is added.
The implementation is independently written, inspired by SonicSketch’s drawn
path/spectrum concept; its source, samples and synthesis are not included.
