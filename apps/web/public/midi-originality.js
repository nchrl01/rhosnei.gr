/**
 * Conservative source-melody membership guard for the aggregate MIDI model.
 * No source notes are bundled. A match means reject/recompose, including false
 * positives; a pass is not a perceptual-originality or legal determination.
 */
import { ORIGINALITY_INDEX } from './midi-originality-index.js?v=455';

export const MIDI_ORIGINALITY_INFO = ORIGINALITY_INDEX;
const BASE_A = 16777619;
const BASE_B = 2246822519;
let activeMatcher = null;
let inflight = null;
let state = 'idle';
let failure = null;

function mix32(value) {
  value ^= value >>> 16;
  value = Math.imul(value, 2246822507);
  value ^= value >>> 13;
  value = Math.imul(value, 3266489909);
  return (value ^ (value >>> 16)) >>> 0;
}

function validateMetadata(metadata) {
  if (metadata?.version !== 1
      || metadata.algorithm !== 'polynomial-pair-mix32-bloom-v1'
      || metadata.gramIntervals !== 8 || metadata.notesPerWindow !== 9
      || metadata.bits !== 67108864 || metadata.bytes !== 8388608
      || metadata.hashes !== 6) {
    throw new Error('Unsupported MIDI source-melody index');
  }
}

/**
 * Synchronous matcher for already-trusted bytes (offline audits and checks).
 * This factory validates format/length, not authenticity. Browser playback uses
 * loadOriginalityIndex(), which additionally verifies the published SHA-256.
 * Input is an array of actual sounding MIDI pitches, in chronological order.
 */
export function createOriginalityMatcher(buffer, metadata = ORIGINALITY_INDEX) {
  validateMetadata(metadata);
  const bits = buffer instanceof Uint8Array ? buffer
    : buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : null;
  if (!bits || bits.byteLength !== metadata.bytes) {
    throw new Error('MIDI source-melody index has an invalid length');
  }
  let powerA = 1;
  let powerB = 1;
  for (let i = 1; i < metadata.gramIntervals; i += 1) {
    powerA = Math.imul(powerA, BASE_A);
    powerB = Math.imul(powerB, BASE_B);
  }
  const bitMask = metadata.bits - 1;
  function contains(first, step) {
    for (let i = 0; i < metadata.hashes; i += 1) {
      const position = ((first + Math.imul(i, step)) & bitMask) >>> 0;
      if (!(bits[position >>> 3] & (1 << (position & 7)))) return false;
    }
    return true;
  }
  return function matchSourceMelody(midiNotes) {
    if ((!Array.isArray(midiNotes) && !ArrayBuffer.isView(midiNotes))
        || typeof midiNotes.length !== 'number' || midiNotes.length > 4096
        || !Array.from(midiNotes).every(note => Number.isInteger(note) && note >= 0 && note <= 127)) {
      return { ready: true, match: true, invalid: true, reason: 'invalid-midi-pitches', windowsChecked: 0 };
    }
    if (midiNotes.length < metadata.notesPerWindow) {
      return { ready: true, match: false, windowsChecked: 0, reason: 'below-nine-note-window' };
    }
    const intervals = [];
    for (let i = 1; i < midiNotes.length; i += 1) intervals.push(midiNotes[i] - midiNotes[i - 1] + 128);
    let a = 0;
    let b = 0;
    for (let i = 0; i < metadata.gramIntervals; i += 1) {
      a = (Math.imul(a, BASE_A) + intervals[i]) >>> 0;
      b = (Math.imul(b, BASE_B) + intervals[i]) >>> 0;
    }
    const windows = intervals.length - metadata.gramIntervals + 1;
    for (let i = 0; i < windows; i += 1) {
      if (i) {
        a = (Math.imul(a - Math.imul(intervals[i - 1], powerA), BASE_A)
             + intervals[i + metadata.gramIntervals - 1]) >>> 0;
        b = (Math.imul(b - Math.imul(intervals[i - 1], powerB), BASE_B)
             + intervals[i + metadata.gramIntervals - 1]) >>> 0;
      }
      if (contains(mix32(a), mix32(b) | 1)) {
        return { ready: true, match: true, startIndex: i, notesMatched: metadata.notesPerWindow,
          windowsChecked: i + 1, reason: 'source-interval-window' };
      }
    }
    return { ready: true, match: false, windowsChecked: windows, reason: 'no-indexed-interval-window' };
  };
}

export function originalityIndexStatus() {
  return { ready: Boolean(activeMatcher), state, error: failure,
    sourceFiles: ORIGINALITY_INDEX.sourceFiles,
    sha256: ORIGINALITY_INDEX.binarySha256,
    notesPerWindow: ORIGINALITY_INDEX.notesPerWindow };
}

export function sourceMelodyMatch(midiNotes) {
  if (!activeMatcher) return { ready: false, match: null, state, error: failure, windowsChecked: 0 };
  return activeMatcher(midiNotes);
}

/** Validate downloaded bytes before making them eligible for live composition. */
export async function installOriginalityIndex(buffer) {
  validateMetadata(ORIGINALITY_INDEX);
  const bytes = buffer instanceof Uint8Array ? buffer
    : buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : null;
  if (!bytes || bytes.byteLength !== ORIGINALITY_INDEX.bytes) {
    throw new Error('MIDI source-melody index is incomplete');
  }
  if (!globalThis.crypto?.subtle) throw new Error('MIDI index integrity verification is unavailable');
  // Digest a separate copy: an untrusted mutable caller cannot swap the bytes
  // while verification is in progress and then have a different buffer trusted.
  const verifiedBytes = new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', verifiedBytes);
  const sha = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  if (sha !== ORIGINALITY_INDEX.binarySha256) throw new Error('MIDI source-melody index integrity check failed');
  activeMatcher = createOriginalityMatcher(verifiedBytes, ORIGINALITY_INDEX);
  state = 'ready';
  failure = null;
  return originalityIndexStatus();
}

/** Fetch once at audio start, without blocking page rendering. Errors allow retry. */
export function loadOriginalityIndex() {
  if (activeMatcher) return Promise.resolve(originalityIndexStatus());
  if (inflight) return inflight;
  const retrying = state === 'error';
  state = 'loading';
  failure = null;
  inflight = (async () => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15000);
    try {
      const url = new URL('./midi-originality-index.bin', import.meta.url);
      url.searchParams.set('v', ORIGINALITY_INDEX.binarySha256.slice(0, 16));
      const response = await fetch(url, { signal: abort.signal, cache: retrying ? 'reload' : 'force-cache', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`MIDI source-melody index request failed (${response.status})`);
      const length = response.headers.get('content-length');
      if (length && Number(length) > ORIGINALITY_INDEX.bytes) throw new Error('MIDI source-melody index is too large');
      await installOriginalityIndex(await response.arrayBuffer());
      return originalityIndexStatus();
    } catch (error) {
      activeMatcher = null;
      state = 'error';
      failure = error?.name === 'AbortError' ? 'MIDI source-melody index request timed out' : String(error?.message || error);
      return originalityIndexStatus();
    } finally {
      clearTimeout(timer);
      inflight = null;
    }
  })();
  return inflight;
}
