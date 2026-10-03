# $UPIC — market instrument

$UPIC turns observed cryptocurrency market behavior into a Pure Data instrument.
The public prototype is https://nchrl01.github.io/rhosnei.gr/.

## Active instruments

The piano is the CC0 VSCO 2 CE soft upright piano, played through
Web Audio. During active trading, a cumulative move of at least 5% since the
previous piano note selects one harmonic note on receipt. Its initial price
anchor uses available five-minute context. There are no block chords. Stable
timestamp/seed-based progressions provide a serene, hopeful, confident,
reflective, bittersweet, tense or restless palette for the individual notes.
These characters are artistic interpretations, not predictions. Quiet native
decoded streams can produce one soft note after 30 seconds without an observed
trade, then at coin-seeded intervals of 45–60 seconds. Cached polling and
disconnected feeds cannot establish silence and do not enable this fallback.
Generic pool events and snapshots never masquerade as piano trade triggers.

Market cap controls resonance on a logarithmic scale: $10k or less = 0%,
$1m = 50%, $100m or more = 100%. This changes the low-pass Q from 0.55 to 1.95
and the eight-second room return from 1.0 to 1.45, with a complementary dry level
from 0.34 to 0.26. The room is audible from startup,
including when market cap is unknown; cap adds resonance and a longer-feeling wash.
These are sound-design mappings, not physical measurements of resonance.

Piano, Envion and coin voice are ON by default and can be removed separately via
`pdata`. Harmonic strings have been removed. The violin research output is not in the site.
Envion's original source, 44 samples, 19 envelope banks and authored effects
remain available in the full Pure Data browser engine.
ZERO100, polyrhythms, resonant banks, synthesized percussion, external Freeverb,
external feedback delays and genotype are removed from the published host graph.
Source studies under `native/` are archival; they are not loaded by the app.

The standalone hardstyle kick is removed from the active engine. Each remaining
bundle can be removed separately under `pdata`.

Ensemble tempo follows 40–140 BPM contextual movement: absolute five-minute
percentage change, movement relative to recent median candle volatility, and a
logarithmic market-cap weight. Quiet/small markets are gentler. Live piano selects
meaningful decoded price moves and sparse notes during observed quiet intervals.
The market controls Envion's envelope sequence, playback speed, Nuke, grains, pan,
echo, internal reverb and smoothed output gain. Chart pan/zoom do not schedule sound.
Listening volume starts at 50%; the volume button at the right of the single-line trending header opens a 0–100% slider. Clicking a trending coin loads its market and starts playback.
The interface has no dot grid. Enter `pdata` and submit to show/hide Pure Data.

Share replaces Record. Listening automatically captures a bounded five-minute
audio take; Share downloads that exact performance and a frozen candle score.
A replay link embeds up to 128 candles when its encoded payload is under 18,000
characters. Longer scores remain downloadable; video export/API are future work.

Piano replay applies the same 5% cumulative-movement selection to completed
historical candles, including history from before this visit. Empty zero-volume
candles allow the quiet fallback; quiet spacing uses listening time so accelerated
history cannot create a rapid ambient loop. This is an OHLC interpretation, not
reconstructed trades. Replay freezes history and market-cap supply estimates;
note selection uses the seed and candle context. Envion reseeds each four-candle phrase;
granular textures and asynchronous sample arrival can still vary. A shared score
starts its context from its included candles; use the audio take for exact fidelity. Pausing or seeking clears
active voices and room tails; returning live never replays a backlog. Busy bursts
are limited to six active piano voices, replacing oldest tails as necessary.
Shared volume and audio recording include both the piano and enabled Pd sources.
The piano uses samples resampled to 16 kHz mono PCM16 with six-second tails.
Samples are normalized offline toward a 0.65 peak before note dynamics and master
volume, avoiding decoded-sample scans during playback startup. This corrects the quiet source recordings
while retaining the soft-note envelopes.
Source, license and mapping records are in `public/samples/piano/`.
Rebuild them with the local audio Python environment and `build-piano.py`.
Samples prefetch when a market is selected. Piano and Pd load independently;
the first ready instrument can start after Listen while the other finishes loading.
Envion's sample initialization cannot close the piano or the math voices.
Failed piano samples fall back to the successfully decoded notes. A fresh trade
received during startup can trigger once ready (at most the latest event, under
three seconds old); stale loading backlogs are discarded. Loading and errors
appear beside the chart.

