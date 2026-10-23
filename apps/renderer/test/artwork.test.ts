import {describe,it,expect} from 'vitest';import {assertArtwork} from '@upic/domain';
describe('renderer input isolation',()=>{it('rejects unversioned or malformed job input',()=>{expect(()=>assertArtwork({seed:'0x00',stage:9,seconds:20,engineVersion:'upic-nft-gb-v6',frames:[]})).toThrow();});});
