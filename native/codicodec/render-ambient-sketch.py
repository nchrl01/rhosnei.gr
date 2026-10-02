"""Original piano/low-violin palette sketch; timing comes from a labelled snapshot."""
from fractions import Fraction
from pathlib import Path
import json
import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

ROOT = Path(__file__).resolve().parent
sr = 48000
market = json.loads((ROOT / 'data/preview-market.json').read_text())
beat = 60 / market['bpm']
out = ROOT / 'runs/violin-v1/previews'
piano_root = ROOT / 'data/vsco-piano'
mapping = {}
for line in (piano_root / 'MappingChart.txt').read_text().splitlines():
    key, _, value = line.partition('=')
    if key.isdigit() and value.isdigit():
        mapping[int(key)] = int(value)
samples = {}
for file in piano_root.glob('Player_dyn1_rr1_*.wav'):
    audio, source_sr = sf.read(file, dtype='float32', always_2d=True)
    ratio = Fraction(sr, source_sr)
    audio = resample_poly(audio, ratio.numerator, ratio.denominator, axis=0)
    samples[mapping[int(file.stem.rsplit('_', 1)[-1])]] = audio
if not samples:
    raise SystemExit('Run fetch-piano.mjs first')

# Original, irregularly spaced notes; no Minecraft melody or recording is used.
events = [(0, 52, .62), (2.5, 59, .43), (6, 62, .40), (9.5, 55, .52),
          (13.5, 57, .39), (17, 64, .34), (20.5, 59, .36), (24, 52, .45)]
frames = int((28 * beat + 6) * sr)
piano = np.zeros((frames, 2), dtype=np.float32)
lowpass = butter(2, 2800, fs=sr, output='sos')
for at, note, velocity in events:
    root_note = min(samples, key=lambda root_note: abs(root_note - note))
    rate = Fraction(2 ** ((root_note - note) / 12)).limit_denominator(2048)
    voice = resample_poly(samples[root_note], rate.numerator, rate.denominator, axis=0)
    # Gentle attack and natural sample tail; do not loop the sample.
    voice = sosfilt(lowpass, voice, axis=0)
    fade = min(int(.015 * sr), len(voice))
    voice[:fade] *= np.linspace(0, 1, fade)[:, None]
    voice *= velocity
    start = int(at * beat)
    count = min(len(voice), frames - start)
    piano[start:start + count] += voice[:count]

# Diffuse, dark stereo reflections; no constant drone or oscillator layer.
rng = np.random.default_rng(1917)
t = np.arange(int(3.8 * sr)) / sr
ir = rng.normal(size=(len(t), 2)) * np.exp(-1.8 * t[:, None])
ir[:int(.035 * sr)] = 0
ir = sosfilt(butter(2, 1800, fs=sr, output='sos'), ir, axis=0)
ir /= np.sqrt(np.sum(ir ** 2, axis=0))
room = np.stack([fftconvolve(piano[:, c], ir[:, c])[:frames] for c in range(2)], axis=1)
piano = .8 * piano + .22 * room

violin, violin_sr = sf.read(out / 'continuation-octave-low.wav', dtype='float32', always_2d=True)
ratio = Fraction(sr, violin_sr)
violin = resample_poly(violin, ratio.numerator, ratio.denominator, axis=0)
fade = min(int(1.3 * sr), len(violin) // 2)
violin[:fade] *= np.linspace(0, 1, fade)[:, None]
violin[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix = piano.copy()
start = int(8 * beat * sr)
count = min(len(violin), len(mix) - start)
mix[start:start + count] += violin[:count] * .8

if not np.isfinite(mix).all():
    raise ValueError('Non-finite audio')
gain = min(4., .65 / max(float(np.abs(mix).max()), 1e-8))
for name, audio in [('piano-soft', piano), ('piano-low-violin', mix)]:
    audio = audio * gain
    tail = int(2 * sr)
    audio[-tail:] *= np.linspace(1, 0, tail)[:, None]
    sf.write(out / (name + '.wav'), audio, sr, subtype='PCM_16')
metadata = {'market': market, 'seconds': frames / sr,
            'piano': 'VSCO 2 CE upright piano, softest velocity layer, CC0',
            'violin': 'experimental CoDiCodec output, shifted down 12 semitones',
            'events': [{'beat': at, 'midi_note': note, 'velocity': velocity} for at, note, velocity in events],
            'status': 'local sound palette sketch; not connected to live market or published website',
            'mix_peak': float(np.abs(mix).max()) * gain}
(out / 'piano-low-violin.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata), flush=True)
