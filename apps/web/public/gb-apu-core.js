// Original sound-only reconstruction of the Game Boy APU for UPIC.
// Specification: https://gbdev.io/pandocs/Audio.html
// https://gbdev.io/pandocs/Audio_Registers.html
// https://gbdev.io/pandocs/Audio_details.html
// No ROM, game samples, or emulator implementation is included.
//
// This models the musical signal path and its persistent counters, not a CPU
// or every console revision. Register writes occur at the caller's sample
// boundary. CPU DIV writes, revision-specific envelope "zombie" behavior,
// analog DAC fade tolerances, and exact CPU/wave-RAM bus arbitration are not
// modeled. The narrow DMG RAM-access window is an explicit approximation.
// Output is normalized by four channels; register routing/volume and the
// console-style DC-removal filter are the only processing in this core.

export const GAME_BOY_CLOCK = 4194304;
const FRAME_CYCLES = 8192;
const DUTY = new Uint8Array([0x80, 0x81, 0xe1, 0x7e]);
const NOISE_DIVISORS = new Uint8Array([8, 16, 32, 48, 64, 80, 96, 112]);
const READ_MASK = new Uint8Array([
 0x80, 0x3f, 0x00, 0xff, 0xbf, 0xff, 0x3f, 0x00,
 0xff, 0xbf, 0x7f, 0xff, 0x9f, 0xff, 0xbf, 0xff,
 0xff, 0x00, 0x00, 0xbf, 0x00, 0x00, 0x70,
]);

function channel() {
 return {
  enabled:false, dac:false, length:0, lengthEnabled:false,
  frequency:0, period:8192, timer:8192, position:0,
  clocked:false, advanced:false, duty:0,
  volume:0, envelope:0, envelopeTimer:0, envelopeActive:false,
  sampleBuffer:0, outputLevel:0, accessWindow:0,
  lfsr:0, noise:0,
 };
}

function clearChannel(ch) {
 ch.enabled=false; ch.dac=false; ch.length=0; ch.lengthEnabled=false;
 ch.frequency=0; ch.period=8192; ch.timer=8192; ch.position=0;
 ch.clocked=false; ch.advanced=false; ch.duty=0;
 ch.volume=0; ch.envelope=0; ch.envelopeTimer=0; ch.envelopeActive=false;
 ch.sampleBuffer=0; ch.outputLevel=0; ch.accessWindow=0;
 ch.lfsr=0; ch.noise=0;
}

export class GameBoyApu {
 constructor({sampleRate=48000, model='dmg'}={}) {
  if (!Number.isFinite(sampleRate) || sampleRate<8000 || sampleRate>384000) {
   throw new RangeError('APU sample rate must be between 8000 and 384000 Hz');
  }
  if (model!=='dmg' && model!=='mgb' && model!=='cgb') {
   throw new RangeError('APU model must be dmg, mgb, or cgb');
  }
  this.sampleRate=sampleRate;
  this.model=model;
  this.cyclesPerSample=GAME_BOY_CLOCK/sampleRate;
  this.highPassCharge=Math.pow(model==='dmg'?.999958:.998943, this.cyclesPerSample);
  this.registers=new Uint8Array(0x17);
  this.waveRam=new Uint8Array(16);
  this.channels=[channel(), channel(), channel(), channel()];
  this.reset();
 }

 reset() {
  this.registers.fill(0);
  this.waveRam.fill(0);
  for (let i=0;i<4;i++) clearChannel(this.channels[i]);
  this.powered=false;
  this.frameTimer=FRAME_CYCLES;
  // frameStep is the NEXT frame-sequencer step, including for extra lengths.
  this.frameStep=0;
  this.sweepShadow=0; this.sweepTimer=0; this.sweepEnabled=false;
  this.sweepNegated=false;
  this.capacitorLeft=0; this.capacitorRight=0;
  this.mixLeft=0; this.mixRight=0; this.dacsEnabled=false;
  this.elapsedCycles=0;
  this.samples=0;
 }

