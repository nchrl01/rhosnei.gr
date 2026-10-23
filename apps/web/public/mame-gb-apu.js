// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) Anthony Kruize, Wilbert Pol. Thanks to Shay Green.
// JavaScript adaptation and output integration for UPIC, 2026.
//
// Derived from MAME's actual Game Boy sound-device state machine:
// https://github.com/mamedev/mame/blob/master/src/devices/sound/gb.cpp
// https://github.com/mamedev/mame/blob/master/src/devices/sound/gb.h
// Retrieved 2026-10-23; originals, hashes, notices and licence are retained in
// vendor/licenses/mame-gb/. This is a source-derived port, not compiled MAME.
//
// SOUND fields, count-up lengths, frequency counters, sweep, envelopes,
// wave-RAM access and register operations follow those source routines.
// MAME's device/timer/stream framework is replaced by explicit integer clocks
// and area integration between actual channel transitions. Writes are accepted
// at the caller's output-sample boundary; no CPU or DIV bus is emulated.
//
// Explicit Pan Docs corrections to upstream MAME: pulse duty phase persists
// across triggers; CH3 retains its sample buffer; noise shifts 14/15 stop;
// NR50 high bits are left volume; enabled DACs contribute even for disabled
// channels, followed by the console's DC-removal circuit. These corrections
// and output integration mean output is not bit-identical to MAME. Envelope
// zombie quirks and every hardware revision are not claimed. 'cgb' means the
// upstream CGB04 model; 'mgb' uses DMG digital logic with its analogue constant.
// https://gbdev.io/pandocs/Audio_details.html
// https://gbdev.io/pandocs/Audio_Registers.html

export const GAME_BOY_CLOCK = 4194304;
const FRAME_CYCLES = 8192, PHASE_CYCLES = FRAME_CYCLES * 8;
const DUTY = [0x80, 0x81, 0xe1, 0x7e];
const NOISE_DIVISORS = [8, 16, 32, 48, 64, 80, 96, 112];
const READ_MASK = [0x80,0x3f,0,0xff,0xbf,0xff,0x3f,0,0xff,0xbf,0x7f,0xff,0x9f,0xff,0xbf,0xff,0xff,0,0,0xbf,0,0,0x70];
const DMG_WAVE = [0xac,0xdd,0xda,0x48,0x36,0x02,0xcf,0x16,0x2c,0x04,0xe5,0x2c,0xac,0xdd,0xda,0x48];
const bit = (value, index) => (value >>> index) & 1;
function sound(channel) {
 return {reg:new Uint8Array(5),on:false,channel,length:0,length_mask:channel===3?255:63,length_counting:false,length_enabled:false,
  frequency:0,frequency_counter:0,cycles_left:0,duty:0,envelope_enabled:false,envelope_value:0,envelope_direction:0,envelope_time:0,envelope_count:0,signal:0,
  frequency_shadow:0,sweep_enabled:false,sweep_neg_mode_used:false,sweep_shift:0,sweep_direction:0,sweep_time:0,sweep_count:0,
  size:0,bank:0,level:0,offset:0,duty_count:0,current_sample:0,sample_reading:false,noise_short:false,noise_lfsr:0,clocked:false,advanced:false};
}

