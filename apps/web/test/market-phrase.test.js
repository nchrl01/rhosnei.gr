import {describe,expect,it} from 'vitest';
import {MARKET_PHRASE_SHAPES,marketPhraseIdentity,marketPhrasePoint,marketPhraseTone} from '../public/market-phrase.js';
import {composeMarketBar,createCompositionTimeline} from '../public/market-composition.js';
const context={active:true,cap:1e6,music:{tempo:100,intensity:.65,activity:.8,group:'up',character:'serene'}};

describe('one market phrase behind the GB instruments',()=>{
 it('keeps one identity per coin and repeats on the shared phrase clock',()=>{
  for(const seed of [1,1917,987654]){
   const selected=marketPhraseIdentity(seed);
   for(const beat of [0,.5,1.25,3.5,7.75]){
    const a=marketPhrasePoint(seed,beat),b=marketPhrasePoint(seed,beat+8);
    expect(a.id).toBe(selected.id);expect(b.value).toBeCloseTo(a.value,10);expect(b.gate).toBeCloseTo(a.gate,10);
   }
  }
 });
 it('bounds every legacy function into playable pitch, expression and note gates',()=>{
  for(let shape=0;shape<MARKET_PHRASE_SHAPES.length;shape++)for(let i=0;i<64;i++){
   const point=marketPhraseTone(1917,i/8,i%8,8,{phraseShape:shape});
   for(const field of ['phase','value','gate','position','accent','duration']){
    expect(Number.isFinite(point[field])).toBe(true);expect(point[field]).toBeGreaterThanOrEqual(0);expect(point[field]).toBeLessThanOrEqual(1);
   }
  }
 });
 it('uses the function to shape the actual GB score while preserving shared rhythm and harmony',()=>{
  const a=composeMarketBar(1917,0,{...context,phraseLearning:0,phraseShape:0}),b=composeMarketBar(1917,0,{...context,phraseLearning:0,phraseShape:1});
  const melody=score=>score.events.filter(event=>event.kind==='arp');
  expect(a.harmony).toEqual(b.harmony);expect(melody(a).map(event=>event.beat)).toEqual(melody(b).map(event=>event.beat));
  expect(melody(a)).not.toEqual(melody(b));
  const pcs=new Set(a.harmony.notes.map(note=>note%12));
  for(const score of [a,b])for(const note of melody(score))expect(pcs.has(note.midi%12)).toBe(true);
  const short=composeMarketBar(1917,0,{...context,phraseLearning:0,phraseGate:.2}),long=composeMarketBar(1917,0,{...context,phraseLearning:0,phraseGate:1});
  expect(melody(short).every((note,i)=>note.duration<melody(long)[i].duration)).toBe(true);
 });
 it('reconstructs the same contour after 1× and accelerated replay seeks, and stays silent without activity',()=>{
  const segments=[{...context,start:0,end:600000}];
  for(const rate of [1,50,100]){
   const timeline=createCompositionTimeline(segments,rate),at=timeline.atBeat(6.25);
   expect(marketPhrasePoint(1917,timeline.beatAt(at)).value).toBeCloseTo(marketPhrasePoint(1917,6.25).value,10);
   expect(composeMarketBar(1917,2,{...context,active:false}).events).toEqual([]);
  }
 });
});
