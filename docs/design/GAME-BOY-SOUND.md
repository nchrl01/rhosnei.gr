# Game Boy sound for UPIC

Implementation record · 24 October 2026.

The version 471 audio path uses two MAME-derived Game Boy APUs, four channels each. Lead, arpeggios, chords, bass, drone, texture and percussion become register writes to those eight slots. The browser and offline artwork renderer share the rack, register compiler and sound core. Version 470 aligned audio and visual market interpretation; version 471 corrects arp/chord presence, their pulse envelopes and replay note continuity while retaining sparse harmony.

The host is a JavaScript adaptation of MAME's Game Boy sound device with explicit corrections informed by current Pan Docs. It is sound-only: it does not execute a Game Boy CPU or ROM. The score and market-to-register mapping remain UPIC's own implementation. MAME provenance does not establish exact MAME output or physical-hardware conformance.

The raw single-chip version 468 was deployed at commit `a84fac4`. Version 469 added a second instance of that unchanged four-channel core and restored pooled MIDI phrasing. Versions 470 and 471 change input interpretation, composition and transport; the core and two-chip rack are unchanged. Deployment status is recorded in the repository's Pages workflow.

**Historical version 469 evidence:** build checks succeeded, and a 32-second stereo ETH preview reconstructed the window 2026-10-23 20:26:43.401–20:27:15.401 UTC from public Coinbase trade observations. That preview has 231 scored events across all eight channels, peak output approximately 0.198 with the rack's fixed headroom and preview master gain, and finite samples. The final lead guard reported two revoicings and zero blocked candidates; the score count does not mean all candidates sounded unchanged. It is a historical reconstruction, not a recorded live session.

**Historical version 470 validation:** 304 automated tests, the production build and all workspace type checks passed; two environment-dependent tests were skipped. These covered shared audio/visual inputs, replay cache isolation, sparse chord entrances and transport release.

**Version 471 evidence:** 340 automated tests passed, with two environment-dependent tests skipped; production build and workspace type checks passed. The 32 support-presence tests exercise the actual APU, checking pulse levels of at least 2/15 in the sampled cases, chords still held at 250 ms and arps still active at 60 ms. Four replay regressions cover continuity and release boundaries. A new 32-second ETH reconstruction from the same historical trade window contains 228 scored events across all eight channels, peak approximately 0.198 and RMS approximately 0.02185; the lead guard reports two revoicings and zero blocked candidates. Scored events are not a count of unchanged audible notes. No subjective audition, browser check, phone measurement or hardware comparison is claimed.

## Two chips, eight channels

| Channel on each chip | Reconstructed generator | Foreground chip / Harmony chip |
| --- | --- | --- |
| CH1 | Pulse with duty, envelope, length and period sweep | Lead and kick/tom / Lower chord tone |
| CH2 | Pulse with duty, envelope and length | Arpeggio and scored echo / Upper chord tone |
| CH3 | 32 four-bit samples in 16 bytes of wave RAM | Bass / Waveform-resonance drone |
| CH4 | Clocked 15/7-bit noise, envelope and length | Percussion / Texture grains |

Allocation happens before playback. A later event replaces or truncates the current occupant of its `(chip, channel)` slot. At an admitted chord entrance, the harmony chip's two pulse tones overlap a wave-root tone, creating simultaneous harmony alongside the foreground chip. Other bars can remain chord-free or admit a separate wave drone. Each APU still has exactly four generators. `gb-chip-rack.js` mixes the two outputs at a fixed 0.55 gain per chip before listening-volume controls.

