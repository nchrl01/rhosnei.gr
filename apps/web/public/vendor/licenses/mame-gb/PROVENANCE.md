# UPIC's MAME-derived Game Boy sound core

`../../../mame-gb-apu.js` is a JavaScript adaptation of the actual state and
register algorithms in the MAME Game Boy sound device. It is not a compiled
MAME executable and does not run a Game Boy CPU, game ROM, or boot ROM.

## Retained source

Retrieved from the official MAME repository on 2026-10-23:

- https://github.com/mamedev/mame/blob/master/src/devices/sound/gb.cpp
- https://github.com/mamedev/mame/blob/master/src/devices/sound/gb.h

Exact retrieved bytes are retained beside this file:

- `gb.cpp` SHA-256: `c3ce71628faf03013234275e1ed5023b4b4393a843cd81b6b60f6dc0c625dee3`
- `gb.h` SHA-256: `79a124a25f43ba325c19940a351f44267654bb8652c651e53de069ce07389599`

Both files carry BSD-3-Clause notices for Anthony Kruize and Wilbert Pol, with
thanks to Shay Green. The terms are reproduced in `LICENSE.txt`.

## Host adaptation

The port retains the SOUND fields and MAME's count-up length counters,
frequency counters, sweep and envelope state, DMG/CGB04 wave-RAM access,
register handling, power transitions and noise LFSR. The MAME device, timer,
stream and save-state framework is replaced by explicit integer-clock updates.
The sequencer phase is bounded modulo 65,536 clocks to avoid JavaScript signed
32-bit rollover after long playback.

Output integrates constant levels between actual pulse, wave, noise and frame
sequencer transitions. MAME's 64-clock timer period is only an upper bound on a
subspan, never a coarse point-sampling rate. Fractional output-sample clocks are
retained. External register writes happen at the caller's sample boundary.
No external oscillator, sound sample, reverb or synthesizer is mixed in.

## Explicit hardware corrections

The following deliberate departures from the retrieved MAME version follow
https://gbdev.io/pandocs/Audio_details.html and
https://gbdev.io/pandocs/Audio_Registers.html:

- Pulse duty phase persists on retrigger and through silent channel rests;
  powering the APU off resets it.
- CH3 retains its buffered sample on retrigger. MAME's six-clock startup delay
  and separate DMG/CGB04 wave-counter behavior remain.
- Noise shifts 14 and 15 receive no clocks.
- NR50's high three volume bits control the left output, low bits the right.
- Enabled DACs participate in the mixer even when their channel is disabled.
  A console-style high-pass/DC-removal circuit follows each stereo sum.

The port is therefore **MAME-derived with documented hardware corrections**,
not bit-identical to upstream MAME. Model `cgb` selects CGB04 digital behavior;
`mgb` uses the DMG digital algorithm with its documented analogue filter
constant. AGB, CGB02/CGB05 differences, CPU DIV synchronization, complete
revision-specific envelope zombie behavior and exact analogue tolerances are
not modeled. Upstream itself marks SOUND imperfect and retains hardware-timing
TODOs. No claim of universal hardware or emulator equivalence is made.

One inherited DMG edge case remains: at the extreme CH3 frequency value
`0x7ff`, MAME's pre-wrap offset calculation can repeat the buffered nibble.
The scored MIDI frequency range does not reach this setting; direct register
experiments at that extreme retain the upstream behavior.
