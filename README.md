# $AV — market instrument

AV turns observed cryptocurrency market behavior into a Pure Data instrument.
The public prototype is https://nchrl01.github.io/rhosnei.gr/.

## Automatic orchestra

The browser runs the supplied original Envion 5.2 sample-and-envelope source alongside ZERO100 tonal lanes,
polyrhythms and resonant filtering, and Perc Generator synthesized percussion.
Market mode uses a shared clock; Envion keeps its original sample tuning. Its source-derived interactive panel also exposes the original clocks and controls. A rule-based conductor
changes roles every two bars and allocates a shared gain budget from activity,
traded volume, movement and liquidity. There is no instrument preset chooser.
Master adjusts listening volume. The black-and-white signal map shows each
mapping, actual voice activity and measured stereo output.

The hidden original Gen algorithms for the video-only references were unavailable;
those parts are independent reconstructions. Envion uses its actual supplied source,
with explicit browser host adapters documented in `public/patches/envion/PORT-NOTES.txt`. GrundTon breakcore remains
an aesthetic reference; its original samples/system are not included. ZENOLOGY
requires the local plugin host and is not part of browser audio. No commercial
plugin binaries or presets are published. See
[orchestra notes](public/patches/orchestra/ORCHESTRA.txt) and the standalone
studies in `native/zero100/` and `native/perc-generator/`.

Chart, contract lookup, recording and market adapters remain available.
Recording has a separate session log; deterministic replay is not implemented.

## Run and deploy

Run `npm start`, open http://localhost:4173, then press Listen.
Full Envion uses the browser Pd runtime with ELSE and Cyclone. Native AV output is
currently disabled because desktop Pd does not implement the browser file bridge.
The supplied standalone desktop source is `public/patches/envion/Envion_v5.2_Plugdata.pd`;
see `public/patches/envion/PORT-NOTES.txt` for its library requirements.

Rebuild with `python3 build-envion.py` then `python3 build-orchestra.py`.
The GitHub repository ZIP contains the source and complete supplied sample folder.
`public/patches/av-orchestra.zip` is the earlier version4 standalone study, not
this full Envion browser port. Standalone patch studies remain separate.
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

The monochrome Canvas visualization uses fixed musical history and the latest
received frame. Chart linear/log scale changes drawing geometry only. Actual
Pd voice events leave traces at the latest point, and a Web Audio analyser
displays the combined browser spectrum/waveform. The drawing does not replay
historic candles or sequence notes. Native mode shows measured Pd output
without inventing a spectrum. Pausing sound leaves the market path live.
The implementation is independently written, inspired by SonicSketch’s drawn
path/spectrum concept; its source, samples and synthesis are not included.

## Original Envion 5.2

The earlier eight-voice approximation is replaced by the supplied full Envion
source (Emiliano Pennisi, 2025, MIT). Its 109 canvases preserve the original
sample engine, envelope banks, routing, Nuke, Echo, Dynagran and tape processing.
The web panel follows the saved patch coordinates and connects its controls to
that running source. All 44 supplied audio files and 19 banks are included;
large preset samples load on demand. The original source is also preserved.

Market mode clocks the original row/speed randomizers and controls ensemble
balance. Original clock mode is available within the patch. Shared liquidity
Freeverb and the other orchestra parts remain active. Browser file, recording,
keyboard, display and network adaptations are documented in
`public/patches/envion/PORT-NOTES.txt`. The old string bank and pad remain removed.

## Liquidity-driven Freeverb

The cartridge feature is removed from active playback and the interface.
Freeverb processes the combined stereo orchestra before master volume and
measured output, so recording and visualization include the reverb. It uses
vanilla-Pd comb and diffusion abstractions derived from Jezar’s public-domain
algorithm, with original delay timings converted from 44.1 kHz samples to ms.
This is a portable algorithm port, not the compiled freeverb~ external.

Normalized liquidity log10(USD)/7 controls wet mix (up to 55%) and room
(0.35–0.95). Feedback remains below 0.966; damping is 0.20. Wet control
uses the conductor’s 650 ms smoothing followed by a 500 ms Pd ramp; room
feedback uses 500 ms. Freshness
gates wet mix. Listening volume and Pause gate the whole output; starting
playback clears the effect buffers. No new audio audition has been performed.

## Market-cap tempo

The shared clock uses market cap: $10,000 = 10 BPM, $1,000,000 = 100 BPM,
$10,000,000 = 200 BPM. Piecewise logarithmic interpolation joins those anchors.
Caps outside this range hold the nearest endpoint. Activity, volume and recent
intensity continue to shape density, articulation and mix rather than tempo.
Latest cap can be price-adjusted from snapshot supply, as labelled in the UI.
FDV is not used as a substitute. Missing cap uses an explicit 120 BPM fallback;
the synthetic demo also uses 120 BPM. Native transport accepts the 10 BPM floor.

## Visible Pure Data engine

The website includes an open, read-only engine panel. It renders objects and
connections directly from the published Pd files, using their stored positions.
The patch selector and clickable abstractions browse the implementation; they
do not change the instrument. Full patch source and individual downloads are
available. When Browser Pd loads, its exact file strings replace the preview.
Native mode displays published source previews; it cannot inspect the actual
patch contents open in the desktop application.

Live controls show numeric messages sent to the engine, not acknowledgements
or measured loudness. Feedback shows actual subscribed Pd messages and their
age. The console exposes browser Pd prints/errors. Market source, capitalization,
liquidity and history intensity are visible beside the patch. This panel is
read-only and never schedules or modifies audio.
