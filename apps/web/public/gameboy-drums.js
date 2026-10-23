// Original, dry chip-inspired percussion. These are generated pulse and LFSR
// voices, not imported game samples or a claim of Game Boy hardware emulation.
const NOISE_CACHE = new WeakMap();
const MAX_VOICES = 4;
const MAX_HIT_GAIN = .12;
const CANCEL_RELEASE = .006;
const INSTRUMENTS = Object.freeze({
 kick: {trim:.18, decay:.055, pitch:190, floor:46, sweep:.055, cutoff:1000},
 tom: {trim:.17, decay:.085, pitch:300, floor:112, sweep:.075, cutoff:1400},
 snare: {trim:.21, decay:.038, highpass:650, cutoff:6500, noise:'snare'},
 hat: {trim:.19, decay:.014, highpass:3400, cutoff:9200, noise:'hat'},
});

function hash(value) {
 let n = Number(value) >>> 0;
 n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
 n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
 return (n ^ (n >>> 16)) >>> 0;
}

function noiseBuffers(ctx) {
 let cached = NOISE_CACHE.get(ctx);
 if (cached) return cached;
 // Each context constructs only two short mono buffers. A fixed nonzero
 // register and fixed clock make the source repeatable on every render.
 const make = (bits, clock) => {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .48), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let register = (1 << bits) - 1, phase = 0, total = 0;
  for (let i = 0; i < data.length; i++) {
   phase += clock / ctx.sampleRate;
   while (phase >= 1) {
    const feedback = (register ^ (register >>> 1)) & 1;
    register = (register >>> 1) | (feedback << (bits - 1));
    phase--;
   }
   data[i] = (register & 1) ? 1 : -1;
   total += data[i];
  }
  // Remove the tiny finite-buffer DC bias before filtering individual hits.
  const mean = total / data.length;
  for (let i = 0; i < data.length; i++) data[i] = (data[i] - mean) / (1 + Math.abs(mean));
  return buffer;
 };
 cached = {snare:make(15, 12000), hat:make(7, 18000)};
 NOISE_CACHE.set(ctx, cached);
 return cached;
}

