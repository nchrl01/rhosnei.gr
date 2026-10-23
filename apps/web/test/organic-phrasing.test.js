import {afterEach,describe,expect,it,vi} from 'vitest';
import {phraseArrangement,noteExpression} from '../public/phrase-arrangement.js';
import {composeMarketBar,createCompositionTimeline} from '../public/market-composition.js';
import {arpRhythm} from '../public/arp-rhythm.js';
import {pianoHarmony} from '../public/music-context.js';
import {EARTHBOUND_PRESETS} from '../public/earthbound-instruments.js';
import {GB_INSTRUMENTS} from '../public/gameboy-instruments.js';
import {renderGameBoySample} from '../../../scripts/render-gameboy.mjs';

const seed=1917;
const context={active:true,cap:100000,music:{tempo:100,intensity:.7,activity:.8,group:'up',character:'serene'}};
const segments=[{...context,start:0,end:600000},{...context,start:600000,end:1200000,music:{...context.music,tempo:140}}];

describe('organic score phrasing',()=>{
 it('reconstructs the same score and expression after visiting other bars or seeking',()=>{
  const expected=composeMarketBar(seed,11,context);
  for(const bar of [0,30,7,4,11])composeMarketBar(seed,bar,{...context,cap:1e8});
  expect(composeMarketBar(seed,11,context)).toEqual(expected);
  expect(composeMarketBar(seed+1,11,context)).not.toEqual(expected);
  expect(noteExpression(seed,11,3,'chord')).toEqual(noteExpression(seed,11,3,'chord'));
 });

 it('staggers chord tones modestly without changing harmony or arpeggio swing',()=>{
  const score=composeMarketBar(seed,0,{...context,phraseLearning:0});
  const chord=score.events.filter(event=>event.kind==='chord');
  expect(chord).toHaveLength(score.harmony.notes.length);
  expect([...chord.map(event=>event.midi)].sort((a,b)=>a-b)).toEqual([...score.harmony.notes].sort((a,b)=>a-b));
  for(let i=1;i<chord.length;i++){
   const seconds=(chord[i].beat-chord[i-1].beat)*60/context.music.tempo;
   expect(seconds).toBeGreaterThanOrEqual(.009);
   expect(seconds).toBeLessThanOrEqual(.017);
  }
  expect(score.harmony).toEqual(pianoHarmony(seed,{chordStep:-(seed%4)},context.music));
  expect(score.events.filter(event=>event.kind==='arp').map(event=>event.beat)).toEqual(arpRhythm(seed,0,context.music,context.cap).events.map(event=>event.beat));
 });

 it('keeps pitch direction and the market-cap groove selection',()=>{
  for(const cap of [100000,1e8]){
   const up=composeMarketBar(seed,0,{...context,cap,phraseLearning:0});
   const down=composeMarketBar(seed,0,{...context,cap,phraseLearning:0,music:{...context.music,group:'down'}});
   const notes=score=>score.events.filter(event=>event.kind==='arp').map(event=>event.midi);
   expect(notes(up)[0]).toBeLessThan(notes(up).at(-1));
   expect(notes(down)[0]).toBeGreaterThan(notes(down).at(-1));
   expect(up.groove).toBe(arpRhythm(seed,0,context.music,cap).name);
  }
  expect(composeMarketBar(seed,0,context).events.filter(event=>event.kind==='bass')).toHaveLength(2);
  expect(composeMarketBar(seed,0,{...context,cap:1e8}).events.filter(event=>event.kind==='bass')).toHaveLength(6);
 });

 it('varies articulation and phrase dynamics without raising note peak gains',()=>{
  const expressions=Array.from({length:16},(_,index)=>noteExpression(seed,2,index,'arp'));
  for(const field of ['gain','duration','attack','decay','sustain','release'])expect(new Set(expressions.map(item=>item[field])).size).toBeGreaterThan(8);
  const gains=[];
  for(let beat=0;beat<64;beat+=.25){
   const state=phraseArrangement(seed,beat);gains.push(state.phraseGain);
   for(const gain of Object.values(state.layers)){expect(gain).toBeGreaterThanOrEqual(0);expect(gain).toBeLessThanOrEqual(1);}
  }
  expect(Math.max(...gains)-Math.min(...gains.filter(value=>value>0))).toBeGreaterThan(.3);
  for(let bar=0;bar<16;bar++)for(const event of composeMarketBar(seed,bar,context).events){
   expect(event.gain).toBeGreaterThan(0);
   expect(event.gain).toBeLessThanOrEqual({chord:.038,arp:.06,bass:.085}[event.kind]);
  }
 });

 it.each([1,1917,987654])('leaves shared rests long enough for the host control tick, seed %s',coinSeed=>{
  for(let phrase=0;phrase<4;phrase++){
   const middle=phraseArrangement(coinSeed,phrase*32+12),end=phraseArrangement(coinSeed,phrase*32+28);
   expect(middle.restEndBeat-middle.restStartBeat).toBeGreaterThanOrEqual(.65);
   expect(end.restEndBeat-end.restStartBeat).toBeGreaterThanOrEqual(1);
   expect((middle.restEndBeat-middle.restStartBeat)*60/200).toBeGreaterThan(.15);
   for(const state of [middle,end]){
    expect(phraseArrangement(coinSeed,state.restStartBeat+.001).rest).toBe(true);
    expect(phraseArrangement(coinSeed,state.restEndBeat).rest).toBe(false);
   }
  }
 });

 it('ends scored notes before each rest, including notes near bar and phrase boundaries',()=>{
  for(const coinSeed of [1,1917,987654])for(const cap of [10000,1e8])for(let bar=0;bar<16;bar++){
   for(const event of composeMarketBar(coinSeed,bar,{...context,cap}).events){
    const state=phraseArrangement(coinSeed,bar*4+event.beat);
    expect(state.rest).toBe(false);
    expect(event.duration).toBeGreaterThan(0);
    expect(event.duration).toBeLessThanOrEqual(state.restInBeats+1e-10);
   }
  }
  expect(composeMarketBar(seed,3,{...context,active:false}).events).toEqual([]);
 });

 it.each([1,50,100])('preserves deterministic seeks and audible chord spread at %s×',rate=>{
  const timeline=createCompositionTimeline(segments,rate);
  for(const beat of [0,15.25,16,31.4,32,60])expect(timeline.beatAt(timeline.atBeat(beat))).toBeCloseTo(beat,10);
  const replayContext=timeline.contextAtBeat(8),score=composeMarketBar(seed,2,replayContext);
  const chord=score.events.filter(event=>event.kind==='chord');
  const spread=(timeline.atBeat(8+chord[1].beat)-timeline.atBeat(8+chord[0].beat))/1000/rate;
  expect(spread).toBeGreaterThanOrEqual(.009);
  expect(spread).toBeLessThanOrEqual(.017);
  const seekContext=timeline.contextAtBeat(timeline.beatAt(timeline.atBeat(8)));
  expect(composeMarketBar(seed,2,seekContext)).toEqual(score);
 });
});

