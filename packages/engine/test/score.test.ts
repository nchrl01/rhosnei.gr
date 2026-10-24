import {describe,it,expect} from 'vitest';import {score,componentSeed} from '../src';import type {ArtworkInput} from '@upic/domain';
const input:ArtworkInput={seed:('0x'+'ab'.repeat(32)) as `0x${string}`,engineVersion:'upic-nft-gb-v10',stage:0,seconds:20,frames:[{chain:'base',token:'0x'+'00'.repeat(20),at:0,priceUsd:'1',marketCapUsd:'100000',liquidityUsd:'50000',volumeUsd:'50000',source:'fixture',stale:false,simulated:true}]};
describe('deterministic NFT score',()=>{
 it('reproduces the same score independently of wall-clock time',()=>expect(score(input)).toEqual(score(structuredClone(input))));
 it('uses full-seed component domains',()=>expect(componentSeed(input.seed,'music')).not.toBe(componentSeed(input.seed,'visual')));
 it('gates unlocked musical layers',()=>{expect(score(input).some(n=>n.kind==='bass')).toBe(false);expect(score({...input,stage:3}).some(n=>n.kind==='bass')).toBe(true);expect(score({...input,stage:3}).some(n=>n.kind==='drum')).toBe(true);});
});
