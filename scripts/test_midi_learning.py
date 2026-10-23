"""Offline regression checks: python3 -m unittest discover -s scripts -p test_midi_learning.py."""

from collections import Counter
import importlib.util
import json
import hashlib
from pathlib import Path
import sqlite3
import struct
import tempfile
import unittest
import zlib

from midi_learning import (MidiError, Note, Score, extract_features, musical_fingerprint,
                           parse_midi, validation_metrics)

spec = importlib.util.spec_from_file_location("train_vgmusic", Path(__file__).with_name("train-vgmusic-model.py"))
trainer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trainer)


def vlq(value):
    output = [value & 127]
    value >>= 7
    while value:
        output.append(128 | (value & 127))
        value >>= 7
    return bytes(reversed(output))


def event(delta, payload):
    return vlq(delta) + bytes(payload)


def midi(tracks, ppq=480, midi_format=None):
    if midi_format is None:
        midi_format = 1 if len(tracks) > 1 else 0
    return b"MThd" + struct.pack(">IHHH", 6, midi_format, len(tracks), ppq) + b"".join(
        b"MTrk" + struct.pack(">I", len(track)) + track for track in tracks)


def tune(pitches=(60, 62, 64, 67), ppq=480, velocity=80, prefix=b"", repeats=1):
    track = prefix
    for _ in range(repeats):
        for pitch in pitches:
            track += event(0, [0x90, pitch, velocity]) + event(ppq, [0x90, pitch, 0])
    return midi([track + event(0, [0xFF, 0x2F, 0])], ppq)


