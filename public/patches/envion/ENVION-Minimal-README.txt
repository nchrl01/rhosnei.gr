ENVION / MINIMAL STANDALONE FRONT PANEL
Created 2026-10-04 for $UPIC. Source: ENVION 5.2 by Emiliano Pennisi (MIT).

OPEN / FOLDER SETUP
This is a new presentation of the supplied desktop patch, not a smaller DSP.
Use PlugData or Pure Data with desktop ELSE, Cyclone, AudioLab and ceammc.
Keep ENVION-Minimal.pd beside audio/, data/, asset/, the supplied GIF/PNG
assets and LICENSE.txt. Preserve those folders' contents and relative paths.
Do not include this repository's browser else/ adapter directory in a native
desktop copy: its sfload adapter expects $UPIC's browser file bridge and can
shadow the real native ELSE object. Use the installed desktop libraries.
AudioLab: https://github.com/solipd/AudioLab
ceammc: https://github.com/uliss/pd-ceammc

START
Enable DSP in your native host. Select an authored preset by number 0-35;
32 (start) initializes the source's main sound and clocks. Other presets
apply their original settings. Random rows and Sequence clock expose the
original independent clocks. Strike plays the current score row; Stop
stops both source clocks, the current note and tape playback. Stop does
not remove samples, presets, effects or reverb tails. Load sample and
Load tape invoke the original native file choosers.

WHAT BECAME SIMPLER
The front is a roughly 800 x 510 view of the essential material, timing,
filter, grain, tape, reverb and output controls. Preset names and selected
material are displayed. The final stereo mix has a read-only dB meter.
A numbered value may also be typed in the smaller boxes beside sliders.
Filter route, filter mode and reverb route control both original stereo
sides together; the full patch still permits independent side editing.
The 36 authored presets, all sample/envelope paths, original synthesis,
sequencing, modulation, routing, recording and effects remain inside the
closed original-engine subpatch. Open that object to inspect everything.
There are no automatic parameter defaults from this new panel: original
loadbangs and presets decide the sound. Front controls update when their
source controls emit values. Presets can change controls and clocks as
authored. A manual grain value can still be overwritten by the original
modulation/entropy system; this simplification does not bypass it.

WEBSITE / STANDALONE DIFFERENCE
The website remains driven by market data and its market clock. This
standalone is the original native ENVION instrument with manual controls
and original clocks. It contains no invented or simulated market input,
no $UPIC browser control receivers, and no browser file/recording bridge.

PRESERVATION / VALIDATION
Original source SHA-256: b311a1ef54914f22987d4ec8846b05b2155eb922de5611d7d9dfa1fe7f4f6591
All four #N struct preambles remain at document level. The original DSP
source is embedded with its root wrapped in a closed subpatch. Subpatches
share their parent's $0 namespace in Pd, so existing controls and buses
retain the same namespace. Folder lookup is from the same patch directory.
The kept-sound preset remaps change sample path text only; object indexes and
DSP connections retain their original positions.
Only new receives, bounds checks, UI feedback taps and the read-only meter
are appended after the original objects/connections. The new output-gain
control writes the existing $0-initvol bus; it adds no new gain stage.
Proxy bounds match source slider/toggle/radio ranges. Grain pitch retains
its native 350-600 range rather than relabelling it as Hz. Row and preset
numbers are converted to integers. Controls never rewrite DSP constants.
Structural preservation and native no-audio startup are checked separately.
Actual native audio playback and all external libraries are not verified.
Known source behavior and limitations are retained, including globally
named samplebufL/samplebufR buffers and authored routing/clock interactions.
Open one instance at a time to avoid those original shared buffer names.

ORIGINAL / BACKUP
The original full patch remains preserved in public/patches/envion/original/
and in the dated pre-cleanup backup. Active browser and standalone patches
use the retained-sound pool. Original license: LICENSE.txt. Copyright and
library notices are retained.

PRESET INDEX (the number is a view selector, not a rewritten preset)
 0 / plugmain / original control 337
     audio/iqos-gesture.wav
 1 / bowed-piano / original control 342
     audio/file_master_profile.wav
 2 / buchla-lpg / original control 345
     audio/env_0002.wav
 3 / random-gesture / original control 365
     audio/iqos-gesture.wav
 4 / echochamber / original control 386
     audio/klick.wav
 5 / frog-verb / original control 389
     audio/frog.wav
 6 / love-2098 / original control 394
     audio/love.wav
 7 / percussa / original control 397
     audio/simp.wav
 8 / toy-bathroom / original control 402
     audio/toy.wav
 9 / lamina-reso / original control 425
     audio/env_0011.wav
10 / cyber-kick / original control 429
     audio/gait.wav
11 / buchla-bongos / original control 442
     audio/buchla_2.wav
12 / generative / original control 465
     audio/buchla_2.wav
13 / kurosava / original control 478
     audio/wood.wav
14 / web-socket / original control 488
     audio/FFT-ethet_1.wav
15 / d_a / original control 491
     audio/env_0003.wav
16 / p_l / original control 515
     audio/env_0011.wav
17 / c_b / original control 518
     audio/env_0004.wav
18 / p_l_o / original control 546
     audio/FFT-ethet_1.wav
19 / p_l_o / original control 549
     audio/FFT-ethet_1.wav
20 / p_l_o / original control 552
21 / fluid / original control 557
22 / exotica / original control 561
23 / ddr / original control 563
     audio/FFT-ethet_1.wav
24 / vcr / original control 600
     audio/FFT-ethet_1.wav
25 / autechre / original control 610
     audio/FFT-ethet_1.wav
26 / lowercase / original control 670
     audio/FFT-ethet_1.wav
27 / xenaxis / original control 674
28 / gesti / original control 677
     audio/FFT-ethet_1.wav
29 / foley / original control 684
30 / p_l_o / original control 703
31 / p_l_o / original control 707
32 / start / original control 711
     audio/buchla_2.wav
33 / p_l_o / original control 729
34 / fll / original control 805
     audio/FFT-ethet_1.wav
35 / fk-material / original control 872
