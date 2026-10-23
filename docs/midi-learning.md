# Local MIDI learning experiment

This pipeline inventories VGMusic's public archive, downloads its listed MIDI
files, removes duplicate arrangements, and fits a statistical music model. It
does not change the deployed player or automatically publish source files.

The inventory on 23 October 2026 contained 31,806 MIDI URLs in 56 archive
sections. The separately linked newly submitted files page returned a database
connection error; that gap is retained in the manifest and audit report.
All 31,806 listed files were downloaded. After 180 exact duplicates, 352 musical
duplicates and 138 malformed files were excluded, the final model covered
31,136 usable unique arrangements and 89,611,033 notes. This is the usable
corpus, not a claim that every listed file or the unavailable page was learned.

## Run or resume

Run these commands from the repository root. Python 3 and `requests` are needed
for collection; parsing, training and MIDI generation use the Python standard
library. The older MIDI study renderer uses Node and the authored GB sample
bank; current production audio uses the MAME-derived chip host described below.

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

The version 469 refinement puts learned phrasing inside a rack of two
MAME-derived Game Boy APUs, each retaining four hardware channels. Newly generated two-bar motifs recur
through an eight-bar introduce, answer, vary and return form. Stable harmonic
fields, slower supporting lines and shared rests make room for the retained
asynchronous market packets. Market observations change expression and activity
without reseeding the complete motif on each price tick. The eight slots carry
lead, arpeggios, held chord tones, bass, a waveform-resonance drone, drums and
short chip grains. Arpeggio echoes are scored repeats that consume their lane.
No raw MIDI or source songs reach the browser.

`chip-ensemble-arrangement.js` gives lead and arpeggio parts complementary
response windows, then introduces drone/texture after chord openings. All roles
share cadence breaths. Envion's duration/overlap and envelope-window ideas inform
this arrangement; its sample player and Pd DSP are not active. The drone's
harmonic emphasis is encoded in legal 32-sample, four-bit wave RAM, not a claimed
hardware resonant filter.

`scripts/export-midi-phrase-model.py` writes `midi-phrase-model.js`: a
210,311-byte aggregate with 301 distributions—104 lead, 124 bass and 73 drum
tables—with all selected probability mass and the final model checksum.
Lead/bass tables contain marginal and first-order interval statistics plus
rhythm and articulation; drum tables contain timing, articulation and activity.
The runtime currently uses learned lead phrasing, bass timing/gates and drum
accents/gates. Second-order transitions and source instrument-note sequences
are excluded. Harmony and phrase form remain authored composition rules.

`scripts/export-midi-originality.py` writes a compact source interval index
from all 31,136 readable unique arrangements. It indexes consecutive runs of
eight intervals (nine notes), extracting the top and bottom onset lines per
pitched track, port and channel. Key, tempo, duration, timbre and velocity do
not affect these comparisons. The browser verifies the eight MiB index's
SHA-256 on its first audio start and keeps one shared in-memory copy.

The shared final driver screens learned lead pitches after harmony fitting and
channel allocation, retaining eight previous accepted pitches across bars.
A matching candidate is changed to another allowed harmonic tone or withheld.
Browser index loading is asynchronous: the original chip harmony, bass, noise
and packets can run while learned lead attacks await verification. Offline
rendering awaits the same index preparation and applies the same final-pitch
guard; unavailable verification suppresses learned lead attacks. This conservative
index can reject new phrases too, through hash collisions (estimated 0.73% per
window). It cannot establish perceptual originality: shorter hooks, altered
melodies, inner chord voices and melodies split across tracks remain outside
its exact-match coverage. The 138 malformed source exclusions and unavailable
new-files page are also outside the index.

The raw Game Boy version 468 was deployed at commit `a84fac4`. Version 469
adds ensemble phrasing. The collectible engine identity advances to
`upic-nft-gb-v3`. A 32-second ETH reconstruction contains 231 scored events,
uses all eight channels and peaks at approximately 0.198 with fixed rack
headroom and master gain. Its guard reports two revoicings and zero blocked lead candidates.
Scored event counts are not a claim that all candidates sounded unchanged.
Build checks succeeded; no subjective audition or browser check is claimed.
Equivalence after arbitrary live/replay seeks remains unverified.

An earlier independent
audit checked 24,812 source and transposed windows from 303 files with no missed
indexed matches. Those historical checks do not establish subjective quality
or verify every behavior of the current chip integration.

## Offline regression checks

```sh
python3 -m unittest discover -s scripts -p 'test_*midi*.py'
python3 -m unittest discover -s scripts -p 'test_collect_vgmusic.py'
```
