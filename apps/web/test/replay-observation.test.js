import {describe,it,expect} from 'vitest';
import {createMarketReplay,candleEnd} from '../public/market-replay.js';
const interval=60000;
const bar={time:60000,open:10,high:12,low:10,close:12,observedThrough:80000,lastAt:90000};
const market={marketCap:1200,priceUsd:12};
const inputs={context:{latestCap:1100,path:[]}};
describe('replay endpoint consistency',()=>{
 it('includes live observations extending provider coverage',()=>expect(candleEnd(bar,interval)).toBe(90000));
 it('rejects a nearby observation with a different price',()=>{
  const r=createMarketReplay();r.record(inputs,11,89000);r.freeze([bar],market,interval);r.seek(bar,interval);
  const m=r.metrics([],null,interval);expect(m.replay.source).toBe('candles');expect(m.replay.price).toBe(12);expect(m.context.latestCap).toBe(1200);
 });
 it('records price changes within the one-second sampling window',()=>{
  const r=createMarketReplay();r.record(inputs,11,89000);r.record({context:{latestCap:1200,path:[]}},12,89500);r.freeze([bar],market,interval);r.seek(bar,interval);
  const m=r.metrics([],null,interval);expect(m.replay.source).toBe('observed');expect(m.context.latestCap).toBe(1200);
 });
 it('refreshes candle controls between frozen replays',()=>{
  const r=createMarketReplay();r.freeze([bar],market,interval);r.seek(bar,interval);expect(r.metrics([],null,interval).replay.price).toBe(12);
  r.live();const updated={...bar,close:13,high:13};r.freeze([updated],market,interval);r.seek(updated,interval);expect(r.metrics([],null,interval).replay.price).toBe(13);
 });
});
