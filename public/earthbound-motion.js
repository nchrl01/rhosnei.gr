import {suggestedLayers,layerMotion} from './earthbound-motion-presets.js?v=167';
export {suggestedLayers};
// A coin always keeps its preset. Market and audio control its continuous clock
// and deformation depth; the two source motions bend one shared pixel field.
export function battleMotion(seed,time,stage){
 const preset=suggestedLayers[(seed>>>0)%suggestedLayers.length];
 const amount=.8; // Stable preset depth; market cap never chooses or morphs it.
 return preset.layers.map(id=>{
  const effects=layerMotion[id];if(!effects)return [0,0,0,0];
  const duration=effects.reduce((s,e)=>s+e.duration,0);
  let frame=duration>0&&effects.every(e=>e.duration>0)?(Math.max(0,time)*60)%duration:Math.max(0,time)*60;
  let effect=effects[effects.length-1];
  for(const e of effects){effect=e;if(!e.duration||frame<e.duration)break;frame-=e.duration;}
  return [effect.type,Math.min(.065,Math.abs(effect.amplitude)/512/256)*amount,
   Math.max(2,Math.min(48,Math.abs(effect.frequency)*8*Math.PI/1024)),time*(.15+effect.speed/40)];
 });
}
export function battleWarp(x,y,motions){
 let dx=0,dy=0;
 for(const [type,amp,freq,phase] of motions){
  const offset=amp*Math.sin(y*freq+phase);
  if(type===3)dy+=offset;else dx+=offset*(type===2?Math.sin(y*freq*.5-phase*.3):1);
 }
 return [x+dx,y+dy];
}
export const battleGLSL=`
uniform vec4 uBattleA;
uniform vec4 uBattleB;
vec2 battleOffset(vec2 p,vec4 motion){
 float offset=motion.y*sin(p.y*motion.z+motion.w);
 if(motion.x>2.5)return vec2(0.,offset);
 return vec2(offset*(motion.x>1.5?sin(p.y*motion.z*.5-motion.w*.3):1.),0.);
}
vec2 battleWarp(vec2 p){return p+battleOffset(p,uBattleA)+battleOffset(p,uBattleB);}
`;
