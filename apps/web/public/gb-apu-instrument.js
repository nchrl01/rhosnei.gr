import {GB_INSTRUMENTS} from './gameboy-instruments.js?v=451';
import {GameBoyApu} from './mame-gb-apu.js?v=468';
import {silenceGameBoyChannel} from './gb-apu-silence.js?v=468';
import {createMelodyOriginalityGuard, prepareLearnedPhrases} from './learned-market-phrase.js?v=469';

// Score-to-register driver for one four-channel APU. Envelopes, pulse sweep,
// wave output and noise all execute in the hardware model, never extra synths.
const MODULES = new WeakMap();
const MODELS = new Set(['dmg', 'mgb', 'cgb']);
const MAX_RECORDS = 512;
const MAX_HORIZON = 30;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const number = (value, fallback) => Number.isFinite(value) ? value : fallback;
const integer = (value, fallback, low, high) => Math.round(clamp(number(value, fallback), low, high));
const frameAt = (ctx, time) => Math.ceil(time * ctx.sampleRate);
const periodFor = (midi, wave=false) => integer(2048 - (wave ? 65536 : 131072) / (440 * 2 ** ((midi - 69) / 12)), 0, 0, 2047);
const MIDI_CHANNEL = kind => kind === 'bass' ? 2 : ['chord', 'harmony', 'interlock'].includes(kind) ? 1 : 0;
const WAVE_PRESETS = [31, 30, 35, 139];
const DEFAULTS = Object.freeze({preset:36, chipDuty:2, chipEnvelope:2, chipNoiseShift:3, chipNoiseWidth:0, chipWave:0, chipStereo:1, model:'dmg'});

// Aggregate MIDI phrasing is optional: chip percussion and other original
// voices can start while its source-melody membership index is loading.
export const prepareChipPhrasing = () => prepareLearnedPhrases();
const isLearnedLead = event => Array.isArray(event?.expression?.allowedPitches);

function screenLearnedLead(event, guard) {
 if (!isLearnedLead(event)) return event;
 const midi = guard.choose(event.midi, event.expression.allowedPitches);
 return midi === null ? null : {...event, midi};
}

function waveTable(wave, preset) {
 if ((Array.isArray(wave) || ArrayBuffer.isView(wave)) && wave.length === 32) return Array.from(wave, value => integer(value, 0, 0, 15));
 const selected = Number.isFinite(wave) ? WAVE_PRESETS[integer(wave, 0, 0, 3)] : preset;
 return (GB_INSTRUMENTS.find(item => item.preset === selected) || GB_INSTRUMENTS.find(item => item.preset === 31)).wave;
}

function envelope(expression, settings, dynamics) {
 const supplied = expression.envelope && typeof expression.envelope === 'object' ? expression.envelope : {};
 // Explicit market envelopes still obey the scored gain/mute controls.
 const strength = Math.sqrt(clamp(dynamics, 0, .24) / .12);
 const volume = integer(number(supplied.initial, 12) * strength, 0, 0, 15);
 const pace = integer(supplied.pace, number(expression.envelope, settings.chipEnvelope), 0, 7);
 const increasing = supplied.direction === 1 || expression.envelopeRise === true;
 return {volume, register:(volume << 4) | (increasing ? 8 : 0) | pace};
}

function lengthControl(seconds, maximum) {
 const ticks = Math.max(1, Math.ceil(seconds * 256));
 return ticks <= maximum ? {value:maximum - ticks, enable:0x40} : {value:0, enable:0};
}

function frequencyWrites(channel, midi, control=0) {
 const period = periodFor(midi, channel === 2);
 const low = channel === 0 ? 0xff13 : channel === 1 ? 0xff18 : 0xff1d;
 return [[low, period & 255], [low + 1, control | (period >>> 8)]];
}

