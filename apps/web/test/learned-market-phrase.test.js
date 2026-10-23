import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import {composeMarketBar,createCompositionTimeline} from '../public/market-composition.js';
import {createMelodyOriginalityGuard,LEARNED_PHRASE_INFO} from '../public/learned-market-phrase.js';
import {createOriginalityMatcher,MIDI_ORIGINALITY_INFO} from '../public/midi-originality.js';

const context={active:true,cap:1e6,pitchLow:60,pitchHigh:88,
 music:{tempo:100,intensity:.65,activity:.8,group:'up',character:'serene'}};
const melody=score=>score.events.filter(event=>event.kind==='arp');
const sequence=(overrides={},seed=1917)=>Array.from({length:16},(_,bar)=>
 melody(composeMarketBar(seed,bar,{...context,...overrides})).map(({beat,midi,duration,gain})=>({beat,midi,duration,gain})));
const indexBytes=new Uint8Array(readFileSync(new URL('../public/midi-originality-index.bin',import.meta.url)));
const sourceMatch=createOriginalityMatcher(indexBytes);

describe('learned phrasing in the shared market score',()=>{
 it('uses the same corpus as the guard and reconstructs bars independently of playback order',()=>{
  expect(LEARNED_PHRASE_INFO.sourceCount).toBe(MIDI_ORIGINALITY_INFO.sourceFiles);
  expect(LEARNED_PHRASE_INFO.noteCount).toBeGreaterThan(0);
  const original=sequence();
  for(const bar of [15,2,10,0,7,1]){
   const actual=melody(composeMarketBar(1917,bar,context)).map(({beat,midi,duration,gain})=>({beat,midi,duration,gain}));
   expect(actual).toEqual(original[bar]);
  }
  expect(sequence()).toEqual(original);
  expect(sequence({},1918)).not.toEqual(original);
 });

 it('keeps every phrase control effective at the default full learned blend',()=>{
  const cases=[
   ['phraseShape',0,10],['phraseDepth',0,1],['phraseLength',4,16],
   ['phraseGate',.2,1],['phraseLearning',0,1],['phraseVariation',0,1],
  ];
  for(const [key,low,high] of cases){
   expect(sequence({[key]:low}),key).not.toEqual(sequence({[key]:high}));
  }
  expect(sequence()).toEqual(sequence({phraseLearning:1}));
 });

 it('responds to market direction and energy without replacing the shared beat clock',()=>{
  expect(sequence({music:{...context.music,group:'down'}})).not.toEqual(sequence());
  expect(sequence({music:{...context.music,activity:.05,intensity:.05}})).not.toEqual(sequence());
  const segments=[{...context,start:0,end:600000}];
  for(const rate of [1,50,100]){
   const timeline=createCompositionTimeline(segments,rate);
   for(const beat of [0,6.25,19.5,47])expect(timeline.beatAt(timeline.atBeat(beat))).toBeCloseTo(beat,9);
   expect(timeline.rows.every(row=>row.audibleTempo<=200)).toBe(true);
  }
 });

 it('stays silent with no market activity and honors disabled arpeggios',()=>{
  for(const seed of [1,1917,987654])for(const bar of [0,1,7,15]){
   expect(composeMarketBar(seed,bar,{...context,active:false}).events).toEqual([]);
   expect(melody(composeMarketBar(seed,bar,{...context,arpeggios:false}))).toEqual([]);
  }
 });

 it('bounds the actual learned notes and leaves no overlapping lead attacks',()=>{
  let notes=0;
  for(let seed=0;seed<24;seed++)for(let bar=0;bar<16;bar++){
   const plan=composeMarketBar(seed,bar,context),lead=melody(plan);
   for(const event of plan.events){
    for(const key of ['beat','midi','duration','gain'])expect(Number.isFinite(event[key]),key).toBe(true);
    expect(event.beat).toBeGreaterThanOrEqual(0);expect(event.beat).toBeLessThan(4);
    expect(event.duration).toBeGreaterThan(0);expect(event.gain).toBeGreaterThan(0);
   }
   lead.forEach((event,index)=>{
    notes++;expect(Number.isInteger(event.midi)).toBe(true);
    expect(event.midi).toBeGreaterThanOrEqual(context.pitchLow);
    expect(event.midi).toBeLessThanOrEqual(context.pitchHigh);
    expect(event.allowedPitches).toContain(event.midi);
    expect(event.beat+event.duration).toBeLessThanOrEqual((lead[index+1]?.beat??4)+1e-9);
   });
  }
  expect(notes).toBeGreaterThan(100);
 });
});

