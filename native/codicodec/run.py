"""Project-local runner; keeps model caches out of the home directory."""
import os
import runpy
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ.setdefault('HF_HOME',str(ROOT/'cache/huggingface'))
os.environ.setdefault('TORCH_HOME',str(ROOT/'cache/torch'))
os.environ.setdefault('NUMBA_CACHE_DIR',str(ROOT/'cache/numba'))
sys.path[:0]=[str(ROOT/'upstream'),str(ROOT/'upstream/codicodec')]
if len(sys.argv)<2:raise SystemExit('Usage: .venv/bin/python run.py flow.smoke_test [arguments]')
module=sys.argv.pop(1)
runpy.run_module(module,run_name='__main__')
