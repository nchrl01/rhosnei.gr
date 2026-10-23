"""Offline behavior checks; synthetic distributions contain no source music."""

import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

from midi_learning import MidiError, parse_midi

SPEC = importlib.util.spec_from_file_location("midi_study", Path(__file__).with_name("generate-midi-study.py"))
STUDY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(STUDY)


def model_fixture():
    distributions = {}
    for role in ("lead", "bass"):
        distributions.update({
            f"{role}.interval": {"-2": .2, "0": .2, "2": .4, "5": .2},
            f"{role}.register": {"5" if role == "lead" else "3": 1},
            f"{role}.inter_onset_beats": {"0.5": .6, "1": .4},
            f"{role}.duration_beats": {"0.25": .3, "0.5": .7},
            f"{role}.gate": {"0.8": 1}, f"{role}.rest_beats": {"0": .8, "0.25": .2},
            f"{role}.accent": {"0.8": .4, "1.2": .6},
            f"{role}.bar_onsets": {"6": 1},
            f"{role}.beat_position": {str(i): .25 for i in range(4)},
            f"{role}.phrase_32_onsets": {str(i): 1 / 32 for i in range(32)},
        })
        for slot in range(16):
            distributions[f"{role}.quarter_beat_activity:{slot}"] = {"active": .9, "rest": .1}
        for slot in range(32):
            distributions[f"{role}.phrase_32_activity:{slot}"] = {"active": .9, "rest": .1}
    return {"version": 1, "kind": "aggregate_statistical_music_model", "unique_files": 1,
            "dataset_fingerprint": "synthetic-fixture", "notes": 0, "grid_per_beat": 96,
            "distributions": distributions, "limitations": ["Synthetic test fixture."]}


class GeneratedStudyTests(unittest.TestCase):
    def test_midi_matches_json_and_seed_repeats(self):
        model = model_fixture()
        first = STUDY.Study(model, 42, .5, "up").generate()
        second = STUDY.Study(model, 42, .5, "up").generate()
        self.assertEqual(first, second)
        midi = STUDY.midi_bytes(first)
        self.assertEqual(midi, STUDY.midi_bytes(second))
        parsed = parse_midi(midi)
        expected = sorted((round(e["start_beat"] * STUDY.PPQ),
                           round((e["start_beat"] + e["duration_beats"]) * STUDY.PPQ)
                           - round(e["start_beat"] * STUDY.PPQ),
                           e["midi"], e["velocity"], e["channel"]) for e in first["events"])
        actual = sorted((n.start, n.duration, n.pitch, n.velocity, n.channel) for n in parsed.notes)
        self.assertEqual(expected, actual)
        self.assertEqual(parsed.warnings, {})

    def test_learned_choices_materially_change_outputs(self):
        cases = (("lead.interval", {"0": 1}, {"7": 1}, "midi"),
                 ("lead.inter_onset_beats", {"0.25": 1}, {"1.5": 1}, "start_beat"),
                 ("lead.accent", {"0.5": 1}, {"1.5": 1}, "velocity"))
        for metric, first_distribution, second_distribution, attribute in cases:
            with self.subTest(metric=metric):
                model = model_fixture()
                model["distributions"][metric] = first_distribution
                first = STUDY.Study(model, 101, .5, "flat").generate()
                model["distributions"][metric] = second_distribution
                second = STUDY.Study(model, 101, .5, "flat").generate()
                self.assertNotEqual([e[attribute] for e in first["events"] if e["role"] == "lead"],
                                    [e[attribute] for e in second["events"] if e["role"] == "lead"])

    def test_zero_onset_bars_remain_silent(self):
        model = model_fixture()
        for role in ("lead", "bass"):
            model["distributions"][f"{role}.bar_onsets"] = {"0": 1}
        document = STUDY.Study(model, 42, 1, "up", chords=False).generate()
        self.assertEqual(document["events"], [])
        # The training parser deliberately rejects valid but note-free MIDI.
        with self.assertRaises(MidiError) as error:
            parse_midi(STUDY.midi_bytes(document))
        self.assertEqual(error.exception.code, "no_notes")

    def test_key_monophony_and_shared_rests_across_parameters(self):
        for bars in (8, 16):
            for energy in (0, 1):
                with self.subTest(bars=bars, energy=energy):
                    document = STUDY.Study(model_fixture(), 17, energy, "down", bars,
                                           tonic="Bb", mode="minor").generate()
                    for event in document["events"]:
                        phrase = document["phrases"][event["phrase"]]
                        self.assertLessEqual(event["start_beat"] + event["duration_beats"],
                                             phrase["shared_rest_start_beat"] + 1e-6)
                        self.assertIn(event["midi"] % 12, document["key"]["pitch_classes"])
                        self.assertGreater(event["duration_beats"], 0)
                    for role in ("lead", "bass"):
                        events = [e for e in document["events"] if e["role"] == role]
                        for previous, following in zip(events, events[1:]):
                            self.assertLessEqual(previous["start_beat"] + previous["duration_beats"],
                                                 following["start_beat"] + 1e-6)

    def test_reprises_consult_target_phase_activity(self):
        study = STUDY.Study(model_fixture(), 42, .5, "flat", 16)
        study.generate()
        self.assertTrue(any(f"lead.phrase_32_activity:{phase}" in study.learned.used
                            for phase in range(16, 32)))

    def test_files_record_exact_model_and_output_hashes(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / "model.json"
            path.write_text(json.dumps(model_fixture()))
            args = SimpleNamespace(model=path, output=root / "study", seed=42, energy=.3,
                                   direction="up", bars=8, bpm=None, tonic="C", mode="major",
                                   no_chords=False)
            report, paths = STUDY.generate_files(args)
            self.assertEqual(report["model_sha256"], hashlib.sha256(path.read_bytes()).hexdigest())
            for name in ("midi", "events"):
                self.assertEqual(report["artifacts"][name]["sha256"],
                                 hashlib.sha256(paths[name].read_bytes()).hexdigest())
            self.assertTrue(report["learned_metrics_used"])
            self.assertTrue(report["authored_constraints"])
            self.assertEqual(report["missing_or_unusable_metric_fallbacks"], {})


if __name__ == "__main__":
    unittest.main()
