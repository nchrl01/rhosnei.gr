import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,expect,it} from 'vitest';
import {compileGameBoyEvent,renderGameBoyScore} from '../public/gb-apu-instrument.js';
import {GameBoyApu} from '../public/mame-gb-apu.js';
import {silenceGameBoyChannel} from '../public/gb-apu-silence.js';
import {composeChipBar,marketChipSignal} from '../public/market-chip-score.js';
import {chipEnsembleArrangement} from '../public/chip-ensemble-arrangement.js';
import {scoreCandle} from '../public/market-replay.js';

const sampleRate=48000;
const workletSource=readFileSync(new URL('../public/gb-apu-worklet.js',import.meta.url),'utf8').replace(/^import[^\n]*;\n/gm,'');
const pulse={midi:60,kind:'chord',duration:.6,gain:.12,expression:{duty:1,envelope:{initial:10,pace:3,direction:-1},sustain:{hold:.5,steps:3}}};
const register=(compiled,address)=>compiled.writes.find(([at])=>at===address)?.[1];

// The real worklet, real command ownership and real APU run here. Only the
// browser's block clock and message port are replaced by an offline harness.
function processor(){
 const messages=[];let Processor;
 const scope={sampleRate,currentFrame:0,GameBoyApu,silenceGameBoyChannel,
  AudioWorkletProcessor:class{constructor(){this.port={postMessage:message=>messages.push(message)};}},
  registerProcessor(_name,value){Processor=value;}};
 vm.runInNewContext(workletSource,scope);
 const worklet=new Processor({processorOptions:{generation:0,model:'dmg'}});
 return {worklet,messages,
  schedule(compiled,id='a',start=0,generation=worklet.generation){
   const startFrame=Math.round(start*sampleRate);
   worklet.message({type:'schedule',generation,event:{id,channel:compiled.channel,startFrame,
    endFrame:startFrame+compiled.durationFrames,writes:compiled.writes,category:compiled.category,pan:compiled.pan,
    updates:compiled.updates.map(update=>({...update,frame:startFrame+update.frame}))}});
  },
  advance(seconds){
   const target=Math.round(seconds*sampleRate);let energy=0,count=0;
   while(scope.currentFrame<target){
    const length=Math.min(128,target-scope.currentFrame),left=new Float32Array(length),right=new Float32Array(length);
    worklet.process([],[[left,right]]);
    for(let i=0;i<length;i++)if(scope.currentFrame+i>=target-480){energy+=left[i]**2+right[i]**2;count+=2;}
    scope.currentFrame+=length;
   }
   return {state:worklet.apu.snapshot(),rms:count?Math.sqrt(energy/count):0};
  },
  message(message){worklet.message({generation:worklet.generation,...message});},
 };
}

function pulseFor(event,tempo=120){
 return compileGameBoyEvent({...event,kind:event.channel===0?'note':'chord',duration:event.duration*60/tempo},{},sampleRate);
}

describe('held notes and chip-register release',()=>{
 it.each(['note','chord'])('holds then releases %s through actual lower chip levels',kind=>{
  const compiled=compileGameBoyEvent({...pulse,kind},{},sampleRate),f=processor();
  expect(compiled.updates).toHaveLength(3);f.schedule(compiled);
  const initial=f.advance(.29);
  expect(initial.state.channels[compiled.channel].volume).toBe(10);
  expect(initial.rms).toBeGreaterThan(.01);
  for(const [at,level] of [[.31,7],[.41,5],[.51,2]]){
   const sample=f.advance(at);
   expect(sample.state.channels[compiled.channel].volume).toBe(level);
   expect(sample.state.channels[compiled.channel].enabled).toBe(true);
   expect(sample.rms).toBeGreaterThan(.001);
  }
  const ended=f.advance(.61);
  expect(ended.state.channels[compiled.channel].volume).toBe(0);
  expect(f.worklet.owners[compiled.channel]).toBeNull();
  expect(f.messages.some(message=>message.type==='ended'&&message.id==='a')).toBe(true);
 });

 it('releases a wave through NR32 levels without rewriting or retriggering its wave RAM',()=>{
  const compiled=compileGameBoyEvent({...pulse,kind:'bass',expression:{...pulse.expression,wave:1}},{},sampleRate);
  expect(compiled.updates.every(update=>update.writes.length===1&&update.writes[0][0]===0xff1c)).toBe(true);
  const f=processor();f.schedule(compiled);
  const held=f.advance(.29);expect(held.state.channels[2].outputLevel).toBe(1);
  expect(f.advance(.31).state.channels[2].outputLevel).toBe(2);
  const released=f.advance(.41);
  expect(released.state.channels[2].outputLevel).toBe(3);
  expect(released.state.waveRam).toEqual(held.state.waveRam);
  expect(released.rms).toBeGreaterThan(.001);
  expect(f.advance(.61).state.channels[2].outputLevel).toBe(0);
 });

 it('gives manual envelope and duty settings precedence over both score macros',()=>{
  const event={...pulse,expression:{...pulse.expression,dutyShift:{at:.4,duty:2}}};
  const manual=compileGameBoyEvent(event,{chipEnvelope:5,chipDuty:3},sampleRate);
  expect(register(manual,0xff17)&7).toBe(5);
  expect(register(manual,0xff16)>>>6).toBe(3);
  expect(manual.updates).toEqual([]);
  const onlyDuty=compileGameBoyEvent(event,{chipDuty:3},sampleRate);
  expect(onlyDuty.updates).toHaveLength(3);
  expect(onlyDuty.updates.flatMap(update=>update.writes).some(([address])=>address===0xff16)).toBe(false);
  const onlyEnvelope=compileGameBoyEvent(event,{chipEnvelope:5},sampleRate);
  expect(onlyEnvelope.updates).toHaveLength(1);
  expect(onlyEnvelope.updates[0].writes).toEqual([[0xff16,2<<6]]);
 });

 it('keeps combined bend, duty and release macros within the worklet update budget',()=>{
  const compiled=compileGameBoyEvent({...pulse,duration:1,expression:{...pulse.expression,slide:2,slideTime:.8,dutyShift:{at:.35,duty:2}}},{},sampleRate);
  expect(compiled.updates.length).toBeLessThanOrEqual(16);
  expect(compiled.updates.every((update,index)=>update.frame>0&&update.frame<compiled.durationFrames&&(!index||update.frame>=compiled.updates[index-1].frame))).toBe(true);
  const f=processor();f.schedule(compiled);f.advance(.9);
  expect(f.worklet.rejected).toBe(0);
  expect(f.worklet.apu.snapshot().channels[compiled.channel].volume).toBeGreaterThan(0);
 });
});

