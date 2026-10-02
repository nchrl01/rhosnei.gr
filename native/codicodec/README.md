# Local CoDiCodec research

An experimental string model has been trained locally. It is not yet connected
to the website and has not been perceptually evaluated.

- Flow upstream: https://github.com/moiseshorta/CoDiCodec-Flow
- Pinned revision: cffa296abb6eebc49cf10d33fe3f0ceaeb629429
- Flow and codec licensing: CC BY-NC 4.0; this setup is a local noncommercial experiment.
- Corpus: 15 soft sustained vibrato solo violin recordings from VSCO 2 CE.
- Corpus source: https://github.com/sgossner/VSCO-2-CE
- Corpus revision: 440300901dfe9275fd84e0b7763af1f8443ae62e
- Corpus license: CC0, confirmed at https://versilian-studios.com/vsco-community/
- Recordists: Sam Gossner and Simon Dalzell.

Run `node native/codicodec/fetch-strings.mjs` to fetch the recordings, license,
and provenance record. Generated data and downloaded dependencies remain local.
These are vibrato recordings, not the exact flageolet corpus from the reference.

The local `.venv` uses Python 3.12 and the upstream requirements plus sounddevice.
`run.py` adds the upstream source directories to Python's import path; this
avoids an editable-install failure caused by setuptools interpreting `$AV`.

From the project root:

```
native/codicodec/.venv/bin/python native/codicodec/run.py flow.smoke_test --device mps --with-codec
```

On 2026-10-02, the model forward/backward smoke check and codec encode/decode
check passed on the laptop's GPU. Encoding two seconds took 1.27 seconds and
decoding took 3.99 seconds during this cold check; sustained real-time performance
has not been established. These checks do not establish trained audio quality.

## First trained model

`prepare-violin.py` creates 486.7 seconds of dry and diffusely reverberated audio
from 220.8 seconds of unique source recordings. Derivatives stay grouped with
their source to prevent training/validation leakage. Two recordings are held out.

`train-violin.py --steps 3000` completed on MPS in approximately 85 seconds.
The 2.54M-parameter model uses 128-token crops, batch size 4, fp32, uniform flow
time sampling, and EMA decay 0.99. Checkpoints are in `runs/violin-v1/`.
Held-out flow loss moved from 1.6663 at step 500 to 1.5163 at step 3000, with
little improvement after step 1500. This is a limited pilot, not evidence of
convincing violin sound or generalization across instruments.

`render-violin.py` exported actual CoDiCodec audio to `runs/violin-v1/previews/`:

- `generated.wav`: 8.21 seconds generated without a recording prompt.
- `continuation.wav`: 2.73 seconds of held-out violin prompt, then generated audio.
- `continuation-generated-only.wav`: the generated portion alone.
- `heldout-codec-reference.wav`: a recording reconstructed by the codec for comparison.

The preferred register is now twelve semitones lower. `violin_voice.py` applies
pitch shifting independently of duration, retaining the original previews.
`render-violin.py` also exports `continuation-low.wav` and `generated-low.wav`.
This is a pitch-processing change, not retraining. No fixed tempo slowdown is
applied: the website's existing market-cap tempo mapping remains unchanged.
These local previews contain no live market data.

## Softer piano palette

`fetch-piano.mjs` downloads eleven soft-velocity upright piano samples from the
same pinned VSCO 2 CE revision, with LICENSE, original key mapping, recordist
notes and SHA-256 provenance. Simon Dalzell / Ivy Audio recorded this piano;
the samples are CC0. `render-ambient-sketch.py` creates an original sparse piano
phrase with dark reverb, plus a version containing one low violin passage.
No Minecraft melody or audio recording is used.

`data/preview-market.json` explicitly identifies an illustrative $250k cap.
Its 73 BPM was calculated with the website's `orchestraTempo` function.
This demonstrates the palette at one mapped tempo, not live market integration.
Outputs: `piano-soft.wav`, `piano-low-violin.wav`, and provenance JSON in the
preview folder. The website's tempo mapping and active instruments are unchanged.

Rendering the first 8.21 seconds took 7.36 seconds including decoding; the
prompted 10.94 seconds took 8.54 seconds. These are offline batch timings,
not a demonstrated streaming latency or dropout-free performance guarantee.
`manifest.json` records levels, durations, settings and source identity.
No audio device was opened. Previews were not played automatically.

Reproduce from the project root after upstream and dependencies are installed:

```
native/codicodec/.venv/bin/python native/codicodec/prepare-violin.py
native/codicodec/.venv/bin/python native/codicodec/run.py flow.data.preencode --in-dir native/codicodec/data/violin-prepared --out-dir native/codicodec/data/violin-latents --device mps --max-seconds 40
native/codicodec/.venv/bin/python native/codicodec/train-violin.py --steps 3000
native/codicodec/.venv/bin/python native/codicodec/render-violin.py
```

Next steps: audition the previews, improve corpus/model quality as needed,
then implement a market-controlled inference/audio bridge.
GitHub Pages cannot run the Python/GPU inference service. No service is exposed
from this laptop and no generated neural audio is currently published.
