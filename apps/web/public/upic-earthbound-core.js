// UPIC mathematical motifs with address-derived, explicit motion controls.
// Original reference files remain unchanged under upic-source/ (GitHub cfa8f65).
import {createPatternProfile,layerCycle,layerMotion,battlePatternNames,battlePatternGLSL,battleGLSL} from './upic-pattern-vocabulary.js?v=earthbound-2';
export {battlePatternNames};
export const EARTHBOUND_DEFAULTS={mode:'monogrid',layers:[{},{}],mix:null,blend:null,contrast:null,bias:null,scale:.25,feedbackMix:.35,mark:'auto',density:1.225,ecosystem:.28};
const bound=(v,a,b)=>Math.max(a,Math.min(b,v));
const value=(candidate,fallback,min,max,integer=false)=>{
 const n=candidate===null||candidate===undefined?fallback:Number(candidate),v=bound(Number.isFinite(n)?n:fallback,min,max);return integer?Math.round(v):v;
};
export function earthboundProfile(key,settings={}){
 const base=createPatternProfile(key),layers=base.layers.map((l,i)=>{
  const o=settings.layers?.[i]||{},n=(name,min,max,integer=false)=>value(o[name],l[name],min,max,integer);
  return {
   kind:n('kind',0,11,true),frequency:n('frequency',.2,2),angle:n('angle',-.1,Math.PI*2),aspect:n('aspect',.2,4),
   mirror:n('mirror',0,3,true),cycle:n('cycle',1,3,true),cycleRate:n('cycleRate',-.5,.5),levels:n('levels',2,32,true),phase:n('phase',0,Math.PI*2),
   scroll:[value(o.scrollX,l.scroll[0],-.08,.08),value(o.scrollY,l.scroll[1],-.08,.08)],
   motionType:n('motionType',1,3,true),amplitude:n('amplitude',0,.16),distortionFrequency:n('distortionFrequency',0,60),
   distortionSpeed:n('distortionSpeed',-4,4),compression:n('compression',.35,3),bands:n('bands',1,128,true)
  };
 });
 return {...base,layers,mix:value(settings.mix,base.mix,0,1),blend:value(settings.blend,base.blend,0,2,true),contrast:value(settings.contrast,base.contrast,.1,3),bias:value(settings.bias,base.bias,0,.4)};
}
export function earthboundFrame(key,time,settings={}){
 const p=earthboundProfile(key,settings);
 return {shapes:p.layers.map(l=>[l.kind,l.frequency,l.angle,l.aspect]),styles:p.layers.map(l=>layerCycle(l,time)),motions:p.layers.map(l=>layerMotion(l,time)),mix:[p.mix,p.blend,p.contrast,p.bias]};
}
export const EARTHBOUND_GLSL=`
uniform float uFieldMode;
uniform float uFieldScale;
uniform float uFeedbackMix;
uniform float uFieldMark;
uniform float uFieldDensity;
uniform float uFieldEcosystem;
${battleGLSL}
${battlePatternGLSL}
float ebHash(float n){return fract(sin(n)*43758.5453);}
float ebNoise(vec3 p){
 vec3 a=floor(p),f=fract(p),w=f*f*f*(f*(f*6.-15.)+10.);
 float n=dot(a,vec3(1.,57.,113.));
 return mix(mix(mix(ebHash(n),ebHash(n+1.),w.x),mix(ebHash(n+57.),ebHash(n+58.),w.x),w.y),mix(mix(ebHash(n+113.),ebHash(n+114.),w.x),mix(ebHash(n+170.),ebHash(n+171.),w.x),w.y),w.z)*2.-1.;
}
float earthboundFeed(vec2 point,float source){
 vec3 p=vec3(point*uFieldScale+vec2(uSeed,uSeed*.317),uTime*.05);
 float sum=1.,freq=1.;
 for(int i=0;i<5;i++){sum+=ebNoise(p*freq);freq*=1.25;}
 float base=(sum*.5+.5)*.5-.65+(uFieldDensity-.5)*.3;
 base+=uFieldEcosystem*ebNoise(vec3(point*6.+vec2(uSeed*.19,uSeed*.41),uTime*.04));
 base=max(base,.07+.045*ebNoise(vec3(point*14.+uSeed,uTime*.03)));
 float feed=battlePatternFeed(point*max(.2,uFieldScale/.25),base);
 return uFieldMode>1.5?mix(feed,source,uFeedbackMix):feed;
}
float earthboundMark(vec2 rasterPoint,vec2 centre,float diameter,float guideDensity){
 // Geometry supplies holder-driven diameters and preserves the required gap.
 // Keep UPIC's image-guide size response inside that already allocated space.
 float size=max(1.,floor(diameter+.5));
 bool directional=abs(uFieldMark)>.5&&abs(uFieldMark)<1.5;
 if(directional)size=max(3.,2.*floor((size-1.)*.5)+1.);
 vec2 start=floor(centre-size*.5+.5),local=rasterPoint-start+vec2(.5)-vec2(size*.5);
 float bounds=step(start.x,rasterPoint.x)*step(start.y,rasterPoint.y)*(1.-step(start.x+size,rasterPoint.x))*(1.-step(start.y+size,rasterPoint.y));
 float mark=step(dot(local,local),size*size*.25);
 if(uFieldMark>2.5)mark=1.;
 else if(directional){float halfStroke=max(1.,floor(size*.23+.5))*.5;float distance=uFieldMark>0.?min(abs(local.x),abs(local.y)):abs(abs(local.x)-abs(local.y))*.70710678;mark=step(distance,halfStroke);}
 return mark*bounds;
}
`;
export function bindEarthboundUniforms(display,{time,inputs,settings={}}){
 const s={...EARTHBOUND_DEFAULTS,...settings},p=earthboundFrame(inputs.coinKey,time,s),u=display.uniforms;
 u.uFieldMode=s.mode==='earthbound'?1:s.mode==='combined'?2:0;
 u.uFieldScale=s.scale;u.uFeedbackMix=s.feedbackMix;
 u.uFieldDensity=s.density;u.uFieldEcosystem=s.ecosystem;
 u.uFieldMark=s.mark==='square'?3:s.mark==='plus'?1:s.mark==='cross'?-1:s.mark==='circle'?0:Math.sign(inputs.change);
 u.uBattlePatternA=p.shapes[0];u.uBattlePatternB=p.shapes[1];u.uBattleStyleA=p.styles[0];u.uBattleStyleB=p.styles[1];u.uBattleMix=p.mix;
 u.uBattleA=p.motions[0].slice(0,4);u.uBattleB=p.motions[1].slice(0,4);u.uBattleFlowA=p.motions[0].slice(4);u.uBattleFlowB=p.motions[1].slice(4);
}