 _power(value) {
  const on=!!(value&0x80);
  if (on===this.powered) return;
  if (!on) {
   this.registers.fill(0);
   for (let i=0;i<4;i++) {
    const ch=this.channels[i], length=ch.length;
    clearChannel(ch);
    // Monochrome length counters survive NR52 power-off and remain writable.
    if (this.model!=='cgb') ch.length=length;
   }
   this.sweepShadow=0; this.sweepTimer=0; this.sweepEnabled=false;
   this.sweepNegated=false;
  } else {
   this.frameStep=0;
   this.channels[2].sampleBuffer=0;
  }
  // The standalone divider continues while audio is powered off.
  this.powered=on;
  this._mix();
 }

 _waveAddress(address) {
  const wave=this.channels[2];
  if (!wave.enabled) return address&15;
  if (this.model!=='cgb' && wave.accessWindow<=0) return -1;
  return wave.position>>>1;
 }

 read(address) {
  address=Number(address);
  if (!Number.isInteger(address)) return 0xff;
  if (address>=0 && address<0x100) address|=0xff00;
  if (address>=0xff30 && address<=0xff3f) {
   const index=this._waveAddress(address);
   return index<0?0xff:this.waveRam[index];
  }
  if (address===0xff26) {
   let status=this.powered?0xf0:0x70;
   for (let i=0;i<4;i++) if (this.channels[i].enabled) status|=1<<i;
   return status;
  }
  if (this.model==='cgb' && (address===0xff76 || address===0xff77)) {
   const first=address===0xff76?0:2;
   return this._digital(first)|(this._digital(first+1)<<4);
  }
  const index=address-0xff10;
  return index>=0 && index<READ_MASK.length?this.registers[index]|READ_MASK[index]:0xff;
 }

 write(address, value) {
  address=Number(address);
  if (!Number.isInteger(address) || !Number.isFinite(value)) return;
  if (address>=0 && address<0x100) address|=0xff00;
  value&=0xff;
  if (address===0xff26) { this._power(value); return; }
  if (address>=0xff30 && address<=0xff3f) {
   const index=this._waveAddress(address);
   if (index>=0) this.waveRam[index]=value;
   return;
  }
  if (address<0xff10 || address>0xff25 || address===0xff15 || address===0xff1f) return;
  if (!this.powered) {
   if (this.model!=='cgb') {
    if (address===0xff11) this.channels[0].length=64-(value&63);
    else if (address===0xff16) this.channels[1].length=64-(value&63);
    else if (address===0xff1b) this.channels[2].length=256-value;
    else if (address===0xff20) this.channels[3].length=64-(value&63);
   }
   return;
  }
  const index=address-0xff10, old=this.registers[index];
  this.registers[index]=value;
  let ch;
  switch (address) {
   case 0xff10:
    if ((old&8) && !(value&8) && this.sweepNegated) this.channels[0].enabled=false;
    break;
   case 0xff11: case 0xff16:
    ch=this.channels[address===0xff11?0:1];
    ch.duty=value>>>6; ch.length=64-(value&63);
    break;
   case 0xff12: case 0xff17: case 0xff21:
    ch=this.channels[address===0xff12?0:address===0xff17?1:3];
    ch.envelope=value; ch.dac=!!(value&0xf8);
    if (!ch.dac) ch.enabled=false;
    break;
   case 0xff13: case 0xff18: case 0xff1d:
    ch=this.channels[address===0xff13?0:address===0xff18?1:2];
    ch.frequency=(ch.frequency&0x700)|value;
    ch.period=(2048-ch.frequency)*(address===0xff1d?2:4);
    // An in-flight divider finishes its old period before reloading.
    break;
   case 0xff14: case 0xff19:
    ch=this.channels[address===0xff14?0:1];
    ch.frequency=(ch.frequency&255)|((value&7)<<8);
    ch.period=(2048-ch.frequency)*4;
    this._lengthControl(ch, value);
    if (value&0x80) this._triggerPulse(ch, address===0xff14);
    break;
   case 0xff1a:
    ch=this.channels[2]; ch.dac=!!(value&0x80);
    if (!ch.dac) { ch.enabled=false; ch.accessWindow=0; }
    break;
   case 0xff1b: this.channels[2].length=256-value; break;
   case 0xff1c: this.channels[2].outputLevel=(value>>>5)&3; break;
   case 0xff1e:
    ch=this.channels[2];
    ch.frequency=(ch.frequency&255)|((value&7)<<8);
    ch.period=(2048-ch.frequency)*2;
    this._lengthControl(ch, value);
    if (value&0x80) this._triggerWave();
    break;
   case 0xff20: this.channels[3].length=64-(value&63); break;
   case 0xff22:
    ch=this.channels[3]; ch.noise=value;
    ch.period=(value>>>4)>=14?Infinity:NOISE_DIVISORS[value&7]*2**(value>>>4);
    if (!Number.isFinite(ch.period) || !Number.isFinite(ch.timer)) ch.timer=ch.period;
    break;
   case 0xff23:
    ch=this.channels[3];
    this._lengthControl(ch, value);
    if (value&0x80) this._triggerNoise();
    break;
  }
  this._mix();
 }

