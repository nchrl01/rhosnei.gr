import {
 createGameBoyInstrument, renderGameBoyScore,
 prepareChipPhrasing as prepareDriverPhrasing,
} from './gb-apu-instrument.js?v=478';

// Two independent Game Boy APUs. Extra harmony voices come from another
// hardware model, with fixed mixing headroom and no added synth or effects.
export const GAME_BOY_RACK_GAIN = .55;
export const prepareChipPhrasing = () => prepareDriverPhrasing();
const DRUMS = new Set(['kick', 'tom', 'snare', 'hat', 'texture']);
const ROLES = Object.freeze({
 note:[0, 0], lead:[0, 0], arp:[0, 1], arpeggio:[0, 1], echo:[0, 1], bass:[0, 2],
 chord_low:[1, 0], chord_high:[1, 1], chord:[1, 1], harmony:[1, 1],
 interlock:[1, 1], drone:[1, 2],
});
const CHIP_NAMES = ['Foreground', 'Harmony'];
const CHANNEL_ROLES = [
 ['Lead / kick / tom', 'Arpeggio / echo', 'Bass', 'Drums'],
 ['Chord low', 'Chord high', 'Drone', 'Texture / grain'],
];
const index = (value, maximum) => Number.isInteger(value) && value >= 0 && value <= maximum ? value : null;

function routeEvent(event) {
 if (!event || typeof event !== 'object') return null;
 const expression = {...event.parameters, ...event.expression};
 const role = String(event.role || event.kind || 'note');
 const drum = event.drum || (DRUMS.has(role) ? role : role === 'drum' ? 'texture' : null);
 if (drum && !DRUMS.has(drum)) return null;
 const fallback = drum ? [drum === 'texture' ? 1 : 0, drum === 'kick' || drum === 'tom' ? 0 : 3] : ROLES[role] || ROLES.note;
 const chip = index(event.chip, 1) ?? index(expression.chip, 1) ?? fallback[0];
 const channel = index(event.channel, 3) ?? index(expression.channel, 3) ?? fallback[1];
 const routed = {...event, expression, chip, channel};
 if (channel === 3) {
  routed.drum = drum === 'snare' || drum === 'hat' ? drum : 'texture';
  routed.kind = routed.drum;
 } else if (channel === 0 && (drum === 'kick' || drum === 'tom')) {
  routed.drum = drum;
  routed.kind = drum;
 } else {
  delete routed.drum;
  routed.kind = channel === 0 ? 'note' : channel === 1 ? 'chord' : 'bass';
  if (drum && !Number.isFinite(routed.midi)) routed.midi = drum === 'kick' ? 58 : drum === 'tom' ? 65 : 60;
 }
 return routed;
}

function aggregatePhrasing(states) {
 const available = states.filter(Boolean);
 const first = available[0] || {};
 const errors = [...new Set(available.map(state => state.error).filter(Boolean))];
 const ready = available.length === 2 && available.every(state => state.ready);
 return {...first, ready,
  state:ready ? 'ready' : errors.length ? 'error' : available.some(state => state.state === 'loading') ? 'loading' : first.state || 'idle',
  error:errors.join('; ') || null,
  blocked:available.reduce((sum, state) => sum + (state.blocked || 0), 0),
  revoiced:available.reduce((sum, state) => sum + (state.revoiced || 0), 0),
  chips:states,
 };
}

