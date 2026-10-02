ZERO100 — a Pure Data reconstruction study
========================================

Reference: ZeroPoint Zero, “100h max/msp/gen patch”
https://www.youtube.com/watch?v=ziJ4md4IvKY

This is an independent implementation of visible ideas and topology. It is
NOT the creator's patch, a source port, or a verified sonic replica. The
original Max/Gen source was unavailable. No original audio, samples or code
are bundled. No percentage of sound similarity can honestly be assigned.

OPEN / PLAY
-----------
Open 100h.pd in Pure Data. Keep all .pd files together in this folder.
Uses vanilla objects; no Max, paid plugin, sample library or external needed.
Target: Pd 0.54 or newer. Prepared with the installed Pd 0.56.2.

1. Click the “pd dsp 1” message.
2. Click RUN. Master starts at 0.18; adjust for your listening level.
3. Click RUN again to fade the output to silence.
4. RESET restores the reference starting controls, clears the delay buffers,
   stops playback and turns market mode off.

Number boxes and arrays are editable. Open zp-engine and the named objects
inside it to inspect the synthesis. There are no sealed/hidden algorithms.
The 32-ramp display and output meters represent actual engine signals.
The 256-point swing table and three 32-point polyrate tables affect sound.
The g1 and g2 four-value ratio tables are below the main panel (scroll down).

LOCAL COIN CONTROL
------------------
Close other AV native launchers before opening 100h-market.pd: only one
av-bridge may bind loopback UDP 3001. Do not open av-desktop.pd alongside it.

Open the 100h object in the launcher. Enable DSP and MARKET there.
Start the existing AV server from the workspace with npm start.
At http://localhost:4173 choose Native Pd, load a coin and press Listen.
The adapter receives the existing signals. The bridge's heartbeat watchdog
continues to silence the instrument if the browser stops communicating.
The actual Pd clock also feeds the bridge's generation counter. Gameta DNA
and string/pad voice events are not synthesized for this different engine.

  AV signal             ZERO100 parameter
  tempo                 clock Hz = tempo / 15, limited to 1..24
  tonic                 pitch root = tonic + 12
  activity              active tonal-lane density
  motion                phase distortion, drive, swing, clock divisor
  texture               delay feedback and ramp-envelope decay
  energy                ramp duration, filter branch gain, kick gain
  melody / pad          tonal / polymetric branch gains
  space                 delay wet amount
  cutoff                upper tonal frequency limit
  seed                  repeatable octave distribution (1 / 2 / 4)
  run / master          transport and output gain

In MARKET mode number-box edits are ignored and live values are displayed.
The arrays remain editable sound-design controls. Entering/leaving MARKET
mutes output until fresh controls arrive or reference defaults are restored.
These mappings are AV additions, not features inferred from the video.

This instrument has not been integrated into the browser audio engine.
GitHub Pages continues to run the existing Gameta adaptation. The website's
Gameta voice labels do not describe ZERO100's internal voices. Use the Pd
tables and meters for this instrument's state.

FIDELITY NOTES / WHAT THE VIDEO DOES AND DOES NOT SHOW
----------------------------------------------------
The complete 8:45 video was sampled visually, with detailed 1080p frames at
0:10, 1:00, 2:30 and 8:00. This was not a frame-by-frame transcription or an
auditory A/B comparison. The changing on-screen performance is not replayed.

Visible and reflected in this reconstruction:
- phasor clock, initial 8 Hz; a slower clock controlled by a rate divisor
- 256-value swing control, 32-channel lanes, three 32-value polyrate tables
- 32 one-shot ramps (122 ms visible creation argument)
- octave factors generated from powers of two (1, 2, 4)
- a 12-entry pitch mapping table
- parallel four-channel groups in the polymetric section
- eight parallel resonant bands with Q=8; gainAll=1 is visible in Max
- drive of 16 into tanh before the filter bank
- low/high crossover sections with 15000 Hz and 32 Hz cutoffs
- stereo delays with 128/128 visible controls
- a separate branch labelled kick

Approximations and differences:
- Every hidden gen~/mc.gen~ algorithm is newly written. The tonal branch
  uses phase-modulated oscillators; the poly branch uses saturated periodic
  voices. Oscillator identity, modulation equations, envelopes and routing
  inside the original Gen boxes cannot be established from the video.
- The 256 values are read as eight banks of 32 swing controls. This is an
  explicit interpretation of the visible channel counts, not proven wiring.
- The scale is visually estimated as 0 0 2 3 3 5 5 7 7 8 10 10. Its use as
  pitch quantization and the octave/root behavior are reconstruction choices.
- One-shot ramps refuse retriggers while running and hold at their end.
  The original signal that triggers them remains unknown.
- The three polyrate curves and filter frequencies are starting presets,
  not exact values recovered from the graphs. All are editable.
- bp~ approximates the mcs.fffb~ bandpass bank. Max's reson~ gain law is not
  reproduced, so Q=8 does not imply identical levels or frequency response.
- Crossovers are third-order Butterworth sections, calculated for the actual
  sample rate. This matches the documented filter order, not a verified copy
  of Max's coefficients or phase response.
- Delay controls are interpreted as milliseconds; the hidden Gen algorithm
  does not expose units. Cross-feedback (0.36) and damping are our choices.
- Kick is a synthesized pitch sweep. The video does not prove sample usage.
  Its default gain is zero, matching the muted kick visible around 2:30.
- Branch gains, master attenuation and final limiter are reconstruction
  choices. The shown performance moves controls; no automation was recovered.
- Sample-rate modulation and phasor discontinuities can produce aliasing.
  No original oversampling configuration was visible or recovered.

IMPLEMENTATION MAP
------------------
100h.pd             controls, editable arrays, output meters and dac~
100h-market.pd      optional launcher using AV's existing loopback bridge
zp-defaults.pd      stopped reference preset and table values
zp-control.pd       UI synchronization / manual edits gated by market mode
zp-clock.pd         shared phase, cycle count and display updates
zp-lane.pd          one of 32 swing / one-shot ramp lanes
zp-tone.pd          one of 32 inferred tonal voices
zp-poly.pd          one of 4 voices in each of 3 inferred poly groups
zp-band.pd          one of 8 resonant filter bands
zp-cross.pd         third-order low/high crossover
zp-kick.pd          inferred kick voice
zp-delay.pd         inferred stereo feedback delay
zp-engine.pd        mixing and complete audio signal path
zp-market.pd        mapping from AV signals into local parameters
build.py            deterministic generator for all .pd files

Rebuild: python3 native/zero100/build.py (from the AV workspace).
Rebuilding overwrites .pd edits; save custom variants under different names
or make durable changes in build.py. No automated tests were added here.

SOURCE REFERENCES
-----------------
Creator's original source download (subscription required when inspected):
https://boosty.to/zeropointzero/posts/0e137236-a2ac-46b4-958e-fe269649ccac

Max object semantics consulted:
https://docs.cycling74.com/reference/rate~/
https://docs.cycling74.com/reference/mc.ramp~/
https://docs.cycling74.com/reference/mc.generate~/
https://docs.cycling74.com/reference/mc.cross~/
https://docs.cycling74.com/reference/mc.fffb~/

Original Gen source would allow a much closer port. This reconstruction is
structured so the inferred modules can be replaced individually when that
source becomes available.
