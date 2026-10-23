# Shared collectible engine

Current engine version: `upic-nft-gb-v2`.

The browser collectible player and headless renderer import this package. Its
score uses the same original market transmission rules as the live instrument
(`apps/web/public/market-chip-score.js`). Audio is rendered by the shared
`gb-apu-instrument.js` register compiler and `mame-gb-apu.js` MAME-derived
Game Boy APU core: two pulse
channels, one 32-step, 4-bit wave channel and one noise channel. Envelopes,
channel contention, stereo routing and the noise shift register run inside
that chip model. There is no sampled GeneralUser, external texture generator,
sine-oscillator fallback or separate percussion synthesizer in this path.

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

`schedule()` loads the shared register renderer from `assetBase`, renders the
complete captured piece from a chip reset, then plays the requested window of
that buffer. This preserves register, envelope and noise state at later playback
offsets. Input content is included in the render cache key because the platform
player can replace frames on an existing input object. `offline()` renders the
whole piece rather than an implicit shorter scheduling window.

The current `ArtworkInput` contract accepts 20-second pieces and at most 1,000
frames. The lower-level APU render helper additionally bounds events, sample
rate and duration. Rendering currently runs synchronously after the module has
loaded; device performance and listening quality require separate browser and
audio checks.

## Identity and visual scope

The SDK and deployment metadata identify the new audio with `upic-nft-gb-v2`.
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
