import {earthboundVisualSeed,layerCycle} from './earthbound-visual-seed.js?v=214';
import {battleMotion,battleWarp} from './earthbound-motion.js?v=214';
const tau=6.2831853,fract=n=>n-Math.floor(n),mix=(a,b,t)=>a+(b-a)*t;
const clamp=n=>Math.max(0,Math.min(1,n));
// Two independently distorted procedural tile arrangements. Palette movement
// changes luminance/dither occupancy, retaining UPIC's black-and-white ink.
export function battlePattern(seed,time=0){
 const profile=earthboundVisualSeed(seed);
 return {shapes:profile.layers.map(l=>[l.kind,l.frequency,l.angle,l.aspect]),styles:profile.layers.map(l=>layerCycle(l,time)),motions:battleMotion(seed,time),mix:[profile.mix,profile.blend,profile.contrast,profile.bias]};
}
function tileShape(x,y,p){
 const [kind,f,angle,aspect]=p,c=Math.cos(angle),s=Math.sin(angle);
 let u=(x*c-y*s)*f*aspect,v=(x*s+y*c)*f/aspect;
 return [u,v,kind];
}
function layerInk(x,y,p,style,motion){
 [x,y]=battleWarp(x,y,[motion]);let [u,v,kind]=tileShape(x,y,p);
 if(style[0]>=1){const parity=((Math.floor(v)%2)+2)%2;u=(Math.floor(u)+ (parity?1-fract(u):fract(u)));}
 if(style[0]>=2){const parity=((Math.floor(u)%2)+2)%2;v=(Math.floor(v)+ (parity?1-fract(v):fract(v)));}
 let w;
 if(kind===0)w=Math.sin(u*tau+Math.sin(v*2)*1.8);
 else if(kind===1)w=Math.sin(u*tau)*Math.sin(v*tau);
 else if(kind===2)w=Math.sin(Math.hypot(u,v)*9);
 else if(kind===3)w=Math.sin((Math.abs(u)+Math.abs(v))*7);
 else if(kind===4)w=Math.sin(u*tau+Math.sin(v*4)*3)*Math.cos(v*3);
 else if(kind===5)w=(Math.cos(u*tau)+Math.cos(v*tau))*.5;
 else if(kind===6)w=Math.sin(Math.atan2(v,u+.0000001)*6+Math.hypot(u,v)*7);
 else if(kind===7)w=Math.sin(u*5+Math.cos(v*3))*Math.cos(v*5+Math.sin(u*3));
 else if(kind===8)w=Math.cos(Math.hypot(fract(u)-.5,fract(v)-.5)*14);
 else if(kind===9)w=Math.cos((fract(u+Math.floor(v)*.5)-.5)*tau)*Math.cos(v*tau);
 else if(kind===10)w=Math.sin((u+Math.abs(fract(v)-.5))*tau);
 else w=Math.cos(Math.max(Math.abs(fract(u)-.5),Math.abs(fract(v)-.5))*18);
 const n=clamp(.5+.5*w),levels=style[3],band=Math.floor(n*(levels-1))/Math.max(1,levels-1);
 const phase=style[1]===3?Math.sin(style[2])*Math.PI:style[1]===2&&n>.5?-style[2]:style[2];
 return .5+.5*Math.cos(band*tau+phase);
}
export function battlePatternFeed(x,y,time,p,base){
 const a=layerInk(x,y,p.shapes[0],p.styles[0],p.motions[0]),b=layerInk(x,y,p.shapes[1],p.styles[1],p.motions[1]);
 const [weight,mode,contrast,bias]=p.mix;
 let n=mix(a,b,weight);
 if(mode===1)n=mix(n,a+b-2*a*b,.65);
 if(mode===2)n=mix(n,Math.max(a,b),.55);
 return bias+.82*clamp((n-.5)*contrast+.5)+.12*base;
}
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
export const battlePatternNames=['Bent bands','Checker interference','Concentric channels','Diamond contours','Braided ribbons','Cellular lattice','Spiral sectors','Cross-flow interference','Ring tiles','Staggered tiles','Chevron weave','Square contours'];
