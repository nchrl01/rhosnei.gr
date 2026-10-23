# Game Boy sound for UPIC

Implementation record · 23 October 2026.

The current local audio path uses one MAME-derived Game Boy APU. Signal, harmony, bass, texture and percussion all become register writes to its four channels. The browser and offline artwork renderer share the register compiler and sound core.

The host is a JavaScript adaptation of MAME's Game Boy sound device with explicit corrections informed by current Pan Docs. It is sound-only: it does not execute a Game Boy CPU or ROM. The score and market-to-register mapping remain UPIC's own implementation. MAME provenance does not establish exact MAME output or physical-hardware conformance.

Source inspection, build and type checks completed. A 24-second stereo preview was rendered from 1,000 public Coinbase ETH-USD trade observations, using the shared composer and MAME-derived host. The selected window is 2026-10-23 20:26:51.401–20:27:15.401 UTC. Its 332 accepted events use all four channels; peak output is below 0.46 at the live 0.72 master gain, with finite samples throughout. This is a historical reconstruction, not a recorded live session. No subjective listening result or phone-performance result is claimed here.

## Four channels, one instrument

| Channel | Reconstructed generator | Current score allocation |
| --- | --- | --- |
| CH1 | Pulse with duty, envelope, length and period sweep | Foreground signal, tonal packets, kick/tom |
| CH2 | Pulse with duty, envelope and length | Interlocking harmony |
| CH3 | 32 four-bit samples in 16 bytes of wave RAM | Bass and authored wave shapes |
| CH4 | Clocked 15/7-bit noise, envelope and length | Texture, static and noise packets |

Allocation happens before playback. A later event can replace the current occupant of its channel; there is no separate bank of melodic, bass or drum voices behind these four slots. A chord becomes a sequence/interlock within the available channels.

The channel capabilities and register layout are specified by [Pan Docs: Audio](https://gbdev.io/pandocs/Audio.html) and [Audio registers](https://gbdev.io/pandocs/Audio_Registers.html). The cartridge VIN input is external analog input, not another built-in generator; UPIC does not implement it.

## Current implementation

| File | Responsibility |
| --- | --- |
| `apps/web/public/market-chip-score.js` | Normalize observed market state; create coin-specific asynchronous signal, harmony, bass and texture events; allocate hardware slots |
| `apps/web/public/gameboy-drum-pattern.js` | Independent prime-period packet circuits, observed-data gates, bounded bursts and register expression |
| `apps/web/public/gb-apu-instrument.js` | Compile events to timed register writes; manage browser ownership/cancellation; render the same instructions offline |
| `apps/web/public/gb-apu-worklet.js` | Execute bounded, frame-addressed command batches against one persistent chip |
| `apps/web/public/mame-gb-apu.js` | MAME-derived four-channel sound core with documented Pan Docs corrections and host output reconstruction |
| `apps/web/public/gb-apu-silence.js` | Shared rests that keep channel DACs connected instead of switching them off after each event |
| `apps/web/public/trade-piano.js` | Compatibility transport API, market/replay context, lookahead scheduling and accepted visual-event callbacks |
| `apps/web/public/engine-view.js` | Inspect actual chip/channel snapshots and their market inputs |
| `packages/engine/src/index.ts` | Build a reconstruction from frozen observations and call the shared APU renderer for artwork audio |

The existing `gameboy-instruments.js` tables supply original 32-step shapes that are packed into CH3 RAM. Its old WAV loader and the old sample-rendering/drum modules are not the production synthesis path. GeneralUser, Kraken bass samples, Envion/Pure Data audio, continuous FM, granular sample players and reverb/echo buses do not run alongside the APU.

Ordinary playback gain controls remain available; they scale the final chip output and do not add sound generators.

The earlier original `gb-apu-core.js` is retained as an inactive reference. It is not a second synthesizer or fallback running beside the MAME-derived host.

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

Depth comes from register, relative levels, different envelope lengths, interruptions, interlocking cycles and hard left/right/both routing. A repeated note uses channel time. A changed waveform uses CH3. Any future echo-like gesture must be a scored chip event that competes for a channel.

There is no expanded-polyphony mode, parallel granular machine, direct FM oscillator, sample instrument, or reverb processor in this implementation.

## Limits that remain explicit

- This is a sound-only core, not a CPU/ROM emulator.
- Register batches execute at output-sample boundaries. CPU DIV writes and CPU/APU sub-cycle interactions are outside the model.
- Model selection does not establish conformance across every DMG/MGB/CGB revision. Upstream MAME explicitly lists unverified model differences and register-reload behavior.
- Revision-specific envelope zombie behavior, analog DAC fades and exact CPU/wave-RAM bus arbitration are not established by this port.
- DMG active-RAM access and corruption behavior are not hardware-verified. The normal driver avoids active-RAM writes by disabling CH3 for updates.
- Event-area averaging reduces aliasing compared with point sampling; it is not a brick-wall reconstruction filter.
- The analog speaker/headphone amplifier and real transducer response are not simulated.
- The public-trade-driven offline preview rendered successfully. No physical-phone performance measurement, hardware comparison or emulator conformance suite is claimed.

Pan Docs describes these distinctions and model-dependent behavior in [Audio details](https://gbdev.io/pandocs/Audio_details.html). Never describe this implementation as an exact replacement for every console revision.

## Live, replay and frozen output

The browser and offline renderer use the same `compileGameBoyEvent` and `GameBoyApu`. Offline rendering starts from a chip reset and advances from the beginning even when exporting a later window, retaining generator history.

Sharing these components does not recover an unrecorded live session. Frozen observations produce a deterministic historical reconstruction under their declared input, score, model and renderer settings. Reproduction of a particular live performance additionally requires its actual accepted events and timing/state records.

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

The supplied chiptune tutorial, Eno/Koan, Wotja and the algorithmic-composition research remain conceptual references. The active score does not reproduce their songs or execute an imported MIDI composition.

Ken Shirriff traces a chip that receives already generated left/right audio and drives the speaker/headphones. Its transistor-level circuitry is distinct from the sound generators reconstructed here. [Amplifier analysis](https://www.righto.com/2020/05/reverse-engineering-audio-chip-in.html)

Pan Docs pages returned HTTP 403 during research; their official repository sources were read: [overview](https://github.com/gbdev/pandocs/blob/master/src/Audio.md), [registers](https://github.com/gbdev/pandocs/blob/master/src/Audio_Registers.md), [details](https://github.com/gbdev/pandocs/blob/master/src/Audio_details.md).

See [Transmission instrument](TRANSMISSION-INSTRUMENT.md) for the market, composition, visual and release contracts.
