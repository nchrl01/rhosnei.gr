#!/usr/bin/env python3
"""Learn aggregate phrase statistics from a local, resumable MIDI manifest.

Example:
 python3 scripts/train-vgmusic-model.py --manifest .local/vgmusic/manifest.json \
   --output .local/vgmusic/model.json --report .local/vgmusic/training-report.json

Rerun while a downloader progresses: every invocation reads a manifest snapshot,
reuses SHA-keyed SQLite results and rewrites artifacts atomically. No network,
browser, public-file writes or runtime activation are performed. Default workers=1
keeps this modest on a laptop; --workers 2..4 permits bounded parallel parsing.
"""

from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from contextlib import nullcontext
import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import zlib

from midi_learning import (COMPATIBLE_CACHE_VERSIONS, MAX_BYTES, PARSER_VERSION, MidiError, add_features, export_distributions,
                           extract_features, musical_fingerprint, parse_midi,
                           validation_metrics)

MODEL_VERSION = 1


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, sort_keys=True, indent=2)
            stream.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def analyze(item):
    sha, data = item
    try:
        score = parse_midi(data)
        features, stats = extract_features(score)
        return sha, {"fingerprint": musical_fingerprint(score), "features": features,
                     "stats": stats, "warnings": score.warnings, "events": score.events,
                     "meters": score.meters}
    except MidiError as error:
        return sha, {"error": error.code, "message": str(error)}
    except Exception as error:
        return sha, {"error": "parser_error", "message": f"{type(error).__name__}: {error}"}


