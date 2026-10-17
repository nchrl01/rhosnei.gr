# AV / Gameta

Adapted from **Rolando Rampoldi**, “Generative Music in Pure Data: Rule-Changing Cellular Automata ([expr] Genotype/Phenotype)”: https://www.youtube.com/watch?v=Atttrb0hoEc . The source video's metadata identifies a Creative Commons Attribution license. Related author library: https://github.com/rrampoldi/PDida .

The video frames show the two feedback expressions, `change -1`, twenty Karplus-Strong voices and six pad voices. Its description explains genotype, codon extraction and phenotype. AV reconstructs those visible rules; it does not bundle the video recording, animation, samples, or PDida source files.

## Reference behavior retained

- Genotype: `(2 * state + floor(state / 128) + 1) % 256`.
- Codon: `(genotype >> 3) & 7`.
- Phenotype: hold, bounded upward/downward steps, double step, inversion, XOR, integer halving, and a wrapped jump.
- Repeated phenotype values do not emit another note.
- Polyphonic resonant plucks and long PWM pad envelopes.
- Harmony updates after twelve emitted melody notes.

## AV adaptations

| Market input | Musical effect |
| --- | --- |
| Price relative to earliest available history | Base register |
| Transaction activity and traded volume | Clock tempo |
| Price movement | DNA bit mutation once per sixteen clock ticks |
| Traded volume and activity | Automatic string and pad levels |
| Liquidity | String feedback, pad release, spatial delay level |
| Buy/sell balance | Minor or major third in the pad harmony |
| Token identity | Initial 8-bit genotype |

AV supplies its existing seven-note scale. Its independently implemented string excitation, pad timbre and stereo delay differ from the author's instruments. No exact sonic match is claimed. The earlier breakbeat/drum layer is absent in this engine.

## Desktop

Keep these files in one directory. Open `av-desktop.pd`, enable Pd's DSP, and use the local AV server (`npm start`, http://localhost:4173). Select **Native Pd · local**, load a coin, then Listen. The same market mappings used by the browser drive desktop Pd through the loopback bridge. Native recording uses Pd or your audio software; the page's recorder is available for Browser Pd only.

The desktop example message supplies manual example values. It is not live market data. Live mode overwrites the development controls. Stop closes the musical clock and mutes output; the bridge also mutes if heartbeats disappear for 2.5 seconds. A suspended browser tab can therefore stop native playback; return to the tab and pause/resume.

## Validation

`python3 checks/gameta.py` runs actual Pd patches and compares the first thirty neutral-mutation states and emitted notes with the reference equations. It also checks mutation effects, a twelve-second stereo render, and exact silence at zero master volume. Set `PD_BIN` if Pd is installed elsewhere. These checks do not establish perceptual equivalence to the video.