export function compileGameBoyEvent(event, configured={}, sampleRate=48000) {
 if (!event || typeof event !== 'object') return null;
 if (!configured || typeof configured !== 'object') configured = {};
 const settings = {...DEFAULTS};
 for (const key of ['preset', 'chipDuty', 'chipEnvelope', 'chipNoiseShift', 'chipNoiseWidth', 'chipWave', 'chipStereo']) {
  if (Number.isFinite(configured?.[key])) settings[key] = configured[key];
 }
 const drum = event.drum || (['kick', 'tom', 'snare', 'hat', 'texture'].includes(event.kind) ? event.kind : null);
 if (drum && !['kick', 'tom', 'snare', 'hat', 'texture'].includes(drum)) return null;
 const tonalDrum = drum === 'kick' || drum === 'tom';
 const kind = drum || event.kind || 'note';
 const channel = drum ? tonalDrum ? 0 : 3 : MIDI_CHANNEL(kind);
 const noise = channel === 3;
 const midi = number(event.midi, drum ? tonalDrum ? drum === 'kick' ? 58 : 65 : 60 : NaN);
 const dynamics = number(event.gain, .06), duration = number(event.duration, drum ? .12 : .15);
 if (!Number.isFinite(midi) || dynamics <= 0 || duration <= 0 || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 384000) return null;
 const durationFrames = Math.ceil(duration * sampleRate);
 if (!Number.isSafeInteger(durationFrames) || durationFrames < 1) return null;
 const expression = {...event.parameters, ...event.expression};
 // A saved manual control overrides market automation until Reset removes
 // that explicit key. Defaults remain fallback values, never manual locks.
 for (const [setting, field] of [['chipDuty', 'duty'], ['chipNoiseShift', 'noiseShift'], ['chipNoiseWidth', 'noiseWidth'], ['chipWave', 'wave']]) {
  if (Object.hasOwn(configured, setting) && Number.isFinite(configured[setting])) expression[field] = settings[setting];
 }
 if (Object.hasOwn(configured, 'chipEnvelope') && Number.isFinite(configured.chipEnvelope)) {
  expression.envelope = {...(expression.envelope && typeof expression.envelope === 'object' ? expression.envelope : {}), pace:settings.chipEnvelope};
 }
 const envelopeValue = envelope(expression, settings, dynamics);
 if (!envelopeValue.volume) return null;
 const length = lengthControl(durationFrames / sampleRate, channel === 2 ? 256 : 64);
 const writes = [], updates = [];
 if (noise) {
  const widthValue = expression.noiseWidth ?? (drum === 'hat' ? 7 : settings.chipNoiseWidth);
  const width = widthValue === 7 || widthValue === 1 ? 1 : 0;
  const shift = integer(expression.noiseShift, drum === 'hat' ? 1 : settings.chipNoiseShift, 0, 13);
  const divider = integer(expression.noiseDivider, 0, 0, 7);
  writes.push([0xff20, length.value], [0xff21, envelopeValue.register],
   [0xff22, (shift << 4) | (width << 3) | divider], [0xff23, 0x80 | length.enable]);
 } else if (channel === 2) {
  const table = waveTable(expression.wave ?? settings.chipWave, settings.preset);
  writes.push([0xff1a, 0]);
  for (let i = 0; i < 16; i++) writes.push([0xff30 + i, (table[i * 2] << 4) | table[i * 2 + 1]]);
  const level = envelopeValue.volume <= 3 ? 3 : envelopeValue.volume <= 7 ? 2 : 1;
  writes.push([0xff1b, length.value], [0xff1c, level << 5], [0xff1a, 0x80], ...frequencyWrites(channel, midi, 0x80 | length.enable));
 } else {
  const duty = integer(expression.duty, settings.chipDuty, 0, 3);
  const volumeRegister = channel === 0 ? 0xff12 : 0xff17;
  const sweep = tonalDrum && !number(expression.slide, 0) ? integer(expression.sweep, 0x19, 0, 127) : 0;
  if (channel === 0) writes.push([0xff10, sweep]);
  writes.push([volumeRegister - 1, (duty << 6) | length.value], [volumeRegister, envelopeValue.register],
   ...frequencyWrites(channel, midi, 0x80 | length.enable));
 }
 const slide = number(expression.slide, 0);
 if (!noise && Math.abs(slide) > .001) {
  const target = midi + clamp(slide, -24, 24);
  const slideSeconds = Math.min(duration, Math.max(.004, number(expression.slideTime, Math.min(.12, duration * .7))));
  const count = Math.min(16, Math.max(1, Math.floor(slideSeconds * 128)));
  for (let i = 1; i <= count; i++) {
   const frame = Math.round(slideSeconds * sampleRate * i / count);
   if (frame >= durationFrames) break;
   updates.push({frame, writes:frequencyWrites(channel, midi + (target - midi) * i / count, length.enable)});
  }
 }
 const pan = settings.chipStereo ? number(expression.pan, 0) : 0;
 return {midi, channel, kind, category:drum ? 'drum' : 'note', durationFrames, writes, updates,
  pan:pan < -.33 ? -1 : pan > .33 ? 1 : 0};
}