class ParserTests(unittest.TestCase):
    def test_note_lengths_running_status_and_velocity_zero(self):
        track = (event(0, [0x90, 60, 90]) + event(240, [64, 80]) +
                 event(240, [60, 0]) + event(480, [64, 0]) + event(0, [0xFF, 0x2F, 0]))
        score = parse_midi(midi([track]))
        self.assertEqual([(n.start, n.duration, n.pitch) for n in score.notes], [(0, 480, 60), (240, 720, 64)])

    def test_tempo_changes_do_not_change_beat_structure(self):
        tempo = event(0, [0xFF, 0x51, 3, 6, 0, 0])
        a, b = parse_midi(tune()), parse_midi(tune(ppq=960, prefix=tempo))
        self.assertEqual(musical_fingerprint(a), musical_fingerprint(b))

    def test_sustain_extends_notes_until_pedal_release(self):
        track = (event(0, [0xB0, 64, 127]) + event(0, [0x90, 60, 90]) +
                 event(240, [0x80, 60, 0]) + event(720, [0xB0, 64, 0]) + event(0, [0xFF, 0x2F, 0]))
        self.assertEqual(parse_midi(midi([track])).notes[0].duration, 960)

    def test_sustain_held_note_does_not_steal_retrigger(self):
        track = (event(0, [0xB0, 64, 127]) + event(0, [0x90, 60, 90]) +
                 event(120, [0x80, 60, 0]) + event(120, [0x90, 60, 70]) +
                 event(120, [0x80, 60, 0]) + event(120, [0xB0, 64, 0]) + event(0, [0xFF, 0x2F, 0]))
        self.assertEqual([(n.start, n.duration) for n in parse_midi(midi([track])).notes], [(0, 480), (240, 240)])

    def test_format1_pedal_on_conductor_track_controls_note_track(self):
        controller = event(0, [0xB3, 64, 127]) + event(960, [0xB3, 64, 0]) + event(0, [0xFF, 0x2F, 0])
        player = event(0, [0x93, 64, 80]) + event(240, [0x83, 64, 0]) + event(0, [0xFF, 0x2F, 0])
        score = parse_midi(midi([controller, player]))
        self.assertEqual(score.notes[0].duration, 960)
        self.assertEqual(score.notes[0].track, 1)
        independent = parse_midi(midi([controller, player], midi_format=2))
        self.assertEqual(independent.notes[0].duration, 240)

    def test_midi_ports_isolate_pedal_and_note_state(self):
        controller = event(0, [0xFF, 0x21, 1, 1]) + event(0, [0xB3, 64, 127]) + event(960, [0xB3, 64, 0]) + event(0, [0xFF, 0x2F, 0])
        player = event(0, [0x93, 64, 80]) + event(240, [0x83, 64, 0]) + event(0, [0xFF, 0x2F, 0])
        different_port = parse_midi(midi([controller, player]))
        same_port = parse_midi(midi([controller, event(0, [0xFF, 0x21, 1, 1]) + player]))
        self.assertEqual(different_port.notes[0].duration, 240)
        self.assertEqual(same_port.notes[0].duration, 960)
        self.assertEqual(same_port.notes[0].port, 1)

    def test_note_off_can_be_on_another_track_of_same_port_and_channel(self):
        a = event(0, [0x90, 60, 80]) + event(0, [0xFF, 0x2F, 0])
        b = event(480, [0x80, 60, 0]) + event(0, [0xFF, 0x2F, 0])
        score = parse_midi(midi([a, b]))
        self.assertEqual([(n.track, n.duration) for n in score.notes], [(0, 480)])
        self.assertFalse(score.warnings)

    def test_legacy_running_status_after_meta_recovers_known_channel_only(self):
        track = (event(0, [0x90, 60, 90]) + event(240, [0xFF, 1, 1, 65]) +
                 event(240, [60, 0]) + event(0, [0xFF, 0x2F, 0]))
        score = parse_midi(midi([track]))
        self.assertEqual(score.notes[0].duration, 480)
        self.assertEqual(score.warnings["running_status_after_meta"], 1)
        with self.assertRaises(MidiError):
            parse_midi(midi([event(0, [0xFF, 1, 1, 65]) + event(0, [60, 0])]))
        sysex = event(0, [0x90, 60, 90]) + event(0, [0xF0, 1, 0xF7]) + event(240, [60, 0])
        with self.assertRaises(MidiError):
            parse_midi(midi([sysex]))

    def test_defined_realtime_transport_preserves_running_status(self):
        for realtime in (0xF8, 0xFA, 0xFB, 0xFC, 0xFE):
            track = event(0, [0x90, 60, 90]) + event(240, [realtime]) + event(240, [60, 0]) + event(0, [0xFF, 0x2F, 0])
            score = parse_midi(midi([track]))
            self.assertEqual(score.notes[0].duration, 480)
            self.assertEqual(score.warnings["realtime_transport_ignored"], 1)
        for undefined in (0xF4, 0xF5, 0xF9, 0xFD):
            with self.assertRaises(MidiError):
                parse_midi(midi([event(0, [undefined])]))

    def test_sysex_meta_and_riff_wrapper(self):
        data = tune(prefix=event(0, [0xF0, 3, 1, 2, 0xF7]) + event(0, [0xFF, 3, 3, 65, 66, 67]))
        payload = b"RMID" + b"JUNK" + struct.pack("<I", 1) + b"x\0" + b"data" + struct.pack("<I", len(data)) + data
        wrapped = b"RIFF" + struct.pack("<I", len(payload)) + payload
        self.assertEqual(musical_fingerprint(parse_midi(data)), musical_fingerprint(parse_midi(wrapped)))

    def test_bounds_reject_malformed_file_instead_of_partial_training(self):
        bad = [b"", tune()[:-1], midi([event(0, [0x90, 60])]),
               midi([b"\x81\x81\x81\x81\x00"]), midi([event(0, [60, 0])]),
               midi([event(0, [0xFF, 3, 20, 1])]), midi([event(0, [0xF0, 20, 1])])]
        for value in bad:
            with self.subTest(value=value[:20]), self.assertRaises(MidiError):
                parse_midi(value)

    def test_format_2_remains_independent_and_smpte_is_explicit(self):
        a = event(0, [0x90, 60, 80]) + event(480, [0x80, 60, 0]) + event(0, [0xFF, 0x2F, 0])
        b = event(0, [0x90, 72, 80]) + event(480, [0x80, 72, 0]) + event(0, [0xFF, 0x2F, 0])
        sequential, simultaneous = parse_midi(midi([a, b], midi_format=2)), parse_midi(midi([a, b]))
        self.assertEqual(len(sequential.notes), 2)
        self.assertNotEqual(musical_fingerprint(sequential), musical_fingerprint(simultaneous))
        with self.assertRaises(MidiError) as error:
            parse_midi(midi([a], ppq=0xE728))
        self.assertEqual(error.exception.code, "smpte")

    def test_drums_kept_separate_from_pitched_learning(self):
        notes = [Note(i * 480, 240, pitch, 80, 0, 9) for i, pitch in enumerate((36, 38, 42, 38))]
        features, stats = extract_features(Score(480, notes, {}, 8, 0, []))
        self.assertEqual(stats["drum_notes"], 4)
        self.assertIn("drums.note", features)
        self.assertNotIn("lead.interval", features)
        self.assertNotIn("bass.interval", features)


