import {describe,it,expect} from 'vitest';
import {composePerformedBar,performedArrangement} from '../public/performed-market-score.js';
import {marketChipSignal} from '../public/market-chip-score.js';
import {createChipVisualEvents} from '../public/chip-visual-events.js';
const metrics={source:'trades',observed:true,fresh:1,tradingActivity:1,price:104,referencePrice:100,activity:.6,volume:.5,motion:.3,intensity:.6,tradeRate:2,marketCap:100000,liquidity:100000};
const context={metrics};
const plan=(bar=0,patch={})=>composePerformedBar(1917,bar,{...context,...patch});
describe('Friday four-channel production arrangement',()=>{
 it('keeps the original four-channel interruptions and low register',()=>{
  const p=plan();
  expect(p.events.length).toBeGreaterThan(0);
  expect(p.events.every(e=>e.chip===0&&e.channel>=0&&e.channel<=3)).toBe(true);
  for(let channel=0;channel<4;channel++){
   const lane=p.events.filter(e=>e.channel===channel);
   for(let i=1;i<lane.length;i++)expect(lane[i-1].beat+lane[i-1].duration).toBeLessThanOrEqual(lane[i].beat+1e-9);
  }
  expect(p.events.some(e=>e.kind==='arp')).toBe(true);
  const bass=Array.from({length:16},(_,bar)=>plan(bar).events).flat().filter(e=>e.kind==='bass');
  expect(bass.length).toBeGreaterThan(0);expect(bass.every(e=>e.midi>=24&&e.midi<=35)).toBe(true);
  expect(p.events.filter(e=>!e.drum&&e.channel<2).every(e=>e.midi>=36&&e.midi<=47)).toBe(true);
 });
 it.each([{fresh:0},{tradingActivity:0},{observed:false}])('gates the chip on real observation availability: %j',patch=>{
  for(let bar=0;bar<8;bar++)expect(composePerformedBar(1917,bar,{metrics:{...metrics,...patch}}).events).toEqual([]);
 });
 it('honours the observed zero-volume candle gate even when its price moved',()=>{
  const m={...metrics,source:'candles',replay:{source:'candles',volume:0},observedVolume:0,volume:0};
  expect(composePerformedBar(1917,0,{metrics:m}).events).toEqual([]);
 });
 it('keeps shared rests and reconstructs the same notes after seeks',()=>{
  const expected=plan(7);
  for(const bar of [10,1,44,2])plan(bar);
  expect(plan(7)).toEqual(expected);
  for(let bar=0;bar<16;bar++)for(const e of plan(bar).events){
   const state=performedArrangement(1917,bar*4+e.beat,marketChipSignal(context));
   expect(state.rest).toBe(false);expect(e.duration).toBeLessThanOrEqual(state.restInBeats);
  }
 });
 it('changes direction, tempo and cap-driven rhythm from observed market changes',()=>{
  const down=composePerformedBar(1917,0,{metrics:{...metrics,price:96}});
  expect(plan().harmony.group).toBe('up');expect(down.harmony.group).toBe('down');
  expect(plan().events.map(e=>e.midi)).not.toEqual(down.events.map(e=>e.midi));
  const large=composePerformedBar(1917,0,{metrics:{...metrics,marketCap:1e9}});
  expect(large.drums.density).toBeLessThan(plan().drums.density);
  const quiet=composePerformedBar(1917,0,{metrics:{...metrics,activity:.05,tradeRate:.05}});
  expect(quiet.musicalMapping.tempo.bpm).toBeLessThan(plan().musicalMapping.tempo.bpm);
 });
 it('forwards Friday sounded roles and native envelope steps to EarthBound',()=>{
  const p=plan(),cues=createChipVisualEvents();let end=1;
  const e=p.events.find(e=>e.kind==='arp');
  cues.enqueue({id:'friday-chip',time:0,kind:e.kind,midi:e.midi,gain:e.gain,duration:1,
   hardwareEnvelope:{initial:8,pace:1,increasing:false},getEnd:()=>end},0);
  expect(cues.sample(.06).arp).toBeGreaterThan(0);
  end=.1;expect(cues.sample(.5).arp).toBe(0);
 });
});