 _lengthControl(ch, value) {
  const enabled=!!(value&0x40);
  if (!ch.lengthEnabled && enabled && (this.frameStep&1) && ch.length>0) {
   ch.length--;
   if (ch.length===0) ch.enabled=false;
  }
  ch.lengthEnabled=enabled;
 }

 _reloadLength(ch, maximum) {
  if (ch.length!==0) return;
  ch.length=maximum;
  if (ch.lengthEnabled && (this.frameStep&1)) ch.length--;
 }

 _triggerEnvelope(ch) {
  ch.volume=ch.envelope>>>4;
  ch.envelopeTimer=(ch.envelope&7)||8;
  if (this.frameStep===7) ch.envelopeTimer++;
  ch.envelopeActive=true;
 }

 _triggerPulse(ch, sweep) {
  ch.enabled=ch.dac;
  this._reloadLength(ch, 64);
  // Retain the divider's low two clock bits and the eight-step duty position.
  ch.timer=ch.period+(ch.timer%4);
  ch.clocked=true;
  this._triggerEnvelope(ch);
  if (sweep) {
   const register=this.registers[0];
   this.sweepShadow=ch.frequency;
   this.sweepTimer=((register>>>4)&7)||8;
   this.sweepEnabled=!!(register&0x77);
   this.sweepNegated=false;
   if (register&7) this._sweepCalculation();
  }
 }

 _triggerWave() {
  const ch=this.channels[2];
  // Approximate DMG retrigger corruption only within the modeled fetch window.
  // Drivers can avoid it by disabling NR30 before editing or retriggering RAM.
  if (this.model!=='cgb' && ch.enabled && ch.accessWindow>0) {
   const index=ch.position>>>1;
   if (index<4) this.waveRam[0]=this.waveRam[index];
   else {
    const group=index&~3;
    for (let i=0;i<4;i++) this.waveRam[i]=this.waveRam[group+i];
   }
  }
  ch.enabled=ch.dac;
  this._reloadLength(ch, 256);
  ch.position=0;
  ch.timer=ch.period;
  ch.accessWindow=0;
  // The old sample buffer remains audible until the next fetch (sample #1).
 }

 _triggerNoise() {
  const ch=this.channels[3];
  ch.enabled=ch.dac;
  this._reloadLength(ch, 64);
  ch.period=(ch.noise>>>4)>=14?Infinity:NOISE_DIVISORS[ch.noise&7]*2**(ch.noise>>>4);
  ch.timer=ch.period;
  // XNOR with a zero initial state is the documented hardware convention.
  ch.lfsr=0;
  this._triggerEnvelope(ch);
 }