export class GameBoyApu {
 constructor({sampleRate=48000,model='dmg'}={}) {
  if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>384000)throw new RangeError('Invalid APU sample rate');
  if(!['dmg','mgb','cgb'].includes(model))throw new RangeError('Unsupported MAME-derived APU model');
  this.sampleRate=sampleRate;this.model=model;this.cyclesPerSample=GAME_BOY_CLOCK/sampleRate;
  this.highPassCharge=Math.pow(model==='dmg'?.999958:.998943,this.cyclesPerSample);
  this.reset();
 }
 reset() {
  this.snd=[sound(1),sound(2),sound(3),sound(4)];
  this.registers=new Uint8Array(0x30);this.waveRam=new Uint8Array(this.model==='cgb'?Array.from({length:16},(_,i)=>i%2?255:0):DMG_WAVE);
  this.control={on:false,vol_left:0,vol_right:0,chan_left:[false,false,false,false],chan_right:[false,false,false,false],cycles:0};
  this.elapsedCycles=0;this.stateCycles=0;this.samples=0;this.capacitorLeft=0;this.capacitorRight=0;this.mixLeft=0;this.mixRight=0;this.dacsEnabled=false;
  this._write(0x16,0);this._mix();
 }
 _address(address) {
  if(!Number.isInteger(address))return -1;
  if(address>=0&&address<0x100)address|=0xff00;
  return address-0xff10;
 }
 _dac(snd) {return snd.channel===3?!!(snd.reg[0]&0x80):!!(snd.reg[2]&0xf8);}
 _sync() {this._advanceTo(Math.floor(this.elapsedCycles+1e-8));}
 read(address) {
  const offset=this._address(address);this._sync();
  if(offset>=0x20&&offset<=0x2f){const snd=this.snd[2];return snd.on?(this.model==='cgb'||snd.sample_reading?this.waveRam[snd.offset>>>1]:255):this.waveRam[offset-0x20];}
  if(offset<0||offset>=READ_MASK.length)return 255;
  if(!this.control.on)return READ_MASK[offset];
  if(offset===0x16)return (this.registers[offset]&0xf0)|0x70|this.snd.reduce((mask,snd,index)=>mask|(snd.on?1<<index:0),0);
  return this.registers[offset]|READ_MASK[offset];
 }
 write(address,value) {
  const offset=this._address(address);if(offset<0||offset>=0x30||!Number.isFinite(value))return;
  this._sync();value&=255;
  if(offset>=0x20){const snd=this.snd[2];if(!snd.on)this.waveRam[offset-0x20]=value;else if(this.model==='cgb'||snd.sample_reading)this.waveRam[snd.offset>>>1]=value;return;}
  if(offset>0x16||offset===5||offset===15)return;
  if(!this.control.on&&offset!==0x16&&(this.model==='cgb'||![1,6,11,16].includes(offset)))return;
  this._write(offset,value);this._mix();
 }
 _length(snd) {
  if(snd.length_enabled){snd.length=(snd.length+1)&snd.length_mask;if(snd.length===0){snd.on=false;snd.length_counting=false;}}
 }
 _nextSweep(snd) {
  snd.sweep_neg_mode_used=snd.sweep_direction<0;
  const next=snd.frequency_shadow+snd.sweep_direction*(snd.frequency_shadow>>>snd.sweep_shift);
  if(next>0x7ff)snd.on=false;
  return next;
 }
 _applySweep(snd) {
  const next=this._nextSweep(snd);
  if(snd.on&&snd.sweep_shift>0){snd.frequency=next;snd.frequency_shadow=next;snd.reg[3]=next&255;snd.reg[4]=(snd.reg[4]&~7)|((next>>>8)&7);}
 }
 _sweep(snd) {
  snd.sweep_count=(snd.sweep_count-1)&7;
  if(snd.sweep_count===0){snd.sweep_count=snd.sweep_time;if(snd.sweep_enabled&&snd.sweep_time>0){this._applySweep(snd);this._nextSweep(snd);}}
 }
 _envelope(snd) {
  if(!snd.envelope_enabled)return;
  snd.envelope_count=(snd.envelope_count-1)&7;
  if(snd.envelope_count===0){snd.envelope_count=snd.envelope_time;if(snd.envelope_count){const next=snd.envelope_value+snd.envelope_direction;if(next>=0&&next<=15)snd.envelope_value=next;else snd.envelope_enabled=false;}}
 }
 _square(snd,cycles) {
  // Pan Docs: a triggered duty sequencer retains phase, including silent rests.
  if(!snd.clocked)return;
  snd.cycles_left+=cycles;if(snd.cycles_left<=0)return;
  cycles=Math.floor(snd.cycles_left/4);snd.cycles_left%=4;
  let distance=0x800-snd.frequency_counter;
  if(cycles>=distance){cycles-=distance;distance=0x800-snd.frequency;const count=1+Math.floor(cycles/distance);snd.duty_count=(snd.duty_count+count)&7;snd.advanced=true;snd.signal=bit(DUTY[snd.duty],snd.duty_count);snd.frequency_counter=snd.frequency+cycles%distance;}
  else snd.frequency_counter+=cycles;
 }
 _wave(snd,cycles) {
  if(!snd.on)return;
  snd.cycles_left+=cycles;
  if(this.model==='cgb'){
   if(snd.cycles_left<=0)return;
   cycles=Math.floor(snd.cycles_left/2);snd.cycles_left%=2;
   let distance=0x800-snd.frequency_counter;
   if(cycles>=distance){cycles-=distance;distance=0x800-snd.frequency;const count=1+Math.floor(cycles/distance);snd.offset=(snd.offset+count)&31;snd.current_sample=this.waveRam[snd.offset>>>1];if(!(snd.offset&1))snd.current_sample>>>=4;snd.current_sample&=15;cycles%=distance;snd.sample_reading=cycles===0;snd.frequency_counter=snd.frequency+cycles;}
   else snd.frequency_counter+=cycles;
  }else{
   while(snd.cycles_left>=2){snd.cycles_left-=2;snd.frequency_counter=(snd.frequency_counter+1)&0x7ff;snd.sample_reading=false;
    if(snd.frequency_counter===0x7ff)snd.offset=(snd.offset+1)&31;
    if(snd.frequency_counter===0){snd.sample_reading=true;snd.current_sample=this.waveRam[snd.offset>>>1];if(!(snd.offset&1))snd.current_sample>>>=4;snd.current_sample&=15;snd.frequency_counter=snd.frequency;}
   }
  }
  const level=snd.level&3;snd.signal=level?snd.current_sample>>>(level-1):0;
 }
 _noisePeriod() {const value=this.snd[3].reg[3];return (value>>>4)>=14?Infinity:NOISE_DIVISORS[value&7]*2**(value>>>4);}
 _noise(snd,cycles) {
  const period=this._noisePeriod();if(!Number.isFinite(period))return;
  snd.cycles_left+=cycles;
  while(snd.cycles_left>=period){snd.cycles_left-=period;const feedback=((snd.noise_lfsr>>>1)^snd.noise_lfsr)&1;snd.noise_lfsr=(snd.noise_lfsr>>>1)|(feedback<<14);if(snd.noise_short)snd.noise_lfsr=(snd.noise_lfsr&~64)|(feedback<<6);snd.signal=bit(~snd.noise_lfsr,0);}
 }
 _channels(cycles) {this._square(this.snd[0],cycles);this._square(this.snd[1],cycles);this._wave(this.snd[2],cycles);this._noise(this.snd[3],cycles);}
 _advanceTo(target) {
  let cycles=target-this.stateCycles;if(cycles<=0)return;
  this.stateCycles=target;
  if(this.control.on){while(cycles>0){const untilFrame=FRAME_CYCLES-this.control.cycles%FRAME_CYCLES,span=Math.min(cycles,untilFrame);this._channels(span);this.control.cycles=(this.control.cycles+span)%PHASE_CYCLES;cycles-=span;
    if(span===untilFrame){const step=Math.floor(this.control.cycles/FRAME_CYCLES);if(step===2||step===6)this._sweep(this.snd[0]);if(!(step&1))for(const snd of this.snd)this._length(snd);if(step===7){this._envelope(this.snd[0]);this._envelope(this.snd[1]);this._envelope(this.snd[3]);}}
   }}
  this._mix();
 }
 _corruptWave() {
  const snd=this.snd[2];if(this.model==='cgb')return;
  if(snd.offset<4)this.waveRam[0]=this.waveRam[snd.offset>>>1];
  else{const start=(snd.offset>>>1)&~3;for(let i=0;i<4;i++)this.waveRam[i]=this.waveRam[start+i];}
 }
 _control(snd,data) {
  const was=snd.length_enabled;snd.length_enabled=!!(data&64);
  if(!was&&!(Math.floor(this.control.cycles/FRAME_CYCLES)&1)&&snd.length_counting&&snd.length_enabled)this._length(snd);
 }
 _triggerLength(snd) {if(snd.length===0&&snd.length_enabled&&!(Math.floor(this.control.cycles/FRAME_CYCLES)&1))this._length(snd);}
 _triggerEnvelope(snd) {snd.envelope_enabled=true;snd.envelope_value=snd.reg[2]>>>4;snd.envelope_count=snd.envelope_time;}
 _write(offset,data) {
  const old=this.registers[offset],s=this.snd;
  if(this.control.on)this.registers[offset]=data;
  let snd;
  switch(offset){
   case 0:
    snd=s[0];snd.reg[0]=data;snd.sweep_shift=data&7;snd.sweep_direction=data&8?-1:1;snd.sweep_time=(data>>>4)&7;if((old&8)&&!(data&8)&&snd.sweep_neg_mode_used)snd.on=false;break;
   case 1:case 6:
    snd=s[offset===1?0:1];snd.reg[1]=data;if(this.control.on)snd.duty=data>>>6;snd.length=data&63;snd.length_counting=true;break;
   case 2:case 7:case 17:
    snd=s[offset===2?0:offset===7?1:3];snd.reg[2]=data;snd.envelope_value=data>>>4;snd.envelope_direction=data&8?1:-1;snd.envelope_time=data&7;if(!this._dac(snd))snd.on=false;break;
   case 3:case 8:
    snd=s[offset===3?0:1];snd.reg[3]=data;if(offset===8||!snd.sweep_enabled)snd.frequency=((snd.reg[4]&7)<<8)|snd.reg[3];break;
   case 4:case 9:
    snd=s[offset===4?0:1];snd.reg[4]=data;
    if(offset===4)snd.frequency=((this.registers[4]&7)<<8)|snd.reg[3];
    this._control(snd,data);
    if(data&128){snd.on=true;this._triggerEnvelope(snd);snd.length_counting=true;snd.frequency=((snd.reg[4]&7)<<8)|snd.reg[3];snd.frequency_counter=snd.frequency;snd.cycles_left=((snd.cycles_left%4)+4)%4;snd.clocked=true;
     // Explicit correction: preserve duty position instead of MAME's reset.
     snd.signal=snd.advanced?bit(DUTY[snd.duty],snd.duty_count):0;
     if(offset===4){snd.sweep_count=snd.sweep_time;snd.sweep_neg_mode_used=false;snd.frequency_shadow=snd.frequency;snd.sweep_enabled=snd.sweep_shift!==0||snd.sweep_time!==0;}
     if(!this._dac(snd))snd.on=false;if(offset===4&&snd.sweep_shift>0)this._nextSweep(snd);this._triggerLength(snd);
    }else if(offset===9||!snd.sweep_enabled)snd.frequency=((snd.reg[4]&7)<<8)|snd.reg[3];break;
   case 10:s[2].reg[0]=data;s[2].size=bit(data,5);s[2].bank=bit(data,6);if(!this._dac(s[2]))s[2].on=false;break;
   case 11:s[2].reg[1]=data;s[2].length=data;s[2].length_counting=true;break;
   case 12:s[2].reg[2]=data;s[2].level=(data>>>5)&7;break;
   case 13:s[2].reg[3]=data;s[2].frequency=((s[2].reg[4]&7)<<8)|data;break;
   case 14:
    snd=s[2];snd.reg[4]=data;this._control(snd,data);
    if(data&128){if(snd.on&&snd.frequency_counter===0x7ff)this._corruptWave();snd.on=true;snd.offset=0;snd.duty=1;snd.duty_count=0;snd.length_counting=true;snd.frequency=((snd.reg[4]&7)<<8)|snd.reg[3];snd.frequency_counter=snd.frequency;snd.cycles_left=-6;snd.sample_reading=false;
     // Explicit correction: retain current_sample across a CH3 retrigger.
     if(!this._dac(snd))snd.on=false;this._triggerLength(snd);
    }else snd.frequency=((snd.reg[4]&7)<<8)|snd.reg[3];break;
   case 16:s[3].reg[1]=data;s[3].length=data&63;s[3].length_counting=true;break;
   case 18:s[3].reg[3]=data;s[3].noise_short=!!(data&8);break;
   case 19:
    snd=s[3];snd.reg[4]=data;this._control(snd,data);
    if(data&128){snd.on=true;this._triggerEnvelope(snd);snd.frequency_counter=0;snd.cycles_left=Number.isFinite(this._noisePeriod())?this._noisePeriod():0;snd.signal=0;snd.noise_lfsr=0x7fff;snd.length_counting=true;if(!this._dac(snd))snd.on=false;this._triggerLength(snd);}break;
   case 20:this.control.vol_left=(data>>>4)&7;this.control.vol_right=data&7;break;
   case 21:for(let i=0;i<4;i++){this.control.chan_right[i]=!!bit(data,i);this.control.chan_left[i]=!!bit(data,i+4);}break;
   case 22:
    if(!(data&128))this._powerOff();else if(!this.control.on)this.control.cycles=(this.control.cycles%FRAME_CYCLES)+7*FRAME_CYCLES;
    this.control.on=!!(data&128);this.registers[22]=data&128;break;
  }
 }
 _powerOff() {
  const s=this.snd,cgb=this.model==='cgb';
  this._write(0,0);s[0].duty=0;if(cgb)this._write(1,0);else this.registers[1]=0;
  for(const r of [2,3,4])this._write(r,0);if(!cgb)s[0].frequency_shadow=0;s[0].length_counting=false;s[0].sweep_neg_mode_used=false;
  if(cgb)this._write(6,0);else this.registers[6]=0;for(const r of [7,8,9])this._write(r,0);s[1].length_counting=false;
  this._write(10,0);if(cgb)this._write(11,0);for(const r of [12,13,14])this._write(r,0);s[2].length_counting=false;s[2].current_sample=0;
  if(cgb)this._write(16,0);else this.registers[16]=0;for(const r of [17,18,19])this._write(r,0);s[3].length_counting=false;s[3].cycles_left=this._noisePeriod();
  for(const snd of s){snd.on=false;snd.clocked=false;snd.advanced=false;snd.duty_count=0;}
  this._write(20,0);this._write(21,0);
 }
 _digital(snd) {if(!snd.on)return 0;if(snd.channel===3){const level=snd.level&3;return level?snd.current_sample>>>(level-1):0;}return snd.signal*snd.envelope_value;}
 _mix() {
  let left=0,right=0,dacs=false;
  for(let i=0;i<4;i++){const snd=this.snd[i];if(!this._dac(snd))continue;dacs=true;const value=15-this._digital(snd)*2;if(this.control.chan_left[i])left+=value;if(this.control.chan_right[i])right+=value;}
  this.mixLeft=left*(1+this.control.vol_left)/480;this.mixRight=right*(1+this.control.vol_right)/480;this.dacsEnabled=dacs;
 }
 _nextTransition() {
  // MAME's 64-clock timer is an upper bound, not a point-sampling frequency:
  // integrate the shorter oscillator/LFSR edges too, avoiding high-noise alias.
  let cycles=64;if(!this.control.on)return cycles;
  cycles=Math.min(cycles,FRAME_CYCLES-this.control.cycles%FRAME_CYCLES);
  for(let i=0;i<2;i++){const snd=this.snd[i];if(snd.clocked)cycles=Math.min(cycles,(0x800-snd.frequency_counter)*4-snd.cycles_left);}
  const wave=this.snd[2];if(wave.on){
   // DMG offsets advance one counter step before the actual RAM read.
   const steps=this.model==='cgb'?0x800-wave.frequency_counter:wave.frequency_counter<0x7ff?0x7ff-wave.frequency_counter:1;
   cycles=Math.min(cycles,steps*2-wave.cycles_left);
   if(wave.sample_reading)cycles=Math.min(cycles,2-wave.cycles_left);
  }
  const noise=this.snd[3],period=this._noisePeriod();if(Number.isFinite(period))cycles=Math.min(cycles,period-noise.cycles_left);
  return Math.max(1,Math.ceil(cycles));
 }
 sample(out) {
  let remaining=this.cyclesPerSample,left=0,right=0;
  while(remaining>1e-9){const next=this.stateCycles+this._nextTransition(),until=next-this.elapsedCycles;
   if(until<=1e-8){this._advanceTo(next);continue;}
   const span=Math.min(remaining,until);left+=this.mixLeft*span;right+=this.mixRight*span;this.elapsedCycles+=span;remaining-=span;
   if(span===until){this.elapsedCycles=next;this._advanceTo(next);}
  }
  this.samples++;
  if(!this.dacsEnabled){out[0]=out[1]=0;return out;}
  const inputLeft=left/this.cyclesPerSample,inputRight=right/this.cyclesPerSample;
  out[0]=inputLeft-this.capacitorLeft;out[1]=inputRight-this.capacitorRight;
  this.capacitorLeft=inputLeft-out[0]*this.highPassCharge;this.capacitorRight=inputRight-out[1]*this.highPassCharge;
  return out;
 }
 snapshot() {
  this._sync();
  return {engine:'MAME-derived Game Boy APU',model:this.model,upstreamModel:this.model==='cgb'?'CGB04':'DMG',sampleRate:this.sampleRate,clock:GAME_BOY_CLOCK,powered:this.control.on,samples:this.samples,cycles:this.elapsedCycles,
   frameStep:(Math.floor(this.control.cycles/FRAME_CYCLES)+1)&7,frameTimer:FRAME_CYCLES-this.control.cycles%FRAME_CYCLES,routing:this.registers[21],master:this.registers[20],
   sweep:{shadow:this.snd[0].frequency_shadow,timer:this.snd[0].sweep_count,enabled:this.snd[0].sweep_enabled,negated:this.snd[0].sweep_neg_mode_used},
   channels:this.snd.map(snd=>({channel:snd.channel,enabled:snd.on,dac:this._dac(snd),length:snd.length_counting?snd.length_mask+1-snd.length:0,lengthEnabled:snd.length_enabled,frequency:snd.frequency,frequencyCounter:snd.frequency_counter,period:snd.channel===4?this._noisePeriod():(2048-snd.frequency)*(snd.channel===3?2:4),timer:snd.cycles_left,position:snd.channel===3?snd.offset:snd.duty_count,duty:snd.duty,volume:snd.envelope_value,envelopeTimer:snd.envelope_count,digital:this._digital(snd),outputLevel:snd.level,sampleBuffer:snd.current_sample,lfsr:snd.noise_lfsr,noise:snd.reg[3]})),
   registers:Array.from(this.registers.slice(0,23)),waveRam:Array.from(this.waveRam),reconstruction:'event-area-average',provenance:'MAME BSD-3-Clause gb.cpp / gb.h with documented Pan Docs corrections'};
 }
}
