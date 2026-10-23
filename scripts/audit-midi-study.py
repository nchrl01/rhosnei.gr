#!/usr/bin/env python3
"""Audit a local VGMusic manifest, learned model, and training report offline.

Checks every source URL and hashes every available raw object. Exit 0 means the
listed accessible archive is accounted for with no unresolved collection,
integrity, or artifact-consistency errors. Explicit parse exclusions may remain;
they are never described as learned. Site comment-page MD5 names are compared as
metadata, whose disagreement alone does not establish file corruption.
"""

from collections import Counter, defaultdict
from datetime import datetime, timezone
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import urlsplit


STATUS_COUNTS = {
    "learned": "unique_files",
    "exact_duplicate": "exact_duplicates",
    "musical_duplicate": "musical_duplicates",
    "skipped": "skipped_files",
    "download_failed": "download_failed",
    "pending_download": "pending_download",
    "missing_local": "missing_local",
}
INTEGRITY_SKIPS = {"manifest_checksum_mismatch", "file_changed", "file_disappeared"}
LOCAL_STATUSES = {"learned", "exact_duplicate", "musical_duplicate", "skipped"}
HEX_SHA = re.compile(r"[0-9a-fA-F]{64}\Z")
MAX_EXAMPLES = 20


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, sort_keys=True, indent=2, ensure_ascii=False)
            stream.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class Issues:
    def __init__(self):
        self.items = {}

    def add(self, code, detail=None, severity="error"):
        item = self.items.setdefault(code, {"code": code, "severity": severity,
                                            "count": 0, "examples": []})
        item["count"] += 1
        if detail is not None and len(item["examples"]) < MAX_EXAMPLES:
            item["examples"].append(detail)

    @property
    def failed(self):
        return any(item["severity"] == "error" for item in self.items.values())

    def export(self):
        return [self.items[key] for key in sorted(self.items)]


def read_artifact(path):
    path = Path(path)
    raw = path.read_bytes()
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value, {"path": str(path.resolve()), "sha256": hashlib.sha256(raw).hexdigest()}


def raw_hashes(path):
    before = path.stat()
    sha, md5, size = hashlib.sha256(), hashlib.md5(), 0
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            sha.update(chunk)
            md5.update(chunk)
            size += len(chunk)
    after = path.stat()
    return {"sha256": sha.hexdigest(), "md5": md5.hexdigest(), "bytes": size,
            "changed_during_read": (before.st_size, before.st_mtime_ns, before.st_ino) !=
                                   (after.st_size, after.st_mtime_ns, after.st_ino)}


def site_md5(comments):
    if not isinstance(comments, str):
        return None
    path = urlsplit(comments).path
    stem = Path(path).stem
    if "/file/" in path and re.fullmatch(r"[0-9a-fA-F]{1,32}", stem):
        # VGMusic's historical comment URLs omit leading hexadecimal zeroes.
        return stem.lower().zfill(32)
    return None


def indexed_rows(rows, label, issues):
    if not isinstance(rows, list):
        raise ValueError(f"{label}.sources must be a list")
    grouped = defaultdict(list)
    for index, row in enumerate(rows):
        if not isinstance(row, dict) or not isinstance(row.get("url"), str) or not row["url"]:
            issues.add(f"invalid_{label}_source", {"index": index})
            continue
        grouped[row["url"]].append(row)
    for url, values in grouped.items():
        if len(values) > 1:
            issues.add(f"duplicate_{label}_url", {"url": url, "rows": len(values)})
    return grouped