export async function createGameBoyRack(ctx, destination, options={}) {
 const buses = [ctx.createGain(), ctx.createGain()];
 for (const bus of buses) { bus.gain.value = GAME_BOY_RACK_GAIN; bus.connect(destination); }
 const results = await Promise.allSettled(buses.map(bus => createGameBoyInstrument(ctx, bus, options)));
 const failed = results.find(result => result.status === 'rejected');
 if (failed) {
  for (const result of results) if (result.status === 'fulfilled') result.value.close();
  for (const bus of buses) bus.disconnect();
  throw failed.reason;
 }
 const chips = results.map(result => result.value);
 const publicVoices = new WeakMap();
 let closed = false;

 function expose(result, chip, role) {
  if (!result) return null;
  let voice = publicVoices.get(result.voice);
  if (!voice) {
   // Keep every live cancellation/ended flag on the driver's own object.
   // Only the public ID is namespaced, because each APU owns its own IDs.
   voice = new Proxy(result.voice, {
    get(target, key, receiver) {
     if (key === 'id') return `gb${chip}/${target.id}`;
     if (key === 'chip') return chip;
     if (key === 'role') return role;
     return Reflect.get(target, key, receiver);
    },
    set(target, key, value) {
     if (key === 'id' || key === 'chip' || key === 'role') return false;
     return Reflect.set(target, key, value);
    },
   });
   publicVoices.set(result.voice, voice);
  }
  return {...result, voice, chip};
 }

 function schedule(event={}, time=event?.time ?? event?.at ?? ctx.currentTime) {
  if (closed) return null;
  const routed = routeEvent(event);
  if (!routed) return null;
  const driver = chips[routed.chip];
  const result = routed.drum ? driver.hit(routed, time)
   : driver.note(routed.midi, time, routed.gain, routed.duration, routed.kind, routed.expression);
  return expose(result, routed.chip, event.role || event.kind || routed.kind);
 }

 function note(midi, time=ctx.currentTime, dynamics=.06, duration=.15, kind='note', expression={}) {
  return schedule({midi, gain:dynamics, duration, kind, expression:expression || {}}, time);
 }

 function hit(event={}, time=event?.time ?? ctx.currentTime) {
  return schedule({...event, drum:event?.drum || 'texture'}, time);
 }

 function cancelVoice(voiceOrId, when=ctx.currentTime) {
  if (closed) return;
  const id = typeof voiceOrId === 'object' ? voiceOrId?.id : voiceOrId;
  const match = typeof id === 'string' ? /^gb([01])\/(.+)$/.exec(id) : null;
  if (match) chips[Number(match[1])].cancelVoice(match[2], when);
 }

 return {
  note, hit, schedule,
  texture:(event={}, time=event?.time ?? ctx.currentTime) => hit({...event, drum:'texture'}, time),
  cancelVoice,
  configure(changes={}) { if (!closed) for (const chip of chips) chip.configure(changes); },
  cancelAfter(time, drumsOnly=false) { if (!closed) for (const chip of chips) chip.cancelAfter(time, drumsOnly); },
  cancelDrumsAfter(time) { if (!closed) for (const chip of chips) chip.cancelDrumsAfter(time); },
  clear() { if (!closed) for (const chip of chips) chip.clear(); },
  snapshot() {
   const states = chips.map((chip, id) => ({...chip.snapshot(), id, name:CHIP_NAMES[id], channelRoles:[...CHANNEL_ROLES[id]]}));
   const primary = states[0];
   return {...primary, engine:'Game Boy chip rack', chipCount:2, channelCount:8, outputGain:GAME_BOY_RACK_GAIN,
    error:[...new Set(states.map(state => state.error).filter(Boolean))].join('; '),
    voices:states.reduce((sum, state) => sum + state.voices, 0),
    pending:states.reduce((sum, state) => sum + state.pending, 0),
    rejected:states.reduce((sum, state) => sum + state.rejected, 0),
    apu:primary.apu, apu0:primary.apu, apu1:states[1].apu,
    chips:states, phrasing:aggregatePhrasing(states.map(state => state.phrasing)),
   };
  },
  close() {
   if (closed) return;
   closed = true;
   for (const chip of chips) chip.close();
   for (const bus of buses) bus.disconnect();
  },
 };
}

export function renderGameBoyRack(events, options={}) {
 if (!Array.isArray(events) || events.length > 8192) throw new RangeError('Invalid or oversized Game Boy rack render');
 const scores = [[], []];
 for (const event of events) {
  const routed = routeEvent(event);
  if (routed) scores[routed.chip].push(routed);
 }
 const rendered = scores.map(score => renderGameBoyScore(score, options));
 const {left, right} = rendered[0];
 for (let frame = 0; frame < left.length; frame++) {
  left[frame] = (left[frame] + rendered[1].left[frame]) * GAME_BOY_RACK_GAIN;
  right[frame] = (right[frame] + rendered[1].right[frame]) * GAME_BOY_RACK_GAIN;
 }
 return {left, right, chipCount:2, channelCount:8, outputGain:GAME_BOY_RACK_GAIN,
  phrasing:aggregatePhrasing(rendered.map(chip => chip.phrasing)),
 };
}
