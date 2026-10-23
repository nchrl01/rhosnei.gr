#!/usr/bin/env python3
"""Generate a reproducible MIDI study from aggregate learned MIDI statistics.

Example:
  python3 scripts/generate-midi-study.py --model .local/vgmusic/model.json \
    --output .local/vgmusic/studies/calm --seed 42 --energy .2 --direction up

Writes PREFIX.mid, PREFIX.events.json, and PREFIX.report.json. This script reads
only the statistical model, never source MIDI or the collection manifest. The
model supplies intervals, rhythm, articulation, accents, register and activity;
key, harmony, ranges, A/A'/B/A'' form and coordinated breaths are authored rules.
No synthesis, browser control, network request, or runtime activation occurs.
"""

from __future__ import annotations

from collections import Counter
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import struct
import sys

VERSION = 1
PPQ = 960
BEATS_PER_BAR = 4
ROLE_SETTINGS = {
    "lead": {"channel": 0, "program": 80, "gb_preset": 23, "low": 60, "high": 84},
    "bass": {"channel": 1, "program": 38, "gb_preset": 31, "low": 36, "high": 55},
    "chords": {"channel": 2, "program": 89, "gb_preset": 139, "low": 48, "high": 72},
}
TONICS = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4,
          "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9,
          "A#": 10, "Bb": 10, "B": 11}
RHYTHM_VALUES = (1 / 6, .25, 1 / 3, .5, 2 / 3, .75, 1, 1.5, 2)


def clamp(value, low, high):
    return max(low, min(high, value))


def canonical_json(value):
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode()


def rounded(value):
    return round(value, 7)


class LearnedModel:
    """Stable weighted sampling, with every consulted metric reported."""

    def __init__(self, model, rng):
        if model.get("version") != 1 or model.get("kind") != "aggregate_statistical_music_model":
            raise ValueError("Expected a version 1 aggregate_statistical_music_model")
        if not isinstance(model.get("unique_files"), int) or model["unique_files"] < 1:
            raise ValueError("Model contains no unique learned files")
        self.data, self.rng = model, rng
        self.distributions = model.get("distributions", {})
        if not isinstance(self.distributions, dict):
            raise ValueError("Model distributions must be an object")
        self.used, self.fallbacks = Counter(), Counter()
        for name, distribution in self.distributions.items():
            if not isinstance(distribution, dict):
                raise ValueError(f"Invalid distribution: {name}")
            for weight in distribution.values():
                if not isinstance(weight, (int, float)) or not math.isfinite(weight) or weight < 0:
                    raise ValueError(f"Invalid probability in {name}")
        for required in ("lead.interval", "lead.inter_onset_beats"):
            if not self.distributions.get(required):
                raise ValueError(f"Missing required learned distribution: {required}")

    def numeric(self, name, fallback, bias=None, bounds=None):
        candidates = []
        for label, probability in sorted(self.distributions.get(name, {}).items()):
            try:
                value = float(label)
            except ValueError:
                continue
            if not math.isfinite(value) or probability <= 0:
                continue
            if bounds and not bounds[0] <= value <= bounds[1]:
                continue
            weight = probability * (bias(value) if bias else 1)
            if weight > 0 and math.isfinite(weight):
                candidates.append((value, weight))
        if not candidates:
            self.fallbacks[name] += 1
            return fallback
        self.used[name] += 1
        threshold = self.rng.random() * sum(weight for _, weight in candidates)
        for value, weight in candidates:
            threshold -= weight
            if threshold <= 0:
                return value
        return candidates[-1][0]

    def active_probability(self, name, fallback=.75):
        distribution = self.distributions.get(name, {})
        total = sum(distribution.values())
        if not total:
            self.fallbacks[name] += 1
            return fallback
        self.used[name] += 1
        return distribution.get("active", 0) / total

    def position_weight(self, name, position, period):
        distribution = self.distributions.get(name, {})
        if not distribution:
            self.fallbacks[name] += 1
            return 1
        self.used[name] += 1
        # Smooth nearby bins so a quantized target is not impossible merely
        # because the training set used expressive or triplet microtiming.
        mass = 0
        for label, probability in distribution.items():
            value = float(label)
            distance = abs(value - position) % period
            distance = min(distance, period - distance)
            mass += probability * math.exp(-distance * (6 if period == 4 else 1))
        return clamp(mass * (4 if period == 4 else period / 2), .25, 1.6)

    def interval(self, role, previous, direction, energy):
        candidates = []
        if len(previous) >= 2:
            candidates.append(f"{role}.interval_next2:{previous[-2]},{previous[-1]}")
        if previous:
            candidates.append(f"{role}.interval_next:{previous[-1]}")
        candidates.append(f"{role}.interval")
        metric = next((name for name in candidates if self.distributions.get(name)), candidates[-1])
        # Market direction is a gentle bias; range and chord projection happen
        # later. The sampled intervals still come from this model's support.
        value = self.numeric(metric, 0, bounds=(-24, 24), bias=lambda step:
                             math.exp(direction * clamp(step, -7, 7) * .045)
                             * math.exp(-max(0, abs(step) - 7) * (.11 - .04 * energy)))
        return int(round(clamp(value, -12, 12)))