def audit(manifest_path, model_path, report_path):
    manifest, manifest_input = read_artifact(manifest_path)
    model, model_input = read_artifact(model_path)
    report, report_input = read_artifact(report_path)
    issues = Issues()
    if model.get("kind") != "aggregate_statistical_music_model" or model.get("version") != 1:
        issues.add("unsupported_model_kind_or_version", {"kind": model.get("kind"), "version": model.get("version")})
    for label, value in (("model", model.get("parser_version")), ("report", report.get("parser_version"))):
        if value is not None and (type(value) is not int or value < 1):
            issues.add("invalid_parser_version", {"artifact": label, "value": value})
    if model.get("parser_version") != report.get("parser_version"):
        issues.add("parser_version_mismatch", {"model": model.get("parser_version"), "report": report.get("parser_version")})
    for label, value in (("model.unique_files", model.get("unique_files")), ("model.notes", model.get("notes"))):
        if type(value) is not int or value < 0:
            issues.add("invalid_model_count", {"field": label, "value": value})
    manifest_rows = manifest.get("sources", [])
    report_rows = report.get("sources", [])
    source_groups = indexed_rows(manifest_rows, "manifest", issues)
    record_groups = indexed_rows(report_rows, "report", issues)
    sources = {url: rows[0] for url, rows in source_groups.items()}
    records = {url: rows[0] for url, rows in record_groups.items()}
    counts, splits, skips = Counter(), Counter(), Counter()
    physical, by_url, failed_urls = {}, {}, []
    failed_url_count, source_bytes = 0, 0
    md5_checked, md5_matches, md5_missing, md5_mismatches = 0, 0, 0, []
    md5_mismatch_count = 0

    def failed_url(url, status, reason=None):
        nonlocal failed_url_count
        failed_url_count += 1
        if len(failed_urls) < MAX_EXAMPLES:
            failed_urls.append({"url": url, "status": status, "reason": reason})

    for url in sorted(set(records) - set(sources)):
        issues.add("unexpected_report_source", {"url": url})
    for url, source in sorted(sources.items()):
        record = records.get(url)
        if record is None:
            counts["missing_report_rows"] += 1
            issues.add("missing_report_source", {"url": url})
        else:
            status = record.get("status")
            if status not in STATUS_COUNTS:
                counts["unknown_report_status"] += 1
                issues.add("unknown_report_status", {"url": url, "status": status})
            else:
                counts[status] += 1
            if status in {"pending_download", "missing_local", "download_failed"}:
                issues.add("unresolved_" + status, {"url": url, "reason": record.get("reason")})
                if status != "pending_download":
                    failed_url(url, status, record.get("reason"))
            if status == "skipped":
                reason = str(record.get("reason") or "unspecified")
                skips[reason] += 1
                failed_url(url, status, reason)
                if reason in INTEGRITY_SKIPS:
                    issues.add("unresolved_integrity_skip", {"url": url, "reason": reason})
            if status == "learned":
                splits[str(record.get("split"))] += 1

        source_status = source.get("status")
        if source_status in {"pending", "error", "failed", "download_failed"} and (
                record is None or record.get("status") not in {"pending_download", "download_failed", "missing_local"}):
            issues.add("unresolved_manifest_status", {"url": url, "status": source_status,
                                                       "report_status": record.get("status") if record else None})

        path_text = source.get("path") or source.get("local_path")
        if not path_text:
            if record and record.get("status") in LOCAL_STATUSES:
                issues.add("missing_manifest_file_path", {"url": url, "status": record.get("status")})
            continue
        path = Path(path_text)
        if not path.is_absolute():
            path = Path(manifest_path).parent / path
        key = str(path.resolve())
        if key not in physical:
            try:
                physical[key] = raw_hashes(path)
            except OSError as error:
                physical[key] = {"error": str(error)}
        actual = physical[key]
        if "error" in actual:
            issues.add("unreadable_local_file", {"url": url, "path": key, "error": actual["error"]})
            continue
        by_url[url] = actual
        source_bytes += actual["bytes"]
        if actual["changed_during_read"]:
            issues.add("file_changed_during_audit", {"url": url, "path": key})
        expected = source.get("sha256")
        if not isinstance(expected, str) or not HEX_SHA.fullmatch(expected):
            issues.add("missing_or_invalid_manifest_sha256", {"url": url})
        elif expected.lower() != actual["sha256"]:
            issues.add("manifest_sha256_mismatch", {"url": url, "expected": expected, "actual": actual["sha256"]})
        if source.get("bytes") is not None and source["bytes"] != actual["bytes"]:
            issues.add("manifest_byte_count_mismatch", {"url": url, "expected": source["bytes"], "actual": actual["bytes"]})
        if record and (record.get("sha256") is not None or record.get("status") in {"learned", "exact_duplicate", "musical_duplicate"}):
            if record.get("sha256") != actual["sha256"]:
                issues.add("report_sha256_mismatch", {"url": url, "expected": record.get("sha256"), "actual": actual["sha256"]})
        expected_md5 = site_md5(source.get("comments"))
        if expected_md5:
            md5_checked += 1
            if expected_md5 == actual["md5"]:
                md5_matches += 1
            else:
                md5_mismatch_count += 1
                mismatch = {"url": url, "title": source.get("title"), "comments_url": source.get("comments"),
                            "expected": expected_md5, "actual": actual["md5"]}
                issues.add("site_md5_metadata_mismatch", mismatch, severity="warning")
                if len(md5_mismatches) < MAX_EXAMPLES:
                    md5_mismatches.append(mismatch)
        else:
            md5_missing += 1

    fingerprints, learned_by_fingerprint, games = [], {}, {}
    for url, record in sorted(records.items()):
        if url not in sources:
            continue
        status = record.get("status")
        if status == "learned":
            fingerprint = record.get("fingerprint")
            if not isinstance(fingerprint, str) or not HEX_SHA.fullmatch(fingerprint):
                issues.add("invalid_learned_fingerprint", {"url": url, "fingerprint": fingerprint})
                continue
            if fingerprint in learned_by_fingerprint:
                issues.add("duplicate_learned_fingerprint", {"url": url, "other_url": learned_by_fingerprint[fingerprint]})
            learned_by_fingerprint[fingerprint] = url
            fingerprints.append(fingerprint)
            if record.get("split") not in {"training", "validation"}:
                issues.add("invalid_learned_split", {"url": url, "split": record.get("split")})
            game = str(record.get("game") or "").strip().casefold()
            if game and game in games and games[game] != record.get("split"):
                issues.add("game_crosses_holdout_split", {"url": url, "game": game})
            games[game] = record.get("split")
        elif status in {"exact_duplicate", "musical_duplicate"}:
            target_url = record.get("duplicate_of")
            target = records.get(target_url)
            if target_url == url or target is None or target_url not in sources:
                issues.add("invalid_duplicate_reference", {"url": url, "duplicate_of": target_url})
                continue
            if status == "exact_duplicate":
                if not record.get("sha256") or record.get("sha256") != target.get("sha256"):
                    issues.add("exact_duplicate_hash_mismatch", {"url": url, "duplicate_of": target_url})
                if url in by_url and target_url in by_url and by_url[url]["sha256"] != by_url[target_url]["sha256"]:
                    issues.add("physical_duplicate_hash_mismatch", {"url": url, "duplicate_of": target_url})
            elif target.get("status") != "learned" or not record.get("fingerprint") or record.get("fingerprint") != target.get("fingerprint"):
                issues.add("musical_duplicate_reference_mismatch", {"url": url, "duplicate_of": target_url})

    expected_counts = {"manifest_sources": len(manifest_rows),
                       **{name: counts[status] for status, name in STATUS_COUNTS.items()},
                       "training_files": splits["training"], "validation_files": splits["validation"]}
    for name, expected in expected_counts.items():
        actual = report.get("counts", {}).get(name, 0)
        if actual != expected:
            issues.add("training_count_mismatch", {"field": name, "expected": expected, "actual": actual})
    if dict(sorted(skips.items())) != report.get("skip_reasons", {}):
        issues.add("skip_reason_count_mismatch", {"expected": dict(skips), "actual": report.get("skip_reasons")})
    if model.get("unique_files") != counts["learned"]:
        issues.add("model_unique_file_count_mismatch", {"expected": counts["learned"], "actual": model.get("unique_files")})
    if model.get("notes") != report.get("totals", {}).get("notes", 0):
        issues.add("model_note_count_mismatch", {"model": model.get("notes"), "report": report.get("totals", {}).get("notes")})
    if not counts["learned"]:
        issues.add("no_files_learned")
    calculated_fingerprint = hashlib.sha256("\n".join(sorted(set(fingerprints))).encode()).hexdigest()
    for label, value in (("model", model.get("dataset_fingerprint")), ("report", report.get("dataset_fingerprint"))):
        if value != calculated_fingerprint:
            issues.add("dataset_fingerprint_mismatch", {"artifact": label, "expected": calculated_fingerprint, "actual": value})
    reconciled = sum(counts[status] for status in STATUS_COUNTS)
    if reconciled != len(manifest_rows) or len(report_rows) != len(manifest_rows):
        issues.add("source_accounting_mismatch", {"manifest": len(manifest_rows), "report": len(report_rows), "reconciled": reconciled})
    section_rows = manifest.get("sections", [])
    section_counts = Counter(str(row.get("status", "unknown")) for row in section_rows)
    section_diagnostics = [{key: row[key] for key in ("url", "section", "status", "listed", "message", "error") if key in row}
                           for row in section_rows if row.get("status") != "ok" or row.get("message") or row.get("error")]
    if section_diagnostics:
        issues.add("inventory_scope_limited", {"unavailable_or_empty_sections": len(section_diagnostics)}, severity="warning")
    accessible_sources = {row.get("url") for row in section_rows if row.get("status") == "ok"}
    section_totals = sum(row.get("listed", 0) for row in section_rows if isinstance(row.get("listed", 0), int))
    valid_physical = [value for value in physical.values() if "error" not in value]
    passed = not issues.failed
    limitations = list(model.get("limitations", [])) + [
        "Completion applies to the manifest's listed accessible URLs; unavailable or empty index sections are reported separately.",
        "Malformed or unsupported files are explicit parse exclusions and are not counted as learned.",
        "Physical SHA-256 verifies agreement with the collector and report; a site MD5 mismatch alone cannot distinguish stale metadata from changed content.",
        "Musical fingerprints and note totals are checked against the training report without re-parsing every MIDI or independently re-training the model.",
        "The final model contains training and validation files; reported holdout metrics come from the trainer's separate split and are not a listening quality score.",
    ]
    return {
        "version": 1, "audited_at": datetime.now(timezone.utc).isoformat(),
        "status": "incomplete_or_inconsistent" if not passed else "complete_with_parse_skips" if counts["skipped"] else "complete",
        "audit_passed": passed,
        "accessible_archive_complete": passed,
        "all_readable_unique_files_learned": passed,
        "all_nonduplicate_files_learned": passed and not counts["skipped"],
        "scope": "Currently listed accessible archive URLs in the supplied manifest",
        "inputs": {"manifest": manifest_input, "model": model_input, "training_report": report_input},
        "parser_version": model.get("parser_version"),
        "dataset_fingerprint": calculated_fingerprint,
        "counts": {"manifest_sources": len(manifest_rows), "report_rows": len(report_rows),
                   "reconciled_sources": reconciled,
                   **{status: counts[status] for status in STATUS_COUNTS},
                   "missing_report_rows": counts["missing_report_rows"], "unknown_report_status": counts["unknown_report_status"],
                   "training_files": splits["training"], "validation_files": splits["validation"],
                   "model_notes": model.get("notes"), "physical_source_urls_checked": len(by_url),
                   "physical_files_checked": len(valid_physical),
                   "available_urls_awaiting_report_update": sum(records.get(url, {}).get("status") in
                       {None, "pending_download", "missing_local", "download_failed"} for url in by_url),
                   "distinct_physical_sha256": len({value["sha256"] for value in valid_physical})},
        "manifest_statuses": dict(sorted(Counter(str(row.get("status") or "unspecified") for row in sources.values()).items())),
        "bytes": {"physical_files": sum(value["bytes"] for value in valid_physical), "source_urls_including_duplicates": source_bytes},
        "deduplication": report.get("deduplication", {}),
        "parse_skip_reasons": dict(sorted(skips.items())),
        "failed_urls": {"count": failed_url_count, "examples": failed_urls, "examples_omitted": max(0, failed_url_count - len(failed_urls))},
        "site_md5": {"checked": md5_checked, "matched": md5_matches, "missing_metadata": md5_missing,
                     "mismatches": md5_mismatch_count, "mismatch_examples": md5_mismatches,
                     "interpretation": "Site comment URL metadata comparison; disagreement is not by itself proof of corruption."},
        "section_coverage": {"sections": len(section_rows), "statuses": dict(sorted(section_counts.items())),
                             "accessible_sections": len(accessible_sources), "listed_links_before_url_dedup": section_totals,
                             "inventory_scope_limited": bool(section_diagnostics), "diagnostics": section_diagnostics},
        "validation": report.get("validation", {}), "parser_warnings": report.get("parser_warnings", {}),
        "issues": issues.export(), "limitations": limitations,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for name in ("manifest", "model", "report", "output"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    try:
        result = audit(args.manifest, args.model, args.report)
        atomic_json(args.output, result)
    except (OSError, ValueError, TypeError, KeyError) as error:
        print(f"Audit failed: {error}", file=sys.stderr)
        return 2
    print(json.dumps({"status": result["status"], "audit_passed": result["audit_passed"],
                      "counts": result["counts"], "parse_skip_reasons": result["parse_skip_reasons"],
                      "site_md5_mismatches": result["site_md5"]["mismatches"],
                      "inventory_scope_limited": result["section_coverage"]["inventory_scope_limited"],
                      "output": str(Path(args.output).resolve())}, indent=2))
    return 0 if result["audit_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