class MusicalLearningTests(unittest.TestCase):
    def test_fingerprint_ignores_transpose_metadata_velocity_programs(self):
        a = parse_midi(tune())
        b = parse_midi(tune((65, 67, 69, 72), velocity=101,
                            prefix=event(0, [0xC0, 25]) + event(0, [0xFF, 3, 1, 88])))
        self.assertEqual(musical_fingerprint(a), musical_fingerprint(b))
        self.assertNotEqual(musical_fingerprint(a), musical_fingerprint(parse_midi(tune((60, 62, 65, 67)))))

    def test_fingerprint_preserves_polyphony_and_durations(self):
        score = parse_midi(tune())
        shorter = Score(score.ppq, [Note(n.start, n.duration // 2, n.pitch, n.velocity, n.track, n.channel) for n in score.notes], {}, 0, 0, [])
        self.assertNotEqual(musical_fingerprint(score), musical_fingerprint(shorter))
        doubled = Score(score.ppq, score.notes + [Note(0, 480, 48, 80, 1, 1)], {}, 0, 1, [])
        self.assertNotEqual(musical_fingerprint(score), musical_fingerprint(doubled))

    def test_exact_repeated_bars_suppressed_before_equal_file_weight(self):
        once, single_stats = extract_features(parse_midi(tune(repeats=1)))
        twice, _ = extract_features(parse_midi(tune(repeats=2)))
        many, repeated_stats = extract_features(parse_midi(tune(repeats=20)))
        self.assertEqual(repeated_stats["repeated_bars_suppressed"], 19)
        self.assertEqual(single_stats["learned_onsets"], repeated_stats["learned_onsets"])
        for name in twice:
            if "activity" not in name and "phrase_" not in name:
                self.assertEqual(twice[name], many[name])
        for distribution in many.values():
            self.assertAlmostEqual(sum(distribution.values()), 1)
        self.assertEqual(set(many["lead.phrase_32_onsets"]), set(map(str, range(32))))

    def test_polyphony_provides_top_line_and_bass(self):
        notes = [Note(i * 480, 480, p, 80, 0, 0) for i, chord in enumerate(((48, 60, 64), (50, 62, 67))) for p in chord]
        features, _ = extract_features(Score(480, notes, {}, 0, 0, []))
        self.assertEqual(features["lead.interval"], {"3": 1})
        self.assertEqual(features["bass.interval"], {"2": 1})

    def test_slow_notes_crossing_barlines_teach_motion_and_rhythm(self):
        notes = [Note(i * 4 * 480, 4 * 480, pitch, 80, 0, 0) for i, pitch in enumerate((48, 50, 52, 53))]
        features, _ = extract_features(Score(480, notes, {}, 0, 0, []))
        self.assertEqual(features["bass.interval"], {"2": 2 / 3, "1": 1 / 3})
        self.assertEqual(features["bass.inter_onset_beats"], {"4": 1})
        self.assertEqual(features["bass.interval_next2:2,2"], {"1": 1})

    def test_silent_bars_and_sustains_contribute_correct_phrase_activity(self):
        notes = [Note(0, 8 * 480, 60, 80, 0, 0), Note(12 * 480, 480, 64, 80, 0, 0)]
        features, stats = extract_features(Score(480, notes, {}, 0, 0, []))
        self.assertEqual(features["lead.phrase_16_activity:4"], {"active": 1})
        self.assertEqual(features["lead.phrase_16_activity:8"], {"rest": 1})
        self.assertEqual(features["lead.phrase_16_activity:11"], {"rest": 1})
        self.assertEqual(features["lead.phrase_16_activity:12"], {"active": 1})
        self.assertGreater(stats["silent_activity_patterns"], 0)
        self.assertIn("0", features["lead.bar_onsets"])

    def test_huge_silent_gap_and_sustain_have_bounded_activity_work(self):
        for duration in (480, 480 * 10**9):
            notes = [Note(0, duration, 60, 80, 0, 0), Note(480 * 10**9, 480, 64, 80, 0, 0)]
            features, stats = extract_features(Score(480, notes, {}, 0, 0, []))
            self.assertLess(stats["activity_bars_examined"], 40)
            self.assertTrue(features["lead.phrase_32_activity:16"])

    def test_validation_is_finite_with_unseen_intervals(self):
        metrics = validation_metrics({"lead.interval": {"2": 3}}, {"lead.interval": {"-7": 2}})
        self.assertGreater(metrics["lead.interval"]["cross_entropy_bits"], 0)

    def test_end_to_end_dedup_cache_manifest_order_and_incremental_training(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            paths = {"a": tune(), "copy": tune(), "transpose": tune((65, 67, 69, 72)),
                     "different": tune((60, 64, 65, 69)), "broken": b"bad"}
            for name, data in paths.items():
                (root / (name + ".mid")).write_bytes(data)
            sources = [{"url": f"https://example.test/{name}", "path": name + ".mid", "game": "same game"} for name in paths]
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"sources": sources}))
            output, report = root / "model.json", root / "report.json"
            first = trainer.training(manifest, output, report)
            artifact = output.read_bytes()
            self.assertEqual(first["counts"]["unique_files"], 2)
            self.assertEqual(first["counts"]["exact_duplicates"], 1)
            self.assertEqual(first["counts"]["musical_duplicates"], 1)
            self.assertEqual(first["counts"]["skipped_files"], 1)
            self.assertEqual(len({r["split"] for r in first["sources"] if r["status"] == "learned"}), 1)
            manifest.write_text(json.dumps({"sources": list(reversed(sources))}))
            second = trainer.training(manifest, output, report)
            self.assertEqual(second["counts"]["cache_hits"], 4)
            self.assertEqual(output.read_bytes(), artifact)
            (root / "new.mid").write_bytes(tune((60, 65, 68, 67)))
            sources.append({"url": "https://example.test/new", "path": "new.mid"})
            manifest.write_text(json.dumps({"sources": sources}))
            third = trainer.training(manifest, output, report)
            self.assertEqual(third["counts"]["unique_files"], 3)
            self.assertEqual(third["counts"]["newly_parsed"], 1)
            self.assertNotEqual(output.read_bytes(), artifact)
            sources.extend([{"url": "https://example.test/pending", "status": "pending"},
                            {"url": "https://example.test/failed", "status": "failed", "error": "timeout"},
                            {"url": "https://example.test/missing", "status": "downloaded", "path": "missing.mid"}])
            manifest.write_text(json.dumps({"sources": sources}))
            fourth = trainer.training(manifest, output, report)
            self.assertEqual(fourth["coverage"]["reported_sources"], len(sources))
            self.assertEqual(fourth["coverage"]["reconciled_sources"], len(sources))
            self.assertFalse(fourth["coverage"]["complete"])
            for field in ("pending_download", "download_failed", "missing_local"):
                self.assertEqual(fourth["counts"][field], 1)

    def test_manifest_checksum_mismatch_is_not_learned(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "a.mid").write_bytes(tune())
            (root / "manifest.json").write_text(json.dumps({"sources": [{"url": "a", "path": "a.mid", "sha256": "wrong"}]}))
            result = trainer.training(root / "manifest.json", root / "model.json", root / "report.json")
            self.assertEqual(result["counts"]["skipped_files"], 1)
            self.assertEqual(result["skip_reasons"]["manifest_checksum_mismatch"], 1)
            self.assertEqual(result["coverage"]["reconciled_sources"], 1)
            self.assertEqual(result["sources"][0]["status"], "skipped")

    def test_cache_migration_reuses_unchanged_v7_results_but_retries_system_errors(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            a, b = tune(), tune(prefix=event(0, [0xFC]))
            (root / "a.mid").write_bytes(a)
            (root / "b.mid").write_bytes(b)
            (root / "manifest.json").write_text(json.dumps({"sources": [{"url": "a", "path": "a.mid"}, {"url": "b", "path": "b.mid"}]}))
            trainer.training(root / "manifest.json", root / "model.json", root / "report.json")
            expected = (root / "model.json").read_bytes()
            connection = sqlite3.connect(root / "parsed-midi.sqlite3")
            connection.execute("UPDATE parsed SET version=7")
            old_error = zlib.compress(json.dumps({"error": "system_status", "message": "Old parser did not support transport"}).encode())
            connection.execute("UPDATE parsed SET payload=? WHERE sha=?", (old_error, hashlib.sha256(b).hexdigest()))
            connection.commit()
            connection.close()
            result = trainer.training(root / "manifest.json", root / "model.json", root / "report.json")
            self.assertEqual(result["counts"]["compatible_cache_hits"], 1)
            self.assertEqual(result["counts"]["newly_parsed"], 1)
            self.assertEqual((root / "model.json").read_bytes(), expected)


if __name__ == "__main__":
    unittest.main()
