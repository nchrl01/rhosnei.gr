const tau=6.2831853,fract=n=>n-Math.floor(n),mix=(a,b,t)=>a+(b-a)*t;
const clamp=n=>Math.max(0,Math.min(1,n)),mod=(n,m)=>((n%m)+m)%m;
export function battleWarp(x,y,motions){
 for(const [type,amp,freq,phase,compression=1,sx=0,sy=0,bands=32] of motions){
  x+=sx;y+=sy;
  const offset=amp*Math.sin(y*freq+phase);
  if(type===3)y=y*compression+offset;
  else x+=offset*(type===2?(mod(Math.floor(y*bands),2)<1?-1:1):1);
 }
 return [x,y];
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