 _sweepCalculation() {
  const register=this.registers[0], delta=this.sweepShadow>>>(register&7);
  const subtract=!!(register&8);
  if (subtract) this.sweepNegated=true;
  const next=this.sweepShadow+(subtract?-delta:delta);
  if (next>2047) this.channels[0].enabled=false;
  return next;
 }

 _clockSweep() {
  if (this.sweepTimer>0) this.sweepTimer--;
  if (this.sweepTimer!==0) return;
  const register=this.registers[0], pace=(register>>>4)&7;
  this.sweepTimer=pace||8;
  if (!this.sweepEnabled || pace===0) return;
  const next=this._sweepCalculation();
  if (next<=2047 && (register&7)) {
   const ch=this.channels[0];
   this.sweepShadow=next; ch.frequency=next; ch.period=(2048-next)*4;
   this.registers[3]=next&255;
   this.registers[4]=(this.registers[4]&0xf8)|(next>>>8);
   this._sweepCalculation();
  }
 }

 _clockEnvelope(ch) {
  if (!ch.envelopeActive) return;
  if (ch.envelopeTimer>0) ch.envelopeTimer--;
  if (ch.envelopeTimer!==0) return;
  const pace=ch.envelope&7;
  ch.envelopeTimer=pace||8;
  if (pace===0) return;
  const next=ch.volume+((ch.envelope&8)?1:-1);
  if (next<0 || next>15) ch.envelopeActive=false;
  else ch.volume=next;
 }

 _clockFrame() {
  if (!this.powered) return;
  const step=this.frameStep;
  if ((step&1)===0) {
   for (let i=0;i<4;i++) {
    const ch=this.channels[i];
    if (ch.lengthEnabled && ch.length>0 && --ch.length===0) ch.enabled=false;
   }
  }
  if (step===2 || step===6) this._clockSweep();
  if (step===7) {
   this._clockEnvelope(this.channels[0]);
   this._clockEnvelope(this.channels[1]);
   this._clockEnvelope(this.channels[3]);
  }
  this.frameStep=(step+1)&7;
 }

 _digital(index) {
  const ch=this.channels[index];
  if (!ch.enabled) return 0;
  if (index<2) return ch.advanced && ((DUTY[ch.duty]>>>ch.position)&1)?ch.volume:0;
  if (index===2) return ch.outputLevel===0?0:ch.sampleBuffer>>>(ch.outputLevel-1);
  return (ch.lfsr&1)?ch.volume:0;
 }

 _mix() {
  let left=0, right=0, dacs=false;
  const routing=this.registers[0x15], master=this.registers[0x14];
  for (let i=0;i<4;i++) {
   if (!this.channels[i].dac) continue;
   dacs=true;
   // GB DAC polarity: digital 0 is analog +1, digital 15 is analog -1.
   const value=1-this._digital(i)*(2/15);
   if (routing&(1<<i)) right+=value;
   if (routing&(16<<i)) left+=value;
  }
  this.dacsEnabled=dacs;
  this.mixLeft=left*(((master>>>4)&7)+1)/32;
  this.mixRight=right*((master&7)+1)/32;
 }