function audioContextFixture(){
 const sources=[];
 const parameter=(value=0)=>({value,setTargetAtTime(value){this.value=value;},setValueAtTime(value){this.value=value;},linearRampToValueAtTime(value){this.value=value;},exponentialRampToValueAtTime(value){this.value=value;},cancelAndHoldAtTime(){},cancelScheduledValues(){}});
 const node=()=>({connect(){},disconnect(){}});
 const ctx={
  state:'running',sampleRate:1000,get currentTime(){return Date.now()/1000;},
  createGain:()=>({...node(),gain:parameter(1)}),
  createBiquadFilter:()=>({...node(),frequency:parameter(1000),Q:parameter(1)}),
  createConvolver:()=>({...node(),buffer:null}),
  createDelay:()=>({...node(),delayTime:parameter()}),
  createStereoPanner:()=>({...node(),pan:parameter()}),
  createBuffer:(channels,length,sampleRate=1000)=>({duration:length/sampleRate,length,sampleRate,numberOfChannels:channels,getChannelData:()=>new Float32Array(length)}),
  decodeAudioData:async()=>({duration:4}),
  createBufferSource:()=>{const source={...node(),playbackRate:parameter(1),start(time,offset){this.startAt=time;this.offset=offset;sources.push(this);},stop(time){this.stopAt=time;}};return source;},
 };
 return {ctx,sources};
}

async function pianoFixture(){
 vi.useFakeTimers();vi.setSystemTime(0);vi.resetModules();
 const entries=EARTHBOUND_PRESETS.map(preset=>({preset,file:`${preset}.wav`,midi:preset>=145&&preset<=146?36:60,velocity:64,trim:1,loop:true,loopStart:.1,loopEnd:3}));
 vi.stubGlobal('fetch',vi.fn(async path=>({ok:true,json:async()=>({files:entries.filter(entry=>String(path).includes('gameboy')?![145,146].includes(entry.preset):[145,146].includes(entry.preset))}),arrayBuffer:async()=>{if(!String(path).includes('gameboy/'))return new ArrayBuffer(8);const pcm=renderGameBoySample(GB_INSTRUMENTS[0],60).bytes;return pcm.buffer.slice(pcm.byteOffset,pcm.byteOffset+pcm.byteLength);}})));
 const {createTradePiano}=await import('../public/trade-piano.js');
 const fixture=audioContextFixture();fixture.piano=await createTradePiano(fixture.ctx,fixture.ctx.createGain(),{initialSeed:seed});return fixture;
}

afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});

describe('shared piano arrangement clock',()=>{
 it('returns neutral state while stopped, disabled, or closed, and never changes time when read',async()=>{
  const {piano}=await pianoFixture();
  const neutral=()=>expect(piano.arrangement()).toMatchObject({active:false,rest:false,phraseGain:1,layers:{piano:1,envion:1,data:1},secondsUntilRest:Infinity});
  piano.setTimeline(segments);piano.seekTimeline(createCompositionTimeline(segments,50).atBeat(15.5),50);neutral();
  piano.setRunning(true);
  const first=piano.arrangement();expect(first.active).toBe(true);expect(first.rest).toBe(true);
  for(let i=0;i<10;i++)expect(piano.arrangement()).toEqual(first);
  piano.setEnabled(false);neutral();piano.setEnabled(true);
  expect(piano.arrangement()).toEqual(first);
  piano.setRunning(false);neutral();piano.close();neutral();
 });

 it('uses replay timing through a 50× seek and does not schedule attacks or held notes into shared rests',async()=>{
  const {piano,sources}=await pianoFixture(),rate=50,timeline=createCompositionTimeline(segments,rate);
  const breath=phraseArrangement(seed,12),at=timeline.atBeat(breath.restStartBeat-.2);
  piano.setTimeline(segments);piano.seekTimeline(at,rate);piano.setRunning(true);
  expect(piano.arrangement().secondsUntilRest).toBeCloseTo((timeline.atBeat(breath.restStartBeat)-at)/1000/rate,10);
  vi.advanceTimersByTime(650);
  expect(sources.length).toBeGreaterThan(0);
  for(const source of sources){
   const beat=timeline.beatAt(at+source.startAt*1000*rate),state=phraseArrangement(seed,beat);
   expect(state.rest).toBe(false);
   const end=timeline.beatAt(at+source.stopAt*1000*rate);
   expect(end).toBeLessThanOrEqual(state.restStartBeat+1e-8);
  }
  const before=sources.length,seekAt=timeline.atBeat(31.5);
  piano.seekTimeline(seekAt,rate);expect(piano.arrangement().rest).toBe(true);
  const seekClock=Date.now()/1000;
  vi.advanceTimersByTime(25);
  for(const source of sources.slice(before))expect(phraseArrangement(seed,timeline.beatAt(seekAt+(source.startAt-seekClock)*1000*rate)).rest).toBe(false);
  piano.close();
 });

 it('allows one finite market phrase after a real observation, then stops new notes',async()=>{
  const {piano,sources}=await pianoFixture();piano.configure({phraseLength:8});piano.setRunning(true);
  piano.trade({kind:'swap',id:'one',priceUsd:10,receivedAt:0},context.cap,context.music);
  await vi.advanceTimersByTimeAsync(4700);expect(piano.arrangement().active).toBe(true);expect(sources.length).toBeGreaterThan(0);
  await vi.advanceTimersByTimeAsync(300);expect(piano.arrangement().active).toBe(false);const count=sources.length;
  await vi.advanceTimersByTimeAsync(500);expect(sources).toHaveLength(count);piano.close();
 });
 it('changes GB timbre without restarting the market phrase clock',async()=>{
  const {piano}=await pianoFixture();piano.setRunning(true);
  piano.trade({kind:'swap',id:'one',priceUsd:10,receivedAt:0},context.cap,context.music);
  await vi.advanceTimersByTimeAsync(1000);const before=piano.arrangement().beat;
  piano.configure({preset:13});await vi.advanceTimersByTimeAsync(0);
  expect(piano.arrangement().beat).toBeCloseTo(before,10);expect(piano.snapshot().loading).toBe(false);piano.close();
 });
 it('keeps genuine activity gating independent of phrase dynamics',async()=>{
  const {piano,sources}=await pianoFixture();
  piano.setRunning(true);vi.advanceTimersByTime(500);
  expect(piano.arrangement().active).toBe(false);expect(sources).toHaveLength(0);
  piano.setTimeline(segments.map(segment=>({...segment,active:false})));piano.seekTimeline(0,50);
  vi.advanceTimersByTime(500);expect(piano.arrangement().active).toBe(false);expect(sources).toHaveLength(0);
  piano.close();
 });
});
