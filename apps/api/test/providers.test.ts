import {describe,it,expect,vi,afterEach} from 'vitest';import {dexSnapshots,recentTrades} from '../src/providers';import type {Env} from '../src/env';
afterEach(()=>vi.unstubAllGlobals());
describe('market providers',()=>{
 it('never mistakes a quote-token cap for the requested token',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json([{chainId:'base',baseToken:{address:'0x'+'22'.repeat(20)},quoteToken:{address:'0x'+'11'.repeat(20)},marketCap:50000000,priceUsd:'100',liquidity:{usd:1000000}}])));
  const frames=await dexSnapshots('base',['0x'+'11'.repeat(20)],async()=>{});expect(frames[0]!.marketCapUsd).toBeNull();expect(frames[0]!.stale).toBe(true);
 });
 it('does not retry or pay when OKX returns a payment requirement',async()=>{
  const fetcher=vi.fn(async()=>new Response('',{status:402}));vi.stubGlobal('fetch',fetcher);
  const env={OKX_API_KEY:'test',OKX_SECRET:'test',OKX_PASSPHRASE:'test'} as Env;
  await expect(recentTrades(env,'base','0x'+'11'.repeat(20),async()=>{})).rejects.toThrow('free-quota-exhausted');expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('preserves case-sensitive non-EVM token identities',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json([{chainId:'solana',baseToken:{address:'AbCd'},marketCap:50000000,priceUsd:'100'}])));
  expect((await dexSnapshots('solana',['abcd'],async()=>{}))[0]!.stale).toBe(true);
 });
});
