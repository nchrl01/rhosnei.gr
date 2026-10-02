"""Lower the violin register independently of playback tempo."""
import argparse
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.environ.setdefault('NUMBA_CACHE_DIR', str(ROOT / 'cache/numba'))

import librosa
import numpy as np
import soundfile as sf

REGISTER_SEMITONES = -12.0

def lower_register(audio, sample_rate, semitones=REGISTER_SEMITONES):
    """Frames x channels in/out; pitch changes while duration stays unchanged."""
    audio = np.asarray(audio, dtype=np.float32)
    shifted = librosa.effects.pitch_shift(audio.T, sr=sample_rate,
                                          n_steps=semitones, res_type='soxr_hq').T
    if shifted.shape != audio.shape or not np.isfinite(shifted).all():
        raise ValueError('Pitch transformation produced invalid audio')
    # Attenuate only if processing causes a high peak; do not amplify quiet tails.
    shifted *= min(1., .65 / max(float(np.abs(shifted).max()), 1e-8))
    return shifted

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('Keep the original: choose a different output path')
    audio, sr = sf.read(args.source, dtype='float32', always_2d=True)
    result = lower_register(audio, sr)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(args.output, result, sr, subtype='PCM_16')
    metadata = {'source': args.source.name, 'file': args.output.name,
                'register_semitones': REGISTER_SEMITONES,
                'seconds': len(result) / sr, 'duration_preserved': True,
                'tempo': 'unchanged; preview has no live market feed'}
    args.output.with_suffix('.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(metadata), flush=True)

if __name__ == '__main__':
    main()