describe('release and duty commands obey current channel ownership',()=>{
 const old=()=>compileGameBoyEvent({...pulse,duration:1,expression:{...pulse.expression,dutyShift:{at:.7,duty:3}}},{},sampleRate);
 const replacement=()=>compileGameBoyEvent({midi:72,kind:'chord',duration:1,gain:.12,expression:{duty:2,envelope:{initial:9,pace:0}}},{},sampleRate);

 it('cannot apply an old release, duty shift or note-off after a channel steal',()=>{
  const f=processor(),next=replacement();f.schedule(old(),'old');f.schedule(next,'next',.2);
  const held=f.advance(.8).state.channels[1];
  expect(held.volume).toBe(9);expect(held.duty).toBe(2);
  expect(f.worklet.owners[1]).toBe('next');
  expect(f.advance(1.05).state.channels[1].volume).toBe(9);
  expect(f.messages.some(message=>message.id==='old'&&message.reason==='stolen')).toBe(true);
 });

 it('cannot revive a cancelled release tail or alter the following owner',()=>{
  const f=processor();f.schedule(old(),'old');f.advance(.1);
  f.message({type:'cancelVoice',id:'old',frame:.15*sampleRate});
  expect(f.advance(.2).state.channels[1].volume).toBe(0);
  f.schedule(replacement(),'next',.25);
  const held=f.advance(.8).state.channels[1];
  expect(held.volume).toBe(9);expect(held.duty).toBe(2);
  expect(f.worklet.owners[1]).toBe('next');
 });

 it('discards old generation tails and rejects later stale schedules after reset',()=>{
  const f=processor(),compiled=old();f.schedule(compiled,'old');f.advance(.1);
  f.message({type:'reset',generation:1});
  f.schedule(compiled,'stale',.2,0);f.schedule(replacement(),'next',.2,1);
  const held=f.advance(.8).state.channels[1];
  expect(held.volume).toBe(9);expect(held.duty).toBe(2);
  expect(f.worklet.records.has('stale')).toBe(false);
  expect(f.worklet.owners[1]).toBe('next');
 });
});

