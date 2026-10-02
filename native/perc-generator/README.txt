PERC GENERATOR — standalone Pure Data adaptation
================================================

After ZeroPoint Zero's “Perc Generator - max/msp/gen” (3:19):
https://www.youtube.com/watch?v=CpNo7f6aMnI

This is an independent, sample-free reconstruction of the visible structure.
The original Gen source is unavailable; its synthesis and delay internals are
approximated. No original code, recordings, samples or presets are included.
The sound has not been compared by auditory A/B against the video.

PLAY
----
Keep all .pd files in this folder together. Open perc-generator.pd in Pure
Data 0.54 or newer. The installed Pd 0.56.2 was used for offline checks.

1. Click the “pd dsp 1” message.
2. Click RUN. Master starts at 0.18.
3. Edit the 16-note and 16-probability graphs while it plays.
4. The 32-value lower graph shows actual voice envelopes, not a decoration.
5. Open zp-perc-panel for delay time and extended parameter controls.
6. RUN off mutes the output with a short fade. RESET stops, clears delays,
   turns market mode off and restores the initial sequences and controls.

preview.wav contains an offline render of the default instrument, including
a silent tail after Stop. It is generated audio from this adaptation.

The instrument has its own namespace, clock, master and output. It does not
load ZERO100, Gameta, ZENOLOGY or any sample library. Playing more than one
instrument at once will mix their separate dac~ outputs in Pure Data.

LIVE COIN CONTROL
-----------------
Open perc-market.pd instead of perc-generator.pd. Open its perc-generator
object, enable DSP and MARKET. Run the existing AV server with npm start,
then use http://localhost:4173 -> Native Pd -> coin address -> Listen.

Only one AV native bridge may bind UDP 3001. Close other AV native launchers
before using this launcher. The bundled bridge retains the 2.5-second
heartbeat watchdog that sends run=0 and master=0 after a connection loss.

  AV control       Perc Generator mapping
  tempo            clock Hz = tempo / 15, limited to 1..24
  tonic            transposition root = tonic + 12
  activity         gate scale = 0.1 + 1.5 * activity
  energy           percussion level = 0.1 + 0.9 * energy
  motion           FM color = 0.1 + 0.9 * motion
  texture          decay = 45..450 ms; feedback = 0.08..0.58
  space            delay time = 125..750 ms
  seed             gate/transition random seeds
  run / master     transport and listening volume

These are AV design choices. They were not inferred from the reference.
In MARKET mode parameter boxes display incoming values and ignore manual
edits. Sequence arrays remain editable sound-design controls. Changing market
mode mutes the instrument until new controls arrive or RESET is used.

The actual clock feeds the existing bridge's generation counter. Gameta DNA
and string/pad voice messages are not fabricated. The web signal-map voice
labels describe Gameta; this instrument's graph is the correct voice display.
GitHub Pages continues to use the existing browser engine.

REFERENCE / FIDELITY
--------------------
The whole video was visually sampled every 20 seconds. Detailed 1080p frames
at 0:30 and 2:50 were inspected. This was not a frame-by-frame transcription.

Visible structures reflected here:
- initial 8 Hz clock, a 16-position MIDI sequence and gate-probability graph
- two 16-channel signal banks feeding a 32-channel Gen section
- anal/prob objects for transition-based note generation
- mono and stereo downmix branches
- crossover values of 520 Hz and 260 Hz, and branch gains 1.4 and 0.5
- a delay control explicitly labelled milliseconds, initially 500
- rate divisors with a visible 1 / 2 / 4 list
- dry-path scaling 1.3, delayed-path scaling 0.4 and final tanh

Reconstruction choices / unknowns:
- The hidden mc.gen~ percussion algorithm is replaced by a sine oscillator
  with inharmonic FM and a filtered-noise transient. Envelope durations,
  frequency spread, noise level, pan positions and FM depth are our choices.
- The shown mc.sig~ objects have creation arguments 45 and 65, with mtof
  signals connected. Those arguments do not establish a 20-semitone offset.
  Here the two banks receive the step sequence and transition-selected notes.
  Exactly how these are combined inside the original Gen is unknown.
- anal/prob is replaced by first-order weighted transitions from the current
  circular sequence. Repeated notes contribute repeated successor choices.
  This does not reproduce Max's learning lifecycle, which appears to include
  an explicit clear every 1024 steps in the visible patch.
- Probabilities rotate by voice index; the hidden gate evaluation rule is
  unknown. The displayed probability curve changes during the video. Our
  initial curve is a composed preset, not recovered values.
- The initial MIDI list is visually transcribed as two 24s, eight 42s and
  six 63s. Later lists and the performer's automation are not replayed.
- Crossovers use third-order Butterworth sections. Their exact Max transfer
  functions and the choice of which output feeds each branch are unverified.
- Delay feedback (0.24), damping, an 8 ms sinusoidal time modulation and its
  stereo phase/divisor choices are inferred replacements for hidden Gen.
- A 20 Hz output high-pass, conservative master and limiter are additions.
- No sample loader is visible. This adaptation requires no drum samples.
- Oscillator/phase modulation may alias; original oversampling is unknown.

Original download link (subscription required when inspected):
https://boosty.to/zeropointzero/posts/8d2ff33c-aea0-4e47-96fc-31168fff6a7d

IMPLEMENTATION
--------------
perc-generator.pd   main controls, real sequence arrays, voice graph and dac~
perc-market.pd      optional standalone launcher with the local AV bridge
pg-defaults.pd     stopped initial preset / sequence initialization
pg-output.pd       transport, level, master, limiter and audio meters
pg-market.pd       mapping from live AV signals
zp-perc-clock.pd   audio-clock edge detection / 16-step sequence
zp-perc-markov.pd  weighted successor selection from the editable sequence
zp-perc-voice.pd   one of 32 synthesized percussive voices
zp-perc.pd         crossover mixing, saturation and stereo delay
zp-perc-panel.pd   extended controls (including delay time)
zp-clock.pd        shared phase counter / 100 ms display clock
zp-cross.pd        third-order low/high crossover
zp-control.pd      synchronized controls / market-mode edit gate
av-bridge.pd       existing AV loopback UDP bridge / heartbeat watchdog
build.py           regenerate the instrument and synthesis abstractions
perc.py            editable percussion implementation
pd_patch.py        small Pd file writer

Rebuild from the AV workspace: python3 native/perc-generator/build.py
Rebuilding overwrites generated .pd edits. Save durable changes in the Python
files, or save custom Pd variants under new filenames. zp-clock, zp-cross,
zp-control and av-bridge are bundled dependencies and are not regenerated.

CHECKS PERFORMED
----------------
Headless Pd 0.56.2 at 48 kHz loaded the complete patch without errors.
Three real stereo renders checked default gates, all-zero gates and dense
gates. Default RMS 0.00796 / peak 0.07553; dense RMS 0.01687 / peak 0.15515.
All-zero gates produced digital silence; the final stopped tail was silent.
These levels are for the checked preset, not guarantees for arbitrary edits.

Checks also covered dynamic note-table editing, missing-state fallback,
alternating transitions, live market mappings, blocked manual edits in market
mode and muting on a mode change. Tests did not exercise a live exchange feed,
the launcher network connection, GUI layout or perceptual similarity.

No computer-control or screenshot tools were used to complete this instrument.
