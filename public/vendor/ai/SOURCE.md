# AI browser sources

- Magenta Music 1.23.1: https://github.com/magenta/magenta-js
- TensorFlow.js 2.7 family: https://github.com/tensorflow/tfjs
- Kokoro JS 1.2.1, supplied official browser bundle: https://github.com/hexgrad/kokoro/tree/main/kokoro.js
- This Kokoro bundle embeds Transformers.js 3.5.1, ONNX Runtime Web 1.22.0-dev.20250409-89f8206ba4 and Phonemizer.js: https://github.com/huggingface/transformers.js ; https://github.com/microsoft/onnxruntime ; https://github.com/xenova/phonemizer.js
- Phonemizer includes eSpeak NG code: https://github.com/espeak-ng/espeak-ng (GPL-3.0). Its source, build instructions and license are in that repository; the browser distribution also includes its notices.

Magenta uses the public chord_pitches_improv checkpoint from https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv . We read neural pitch probabilities using a deterministic recurrent trajectory and draw pitches with a coin-seeded PRNG. Playback projects the contour onto the active sampled piano chord. An authored seed phrase is used until inference succeeds. Phrases are frozen for replay and included in shared scores.

Kokoro loads the q8 ONNX model and af_nicole voice from https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX . Model weights: Apache-2.0. Speech is computed on the listener's device. Coin names are not submitted to a hosted speech API. The exact ONNX support assets are served from Transformers.js 3.5.1's CDN distribution to match the official Kokoro JS bundle. First download is substantial (roughly 90 MB of model weights plus the runtime); worker inference is independent of music startup. No credentials are required.

Rebuild the musical vendor bundle with npm ci and npm run build in native/ai. Kokoro's official browser bundle is copied verbatim. The corresponding package lock pins the toolchain; versioned third-party licenses accompany the distribution. This app is open source and the corresponding source/build references are above.
