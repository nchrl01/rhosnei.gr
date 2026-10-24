# Shared collectible engine

Current local engine version: `upic-nft-gb-v13`.

Version 491 restores the complete Friday asynchronous composer as the active
live/replay/collectible score. One persistent MAME-derived GB APU owns all four
channels, including original voice interruptions. Pulse voices occupy MIDI
36–47 and the wave bass 24–35. The output bus is attenuated by 8 dB.
Selective ADSR/duty changes and resonant wave tables decorate longer packets;
most packets retain their native hardware envelopes. Shared phrase rests and
modern observation/freshness/recency gates remain mandatory. Market cap
modulates packet density, measured holders open arp proposals, liquidity
shapes articulation/resonance, activity sets tempo, and signed movement
continues to change Friday's circuit proposals. Estimated visual holder
counts are never promoted to musical observations.

The live player, lab and collectible renderer use friday-performance-rack.js.
Accepted events expose actual channel ownership and hardware envelope steps
for EarthBound. Audio articulation is confined to the procedural bands;
artwork and palette coordinates remain stable.

## Earlier versions

Version 481 promotes the approved pre-drum arrangement to the live, replay
and collectible score via performed-market-score.js. Three persistent GB APUs
provide four independent rolled chord slots, a MIDI-screened melodic line,
sine bass and sustained wave texture. The drum sequencer and extra arrival
noise are absent from this arrangement. Output gain .35 matches the preview.
Market freshness/recency/availability gates remain mandatory; measured cap
selects rhythm, activity controls tempo, liquidity shapes sustain, holder count
shapes melody range, and measured direction selects harmonic character. Every
accepted channel voice still emits the output-clock/ADSR EarthBound event.

Version 480 adds register-stepped ADSR for pulse, noise and wave voices.
Attack/decay/release are seconds inside the total scored gate; sustain is a
0..1 level ratio. Phases compress together for short notes. Owner-checked
register updates remain within the 16-command budget, including pitch motion.
Manual envelope settings retain their override. Wave table 4 exposes the
existing 32-sample/4-bit sine preset and becomes the automatic bass tone.
Distinct chord pulse widths and MIDI role occupancy shape accompaniment
without replacing the approved carrier clocks. Holder marks now have one
uniform diameter controlled by liquidity, independent of artwork coverage.

Version 478 recovers the asynchronous carrier clock/coin timbre logic from
a84fac4 (Friday 23:40, nearest saved revision to the requested 23:38). The
newer generated pitch guard, harmony, market mapping and shared rests remain.
Noise/percussion levels and observation bursts are reduced at source, with
15-bit noise and slower noise clocks. Vinyl start/stop is retained.

Version 477 adds a seek-addressable 32-bar orchestration form, shared entrance
spacing, evolving wave colour, and measured-direction melodic contours. Each
cycle varies the generated MIDI-informed phrase while keeping its coin key.

Version 476 uses a brief two-level pulse-register attack, softer releases,
50% duty pulses, a narrower lead register and quieter percussion. Melodic
leaps choose nearby pitches from the generated phrase’s allowed palette; the
final originality guard still screens them. The score reconnects market-selected harmonic characters and compact voice leading,
allows held chords/drone notes across bar boundaries until a shared breath, and
uses fractional register tuning, slow bounded pitch motion and held noise textures.
Availability-labelled market controls and silence gates remain mandatory. The
original vinyl start/stop transport is restored in the homepage and audio lab;
normal playback passes through without resampling.

Version 473 gives learned phrases shorter answers and clearer rests, lowers the
lead/arp register, roots tonal percussion in the same harmony, and spaces noise
attacks around the melody. Holder-controlled arp span and the five market
mappings remain intact. The APU core and seed namespace are unchanged.
Historical media retains its original engine identity; current playback is
explicitly a recomposition when that identity differs.

Version 471 corrects arp/chord presence, their pulse envelopes and replay note
continuity. Version 470 introduced shared market interpretation and intermittent
harmony to the two-chip ensemble from version 469. The raw single-chip version
468 was deployed at commit `a84fac4`; each four-channel core itself is unchanged.

The browser collectible player and headless renderer import this package. Its
score uses the same learned phrasing and market transmission rules as the live
instrument (`apps/web/public/market-chip-score.js`). It combines stable generated
two-bar motifs and an eight-bar form with 301 pooled lead, bass and drum
distributions from 31,136 usable unique MIDI arrangements. No source songs are
retrieved; harmony and form remain authored rules. `gb-chip-rack.js` routes eight
slots to two instances of the shared `gb-apu-instrument.js` register compiler and
`mame-gb-apu.js` core. Each APU has two pulse channels, one 32-step, four-bit wave
channel and one noise channel. Envelopes, channel contention, stereo routing and
the noise shift register run inside each chip. The rack mixes at fixed 0.55 gain
per chip. There is no sampled GeneralUser, external texture generator,
sine-oscillator fallback or separate percussion synthesizer in this path.

