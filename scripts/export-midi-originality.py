#!/usr/bin/env python3
"""Export a compact interval-membership filter from the learned corpus.

Every eight consecutive semitone intervals from the top and bottom onset lines
of each pitched track/port/channel is inserted. It detects exact nine-note runs
under global transposition and tempo changes; it is not perceptual similarity.
The Bloom filter can reject extra phrases, but cannot miss inserted sequences.
No source melodies, names, timing or instrument assignments are published.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
import math
from pathlib import Path
import struct
import time

from midi_learning import PARSER_VERSION, parse_midi

MASK = 0xFFFFFFFF
GRAM = 8
BASE_A = 16777619
BASE_B = 2246822519
BITS = 1 << 26
HASHES = 6


def mix32(value: int) -> int:
    value ^= value >> 16
    value = value * 2246822507 & MASK
    value ^= value >> 13
    value = value * 3266489909 & MASK
    return (value ^ (value >> 16)) & MASK


def line_hashes(pitches: list[int]) -> set[int]:
    """Paired rolling polynomial hashes, then independent 32-bit avalanches."""
    intervals = [b - a + 128 for a, b in zip(pitches, pitches[1:])]
    if len(intervals) < GRAM:
        return set()
    power_a, power_b = pow(BASE_A, GRAM - 1, 1 << 32), pow(BASE_B, GRAM - 1, 1 << 32)
    a = b = 0
    for value in intervals[:GRAM]:
        a = (a * BASE_A + value) & MASK
        b = (b * BASE_B + value) & MASK
    hashes = {(mix32(a) << 32) | (mix32(b) | 1)}
    for old, new in zip(intervals, intervals[GRAM:]):
        a = ((a - old * power_a) * BASE_A + new) & MASK
        b = ((b - old * power_b) * BASE_B + new) & MASK
        hashes.add((mix32(a) << 32) | (mix32(b) | 1))
    return hashes


def source_hashes(task: tuple[str, str]) -> tuple[bytes, int, int]:
    source_path, expected_sha = task
    raw = Path(source_path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected_sha:
        raise ValueError(f"Source SHA-256 mismatch: {source_path}")
    score = parse_midi(raw)
    voices = defaultdict(dict)
    pitched_notes = 0
    for note in score.notes:
        if note.channel == 9:
            continue
        pitched_notes += 1
        onsets = voices[(note.track, note.port, note.channel)]
        previous = onsets.get(note.start)
        if previous is None:
            onsets[note.start] = (note.pitch, note.pitch)
        else:
            onsets[note.start] = (min(previous[0], note.pitch), max(previous[1], note.pitch))
    hashes = set()
    extracted_lines = 0
    for onsets in voices.values():
        ordered = [pitches for _, pitches in sorted(onsets.items())]
        for side in (0, 1):
            if side == 1 and all(low == high for low, high in ordered):
                continue
            extracted_lines += 1
            hashes.update(line_hashes([pitches[side] for pitches in ordered]))
    # Fixed endian makes worker transport and optional offline inspection stable.
    packed = bytearray(len(hashes) * 8)
    for i, value in enumerate(sorted(hashes)):
        struct.pack_into('<Q', packed, i * 8, value)
    return bytes(packed), pitched_notes, extracted_lines


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--metadata', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=3)
    args = parser.parse_args()
    manifest_bytes, report_bytes = args.manifest.read_bytes(), args.report.read_bytes()
    manifest, report = json.loads(manifest_bytes), json.loads(report_bytes)
    if report['parser_version'] != PARSER_VERSION:
        raise ValueError('Parser version differs from the completed training report')
    by_url = {source['url']: source for source in manifest['sources']}
    learned = [source for source in report['sources'] if source['status'] == 'learned']
    if len(learned) != report['counts']['unique_files']:
        raise ValueError('Learned source count does not match training report')
    tasks = []
    for source in learned:
        saved = by_url[source['url']]
        if saved.get('sha256') != source['sha256'] or saved['status'] != 'downloaded':
            raise ValueError(f"Manifest source mismatch: {source['url']}")
        path = Path(saved['path'])
        if not path.is_absolute():
            path = args.manifest.parent / path
        tasks.append((str(path), source['sha256']))
    bitset = bytearray(BITS // 8)
    counts = Counter()
    began = time.monotonic()
    with ProcessPoolExecutor(max_workers=max(1, min(4, args.workers))) as pool:
        # Bounded batches avoid queuing all raw files or retaining huge results.
        for start in range(0, len(tasks), 32):
            for packed, notes, lines in pool.map(source_hashes, tasks[start:start + 32]):
                counts['indexed_files'] += 1
                counts['pitched_source_notes'] += notes
                counts['extracted_voice_lines'] += lines
                counts['file_unique_hashes_inserted'] += len(packed) // 8
                for (key,) in struct.iter_unpack('<Q', packed):
                    first, step = key >> 32, key & MASK
                    for iteration in range(HASHES):
                        position = (first + iteration * step) & (BITS - 1)
                        bitset[position >> 3] |= 1 << (position & 7)
            if start % 1024 == 0:
                print(f"Indexed {counts['indexed_files']}/{len(tasks)} sources in {time.monotonic()-began:.0f}s", flush=True)
    occupied = sum(value.bit_count() for value in bitset)
    occupancy = occupied / BITS
    binary_sha = hashlib.sha256(bitset).hexdigest()
    metadata = {
        'version': 1, 'kind': 'source_melody_interval_bloom_filter',
        'algorithm': 'polynomial-pair-mix32-bloom-v1',
        'gramIntervals': GRAM, 'notesPerWindow': GRAM + 1,
        'hashes': HASHES, 'bits': BITS, 'bytes': len(bitset),
        'binaryFilename': args.output.name, 'binarySha256': binary_sha,
        'parserVersion': PARSER_VERSION,
        'datasetFingerprint': report['dataset_fingerprint'],
        'manifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
        'trainingReportSha256': hashlib.sha256(report_bytes).hexdigest(),
        'sourceFiles': len(learned), 'sourceSite': manifest['site'],
        'counts': dict(counts), 'occupiedBits': occupied,
        'occupancy': occupancy,
        'estimatedFalsePositivePerWindow': occupancy ** HASHES,
        'estimatedDistinctWindows': -BITS / HASHES * math.log1p(-occupancy),
        'coverage': 'All unique learned sources; top and bottom note at each onset in each pitched track/port/channel.',
        'invariance': ['global pitch transposition', 'tempo', 'note duration', 'instrument', 'velocity'],
        'limitations': [
            'Exact eight-interval membership only; shorter hooks and approximate variations are not guaranteed detectable.',
            'Inner chord voices and melodies split across tracks are not reconstructed.',
            'The conservative Bloom filter can reject novel phrases through hash collisions.',
            'A passing result does not establish perceptual originality, copyright status, or absence of resemblance.',
            'Malformed excluded corpus files and the unavailable new-files database are not indexed.'
        ]
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.metadata.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(bitset)
    metadata_json = json.dumps(metadata, indent=2, sort_keys=True)
    if args.metadata.suffix == '.js':
        args.metadata.write_text('// Generated by scripts/export-midi-originality.py. Contains no source notes.\n'
                                 + 'export const ORIGINALITY_INDEX = Object.freeze(' + metadata_json + ');\n')
    else:
        args.metadata.write_text(metadata_json + '\n')
    print(json.dumps({'output': str(args.output), 'metadata': str(args.metadata),
                      'sourceFiles': len(learned), 'bytes': len(bitset), 'sha256': binary_sha,
                      'occupancy': occupancy, 'estimatedFalsePositivePerWindow': occupancy ** HASHES,
                      'seconds': time.monotonic() - began}, indent=2))


if __name__ == '__main__':
    main()
