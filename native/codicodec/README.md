# Local CoDiCodec research

This is preparation for a trained string model, not a running website instrument.
No Flow string checkpoint has been trained or installed yet.

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

Next steps: prepare and encode the corpus, measure bounded training performance,
train and evaluate a string model, then implement an inference/audio bridge.
GitHub Pages cannot run the Python/GPU inference service. No service is exposed
from this laptop and no generated neural audio is currently published.
