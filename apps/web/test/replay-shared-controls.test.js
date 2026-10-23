import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,expect,it,vi} from 'vitest';
import {createMarketReplay,candleEnd,scoreCandle} from '../public/market-replay.js';
import {createCompositionTimeline} from '../public/chip-timeline.js';
import {marketPerformance} from '../public/market-performance.js';
import {marketChipSignal,chipSignalActive} from '../public/market-chip-score.js';
import {earthboundMarketState} from '../public/upic-earthbound-visual.js';

const interval=60000;
const first={time:0,open:10,high:11,low:10,close:11,volume:600};
const second={time:interval,open:11,high:12,low:11,close:12,volume:1200};
const market={marketCap:1000,priceUsd:10};
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const replayPianoSource=app.slice(app.indexOf('function replayPiano(m){'),app.indexOf('function tick(){'));

// Run the app's real replay-to-audio adapter with only its playback boundary
// replaced. This exercises lazy control selection without a browser or APU.
function audioTimelineFor(replay,bars=[first,second]){
 let timeline;
 const piano={setTimeline:vi.fn(segments=>{timeline=createCompositionTimeline(segments,50);}),seekTimeline:vi.fn(),syncTimeline:vi.fn()};
 const scope={playing:true,replay,piano,pianoEnabled:true,ctx:{state:'running'},replayPianoPrimed:false,
  chart:{renderedBars:bars,interval},market,replayPianoCursor:null,candleEnd,scoreCandle,marketPerformance,
  replayObservationForBar:undefined,pianoMusic:(metrics,music=metrics.music)=>({...music,activity:metrics.activity,tonic:60})};
 return {piano,scope,start(selectObservation){
  scope.replayObservationForBar=selectObservation;
  vm.runInNewContext(replayPianoSource+'\nreplayPiano();',scope);
  return timeline;
 }};
}

describe('frozen replay controls shared by the audio score and visuals',()=>{
 it('resolves the app audio segments lazily from the exact recorded observation used by visuals',async()=>{
  const {replayObservationForBar}=await import('../public/market-replay.js');
  const replay=createMarketReplay();
  const observation={source:'trades',observed:true,fresh:.8,tradingActivity:.35,activity:.6,volume:.4,motion:.2,
   balance:.7,tradeRate:2,decoded:true,availability:{volume:true,balance:true,tradeRate:true},
   music:{tempo:108,intensity:.45},context:{latestCap:1100,path:[{time:59500,close:11}]}};
  replay.record(observation,11,59500);replay.freeze([first,second],market,interval);replay.seek(first,interval);
  replay.state.score={frames:new Map([[first.time,{music:{tempo:199,intensity:1},activity:1}]])};
  const controls=vi.spyOn(replay,'controlsForBar'),adapter=audioTimelineFor(replay);
  const timeline=adapter.start(replayObservationForBar);
  expect(controls).not.toHaveBeenCalled();
  const resolved=timeline.contextAtBeat(0);
  expect(controls).toHaveBeenCalledOnce();
  const visualMetrics=replay.metrics([],null,interval);
  expect(resolved.metrics).toEqual(visualMetrics);
  expect(resolved.metrics.replay).toMatchObject({source:'observed',at:59500,price:11});
  expect(resolved.music).toMatchObject({tempo:108,intensity:.45,activity:.6});
  expect(resolved.active).toBe(true);
  const audio=marketChipSignal(resolved),visual=earthboundMarketState(visualMetrics);
  expect(audio.tradingActivity).toBe(visual.tradingActivity);
  expect(audio.fresh).toBe(visual.fresh);
  expect(audio.marketCap).toBe(visual.marketCap);
  // The adapter resolves each visited segment once; it does not recompute
  // controls on each audio scheduling tick or eagerly visit later candles.
  const calls=controls.mock.calls.length;
  expect(timeline.contextAtBeat(.1).metrics).toBe(resolved.metrics);
  expect(controls).toHaveBeenCalledTimes(calls);
 });

 it.each([{volume:0,active:false},{volume:undefined,active:true}])
  ('shares candle activity while preserving known zero versus unknown volume: %j',async({volume,active})=>{
   const {replayObservationForBar}=await import('../public/market-replay.js');
   const replay=createMarketReplay(),bar={...first,volume};
   replay.freeze([bar],market,interval);replay.seek(bar,interval);
   const timeline=audioTimelineFor(replay,[bar]).start(replayObservationForBar);
   const resolved=timeline.contextAtBeat(0),visualMetrics=replay.metrics([],null,interval);
   expect(resolved.metrics).toEqual(visualMetrics);
   expect(resolved.metrics.availability).toMatchObject({volume:volume!==undefined,balance:false,liquidity:false});
   expect(resolved.active).toBe(active);
   const audio=marketChipSignal(resolved),visual=earthboundMarketState(visualMetrics);
   expect(chipSignalActive(audio)).toBe(active);
   expect(visual.tradingActivity).toBe(Number(active));
   expect(audio).toMatchObject({balance:.5,balanceKnown:false,tradeRate:0,tradeRateKnown:false});
  });

 it.each([false,true])('isolates an older frozen cache from a new snapshot, previously resolved=%s',cached=>{
  const replay=createMarketReplay();replay.freeze([first],market,interval);
  const older=replay.state.frozen;
  if(cached)replay.controlsForBar(first,undefined,older);
  const updated={...first,close:12,high:12,volume:0};
  replay.freeze([updated],{marketCap:2000,priceUsd:10},interval);
  const newer=replay.state.frozen,newControls=replay.controlsForBar(updated);
  expect(newControls.replay).toMatchObject({price:12,volume:0});
  expect(newControls.context.latestCap).toBe(2400);
  const oldControls=replay.controlsForBar(first,undefined,older);
  expect(oldControls.replay).toMatchObject({price:11,volume:600});
  expect(oldControls.context.latestCap).toBe(1100);
  expect(replay.controlsForBar(updated,undefined,newer)).toEqual(newControls);
  // A consumer may annotate its copy; neither snapshot's cached controls
  // may inherit those annotations or future market values.
  oldControls.context.latestCap=-1;oldControls.music.tempo=999;oldControls.replay.volume=-1;
  expect(replay.controlsForBar(first,undefined,older).context.latestCap).toBe(1100);
  expect(replay.controlsForBar(first,undefined,older).replay.volume).toBe(600);
  expect(replay.controlsForBar(updated,undefined,newer)).toEqual(newControls);
 });

 it('keeps an existing audio resolver tied to its captured snapshot after a new freeze',async()=>{
  const {replayObservationForBar}=await import('../public/market-replay.js');
  const replay=createMarketReplay();replay.freeze([first],market,interval);replay.seek(first,interval);
  const oldTimeline=audioTimelineFor(replay,[first]).start(replayObservationForBar);
  const updated={...first,close:15,high:15,volume:0};
  replay.freeze([updated],{marketCap:2000,priceUsd:10},interval);replay.seek(updated,interval);
  // Resolve old audio for the first time only after the new cache exists.
  expect(oldTimeline.contextAtBeat(0).metrics.replay).toMatchObject({price:11,volume:600});
  expect(replay.metrics([],null,interval).replay).toMatchObject({price:15,volume:0});
 });

 it('never substitutes a future observation or an unfinished candle',()=>{
  const replay=createMarketReplay();
  replay.record({activity:1,fresh:1,tradingActivity:1,context:{latestCap:9999}},11,61000);
  replay.freeze([first],market,interval);
  expect(replay.controlsForBar(first,59999)).toBeNull();
  expect(replay.controlsForBar(first,60000).replay).toMatchObject({source:'candles',price:11,at:60000});
  expect(replay.controlsForBar(first,60000).context.latestCap).toBe(1100);
 });
});

