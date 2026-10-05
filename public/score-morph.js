// Browser adaptation of touchdesigner/data_field.frag. Both renderers sample
// one interpolated field before thresholding, never two composited pictures.
const fract=n=>n-Math.floor(n);
export function scoreInk(x,y,{seed,energy,values,history,motion}){
 const cx=Math.floor(x*180),cy=Math.floor(y*98),fx=fract(x*180),fy=fract(y*98);
 const hash=(a,b)=>fract(Math.sin(a*127.1+b*311.7+seed)*43758.5453);
 const datum=Math.abs(values[cy%4]||0),payload=datum*(.01+cy%7);
 const bit=fract(payload/2**(cx%20))>=.5?1:0;
 const raster=hash(cx,cy)<.13+.38*energy&&fx<.25+.59*bit&&fy<.2?1:0;
 const bars=hash(cx,Math.floor(y*8))<.2+.45*energy&&fract(x*240)<.27+.37*bit&&fract(y*8)<.68?1:0;
 const along=x*7,i=Math.min(6,Math.floor(along)),a=history[i],b=history[i+1];
 const wave=.18+.64*(a+(b-a)*fract(along));
 const contour=a>=0&&b>=0&&Math.abs(fract(y*32)-.5)<.08&&Math.abs(y-wave)<.04+.15*motion&&hash(cx,cy)<.25+.45*energy?1:0;
 const choice=Math.floor(seed)%3;
 return choice===0?raster:choice===1?(y>=.48?bars:raster):Math.max(raster*.4,contour);
}
export const scoreGLSL=`
uniform float uScoreMorph;
uniform float uScoreEnergy;
uniform float uScoreMotion;
uniform vec4 uScoreValues;
uniform float uScoreHistory[8];
float scoreHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453);}
float scoreInk(vec2 uv){
 vec2 cell=floor(uv*vec2(180.,98.)),f=fract(uv*vec2(180.,98.));
 int row=int(mod(cell.y,4.));float payload=abs(uScoreValues[row])*(.01+mod(cell.y,7.));
 float bit=step(.5,fract(payload/pow(2.,mod(cell.x,20.))));
 float raster=step(scoreHash(cell),.13+.38*uScoreEnergy)*step(f.x,.25+.59*bit)*step(f.y,.2);
 float bars=step(scoreHash(vec2(cell.x,floor(uv.y*8.))),.2+.45*uScoreEnergy)*step(fract(uv.x*240.),.27+.37*bit)*step(fract(uv.y*8.),.68);
 float along=uv.x*7.;int i=int(min(6.,floor(along)));
 float a=uScoreHistory[i],b=uScoreHistory[i+1],wave=.18+.64*mix(a,b,fract(along));
 float contour=step(0.,a)*step(0.,b)*step(abs(fract(uv.y*32.)-.5),.08)*step(abs(uv.y-wave),.04+.15*uScoreMotion)*step(scoreHash(cell),.25+.45*uScoreEnergy);
 float choice=mod(floor(uSeed),3.);
 return choice<1.?raster:choice<2.?mix(raster,bars,step(.48,uv.y)):max(raster*.4,contour);
}`;
