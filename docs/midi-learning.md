# Local MIDI learning experiment

This pipeline inventories VGMusic's public archive, downloads its listed MIDI
files, removes duplicate arrangements, and fits a statistical music model. It
does not change the deployed player or automatically publish source files.

The inventory on 23 October 2026 contained 31,806 MIDI URLs in 56 archive
sections. The separately linked newly submitted files page returned a database
connection error; that gap is retained in the manifest and audit report.

## Run or resume

Run these commands from the repository root. Python 3 and `requests` are needed
for collection; parsing, training and MIDI generation use the Python standard
library. Rendering uses Node and the existing authored GB sample bank.

```sh
python3 -u scripts/collect-vgmusic.py
python3 scripts/train-vgmusic-model.py --manifest .local/vgmusic/manifest.json --output .local/vgmusic/model.json --report .local/vgmusic/training-report.json --workers 3
python3 scripts/audit-midi-study.py --manifest .local/vgmusic/manifest.json --model .local/vgmusic/model.json --report .local/vgmusic/training-report.json --output .local/vgmusic/audit.json
python3 scripts/generate-midi-study.py --model .local/vgmusic/model.json --output .local/vgmusic/active --seed 1917 --energy .7 --direction up
node scripts/render-midi-study.mjs .local/vgmusic/active.events.json .local/vgmusic/active.wav
```

Use `--inventory-only` to collect listings without downloading the MIDI files,
`--refresh-index` to update the inventory, or `--retry-failed` to retry failed
downloads. Downloads use at most four connections, a global request rate limit,
verified TLS, bounded file sizes, and server backoff. Completed downloads are
content addressed and recorded in an append-only journal. Training can safely
read an inventory snapshot while downloads continue; rerun it after collection
finishes to include the whole available corpus. Do not run two trainers against
the same cache simultaneously.

All raw files, author/source metadata, hashes, intermediate features, models and
study outputs stay under the gitignored `.local/vgmusic` directory. The report
accounts for every inventoried source, including pending, duplicate and
unreadable files. The audit checks local checksums, the site's available MD5
metadata, duplicate references, and final model coverage. An incomplete audit
must not be described as learning the full archive.

## What is learned

The model contains pooled distributions of pitch intervals and one/two-interval
transitions; note spacing, durations, rests and articulation; velocity accents;
register; onset density; and activity across fixed phrase windows. It keeps lead,
bass and percussion statistics separate. Voice-role extraction is approximate.
Each unique file contributes equal total weight to each available statistic,
and repeated fragments are suppressed so long loops cannot dominate.

Exact file copies are identified by SHA-256. Musical duplicates are identified
from note timing, duration and polyphony on a 1/96-beat grid, with leading silence
and global transposition removed. Tempo, instrumentation, metadata and velocity
differences do not make an arrangement unique. Substantially changed arrangements
remain separate; this is not a general plagiarism or near-duplicate detector.

Validation uses a deterministic holdout grouped by game when metadata exists,
after deduplication. The final model is fitted to all usable unique files. The
report's distribution-fit metrics measure prediction of musical statistics;
they do not measure how pleasant the generated music sounds.

## Generated examples and the engine

The generator samples the learned model and exports MIDI plus an event list.
Its key, chord progression, phrase form, pitch limits and coordinated rests are
explicit composition rules. The model does not learn whole-song form, harmony
or orchestration, and this experiment is not neural-network training.

Market energy and direction can shape the generated performance. The offline
examples demonstrate that connection with controlled inputs; they are not a
capture of the live market engine. Rendering uses UPIC's original GB timbres.
Generated MIDI contains newly sampled notes rather than retrieved source songs,
but coincidental similarity remains possible. Musical quality still requires
listening evaluation.

## Integration in the audio tools

The shared market phrase composer now uses a compact export of the learned
lead distributions. Audio Lab and AV Lab expose **Learned phrasing** and
**Phrase variation**; their saved presets and connection routes retain these
controls. The homepage uses learned phrasing by default. The existing market
feed still gates activity and sets direction, energy, harmony and tempo. All
voices and visuals retain the shared score clock. No raw MIDI is sent to the
browser.

`scripts/export-midi-phrase-model.py` writes `midi-phrase-model.js`: a 77,804-byte
aggregate containing 104 distributions, all selected probability mass, and
the final model checksum. It contains no stored source melodies. Setting
Learned phrasing to zero restores the function-contour composer. Both paths
use the final-pitch source screen.

`scripts/export-midi-originality.py` writes a compact source interval index
from all 31,136 readable unique arrangements. It indexes consecutive runs of
eight intervals (nine notes), extracting the top and bottom onset lines per
pitched track, port and channel. Key, tempo, duration, timbre and velocity do
not affect these comparisons. The browser verifies the eight MiB index's
SHA-256 on its first audio start and keeps one shared in-memory copy.

The audio scheduler screens the actual lead pitches after harmony fitting and
register folding. It retains eight previous accepted pitches across bars. A
matching candidate is changed to another available harmonic tone or withheld;
melodic attacks wait if the index cannot be loaded or verified. Chords, bass,
Envion and data sonification are not blocked by that download. This conservative
index can reject new phrases too, through hash collisions (estimated 0.73% per
window). It cannot establish perceptual originality: shorter hooks, altered
melodies, inner chord voices and melodies split across tracks remain outside
its exact-match coverage. The 138 malformed source exclusions and unavailable
new-files page are also outside the index.

These changes are local until a separate deployment. An initial independent
audit checked 24,812 source and transposed windows from 303 files with no missed
indexed matches. Integration tests also check the final generated melody after
guard adjustments. Neither check is a subjective listening evaluation.

## Offline regression checks

```sh
python3 -m unittest discover -s scripts -p 'test_*midi*.py'
python3 -m unittest discover -s scripts -p 'test_collect_vgmusic.py'
```
