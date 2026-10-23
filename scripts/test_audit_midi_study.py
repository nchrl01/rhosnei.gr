"""Focused offline checks for corpus completion and integrity audit decisions."""

from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location("audit_midi_study", Path(__file__).with_name("audit-midi-study.py"))
auditor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auditor)


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.sources, self.records = [], []
        self.fingerprint = hashlib.sha256(b"abstract musical events").hexdigest()
        self.add("a", b"original raw bytes", "learned")
        self.add("copy", b"original raw bytes", "exact_duplicate", target="a")
        self.add("arrangement", b"different metadata raw bytes", "musical_duplicate", target="a")

    def add(self, name, raw, status, target=None, reason=None):
        url = "https://www.vgmusic.com/music/test/" + name + ".mid"
        source = {"url": url, "title": name, "status": "downloaded"}
        record = {"url": url, "status": status}
        if raw is not None:
            path = self.root / (name + ".mid")
            path.write_bytes(raw)
            sha = hashlib.sha256(raw).hexdigest()
            md5 = hashlib.md5(raw).hexdigest()
            source.update(path=path.name, sha256=sha, bytes=len(raw),
                          comments="https://www.vgmusic.com/file/" + md5.lstrip("0") + ".html")
            record.update(path=str(path), sha256=sha)
        if status in {"learned", "musical_duplicate"}:
            record["fingerprint"] = self.fingerprint
        if status == "learned":
            record.update(split="training", game="Test game")
        if target:
            record["duplicate_of"] = "https://www.vgmusic.com/music/test/" + target + ".mid"
        if reason:
            record["reason"] = reason
        self.sources.append(source)
        self.records.append(record)
        return source, record

    def documents(self):
        learned = [row for row in self.records if row["status"] == "learned"]
        dataset = hashlib.sha256("\n".join(sorted({row["fingerprint"] for row in learned})).encode()).hexdigest()
        counts = Counter(row["status"] for row in self.records)
        report = {"sources": self.records, "counts": {"manifest_sources": len(self.sources),
                  **{name: counts[status] for status, name in auditor.STATUS_COUNTS.items()},
                  "training_files": len(learned), "validation_files": 0},
                  "skip_reasons": dict(Counter(row["reason"] for row in self.records if row["status"] == "skipped")),
                  "dataset_fingerprint": dataset, "totals": {"notes": 24}}
        manifest = {"sources": self.sources, "sections": [
            {"url": "https://www.vgmusic.com/music/test/", "status": "ok", "listed": len(self.sources)},
            {"url": "https://www.vgmusic.com/new-files/", "status": "no_files_listed", "listed": 0,
             "message": "Website database connection failed"}]}
        model = {"kind": "aggregate_statistical_music_model", "version": 1,
                 "unique_files": len(learned), "notes": 24, "dataset_fingerprint": dataset}
        return manifest, model, report

    def run_audit(self, docs=None):
        docs = docs or self.documents()
        paths = [self.root / name for name in ("manifest.json", "model.json", "report.json")]
        for path, value in zip(paths, docs):
            path.write_text(json.dumps(value))
        return auditor.audit(*paths)

    def test_complete_archive_and_duplicate_references_with_unavailable_new_files(self):
        result = self.run_audit()
        self.assertTrue(result["audit_passed"])
        self.assertTrue(result["all_nonduplicate_files_learned"])
        self.assertEqual(result["counts"]["reconciled_sources"], 3)
        self.assertEqual(result["counts"]["distinct_physical_sha256"], 2)
        self.assertEqual(result["site_md5"]["matched"], 3)
        self.assertTrue(result["section_coverage"]["inventory_scope_limited"])

    def test_pending_failed_and_missing_are_accounted_for_but_fail_completion(self):
        self.add("pending", None, "pending_download")
        self.add("failed", None, "download_failed", reason="HTTP 404")
        source, _ = self.add("missing", None, "missing_local", reason="File missing")
        source["path"] = "missing.mid"
        result = self.run_audit()
        self.assertFalse(result["audit_passed"])
        self.assertEqual(result["counts"]["reconciled_sources"], 6)
        self.assertEqual(result["counts"]["pending_download"], 1)
        self.assertEqual(result["counts"]["download_failed"], 1)
        self.assertEqual(result["counts"]["missing_local"], 1)

    def test_physical_tampering_fails_even_with_consistent_report_and_model(self):
        docs = self.documents()
        (self.root / "a.mid").write_bytes(b"modified raw bytes")
        result = self.run_audit(docs)
        codes = {issue["code"] for issue in result["issues"]}
        self.assertFalse(result["audit_passed"])
        self.assertIn("manifest_sha256_mismatch", codes)
        self.assertIn("report_sha256_mismatch", codes)
        self.assertIn("physical_duplicate_hash_mismatch", codes)

    def test_short_md5_names_are_padded_and_stale_site_metadata_is_not_corruption(self):
        self.assertEqual(auditor.site_md5("https://www.vgmusic.com/file/abc.html"), "0" * 29 + "abc")
        raw = next(str(n).encode() for n in range(1000) if hashlib.md5(str(n).encode()).hexdigest().startswith("0"))
        source, record = self.add("leading-zero", raw, "skipped", reason="not_midi")
        result = self.run_audit()
        self.assertEqual(result["site_md5"]["matched"], 4)
        source["comments"] = "https://www.vgmusic.com/file/abc.html"
        result = self.run_audit()
        self.assertTrue(result["audit_passed"])
        self.assertEqual(result["site_md5"]["mismatches"], 1)
        example = result["site_md5"]["mismatch_examples"][0]
        self.assertEqual(example["expected"], "0" * 29 + "abc")
        self.assertEqual(example["actual"], hashlib.md5(raw).hexdigest())
        self.assertEqual(example["url"], source["url"])

    def test_missing_rows_model_count_and_dataset_mismatch_fail(self):
        docs = self.documents()
        docs[2]["sources"] = self.records[:-1]
        docs[1]["unique_files"] = 2
        docs[1]["dataset_fingerprint"] = "f" * 64
        result = self.run_audit(docs)
        codes = {issue["code"] for issue in result["issues"]}
        self.assertFalse(result["audit_passed"])
        self.assertIn("missing_report_source", codes)
        self.assertIn("model_unique_file_count_mismatch", codes)
        self.assertIn("dataset_fingerprint_mismatch", codes)

    def test_parse_exclusions_are_disclosed_and_integrity_exclusions_fail(self):
        _, record = self.add("malformed", b"bad", "skipped", reason="invalid_data")
        result = self.run_audit()
        self.assertEqual(result["status"], "complete_with_parse_skips")
        self.assertTrue(result["all_readable_unique_files_learned"])
        self.assertFalse(result["all_nonduplicate_files_learned"])
        record["reason"] = "file_changed"
        result = self.run_audit()
        self.assertFalse(result["audit_passed"])

    def test_wrong_duplicate_target_cannot_pass_accounting_only(self):
        self.records[1]["duplicate_of"] = self.records[2]["url"]
        result = self.run_audit()
        self.assertFalse(result["audit_passed"])
        self.assertIn("exact_duplicate_hash_mismatch", {issue["code"] for issue in result["issues"]})

    def test_failed_manifest_refresh_is_not_hidden_by_an_older_readable_file(self):
        self.sources[0]["status"] = "error"
        result = self.run_audit()
        self.assertFalse(result["audit_passed"])
        self.assertIn("unresolved_manifest_status", {issue["code"] for issue in result["issues"]})


if __name__ == "__main__":
    unittest.main()
