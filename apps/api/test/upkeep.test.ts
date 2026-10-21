import {describe,expect,it} from 'vitest';
import {tierFor,shouldSignal,runwayDays,chargeFor} from '../src/upkeep';
const cost=20_000_000_000_000n; // 0.00002 ETH per day
describe('maintenance runway tiers',()=>{
 it('maps runway to cadence',()=>{
  expect(tierFor(cost*400n,cost)).toBe(0);
  expect(tierFor(cost*200n,cost)).toBe(1);
  expect(tierFor(cost*45n,cost)).toBe(2);
  expect(tierFor(cost*5n,cost)).toBe(3);
 });
 it('lets the shared pool hold an underfunded collection at weekly instead of hibernating',()=>{expect(tierFor(cost*5n,cost,true)).toBe(2);});
 it('charges less for slower cadence and nothing while hibernating',()=>{expect(chargeFor(0,cost)).toBe(cost);expect(chargeFor(1,cost)).toBe(cost/2n);expect(chargeFor(2,cost)).toBe(cost/7n);expect(chargeFor(3,cost)).toBe(0n);});
 it('computes runway in whole days',()=>{expect(runwayDays(cost*10n+1n,cost)).toBe(10);});
 it('signals live and daily every epoch, weekly every seventh, hibernation once',()=>{
  expect(shouldSignal(0,0,1)).toBe(true);expect(shouldSignal(1,1,2)).toBe(true);
  expect(shouldSignal(2,2,13)).toBe(false);expect(shouldSignal(2,2,14)).toBe(true);
  expect(shouldSignal(3,2,15)).toBe(true);expect(shouldSignal(3,3,16)).toBe(false);
 });
 it('primary maintenance share funds years of upkeep at testnet prices',()=>{
  // 100 editions, stepped tiers average 1.4375x of 0.002 ETH; 25% maintenance, 90% stays with the collection.
  const p0=2_000_000_000_000_000n,primary=p0*25n+p0*125n/100n*25n+p0*150n/100n*25n+p0*2n*24n; // editions 2..100 (genesis is free)
  const toCollection=primary*2500n/10000n*9n/10n;
  expect(runwayDays(toCollection,cost)).toBeGreaterThan(3000);
 });
});
