import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {phraseArrangement,noteExpression} from '../public/phrase-arrangement.js';
import {composeMarketBar,createCompositionTimeline} from '../public/market-composition.js';
import {arpRhythm} from '../public/arp-rhythm.js';
import {pianoHarmony} from '../public/music-context.js';

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
 const sources=[],processors=[],modules=[];
 const parameter=(value=0)=>({value,setTargetAtTime(value){this.value=value;},setValueAtTime(value){this.value=value;},linearRampToValueAtTime(value){this.value=value;},exponentialRampToValueAtTime(value){this.value=value;},cancelAndHoldAtTime(){},cancelScheduledValues(){}});
 const node=()=>({connect(){},disconnect(){}});
 const ctx={
  state:'running',sampleRate:48000,get currentTime(){return Date.now()/1000;},
  audioWorklet:{addModule:vi.fn(async url=>{modules.push(String(url));})},
  createGain:()=>({...node(),gain:parameter(1)}),
 };
 // Exercise the real score, rack and register compiler. This fixture replaces
 // only the browser worklet boundary, retaining frame timing, channel steals,
 // generation resets and cancellation semantics for transport assertions.
 vi.stubGlobal('AudioWorkletNode',class{
  constructor(context,name,options){
   this.context=context;this.name=name;this.options=options;this.messages=[];
   this.generation=options.processorOptions.generation;processors.push(this);
   this.port={onmessage:null,postMessage:message=>{
    this.messages.push(message);
    const mine=sources.filter(source=>source.processor===this&&!source.cancelled);
    if(message.type==='reset'||message.type==='close'){
     for(const source of mine){
      if(source.startAt>=ctx.currentTime)source.cancelled=true;
      source.stopAt=Math.min(source.stopAt,ctx.currentTime);
     }
     this.generation=message.generation;
    }else if(message.generation===this.generation&&message.type==='schedule'){
     const event=message.event,startAt=event.startFrame/ctx.sampleRate,stopAt=event.endFrame/ctx.sampleRate;
     for(const source of mine)if(source.channel===event.channel&&source.startAt<=startAt&&source.stopAt>startAt)source.stopAt=startAt;
     sources.push({...event,startAt,stopAt,processor:this,generation:message.generation,cancelled:false});
    }else if(message.generation===this.generation&&message.type==='cancelAfter'){
     for(const source of mine)if(source.startFrame>=message.frame&&(!message.drumsOnly||source.category==='drum'))source.cancelled=true;
    }else if(message.generation===this.generation&&message.type==='cancelVoice'){
     for(const source of mine)if(source.id===message.id){
      const at=message.frame/ctx.sampleRate;
      if(at<=ctx.currentTime||at<=source.startAt)source.cancelled=true;
      source.stopAt=Math.min(source.stopAt,at);
     }
    }
   }};
  }
  connect(){}
  disconnect(){}
 });
 return {ctx,sources,processors,modules};
}

async function pianoFixture(){
 vi.useFakeTimers();vi.setSystemTime(0);vi.resetModules();
 const index=await readFile(new URL('../public/midi-originality-index.bin',import.meta.url));
 const {installOriginalityIndex}=await import('../public/midi-originality.js?v=455');
 await installOriginalityIndex(index);
 vi.stubGlobal('fetch',vi.fn(()=>{throw Error('The installed index and register-driven host require no sample fetches');}));
 const {createTradePiano}=await import('../public/trade-piano.js');
 const {marketChipSignal}=await import('../public/market-chip-score.js?v=471');
 const {chipEnsembleArrangement}=await import('../public/chip-ensemble-arrangement.js?v=471');
 const fixture=audioContextFixture();
 fixture.arrangementAt=beat=>chipEnsembleArrangement(seed,beat,marketChipSignal(context));
 fixture.piano=await createTradePiano(fixture.ctx,fixture.ctx.createGain(),{initialSeed:seed});return fixture;
}

afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});

