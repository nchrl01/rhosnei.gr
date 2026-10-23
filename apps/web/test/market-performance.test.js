import {describe,expect,it} from 'vitest';
import {marketPerformance,marketActivityDecay} from '../public/market-performance.js';
import {marketChipSignal,chipSignalActive,composeChipBar} from '../public/market-chip-score.js';
import {earthboundMarketState} from '../public/upic-earthbound-visual.js';
import {chipEnsembleArrangement} from '../public/chip-ensemble-arrangement.js';

const busy={source:'trades',observed:true,fresh:1,price:101,referencePrice:100,
 activity:.8,volume:.7,motion:.6,tradeRate:4,balance:.7,tradingActivity:1,
 availability:{volume:true,tradeRate:true,balance:true},music:{activity:.8,intensity:.9,lastMove:3}};
const seed=1917;

describe('one observed market state for sound and visual motion',()=>{
 it('lets an explicit zero live-activity envelope override old positive aggregates',()=>{
  const metrics={...busy,tradingActivity:0};
  const performance=marketPerformance(metrics),signal=marketChipSignal({metrics});
  expect(performance).toMatchObject({tradingActivity:0,excitation:0,activity:.8,volume:.7,motion:.6});
  expect(chipSignalActive(signal)).toBe(false);
  expect(earthboundMarketState(metrics).tradingActivity).toBe(0);
  for(let bar=0;bar<8;bar++)expect(composeChipBar(seed,bar,{metrics}).events).toEqual([]);
  expect(Object.values(chipEnsembleArrangement(seed,2,signal).roleGains).every(gain=>gain===0)).toBe(true);
 });

 it.each([0,.2,.7,1])('shares the same live envelope with both engines at %s',tradingActivity=>{
  const metrics={...busy,tradingActivity,fresh:.6};
  const performance=marketPerformance(metrics),signal=marketChipSignal({metrics}),visual=earthboundMarketState(metrics);
  expect(signal.tradingActivity).toBe(performance.tradingActivity);
  expect(visual.tradingActivity).toBe(performance.tradingActivity);
  expect(visual.fresh).toBe(signal.fresh);
  expect(signal.excitation).toBeCloseTo(.6*tradingActivity,12);
  expect(chipSignalActive(signal)).toBe(tradingActivity>0);
 });

 it.each([{observed:false},{fresh:0}])('cannot play unobserved or stale data: %j',override=>{
  const metrics={...busy,...override};
  expect(chipSignalActive(marketChipSignal({metrics}))).toBe(false);
  expect(composeChipBar(seed,0,{metrics}).events).toEqual([]);
 });

 it('cannot manufacture activity from market cap, liquidity, intensity, or pressure',()=>{
  const metrics={observed:true,fresh:1,price:100,context:{latestCap:1e9,pressure:1},
   observation:{liquidity:1e8},music:{intensity:1}};
  expect(marketPerformance(metrics)).toMatchObject({marketCap:1e9,liquidity:1e8,intensity:1,pressure:1,tradingActivity:0,excitation:0});
  expect(composeChipBar(seed,0,{metrics}).events).toEqual([]);
 });

 it('uses the actual price change ahead of an old musical summary',()=>{
  expect(marketPerformance({...busy,price:99,referencePrice:100})).toMatchObject({direction:-1});
  expect(marketPerformance({...busy,price:99,referencePrice:100}).delta).toBeCloseTo(-1,12);
  expect(marketPerformance({...busy,price:100,referencePrice:100})).toMatchObject({delta:0,direction:0});
 });

 it('preserves unknown measurements instead of interpreting them as buy pressure or trade counts',()=>{
  const unknown=marketPerformance({...busy,balance:1,tradeRate:10,
   availability:{volume:false,balance:false,tradeRate:false}});
  expect(unknown).toMatchObject({volume:0,volumeKnown:false,balance:.5,balanceKnown:false,tradeRate:0,tradeRateKnown:false});
  expect(marketPerformance({observed:true})).toMatchObject({balance:.5,balanceKnown:false,tradeRate:0,tradeRateKnown:false,marketCap:null,liquidity:null});
 });

 it('bounds amplitudes and handles absent or nonfinite measurements',()=>{
  expect(marketPerformance({...busy,activity:3,volume:-4,motion:Infinity,fresh:2,tradingActivity:4,balance:-1}))
   .toMatchObject({activity:1,volume:0,motion:0,fresh:1,tradingActivity:1,balance:0});
  expect(marketPerformance({price:NaN,activity:NaN,volume:Infinity,motion:NaN}))
   .toMatchObject({observed:false,excitation:0,volumeKnown:false,marketCap:null,liquidity:null});
 });
});

