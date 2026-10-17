import {earthboundVisualSeed} from './earthbound-visual-seed.js?v=214';
export {suggestedLayers} from './earthbound-motion-presets.js?v=167';
const mod=(n,m)=>((n%m)+m)%m;
const int16=n=>mod(Math.trunc(n)+32768,65536)-32768;
const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
// Exact sequence selection and signed-register accumulation from the reference;
// displacement is bounded for a fluid, full-screen mark field.
export function battleMotion(seed,time){
 return earthboundVisualSeed(seed).layers.map(layer=>{
  const effects=layer.meta[9];let elapsed=Math.max(0,time)*60*layer.motionRate;
  let total=0,terminal=false;for(const e of effects){if(!e[1]){terminal=true;break;}total+=e[1];}
  if(!terminal&&total>0)elapsed=mod(elapsed,total);
  let effect=effects.at(-1);
  for(const e of effects){effect=e;if(!e[1]||elapsed<e[1])break;elapsed-=e[1];}
  const [type,,frequency,amplitude,compression,frequencyAcceleration,amplitudeAcceleration,speed,compressionAcceleration]=effect;
  const amp=bound(int16(amplitude+amplitudeAcceleration*elapsed)/512/256*layer.motionDepth,-.16,.16);
  const freq=int16(frequency+frequencyAcceleration*elapsed)*8*Math.PI/1024;
  const phase=layer.phase+Math.PI/60*speed*elapsed/2;
  const squeeze=bound((1+int16(compression+compressionAcceleration*elapsed)/256)*layer.stretch,.35,3);
  return [type,amp,freq,phase,squeeze,time*layer.scroll[0],time*layer.scroll[1],layer.bands];
 });
}
export function battleWarp(x,y,motions){
 for(const [type,amp,freq,phase,compression=1,sx=0,sy=0,bands=32] of motions){
  x+=sx;y+=sy;
  const offset=amp*Math.sin(y*freq+phase);
  if(type===3)y=y*compression+offset;
  else x+=offset*(type===2?(mod(Math.floor(y*bands),2)<1?-1:1):1);
 }
 return [x,y];
}
export const battleGLSL=`
uniform vec4 uBattleA;
uniform vec4 uBattleB;
uniform vec4 uBattleFlowA;
uniform vec4 uBattleFlowB;
vec2 battleLayerWarp(vec2 p,vec4 motion,vec4 flow){
 p+=flow.yz;
 float offset=motion.y*sin(p.y*motion.z+motion.w);
 if(motion.x>2.5)p.y=p.y*flow.x+offset;
 else p.x+=offset*(motion.x>1.5?(mod(floor(p.y*flow.w),2.)<1.?-1.:1.):1.);
 return p;
}
vec2 battleWarp(vec2 p){return battleLayerWarp(battleLayerWarp(p,uBattleA,uBattleFlowA),uBattleB,uBattleFlowB);}
`;