export function createGameBoyDrums(ctx, destination) {
 const buffers = noiseBuffers(ctx), voices = new Set();
 let closed = false;

 function dispose(record) {
  if (record.disposed) return;
  record.disposed = true;
  record.source.onended = null;
  for (const node of record.nodes) node.disconnect();
  voices.delete(record);
 }

 function envelopeAt(record, time) {
  const {start, end} = record.voice;
  const {attackEnd, releaseStart, peak, body} = record.envelope;
  if (time <= start || time >= end) return 0;
  if (time < attackEnd) return peak * (time - start) / (attackEnd - start);
  if (time < releaseStart) {
   const amount = (time - attackEnd) / (releaseStart - attackEnd);
   return peak * Math.pow(body / peak, amount);
  }
  return body * (end - time) / (end - releaseStart);
 }

 function cancelVoice(record) {
  if (record.disposed || record.voice.fading) return;
  record.voice.fading = true;
  const now = ctx.currentTime, param = record.gain.gain;
  // A queued source must never inherit a GainNode's default gain during
  // cancellation. Explicitly zero it before removing its scheduled attack.
  if (record.voice.start >= now || ctx.state !== 'running') {
   param.cancelScheduledValues(now);
   param.setValueAtTime(0, now);
   record.stopAt = now;
   try { record.source.stop(now); } catch {}
   dispose(record);
   return;
  }
  const stop = Math.min(record.voice.end, now + CANCEL_RELEASE);
  if (stop <= now) { dispose(record); return; }
  // Evaluating our known envelope also works in browsers without
  // cancelAndHoldAtTime; AudioParam.value is not a reliable held value.
  const held = envelopeAt(record, now);
  param.cancelScheduledValues(now);
  param.setValueAtTime(held, now);
  param.linearRampToValueAtTime(0, stop);
  record.stopAt = stop;
  try { record.source.stop(stop); } catch { dispose(record); }
 }

 function canFit(start, end) {
  // Lookahead can hold several sequential hits. Limit simultaneous sound,
  // including release fades, without dropping notes just because they are
  // queued. Overlap can increase only at the new hit or another hit's start.
  const relevant = [...voices].filter(record => record.stopAt > start && record.voice.start < end);
  const boundaries = [start, ...relevant.map(record => record.voice.start).filter(time => time > start && time < end)];
  return boundaries.every(time => relevant.filter(record => record.voice.start <= time && record.stopAt > time).length < MAX_VOICES);
 }

 function hit({drum, time = ctx.currentTime, duration = .12, gain = .04, seed = 0} = {}) {
  const instrument = Object.hasOwn(INSTRUMENTS, drum) ? INSTRUMENTS[drum] : null;
  if (closed || ctx.state === 'closed' || !instrument || !Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(gain) || gain <= 0) return null;
  const end = time + duration;
  const start = Math.max(time, ctx.currentTime + .003);
  // Preserve the score's end even when a late scheduler clamps the attack.
  // An expired hit is discarded instead of creating a new tail in a rest.
  if (!Number.isFinite(end) || end <= start || !canFit(start, end)) return null;
  const length = end - start, variation = hash((Number(seed) >>> 0) ^ drum.charCodeAt(0)) / 0x100000000;
  const pitchScale = .97 + variation * .06;
  const envelopeGain = ctx.createGain(), nodes = [envelopeGain];
  envelopeGain.gain.value = 0;
  let source;
  if (instrument.noise) {
   source = ctx.createBufferSource();
   source.buffer = buffers[instrument.noise];
   source.loop = true;
   source.playbackRate.value = pitchScale;
  } else {
   // Native square oscillators are band limited by Web Audio. The falling
   // fundamental gives kick and tom their body without a harsh noise click.
   source = ctx.createOscillator();
   source.type = 'square';
   source.frequency.setValueAtTime(instrument.pitch * pitchScale, start);
   source.frequency.exponentialRampToValueAtTime(instrument.floor * pitchScale, start + Math.min(instrument.sweep, length * .7));
  }
  nodes.push(source);
  let output = source;
  if (instrument.highpass) {
   const highpass = ctx.createBiquadFilter();
   highpass.type = 'highpass';
   highpass.frequency.value = Math.min(instrument.highpass, ctx.sampleRate * .44);
   highpass.Q.value = .55;
   output.connect(highpass); output = highpass; nodes.push(highpass);
  }
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = Math.min(instrument.cutoff, ctx.sampleRate * .44);
  lowpass.Q.value = .55;
  output.connect(lowpass); lowpass.connect(envelopeGain); nodes.push(lowpass);
  envelopeGain.connect(destination);

  // Instrument trims put the raw body near the existing melodic assets'
  // ~0.13–0.2 RMS range. The scored gain remains the performance dynamic;
  // the cap plus four-voice limit leaves headroom for the shared 6x master.
  const peak = Math.min(MAX_HIT_GAIN, gain) * instrument.trim;
  const attackEnd = start + Math.min(.0015, length * .12);
  const releaseStart = end - Math.min(.012, length * .18);
  const body = peak * Math.max(.0001, Math.exp(-(releaseStart - attackEnd) / instrument.decay));
  const param = envelopeGain.gain;
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(peak, attackEnd);
  param.exponentialRampToValueAtTime(body, releaseStart);
  param.linearRampToValueAtTime(0, end);
  const voice = {start, end, fading:false};
  const record = {voice, source, gain:envelopeGain, nodes, stopAt:end, disposed:false, envelope:{attackEnd, releaseStart, peak, body}};
  voices.add(record);
  source.onended = () => dispose(record);
  try {
   if (instrument.noise) source.start(start, variation * source.buffer.duration);
   else source.start(start);
   // The final gain follows every filter, so filter ringing cannot outlive
   // the score. Source termination and envelope silence share the exact end.
   source.stop(end);
  } catch {
   try { source.stop(ctx.currentTime); } catch {}
   dispose(record);
   return null;
  }
  return {time:start, voice};
 }

 function clear() {
  for (const record of voices) cancelVoice(record);
 }

 return {
  hit,
  clear,
  // Replace upcoming score plans while letting earlier attacks finish.
  cancelAfter(time) {
   if (!Number.isFinite(time)) return;
   for (const record of voices) if (record.voice.start >= time) cancelVoice(record);
  },
  close() {
   if (closed) return;
   closed = true;
   clear();
  },
  snapshot() {
   return {voices:[...voices].filter(record => !record.voice.fading && record.stopAt > ctx.currentTime).length};
  },
 };
}
