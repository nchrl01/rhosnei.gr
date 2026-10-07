# AI browser sources

- Magenta Music 1.23.1: https://github.com/magenta/magenta-js
- TensorFlow.js 2.7 family: https://github.com/tensorflow/tfjs
- Phonemizer includes eSpeak NG code: https://github.com/espeak-ng/espeak-ng (GPL-3.0). Its source, build instructions and license are in that repository; the browser distribution also includes its notices.

Magenta uses the public chord_pitches_improv checkpoint from https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv . We read neural pitch probabilities using a deterministic recurrent trajectory and draw pitches with a coin-seeded PRNG. Playback projects the contour onto the active sampled piano chord. An authored seed phrase is used until inference succeeds. Phrases are frozen for replay and included in shared scores.


