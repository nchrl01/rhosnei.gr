"""Package the CC0 soft upright piano for browser playback."""
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
for index in [12, 14, 16, 18, 20, 22, 24, 26]:
    name = f'Player_dyn1_rr1_{index:03d}.wav'
    audio, sr = sf.read(source / name, dtype='float32', always_2d=True)
    divisor = int(np.gcd(sr, 24000))
    audio = resample_poly(audio, 24000 // divisor, sr // divisor, axis=0)[:240000]
    audio *= min(4., .65 / max(float(np.abs(audio).max()), 1e-8))
    fade = min(4800, len(audio))
    audio[-fade:] *= np.linspace(1, 0, fade)[:, None]
    midi = int(mapping[f'{index:03d}'])
    filename = f'piano-{midi}.wav'
    sf.write(out / filename, audio, 24000, subtype='PCM_16')
    files.append({'file': filename, 'midi': midi, 'source': name})
for name in ['LICENSE', 'Info.txt', 'MappingChart.txt', 'provenance.json']:
    shutil.copyfile(source / name, out / name)
(out / 'manifest.json').write_text(json.dumps({'instrument': 'VSCO 2 CE soft upright piano', 'license': 'CC0-1.0', 'files': files}, indent=2) + '\n')
print(f'Packaged {len(files)} soft piano samples')
