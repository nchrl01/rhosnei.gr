import {describe,expect,it} from 'vitest';
import {marketMusicalMapping} from '../public/market-musical-mapping.js';
import {composeGameBoyDrumBar,gameBoyDrumControls} from '../public/gameboy-drum-pattern.js';

const active={observed:true,fresh:1,tradingActivity:1,activity:.36,activityKnown:true,
 tradeRate:0,tradeRateKnown:false,marketCap:10**7.5,liquidity:10**5.5,
 holders:3162,holdersKnown:true,delta:1,deltaKnown:true};

describe('one explicit market input for each musical control',()=>{
 it('maps larger market caps to a more spacious regular circuit without changing tempo',()=>{
  const small=marketMusicalMapping({...active,marketCap:1e5});
  const middle=marketMusicalMapping(active);
  const large=marketMusicalMapping({...active,marketCap:1e10});
  expect(small.rhythm).toMatchObject({size:0,regularity:0});
  expect(middle.rhythm).toEqual({size:.5,regularity:.5,rate:1});
  expect(large.rhythm).toMatchObject({size:1,regularity:1});
  expect(small.rhythm.rate).toBeCloseTo(Math.SQRT2,12);
  expect(large.rhythm.rate).toBeCloseTo(1/Math.SQRT2,12);
  expect([small.tempo.bpm,middle.tempo.bpm,large.tempo.bpm]).toEqual([100,100,100]);
 });

 it('uses known liquidity for harmonic adherence and articulation, not activation or louder output',()=>{
  const dry=marketMusicalMapping({...active,liquidity:0});
  const medium=marketMusicalMapping(active);
  const deep=marketMusicalMapping({...active,liquidity:1e8});
  expect(dry.known.liquidity).toBe(true);
  expect(dry.harmony).toEqual({musicality:0,stability:.45,gate:.55});
  expect(medium.harmony.musicality).toBeCloseTo(.5,12);
  expect(deep.harmony).toEqual({musicality:1,stability:.95,gate:1});
  expect(dry.excitation).toBe(deep.excitation);
  expect(dry.tempo).toEqual(deep.tempo);
 });

 it('uses observed holder population for arpeggio note count and range only',()=>{
  const small=marketMusicalMapping({...active,holders:10});
  const large=marketMusicalMapping({...active,holders:1e6});
  expect(small.arpeggio).toEqual({population:0,notes:2,span:12});
  expect(large.arpeggio).toEqual({population:1,notes:4,span:24});
  expect(small.rhythm).toEqual(large.rhythm);
  expect(small.harmony).toEqual(large.harmony);
  expect(small.tempo).toEqual(large.tempo);
  expect(marketMusicalMapping({...active,holders:0}).known.holders).toBe(true);
 });

 it('preserves the sign of percent change and bounds its strength symmetrically',()=>{
  const rising=marketMusicalMapping({...active,delta:8});
  const falling=marketMusicalMapping({...active,delta:-8});
  expect(rising.change.direction).toBe(1);expect(falling.change.direction).toBe(-1);
  expect(rising.change.magnitude).toBeCloseTo(Math.tanh(1),12);
  expect(falling.change.magnitude).toBe(rising.change.magnitude);
  expect(falling.change.signed).toBe(-rising.change.signed);
  expect(rising.tempo).toEqual(falling.tempo);
  expect(marketMusicalMapping({...active,delta:0}).change).toEqual({direction:0,magnitude:0,signed:0});
  expect(marketMusicalMapping({...active,delta:1e20}).change).toEqual({direction:1,magnitude:1,signed:1});
 });

 it('sets tempo from measured activity and recency rather than price magnitude or intensity',()=>{
  const slow=marketMusicalMapping({...active,activity:0});
  const fast=marketMusicalMapping({...active,activity:1});
  const release=marketMusicalMapping({...active,activity:1,tradingActivity:.25});
  expect(slow.tempo).toEqual({activity:0,bpm:40});
  expect(fast.tempo).toEqual({activity:1,bpm:140});
  expect(release.tempo).toEqual({activity:.25,bpm:90});
  expect(marketMusicalMapping({...active,delta:100,intensity:1,pressure:1}).tempo.bpm).toBe(100);
 });

 it('uses decoded trade rate as an available pace measurement without adding duplicate activity',()=>{
  expect(marketMusicalMapping({...active,activity:1,tradeRate:8,tradeRateKnown:true}).tempo).toEqual({activity:1,bpm:140});
  const rateOnly=marketMusicalMapping({...active,activityKnown:false,tradeRate:8,tradeRateKnown:true});
  expect(rateOnly.known.activity).toBe(true);expect(rateOnly.tempo).toEqual({activity:1,bpm:140});
  const unavailable=marketMusicalMapping({...active,activityKnown:false,tradeRate:8,tradeRateKnown:false});
  expect(unavailable.known.activity).toBe(false);expect(unavailable.tempo).toEqual({activity:0,bpm:100});
 });
});

