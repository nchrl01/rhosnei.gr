# $AV — market instrument

AV turns observed cryptocurrency market behavior into a Pure Data instrument.
The public prototype is https://nchrl01.github.io/rhosnei.gr/.

## Envion-only instrument

Envion 5.2 is the only active sound source. The original source, 44 samples,
19 envelope banks and authored effects run in the full Pure Data browser engine.
ZERO100, polyrhythms, resonant banks, synthesized percussion, external Freeverb,
external feedback delays and genotype are removed from the published host graph.
Source studies under `native/` are archival; they are not loaded by the app.

Market cap sets tempo: $10k = 10 BPM, $1m = 100 BPM, $10m = 200 BPM.
The market controls Envion's row/speed randomization, Nuke, grains, pan,
echo, internal reverb and smoothed output gain. Chart pan/zoom do not schedule sound.
Listening volume starts at 50%; the fixed upper-left button opens a 0–100% slider.
The interface has no dot grid. Enter `pdata` and submit to show/hide Pure Data.

Chart, token lookup, market feeds and recording remain available.
Recording includes a separate session log; deterministic replay is not implemented.

## Run and deploy

Run `npm start`, open http://localhost:4173, then press Listen.
Full Envion uses the browser Pd runtime with ELSE and Cyclone. Native AV output is
currently disabled because desktop Pd does not implement the browser file bridge.
The supplied standalone desktop source is `public/patches/envion/Envion_v5.2_Plugdata.pd`;
see `public/patches/envion/PORT-NOTES.txt` for its library requirements.

Rebuild with `python3 build-envion.py` then `python3 build-orchestra.py`.
The GitHub repository ZIP contains the source and complete supplied sample folder.
Standalone patch studies remain separate from the active website.
The repository `nchrl01/rhosnei.gr` publishes `public/` through GitHub Pages.

## Market data and freshness

Standard V2/V3 swaps have PublicNode WebSocket adapters for Ethereum, Base, BNB Chain, Arbitrum, Polygon, Optimism and Avalanche. Solana Orca Whirlpools decode confirmed swap logs. Other Solana pools provide transaction activity, without a general swap decoder. Robinhood Chain Uniswap v4 uses direct HTTP RPC polling at least two seconds apart, plus request duration.

Other indexed markets fall back to GeckoTerminal cached trade polling or DEX Screener snapshots. GeckoTerminal requests share a queue with at least eight seconds between starts; metadata, history and trending compete for that budget. Polling intervals are not end-to-end market latency guarantees. Coverage is not universal across every chain and DEX. WebSocket gaps are not backfilled; the v4 HTTP route does not comprehensively reconcile reorganizations.

Decoded trade controls use a rolling 30-second receipt window. Pool activity uses ten seconds. Snapshot fallback uses five-minute aggregates. Price movement is a proxy, not statistical volatility. A healthy decoded feed continues driving the music during snapshot outages. Snapshot-only signals remain fully weighted for 20 seconds, then fade over 40 seconds. Liquidity and native USD conversion retain their last snapshot values; their age is displayed when delayed. Quote conversion can therefore be stale even when new swaps arrive.

## Chart and musical history

Provider candle coverage takes precedence over older observations inside that coverage. The current candle can extend with observations after its request boundary, and new intervals remain live. Extended candle volume contains only received observations and is labelled partial. Acquisition boundaries are retained in the versioned history cache; provider-side caching can still make a current candle incomplete.

Origin means earliest available pool history, not a verified token launch. Missing coverage is explicit. The root register depends on price relative to the earliest available open. Historical backfill can change that reference. Chart controls do not change the music's historical timeframe.

A separate five-minute candle request loads musical context before deeper
origin history. It refreshes every five minutes through the shared provider
queue; initial history can be delayed or unavailable. Latest received price
is compared with completed anchors across 5m/1h/6h/24h. Return size and speed,
recent candle shocks, relative volume and liquidity turnover produce intensity.
Recent shocks cool with a two-hour time constant. Effective movement/activity/
volume can remain high after a fast move pauses; stale feeds still fade.
The loaded median price gives context but high historical valuation alone
does not hold the mix at high intensity. Historical market cap is not supplied:
the displayed typical cap is inferred from price and snapshot supply, which
can be inaccurate when supply changes. Quote-side token caps remain unknown.

## Signal-map feedback

Browser voice pulses come from actual Pd messages; percentage bars show control gains rather than measured loudness. The advancing Pd clock establishes feedback health. After 1.5 seconds without advancement, the map reports stale feedback, even if cached native values continue arriving. Native state is sampled every 250 ms and does not claim to show every note event. Changing coin or restarting playback resets the display counters.


## Active engine and licenses

`public/patches/orchestra/manifest.json` contains four host patches; Envion files
and sample assets load through its own manifest. See
`public/patches/orchestra/ORCHESTRA.txt` and `public/patches/envion/PORT-NOTES.txt`.
Envion is MIT; Pd, Cyclone, ELSE and AudioLab retain their separate bundled notices.
The full runtime includes mixed licenses and source/rebuild material in
`public/vendor/licenses/`. TINY is SIL OFL 1.1; chart attribution is retained.