## Seeded math functions

Five Pd voices use bounded adaptations of the supplied function reel. Each coin
seed selects three distinct rhythmic families and two tonal families, one for each
market-cap milestone: $100k, $500k, $1m, $2m and $5m. These are interpretations of
the supplied visual functions; no reel audio is bundled.

Observed live milestones persist for up to 64 seeds in local storage. Replay
uses only its historical capitalization estimate. A playing chart event can queue
an eight-beat phrase, aligned to the current ensemble tempo. Phrases are serialized
and each voice rests for at least 24 beats before new activity can trigger it again.
Static event identifiers cannot retrigger completed phrases. Pause, seek, replay
end, stale data and quiet movement close gates and cancel queued phrases.

The UI shows five milestone cards, waiting/queued/playing/rest status, and eight-beat
progress. Their curves represent the same pitch controls sent to Pd, not measured
audio waveforms. Card toggles or the complete bundle in `pdata` mute functions.
Pd reports RMS before master and closes stale controls after 400ms.

Sources: `public/math-patterns.js`, `public/math-pattern-view.js`, and
`public/patches/orchestra/av-math*.pd`. Rebuild with `python3 build-math-patterns.py`
followed by `python3 build-orchestra.py`.

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


## Compact chart and sound replay

The main row places the coin image/name, compact chart, and Listen/Record in
that order. The strongest indexed pool for the token (and the trending coin’s
network when supplied) is selected automatically; network/pool selectors are
removed. Feed, connection and playback status share one line below the chart,
with full messages on hover. Standard chart controls and source details open under the ellipsis.
Trending coins scroll continuously and start audio on selection; master volume
remains at the right end of the header, initially 50%.

Click a candle or drag the price-derived tick strip to replay market controls
through Envion. Replay defaults to one loaded candle per second; the chart menu
also provides 1× and 60× real time. Live returns to current market controls.
Playback pauses at the latest loaded observation instead of silently switching
sources. Ordinary chart zoom/pan still do not change live sound.

During the current visit, one market-control frame per second is kept for up to
one hour per pool, for eight pools. Replay uses a captured frame only when it is
within 1.5 seconds of the selected timestamp. Older history uses completed OHLC
candles and their volume: activity is a volume proxy, buy/sell is neutral, and
Envion's liquidity-driven reverb is dry because historical liquidity is unavailable.
The piano keeps its base room when replaying captured trades. Cap is inferred from
latest supply and historical price; supply changes make it uncertain. Missing
candle volume is labelled unavailable. These modes regenerate Envion's sound;
they do not reconstruct past random sample choices or an exact audio waveform.


During history playback, a magenta playhead stays at the centre of the plot area
(excluding the price axis). Candles or the price line scroll left beneath it,
using the same replay cursor and selected speed as the sound. Display motion
interpolates between control updates without advancing the audio clock. Pause
holds the cursor; Live removes it and restores the live chart. Zoom preserves
the visible span around the playhead. The replay strip remains the seek control.

