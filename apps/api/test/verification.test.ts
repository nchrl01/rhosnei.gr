import {describe,it,expect,vi,afterEach} from 'vitest';import {WitnessRPC,ratioAtTick} from '../src/verification';
afterEach(()=>vi.unstubAllGlobals());
describe('source verification boundary',()=>{
 it('rejects correlated RPC hostname configuration',()=>expect(()=>new WitnessRPC(['https://same.test/a','https://same.test/b'],async()=>{})).toThrow('independent'));
 it('rejects disagreement rather than choosing a convenient price',async()=>{vi.stubGlobal('fetch',vi.fn((url:string)=>Promise.resolve(Response.json([{id:1,result:url.includes('one')?'0x01':'0x02'}]))));const rpc=new WitnessRPC(['https://one.test','https://two.test'],async()=>{});await expect(rpc.query('eth_call',[])).rejects.toThrow('disagreement');});
 it('charges failed requests before I/O',async()=>{const charge=vi.fn(async()=>{});vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:429})));const rpc=new WitnessRPC(['https://one.test','https://two.test'],charge);await expect(rpc.query('eth_call',[])).rejects.toThrow();expect(charge).toHaveBeenCalledWith(2);});
 it('handles inverse tick ratios and the supported extremes',()=>{const q=ratioAtTick(0);expect(ratioAtTick(887272)).toBeGreaterThan(q);expect(ratioAtTick(-887272)).toBeGreaterThan(0n);expect(ratioAtTick(1)*ratioAtTick(-1)/q).toBeLessThanOrEqual(q);});
});