 // Integrate each constant-output span up to the next actual chip transition.
 // Timers retain fractional remainders across output samples: 48 kHz does not
 // round the chip clock to 87 cycles/sample. Box integration reduces aliases
 // compared with point sampling; it is not a brick-wall reconstruction filter.
 // The fastest clock is CH3 at one event/2 cycles, so work is bounded by the
 // validated sample rate. No arrays, objects, or nodes are allocated here.
 sample(out) {
  const pulse1=this.channels[0], pulse2=this.channels[1];
  const wave=this.channels[2], noise=this.channels[3];
  let remaining=this.cyclesPerSample, left=0, right=0;
  while (remaining>0) {
   let span=Math.min(remaining, this.frameTimer);
   if (pulse1.clocked && pulse1.timer<span) span=pulse1.timer;
   if (pulse2.clocked && pulse2.timer<span) span=pulse2.timer;
   if (wave.enabled && wave.timer<span) span=wave.timer;
   if (noise.enabled && noise.timer<span) span=noise.timer;
   left+=this.mixLeft*span;
   right+=this.mixRight*span;
   remaining-=span;
   this.frameTimer-=span;
   if (pulse1.clocked) pulse1.timer-=span;
   if (pulse2.clocked) pulse2.timer-=span;
   if (wave.enabled) wave.timer-=span;
   if (noise.enabled) noise.timer-=span;
   if (wave.accessWindow>0) wave.accessWindow=Math.max(0, wave.accessWindow-span);

   let changed=false;
   if (pulse1.clocked && pulse1.timer<=0) {
    pulse1.timer+=pulse1.period;
    pulse1.position=(pulse1.position+1)&7; pulse1.advanced=true; changed=true;
   }
   if (pulse2.clocked && pulse2.timer<=0) {
    pulse2.timer+=pulse2.period;
    pulse2.position=(pulse2.position+1)&7; pulse2.advanced=true; changed=true;
   }
   if (wave.enabled && wave.timer<=0) {
    wave.timer+=wave.period;
    wave.position=(wave.position+1)&31;
    const packed=this.waveRam[wave.position>>>1];
    wave.sampleBuffer=(wave.position&1)?packed&15:packed>>>4;
    wave.accessWindow=2;
    changed=true;
   }
   if (noise.enabled && noise.timer<=0) {
    noise.timer+=noise.period;
    const feedback=1^((noise.lfsr^(noise.lfsr>>>1))&1);
    noise.lfsr=(noise.lfsr>>>1)|(feedback<<14);
    if (noise.noise&8) noise.lfsr=(noise.lfsr&~0x40)|(feedback<<6);
    changed=true;
   }
   if (this.frameTimer<=0) {
    this.frameTimer+=FRAME_CYCLES;
    this._clockFrame(); changed=true;
   }
   if (changed) this._mix();
  }
  this.elapsedCycles+=this.cyclesPerSample;
  this.samples++;
  if (!this.dacsEnabled) {
   out[0]=0; out[1]=0;
   return out;
  }
  const inputLeft=left/this.cyclesPerSample, inputRight=right/this.cyclesPerSample;
  const outputLeft=inputLeft-this.capacitorLeft, outputRight=inputRight-this.capacitorRight;
  this.capacitorLeft=inputLeft-outputLeft*this.highPassCharge;
  this.capacitorRight=inputRight-outputRight*this.highPassCharge;
  out[0]=outputLeft; out[1]=outputRight;
  return out;
 }

 // Diagnostics deliberately allocate; callers must keep this off the render
 // hot path. Wave bytes and registers are copies, never mutable engine state.
 snapshot() {
  return {
   model:this.model, sampleRate:this.sampleRate, clock:GAME_BOY_CLOCK,
   powered:this.powered, samples:this.samples, cycles:this.elapsedCycles,
   frameStep:this.frameStep, frameTimer:this.frameTimer,
   routing:this.registers[0x15], master:this.registers[0x14],
   sweep:{shadow:this.sweepShadow, timer:this.sweepTimer, enabled:this.sweepEnabled, negated:this.sweepNegated},
   channels:this.channels.map((ch, index)=>({
    channel:index+1, enabled:ch.enabled, dac:ch.dac,
    length:ch.length, lengthEnabled:ch.lengthEnabled,
    frequency:ch.frequency, period:ch.period, timer:ch.timer,
    position:ch.position, duty:ch.duty, volume:ch.volume,
    envelopeTimer:ch.envelopeTimer, digital:this._digital(index),
    outputLevel:ch.outputLevel, sampleBuffer:ch.sampleBuffer,
    lfsr:ch.lfsr, noise:ch.noise,
   })),
   registers:Array.from(this.registers), waveRam:Array.from(this.waveRam),
   reconstruction:'event-area-average',
  };
 }
}
