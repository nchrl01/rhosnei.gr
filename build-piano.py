"""Package a light, click-safe mono CC0 upright piano for browser playback."""
from pathlib import Path
import json
import shutil
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

root = Path(__file__).resolve().parent
source = root / 'native/codicodec/data/vsco-piano'
out = root / 'public/samples/piano'
out.mkdir(parents=True, exist_ok=True)
mapping = dict(line.split('=') for line in (source / 'MappingChart.txt').read_text().splitlines() if '=' in line)
files = []
sample_rate = 16000
max_seconds = 6
for index in [12, 14, 16, 18, 20, 22, 24, 26]:
    name = f'Player_dyn1_rr1_{index:03d}.wav'
    audio, sr = sf.read(source / name, dtype='float32', always_2d=True)
    audio = audio.mean(axis=1)
    divisor = int(np.gcd(sr, sample_rate))
    audio = resample_poly(audio, sample_rate // divisor, sr // divisor)[:sample_rate * max_seconds]
    audio *= .65 / max(float(np.abs(audio).max()), 1e-8)
    # Trim the recording's initial DC step without rounding away the piano attack.
    attack = min(int(sample_rate * .003), len(audio))
    audio[:attack] *= np.linspace(0, 1, attack)
    fade = min(int(sample_rate * .3), len(audio))
    audio[-fade:] *= np.linspace(1, 0, fade)
    midi = int(mapping[f'{index:03d}'])
    filename = f'piano-{midi}.wav'
    sf.write(out / filename, audio, sample_rate, subtype='PCM_16')
    files.append({'file': filename, 'midi': midi, 'source': name, 'trim': 1,
                  'seconds': round(len(audio) / sample_rate, 3), 'bytes': (out / filename).stat().st_size})
for name in ['LICENSE', 'Info.txt', 'MappingChart.txt', 'provenance.json']:
    shutil.copyfile(source / name, out / name)
(out / 'manifest.json').write_text(json.dumps({'instrument': 'VSCO 2 CE soft upright piano',
 'license': 'CC0-1.0', 'sampleRate': sample_rate, 'channels': 1, 'bitDepth': 16,
 'maxSeconds': max_seconds, 'peak': .65, 'files': files}, indent=2) + '\n')
print(f'Packaged {len(files)} soft piano samples')