describe('score echoes retain their source voice and respect silence',()=>{
 const bar={time:0,open:100,high:100.05,low:100,close:100.05,volume:600};
 const metrics=scoreCandle([bar],{priceUsd:100,marketCap:1e6},60000,bar);
 const plans=seed=>Array.from({length:16},(_,index)=>composeChipBar(seed,index,{metrics,music:{...metrics.music,tempo:120}}));

 it.each([1,1917,987654])('compiles audible quieter replay echoes for seed %s',seed=>{
  const events=plans(seed).flatMap((plan,index)=>plan.events.map(event=>({...event,at:index*4+event.beat})));
  const echoes=events.filter(event=>event.kind==='echo');
  expect(echoes.length).toBeGreaterThan(0);
  let audible=0;
  for(const echo of echoes){
   const source=events.filter(event=>event.kind==='arp'&&event.at<echo.at).at(-1);
   expect(source).toBeTruthy();
   const sourceCompiled=pulseFor(source),compiled=pulseFor(echo);
   if(!compiled)continue; // A level-one source has no quieter chip step.
   expect(sourceCompiled).not.toBeNull();
   const sourcePlayer=processor(),echoPlayer=processor();
   sourcePlayer.schedule(sourceCompiled);echoPlayer.schedule(compiled);
   const sourceLevel=sourcePlayer.advance(.025).state.channels[1].volume,level=echoPlayer.advance(.025).state.channels[1].volume;
   expect(level).toBeGreaterThan(0);expect(level).toBeLessThan(sourceLevel);
   expect(compiled.durationFrames/sampleRate).toBeGreaterThanOrEqual(.1);
   const f=processor();f.schedule(compiled);
   const late=f.advance(.1);
   expect(late.state.channels[1].volume).toBeGreaterThan(0);expect(late.rms).toBeGreaterThan(.001);
   audible++;
  }
  expect(audible).toBeGreaterThan(0);
 });

 it('carries an echo across the inner bar boundary without clipping its tail there',()=>{
  const crossing=[];
  for(const seed of [1,2,3,5,8,13,21,34,1917,987654]){
   const events=plans(seed).flatMap((plan,index)=>plan.events.map(event=>({...event,at:index*4+event.beat})));
   for(const echo of events.filter(event=>event.kind==='echo')){
    const source=events.filter(event=>event.kind==='arp'&&event.at<echo.at).at(-1);
    if(source&&Math.floor(source.at/4)!==Math.floor(echo.at/4))crossing.push({source,echo});
   }
  }
  expect(crossing.length).toBeGreaterThan(0);
  expect(crossing.some(({echo})=>pulseFor(echo)?.durationFrames/sampleRate>=.1)).toBe(true);
 });

 it('does not make a level-one source louder merely to retain an echo',()=>{
  const source={...pulse,gain:.001,expression:{envelope:{initial:11,pace:0}}};
  expect(register(compileGameBoyEvent(source),0xff17)>>>4).toBe(1);
  expect(compileGameBoyEvent({...source,expression:{...source.expression,echoDecay:.65}})).toBeNull();
 });

 it('ends all support/tails at common rests and emits none for stale or zero-volume evidence',()=>{
  const signal=marketChipSignal({metrics});
  for(const seed of [1,1917,987654])for(const [index,plan] of plans(seed).entries())for(const event of plan.events){
   const arrangement=chipEnsembleArrangement(seed,index*4+event.beat,signal);
   expect(arrangement.rest).toBe(false);
   expect(event.duration).toBeLessThanOrEqual(arrangement.restInBeats+1e-9);
  }
  for(const quiet of [{...metrics,fresh:0},{...metrics,replay:{...metrics.replay,volume:0}}])
   for(let index=0;index<8;index++)expect(composeChipBar(1917,index,{metrics:quiet}).events).toEqual([]);
 });
});

describe('pooled MIDI phrasing still reaches the final chip driver',()=>{
 it('retains generated lead candidates and their allowed-pitch guard after new mappings',()=>{
  const metrics={observed:true,fresh:1,tradingActivity:1,activity:.8,activityKnown:true,volume:.7,volumeKnown:true,
   motion:.4,price:104,referencePrice:100,delta:4,deltaKnown:true,liquidity:1e7,marketCap:1e6,holders:1000,holdersKnown:true,music:{intensity:.8}};
  const lead=variation=>Array.from({length:8},(_,bar)=>composeChipBar(1917,bar,{metrics,phraseVariation:variation})).flatMap(plan=>plan.events.filter(event=>event.kind==='lead'));
  const first=lead(0),changed=lead(1);
  expect(first.length).toBeGreaterThan(0);expect(changed.length).toBeGreaterThan(0);
  expect(first.every(event=>Array.isArray(event.expression.allowedPitches)&&event.expression.allowedPitches.includes(event.midi))).toBe(true);
  expect(changed.map(event=>[event.beat,event.midi])).not.toEqual(first.map(event=>[event.beat,event.midi]));
 });

 it('withholds unverified learned notes, then renders them after the real index is installed',async()=>{
  const event={at:0,midi:72,kind:'note',gain:.03,duration:.2,expression:{allowedPitches:[72,74,76],sustain:{hold:.6,steps:2}}};
  const blocked=renderGameBoyScore([event],{seconds:.3,sampleRate});
  expect(blocked.phrasing.ready).toBe(false);expect(blocked.phrasing.blocked).toBe(1);
  expect(blocked.left.every(sample=>sample===0)).toBe(true);
  const {installOriginalityIndex}=await import('../public/midi-originality.js?v=455');
  await installOriginalityIndex(readFileSync(new URL('../public/midi-originality-index.bin',import.meta.url)));
  const rendered=renderGameBoyScore([event],{seconds:.3,sampleRate});
  expect(rendered.phrasing.ready).toBe(true);expect(rendered.phrasing.blocked).toBe(0);
  expect(rendered.left.some(sample=>Math.abs(sample)>.001)).toBe(true);
 });
});
