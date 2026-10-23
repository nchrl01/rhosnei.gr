import {GameBoyApu} from './mame-gb-apu.js?v=468';
import {silenceGameBoyChannel} from './gb-apu-silence.js?v=468';

// The worklet only executes accepted score events. It makes no compositional
// choices and mixes no sound sources outside the four-channel APU.
const MAX_COMMANDS = 4096;
const MAX_RECORDS = 512;
const MAX_WRITES = 32;
const MAX_UPDATES = 16;
const MODELS = new Set(['dmg', 'mgb', 'cgb']);

function writesValid(writes) {
 return Array.isArray(writes) && writes.length <= MAX_WRITES && writes.every(pair =>
  Array.isArray(pair) && pair.length === 2 && Number.isInteger(pair[0]) &&
  pair[0] >= 0xff10 && pair[0] <= 0xff3f && Number.isInteger(pair[1]) && pair[1] >= 0 && pair[1] <= 255);
}

class UpicGameBoyProcessor extends AudioWorkletProcessor {
 constructor(options) {
  super();
  const settings = options.processorOptions || {};
  this.model = MODELS.has(settings.model) ? settings.model : 'dmg';
  this.generation = Number.isSafeInteger(settings.generation) ? settings.generation : 0;
  this.apu = new GameBoyApu({sampleRate, model:this.model});
  this.queue = [];
  this.head = 0;
  this.records = new Map();
  this.owners = [null, null, null, null];
  this.stereo = new Float64Array(2);
  this.serial = 0;
  this.rejected = 0;
  this.destroyed = false;
  this.power();
  this.port.onmessage = ({data}) => this.message(data);
 }

 power() {
  this.apu.write(0xff26, 0x80);
  this.apu.write(0xff24, 0x77);
  this.apu.write(0xff25, 0xff);
 }

 reply(type, extra={}) {
  this.port.postMessage({type, generation:this.generation, ...extra});
 }

 compact() {
  this.queue = this.queue.slice(this.head).filter(command => this.records.has(command.id));
  this.head = 0;
 }

 enqueue(command) {
  command.order = this.serial++;
  this.queue.push(command);
 }

 sort() {
  this.queue.sort((a, b) => a.frame - b.frame || a.priority - b.priority || a.order - b.order);
 }

 reject(id) {
  this.rejected++;
  this.reply('rejected', {id});
 }

 schedule(event) {
  if (!event || typeof event.id !== 'string' || event.id.length > 80 || this.records.has(event.id) ||
      !Number.isInteger(event.channel) || event.channel < 0 || event.channel > 3 ||
      !Number.isSafeInteger(event.startFrame) || !Number.isSafeInteger(event.endFrame) ||
      event.startFrame < 0 || event.endFrame <= event.startFrame || event.endFrame <= currentFrame ||
      !writesValid(event.writes) || !Array.isArray(event.updates) || event.updates.length > MAX_UPDATES ||
      !event.updates.every(update => Number.isSafeInteger(update.frame) && update.frame >= event.startFrame &&
       update.frame < event.endFrame && writesValid(update.writes))) {
   this.reject(event?.id);
   return;
  }
  this.compact();
  if (this.records.size >= MAX_RECORDS || this.queue.length + event.updates.length + 2 > MAX_COMMANDS) {
   this.reject(event.id);
   return;
  }
  const record = {
   id:event.id, channel:event.channel, startFrame:event.startFrame, endFrame:event.endFrame,
   category:event.category === 'drum' ? 'drum' : 'note', pan:event.pan === -1 ? -1 : event.pan === 1 ? 1 : 0,
  };
  this.records.set(event.id, record);
  this.enqueue({frame:event.startFrame, id:event.id, type:'on', priority:2, writes:event.writes});
  for (const update of event.updates) {
   this.enqueue({frame:update.frame, id:event.id, type:'update', priority:3, writes:update.writes});
  }
  this.enqueue({frame:event.endFrame, id:event.id, type:'off', priority:0});
  this.sort();
 }