describe('honest candle activity',()=>{
 const candle={...busy,source:'snapshots',replay:{source:'candles',price:101},decoded:true};
 it.each([0,-1,'0'])('explicit candle volume %s stays silent despite price motion and old activity',volume=>{
  const metrics={...candle,replay:{...candle.replay,volume}};
  expect(marketPerformance(metrics)).toMatchObject({source:'candles',tradingActivity:0,excitation:0});
  expect(composeChipBar(seed,0,{metrics}).events).toEqual([]);
  expect(earthboundMarketState(metrics).tradingActivity).toBe(0);
 });
 it('accepts positive observed volume as an aggregate proxy without inventing a side or count',()=>{
  expect(marketPerformance({...candle,replay:{...candle.replay,volume:20}}))
   .toMatchObject({tradingActivity:1,balance:.5,balanceKnown:false,tradeRate:0,tradeRateKnown:false});
 });
 it.each([{motion:.2,price:100,referencePrice:100},{motion:0,price:101,referencePrice:100}])
  ('allows observed motion when candle volume is unknown: %j',movement=>{
   const metrics={...candle,...movement,availability:{volume:false},replay:{source:'candles'},volume:null};
   expect(marketPerformance(metrics)).toMatchObject({tradingActivity:1,volumeKnown:false});
   expect(earthboundMarketState(metrics).tradingActivity).toBe(1);
  });
 it('keeps a flat candle silent when volume is unknown',()=>{
  expect(marketPerformance({...candle,price:100,referencePrice:100,motion:0,volume:null,
   availability:{volume:false},replay:{source:'candles'}})).toMatchObject({tradingActivity:0,excitation:0});
 });
 it('distinguishes explicit normalized zero volume from missing volume',()=>{
  expect(marketPerformance({...candle,volume:0,replay:{source:'candles'}}).tradingActivity).toBe(0);
  expect(marketPerformance({...candle,volume:null,replay:{source:'candles'}}).tradingActivity).toBe(1);
 });
});

describe('finite release after the market input stops',()=>{
 it('holds two seconds, releases continuously, and is fully silent at thirty seconds',()=>{
  expect(marketActivityDecay(0)).toBe(1);
  expect(marketActivityDecay(2)).toBe(1);
  expect(marketActivityDecay(10)).toBeCloseTo(Math.exp(-1),12);
  expect(marketActivityDecay(29.999)).toBeGreaterThan(0);
  expect(marketActivityDecay(30)).toBe(0);
  expect(marketActivityDecay(60)).toBe(0);
  const samples=Array.from({length:61},(_,i)=>marketActivityDecay(i/2));
  expect(samples.every((value,i)=>value>=0&&value<=1&&(i===0||value<=samples[i-1]))).toBe(true);
 });
 it.each([-1,NaN,Infinity,undefined,null,''])('rejects an invalid observation age: %s',age=>{
  expect(marketActivityDecay(age)).toBe(0);
 });
});

describe('market-admitted chip scoring',()=>{
 it('keeps chord-free bars even in a busy market',()=>{
  for(const coinSeed of [1,1917,987654]){
   const scores=Array.from({length:32},(_,bar)=>composeChipBar(coinSeed,bar,{metrics:busy}));
   const chordBars=scores.flatMap((score,bar)=>score.events.some(event=>event.kind.startsWith('chord_'))?[bar]:[]);
   expect(chordBars.length).toBeGreaterThan(0);
   expect(chordBars.length).toBeLessThanOrEqual(16);
   expect(chordBars.every((bar,index)=>index===0||bar-chordBars[index-1]>=2)).toBe(true);
  }
 });
 it('changes expression without changing the coin harmonic identity or rerolling an unchanged observation',()=>{
  const first=composeChipBar(seed,2,{metrics:busy});
  expect(composeChipBar(seed,2,{metrics:{...busy}})).toEqual(first);
  const quiet=composeChipBar(seed,2,{metrics:{...busy,tradingActivity:.2,activity:.1,volume:.1,motion:.05}});
  expect(quiet.harmony).toEqual(first.harmony);
 });
});
