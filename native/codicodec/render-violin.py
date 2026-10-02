"""Export actual trained CoDiCodec previews without opening an audio device."""
import argparse
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.environ.setdefault('HF_HOME', str(ROOT / 'cache/huggingface'))
os.environ.setdefault('TORCH_HOME', str(ROOT / 'cache/torch'))
os.environ.setdefault('NUMBA_CACHE_DIR', str(ROOT / 'cache/numba'))
sys.path[:0] = [str(ROOT / 'upstream'), str(ROOT / 'upstream/codicodec')]

import numpy as np
import soundfile as sf
import torch
from flow.codec_wrapper import CodecConfig, CodecWrapper
from flow.data.latent_dataset import LatentDataset
from flow.model.cfm import sample
from flow.sample import load_model
from violin_voice import lower_register, REGISTER_SEMITONES

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--device', default='mps')
parser.add_argument('--run', default='violin-v1')
args = parser.parse_args()
run = ROOT / 'runs' / args.run
out = run / 'previews'
out.mkdir(parents=True, exist_ok=True)
torch.set_num_threads(4)
device = torch.device(args.device)
checkpoint = run / 'ema.pt'
model = load_model(str(checkpoint), device)
codec = CodecWrapper(CodecConfig(device=args.device, max_batch_decode=16))
validation = LatentDataset(ROOT / 'data/violin-latents', crop_tokens=128, split='val', val_frac=.134)
heldout = torch.load(validation.shards[0].path, map_location='cpu', weights_only=False)
latent = heldout['latent'].reshape(-1, 64)
records = []

def save(name, waveform, lower=False):
    audio = waveform.T.cpu().numpy().astype(np.float32)
    if lower:
        audio = lower_register(audio, codec.sample_rate)
    if not np.isfinite(audio).all():
        raise RuntimeError('Non-finite generated audio; no preview saved')
    raw_peak = float(np.abs(audio).max())
    attenuation = min(1., .65 / max(raw_peak, 1e-8))
    audio *= attenuation
    fade = min(int(codec.sample_rate * .03), len(audio) // 2)
    audio[:fade] *= np.linspace(0, 1, fade)[:, None]
    audio[-fade:] *= np.linspace(1, 0, fade)[:, None]
    path = out / (name + '.wav')
    sf.write(path, audio, codec.sample_rate, subtype='PCM_16')
    info = {'file': path.name, 'seconds': len(audio) / codec.sample_rate,
            'register_semitones': REGISTER_SEMITONES if lower else 0,
            'raw_peak': raw_peak, 'attenuation': attenuation,
            'rms': float(np.sqrt(np.mean(audio ** 2)))}
    print(json.dumps(info), flush=True)
    return info

with torch.inference_mode():
    for name, prompt in [('generated', latent[:0]), ('continuation', latent[16:48])]:
        torch.manual_seed(1917)
        start = time.monotonic()
        full = sample(model, prefix=prompt[None].to(device), n_target_tokens=96,
                      n_steps=16, solver='heun').squeeze(0)
        inference_seconds = time.monotonic() - start
        waveform = codec.decode_latents(full)
        if waveform.ndim == 3:
            waveform = waveform[0]
        info = save(name, waveform)
        info.update({'generation_seconds': inference_seconds,
                     'total_render_seconds': time.monotonic() - start,
                     'prompt_seconds': len(prompt) / 8 * codec.samples_per_chunk / codec.sample_rate,
                     'prompt_source': Path(heldout['source']).name if len(prompt) else None})
        records.append(info)
        if len(prompt):
            save('continuation-generated-only', waveform[:, len(prompt) // 8 * codec.samples_per_chunk:])
            records.append(save('continuation-low', waveform[:, len(prompt) // 8 * codec.samples_per_chunk:], lower=True))
        else:
            records.append(save('generated-low', waveform, lower=True))
    reconstructed = codec.decode_latents(latent[16:112].to(device))
    if reconstructed.ndim == 3:
        reconstructed = reconstructed[0]
    records.append(save('heldout-codec-reference', reconstructed))

metadata = {'checkpoint': str(checkpoint.relative_to(ROOT)),
            'step': int(torch.load(checkpoint, map_location='cpu', weights_only=False)['step']),
            'seed': 1917, 'solver': 'heun', 'steps': 16,
            'status': 'experimental; not perceptually approved or connected to the website',
            'previews': records}
(out / 'manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
