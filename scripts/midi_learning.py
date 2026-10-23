"""Dependency-free, tempo-independent MIDI parsing and statistical phrase learning.

SMF format 0/1/2 and RIFF RMID are supported. Format 2 tracks remain independent
sequences in fingerprints and statistics. SMPTE divisions are explicitly
unsupported because guessing musical beats would be misleading. Sustain and
note releases are interpreted across tracks per MIDI port/channel for format0/1;
format2 tracks remain independent. Pitch bend, expression,
percussion kits and other synthesis controls are not learned. Unreleased notes
are closed at their sequence's final tick and counted in parser warnings.

Musical deduplication keeps all pitched/drum events and polyphony but ignores
track/channel allocation, programs, metadata, velocity and tempo. Onsets and
durations are quantized to 1/96 beat, leading silence removed, and one global
pitched-note transposition removed. This catches the same arrangement in a new
key or instrumentation; substantially edited arrangements remain distinct.

The model is statistical, not neural. It learns abstract interval, rhythm,
articulation, accent and phrase-activity distributions, never raw melodies.
"""

from __future__ import annotations

from collections import Counter, defaultdict, deque
from dataclasses import dataclass
import hashlib
import json
import math
import statistics
import struct

PARSER_VERSION = 8
# Version 8 only accepts defined MIDI real-time transport bytes that version 7
# rejected. Previously parsed version-7 feature results remain identical; only
# old system_status errors need a retry. Older versions must be reparsed.
COMPATIBLE_CACHE_VERSIONS = frozenset({7})
GRID = 96
MAX_BYTES = 64 * 1024 * 1024
MAX_EVENTS = 4_000_000


