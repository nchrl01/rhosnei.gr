// Independent study vocabulary adapted from UPIC's procedural pattern and
// warp formulas, GitHub nchrl01/rhosnei.gr cfa8f65341452a7f3a1bc89439880528b2938b70.
// Original upstream attribution remains under licenses/.
// This module has no preset, background metadata, or register-sequence imports.
const tau=Math.PI*2,cache=new Map();
function draw(key,label){
 let a=2166136261,b=0x9e3779b9;
 for(const c of key+':'+label){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b^c.charCodeAt(0),2246822507);}
 a=Math.imul(a^(a>>>16)^b,3266489909);return ((a^(a>>>16))>>>0)/4294967296;
}
export function createPatternProfile(value=0){
 const key=String(value),stored=cache.get(key);if(stored)return stored;
 const r=label=>draw(key,label);
 const layers=[0,1].map(index=>{
  const q=label=>r(index+':'+label),sign=label=>q(label)<.5?-1:1;
  return {
   kind:Math.floor(q('motif')*12),frequency:.2+q('frequency')*1.8,
   angle:Math.floor(q('orientation')*16)*Math.PI/8+(q('tilt')-.5)*.14,
   aspect:.55+q('aspect')*1.7,mirror:Math.floor(q('tile-flips')*4),
   cycle:1+Math.floor(q('cycle')*3),cycleRate:sign('cycle-direction')*(.03+.12*q('cycle-rate')),
   levels:4+Math.floor(q('palette-bands')*13),phase:q('phase')*tau,
   scroll:[sign('scroll-x')*(.003+.02*q('scroll-x-rate')),sign('scroll-y')*(.002+.015*q('scroll-y-rate'))],
   motionType:1+Math.floor(q('distortion-type')*3),amplitude:.012+.048*q('amplitude'),
   distortionFrequency:4+20*q('distortion-frequency'),distortionSpeed:sign('distortion-direction')*(.3+1.1*q('distortion-speed')),
   compression:.8+.5*q('compression'),bands:18+Math.floor(q('interlace-width')*64)
  };
 });
 const profile={key,layers,mix:.3+.4*r('mix'),blend:Math.floor(r('blend')*3),contrast:.78+.45*r('contrast'),bias:.02+.12*r('coverage')};
 cache.set(key,profile);if(cache.size>64)cache.delete(cache.keys().next().value);return profile;
}
export function layerCycle(layer,time){return [layer.mirror,layer.cycle,layer.phase+time*layer.cycleRate,layer.levels];}
export function layerMotion(layer,time){
 return [layer.motionType,layer.amplitude,layer.distortionFrequency,layer.phase+time*layer.distortionSpeed,layer.compression,time*layer.scroll[0],time*layer.scroll[1],layer.bands];
}
export const battlePatternNames=['Bent bands','Checker interference','Concentric channels','Diamond contours','Braided ribbons','Cellular lattice','Spiral sectors','Cross-flow interference','Ring tiles','Staggered tiles','Chevron weave','Square contours'];
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
export const battlePatternGLSL=`
uniform vec4 uBattlePatternA;
uniform vec4 uBattlePatternB;
uniform vec4 uBattleStyleA;
uniform vec4 uBattleStyleB;
uniform vec4 uBattleMix;
float battleLayerInk(vec2 point,vec4 shape,vec4 style,vec4 motion,vec4 flow){
 vec2 p=battleLayerWarp(point,motion,flow);
 float u=(p.x*cos(shape.z)-p.y*sin(shape.z))*shape.y*shape.w;
 float v=(p.x*sin(shape.z)+p.y*cos(shape.z))*shape.y/shape.w;
 if(style.x>=1.)u=floor(u)+(mod(floor(v),2.)>=1.?1.-fract(u):fract(u));
 if(style.x>=2.)v=floor(v)+(mod(floor(u),2.)>=1.?1.-fract(v):fract(v));
 float kind=shape.x,w;
 if(kind<.5)w=sin(u*6.2831853+sin(v*2.)*1.8);
 else if(kind<1.5)w=sin(u*6.2831853)*sin(v*6.2831853);
 else if(kind<2.5)w=sin(length(vec2(u,v))*9.);
 else if(kind<3.5)w=sin((abs(u)+abs(v))*7.);
 else if(kind<4.5)w=sin(u*6.2831853+sin(v*4.)*3.)*cos(v*3.);
 else if(kind<5.5)w=(cos(u*6.2831853)+cos(v*6.2831853))*.5;
 else if(kind<6.5)w=sin(atan(v,u+.0000001)*6.+length(vec2(u,v))*7.);
 else if(kind<7.5)w=sin(u*5.+cos(v*3.))*cos(v*5.+sin(u*3.));
 else if(kind<8.5)w=cos(length(fract(vec2(u,v))-.5)*14.);
 else if(kind<9.5)w=cos((fract(u+floor(v)*.5)-.5)*6.2831853)*cos(v*6.2831853);
 else if(kind<10.5)w=sin((u+abs(fract(v)-.5))*6.2831853);
 else w=cos(max(abs(fract(u)-.5),abs(fract(v)-.5))*18.);
 float n=clamp(.5+.5*w,0.,1.);
 float band=floor(n*(style.w-1.))/max(1.,style.w-1.);
 float phase=style.y>2.5?sin(style.z)*3.14159265:style.y>1.5&&n>.5?-style.z:style.z;
 return .5+.5*cos(band*6.2831853+phase);
}
float battlePatternFeed(vec2 point,float base){
 float a=battleLayerInk(point,uBattlePatternA,uBattleStyleA,uBattleA,uBattleFlowA);
 float b=battleLayerInk(point,uBattlePatternB,uBattleStyleB,uBattleB,uBattleFlowB);
 float n=mix(a,b,uBattleMix.x);
 if(uBattleMix.y>.5&&uBattleMix.y<1.5)n=mix(n,a+b-2.*a*b,.65);
 if(uBattleMix.y>1.5)n=mix(n,max(a,b),.55);
 return uBattleMix.w+.82*clamp((n-.5)*uBattleMix.z+.5,0.,1.)+.12*base;
}`;
