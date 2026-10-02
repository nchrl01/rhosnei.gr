"""Prepare source-grouped CC0 violin audio for a small first training run."""
from pathlib import Path
import hashlib
import json
import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve, resample_poly

ROOT = Path(__file__).resolve().parent
source = ROOT / 'data/vsco-violin'
destination = ROOT / 'data/violin-prepared'
destination.mkdir(parents=True, exist_ok=True)
records = []
sr = 48000
for path in sorted(source.glob('*.wav')):
    audio, input_sr = sf.read(path, dtype='float32', always_2d=True)
    divisor = np.gcd(input_sr, sr)
    audio = resample_poly(audio, sr // divisor, input_sr // divisor, axis=0)
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    audio = audio[:, :2]
    # Preserve bowed detail; modest normalization without dynamic compression.
    audio *= min(4., .65 / max(float(np.abs(audio).max()), 1e-8))
    fade = min(int(.04 * sr), len(audio) // 2)
    audio[:fade] *= np.linspace(0, 1, fade)[:, None]
    audio[-fade:] *= np.linspace(1, 0, fade)[:, None]
    # A diffuse variant made from this recording, not a separate source.
    rng = np.random.default_rng(int(hashlib.sha256(path.name.encode()).hexdigest()[:8], 16))
    time = np.arange(int(2.5 * sr)) / sr
    impulse = rng.normal(size=(len(time), 2)) * np.exp(-3.5 * time[:, None])
    impulse[:int(.025 * sr)] = 0
    impulse /= np.sqrt(np.sum(impulse ** 2, axis=0))
    wet = np.stack([fftconvolve(audio[:, c], impulse[:, c]) for c in range(2)], axis=1)
    dry = np.pad(audio, ((0, len(wet) - len(audio)), (0, 0)))
    diffuse = .8 * dry + .25 * wet
    diffuse *= min(1., .7 / max(float(np.abs(diffuse).max()), 1e-8))
    # Keep original and derivative in one shard, so train/validation splitting
    # never puts the derivative of a held-out recording in the training set.
    result = np.concatenate([audio, np.zeros((sr // 2, 2)), diffuse])
    out = destination / path.name
    sf.write(out, result, sr, subtype='PCM_24')
    records.append({'source': path.name, 'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'output': out.name, 'seconds': len(result) / sr,
                    'variants': ['original', 'diffuse synthetic reverb'], 'license': 'CC0-1.0'})
if not records:
    raise SystemExit('No recordings found. Run fetch-strings.mjs first.')
(destination / 'preparation.json').write_text(json.dumps({'sample_rate': sr, 'sources': records}, indent=2) + '\n')
print(f'Prepared {len(records)} source-grouped files, {sum(r["seconds"] for r in records):.1f} seconds', flush=True)