class MidiError(ValueError):
    """Malformed or intentionally unsupported MIDI, with a reportable code."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Note:
    start: int
    duration: int
    pitch: int
    velocity: int
    track: int
    channel: int
    port: int = 0


@dataclass
class Score:
    ppq: int
    notes: list[Note]
    warnings: dict[str, int]
    events: int
    midi_format: int
    meters: list[tuple[int, int, int]]


def _u32(data: bytes, offset: int) -> int:
    if offset + 4 > len(data):
        raise MidiError("truncated", "Truncated 32-bit field")
    return struct.unpack_from(">I", data, offset)[0]


def _vlq(data: bytes, offset: int) -> tuple[int, int]:
    start = offset
    value = 0
    for _ in range(4):
        if offset >= len(data):
            raise MidiError("truncated", "Truncated variable-length integer")
        byte = data[offset]
        offset += 1
        value = (value << 7) | (byte & 127)
        if not byte & 128:
            return value, offset
    raise MidiError("invalid_vlq", f"Variable-length integer at offset {start} exceeds four bytes: {data[start:start + 8].hex()}")


def _unwrap_rmid(data: bytes) -> bytes:
    if data[:4] != b"RIFF":
        return data
    if len(data) < 12 or data[8:12] != b"RMID":
        raise MidiError("not_midi", "RIFF payload is not RMID")
    end = 8 + struct.unpack_from("<I", data, 4)[0]
    if end > len(data) or end < 12:
        raise MidiError("truncated", "Invalid RIFF length")
    position = 12
    while position + 8 <= end:
        tag = data[position:position + 4]
        size = struct.unpack_from("<I", data, position + 4)[0]
        position += 8
        if position + size > end:
            raise MidiError("truncated", "Truncated RIFF chunk")
        if tag == b"data":
            return data[position:position + size]
        position += size + (size & 1)
    raise MidiError("not_midi", "RMID contains no data chunk")


def parse_midi(data: bytes) -> Score:
    if len(data) > MAX_BYTES:
        raise MidiError("oversize", f"MIDI exceeds {MAX_BYTES} bytes")
    data = _unwrap_rmid(data)
    if len(data) < 14 or data[:4] != b"MThd":
        raise MidiError("not_midi", "Missing Standard MIDI header")
    size = _u32(data, 4)
    if size < 6 or 8 + size > len(data):
        raise MidiError("truncated", "Invalid MIDI header length")
    midi_format, track_count, division = struct.unpack_from(">HHH", data, 8)
    if midi_format not in (0, 1, 2):
        raise MidiError("unknown_format", f"Unknown MIDI format {midi_format}")
    if division & 0x8000:
        raise MidiError("smpte", "SMPTE timing has no unambiguous musical beat grid")
    if division == 0 or track_count == 0:
        raise MidiError("invalid_header", "PPQ and track count must be positive")
    position, track_index, events = 8 + size, 0, 0
    musical_events, meters, track_ends = [], [], {}
    warnings = Counter()
    while position < len(data) and track_index < track_count:
        if position + 8 > len(data):
            raise MidiError("truncated", "Truncated MIDI chunk header")
        tag, length = data[position:position + 4], _u32(data, position + 4)
        position += 8
        if position + length > len(data):
            raise MidiError("truncated", f"MIDI track {track_index} declares {length} bytes at offset {position}, only {len(data) - position} remain")
        track = data[position:position + length]
        position += length
        if tag != b"MTrk":
            warnings["unknown_chunks"] += 1
            continue
        cursor, tick, running, ended, port, meta_running = 0, 0, None, False, 0, None
        while cursor < len(track):
            delta, cursor = _vlq(track, cursor)
            tick += delta
            if cursor >= len(track):
                raise MidiError("truncated", "Missing event after delta time")
            status = track[cursor]
            if status & 128:
                cursor += 1
            elif running is not None:
                status = running
            elif meta_running is not None:
                # Some historical exporters retain channel running status across
                # metadata (as supported by Mido). Recover only a known prior
                # channel status and still validate every data byte normally.
                status, meta_running = meta_running, None
                warnings["running_status_after_meta"] += 1
            else:
                raise MidiError("running_status", "Data byte has no running status")
            events += 1
            if events > MAX_EVENTS:
                raise MidiError("event_limit", "MIDI event safety limit exceeded")
            if status == 0xFF:
                meta_running = running if running is not None else meta_running
                running = None
                if cursor >= len(track):
                    raise MidiError("truncated", "Missing meta-event type")
                meta = track[cursor]
                cursor += 1
                count, cursor = _vlq(track, cursor)
                if cursor + count > len(track):
                    raise MidiError("truncated", "Meta-event exceeds track bounds")
                payload = track[cursor:cursor + count]
                cursor += count
                if meta == 0x58 and count >= 2 and payload[1] <= 7:
                    meters.append((tick, payload[0], 2 ** payload[1]))
                if meta == 0x21:
                    if count != 1:
                        raise MidiError("invalid_port", "MIDI port metadata must contain one byte")
                    port = payload[0]
                if meta == 0x2F:
                    if count:
                        raise MidiError("invalid_end", "End-of-track must have zero payload")
                    ended = True
                    if cursor != len(track):
                        warnings["trailing_track_bytes"] += len(track) - cursor
                    break
                continue
            if status in (0xF0, 0xF7):
                running = None
                meta_running = None
                count, cursor = _vlq(track, cursor)
                if cursor + count > len(track):
                    raise MidiError("truncated", "SysEx exceeds track bounds")
                cursor += count
                continue
            if status in (0xF8, 0xFA, 0xFB, 0xFC, 0xFE):
                # Historical files occasionally contain clock/start/continue/
                # stop/active-sensing events directly in a track. They carry no
                # note information and do not cancel channel running status.
                warnings["realtime_transport_ignored"] += 1
                continue
            if not 0x80 <= status <= 0xEF:
                raise MidiError("system_status", f"Unsupported SMF system status {status:#x}")
            running = status
            meta_running = None
            kind, channel = status & 0xF0, status & 15
            count = 1 if kind in (0xC0, 0xD0) else 2
            if cursor + count > len(track):
                raise MidiError("truncated", "Incomplete channel event")
            values = track[cursor:cursor + count]
            cursor += count
            if any(value > 127 for value in values):
                raise MidiError("invalid_data", f"Track {track_index}, offset {cursor - count}: channel data {values.hex()} contains a status byte (status {status:#x})")
            if kind in (0x80, 0x90) or (kind == 0xB0 and values[0] in (64, 120, 121, 123)):
                musical_events.append((tick, track_index, events, port, kind, channel, values[0], values[1]))
        if not ended:
            warnings["missing_end_of_track"] += 1
        track_ends[track_index] = tick
        track_index += 1
    if track_index != track_count:
        raise MidiError("truncated", "Fewer tracks than declared by the header")
    notes = _interpret_events(musical_events, track_ends, midi_format, warnings)
    if not notes:
        raise MidiError("no_notes", "MIDI contains no note events")
    return Score(division, sorted(notes, key=lambda n: (n.start, n.track, n.port, n.channel, n.pitch, n.duration)),
                 dict(warnings), events, midi_format, sorted(set(meters)))


def _interpret_events(events, track_ends, midi_format, warnings):
    """Interpret the logical MIDI stream; preserve origin track on every note."""
    active = defaultdict(lambda: defaultdict(deque))
    held, sustain, notes = defaultdict(list), defaultdict(bool), []
    sequence_ends = track_ends if midi_format == 2 else {0: max(track_ends.values(), default=0)}

    def close(key, pitch, entry, end):
        _, port, channel = key
        start, velocity, origin_track = entry
        notes.append(Note(start, max(0, end - start), pitch, velocity, origin_track, channel, port))

    def release_held(key, end):
        for pitch, entry in held.pop(key, []):
            close(key, pitch, entry, end)

    for tick, track, _, port, kind, channel, first, second in sorted(events):
        key = (track if midi_format == 2 else 0, port, channel)
        if kind == 0x90 and second:
            active[key][first].append((tick, second, track))
        elif kind in (0x80, 0x90):
            queue = active[key][first]
            if not queue:
                warnings["unmatched_note_offs"] += 1
                continue
            entry = queue.popleft()
            if sustain[key] and channel != 9:
                held[key].append((first, entry))
            else:
                close(key, first, entry, tick)
        elif first == 64:
            sustain[key] = second >= 64
            if not sustain[key]:
                release_held(key, tick)
        elif first in (120, 123):
            for pitch, queue in active[key].items():
                while queue:
                    entry = queue.popleft()
                    if first == 123 and sustain[key] and channel != 9:
                        held[key].append((pitch, entry))
                    else:
                        close(key, pitch, entry, tick)
            if first == 120:
                release_held(key, tick)
        elif first == 121:
            sustain[key] = False
            release_held(key, tick)
    for key, pitches in active.items():
        for pitch, queue in pitches.items():
            for entry in queue:
                warnings["unreleased_notes"] += 1
                close(key, pitch, entry, sequence_ends[key[0]])
    for key in list(held):
        release_held(key, sequence_ends[key[0]])
    return notes


def quantize(tick: int, ppq: int) -> int:
    """Integer rounding avoids cross-platform floating point differences."""
    return (2 * tick * GRID + ppq) // (2 * ppq)


def musical_fingerprint(score: Score) -> str:
    groups = defaultdict(list)
    for note in score.notes:
        groups[note.track if score.midi_format == 2 else 0].append(note)
    sequences = []
    for notes in groups.values():
        origin = min(note.start for note in notes)
        base = min((note.pitch for note in notes if note.channel != 9), default=0)
        sequences.append(sorted((quantize(note.start - origin, score.ppq), quantize(note.duration, score.ppq),
                                 note.pitch if note.channel == 9 else note.pitch - base, note.channel == 9)
                                for note in notes))
    events = sorted(sequences)
    return hashlib.sha256(json.dumps(events, separators=(",", ":")).encode()).hexdigest()


def score_to_json(score: Score) -> dict:
    return {"ppq": score.ppq, "notes": [[n.start, n.duration, n.pitch, n.velocity, n.track, n.channel, n.port]
            for n in score.notes], "warnings": score.warnings, "events": score.events,
            "midi_format": score.midi_format, "meters": score.meters}


def score_from_json(value: dict) -> Score:
    return Score(value["ppq"], [Note(*row) for row in value["notes"]], value["warnings"],
                 value["events"], value["midi_format"], value.get("meters", []))


def _bin(value: float, unit: float, maximum: float) -> str:
    value = max(0, min(maximum, round(value / unit) * unit))
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def _line(notes: list[Note], high: bool) -> list[Note]:
    onsets = defaultdict(list)
    for note in notes:
        onsets[note.start].append(note)
    return [sorted(group, key=lambda n: (n.pitch, n.duration, n.velocity), reverse=high)[0]
            for _, group in sorted(onsets.items())]


def _activity_bars(line: list[Note], ppq: int) -> dict[int, list[bool]]:
    """Occupied quarter-beat cells, including silence and held notes.

    A sweep over interval endpoints never walks arbitrary tick gaps. Uniform
    spans longer than eight bars need only one representative for each phrase
    phase, because repeated identical activity patterns are suppressed below.
    Partial endpoint bars are retained exactly, including overlapping voices.
    """
    first_bar = min(n.start for n in line) // (ppq * 4)
    last_tick = max(max(n.start + n.duration - 1, n.start) for n in line)
    last_bar = last_tick // (ppq * 4)
    edges = Counter({first_bar * 16: 0, (last_bar + 1) * 16: 0})
    bars = {n.start // (ppq * 4): [False] * 16 for n in line}
    for note in line:
        if note.duration <= 0:
            continue
        begin = note.start * 4 // ppq
        end = ((note.start + note.duration) * 4 + ppq - 1) // ppq
        edges[begin] += 1
        edges[end] -= 1
    ordered = sorted(edges)
    coverage = 0

    def fill(bar, begin, end, active):
        pattern = bars.setdefault(bar, [False] * 16)
        if active:
            pattern[begin:end] = [True] * (end - begin)

    for begin, end in zip(ordered, ordered[1:]):
        coverage += edges[begin]
        if begin == end:
            continue
        start_bar, finish_bar = begin // 16, (end - 1) // 16
        active = coverage > 0
        if start_bar == finish_bar:
            fill(start_bar, begin % 16, ((end - 1) % 16) + 1, active)
            continue
        fill(start_bar, begin % 16, 16, active)
        fill(finish_bar, 0, ((end - 1) % 16) + 1, active)
        for bar in range(start_bar + 1, min(finish_bar, start_bar + 9)):
            fill(bar, 0, 16, active)
        # Onset bars can fall inside a uniform sustained interval; retain their
        # occupancy as well, without iterating millions of intermediate bars.
        # Their cells are set below directly from the interval edges sweep.
    # Every onset bar is also needed for activity. For long uniform spans, an
    # onset inside an existing sustain may not have been one of eight exemplars.
    # Binary search determines coverage at its sixteen cells in bounded work.
    import bisect
    cumulative, amount = [], 0
    for point in ordered:
        amount += edges[point]
        cumulative.append(amount)
    for bar, pattern in bars.items():
        for slot in range(16):
            index = bisect.bisect_right(ordered, bar * 16 + slot) - 1
            if index >= 0 and cumulative[index] > 0:
                pattern[slot] = True
    return bars


def extract_features(score: Score) -> tuple[dict[str, Counter], dict]:
    """Each exact four-beat voice bar is counted once per file.

    Bar signatures retain absolute pitch, onset, duration and velocity, so repeats
    are suppressed while a transposed development or changed articulation stays.
    Phrase positions use 16/32 quarter-note windows, not inferred musical barlines.
    Time signatures are reported but varying-meter segmentation is not inferred.
    Activity includes held-note and silent bars, deduplicated by eight-bar phase
    and the 16 occupied/rest cells. Arbitrarily long gaps are processed analytically.
    """
    features = defaultdict(Counter)
    stats = Counter(notes=len(score.notes), pitched_notes=sum(n.channel != 9 for n in score.notes),
                    drum_notes=sum(n.channel == 9 for n in score.notes), voices=0,
                    bars_seen=0, repeated_bars_suppressed=0, learned_onsets=0)
    voices = defaultdict(list)
    for note in score.notes:
        voices[(note.track, note.port, note.channel)].append(note)
    for (_, _, channel), voice in sorted(voices.items()):
        stats["voices"] += 1
        is_drum = channel == 9
        if is_drum:
            lines = [("drums", voice)]
        else:
            top = _line(voice, True)
            bottom = _line(voice, False)
            role = "bass" if statistics.median(n.pitch for n in top) < 55 else "lead"
            lines = [(role, top)]
            if any(a.pitch != b.pitch for a, b in zip(top, bottom)):
                lines.append(("bass", bottom))
        for role, line in lines:
            line = sorted(line, key=lambda n: (n.start, n.pitch))
            bars = defaultdict(list)
            for note in line:
                bars[note.start // (score.ppq * 4)].append(note)
            seen, kept = set(), []
            seen_phrase = set()
            for bar, notes in sorted(bars.items()):
                stats["bars_seen"] += 1
                signature = tuple((quantize(n.start % (score.ppq * 4), score.ppq),
                                   quantize(n.duration, score.ppq), n.pitch, n.velocity) for n in notes)
                phrase_signature = (bar % 8, signature)
                if phrase_signature not in seen_phrase:
                    seen_phrase.add(phrase_signature)
                    for note in notes:
                        start = note.start / score.ppq
                        for length in (16, 32):
                            features[f"{role}.phrase_{length}_onsets"][str(int(start % length))] += 1
                if signature in seen:
                    stats["repeated_bars_suppressed"] += 1
                    continue
                seen.add(signature)
                kept.append((bar, notes))
            mean_velocity = statistics.mean(n.velocity for _, notes in kept for n in notes)
            # Learn consecutive-note relationships across barlines as well as
            # inside bars. Exact repeated 2/3/4-note fragments get one vote, so a
            # looping file cannot dominate and slow one-note-per-bar bass moves
            # remain learnable. Timing is relative within each private fragment;
            # the exported model contains only derived aggregate distributions.
            sequence = _line(line, True) if is_drum else line
            for window_size in (2, 3, 4):
                if is_drum and window_size > 2:
                    continue
                seen_fragments = set()
                for offset in range(len(sequence) - window_size + 1):
                    fragment = sequence[offset:offset + window_size]
                    origin = fragment[0].start
                    signature = tuple((quantize(n.start - origin, score.ppq), quantize(n.duration, score.ppq), n.pitch, n.velocity)
                                      for n in fragment)
                    if signature in seen_fragments:
                        stats["repeated_fragments_suppressed"] += 1
                        continue
                    seen_fragments.add(signature)
                    intervals = [max(-24, min(24, b.pitch - a.pitch)) for a, b in zip(fragment, fragment[1:])]
                    if window_size == 2:
                        a, b = fragment
                        delta = (b.start - a.start) / score.ppq
                        duration = a.duration / score.ppq
                        if not is_drum:
                            features[f"{role}.interval"][str(intervals[0])] += 1
                        if delta > 0:
                            features[f"{role}.inter_onset_beats"][_bin(delta, 1 / 24, 16)] += 1
                            features[f"{role}.gate"][_bin(duration / delta, .05, 2)] += 1
                            features[f"{role}.rest_beats"][_bin(max(0, delta - duration), 1 / 24, 16)] += 1
                    elif window_size == 3:
                        features[f"{role}.interval_next:{intervals[0]}"][str(intervals[1])] += 1
                    elif window_size == 4:
                        features[f"{role}.interval_next2:{intervals[0]},{intervals[1]}"][str(intervals[2])] += 1
            for bar, notes in kept:
                stats["learned_onsets"] += len(notes)
                pitches = [n.pitch for n in notes]
                if not is_drum:
                    features[f"{role}.register"].update(str(p // 12) for p in pitches)
                else:
                    features["drums.note"].update(map(str, pitches))
                for index, note in enumerate(notes):
                    start, duration = note.start / score.ppq, note.duration / score.ppq
                    features[f"{role}.duration_beats"][_bin(duration, 1 / 24, 16)] += 1
                    features[f"{role}.accent"][_bin(note.velocity / mean_velocity, .1, 2)] += 1
                    features[f"{role}.beat_position"][_bin(start % 4, 1 / 24, 4)] += 1
                features[f"{role}.bar_onsets"][str(min(64, len(notes)))] += 1
            seen_activity = set()
            for bar, occupied in sorted(_activity_bars(line, score.ppq).items()):
                stats["activity_bars_examined"] += 1
                signature = (bar % 8, tuple(occupied))
                if signature in seen_activity:
                    continue
                seen_activity.add(signature)
                stats["activity_patterns_used"] += 1
                if not any(occupied):
                    stats["silent_activity_patterns"] += 1
                if bar not in bars:
                    features[f"{role}.bar_onsets"]["0"] += 1
                for slot, active in enumerate(occupied):
                    features[f"{role}.quarter_beat_activity:{slot}"]["active" if active else "rest"] += 1
                for beat in range(4):
                    active = any(occupied[beat * 4:beat * 4 + 4])
                    for length in (16, 32):
                        phase = (bar * 4 + beat) % length
                        features[f"{role}.phrase_{length}_activity:{phase}"]["active" if active else "rest"] += 1
    # Normalize every distribution per file, so all unique usable files participate
    # and a long arrangement contributes the same weight as a short arrangement.
    for counter in features.values():
        total = sum(counter.values())
        for key in counter:
            counter[key] /= total
    return dict(features), dict(stats)


def add_features(target: dict, features: dict) -> None:
    for name, values in features.items():
        target.setdefault(name, Counter()).update(values)


def export_distributions(features: dict) -> dict:
    result = {}
    for name, counts in sorted(features.items()):
        total = sum(counts.values())
        if total:
            result[name] = {key: round(value / total, 9) for key, value in sorted(counts.items())}
    return result


def validation_metrics(training: dict, held_out: dict) -> dict:
    """Cross-entropy against an independent musical/game-group holdout.

    Laplace smoothing assigns nonzero probability to unseen bins; reported as
    objective distribution fit, never as listening quality or proof of originality.
    """
    result = {}
    for name in ("lead.interval", "bass.interval", "lead.inter_onset_beats", "lead.duration_beats"):
        observed, reference = held_out.get(name, {}), training.get(name, {})
        total = sum(observed.values())
        if not total or not reference:
            continue
        keys = set(reference) | set(observed)
        denom = sum(reference.values()) + .01 * len(keys)
        entropy = -sum(weight / total * math.log2((reference.get(key, 0) + .01) / denom)
                       for key, weight in observed.items())
        result[name] = {"cross_entropy_bits": round(entropy, 6), "bins": len(keys)}
    return result