describe('lazy chip timeline clock integrity',()=>{
 it.each([1,50,100])('keeps the precomputed score clock at %s× while resolving only visited rows',rate=>{
  const firstResolve=vi.fn(()=>({music:{tempo:199},metrics:{price:11},active:true,
   start:-1,end:Infinity,tempo:999,audibleTempo:999,beat:999,endBeat:999}));
  const secondResolve=vi.fn(()=>({music:{tempo:25},metrics:{price:12},active:false,
   start:-2,end:Infinity,tempo:888,audibleTempo:888,beat:888,endBeat:888}));
  const timeline=createCompositionTimeline([
   {start:60000,end:120000,music:{tempo:100},resolve:firstResolve},
   {start:120000,end:180000,music:{tempo:120},resolve:secondResolve},
  ],rate);
  const clocks=timeline.rows.map(({start,end,tempo,audibleTempo,beat,endBeat})=>({start,end,tempo,audibleTempo,beat,endBeat}));
  for(const at of [60000,90000,120000,150000,180000])expect(timeline.atBeat(timeline.beatAt(at))).toBeCloseTo(at,8);
  expect(firstResolve).not.toHaveBeenCalled();expect(secondResolve).not.toHaveBeenCalled();
  expect(timeline.contextAtBeat(0)).toMatchObject({...clocks[0],metrics:{price:11},music:{tempo:199},active:true});
  expect(firstResolve).toHaveBeenCalledOnce();expect(secondResolve).not.toHaveBeenCalled();
  expect(timeline.contextAtBeat(clocks[1].beat)).toMatchObject({...clocks[1],metrics:{price:12},music:{tempo:25},active:false});
  expect(secondResolve).toHaveBeenCalledOnce();
  expect(timeline.rows.map(({start,end,tempo,audibleTempo,beat,endBeat})=>({start,end,tempo,audibleTempo,beat,endBeat}))).toEqual(clocks);
  for(const at of [60000,90000,120000,150000,180000])expect(timeline.atBeat(timeline.beatAt(at))).toBeCloseTo(at,8);
 });
 it('has no unresolved data work or context for an empty timeline',()=>{
  const timeline=createCompositionTimeline([],50);
  expect(timeline.contextAtBeat(0)).toBeUndefined();expect(timeline.beatAt(1000)).toBe(0);expect(timeline.atBeat(1)).toBe(0);
 });
});
