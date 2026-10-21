import {describe,it,expect} from 'vitest';import {canonicalToken,units,decimal,stageFor,primarySplit,secondarySplit,CHAINS,USD_SCALE} from '../src';
describe('protocol rules',()=>{
 it('keeps financial decimal strings exact',()=>{expect(units('0.05',18)).toBe(50000000000000000n);expect(decimal(units('123456789.12345678'))).toBe('123456789.12345678');expect(()=>units('1.000000001')).toThrow();});
 it('unlocks every crossed stage including jumps',()=>{expect(stageFor(99999n*USD_SCALE)).toBe(0);expect(stageFor(10000000n*USD_SCALE)).toBe(6);expect(stageFor(50000000n*USD_SCALE)).toBe(8);});
 it('preserves exact accounting for arbitrary wei prices',()=>{for(const value of [1n,449n,10001n,10n**18n]){const p=primarySplit(value),s=secondarySplit(value);expect(p.buyback+p.initiator+p.protocol+p.maintenance).toBe(value);expect(s.seller+s.buyback+s.initiator+s.protocol+s.maintenance).toBe(value);}});
 it('keeps ten intended chains and canonicalizes EVM identities',()=>{expect(CHAINS).toHaveLength(10);expect(CHAINS.some(c=>c.id==='arbitrum')).toBe(true);expect(canonicalToken('base','0x'+'AB'.repeat(20))).toBe('0x'+'ab'.repeat(20));expect(()=>canonicalToken('base','not-an-address')).toThrow();});
});
