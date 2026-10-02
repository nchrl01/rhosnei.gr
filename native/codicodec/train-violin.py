"""Bounded, resumable first violin model training; no speaker playback."""
import argparse
import logging
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.environ.setdefault('HF_HOME', str(ROOT / 'cache/huggingface'))
os.environ.setdefault('TORCH_HOME', str(ROOT / 'cache/torch'))
os.environ.setdefault('NUMBA_CACHE_DIR', str(ROOT / 'cache/numba'))
sys.path[:0] = [str(ROOT / 'upstream'), str(ROOT / 'upstream/codicodec')]

from flow.config import Config
from flow.train import train
import torch

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--steps', type=int, default=3000)
parser.add_argument('--device', default='mps')
args = parser.parse_args()
if args.steps < 1:
    parser.error('--steps must be positive')
torch.set_num_threads(4)
cfg = Config()
cfg.device = args.device
cfg.data.data_dir = str(ROOT / 'data/violin-latents')
cfg.data.crop_tokens = 128
cfg.data.num_workers = 0
cfg.data.val_frac = .134  # two complete source recordings held out
cfg.model.dim = 192
cfg.model.n_layers = 4
cfg.model.n_heads = 4
cfg.model.head_dim = 48
cfg.model.cond_dim = 192
cfg.model.dropout = .15
cfg.train.out_dir = str(ROOT / 'runs/violin-v1')
cfg.train.batch_size = 4
cfg.train.grad_accum = 1
cfg.train.max_steps = args.steps
cfg.train.warmup_steps = 150
cfg.train.lr = 2e-4
cfg.train.dtype = 'fp32'
cfg.train.ema_decay = .99  # suitable for this short initial run
cfg.train.log_every = 50
cfg.train.val_every = 500
cfg.train.ckpt_every = 500
cfg.train.audio_sample_every = 0  # export deliberately after training
cfg.cfm.t_sample_mode = 'uniform'
Path(cfg.train.out_dir).mkdir(parents=True, exist_ok=True)
handler = logging.FileHandler(Path(cfg.train.out_dir) / 'training.log')
handler.setFormatter(logging.Formatter('%(asctime)s %(name)s %(levelname)s %(message)s'))
logging.getLogger('flow.train').addHandler(handler)
train(cfg)
