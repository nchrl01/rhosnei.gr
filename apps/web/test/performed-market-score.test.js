import {describe,it,expect} from 'vitest';
import {composePerformedBar,performedArrangement} from '../public/performed-market-score.js';
import {marketChipSignal} from '../public/market-chip-score.js';
import {createChipVisualEvents} from '../public/chip-visual-events.js';
const metrics={source:'trades',observed:true,fresh:1,tradingActivity:1,price:104,referencePrice:100,activity:.6,volume:.5,motion:.3,intensity:.6,tradeRate:2,marketCap:100000,liquidity:100000};
const context={metrics};
const plan=(bar=0,patch={})=>composePerformedBar(1917,bar,{...context,...patch});
describe('approved pre-drum production arrangement',()=>{
 it('lets all rolled chord tones ring in independent GB slots without percussion',()=>{
  const p=plan(),chord=p.events.filter(e=>e.kind.startsWith('chord'));
  expect(chord).toHaveLength(p.harmony.notes.length);
  expect(new Set(chord.map(e=>`${e.chip}:${e.channel}`)).size).toBe(chord.length);
  expect(chord.some(e=>e.chip===2)).toBe(true);
  expect(chord.every(e=>e.duration>.5&&e.expression.adsr)).toBe(true);
  for(let i=1;i<chord.length;i++){
   const seconds=(chord[i].beat-chord[i-1].beat)*60/p.musicalMapping.tempo.bpm;
   expect(seconds).toBeGreaterThanOrEqual(.009);expect(seconds).toBeLessThanOrEqual(.017);
  }
  expect(p.events.some(e=>e.kind==='arp')).toBe(true);
  expect(p.events.some(e=>e.kind==='bass'&&e.expression.wave===4)).toBe(true);
  expect(p.events.some(e=>e.kind==='drum'||e.drum)).toBe(false);
 });
 it.each([{fresh:0},{tradingActivity:0},{observed:false}])('gates all three chips on real observation availability: %j',patch=>{
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
  expect(plan().harmony.notes).not.toEqual(down.harmony.notes);
  const large=composePerformedBar(1917,0,{metrics:{...metrics,marketCap:1e9}});
  expect(large.events.filter(e=>e.kind==='bass').length).toBeGreaterThan(plan().events.filter(e=>e.kind==='bass').length);
  const quiet=composePerformedBar(1917,0,{metrics:{...metrics,activity:.05,tradeRate:.05}});
  expect(quiet.musicalMapping.tempo.bpm).toBeLessThan(plan().musicalMapping.tempo.bpm);
 });
 it('keeps final melody guard and forwards sounded voice roles/ADSR to EarthBound',()=>{
  const p=plan();expect(p.events.filter(e=>e.kind==='arp').every(e=>e.expression.allowedPitches.includes(e.midi))).toBe(true);
  const cues=createChipVisualEvents();let end=1;
  const e=p.events.find(e=>e.chip===2&&e.kind.startsWith('chord'));
  cues.enqueue({id:'third-chip',time:0,kind:e.kind,midi:e.midi,gain:e.gain,duration:1,adsr:e.expression.adsr,getEnd:()=>end},0);
  expect(cues.sample(.06).chord).toBeGreaterThan(0);
  end=.1;expect(cues.sample(.5).chord).toBe(0);
 });
});
