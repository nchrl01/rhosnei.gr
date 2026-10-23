#!/usr/bin/env python3
"""Export aggregate lead statistics for the browser's shared phrase composer.

Only marginal and first-order pitch statistics are exported. No MIDI files,
melodies, song identifiers, second-order transitions, or source arrangements
are embedded. The runtime composes new phrases from these distributions plus
its own market response, harmony, range and phrase rules.

Example:
  python3 scripts/export-midi-phrase-model.py --model /path/to/model.json \
    --output apps/web/public/midi-phrase-model.js
"""

from __future__ import annotations

import argparse
from decimal import Decimal, ROUND_FLOOR
import hashlib
import json
from pathlib import Path


VERSION = 1
PROBABILITY_DECIMALS = 9
PROBABILITY_UNITS = 10 ** PROBABILITY_DECIMALS
NUMERIC_TABLES = (
    "lead.interval", "lead.inter_onset_beats", "lead.duration_beats",
    "lead.gate", "lead.accent", "lead.register", "lead.bar_onsets",
)
PREFIXES = (
    "lead.interval_next:", "lead.phrase_32_activity:",
    "lead.quarter_beat_activity:",
)


def probability(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, Decimal)):
        raise ValueError(f"Invalid probability in {name}")
    result = Decimal(value)
    if not result.is_finite() or result < 0:
        raise ValueError(f"Invalid probability in {name}")
    return result


def numeric_label(label, name):
    value = Decimal(label)
    if not value.is_finite():
        raise ValueError(f"Non-finite numeric label in {name}")
    return int(value) if value == value.to_integral_value() else float(value)


def normalize_table(name, table):
    """Round deterministically while retaining a unit sum and recording losses."""
    if not isinstance(table, dict) or not table:
        raise ValueError(f"Empty or invalid table: {name}")
    activity = "_activity:" in name
    if activity and set(table) != {"active", "rest"}:
        raise ValueError(f"Expected active/rest probabilities in {name}")
    labels = sorted(table) if activity else sorted(table, key=Decimal)
    weights = [probability(table[label], name) for label in labels]
    total = sum(weights)
    if total <= 0:
        raise ValueError(f"Table has no probability mass: {name}")

    # Largest remainder rounding preserves a total of exactly 1e9 integer
    # units. Source tables are already rounded to nine decimal places; no
    # cutoff or top-K pruning is imposed on the learned probabilities.
    scaled = [weight / total * PROBABILITY_UNITS for weight in weights]
    units = [int(value.to_integral_value(rounding=ROUND_FLOOR)) for value in scaled]
    remainder = PROBABILITY_UNITS - sum(units)
    order = sorted(range(len(labels)), key=lambda i: (-(scaled[i] - units[i]), i))
    for index in order[:remainder]:
        units[index] += 1
    kept = [i for i, value in enumerate(units) if value > 0]
    retained_mass = sum(weights[i] for i in kept) / total
    if activity:
        result = {label: units[i] / PROBABILITY_UNITS for i, label in enumerate(labels)}
    else:
        result = [[numeric_label(labels[i], name), units[i] / PROBABILITY_UNITS] for i in kept]
    return result, {
        "sourceEntries": len(labels),
        "exportedEntries": len(kept),
        "retainedProbability": float(retained_mass),
    }


def export_model(source_bytes):
    source = json.loads(source_bytes, parse_float=Decimal)
    if source.get("version") != 1 or source.get("kind") != "aggregate_statistical_music_model":
        raise ValueError("Expected a version 1 aggregate statistical MIDI model")
    for count in ("unique_files", "notes"):
        if type(source.get(count)) is not int or source[count] < 1:
            raise ValueError(f"Invalid {count} in model")
    tables = source.get("distributions")
    if not isinstance(tables, dict):
        raise ValueError("Model has no distributions")
    for name in NUMERIC_TABLES:
        if name not in tables:
            raise ValueError(f"Missing required table: {name}")
    selected = sorted(name for name in tables if name in NUMERIC_TABLES or name.startswith(PREFIXES))
    for prefix, count in (("lead.phrase_32_activity:", 32), ("lead.quarter_beat_activity:", 16)):
        for phase in range(count):
            if f"{prefix}{phase}" not in tables:
                raise ValueError(f"Missing activity phase: {prefix}{phase}")
    if not any(name.startswith("lead.interval_next:") for name in selected):
        raise ValueError("Model has no first-order interval transitions")
    distributions, coverage = {}, {}
    for name in selected:
        distributions[name], coverage[name] = normalize_table(name, tables[name])
    support = source.get("support_files", {})
    return {
        "version": VERSION,
        "kind": "aggregate_statistical_music_model",
        "sourceCount": source["unique_files"],
        "noteCount": source["notes"],
        "modelSha": hashlib.sha256(source_bytes).hexdigest(),
        "datasetFingerprint": source["dataset_fingerprint"],
        "parserVersion": source["parser_version"],
        "gridPerBeat": source["grid_per_beat"],
        "sourceUrl": "https://www.vgmusic.com/",
        "scope": "Lead statistics only; bass and harmony remain authored by the composer.",
        "method": "Aggregate statistical sampling with authored composition rules; not a neural model.",
        "weighting": source["weighting"],
        "containsSourceSequences": False,
        "pitchHistoryOrder": 1,
        "limitations": [
            "Distribution sampling does not guarantee that a generated phrase is unlike every existing melody.",
            "No complete songs, source melodies, MIDI tracks, or arrangement templates are included.",
            "Timing statistics approximate melody from the highest simultaneous voice; expressive pitch bends are not modeled.",
        ],
        "export": {
            "probabilityDecimals": PROBABILITY_DECIMALS,
            "distributionCount": len(selected),
            "omittedDistributionCount": len(tables) - len(selected),
            "pruning": "None; nine-decimal normalized probabilities with largest-remainder rounding.",
            "coverage": coverage,
        },
        "supportFiles": {name: support[name] for name in selected if name in support},
        "distributions": distributions,
    }


def javascript(model):
    def compact(value):
        return json.dumps(value, ensure_ascii=True, separators=(",", ":"), allow_nan=False)

    lines = [
        "// Generated by scripts/export-midi-phrase-model.py. Do not edit by hand.",
        "// Aggregate distributions only; no song melodies or source MIDI are included.",
        "export const MIDI_PHRASE_MODEL = Object.freeze({",
    ]
    for key, value in model.items():
        if key == "distributions":
            lines.append('  "distributions":{')
            items = list(value.items())
            for index, (name, table) in enumerate(items):
                comma = "," if index + 1 < len(items) else ""
                lines.append(f"    {compact(name)}:{compact(table)}{comma}")
            lines.append("  }")
        else:
            lines.append(f"  {compact(key)}:{compact(value)},")
    lines.extend(["});", ""])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path("apps/web/public/midi-phrase-model.js"))
    args = parser.parse_args()
    model = export_model(args.model.read_bytes())
    content = javascript(model).encode("utf-8")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary.write_bytes(content)
    temporary.replace(args.output)
    coverage = model["export"]["coverage"]
    print(json.dumps({
        "output": str(args.output), "bytes": len(content),
        "sourceCount": model["sourceCount"], "noteCount": model["noteCount"],
        "distributions": len(model["distributions"]),
        "entries": sum(item["exportedEntries"] for item in coverage.values()),
        "minimumRetainedProbability": min(item["retainedProbability"] for item in coverage.values()),
        "modelSha": model["modelSha"],
    }, indent=2))


if __name__ == "__main__":
    main()