describe('market cap controls the existing asynchronous drum circuit',()=>{
 const signal={...active,activity:.8,volume:.8,volumeKnown:true,motion:.6,intensity:.7,delta:2,balance:.5,balanceKnown:true};
 const context=marketCap=>({signal:{...signal,marketCap},drumDensity:.9,drumDeviation:.5});
 const packetSample=(seed,marketCap)=>Array.from({length:12},(_,bar)=>composeGameBoyDrumBar(seed,bar,context(marketCap))).flatMap(plan=>plan.events);

 it.each([1,1917,987654])('changes spacing while preserving circuit identity and activity density, seed %s',seed=>{
  const small=context(1e5),large=context(1e10);
  expect(gameBoyDrumControls(small).density).toBe(gameBoyDrumControls(large).density);
  const smallPlan=composeGameBoyDrumBar(seed,0,small),largePlan=composeGameBoyDrumBar(seed,0,large);
  expect(smallPlan.patternId).toBe(largePlan.patternId);
  const smaller=packetSample(seed,1e5),larger=packetSample(seed,1e10);
  expect(smaller.length).toBeGreaterThan(0);expect(larger.length).toBeGreaterThan(0);
  const observedVoices=['kick','snare','hat','tom'].filter(drum=>smaller.some(event=>event.drum===drum)&&larger.some(event=>event.drum===drum));
  expect(observedVoices.length).toBeGreaterThan(1);
  for(const drum of observedVoices){
   const smallPeriod=smaller.find(event=>event.drum===drum).packetPeriod;
   const largePeriod=larger.find(event=>event.drum===drum).packetPeriod;
   expect(largePeriod/smallPeriod).toBeCloseTo(2,12);
  }
  expect(smaller.some(event=>Math.abs(event.beat*4-Math.round(event.beat*4))>1e-5)).toBe(true);
  expect(larger.some(event=>Math.abs(event.beat*4-Math.round(event.beat*4))>1e-5)).toBe(true);
 });

 it('keeps missing-cap timing exactly at the neutral circuit and remains deterministic',()=>{
  const missing=context(null),middle=context(10**7.5);
  for(let bar=0;bar<8;bar++){
   expect(composeGameBoyDrumBar(1917,bar,missing)).toEqual(composeGameBoyDrumBar(1917,bar,middle));
   expect(composeGameBoyDrumBar(1917,bar,middle)).toEqual(composeGameBoyDrumBar(1917,bar,middle));
  }
 });

 it.each([1e5,1e10,null])('does not produce packets from market cap %s with a closed activity gate',marketCap=>{
  const quiet={...context(marketCap),signal:{...signal,marketCap,tradingActivity:0}};
  expect(gameBoyDrumControls(quiet).density).toBe(0);
  for(let bar=0;bar<8;bar++)expect(composeGameBoyDrumBar(1917,bar,quiet).events).toEqual([]);
 });
});

describe('neutral missing evidence and preserved market gate',()=>{
 it('uses declared neutral controls for missing data without inventing observations',()=>{
  const controls=marketMusicalMapping({});
  expect(controls).toEqual({
   active:false,excitation:0,known:{marketCap:false,liquidity:false,holders:false,change:false,activity:false},
   rhythm:{size:.5,rate:1,regularity:.5},
   harmony:{musicality:.5,stability:.7,gate:.775},
   arpeggio:{population:.5,notes:3,span:18},
   change:{direction:0,magnitude:0,signed:0},tempo:{activity:0,bpm:100},
  });
 });

 it('respects availability even if a caller retains present-day or stale numeric values',()=>{
  const controls=marketMusicalMapping({...active,marketCap:1e10,marketCapKnown:false,
   liquidity:1e8,liquidityKnown:false,holders:1e6,holdersKnown:false,delta:20,deltaKnown:false,activity:1,activityKnown:false});
  expect(controls.known).toEqual({marketCap:false,liquidity:false,holders:false,change:false,activity:false});
  expect(controls.rhythm.rate).toBe(1);
  expect(controls.harmony.musicality).toBe(.5);
  expect(controls.arpeggio).toEqual({population:.5,notes:3,span:18});
  expect(controls.change.signed).toBe(0);
  expect(controls.tempo.bpm).toBe(100);
 });

 it.each([null,undefined,'',NaN,Infinity,-1])('rejects an invalid size/count input %s',value=>{
  const controls=marketMusicalMapping({...active,marketCap:value,liquidity:value,holders:value});
  expect(controls.known).toMatchObject({marketCap:false,liquidity:false,holders:false});
  expect(controls.rhythm.rate).toBe(1);expect(controls.harmony.musicality).toBe(.5);
  expect(controls.arpeggio.notes).toBe(3);
 });

 it('does not mistake unlabelled normalized zeroes for available activity or percent change',()=>{
  const controls=marketMusicalMapping({observed:true,fresh:1,tradingActivity:1,activity:0,delta:0});
  expect(controls.known.activity).toBe(false);expect(controls.known.change).toBe(false);
  expect(controls.tempo.bpm).toBe(100);
 });

 it.each([{observed:false},{fresh:0},{tradingActivity:0},{tradingActivity:undefined}])
  ('cannot authorize sound from metadata when the activity gate is closed: %j',override=>{
   const controls=marketMusicalMapping({...active,marketCap:1e12,liquidity:1e12,holders:1e9,intensity:1,...override});
   expect(controls.active).toBe(false);expect(controls.excitation).toBe(0);
   expect(controls.tempo.activity).toBe(0);
  });

 it('is deterministic and leaves the supplied observation unchanged',()=>{
  const signal=Object.freeze({...active});
  const first=marketMusicalMapping(signal);
  for(let i=0;i<5;i++)expect(marketMusicalMapping(signal)).toEqual(first);
  expect(signal).toEqual(active);
 });
});