Foreground lead, arpeggios and bass can answer occasional short harmony tones
and an independent wave drone on the second chip. Eligible activity admits one
seeded chord entrance every four bars; energy of at least 0.55 can add an entrance
two bars opposite. Recency releases the whole chord, leaving intervening bars
chord-free. Each two-bar answer window contains a stable four-position arp plan:
two notes at low eligible energy, three from 0.22 and four from 0.55. These use
actual normalized magnitudes, not a fabricated maximum for active candles.
An arp note can finish across the pair's middle bar line, still bounded by common
rests and channel ownership.
The drone's harmonic emphasis is encoded in its
four-bit waveform, not a modeled resonant filter. Echo repeats consume the arp
lane. Envion-inspired grain duration/overlap becomes short noise-channel events,
not granular sample playback. Role windows and common cadence rests coordinate
the ensemble; the underlying harmonic field changes every two bars without
requiring a chord attack. Pace, movement, volume and recency control admission,
articulation and strength. Available market cap and liquidity colour eligible
waveforms and grains without generating activity by themselves.

Chord pulse envelopes request initial `9 + round(2 × volume)` and pace 0, holding
the compiler's gain-scaled four-bit level until the scored release or replacement.
Arps request initial `9 + round(2 × intensity)` and pace 3 for slower decay. The
compiler still quantizes gain normally; no global minimum-volume floor is added.

## Captured data and replay

`score()` interprets the frozen input's price, volume and available trades.
Frames are selected causally; trades are restricted to the preceding 30
seconds. Missing volume remains unknown, missing buy/sell data remains
unavailable, and aggregate volume is identified as an activity proxy rather
than invented trades. Freshness decays with observation age. Silent or expired
observations do not receive a fabricated minimum activity or fixed drum beat.
The seed selects the circuit; observed activity excites it. Collection stage
controls which score roles are available.

The browser replay transport lets held notes cross consecutive eligible candles
to their scored release. `timeline.activeUntil()` caps release at the first known
inactive interval or gap, including a 10 ms candle shorter than a scheduler tick.
Only availability is consulted ahead; future prices and dynamics cannot rewrite
the current note. Observed inactivity clears held channel ownership, and seeking
clears ownership and queued events before reconstruction.

This is a deterministic reconstruction from the supplied observations. It
cannot reproduce an unrecorded live trade stream, recover missing market data,
or guarantee the exact performance heard earlier on the homepage. The lab's
simulated observations are also distinct from an authenticated market capture.

`schedule()` loads the shared register renderer from `assetBase`, awaits source
index preparation, renders the complete captured piece from both chip resets, then plays the requested window of
that buffer. This preserves register, envelope and noise state at later playback
offsets. Input content is included in the render cache key because the platform
player can replace frames on an existing input object. `offline()` renders the
whole piece rather than an implicit shorter scheduling window.

The shared final driver screens learned lead pitches after harmonic fitting and
channel allocation against the verified source interval index. Matches are
revoiced or withheld; failed verification suppresses learned lead candidates.
The browser loads the index asynchronously, allowing original chip support and
packets to run while learned lead waits. This is an exact interval-run screen,
not a guarantee against perceived resemblance. Arbitrary live/replay seek
equivalence, including preceding-note guard history, remains unverified.

The current `ArtworkInput` contract accepts 20-second pieces and at most 1,000
frames. The lower-level APU render helper additionally bounds events, sample
rate and duration. Rendering currently runs synchronously after module/index
preparation; device performance and listening quality require separate browser and
audio checks.

Historical version 469 evidence: a 32-second ETH preview using the shared path contains
231 scored events across all eight channels and peaks near 0.198 with fixed rack
headroom and master gain; the guard reports two revoicings and zero blocked candidates. Scored events
are not an unchanged-audible-event count. Version 470 separately passed 304
automated tests, production build and workspace type checks, with two
environment-dependent tests skipped.

Version 471 passed 340 automated tests, production build and workspace type
checks, with two environment-dependent tests skipped. Thirty-two support tests
exercise the actual APU: sampled pulse levels are at least 2/15, chords remain
held at 250 ms and arps remain active at 60 ms. Four replay regressions cover
continuity and inactive boundaries. The new 32-second ETH historical reconstruction
contains 228 scored events across all eight channels, peak approximately 0.198
and RMS approximately 0.02185, with two lead revoicings and zero blocked candidates.
No subjective audition or browser verification is claimed.

## Identity and visual scope

The SDK identifies the current audio with `upic-nft-gb-v7`. Existing deployment
metadata and archived media retain their original engine version.
The paired SDK/contract seed namespace remains `upic-nft-v1` so the existing
seed derivation does not change merely because the audio engine advances.

`draw()` still uses the prototype's mathematical visual field and stage mapping.
It is not the homepage's current holder-based visual renderer. The `legacy/`
directory retains those visual functions and older source history; its sampled
composition path is not used by the current audio renderer.

Composition schedules and frozen inputs are deterministic. Pixel output and
encoded-media reproducibility require a pinned renderer environment;
cross-device floating-point output is not represented as byte-identical.
Asset licences and source notices remain in `apps/web/public/licenses`,
`apps/web/public/vendor/licenses` and the corresponding asset directories.