The channel capabilities and register layout are specified by [Pan Docs: Audio](https://gbdev.io/pandocs/Audio.html) and [Audio registers](https://gbdev.io/pandocs/Audio_Registers.html). The cartridge VIN input is external analog input, not another built-in generator; UPIC does not implement it.

## Current implementation

| File | Responsibility |
| --- | --- |
| `apps/web/public/market-performance.js` | Shared observation availability, activity recency, freshness and candle interpretation for audio and visuals |
| `apps/web/public/market-chip-score.js` | Fingerprint shared market state; combine learned motifs, sparse harmonic entrances and asynchronous packets; allocate hardware slots |
| `apps/web/public/market-replay.js` | Resolve recorded observations or closed-candle controls once for both replay consumers |
| `apps/web/public/midi-phrase-model.js` | Pooled lead, bass and drum statistics from 31,136 usable unique arrangements; no source songs |
| `apps/web/public/phrase-development.js` | Repeat and develop generated two-bar material over an eight-bar form |
| `apps/web/public/chip-ensemble-arrangement.js` | Role windows, common breaths and Envion-inspired chip-grain duration/density proposals |
| `apps/web/public/gb-chip-rack.js` | Route eight hardware slots across two APUs and mix live/offline output with fixed headroom |
| `apps/web/public/gameboy-drum-pattern.js` | Independent prime-period packet circuits, observed-data gates, bounded bursts and register expression |
| `apps/web/public/gb-apu-instrument.js` | Screen final learned lead pitches, compile timed register writes, manage ownership/cancellation and render offline |
| `apps/web/public/gb-apu-worklet.js` | Execute bounded, frame-addressed command batches against one persistent chip |
| `apps/web/public/mame-gb-apu.js` | MAME-derived four-channel sound core with documented Pan Docs corrections and host output reconstruction |
| `apps/web/public/gb-apu-silence.js` | Shared rests that keep channel DACs connected instead of switching them off after each event |
| `apps/web/public/trade-piano.js` | Compatibility transport API, finite live activity gate, replay context, lookahead scheduling and accepted visual-event callbacks |
| `apps/web/public/chip-timeline.js` | Replay beat mapping and the first inactive boundary limiting held-note release |
| `apps/web/public/upic-earthbound-visual.js` | Consume the shared observation/decay policy and accepted onsets while retaining holder and market geometry |
| `apps/web/public/engine-view.js` | Inspect actual chip/channel snapshots and their market inputs |
| `packages/engine/src/index.ts` | Build a reconstruction from frozen observations and call the shared APU renderer for artwork audio |

The existing `gameboy-instruments.js` tables supply original 32-step shapes packed into CH3 RAM. The drone additionally uses a custom 32-sample, four-bit waveform whose harmonic emphasis follows market motion/volume. This is waveform-resonance coloration, not an emulated resonant filter. GeneralUser, Kraken samples, Envion/Pure Data DSP, granular sample players and conventional reverb/echo buses are inactive.

Ordinary playback gain controls remain available; they scale the final chip output and do not add sound generators.

### Phrasing inside the chip ensemble

The model introduced in version 469 retains 301 pooled MIDI distributions: 104 lead, 124 bass and 73 drum tables. Generated two-bar motifs recur through introduce, answer, vary and return stages. Bass timing and drum articulation consult the same corpus; harmony and phrase form are authored rules. Stable tonal fields, restrained bends and shared rests let the chip's noise and irregular packets remain audible without continually replacing the foreground melody.

The internal harmonic degree advances once per two bars, but does not require an audible chord on each change. With eligible activity, a coin has one seeded chord entrance every four bars. Composition energy of at least 0.55 permits an additional entrance at the opposite position, two bars away. Activity recency gates the whole chord and reduces its level; there is no additional low-probability volume veto that can erase harmony indefinitely from quiet valid candles. Intervening bars remain chord-free. A chord lasts 0.45–1.70 score beats before channel and phrase limits, with the two pulse attacks staggered by 0.025 beat and their wave root entering together. A separate, probabilistic drone entrance can occupy selected non-chord bars.

Arpeggios are short answer gestures in the actual two-bar response window. A stable four-position candidate lattice is fitted inside that window and before its next common rest. Eligible activity admits a two-note prefix; composition energy of at least 0.22 or 0.55 extends it to three or four notes. Recency can release the whole run. Its score-pair address changes with the phrase, avoiding the former repeated `sourceBar` gates that could reject the same arp forever. An arp note crossing the pair's middle bar line retains its scored duration, subject to the common rest and channel ownership limits. These thresholds use the measured normalized magnitudes; a positive-volume candle's eligibility does not set its volume or pace to one.

The score requests chord pulse initial levels of `11 + round(3 × volume)` with envelope pace 0, so the compiler's gain-scaled, four-bit level holds until the scored release or channel replacement. Arps request `11 + round(2 × intensity)` and pace 3 for a slower downward envelope. The compiler still quantizes the final level; there is no global minimum-volume override. These settings correct short envelope dropouts without changing the APU core or introducing reverb.

Lead and arpeggio response windows follow the phrase stage. The later part of each bar favors the drone/texture field, without forcing either to sound. Role gains are chosen at scored onsets rather than continuously ducking already sounding notes. Activity recency reduces note admission and scales role presence by its square root; source freshness is applied once to score-event gain. Cadence breaths cover beats 14.5–16 and 30–32 of each 32-beat cycle, with event durations capped at their common boundary.

Coin identity, score position and the explicit variation controls address stable candidate notes and packet thresholds. Incoming market values change admission probability, articulation and expression, not the random walk that generates the melodic pool or the drum circuit. Observation fingerprints identify/cache input state; they do not reseed the scheduled gates.

Envion's activity-to-duration, volume-to-overlap and envelope-window ideas become short GB noise events. Their spacing uses score beats; bounded density comes from observed activity, volume and motion. They occupy the second chip's noise channel and replace its earlier occupants. This is chip-grain arrangement, not sample-buffer granular synthesis or the original Envion DSP.

The browser loads and verifies the source interval index asynchronously. Chip support and packets can run while learned lead attacks wait. The shared final driver screens the learned lead after harmonic fitting and channel allocation, including nine-note windows crossing bar boundaries; matching candidates are revoiced or withheld. Offline rendering awaits index preparation and uses the same guard. This reduces indexed source runs, not every possible perceived resemblance. See [MIDI learning](../midi-learning.md) for coverage and exclusions.

The earlier original `gb-apu-core.js` remains inactive. Both active APUs use `mame-gb-apu.js`.

### Shared market evidence and recency

`marketPerformance()` is the common interpretation for the chip score and Earthbound visual input. It keeps source freshness separate from `tradingActivity`, the recency/eligibility envelope; `excitation` is their product. In live playback, the explicit activity envelope is authoritative. A nonzero old volume total, high intensity, market cap or liquidity cannot reopen it.

The shared activity decay stays at 1 for the first two seconds, then follows `exp(-(age - 2) / 8)`, reaching a hard zero at 30 seconds. Actual price changes, decoded trades and pool events advance the app's activity timestamp. An identical price poll, unchanged snapshot or rendered frame does not. If input frames stop arriving entirely, the audio scheduler and visual renderer also apply this decay to their cached input. The audio transport closes its output gate when activity is no longer eligible; the visual's slow ambient movement is not permission to generate sound.

| Evidence | Interpretation |
| --- | --- |
| Decoded live trades | Observed rate/volume and known sides remain distinct from normalized controls |
| Snapshot totals | Rolling aggregates can shape an eligible performance; receipt alone is not a new trade |
| Recorded replay observation | Use the frozen matching observation at or before the replay cursor, including its availability flags |
| Closed candle | Use its open/close change and aggregate volume per second; no inferred trade count, buy/sell split or historical liquidity |
| Candle with explicit zero volume | Silent, including when its price differs |
| Candle with unknown volume | May be eligible when its open/close price actually moves; volume stays unavailable |

Replay audio and visuals resolve the same recorded-or-candle controls. Candle motion is `abs(percent open-to-close change) / 8`, clamped to 0–1; activity and volume use the same logarithmic volume-per-second control. Resolved controls are cached lazily against the frozen replay, so they do not require eager rescoring of every historical prefix. Future observations and unfinished candle endpoints do not enter the current controls.

An accepted replay note can continue across consecutive eligible candles to its scored release instead of ending at every candle boundary. `timeline.activeUntil()` caps that release at the first known inactive interval or gap, including a 10 ms silent candle shorter than a scheduler tick. This lookahead checks only availability; future prices and expression do not rewrite the accepted note. When inactivity is observed, the transport clears held channel ownership as well as future events, so reopening the output cannot revive an old note. Seeking clears chip ownership and queued notes before reconstruction.

## Hardware behavior represented in the core

The sound machine retains the 4,194,304 Hz chip clock, four persistent generators, frame-sequenced length/sweep/envelope behavior, wave RAM, noise state and stereo routing. The JavaScript host adapts this state machine to output samples; it does not import MAME's complete emulator scheduler, sound-stream resampler or analog output chain.

- Pulse duties: 12.5%, 25%, 50%, 75% and integer period registers.
- CH1 sweep: shadow period, pace, shift, addition/subtraction, overflow checks and negate-clear behavior.
- Length, sweep and envelope sequencing at 256, 128 and 64 Hz under the standalone 512 Hz sequencer.
- Four-bit stepped envelopes for pulse/noise; mute/full/half/quarter digital shifts for CH3.
- A programmable 32-step CH3 wave buffer; the driver turns CH3 off before replacing its 16 packed bytes.
- NR43 divisor, shift and short/long noise-register controls.
- NR50/NR51/NR52 output levels, routing and power/status, plus a documented DAC/DC-removal model.

The primary comparison sources are [MAME's Game Boy sound device](https://github.com/mamedev/mame/blob/master/src/devices/sound/gb.cpp), [Pan Docs: Audio registers](https://gbdev.io/pandocs/Audio_Registers.html) and [Audio details](https://gbdev.io/pandocs/Audio_details.html). MAME itself marks this device's sound as imperfect. Its model-specific TODOs remain relevant to any claim made about a port.

### Source adaptation and hardware corrections

The new host is derived from MAME's sound-device code, credited to Wilbert Pol and Anthony Kruize under BSD-3-Clause, with thanks to Shay Green. The distributed [license](../../apps/web/public/vendor/licenses/mame-gb/LICENSE.txt), [provenance](../../apps/web/public/vendor/licenses/mame-gb/PROVENANCE.md) and original source files retain that attribution. The market composer is separate from the derived device implementation.

The port makes these explicit corrections against the inspected MAME source:

| Area | Adapted behavior |
| --- | --- |
| Pulse phase | Retriggers retain duty phase; the pulse sequencer continues during silent rests and resets on power-off |
| CH3 trigger | Retain the prior sample buffer while keeping MAME's six-chip-cycle startup delay |
| Extreme noise clocks | NR43 shifts 14/15 do not clock the noise register |
| Stereo volume | NR50's upper volume bits control the left output |
| DAC and output | Enabled DACs contribute their DC level even while a channel is inactive; a model-dependent high-pass stage removes DC |

These are implemented adaptation choices informed by current Pan Docs, not claims that upstream MAME behaves identically. Envelope-register writes retain MAME's interpretation; revision-specific zombie behavior has not been fully corrected or verified.

The `cgb` setting selects the upstream CGB04 digital behavior. `mgb` uses DMG digital logic with a different high-pass constant. Those options do not represent separately verified models of every hardware revision.

The host's output-sample integration and DC-removal stage are also adaptations. A source-derived state machine with those changes must be described as **MAME-derived with hardware corrections**, not an exact MAME build or a measured console replica.

### Rests and waveform uploads

`gb-apu-silence.js` is shared by browser and offline execution. Pulse/noise rests set a zero-volume, DAC-enabled envelope (`NRx2 = 0x08`) and trigger it; CH3 rests mute its digital output level. Keeping the DAC connected avoids an unnecessary DC discontinuity at every scored note ending. It does not guarantee click-free playback: routing, waveform replacement and other register changes can still create real discontinuities.

CH3 is still disabled for safe wave-RAM replacement, then re-enabled and triggered. That upload policy is distinct from a musical rest.

### Noise as the transmission material

The score selects clock shift, divider and register width rather than choosing among fixed noise recordings. Slow clocks produce separated digital transitions; short-register mode produces more periodic material. Envelope steps and length gates cut this into packets.

Actual market motion changes the selected noise clock. Volume affects bounded packet multiplicity. Buy/sell balance affects routing and duty; price-change direction affects tonal bends. These are artistic mappings, with source availability kept separate from their normalized values.

Static is not a continuously running background recording. Without eligible observations, the scheduler stops authorizing new texture or percussion attacks.

### Depth within the channel budget

Depth comes from register, relative levels, different envelope lengths, interruptions, interlocking cycles and hard left/right/both routing. Arpeggio echoes are quieter scored repeats on the foreground chip's CH2; they consume lane time and can be replaced. A changed drone waveform uses the harmony chip's CH3.

The extra polyphony comes from the second four-channel APU. There is no independent sample instrument, direct FM oscillator, granular PCM machine or conventional reverb processor.

## Limits that remain explicit

- This is a sound-only core, not a CPU/ROM emulator.
- Register batches execute at output-sample boundaries. CPU DIV writes and CPU/APU sub-cycle interactions are outside the model.
- Model selection does not establish conformance across every DMG/MGB/CGB revision. Upstream MAME explicitly lists unverified model differences and register-reload behavior.
- Revision-specific envelope zombie behavior, analog DAC fades and exact CPU/wave-RAM bus arbitration are not established by this port.
- DMG active-RAM access and corruption behavior are not hardware-verified. The normal driver avoids active-RAM writes by disabling CH3 for updates.
- Event-area averaging reduces aliasing compared with point sampling; it is not a brick-wall reconstruction filter.
- The analog speaker/headphone amplifier and real transducer response are not simulated.
- The version 469 and 471 public-trade-driven offline previews and separate automated checks are listed above. They do not establish subjective listening quality or hardware conformance. No physical-phone performance measurement, hardware comparison or emulator conformance suite is claimed.

Pan Docs describes these distinctions and model-dependent behavior in [Audio details](https://gbdev.io/pandocs/Audio_details.html). Never describe this implementation as an exact replacement for every console revision.

## Live, replay and frozen output

The browser and offline renderer use the same `gb-chip-rack.js`, `compileGameBoyEvent` and `GameBoyApu`. Offline rendering resets both chips and advances from the beginning even when exporting a later window, retaining their generator histories.

Sharing these components does not recover an unrecorded live session. Frozen observations produce a deterministic historical reconstruction under their declared input, score, model and renderer settings. Reproduction of a particular live performance additionally requires its actual accepted events and timing/state records.

The collectible renderer identifies version 471 as `upic-nft-gb-v5` (version 470 used `upic-nft-gb-v4`, and version 469 used `upic-nft-gb-v3`). Equivalence between uninterrupted playback and arbitrary live/replay seeks, including the guard's preceding-note history, remains unverified.

Missing volume, trades or holder observations must remain missing. Candle aggregates must not be labeled as captured individual trades.

## Research used and what was not imported

| Reference | Contribution |
| --- | --- |
| [MAME Game Boy sound device](https://github.com/mamedev/mame/blob/master/src/devices/sound/gb.cpp) | BSD-3-Clause source basis for `mame-gb-apu.js`; Wilbert Pol and Anthony Kruize |
| [Pan Docs](https://gbdev.io/pandocs/Audio.html) | Primary register, channel and timing specification |
| [GB303 source](https://github.com/furrtek/GB303/blob/master/src/playback.asm) | Reviewed its CH3-off → write 16 wave-RAM bytes → CH3-on/trigger workflow; no assembly, wave bank or other asset copied |
| [mGB](https://github.com/trash80/mGB) | Conceptual example of a compact control interface to the four voices |
| [Droneboy](https://github.com/purefunktion/Droneboy) | Conceptual reference for changing sustained chip material |
| [Tero Parviainen's stochastic machine](https://codepen.io/teropa/pen/PKoYXM) | Probability-based occupancy and performance variation, reworked into original asynchronous market packets |
| [Ken Shirriff's amplifier analysis](https://www.righto.com/2020/05/reverse-engineering-audio-chip-in.html) | Clarifies the external AMP-MGB speaker/headphone amplification stage; it is not the four-channel APU design |

The supplied chiptune tutorial, Eno/Koan, Wotja and the algorithmic-composition research remain conceptual references. Pooled MIDI statistics inform newly generated phrasing; the active score does not retrieve their songs or execute an imported MIDI composition.

Ken Shirriff traces a chip that receives already generated left/right audio and drives the speaker/headphones. Its transistor-level circuitry is distinct from the sound generators reconstructed here. [Amplifier analysis](https://www.righto.com/2020/05/reverse-engineering-audio-chip-in.html)

Pan Docs pages returned HTTP 403 during research; their official repository sources were read: [overview](https://github.com/gbdev/pandocs/blob/master/src/Audio.md), [registers](https://github.com/gbdev/pandocs/blob/master/src/Audio_Registers.md), [details](https://github.com/gbdev/pandocs/blob/master/src/Audio_details.md).

See [Transmission instrument](TRANSMISSION-INSTRUMENT.md) for the market, composition, visual and release contracts.
