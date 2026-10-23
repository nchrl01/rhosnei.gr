import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createOriginalityMatcher, installOriginalityIndex, loadOriginalityIndex,
  originalityIndexStatus, sourceMelodyMatch, MIDI_ORIGINALITY_INFO,
} from '../apps/web/public/midi-originality.js';

const reference = [60, 64, 67, 65, 62, 69, 71, 66, 63, 70, 61];
const generated = spawnSync('python3', ['-c', `
import importlib.util,json,sys
sys.path.insert(0,'scripts')
spec=importlib.util.spec_from_file_location('exporter','scripts/export-midi-originality.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
notes=json.loads(sys.argv[1]); positions=[]
for key in m.line_hashes(notes):
 a,b=key>>32,key&m.MASK
 positions.extend((a+i*b)&(m.BITS-1) for i in range(m.HASHES))
print(json.dumps(positions))
`, JSON.stringify(reference)], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
assert.equal(generated.status, 0, generated.stderr);
const fixture = new Uint8Array(MIDI_ORIGINALITY_INFO.bytes);
for (const position of JSON.parse(generated.stdout)) fixture[position >>> 3] |= 1 << (position & 7);
const fixtureMatcher = createOriginalityMatcher(fixture, MIDI_ORIGINALITY_INFO);

test('Python and JavaScript hash the same consecutive interval windows', () => {
  for (let i = 0; i <= reference.length - 9; i += 1) {
    const result = fixtureMatcher(reference.slice(i, i + 9));
    assert.equal(result.match, true);
    assert.equal(result.windowsChecked, 1);
  }
});

test('A match survives global pitch transposition', () => {
  assert.equal(fixtureMatcher(reference.map(note => note + 7)).match, true);
  assert.equal(fixtureMatcher(reference.map(note => note - 12)).match, true);
});

test('Runtime scans after leading notes, including cross-bar windows', () => {
  const result = fixtureMatcher([80, 72, 57, ...reference]);
  assert.equal(result.match, true);
  assert.equal(result.startIndex, 3);
});

test('Short and invalid input cannot be confused with a completed source check', () => {
  assert.deepEqual(fixtureMatcher(reference.slice(0, 8)), {
    ready: true, match: false, windowsChecked: 0, reason: 'below-nine-note-window',
  });
  assert.equal(fixtureMatcher([60, NaN, 62]).invalid, true);
  assert.equal(fixtureMatcher([60, 129, 62]).match, true);
  assert.equal(fixtureMatcher(new DataView(new ArrayBuffer(12))).invalid, true);
  assert.equal(fixtureMatcher([60, 61, 62, 63, 64, 65, 66, 67, 68]).match, false);
});

test('Unavailable index refuses to mark melody ready; a failed fetch allows retry', async () => {
  assert.equal(sourceMelodyMatch(reference).ready, false);
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw new Error('offline check'); };
  try {
    assert.equal((await loadOriginalityIndex()).state, 'error');
    assert.equal((await loadOriginalityIndex()).state, 'error');
    assert.equal(requests, 2);
    assert.equal(originalityIndexStatus().ready, false);
  } finally { globalThis.fetch = original; }
});

test('Published index requires the exact checksum before live use', async () => {
  await assert.rejects(installOriginalityIndex(new Uint8Array(3)), /incomplete/);
  await assert.rejects(installOriginalityIndex(fixture), /integrity check failed/);
  const bytes = await readFile(new URL('../apps/web/public/midi-originality-index.bin', import.meta.url));
  assert.equal((await installOriginalityIndex(bytes)).ready, true);
  assert.equal(sourceMelodyMatch(Array(9).fill(60)).match, true);
});