def file_sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def training(manifest_path, output_path, report_path, cache_path=None, workers=1):
    manifest_path, output_path, report_path = map(Path, (manifest_path, output_path, report_path))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    sources = manifest.get("sources", [])
    if not isinstance(sources, list):
        raise ValueError("Manifest.sources must be a list")
    cache_path = Path(cache_path) if cache_path else output_path.parent / "parsed-midi.sqlite3"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(cache_path)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("CREATE TABLE IF NOT EXISTS parsed (sha TEXT PRIMARY KEY, version INTEGER, payload BLOB)")
    counters = Counter(manifest_sources=len(sources))
    source_statuses = Counter(str(source.get("status") or "unspecified") for source in sources)
    errors, warnings, records, sha_sources = Counter(), Counter(), [], {}
    # URLs provide deterministic ordering even as asynchronous downloads finish.
    for source in sorted(sources, key=lambda row: (str(row.get("url", "")), str(row.get("path", "")))):
        path_text = source.get("path") or source.get("local_path")
        if not path_text:
            source_status = source.get("status") or "pending"
            category = ("download_failed" if source_status in ("failed", "error", "download_failed") else
                        "missing_local" if source_status in ("downloaded", "complete", "ok", "success") else "pending_download")
            counters[category] += 1
            records.append({"url": source.get("url"), "status": category,
                            "source_status": source_status, "reason": source.get("error") or "No local file path in manifest"})
            continue
        path = Path(path_text)
        if not path.is_absolute():
            path = manifest_path.parent / path
        try:
            if path.stat().st_size > MAX_BYTES:
                counters["skipped_files"] += 1
                errors["oversize"] += 1
                records.append({"url": source.get("url"), "path": str(path), "status": "skipped",
                                "reason": "oversize", "detail": f"Input exceeds {MAX_BYTES} bytes"})
                continue
            sha = file_sha(path)
        except OSError as error:
            counters["missing_local"] += 1
            records.append({"url": source.get("url"), "path": str(path), "status": "missing_local",
                            "source_status": source.get("status"), "reason": str(error)})
            continue
        counters["available_files"] += 1
        if source.get("sha256") and source["sha256"] != sha:
            counters["manifest_checksum_mismatches"] += 1
            counters["skipped_files"] += 1
            errors["manifest_checksum_mismatch"] += 1
            records.append({"url": source.get("url"), "path": str(path), "status": "skipped",
                            "reason": "manifest_checksum_mismatch", "expected_sha256": source["sha256"], "sha256": sha})
            continue
        if sha in sha_sources:
            counters["exact_duplicates"] += 1
            records.append({"url": source.get("url"), "status": "exact_duplicate",
                            "duplicate_of": sha_sources[sha].get("url"), "sha256": sha})
            continue
        sha_sources[sha] = source
        records.append({"url": source.get("url"), "path": str(path), "sha256": sha,
                        "game": source.get("game", ""), "status": "pending"})
    pending = []
    for sha, source in sha_sources.items():
        cached = connection.execute("SELECT version,payload FROM parsed WHERE sha=?", (sha,)).fetchone()
        if cached:
            try:
                version, payload = cached
                result = json.loads(zlib.decompress(payload))
                compatible = version in COMPATIBLE_CACHE_VERSIONS and result.get("error") != "system_status"
                if version == PARSER_VERSION or compatible:
                    if compatible:
                        connection.execute("UPDATE parsed SET version=? WHERE sha=?", (PARSER_VERSION, sha))
                        counters["compatible_cache_hits"] += 1
                    counters["cache_hits"] += 1
                    continue
            except (ValueError, zlib.error):
                pass
        path = Path(source.get("path") or source.get("local_path"))
        if not path.is_absolute():
            path = manifest_path.parent / path
        pending.append((sha, path))
    connection.commit()
    # At most 16 input files are resident while parsing; a 30k corpus never needs
    # to load all MIDI bytes together. SQLite commits make interruption resumable.
    volatile_errors = {}
    with ProcessPoolExecutor(max_workers=workers) if workers > 1 else nullcontext() as pool:
        for start in range(0, len(pending), 16):
            batch = []
            for sha, path in pending[start:start + 16]:
                try:
                    data = path.read_bytes()
                    if hashlib.sha256(data).hexdigest() != sha:
                        volatile_errors[sha] = {"error": "file_changed", "message": "File changed while training; rerun after the writer completes"}
                    else:
                        batch.append((sha, data))
                except OSError as error:
                    volatile_errors[sha] = {"error": "file_disappeared", "message": str(error)}
            iterator = pool.map(analyze, batch) if pool else map(analyze, batch)
            for sha, result in iterator:
                payload = zlib.compress(json.dumps(result, separators=(",", ":"), sort_keys=True).encode())
                connection.execute("INSERT OR REPLACE INTO parsed VALUES (?,?,?)", (sha, PARSER_VERSION, payload))
                counters["newly_parsed"] += 1
            connection.commit()
            if start % 256 == 0:
                print(f"Parsed {min(start + 16, len(pending))}/{len(pending)} uncached files", file=sys.stderr, flush=True)
    fingerprints = {}
    all_features, training_features, validation_features = {}, {}, {}
    totals, support = Counter(), Counter()
    for record in records:
        if record["status"] != "pending":
            continue
        sha = record["sha256"]
        if sha in volatile_errors:
            result = volatile_errors[sha]
        else:
            cached = connection.execute("SELECT payload FROM parsed WHERE sha=? AND version=?", (sha, PARSER_VERSION)).fetchone()
            result = json.loads(zlib.decompress(cached[0]))
        if "error" in result:
            record.update(status="skipped", reason=result["error"], detail=result["message"])
            errors[result["error"]] += 1
            counters["skipped_files"] += 1
            continue
        counters["valid_files_before_musical_dedup"] += 1
        fingerprint = result["fingerprint"]
        if fingerprint in fingerprints:
            record.update(status="musical_duplicate", fingerprint=fingerprint,
                          duplicate_of=fingerprints[fingerprint]["url"])
            counters["musical_duplicates"] += 1
            continue
        fingerprints[fingerprint] = record
        # Group by game when metadata is available, otherwise by complete musical
        # fingerprint. All duplicate arrangements are removed before splitting.
        group = str(record.get("game") or "").strip().casefold() or fingerprint
        held_out = int(hashlib.sha256(group.encode()).hexdigest()[:8], 16) % 10 == 0
        record.update(status="learned", fingerprint=fingerprint, split="validation" if held_out else "training")
        counters["unique_files"] += 1
        counters["validation_files" if held_out else "training_files"] += 1
        warnings.update(result["warnings"])
        totals.update(result["stats"])
        totals["midi_events"] += result["events"]
        support.update(result["features"].keys())
        add_features(all_features, result["features"])
        add_features(validation_features if held_out else training_features, result["features"])
    dataset_hash = hashlib.sha256("\n".join(sorted(fingerprints)).encode()).hexdigest()
    reconciled_sources = sum(counters[key] for key in ("unique_files", "exact_duplicates", "musical_duplicates", "skipped_files", "pending_download", "download_failed", "missing_local"))
    accounting_complete = len(records) == len(sources) == reconciled_sources
    downloads_complete = not any(counters[key] for key in ("pending_download", "download_failed", "missing_local"))
    all_listed_files_learned = accounting_complete and downloads_complete and not counters["skipped_files"]
    model = {
        "version": MODEL_VERSION, "parser_version": PARSER_VERSION, "kind": "aggregate_statistical_music_model",
        "dataset_fingerprint": dataset_hash, "unique_files": counters["unique_files"],
        "notes": totals["notes"], "grid_per_beat": 96,
        "weighting": "Each unique file contributes unit weight per available distribution after repeated voice-bar and 2/3/4-note fragment suppression. Phrase/activity observations retain all eight bar phases.",
        "distributions": export_distributions(all_features),
        "support_files": dict(sorted(support.items())),
        "limitations": ["No neural training or audio synthesis; MIDI note structure only.",
                        "Phrase windows are 16/32 quarter-note beats; meter changes are not segmented.",
                        "Top and bottom simultaneous voices approximate melody/bass; no semantic voice separation.",
                        "Voice activity spans its first onset through last release; leading/trailing orchestration rests are not modeled.",
                        "Interval and timing transitions cross barlines; exact repeated fragments are suppressed. Silence and held-note occupancy across bars are included.",
                        "Format 2 tracks are independent sequences. SMPTE files are counted as unsupported; expressive bend/controllers beyond sustain are ignored."]}
    report = {
        "version": 1, "parser_version": PARSER_VERSION, "dataset_fingerprint": dataset_hash, "counts": dict(sorted(counters.items())),
        "totals": dict(sorted(totals.items())), "skip_reasons": dict(sorted(errors.items())),
        "parser_warnings": dict(sorted(warnings.items())),
        "manifest_statuses": dict(sorted(source_statuses.items())),
        "coverage": {"reported_sources": len(records),
                     "reconciled_sources": reconciled_sources,
                     "accounting_complete": accounting_complete,
                     "downloads_complete": downloads_complete,
                     "all_listed_files_learned": all_listed_files_learned,
                     "complete": all_listed_files_learned},
        "deduplication": {"exact": "SHA-256 of bytes", "musical": "Sorted simultaneous and sequential events; 1/96-beat onset/duration; leading silence removed; global transpose removed; tempo/velocity/program/track metadata ignored; drum pitches retained."},
        "validation": {"method": "Deterministic 10% holdout by normalized game name (or full musical fingerprint when absent); deduplicate before split. Final exported model includes all unique files.",
                       "metrics": validation_metrics(training_features, validation_features),
                       "interpretation": "Smoothed held-out distribution cross-entropy; this is not a listening quality score."},
        "sources": records,
    }
    atomic_json(output_path, model)
    atomic_json(report_path, report)
    connection.close()
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--cache")
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=1)
    args = parser.parse_args()
    report = training(args.manifest, args.output, args.report, args.cache, args.workers)
    print(json.dumps({"counts": report["counts"], "totals": report["totals"], "skip_reasons": report["skip_reasons"]}, indent=2))
    return 0 if report["counts"].get("unique_files", 0) else 2


if __name__ == "__main__":
    raise SystemExit(main())