 release(id, reason='ended', frame=currentFrame) {
  const record = this.records.get(id);
  if (!record) return;
  if (this.owners[record.channel] === id) {
   // A stolen slot is immediately reprogrammed by the new attack. Ordinary
   // rests/cancellations use the same DAC-on silence policy as offline export.
   if (reason !== 'stolen') silenceGameBoyChannel(this.apu, record.channel);
   this.owners[record.channel] = null;
  }
  this.records.delete(id);
  this.reply('ended', {id, reason, frame});
 }

 cancelAfter(frame, drumsOnly) {
  if (!Number.isSafeInteger(frame)) return;
  for (const record of this.records.values()) {
   if (record.startFrame >= frame && (!drumsOnly || record.category === 'drum')) this.release(record.id, 'cancelled');
  }
  this.compact();
 }

 message(message) {
  if (!message || this.destroyed) return;
  if (message.type === 'reset') {
   if (!Number.isSafeInteger(message.generation) || message.generation <= this.generation) return;
   this.generation = message.generation;
   this.queue.length = 0;
   this.head = 0;
   this.records.clear();
   this.owners.fill(null);
   if (MODELS.has(message.model)) this.model = message.model;
   this.apu = new GameBoyApu({sampleRate, model:this.model});
   this.power();
   return;
  }
  if (message.generation !== this.generation) return;
  if (message.type === 'schedule') this.schedule(message.event);
  else if (message.type === 'cancelAfter') this.cancelAfter(message.frame, !!message.drumsOnly);
  else if (message.type === 'cancelVoice') {
   const record = this.records.get(message.id);
   if (!record || !Number.isSafeInteger(message.frame)) return;
   if (message.frame <= currentFrame || message.frame <= record.startFrame) {
    this.release(record.id, 'cancelled');
    this.compact();
   } else if (message.frame < record.endFrame) {
    this.compact();
    if (this.queue.length >= MAX_COMMANDS) { this.release(record.id, 'cancelled'); return; }
    this.enqueue({frame:message.frame, id:record.id, type:'off', priority:0, cancelled:true});
    this.sort();
   }
  } else if (message.type === 'snapshot') {
   this.reply('snapshot', {apu:this.apu.snapshot(), pending:this.records.size, rejected:this.rejected});
  } else if (message.type === 'close') {
   this.queue.length = 0;
   this.records.clear();
   this.apu.reset();
   this.destroyed = true;
  }
 }

 command(command, frame) {
  const record = this.records.get(command.id);
  if (!record) return;
  if (command.type === 'off') { this.release(command.id, command.cancelled ? 'cancelled' : 'ended', frame); return; }
  if (command.type === 'on') {
   // A previous note-off may still be queued after a channel is stolen.
   // Its owner ID cannot silence this new attack.
   const previous = this.owners[record.channel];
   if (previous && previous !== record.id) this.release(previous, 'stolen', frame);
   this.owners[record.channel] = record.id;
   let routing = this.apu.read(0xff25);
   routing &= ~((1 << record.channel) | (1 << (record.channel + 4)));
   if (record.pan <= 0) routing |= 1 << (record.channel + 4);
   if (record.pan >= 0) routing |= 1 << record.channel;
   this.apu.write(0xff25, routing);
  } else if (this.owners[record.channel] !== record.id) return;
  for (const [address, value] of command.writes) this.apu.write(address, value);
 }

 process(inputs, outputs) {
  const channels = outputs[0];
  if (!channels?.length || this.destroyed) return !this.destroyed;
  const left = channels[0], right = channels[1];
  for (let i = 0; i < left.length; i++) {
   const frame = currentFrame + i;
   while (this.head < this.queue.length && this.queue[this.head].frame <= frame) this.command(this.queue[this.head++], frame);
   this.apu.sample(this.stereo);
   left[i] = this.stereo[0];
   if (right) right[i] = this.stereo[1];
  }
  if (this.head === this.queue.length) { this.queue.length = 0; this.head = 0; }
  return true;
 }
}

registerProcessor('upic-game-boy-apu', UpicGameBoyProcessor);