The interface and chart use Arial. Regular (400) text and bold (700) identity/labels
use a consistent type scale; controls centre their text within fixed heights.
The playback marker is pure magenta (#ff00ff). Previously bundled TINY assets
retain their license but are no longer loaded by the interface.


## Desktop and mobile player layouts

Desktop (above 760px) places a compact 600px player at the upper left beneath
the full-width trending tape. Its artwork, chart and transport remain on one
row; the address field and readouts use the same width. Sound parameters are
available in the chart menu instead of occupying an extra dashboard row.

Mobile uses a now-playing layout: large square artwork, coin identity, compact
chart and touch-sized history strip, then a central circular Listen/Pause
control and Record. The same DOM, market stream, replay clock and sound engine
serve both layouts. The play control has an explicit accessible label/state.
Arial, monochrome styling and the magenta replay playhead are retained.

## Market and chance performance (v40)

Envion now performs its source controls on musical boundaries. The v38 workflow
which disabled its generators and used four samples has been replaced.

- Every two beats, market conditions weight a fresh set of effect switches and
  bounded parameter variations. Steady market readings still produce new phrases.
- Every four beats, a market-weighted chance selects a new preset and material.
  All 36 sound preset buttons, 44 bundled WAVs, 19 envelope banks, eight tape
  recordings and six impulse responses are reachable. Larger samples load in the
  background while the current material keeps playing.
- Original preset macros run before automatic sample/envelope/tape/IR selection.
  File dialogs and NETaudio downloads are fulfilled from the supplied library.
  No external sample download, upload prompt or local folder access is needed.
- Grain engine, entropy, modulation, autopan, echo ping-pong/distortion and tape
  switches are enabled by chance. Grain envelope and excitation buttons receive
  occasional bangs. Their numeric ranges follow activity, motion, volume,
  direction and liquidity; reverb remains capped at 25% wet and feedback below
  unity. Musical variation continues between market observations.
- Global free-running row clocks and keyboard/file-scanning generators remain
  off. Panic, Stop, Record, export and source calibration are infrastructure,
  never random performance actions. Listening volume and Record stay manual.
- The source's short 328-row percussion bank now gets its actual row count in
  the host sequencer. Rows never address beyond the selected bank. During asset
  loading, the sequencer retains the sounding bank's count.
- `pdata` shows the active preset/material and planned effects, plus live control
  values. The chart's Sound parameters menu also names the preset and sample.
- Chance uses a per-coin seed and current market weights. It is not an exact
  reconstruction of historical sound; candle-only replay still estimates inputs.

`checks/envion-performance.mjs` checks full-library reachability, probability
response to market motion, finite parameter ranges and actual offline libpd
renders for every preset, including tape/IR loading and mute behavior. All 36
preset renders produced nonzero finite audio with no serious Pd diagnostics.
This checks the engine without opening a browser or audio device. Subjective
listening and the browser interface have not been checked for this revision.

## Chart startup and live subscriptions (v39)

- The selected visible chart requests its latest 1000 candles before sound context,
  launch backfill, image metadata and trending. The shared GeckoTerminal queue
  prioritizes first chart pages (100), fallback trades (90), first context pages
  (80/60), older history pages (20), trending (5) and images (0).
- Identical concurrent requests share one HTTP response, with independent
  cancellation and cloned bodies. Dispatch spacing is six seconds: the stricter
  public docs currently say about 10 calls/minute, while the FAQ says 30. HTTP 429
  applies a shared cooldown using Retry-After (or 60 seconds).
- Saved candles display immediately for repeat visits (up to 24-hour cache age),
  explicitly marked as saved. The latest page always refreshes, replacing
  overlapping candles. Every successful page is saved, so interrupted backfills
  do not discard all progress. Cache gaps remain partial and are backfilled.
- Pagination has no additional ten-second sleep after each response; the shared
  request scheduler provides pacing. Deep launch coverage still takes multiple
  requests and depends on upstream retention, indexing and available budget.
- EVM V2/V3 logs subscribe concurrently with token/decimal lookup. Orca metadata
  lookup and the WebSocket handshake run concurrently. Logs received during
  lookup are buffered (up to 512) with their actual browser receipt times. Pool
  metadata is reused for one hour in memory (bounded to 128 entries).
- Native confirmed subscriptions run outside the REST history queue. Existing
  unsupported pools still use cached trade polling/snapshots; PublicNode is a free
  shared provider. This does not create a universal direct decoder for every DEX.

Provider source: https://api.geckoterminal.com/docs/index.html. Its documented
one-minute cache means polling alone cannot produce an uncached live stream.
No runtime timing measurements or browser checks have been run for this update.

## Interface and rendering (v52)

Date/time, rolling market cap and harmonic character appear beneath the coin name.
Historical market cap is explicitly an estimate using frozen snapshot supply.
All corners are square. Existing compact desktop/mobile layout is retained.
The browser chart now updates existing historical candles in place, batches
trade retention, and bounds replay scrolling to about 30 FPS. Hidden engine and
Envion scope views skip painting. These changes reduce browser work, not upstream
provider latency. No Python chart server has been added.

Focused check: `node checks/music-context.mjs`. A headless Web Audio check also
verified live and replay piano output, exact-audio downloads, replay-link restore,
390px mobile overflow and square controls. At v52, `checks/integration.mjs` still imported the removed `signal-map.js`;
the active integration checks were restored in v65.

## Search, harmony and gain (v53)

The input accepts names, symbols and exact token addresses. Name search offers
explicit coin choices, grouping pools per network/token and retaining the most
liquid matching pool. Addresses still load directly. Symbols may be ambiguous.

ChordSeqAI's theory documentation informed authored alternative progressions:
functional tension/release, modal interchange, sevenths, added ninths and compact
voice leading. Seed chooses an alternative consistently; market context chooses
the harmonic character. Its AI models are not installed. References:
https://chordseqai.com/wiki/music-theory/chord-progressions
https://chordseqai.com/wiki/music-theory/understanding-chords

The shared browser output gain is 1.5 times the previous gain, before its limiter.
The volume slider retains its scale and default 50%. Peaks already limited cannot
increase by the full 50%. Offline checks verify all five Pd voices, finite phrase
duration at 60/120 BPM, no stale-event retrigger, pause/seek/end silence, name search,
replay audio and Share. Run `node checks/math-transport.mjs`.

## iPhone audio startup (v55)

AudioSession uses playback mode when supported so Web Audio follows music
playback rather than iOS's default ambient/ringer category. A one-frame silent
source and resume request execute directly inside the Listen/Resume gesture,
before sample loading. Older iOS uses a bundled silent HTML audio loop to select
the music route; Pause and closing the engine stop it. The browser chooses the
device's native sample rate instead of forcing 44.1 kHz.

Blocked startup times out with a retry message instead of hanging. Interrupted
contexts hold replay position, and Resume restores audio without toggling Pause.
Safari captures prefer MP4/AAC. Headless WebKit with an iPhone viewport verified
trade/replay output, suspension/resume, Share audio and shared score playback;
Chromium passed too. These checks do not measure a physical iPhone's mute switch.
Regression check: `node checks/audio-unlock.mjs`.

## Selective piano and instrument-gated whisper (v58)

`public/piano-policy.js` centralizes cumulative movement and quiet-note selection.
Silent rejected candles are consumed once; they never replay on each rendering
tick. Existing occasional arpeggios remain available only after significant
price-triggered notes. Quiet notes never launch arpeggios or chords.

Kokoro af_nicole runs at 0.78 speaking speed, followed by an authored band-envelope
noise vocoder and a small articulation path. This is a whisper effect, not a new
whisper-trained model. The generated sample peaks at 0.16 before listening volume
and retains its warm stereo reverb. A separate music-only analyser contains piano
and Pd, excluding coin voice and its reverb. Announcements require movement,
playback and measured music RMS above 0.0005; silence closes the voice and tail.
The global gain and listening slider are unchanged. Shared scores declare engine
58; older score versions remain readable and use the current engine's rules.

Syntax checks passed for the changed JavaScript. No new listening or runtime
checks were run for this update.

## Lighter piano, click-safe releases and fine coin art (v59)

The eight sampled pitches now total 1,536,352 bytes (about 79% less than the prior
7,390,288-byte stereo pack). Mono/shortening reduces decoded 48 kHz sample memory
from roughly 29.6 MB to 9.2 MB; lower WAV rate alone would not reduce decoded RAM.
The original sample sources and CC0 license remain. Rebuild with
`native/codicodec/.venv/bin/python build-piano.py`.

Normal releases and stolen voices ramp fully to zero before stopping. Six active
voices can overlap; fading replacements live only for their 35 ms release. Piano
room length is 2.2 seconds, and resets clear it behind a briefly closed output
gate. The coin voice clears its longer room only after actual speech/tail; quiet
frames no longer rebuild convolution repeatedly. Voice interruptions fade out for
25 ms before stopping/clearing, preventing arbitrary-phase waveform cuts. Unchanged
cap values do not
continually reschedule filter automation. Movement attacks have at least one beat
of spacing (minimum 600 ms), checked before the price anchor advances.

Authored piano phrasing advances the existing four-stage harmony with accepted
notes, holds its character through that phrase, prefers nearby pitches and avoids
long repeated-note runs. Coin-seeded 12–28 ms onset variation and ±6% touch
variation are repeatable; finite arpeggios freeze their harmony at phrase start.
References: https://github.com/tonejs/tone.js/wiki/Events and
https://magenta.tensorflow.org/performance-rnn . No extra model/runtime is installed.

Coin art no longer uses the SVG Bayer threshold that could stamp a rectangle on
iOS. Pixel-readable artwork uses fine serpentine error diffusion once per image;
CORS-blocked artwork keeps a recognizable grayscale source with a soft CSS fade.
Image reveal animates opacity instead of recalculating dithering on every frame.

Source review and syntax checks completed. The reported iPhone crackling and new
image appearance have not been verified on the physical phone.

## Data score, ambient piano and holder snapshots (v60)

The original canvas signal field replaces the soft audio dot lens. Binary raster
lanes, complementary bars, scanning, log-spectrum and event/history tape use the
same contextual metrics as the new vanilla Pd set. Desktop drawing is bounded
to 24 fps and 1.5 DPR; mobile skips it, and reduced-motion stops scanning.
References: https://www.ryojiikeda.com/project/datamatics/ and Sound Simulator’s
https://www.youtube.com/watch?v=CLddxGIlVPU . The original tutorial patch was
examined as reference; this project ships newly authored market patches.

`public/data-sonification.js` maps raw activity, volume, movement, freshness and
balance to three short sine/noise voices in `av-data-pulse.pd`. Their probability
and noise sources are seeded. Envelopes and audio-clock ordering mean the score
is repeatable, not a promise of byte-identical regeneration. A watchdog closes
the set after 800 ms without fresh controls. Pause, seek and ended transport
close it. Enter pdata to inspect or remove the entire data bundle. Rebuild with
`python3 build-orchestra.py`; orchestra manifest is version 18.

`public/holder-metadata.js` fetches actual GeckoTerminal token-info holder count,
top-ten supply concentration and provider update time, independently of token
images. It shares the existing free queue and polls every 120 seconds. Holder
updates are irregular and chain/token coverage is incomplete. Counts are wallets,
not current viewers or unique humans. The low sine drone uses count for fullness
and brightness and concentration for slow stereo beating. Unknown timestamps
produce zero influence; valid snapshots remain full for 1 hour then fade to off by
6 hours. This is the app’s freshness policy, not a provider SLA. Current viewers
remain unavailable; no presence service is installed. Historical candle replay
never uses current holders as a substitute for historical holders.

Piano now has a fixed, memory-capped 4.8-second diffusion room, softer hammer
attacks and longer releases. The wet gain is 55–68%, dry 40–32% according to cap.
The 20%/quiet policy, six-voice limit, lightweight sample pack and listening
volume are unchanged. Full-image dithering has no edge mask or reveal fade;
CORS-blocked art has a complete grayscale fallback.

Changed JavaScript was syntax checked and routing/source reviewed. No browser,
listening or physical-iPhone runtime checks were run for this update.

## UPIC identity, five-percent piano and transport lamp (v61)

The user-supplied icon is served as `public/upic-mark.png` and rendered with
the existing error-diffusion dither at the far left of the trending header.
The source image is preserved; its grayscale artwork is not regenerated.
`public/upic-brand.js` also creates the dithered favicon from those pixels.
The website title and share filenames now use $UPIC.

Piano movement selection is now 5% from its last accepted note, governed by
`PIANO_MOVE_PCT` in `piano-policy.js`. Both live and replay use that value, and
visible captions import it to stay consistent. The original 14–26 ms attack
is restored for notes and arpeggios; the strong 4.8-second room, longer release,
six-voice cap and burst spacing remain.

A compact NTS-inspired lamp marks connected native activity in red and running
historical playback in magenta. Paused, seeking, ended or interrupted audio
holds the lamp. Cached trades and snapshots carry distinct delayed labels.
The round dot is an explicit exception to the page’s square-corner rule.
Reference: https://www.nts.live/ .

GMGN installation was researched only. No skill/CLI installation, account
registration or key generation was performed. Its public key is Ed25519 API
authentication, separate from wallet credentials. Market/token data need an
API key; an eventual public web integration would require a server relay.
Sources: https://github.com/GMGNAI/gmgn-skills and
https://github.com/GMGNAI/gmgn-skills/blob/main/src/commands/config.ts .

Syntax and source checks completed; no browser or audio runtime checks were
run for this update.


## Reviewed audiovisual implementation (v62)

This review replaces the v60 data dashboard with an authored monochrome depth
field: price history forms a three-dimensional plane, measured market values
form scanning bands, and the actual mixed audio supplies spectral detail. It is
visible beside the desktop player and directly below the phone player. Quiet
markets become sparse; paused transport freezes movement. Geometry in replay
is anchored to the recorded position, so repeated seeks do not continue an old
animation phase. Drawing is capped at 30 fps desktop / 24 fps phone, pauses when
offscreen, and stops camera motion for the reduced-motion preference.

The browser's actual Pd engine now runs five distinct voices: high ticks, longer
sines, filtered noise bursts, mid pulses and a low sine cluster. Liquidity shapes
pulse duration. Holder snapshots add harmonics to the separate drone. Its data
still means wallet count, never watchers; absent/expired/replay holder data stays
silent. A 2.5-second watchdog accommodates background-tab timer throttling while
explicit pause, seek, end and bundle removal still close audio immediately.
Generated orchestra manifest: v19. New source: av-data-low.pd.

Piano retains the 5% selection and brief sampled attack, but sustains its natural
body into an eight-second diffuse room with a stronger wet path. At extreme
sample rates the impulse memory remains capped. The 50% volume control is
unchanged. No loop or permanently running pad was introduced.

All coin art is dithered without fade. Canvas-readable images use error diffusion
and regenerate on resize. CORS-restricted images use a source-only SVG stochastic
threshold, with no overlay image, external proxy, edge mask or grayscale fallback.

Verification: actual libpd WASM renders exercised all five voices, quiet/stale
silence, holder gating, pause/seek/end, watchdog recovery and repeatable seeded
phrases; the full Envion check passed. Muted headless browser integration exercised
the complete Pd/piano mix, live observations, replay, pause, desktop/phone layout,
and dither loading. Chromium and WebKit dither renders preserved black corners
and white margins. Offline piano renders at 48/96 kHz checked finite tails,
repeatability, pause silence and overlapping-note headroom. A physical iPhone and
provider uptime are not simulated by these checks.

Run the ordinary regressions with `node checks/audio-unlock.mjs`,
`node checks/music-context.mjs`, `node checks/math-transport.mjs`, and
`node checks/data-sonification.mjs`. The isolated piano/visual browser checks need
Playwright and its browsers; use `AV_PLAYWRIGHT_MODULE` for a bundled installation
and `PLAYWRIGHT_BROWSERS_PATH` if its browsers are stored separately.

## Observation bursts and original dithering (v63)

Restores the original 8×8 ordered Bayer dither, gamma 0.88 and charcoal #111,
from the artwork treatment before the iPhone screenshot report. Coins, the
supplied $UPIC mark and its generated favicon share this implementation. There
is no edge fade. The corrected source-only SVG fallback remains for images
whose servers prevent canvas reads; that fallback uses stochastic thresholds.

The visual field now has white paper and black dots, brackets and data symbols.
Received swaps, pool transactions and changed pool-state prices can produce a
180 ms mark while playback runs. Snapshot-only feeds use changed price or rising
observed volume/transaction totals; unchanged values and rolling totals that
fall do not create events. Replay advances produce one mark per changed candle
with positive volume or a changed close, labelled as candle observations rather
than invented trades. Load, pause, seeks, coin changes and inactive transport
clear/reset the field. There is no continuing camera drift or animation driven
by old activity levels, the clock or a piano reverb tail. Pd onsets only annotate
an existing market burst. Rapid arrivals coalesce without extending a mark or
queuing later flashes; separate bursts are at least 360 ms apart. Reduced-motion
mode suppresses spectral animation; its marks still expire. Hidden/offscreen
observations do not queue visual playback.

The holder drone and its patch/control routing are removed. Holder metadata
remains descriptive information in the visual and inspector, never a watcher
count. The five finite data voices remain; generated orchestra manifest is v20.
Piano tuning, the diffuse piano room and the master volume are unchanged.

Review for this update: static source/routing review and syntax validation.
No audio renders, browser playback checks or physical-iPhone checks were run.


## Mobile overlay and voice recovery (v64)

Mobile moves the signal canvas to the page root: transparent white marks use
`mix-blend-mode: difference` across the viewport. The mobile canvas omits all
heading/footer labels; its caption is hidden. It is pointer-transparent, and
returns to the desktop player position when the breakpoint changes. Expired
bursts clear every pixel, so quiet periods leave the underlying page untouched.

Coin voice now admits active low-volatility trading as well as price movement.
The first phrase can accompany music after 4–8 seconds; actual audible music
must be present for 300 ms before it starts. The speech gate uses a small RMS
hysteresis, excludes voice/reverb, and closes on silence, pause or seek. Cut-off
phrases retry after four seconds; only completed names enter the 90–139 second
cooldown. Switching coin during model generation schedules the new name when
the obsolete job finishes. Whisper loudness is bounded by both RMS and peak.
Kokoro still requires its first model download; no device speech fallback is used.


## Review and transport consistency (v65)

The visible replay chart now uses the same frozen candles as audio. Incoming
trades and historical backfills continue updating the live store without
rewriting the replay score; returning live rebuilds the current chart. Scrubbing
also fades the shared output to silence, including Envion, so the displayed
transport state agrees with every audible instrument.

The inspector now requests current patch and manifest URLs. Coin search no
longer labels fully diluted valuation as market cap when market cap is missing.
The local server provides image/font MIME types and returns 404 for missing
assets. Integration and orchestra checks now target the active engine rather
than deleted instruments. Old generation scripts are archival and are not
loaded by the browser's orchestra manifest.

Verification: current integration, audio-unlock, music-context, math-transport,
coin-voice, Envion preset/performance, orchestra and real libpd data-voice checks
passed. Chromium exercised the full app with fixture trades, audible piano/Pd,
replay, pause, silent scrubbing and a 390px layout. WebKit verified the transparent
mobile overlay, expiring bursts and transport behavior. Offline piano renders
at 48/96 kHz checked repeatability, bounded peaks and pause silence. The real
Kokoro af_nicole model downloaded and generated non-silent 24 kHz speech in
isolated Chromium. All 43 first-party browser modules passed syntax and literal
relative-import checks.

These checks do not establish physical-iPhone playback or provider uptime.
Cold voice startup still needs a model download. Shared scores preserve candles
and arpeggio phrases, but cross-version synthesis and granular textures are not
bit-identical; downloaded audio is the exact take. External history cache and
rate limits still bound loading speed.
