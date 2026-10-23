import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,expect,it} from 'vitest';
import {createCompositionTimeline,scoreTempo} from '../public/chip-timeline.js';
import {marketChipSignal,chipSignalActive,chipHash} from '../public/market-chip-score.js';
import {marketActivityDecay} from '../public/market-performance.js';

const source=readFileSync(new URL('../public/trade-piano.js',import.meta.url),'utf8')
 .replace(/^import[^\n]*;\n/gm,'').replace(/\bexport (?=(?:const|async function|function)\b)/g,'');

async function fixture(){
 let now=0,tick=()=>{},serial=0;
 const scheduled=[],gains=[];
 const ctx={state:'running',sampleRate:48000,get currentTime(){return now;},createGain(){
  const gain={value:0,setTargetAtTime(value){this.value=value;}};gains.push(gain);
  return {gain,connect(){},disconnect(){}};
 }};
 // Isolate the real transport from note admission and the hardware boundary.
 // Fixed sustained score events make candle clipping visible even if an
 // unrelated change makes the production composer omit a particular chord.
 const chip={
  schedule(event,time){const voice={id:String(++serial),start:time,end:time+event.duration,cancelled:false,fading:false};
   scheduled.push({event:{...event},voice});return {voice,time,midi:event.midi};},
  clear(){for(const {voice} of scheduled)if(voice.end>now){voice.end=now;voice.cancelled=true;voice.fading=true;}},
  cancelAfter(at){for(const {voice} of scheduled)if(voice.start>=at){voice.end=Math.min(voice.end,now);voice.cancelled=true;voice.fading=true;}},
  cancelVoice(id,at=now){const row=scheduled.find(({voice})=>voice.id===(id?.id??id));if(row){row.voice.end=Math.min(row.voice.end,at);if(at<=row.voice.start){row.voice.cancelled=true;row.voice.fading=true;}}},
  configure(){},snapshot(){return {voices:0};},close(){},
 };
 const score=[{kind:'chord_low',midi:60,beat:0,duration:2,gain:.02,seed:1},
  {kind:'chord_high',midi:64,beat:.025,duration:1.975,gain:.02,seed:2},
  {kind:'arp',midi:72,beat:.5,duration:.75,gain:.02,seed:3}];
 const scope={createCompositionTimeline,scoreTempo,marketChipSignal,chipSignalActive,chipHash,marketActivityDecay,
  createGameBoyRack:async()=>chip,composeChipBar:()=>({events:score,harmony:{notes:[60,64,67]},drums:{}}),
  chipEnsembleArrangement:(_seed,beat)=>({rest:false,restInBeats:32-beat%32,restEndBeat:32,roleGains:{texture:1}}),
  setInterval(callback){tick=callback;return 1;},clearInterval(){}};
 vm.runInNewContext(source+'\nglobalThis.createPiano=createTradePiano;',scope);
 const piano=await scope.createPiano(ctx,ctx.createGain());
 return {piano,scheduled,master:gains[1],step(at){now=at;tick();}};
}

function segments(inactive=new Set()){
 return Array.from({length:100},(_,i)=>({start:i*1000,end:(i+1)*1000,active:!inactive.has(i),music:{tempo:100},
  metrics:{observed:true,fresh:1,tradingActivity:inactive.has(i)?0:1,price:100+i*.001,
   activity:.5,volume:.5,motion:.1,source:'trades'}}));
}
function begin(f,rows){f.piano.setTimeline(rows);f.piano.seekTimeline(0,100);f.piano.setRunning(true);f.step(0);}

describe('chip notes across accelerated replay candles',()=>{
 it('holds both chord tones and arps across consecutive active 1s candles at 100×',async()=>{
  const f=await fixture();begin(f,segments());
  for(let ms=25;ms<=350;ms+=25)f.step(ms/1000);
  const audible=f.scheduled.filter(({voice})=>!voice.cancelled);
  const low=audible.find(({event})=>event.kind==='chord_low'),high=audible.find(({event})=>event.kind==='chord_high');
  const arp=audible.find(({event})=>event.kind==='arp');
  expect(low).toBeTruthy();expect(high).toBeTruthy();expect(arp).toBeTruthy();
  expect(low.voice.end-low.voice.start).toBeGreaterThan(.6);
  expect(high.voice.end-high.voice.start).toBeGreaterThan(.6);
  expect(arp.voice.end-arp.voice.start).toBeGreaterThan(.2);
  f.piano.close();
 });

 it('ends held notes before a silent candle even when it lies between scheduler ticks',async()=>{
  const f=await fixture();begin(f,segments(new Set([4])));
  // The silent interval is 40–50ms; scheduler ticks at 25ms and 50ms
  // never sample inside it. Frozen availability must bound held notes.
  f.step(.025);f.step(.05);
  const before=f.scheduled.filter(({voice})=>voice.start<.04&&!voice.cancelled);
  expect(before.length).toBeGreaterThan(0);
  for(const {voice} of before)expect(voice.end).toBeLessThanOrEqual(.04+1/48000);
  f.step(.075);f.step(.1);
  for(const {voice} of before)expect(voice.end).toBeLessThanOrEqual(.04+1/48000);
  f.piano.close();
 });

 it('mutes on inactive observations and cannot resurrect an earlier held chord when activity returns',async()=>{
  const f=await fixture();begin(f,segments(new Set([5,6,7,8,9,10,11])));
  f.step(.025);const earlier=f.scheduled.filter(({voice})=>voice.start<.05);
  expect(earlier.length).toBeGreaterThan(0);f.step(.05);
  expect(f.master.value).toBe(0);expect(f.piano.arrangement().active).toBe(false);
  f.step(.1);f.step(.125);f.step(.15);
  expect(f.piano.arrangement().active).toBe(true);
  for(const {voice} of earlier)expect(voice.end).toBeLessThanOrEqual(.05+1/48000);
  expect(f.scheduled.filter(({event,voice})=>event.kind.startsWith('chord_')&&voice.start>=.12&&voice.start<.15)).toEqual([]);
  f.piano.close();
 });

 it('still clears held voices on a seek while preserving sync without a seek',async()=>{
  const f=await fixture();begin(f,segments());f.step(.025);
  const old=f.scheduled.filter(({voice})=>voice.start<.025&&!voice.cancelled);
  expect(old.length).toBeGreaterThan(0);
  f.piano.syncTimeline(2500,100);
  expect(old.every(({voice})=>!voice.cancelled)).toBe(true);
  f.piano.seekTimeline(50000,100);
  expect(old.every(({voice})=>voice.cancelled&&voice.end<=.025)).toBe(true);
  f.step(.05);expect(old.every(({voice})=>voice.cancelled&&voice.end<=.025)).toBe(true);
  f.piano.close();
 });
});