describe('guarding only committed sounding notes',()=>{
 it('does not add proposed or abandoned notes to history',()=>{
  const match=vi.fn(()=>({ready:true,match:false})),guard=createMelodyOriginalityGuard(match);
  expect(guard.choose(60,[60,62])).toBe(60);
  expect(guard.choose(62,[60,62])).toBe(62);
  expect(match.mock.lastCall[0]).toEqual([62]);
  guard.remember(62,1,'sounding');
  expect(guard.choose(64,[64])).toBe(64);
  expect(match.mock.lastCall[0]).toEqual([62,64]);
 });

 it('removes canceled future sources and retains the already sounded notes',()=>{
  const match=vi.fn(()=>({ready:true,match:false})),guard=createMelodyOriginalityGuard(match);
  guard.remember(60,0,'past');guard.remember(62,2,'future');guard.remember(64,3,'later');
  guard.cancel('future');guard.choose(65,[65]);
  expect(match.mock.lastCall[0]).toEqual([60,64,65]);
  guard.cancelAfter(3);guard.choose(67,[67]);
  expect(match.mock.lastCall[0]).toEqual([60,67]);
  guard.reset();guard.choose(69,[69]);
  expect(match.mock.lastCall[0]).toEqual([69]);
 });

 it('revoices the ninth note using committed history across bar boundaries',()=>{
  const match=notes=>({ready:true,match:notes.length>=9&&notes.at(-1)===74});
  const guard=createMelodyOriginalityGuard(match);
  [60,62,64,65,67,69,71,72].forEach((pitch,index)=>guard.accept(pitch,[pitch],index*.75));
  expect(guard.accept(74,[72,74,75],6)).toBe(75);
  expect(guard.snapshot().revoiced).toBe(1);
 });

 it('blocks playback without a verified index or when every candidate matches',()=>{
  const loading=createMelodyOriginalityGuard(()=>({ready:false,match:null}));
  expect(loading.accept(60,[60,62])).toBeNull();expect(loading.snapshot().blocked).toBe(1);
  const matched=createMelodyOriginalityGuard(()=>({ready:true,match:true}));
  expect(matched.accept(60,[60,62])).toBeNull();expect(matched.snapshot().blocked).toBe(1);
 });

 it('recognizes a known indexed run after transposition',()=>{
  const run=[60,62,64,65,67,69,71,72,74];
  expect(sourceMatch(run).match).toBe(true);
  expect(sourceMatch(run.map(pitch=>pitch+5)).match).toBe(true);
  expect(sourceMatch(run.slice(0,8)).windowsChecked).toBe(0);
  const guard=createMelodyOriginalityGuard(sourceMatch);
  run.slice(0,8).forEach((pitch,index)=>expect(guard.accept(pitch,[pitch],index)).toBe(pitch));
  expect(guard.accept(run[8],[run[8]],8)).toBeNull();
 });

 it('screens the final pitch stream against real corpus bytes across many seeds and bars',()=>{
  let candidates=0,revoiced=0,accepted=0;
  for(let seed=0;seed<64;seed++){
   const guard=createMelodyOriginalityGuard(sourceMatch),heard=[];
   for(let bar=0;bar<32;bar++){
    const music={...context.music,group:bar%8<4?'up':'down',activity:(bar%7)/7,intensity:(bar%10)/10,
     movement:bar%7===0?{event:{id:`${seed}:${bar}`,direction:bar%2?-1:1}}:null};
    const plan=composeMarketBar(seed,bar,{...context,music,cap:10**(3+seed%6),
     landmarkBar:bar%7===0?bar:null});
    for(const event of melody(plan)){
     candidates++;
     const pitch=guard.accept(event.midi,event.allowedPitches,bar*4+event.beat);
     if(pitch===null)continue;
     accepted++;if(pitch!==event.midi)revoiced++;
     heard.push(pitch);
     expect(sourceMatch(heard.slice(-9)).match).toBe(false);
    }
   }
  }
  expect(candidates).toBeGreaterThan(1000);expect(accepted).toBeGreaterThan(1000);
  expect(revoiced).toBeGreaterThan(0);
 });
});
