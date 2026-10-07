import {suggestedLayers} from './earthbound-motion-presets.js?v=167';
// Explicit seed identity, independent of valuation. Motion metadata still warps
// this same field; these are procedural interpretations, not ROM artwork.
export function battlePattern(seed){
 const index=(seed>>>0)%suggestedLayers.length,[a,b]=suggestedLayers[index].layers;
 return [index%8,3+((a*7+b*11+index)%29)/4,((a*13+b*3)%16)*Math.PI/8,.18+((a+b*7)%13)*.065];
}
export function battlePatternFeed(x,y,time,p,base){
 const [kind,f,angle,pace]=p,c=Math.cos(angle),s=Math.sin(angle);
 const u=(x*c-y*s)*f,v=(x*s+y*c)*f,t=time*pace;
 let w;
 if(kind===0)w=Math.sin(u*6.2831853+Math.sin(v*2+t)*1.8+t);
 else if(kind===1)w=Math.sin(u*6.2831853+t)*Math.sin(v*6.2831853-t*.7);
 else if(kind===2)w=Math.sin(Math.hypot(u,v)*9-t*2);
 else if(kind===3)w=Math.sin((Math.abs(u)+Math.abs(v))*7-t);
 else if(kind===4)w=Math.sin(u*6.2831853+Math.sin(v*4+t)*3)*Math.cos(v*3-t);
 else if(kind===5)w=Math.cos(u*6.2831853+t)+Math.cos(v*6.2831853-t)-.5;
 else if(kind===6)w=Math.sin(Math.atan2(v,u)*6+Math.hypot(u,v)*7-t);
 else w=Math.sin(u*5+t+Math.cos(v*3-t))*Math.cos(v*5+t+Math.sin(u*3));
 return .28+.42*w+.18*base;
}
export const battlePatternGLSL=`
uniform vec4 uBattlePattern;
float battlePatternFeed(vec2 point,float base){
 float kind=uBattlePattern.x,f=uBattlePattern.y,a=uBattlePattern.z,t=uTime*uBattlePattern.w;
 float u=(point.x*cos(a)-point.y*sin(a))*f;
 float v=(point.x*sin(a)+point.y*cos(a))*f;
 float w;
 if(kind<.5)w=sin(u*6.2831853+sin(v*2.+t)*1.8+t);
 else if(kind<1.5)w=sin(u*6.2831853+t)*sin(v*6.2831853-t*.7);
 else if(kind<2.5)w=sin(length(vec2(u,v))*9.-t*2.);
 else if(kind<3.5)w=sin((abs(u)+abs(v))*7.-t);
 else if(kind<4.5)w=sin(u*6.2831853+sin(v*4.+t)*3.)*cos(v*3.-t);
 else if(kind<5.5)w=cos(u*6.2831853+t)+cos(v*6.2831853-t)-.5;
 else if(kind<6.5)w=sin(atan(v,u+.0000001)*6.+length(vec2(u,v))*7.-t);
 else w=sin(u*5.+t+cos(v*3.-t))*cos(v*5.+t+sin(u*3.));
 return .28+.42*w+.18*base;
}`;
export const battlePatternNames=['Bent bands','Checker interference','Concentric channels','Diamond contours','Braided ribbons','Cellular lattice','Spiral sectors','Cross-flow interference'];