// The export path uses exactly the same register compiler and APU. There is
// no sample-bank, oscillator or effect fallback when the score is empty.
export function renderGameBoyScore(events, {sampleRate=48000, seconds=20, model='dmg', settings={}}={}) {
 if (!Array.isArray(events) || events.length > 8192 || !Number.isFinite(seconds) || seconds <= 0 || seconds > 120 ||
     !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('Invalid or oversized Game Boy render');
 const frames = Math.ceil(seconds * sampleRate);
 if (frames > 24000000) throw new RangeError('Game Boy render exceeds the output limit');
 const apu = new GameBoyApu({sampleRate, model:String(model).toLowerCase()});
 apu.write(0xff26, 0x80); apu.write(0xff24, 0x77); apu.write(0xff25, 0xff);
 const queue = [], records = new Map(), owners = [null, null, null, null];
 const phrasing = createMelodyOriginalityGuard();
 // Final channel allocation precedes screening. A pair of attacks in the
 // same output sample cannot both sound; screen only the surviving attack.
 const starts = new Map();
 for (let id = 0; id < events.length; id++) {
  const event = events[id];
  if (!event || !Number.isFinite(event.at) || event.at < 0 || event.at >= seconds) continue;
  const startFrame = Math.ceil(event.at * sampleRate);
  const endFrame = Math.min(frames, Math.ceil((event.at + number(event.duration, event.drum ? .12 : .15)) * sampleRate));
  if (endFrame <= startFrame) continue;
  const adjusted = {...event, duration:(endFrame - startFrame) / sampleRate};
  const compiled = compileGameBoyEvent(adjusted, settings, sampleRate);
  if (!compiled) continue;
  const key = `${startFrame}:${compiled.channel}`;
  const candidates = starts.get(key) || [];
  candidates.push({id, event:adjusted, compiled, startFrame, endFrame});
  starts.set(key, candidates);
 }
 let order = 0;
 const groups = [...starts.values()].sort((a, b) => a[0].startFrame - b[0].startFrame || a.at(-1).id - b.at(-1).id);
 for (const candidates of groups) {
  let accepted = null;
  for (let index = candidates.length - 1; index >= 0; index--) {
   const candidate = candidates[index];
   const screened = screenLearnedLead(candidate.event, phrasing);
   if (!screened) continue;
   const compiled = screened === candidate.event ? candidate.compiled : compileGameBoyEvent(screened, settings, sampleRate);
   if (compiled) { accepted = {...candidate, compiled}; break; }
  }
  if (!accepted) continue;
  const {id, event, compiled, startFrame, endFrame} = accepted;
  if (isLearnedLead(event)) phrasing.remember(compiled.midi, startFrame / sampleRate, id);
  records.set(id, compiled);
  queue.push({id, frame:startFrame, type:'on', priority:2, writes:compiled.writes, order:order++});
  for (const update of compiled.updates) if (startFrame + update.frame < endFrame) {
   queue.push({id, frame:startFrame + update.frame, type:'update', priority:3, writes:update.writes, order:order++});
  }
  queue.push({id, frame:endFrame, type:'off', priority:0, order:order++});
 }
 queue.sort((a, b) => a.frame - b.frame || a.priority - b.priority || a.order - b.order);
 const left = new Float32Array(frames), right = new Float32Array(frames), stereo = new Float64Array(2);
 let head = 0;
 for (let frame = 0; frame < frames; frame++) {
  while (head < queue.length && queue[head].frame <= frame) {
   const command = queue[head++], record = records.get(command.id);
   if (!record) continue;
   if (command.type === 'off') {
    if (owners[record.channel] === command.id) { silenceGameBoyChannel(apu, record.channel); owners[record.channel] = null; }
    records.delete(command.id);
    continue;
   }
   if (command.type === 'on') {
    const previous = owners[record.channel];
    // The new attack immediately replaces the old owner. Do not toggle the
    // DAC or add a separate silence trigger between these register batches.
    if (previous !== null && previous !== command.id) records.delete(previous);
    owners[record.channel] = command.id;
    let routing = apu.read(0xff25) & ~((1 << record.channel) | (1 << (record.channel + 4)));
    if (record.pan <= 0) routing |= 1 << (record.channel + 4);
    if (record.pan >= 0) routing |= 1 << record.channel;
    apu.write(0xff25, routing);
   } else if (owners[record.channel] !== command.id) continue;
   for (const [address, value] of command.writes) apu.write(address, value);
  }
  apu.sample(stereo); left[frame] = stereo[0]; right[frame] = stereo[1];
 }
 return {left, right, phrasing:phrasing.snapshot()};
}

export async function createGameBoyInstrument(ctx, destination, options={}) {
 if (!ctx?.audioWorklet || typeof AudioWorkletNode === 'undefined') throw new Error('This browser does not support the Game Boy audio engine');
 void prepareChipPhrasing().catch(() => {});
 let loading = MODULES.get(ctx);
 if (!loading) {
  loading = ctx.audioWorklet.addModule(new URL('./gb-apu-worklet.js?v=468', import.meta.url));
  MODULES.set(ctx, loading);
  loading.catch(() => { if (MODULES.get(ctx) === loading) MODULES.delete(ctx); });
 }
 await loading;
 const settings = {...DEFAULTS};
 let overrides = {};
 let generation = 0, serial = 0, closed = false, failed = false, error = '', lastSnapshot = null, snapshotAt = -Infinity;
 const requestedModel = String(options.model || 'dmg').toLowerCase();
 settings.model = MODELS.has(requestedModel) ? requestedModel : 'dmg';
 const node = new AudioWorkletNode(ctx, 'upic-game-boy-apu', {
  numberOfInputs:0, numberOfOutputs:1, outputChannelCount:[2],
  processorOptions:{model:settings.model, generation},
 });
 const records = new Map();
 const phrasing = createMelodyOriginalityGuard();
 node.connect(destination);

 function send(type, payload={}) {
  if (!closed) node.port.postMessage({type, generation, ...payload});
 }

 node.port.onmessage = ({data}) => {
  if (!data || data.generation !== generation) return;
  if (data.type === 'ended' || data.type === 'rejected') {
   if (data.type === 'rejected') phrasing.cancel(data.id);
   const record = records.get(data.id);
   if (record) {
    const beforeOnset = Number.isSafeInteger(data.frame) && data.frame <= record.startFrame;
    const cancelled = data.type === 'rejected' || data.reason === 'cancelled' || (data.reason === 'stolen' && beforeOnset);
    if (cancelled && beforeOnset) phrasing.cancel(data.id);
    record.voice.cancelled ||= cancelled;
    record.voice.fading ||= cancelled;
    record.voice.ended = true;
    record.voice.end = Math.min(record.voice.end, Number.isSafeInteger(data.frame) ? data.frame / ctx.sampleRate : ctx.currentTime);
    records.delete(data.id);
   }
   if (data.type === 'rejected') error = 'APU event queue is full or the event was invalid';
  } else if (data.type === 'snapshot') lastSnapshot = data;
 };
 node.onprocessorerror = () => {
  failed = true;
  error = 'Game Boy audio processor stopped';
  for (const record of records.values()) { record.voice.fading = true; record.voice.cancelled = true; }
  records.clear();
  phrasing.reset();
 };

 function expire() {
  // Keep a short bookkeeping window for delayed worklet acknowledgements.
  // A rejected very short packet must still cancel its pending visual accent.
  for (const [id, record] of records) if (record.voice.end < ctx.currentTime - .5) records.delete(id);
 }

 function schedule(event, time) {
  const duration = number(event.duration, event.drum ? .12 : .15);
  const channel = event.drum ? ['kick', 'tom'].includes(event.drum) ? 0 : 3 : MIDI_CHANNEL(event.kind);
  if (closed || failed || ctx.state === 'closed' || !Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return null;
  expire();
  if (records.size >= MAX_RECORDS || time > ctx.currentTime + MAX_HORIZON) return null;
  const originalEnd = time + duration, startFrame = frameAt(ctx, Math.max(time, ctx.currentTime + .003));
  let endFrame = frameAt(ctx, originalEnd);
  if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrame) || endFrame <= startFrame) return null;
  // A slot contains one sound. Known later attacks limit this sound rather
  // than queuing an off that could silence the next owner.
  for (const record of records.values()) {
   if (record.channel === channel && record.startFrame > startFrame && record.startFrame < endFrame) endFrame = record.startFrame;
  }
  const start = startFrame / ctx.sampleRate, end = endFrame / ctx.sampleRate;
  const adjusted = {...event, duration:end - start};
  let compiled = compileGameBoyEvent(adjusted, overrides, ctx.sampleRate);
  if (!compiled) return null;
  // Only the last owner of a sample can sound. Remove an unsounded prior
  // lead before checking its replacement, but restore it if this one rests.
  const replaced = [...records.values()].filter(record => record.channel === channel && record.startFrame === startFrame && record.learnedMidi !== null);
  for (const record of replaced) phrasing.cancel(record.voice.id);
  const screened = screenLearnedLead(adjusted, phrasing);
  if (!screened) {
   for (const record of replaced) phrasing.remember(record.learnedMidi, record.voice.start, record.voice.id);
   return null;
  }
  if (screened !== adjusted) compiled = compileGameBoyEvent(screened, overrides, ctx.sampleRate);
  if (!compiled) {
   for (const record of replaced) phrasing.remember(record.learnedMidi, record.voice.start, record.voice.id);
   return null;
  }
  for (const record of replaced) record.learnedMidi = null;
  const {midi, kind, category, writes, pan} = compiled;
  const updates = compiled.updates.map(update => ({frame:startFrame + update.frame, writes:update.writes})).filter(update => update.frame < endFrame);
  const id = `${generation}:${++serial}`;
  const voice = {id, start, end, kind, channel, fading:false, cancelled:false, ended:false};
  for (const record of records.values()) {
   if (record.channel === channel && record.voice.start <= start && record.voice.end > start) record.voice.end = start;
  }
  const learnedMidi = isLearnedLead(event) ? midi : null;
  records.set(id, {voice, channel, startFrame, category, learnedMidi});
  if (learnedMidi !== null) phrasing.remember(midi, start, id);
  send('schedule', {event:{id, channel, startFrame, endFrame, writes, updates, category, pan}});
  return {time:start, midi, voice};
 }

 function note(midi, time=ctx.currentTime, dynamics=.06, duration=.15, kind='note', expression={}) {
  return schedule({midi, duration, gain:dynamics, kind, expression:expression || {}}, time);
 }

 function hit(event={}, time=event.time ?? ctx.currentTime) {
  const drum = event.drum || 'texture';
  if (!['kick', 'tom', 'snare', 'hat', 'texture'].includes(drum)) return null;
  return schedule({...event, drum}, time);
 }

 function cancelVoice(id, when=ctx.currentTime) {
  const record = records.get(id);
  if (!record || !Number.isFinite(when)) return;
  const frame = frameAt(ctx, Math.max(0, when));
  record.voice.end = Math.min(record.voice.end, frame / ctx.sampleRate);
  if (when <= ctx.currentTime || when <= record.voice.start) {
   if (frame <= record.startFrame || ctx.currentTime <= record.voice.start) phrasing.cancel(id);
   record.voice.fading = true;
   record.voice.cancelled = true;
   records.delete(id);
  }
  send('cancelVoice', {id, frame});
 }

 function cancelAfter(time, drumsOnly=false) {
  if (!Number.isFinite(time)) return;
  const frame = frameAt(ctx, Math.max(0, time));
  for (const [id, record] of records) {
   if (record.startFrame >= frame && (!drumsOnly || record.category === 'drum')) {
    record.voice.fading = true;
    record.voice.cancelled = true;
    record.voice.end = Math.min(record.voice.end, ctx.currentTime);
    if (record.voice.start >= ctx.currentTime) phrasing.cancel(id);
    records.delete(id);
   }
  }
  send('cancelAfter', {frame, drumsOnly});
 }

 function clear() {
  if (closed) return;
  for (const record of records.values()) { record.voice.fading = true; record.voice.cancelled = true; record.voice.end = Math.min(record.voice.end, ctx.currentTime); }
  records.clear();
  phrasing.reset();
  generation++;
  lastSnapshot = null;
  snapshotAt = -Infinity;
  if (!failed) error = '';
  send('reset', {model:settings.model});
 }

 function configure(changes={}) {
  const previousModel = settings.model;
  Object.assign(settings, DEFAULTS);
  overrides = {};
  for (const [key, maximum] of [['chipDuty', 3], ['chipEnvelope', 7], ['chipNoiseShift', 13], ['chipNoiseWidth', 1], ['chipWave', 3], ['chipStereo', 1]]) {
   if (Number.isFinite(changes[key])) overrides[key] = settings[key] = integer(changes[key], settings[key], 0, maximum);
  }
  if (Number.isFinite(changes.preset)) overrides.preset = settings.preset = changes.preset;
  const model = String(changes.model || options.model || 'dmg').toLowerCase();
  if (MODELS.has(model)) settings.model = model;
  if (settings.model !== previousModel) clear();
 }

 configure(options);
 return {
  note, hit, texture:(event={}, time=event.time ?? ctx.currentTime) => hit({...event, drum:'texture'}, time),
  cancelVoice, cancelAfter, cancelDrumsAfter:time => cancelAfter(time, true), clear, configure,
  snapshot() {
   expire();
   if (!closed && ctx.currentTime - snapshotAt >= .25) { snapshotAt = ctx.currentTime; send('snapshot'); }
   return {engine:'Game Boy APU', model:settings.model, settings:{...settings}, overrides:{...overrides}, error, pending:records.size,
    voices:[...records.values()].filter(record => !record.voice.fading && record.voice.start <= ctx.currentTime && record.voice.end > ctx.currentTime).length,
    apu:lastSnapshot?.apu ?? null, rejected:lastSnapshot?.rejected ?? 0, phrasing:phrasing.snapshot()};
  },
  close() {
   if (closed) return;
   clear();
   send('close');
   closed = true;
   node.disconnect();
   node.port.onmessage = null;
   node.onprocessorerror = null;
  },
 };
}
