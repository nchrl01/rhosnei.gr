# Shared collectible engine

Current engine version: `upic-nft-gb-v3`.

Version 469 introduces the two-chip ensemble. The raw single-chip version 468
was deployed at commit `a84fac4`; each four-channel core itself is unchanged.

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

Foreground lead, arpeggios and bass coexist with held harmony tones and a wave
drone on the second chip. The drone's harmonic emphasis is encoded in its
four-bit waveform, not a modeled resonant filter. Echo repeats consume the arp
lane. Envion-inspired grain duration/overlap becomes short noise-channel events,
not granular sample playback. Role windows and common cadence rests coordinate
the ensemble; harmony changes every two bars.

## Captured data and replay

`score()` interprets the frozen input's price, volume and available trades.
Frames are selected causally; trades are restricted to the preceding 30
seconds. Missing volume remains unknown, missing buy/sell data remains
unavailable, and aggregate volume is identified as an activity proxy rather
than invented trades. Freshness decays with observation age. Silent or expired
observations do not receive a fabricated minimum activity or fixed drum beat.
The seed selects the circuit; observed activity excites it. Collection stage
controls which score roles are available.

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

Build checks succeeded. A 32-second ETH preview using the shared path contains
231 scored events across all eight channels and peaks near 0.198 with fixed rack
headroom and master gain; the guard reports two revoicings and zero blocked candidates. Scored events
are not an unchanged-audible-event count. No subjective audition or browser
verification is claimed for this refinement.

## Identity and visual scope

The SDK and deployment metadata identify the new audio with `upic-nft-gb-v3`.
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
