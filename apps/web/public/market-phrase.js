import {REFERENCE_FUNCTIONS} from './math-reference-functions.js?v=85';
import {REEL_FUNCTIONS} from './math-reel-functions.js?v=152';
// One phrase source for every GB timbre. All voices read the same score beat;
// there are no separate function clocks or market-cap unlock queues.
export const MARKET_PHRASE_SHAPES=[...REEL_FUNCTIONS,...REFERENCE_FUNCTIONS];
const unit=value=>Math.max(0,Math.min(1,Number(value)||0));
const hash=value=>{let n=Math.imul((value>>>0)^0x9e3779b9,0x85ebca6b);n^=n>>>13;return Math.imul(n,0xc2b2ae35)>>>0;};
export function marketPhraseIdentity(seed,shape=-1){
 const index=Number.isInteger(shape)&&shape>=0&&shape<MARKET_PHRASE_SHAPES.length?shape:hash(seed)%MARKET_PHRASE_SHAPES.length;
 return MARKET_PHRASE_SHAPES[index];
}
export function marketPhrasePoint(seed,scoreBeat,options={}){
 const length=Math.max(4,Math.min(16,Number(options.phraseLength)||8));
 const phase=((Number(scoreBeat)||0)%length+length)%length/length;
 const shape=marketPhraseIdentity(seed,options.phraseShape);
 const [low,high]=shape.graphRange;
 let value=0,gate=0,weight=0;
 // Sample a small neighbourhood so poles, steps and sharp turns become a
 // playable contour. Undefined graph segments never become invalid pitches.
 for(const offset of [-.012,-.006,0,.006,.012]){
  const p=Math.max(0,Math.min(1-1e-9,phase+offset));
  const [raw,envelope]=shape.sample(p);
  if(!Number.isFinite(raw)||!(envelope>0))continue;
  value+=unit((raw-low)/(high-low));gate+=unit(envelope*2);weight++;
 }
 return {id:shape.id,name:shape.name,phase,length,value:weight?value/weight:.5,gate:weight?gate/weight:0};
}
export function marketPhraseTone(seed,beat,index,count,options={}){
 const point=marketPhrasePoint(seed,beat,options),t=count<2?.5:index/(count-1);
 const depth=options.phraseDepth==null?1:unit(options.phraseDepth);
 const position=unit(t+(point.value-.5)*.8*depth*Math.sin(Math.PI*t));
 const articulation=options.phraseGate==null?.8:Math.max(.2,Math.min(1,Number(options.phraseGate)||.2));
 return {...point,position,accent:.7+.3*point.gate,duration:articulation*(.65+.35*point.gate)};
}
