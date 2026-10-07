import {backgroundMetadata} from './earthbound-layer-metadata.js?v=214';
// Each labeled draw hashes the complete chain/address, so parameters are not
// derived from a small preset index. Numeric lab seeds use the same generator.
const cache=new Map();
function draw(key,label){
 let a=2166136261,b=0x9e3779b9;
 for(const c of key+':'+label){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b^c.charCodeAt(0),2246822507);}
 a=Math.imul(a^(a>>>16)^b,3266489909);return ((a^(a>>>16))>>>0)/4294967296;
}
export function earthboundVisualSeed(value=0){
 const key=String(value),stored=cache.get(key);if(stored)return stored;
 const r=label=>draw(key,label),a=1+Math.floor(r('layer-a')*326);
 let b=1+Math.floor(r('layer-b')*326);if(b===a)b=b%326+1;
 const layers=[a,b].map((id,index)=>{
  const meta=backgroundMetadata[id],q=label=>r(index+':'+label),sign=label=>q(label)<.5?-1:1;
  return {id,meta,
   kind:(meta[0]+Math.floor(q('motif')*12))%12,
   frequency:2.2+q('frequency')*7.5,
   angle:Math.floor(q('orientation')*16)*Math.PI/8+(q('tilt')-.5)*.14,
   aspect:.55+q('aspect')*1.7,
   mirror:Math.floor(q('tile-flips')*4),
   cycle:meta[3]||1+Math.floor(q('cycle')*3),
   cycleRate:sign('cycle-direction')*(.05+.22*q('cycle-rate')),
   levels:meta[2]===2?4:8+Math.floor(q('palette-bands')*9),
   phase:q('phase')*Math.PI*2,
   scroll:[sign('scroll-x')*(.003+.02*q('scroll-x-rate')),sign('scroll-y')*(.002+.015*q('scroll-y-rate'))],
   stretch:.72+.65*q('stretch'),motionRate:.4+.7*q('motion-rate'),motionDepth:.6+.8*q('motion-depth'),
   bands:18+Math.floor(q('interlace-width')*64),
  };
 });
 const profile={key,layers,mix:.3+.4*r('mix'),blend:Math.floor(r('blend')*3),contrast:.78+.45*r('contrast'),bias:.02+.12*r('coverage'),patternStage:Math.floor(r('family')*7)};
 cache.set(key,profile);if(cache.size>64)cache.delete(cache.keys().next().value);return profile;
}
export function layerCycle(layer,time){
 const rate=layer.cycleRate*60/Math.max(6,layer.meta[8]||20);
 const phase=layer.phase+time*rate;
 return [layer.mirror,layer.cycle,phase,layer.levels];
}