describe('shared chip arrangement clock',()=>{
 it('stays inactive while stopped, disabled, or closed, and never changes time when read',async()=>{
  const {piano,sources}=await pianoFixture();
  const inactive=()=>expect(piano.arrangement().active).toBe(false);
  piano.setTimeline(segments);piano.seekTimeline(createCompositionTimeline(segments,50).atBeat(15.5),50);inactive();
  piano.setRunning(true);
  const first=piano.arrangement();expect(first.active).toBe(false);expect(first.rest).toBe(true);
  for(let i=0;i<10;i++)expect(piano.arrangement()).toEqual(first);
  expect(sources).toHaveLength(0);
  piano.setEnabled(false);inactive();piano.setEnabled(true);
  expect(piano.arrangement()).toEqual(first);
  piano.setRunning(false);inactive();piano.close();inactive();
  vi.advanceTimersByTime(1000);expect(sources).toHaveLength(0);
 });

 it('uses replay timing through a 50× seek and does not schedule attacks or held notes into shared rests',async()=>{
  const {piano,sources,arrangementAt}=await pianoFixture(),rate=50,timeline=createCompositionTimeline(segments,rate);
  const breath=arrangementAt(12),at=timeline.atBeat(12);
  piano.setTimeline(segments);piano.seekTimeline(at,rate);piano.setRunning(true);
  expect(piano.arrangement().secondsUntilRest).toBeCloseTo((timeline.atBeat(breath.restStartBeat)-at)/1000/rate,10);
  const untilRestEnd=(timeline.atBeat(breath.restEndBeat)-at)/1000/rate;
  vi.advanceTimersByTime(Math.ceil(untilRestEnd*1000)+50);
  const audible=sources.filter(source=>!source.cancelled);
  expect(audible.length).toBeGreaterThan(0);
  for(const source of audible){
   const beat=timeline.beatAt(at+source.startAt*1000*rate),state=arrangementAt(beat);
   expect(state.rest).toBe(false);
   const end=timeline.beatAt(at+source.stopAt*1000*rate);
   // Register commands round upward to an output sample boundary.
   const sampleBeat=200/60/48000;
   expect(end).toBeLessThanOrEqual(state.restStartBeat+sampleBeat);
  }
  const before=sources.length,seekAt=timeline.atBeat(31.5);
  piano.seekTimeline(seekAt,rate);expect(piano.arrangement().rest).toBe(true);
  const seekClock=Date.now()/1000;
  vi.advanceTimersByTime(25);
  for(const source of sources.slice(before).filter(source=>!source.cancelled))expect(arrangementAt(timeline.beatAt(seekAt+(source.startAt-seekClock)*1000*rate)).rest).toBe(false);
  piano.close();
 });

 it('releases a real observation for at most thirty seconds when input delivery stops',async()=>{
  const {piano,sources}=await pianoFixture();piano.configure({phraseLength:8});piano.setRunning(true);
  piano.trade({kind:'swap',id:'one',priceUsd:10,receivedAt:0},context.cap,context.music);
  await vi.advanceTimersByTimeAsync(4700);expect(piano.arrangement().active).toBe(true);expect(sources.length).toBeGreaterThan(0);
  expect(piano.arrangement().signal.tradingActivity).toBeCloseTo(Math.exp(-(4.7-2)/8),10);
  const expiresAt=30;
  expect(sources.filter(source=>!source.cancelled).every(source=>source.startAt<expiresAt)).toBe(true);
  await vi.advanceTimersByTimeAsync(expiresAt*1000-4700+50);expect(piano.arrangement().active).toBe(false);const count=sources.length;
  await vi.advanceTimersByTimeAsync(500);expect(sources).toHaveLength(count);piano.close();
 });
 it('ignores unchanged price polls even when their IDs and old aggregate activity are positive',async()=>{
  const {piano,sources}=await pianoFixture();piano.setRunning(true);
  expect(piano.observePrice({kind:'price-observation',id:'poll-0',price:100,referencePrice:100},context.cap,context.music)).toBe(false);
  await vi.advanceTimersByTimeAsync(500);expect(sources).toHaveLength(0);
  expect(piano.observePrice({kind:'price-observation',id:'poll-1',price:101,referencePrice:100},context.cap,context.music)).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);expect(sources.length).toBeGreaterThan(0);
  for(let i=0;i<30;i++){
   expect(piano.observePrice({kind:'price-observation',id:`unchanged-${i}`,price:101,referencePrice:101},context.cap,context.music)).toBe(false);
   await vi.advanceTimersByTimeAsync(1000);
  }
  expect(piano.snapshot().phrase).toBe(false);expect(piano.arrangement().signal.tradingActivity).toBe(0);
  const count=sources.length;await vi.advanceTimersByTimeAsync(500);expect(sources).toHaveLength(count);piano.close();
 });
 it('accepts distinct same-price swaps as real activity but rejects duplicate event IDs',async()=>{
  const {piano}=await pianoFixture();piano.setRunning(true);
  const event={kind:'swap',id:'swap-1',price:100,referencePrice:100};
  expect(piano.trade(event,context.cap,context.music)).toBe(true);
  await vi.advanceTimersByTimeAsync(28000);
  expect(piano.trade(event,context.cap,context.music)).toBe(false);
  expect(piano.trade({...event,id:'swap-2'},context.cap,context.music)).toBe(true);
  expect(piano.arrangement().signal.tradingActivity).toBe(1);
  await vi.advanceTimersByTimeAsync(2500);expect(piano.snapshot().phrase).toBe(true);
  await vi.advanceTimersByTimeAsync(27550);expect(piano.snapshot().phrase).toBe(false);piano.close();
 });
 it('immediately gates old positive aggregates when a live frame explicitly reports no recent activity',async()=>{
  const {piano,sources}=await pianoFixture();piano.setRunning(true);
  piano.trade({kind:'swap',id:'active',price:101,referencePrice:100},context.cap,context.music);
  await vi.advanceTimersByTimeAsync(1000);expect(sources.length).toBeGreaterThan(0);
  const count=sources.length;
  for(const snapshotAge of [5000,0,5000,0]){
   expect(piano.frame({price:101,activity:1,volume:1,motion:1,tradeRate:12,fresh:1,tradingActivity:0,
    snapshotAge,decoded:true,music:context.music},{playing:true})).toBe(false);
   expect(piano.snapshot().phrase).toBe(false);expect(piano.arrangement().active).toBe(false);
   await vi.advanceTimersByTimeAsync(250);expect(sources).toHaveLength(count);
  }
  piano.close();
 });
 it('preserves the last observed return and cannot renew it merely by rendering another frame',async()=>{
  const {piano,sources}=await pianoFixture();piano.setRunning(true);
  piano.trade({kind:'swap',id:'moved',price:101,referencePrice:100},context.cap,context.music);
  const frame={price:101,observed:true,activity:.8,fresh:1,tradingActivity:1,music:{...context.music,lastMove:20}};
  for(let i=0;i<31;i++){
   piano.frame(frame,{playing:true});
   expect(piano.arrangement().signal.delta).toBeCloseTo(1,10);
   await vi.advanceTimersByTimeAsync(1000);
  }
  expect(piano.snapshot().phrase).toBe(false);expect(piano.arrangement().active).toBe(false);
  const count=sources.length;await vi.advanceTimersByTimeAsync(500);expect(sources).toHaveLength(count);piano.close();
 });
 it('changes GB timbre without restarting the market phrase clock',async()=>{
  const {piano,sources,modules,processors}=await pianoFixture();piano.setRunning(true);
  piano.trade({kind:'swap',id:'one',priceUsd:10,receivedAt:0},context.cap,context.music);
  await vi.advanceTimersByTimeAsync(1000);const before=piano.arrangement().beat;
  const beforeMessages=sources.length;piano.configure({chipDuty:0});await vi.advanceTimersByTimeAsync(0);
  expect(piano.arrangement().beat).toBeCloseTo(before,10);expect(piano.snapshot().loading).toBe(false);
  await vi.advanceTimersByTimeAsync(4000);
  const pulses=sources.slice(beforeMessages).filter(source=>!source.cancelled&&source.channel<2);
  expect(pulses.length).toBeGreaterThan(0);
  for(const source of pulses){
   const duty=source.writes.find(([address])=>address===(source.channel===0?0xff11:0xff16));
   expect(duty).toBeTruthy();expect(duty[1]>>>6).toBe(0);
   expect(source.writes.every(([address,value])=>Number.isInteger(address)&&address>=0xff10&&address<=0xff3f&&Number.isInteger(value)&&value>=0&&value<=255)).toBe(true);
  }
  expect(modules).toHaveLength(1);expect(modules[0]).toContain('gb-apu-worklet.js');
  expect(processors).toHaveLength(2);
  expect(piano.snapshot().chip).toMatchObject({chipCount:2,channelCount:8});
  expect(fetch).not.toHaveBeenCalled();piano.close();
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
