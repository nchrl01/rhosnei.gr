export const CAPITAL_STAGES=[10000,50000,100000,500000,1000000,10000000,20000000,1000000000];
export function capitalStage(cap){
 if(!(cap>0))return -1;
 if(cap<=CAPITAL_STAGES[0])return 0;
 for(let i=0;i<CAPITAL_STAGES.length-1;i++)if(cap<CAPITAL_STAGES[i+1]){
  const t=Math.log(cap/CAPITAL_STAGES[i])/Math.log(CAPITAL_STAGES[i+1]/CAPITAL_STAGES[i]);
  return i+t*t*(3-2*t);
 }
 return 7;
}
const fract=n=>n-Math.floor(n);
const hash=n=>fract(Math.sin(n)*43758.5453);
function shape(i,x,y,n,m,seed){
 const a=Math.abs(fract(x*3+n)-.5),b=Math.abs(fract(y*3+m)-.5);
 if(i===0)return n*1.6-.68; // Small separated islands.
 if(i===1)return .62-Math.abs(n-.5)*3.8; // Fine connected filaments.
 if(i===2)return .65-b*2.4; // Long horizontal strands.
 if(i===3)return .65-a*2.4; // Interleaving vertical streams.
 if(i===4)return .72-Math.min(a,b)*3.; // Crossed mesh.
 if(i===5)return .62-Math.abs(fract(n*4.)-.5)*2.7; // Contour engraving.
 if(i===6)return .68-Math.max(Math.abs(fract(x*8+n*.4)-.5),Math.abs(fract(y*8+m*.4)-.5))*2.1;
 return 1.35-.65*Math.pow(1-n,4); // Near-white with moving dark channels.
}
export function capitalFeed(stage,x,y,n,m,seed,base){
 if(stage<0)return base;
 const i=Math.floor(stage),t=fract(stage);
 return .2*base+.8*(shape(i,x,y,n,m,seed)*(1-t)+shape(Math.min(7,i+1),x,y,n,m,seed)*t);
}
export const capitalGLSL=`
uniform float uCapitalStage;
float capitalShape(float i,vec2 p,float n,float m){
 float a=abs(fract(p.x*3.+n)-.5),b=abs(fract(p.y*3.+m)-.5);
 if(i<.5)return n*1.6-.68;
 if(i<1.5)return .62-abs(n-.5)*3.8;
 if(i<2.5)return .65-b*2.4;
 if(i<3.5)return .65-a*2.4;
 if(i<4.5)return .72-min(a,b)*3.;
 if(i<5.5)return .62-abs(fract(n*4.)-.5)*2.7;
 if(i<6.5)return .68-max(abs(fract(p.x*8.+n*.4)-.5),abs(fract(p.y*8.+m*.4)-.5))*2.1;
 return 1.35-.65*pow(1.-n,4.);
}
float capitalFeed(vec2 p,float base){
 if(uCapitalStage<0.)return base;
 float n=.5+.5*vnoise(vec3(p*4.+uSeed,uTime*.055));
 float m=.5+.5*vnoise(vec3(p*3.-uSeed,uTime*.04));
 float i=floor(uCapitalStage),t=fract(uCapitalStage);
 return .2*base+.8*mix(capitalShape(i,p,n,m),capitalShape(min(7.,i+1.),p,n,m),t);
}`;