class Study:
    def __init__(self, model, seed, energy, direction, bars=8, bpm=None,
                 tonic="C", mode="major", chords=True):
        self.rng = random.Random(seed)
        self.learned = LearnedModel(model, self.rng)
        self.seed, self.energy, self.direction = seed, energy, direction
        self.direction_sign = {"down": -1, "flat": 0, "up": 1}[direction]
        self.bars, self.length = bars, bars * BEATS_PER_BAR
        self.phrase_length = self.length / 4
        self.bpm = bpm if bpm is not None else round(76 + energy * 44)
        self.tonic, self.mode, self.chords = TONICS[tonic], mode, chords
        self.tonic_name = tonic
        self.scale = (0, 2, 4, 5, 7, 9, 11) if mode == "major" else (0, 2, 3, 5, 7, 8, 10)
        self.scale_pcs = {(note + self.tonic) % 12 for note in self.scale}
        self.events, self.phrases, self.harmony = [], [], []
        self.reused, self.sampled = Counter(), Counter()
        # Eight authored harmonic steps; a 16-bar study holds each for two bars.
        degrees = (0, 5, 3, 4, 5, 3, 4, 0)
        for bar in range(bars):
            degree = degrees[bar * 8 // bars]
            pcs = [(self.tonic + self.scale[(degree + offset) % 7]) % 12 for offset in (0, 2, 4)]
            self.harmony.append({"bar": bar, "start_beat": bar * 4, "degree": degree + 1,
                                 "root_pc": pcs[0], "pitch_classes": pcs})

    def articulation(self, role, ioi):
        learned = self.learned
        gate = clamp(learned.numeric(f"{role}.gate", .8, bounds=(0, 2)), .25, 1)
        duration = clamp(learned.numeric(f"{role}.duration_beats", ioi * .8,
                                        bounds=(1 / 48, 16)), .125, 3)
        rest = clamp(learned.numeric(f"{role}.rest_beats", 0, bounds=(0, 16)), 0, .75)
        # Geometric blending lets both learned gate and duration affect timing.
        duration = math.sqrt(duration * ioi * gate)
        duration = clamp(min(duration, ioi - rest * .35), .125, max(.125, ioi * .98))
        accent = clamp(learned.numeric(f"{role}.accent", 1, bounds=(0, 2)), .45, 1.6)
        return rounded(duration), rounded(accent)

    def rhythm(self, role, phrase_index, sound_until):
        learned, length = self.learned, self.phrase_length
        phrase_start = phrase_index * length
        minimum = .25 if role == "lead" else .5
        # The model includes silent bars: zero remains zero. Every bar gets an
        # independent density budget so sparse passages do not just finish early.
        budgets = []
        for _ in range(int(length / 4)):
            target_count = learned.numeric(f"{role}.bar_onsets", 6 if role == "lead" else 4,
                                           bounds=(0, 64))
            budgets.append(0 if target_count == 0 else int(clamp(
                round(target_count * (.65 + self.energy * .65)), 1, 4 / minimum)))
        counts = Counter()
        onset, result = 0.0, []
        while onset < sound_until - .124:
            raw = learned.numeric(f"{role}.inter_onset_beats", .5 if role == "lead" else 1,
                                   bounds=(1 / 48, 16), bias=lambda value:
                                   math.exp((.5 - self.energy) * clamp(math.log2(max(value, .125)), -3, 3)))
            choices = [value for value in RHYTHM_VALUES if value >= minimum]
            ioi = min(choices, key=lambda value: (abs(value - raw), -value))
            local = onset % 4
            phase = (phrase_start + onset) % 32
            activity = learned.active_probability(f"{role}.quarter_beat_activity:{int(local * 4) % 16}")
            long_activity = learned.active_probability(f"{role}.phrase_32_activity:{int(phase)}")
            position = learned.position_weight(f"{role}.beat_position", local, 4)
            phrase_weight = learned.position_weight(f"{role}.phrase_32_onsets", phase, 32)
            probability = clamp((.28 + .5 * activity + .22 * long_activity)
                                 * (.72 + .32 * self.energy)
                                 * math.sqrt(position * phrase_weight), .12, .97)
            bar = min(len(budgets) - 1, int(onset // 4))
            if self.rng.random() < probability and counts[bar] < budgets[bar]:
                duration, accent = self.articulation(role, ioi)
                result.append({"onset": rounded(onset), "ioi": ioi,
                               "duration": min(duration, sound_until - onset), "accent": accent})
                counts[bar] += 1
            onset = round((onset + ioi) * 12) / 12
        return result

    def variation(self, role, base, sound_until, closing, phrase_index):
        result = []
        for index, note in enumerate(base):
            if note["onset"] >= sound_until - .124:
                continue
            if index and index < len(base) - 1 and self.rng.random() < (.06 if closing else .12):
                continue
            source_phase = int(note["onset"] % 32)
            target_phase = int((phrase_index * self.phrase_length + note["onset"]) % 32)
            source_activity = self.learned.active_probability(f"{role}.phrase_32_activity:{source_phase}")
            target_activity = self.learned.active_probability(f"{role}.phrase_32_activity:{target_phase}")
            # Reprises retain the generated motif, but quieter learned phrase
            # positions can omit its notes. Smoothing avoids a brittle 0/0 ratio.
            if self.rng.random() > min(1, (target_activity + .1) / (source_activity + .1)):
                continue
            item = dict(note)
            if self.rng.random() < (.24 if closing else .35):
                item["duration"], item["accent"] = self.articulation(role, item["ioi"])
            item["duration"] = min(item["duration"], sound_until - item["onset"])
            item["memory_index"] = index
            result.append(item)
        return result

    def choose_pitch(self, role, target, previous, center, absolute, final_note, final_phrase):
        settings = ROLE_SETTINGS[role]
        chord = self.harmony[min(self.bars - 1, int(absolute // 4))]
        local = absolute % 4
        strong = abs(local - round(local)) < .00001 and int(round(local)) % 2 == 0
        if final_note and final_phrase:
            pcs = {self.tonic}
        elif role == "bass" and (strong or final_note):
            pcs = {chord["root_pc"]}
        elif strong or final_note or role == "bass":
            pcs = set(chord["pitch_classes"])
        else:
            pcs = self.scale_pcs
        allowed = [pitch for pitch in range(settings["low"], settings["high"] + 1) if pitch % 12 in pcs]
        return min(allowed, key=lambda pitch: (abs(pitch - target) + .12 * abs(pitch - center)
                                               + .3 * max(0, abs(pitch - previous) - 7), pitch))

    def add_event(self, role, midi, start, duration, velocity, phrase):
        settings = ROLE_SETTINGS[role]
        self.events.append({"role": role, "midi": int(midi), "velocity": int(velocity),
                            "start_beat": rounded(start), "duration_beats": rounded(duration),
                            "start_seconds": rounded(start * 60 / self.bpm),
                            "duration_seconds": rounded(duration * 60 / self.bpm),
                            "channel": settings["channel"], "program": settings["program"],
                            "gb_preset": settings["gb_preset"], "phrase": phrase})

    def voice(self, role, phrase_index, rhythm, memory=None):
        learned = self.learned
        register = learned.numeric(f"{role}.register", 5 if role == "lead" else 3, bounds=(0, 10))
        center = clamp(int(register * 12 + self.tonic + (5 if role == "lead" else 0)),
                       65 if role == "lead" else 40, 78 if role == "lead" else 50)
        previous, history, intervals = center, [], []
        phrase_start = phrase_index * self.phrase_length
        for index, note in enumerate(rhythm):
            memory_index = note.get("memory_index", index)
            if memory is not None and memory_index < len(memory) and self.rng.random() < .78:
                interval = memory[memory_index]
                self.reused[role] += 1
            else:
                interval = learned.interval(role, history, self.direction_sign, self.energy)
                self.sampled[role] += 1
            intervals.append(interval)
            absolute = phrase_start + note["onset"]
            # A first note begins near the chosen register. Later targets follow
            # learned melodic intervals with bounded projection into key/chord.
            target = previous + interval
            pitch = self.choose_pitch(role, target, previous, center, absolute,
                                       index == len(rhythm) - 1, phrase_index == 3)
            if index:
                history.append(pitch - previous)
            previous = pitch
            strong = abs(absolute - round(absolute)) < .00001 and int(round(absolute)) % 2 == 0
            base_velocity = (62 if role == "lead" else 57) + self.energy * 17
            velocity = clamp(round(base_velocity * note["accent"] + (5 if strong else 0)), 28, 110)
            self.add_event(role, pitch, absolute, note["duration"], velocity, phrase_index)
        return intervals

    def chord_voice(self, phrase_index, sound_until):
        start = phrase_index * self.phrase_length
        previous = (48, 55, 64)
        for offset in range(0, int(self.phrase_length), 4):
            if offset >= sound_until:
                break
            chord = self.harmony[int((start + offset) // 4)]
            pitches = []
            for index, pc in enumerate(chord["pitch_classes"]):
                available = [pitch for pitch in range(48, 73) if pitch % 12 == pc and pitch not in pitches]
                pitch = min(available, key=lambda candidate: abs(candidate - previous[index]))
                pitches.append(pitch)
            previous = pitches
            duration = min(2.25 + self.energy * .5, sound_until - offset)
            for pitch in pitches:
                self.add_event("chords", pitch, start + offset, duration,
                               round(36 + self.energy * 10), phrase_index)

    def generate(self):
        base_rhythms, base_intervals = {}, {}
        for phrase_index, label in enumerate(("A", "A'", "B", "A''")):
            learned_rest = self.learned.numeric("lead.rest_beats", .25, bounds=(0, 16))
            # A shared breath is an authored arrangement constraint; its length
            # responds to the sampled gap and market energy.
            breath = round(clamp(.25 + learned_rest * .35 + (1 - self.energy) * .3,
                                 .25, 1.25) * 12) / 12
            sound_until = self.phrase_length - breath
            self.phrases.append({"index": phrase_index, "label": label,
                                 "start_beat": rounded(phrase_index * self.phrase_length),
                                 "length_beats": self.phrase_length,
                                 "shared_rest_start_beat": rounded(phrase_index * self.phrase_length + sound_until),
                                 "shared_rest_duration_beats": rounded(breath),
                                 "memory_from": "A" if phrase_index in (1, 3) else None})
            for role in ("lead", "bass"):
                is_reprise = phrase_index in (1, 3)
                rhythm = (self.variation(role, base_rhythms[role], sound_until, phrase_index == 3, phrase_index)
                          if is_reprise else self.rhythm(role, phrase_index, sound_until))
                intervals = self.voice(role, phrase_index, rhythm,
                                       base_intervals[role] if is_reprise else None)
                if phrase_index == 0:
                    base_rhythms[role], base_intervals[role] = rhythm, intervals
            if self.chords:
                self.chord_voice(phrase_index, sound_until)
        self.events.sort(key=lambda event: (event["start_beat"], event["channel"], event["midi"]))
        return {"version": VERSION, "kind": "generated_midi_study", "seed": self.seed,
                "model_dataset_fingerprint": self.learned.data.get("dataset_fingerprint"),
                "energy": self.energy, "direction": self.direction, "tempo_bpm": self.bpm,
                "bars": self.bars, "beats_per_bar": 4, "length_beats": self.length,
                "length_seconds": rounded(self.length * 60 / self.bpm),
                "key": {"tonic": self.tonic_name, "mode": self.mode,
                        "pitch_classes": sorted(self.scale_pcs)},
                "midi_convention": "Channels and program numbers are zero-based; channel 9 is reserved for percussion.",
                "sample_library": "UPIC original Game Boy style bank; gb_preset is separate from the MIDI program.",
                "roles": ROLE_SETTINGS, "phrases": self.phrases, "harmony": self.harmony,
                "events": self.events}


def vlq(value):
    if value < 0:
        raise ValueError("Negative MIDI delta")
    result = [value & 127]
    while value >> 7:
        value >>= 7
        result.append((value & 127) | 128)
    return bytes(reversed(result))


def midi_track(events, end_tick):
    encoded, previous_tick = bytearray(), 0
    for tick, priority, payload in sorted(events, key=lambda event: (event[0], event[1], event[2])):
        encoded.extend(vlq(tick - previous_tick))
        encoded.extend(payload)
        previous_tick = tick
    encoded.extend(vlq(max(0, end_tick - previous_tick)))
    encoded.extend(b"\xff\x2f\x00")
    return b"MTrk" + struct.pack(">I", len(encoded)) + encoded


def midi_bytes(document):
    end_tick = round(document["length_beats"] * PPQ)
    tempo = round(60_000_000 / document["tempo_bpm"])
    title = b"UPIC statistical MIDI study"
    conductor = [(0, 0, b"\xff\x03" + vlq(len(title)) + title),
                 (0, 1, b"\xff\x51\x03" + tempo.to_bytes(3, "big")),
                 (0, 2, b"\xff\x58\x04\x04\x02\x18\x08")]
    for phrase in document["phrases"]:
        label = phrase["label"].encode("ascii")
        conductor.append((round(phrase["start_beat"] * PPQ), 3, b"\xff\x06" + vlq(len(label)) + label))
    tracks = [midi_track(conductor, end_tick)]
    for role in ("lead", "bass", "chords"):
        notes = [event for event in document["events"] if event["role"] == role]
        if not notes:
            continue
        settings = ROLE_SETTINGS[role]
        channel = settings["channel"]
        name = role.encode("ascii")
        events = [(0, 0, b"\xff\x03" + vlq(len(name)) + name),
                  (0, 1, bytes((0xC0 | channel, settings["program"])))]
        for note in notes:
            on = round(note["start_beat"] * PPQ)
            off = max(on + 1, round((note["start_beat"] + note["duration_beats"]) * PPQ))
            events.append((on, 4, bytes((0x90 | channel, note["midi"], note["velocity"]))))
            events.append((off, 3, bytes((0x80 | channel, note["midi"], 0))))
        tracks.append(midi_track(events, end_tick))
    return b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks), PPQ) + b"".join(tracks)


def generate_files(args):
    model_bytes = Path(args.model).read_bytes()
    model = json.loads(model_bytes)
    study = Study(model, args.seed, args.energy, args.direction, args.bars, args.bpm,
                  args.tonic, args.mode, not args.no_chords)
    document = study.generate()
    midi = midi_bytes(document)
    event_bytes = canonical_json(document)
    prefix = Path(args.output)
    prefix.parent.mkdir(parents=True, exist_ok=True)
    paths = {"midi": Path(str(prefix) + ".mid"), "events": Path(str(prefix) + ".events.json"),
             "report": Path(str(prefix) + ".report.json")}
    report = {
        "version": VERSION, "generator": "generate-midi-study.py", "generator_version": VERSION,
        "model_sha256": hashlib.sha256(model_bytes).hexdigest(),
        "dataset_fingerprint": model.get("dataset_fingerprint"),
        "model_unique_files": model["unique_files"], "model_source_note_count": model.get("notes"),
        "parameters": {"seed": args.seed, "energy": args.energy, "direction": args.direction,
                       "bars": args.bars, "tempo_bpm": study.bpm, "tonic": args.tonic,
                       "mode": args.mode, "chords": not args.no_chords},
        "counts": dict(sorted(Counter(event["role"] for event in document["events"]).items())),
        "total_events": len(document["events"]),
        "learned_metrics_used": dict(sorted(study.learned.used.items())),
        "missing_or_unusable_metric_fallbacks": dict(sorted(study.learned.fallbacks.items())),
        "sampled_intervals": dict(study.sampled), "reused_generated_intervals": dict(study.reused),
        "learned_choices": ["Interval distribution and conditional one/two-interval transitions with backoff.",
                            "Register, inter-onset spacing, onset density and beat/phrase activity.",
                            "Note duration, gate, rest duration and velocity accent."],
        "authored_constraints": ["4/4 meter, major/minor key and an eight-step diatonic chord progression.",
                                 "Four equal phrases with A/A'/B/A'' memory; reprises reuse this run's generated material.",
                                 "Pitch range, chord-tone emphasis, final tonic and bounded leaps.",
                                 "Rhythm vocabulary, monophonic lead/bass and a shared breath at each phrase end.",
                                 "Optional quiet chord voicings, tempo and Game Boy preset assignments.",
                                 "Market energy biases rhythm, density, velocity and tempo; direction gently biases intervals."],
        "limitations": ["Aggregate statistics do not learn song-level form, harmony or instrument orchestration.",
                        "This is generated material from aggregate distributions, not a source melody or phrase retrieval.",
                        "Coincidental similarity to existing music is possible; no global melody originality proof is claimed.",
                        "Sampling and note constraints do not establish perceptual quality; listening evaluation remains necessary.",
                        "No audio is synthesized here; MIDI player timbres may differ from the optional GB sample renderer."] + model.get("limitations", []),
        "artifacts": {"midi": {"file": paths["midi"].name, "sha256": hashlib.sha256(midi).hexdigest()},
                      "events": {"file": paths["events"].name, "sha256": hashlib.sha256(event_bytes).hexdigest()}},
    }
    paths["midi"].write_bytes(midi)
    paths["events"].write_bytes(event_bytes)
    paths["report"].write_bytes(canonical_json(report))
    return report, paths


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", required=True, help="Local aggregate model JSON")
    parser.add_argument("--output", required=True, help="Output prefix, without extension")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--energy", type=float, default=.35, help="Market energy from 0 to 1")
    parser.add_argument("--direction", choices=("up", "down", "flat"), default="flat")
    parser.add_argument("--bars", type=int, choices=(8, 16), default=8)
    parser.add_argument("--bpm", type=float, help="Override authored energy-to-tempo mapping")
    parser.add_argument("--tonic", choices=tuple(TONICS), default="C")
    parser.add_argument("--mode", choices=("major", "minor"), default="major")
    parser.add_argument("--no-chords", action="store_true")
    args = parser.parse_args()
    if not math.isfinite(args.energy) or not 0 <= args.energy <= 1:
        parser.error("--energy must be between 0 and 1")
    if args.bpm is not None and (not math.isfinite(args.bpm) or not 30 <= args.bpm <= 240):
        parser.error("--bpm must be between 30 and 240")
    try:
        report, paths = generate_files(args)
    except (OSError, ValueError, TypeError) as error:
        print(f"Generation failed: {error}", file=sys.stderr)
        return 2
    print(json.dumps({"artifacts": {name: str(path) for name, path in paths.items()},
                      "events": report["total_events"], "model_unique_files": report["model_unique_files"],
                      "learned_metrics": len(report["learned_metrics_used"])}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
