import {ditherPixels,imageLevels} from './coin-dither.js?v=217';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};

function perceptualColour(rgb){
 const linear=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const [r,g,b]=linear;
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b);
 const m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b);
 const s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
const colourDistance=(a,b)=>.45*(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const paletteDistance=(r,g,b,rgb)=>.2126*(r-rgb[0])**2+.7152*(g-rgb[1])**2+.0722*(b-rgb[2])**2;

// Deterministic, area-weighted colours from the original RGBA, never the
// black/white dither. Discard blank neutral backgrounds only when the artwork
// has a meaningful chromatic population; monochrome artwork stays monochrome.
export function originalArtworkPalette(rgba){
 const histogram=new Float64Array(4096*4);let total=0;
 for(let i=0;i<rgba.length;i+=4){
  const alpha=rgba[i+3]/255;if(alpha<=0)continue;
  const bin=((rgba[i]>>4)*256+(rgba[i+1]>>4)*16+(rgba[i+2]>>4))*4;
  histogram[bin]+=alpha;histogram[bin+1]+=rgba[i]*alpha;
  histogram[bin+2]+=rgba[i+1]*alpha;histogram[bin+3]+=rgba[i+2]*alpha;total+=alpha;
 }
 if(!total)return [[1,1,1],[1,1,1]];
 const bins=[],chromatic=[];let colouredWeight=0;
 for(let i=0;i<histogram.length;i+=4){
  const weight=histogram[i];if(!weight)continue;
  const rgb=[histogram[i+1],histogram[i+2],histogram[i+3]].map(v=>v/weight/255);
  const item={rgb,weight,lab:perceptualColour(rgb)};bins.push(item);
  if(Math.max(...rgb)-Math.min(...rgb)>.10&&Math.max(...rgb)>.15){chromatic.push(item);colouredWeight+=weight;}
 }
 const candidates=colouredWeight>=total*.015?chromatic:bins;
 let first=candidates[0];for(const bin of candidates)if(bin.weight>first.weight)first=bin;
 let second=first,best=-1;
 for(const bin of candidates){
  const score=bin.weight*Math.sqrt(colourDistance(bin.lab,first.lab));
  if(score>best){second=bin;best=score;}
 }
 let colours=[first.rgb.slice(),second.rgb.slice()],centres=[first.lab,second.lab],weights=[0,0];
 for(let pass=0;pass<7;pass++){
  const sums=[[0,0,0],[0,0,0]];weights=[0,0];
  for(const bin of candidates){
   const side=colourDistance(bin.lab,centres[0])<=colourDistance(bin.lab,centres[1])?0:1;
   weights[side]+=bin.weight;
   for(let c=0;c<3;c++)sums[side][c]+=bin.rgb[c]*bin.weight;
  }
  for(let side=0;side<2;side++)if(weights[side])colours[side]=sums[side].map(v=>clamp(v/weights[side]));
  centres=colours.map(perceptualColour);
 }
 if(weights[1]>weights[0])colours.reverse();
 return colours;
}

// Build the attraction guide only when artwork changes. R packs seven bits of
// Bayer ink plus one palette-region bit; G is its soft density; B/A point
// towards nearby ink contours. Both colours come from the undithered source.
// Both renderers read this single packed guide while their own pattern runs.
export function preparePixelIdentity(source){
 const width=Math.floor(Number(source?.width)),height=Math.floor(Number(source?.height)),pixels=source?.pixels;
 if(!(width>0&&height>0)||!pixels||pixels.length<width*height*4)return null;
 const scale=Math.min(1,256/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
 let rgba=pixels;
 if(w!==width||h!==height){
  rgba=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const from=(Math.min(height-1,Math.floor((y+.5)*height/h))*width+Math.min(width-1,Math.floor((x+.5)*width/w)))*4,to=(y*w+x)*4;
   rgba[to]=pixels[from];rgba[to+1]=pixels[from+1];rgba[to+2]=pixels[from+2];rgba[to+3]=pixels[from+3];
  }
 }
 const palette=originalArtworkPalette(rgba),paletteBytes=palette.map(rgb=>rgb.map(v=>v*255));
 const dither=ditherPixels(rgba,w,h),texture=new Uint8Array(w*h*4),tone=new Float32Array(w*h);
 const {black,white}=imageLevels(rgba),range=white-black;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const n=y*w+x,i=n*4,dx=2*(x+.5)/w-1,dy=2*(y+.5)/h-1;
  // Only the corners recede; the centre and midpoints of each edge stay whole.
  const corner=1-smooth((Math.hypot(dx,dy)/Math.SQRT2-.8)/.2);
  const alpha=rgba[i+3]/255;
  const luminance=clamp((rgba[i]*.2126+rgba[i+1]*.7152+rgba[i+2]*.0722-black)/range);
  tone[n]=(1-Math.pow(luminance,.88))*alpha*corner;
  const region=paletteDistance(rgba[i],rgba[i+1],rgba[i+2],paletteBytes[0])<=paletteDistance(rgba[i],rgba[i+1],rgba[i+2],paletteBytes[1])?0:1;
  const ink=dither[i]<128?dither[i+3]*corner/255:0;
  texture[i]=(Math.round(ink*127)<<1)|region;
 }
 // Separable running sums keep preparation linear in image size.
 const scratch=new Float32Array(w*h),radius=Math.max(1,Math.round(Math.min(w,h)/64)),span=2*radius+1;
 for(let pass=0;pass<2;pass++){
  for(let y=0;y<h;y++){
   let sum=0;for(let k=-radius;k<=radius;k++)sum+=tone[y*w+Math.max(0,Math.min(w-1,k))];
   for(let x=0;x<w;x++){
    scratch[y*w+x]=sum/span;
    sum+=tone[y*w+Math.min(w-1,x+radius+1)]-tone[y*w+Math.max(0,x-radius)];
   }
  }
  for(let x=0;x<w;x++){
   let sum=0;for(let k=-radius;k<=radius;k++)sum+=scratch[Math.max(0,Math.min(h-1,k))*w+x];
   for(let y=0;y<h;y++){
    tone[y*w+x]=sum/span;
    sum+=scratch[Math.min(h-1,y+radius+1)*w+x]-scratch[Math.max(0,y-radius)*w+x];
   }
  }
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const n=y*w+x,i=n*4;
  const dx=(tone[y*w+Math.min(w-1,x+2)]-tone[y*w+Math.max(0,x-2)])*4;
  const dy=(tone[Math.max(0,y-2)*w+x]-tone[Math.min(h-1,y+2)*w+x])*4;
  texture[i+1]=Math.round(255*clamp(tone[n]));
  texture[i+2]=128+Math.round(127*Math.max(-1,Math.min(1,dx)));
  texture[i+3]=128+Math.round(127*Math.max(-1,Math.min(1,dy)));
 }
 return {width:w,height:h,texture,palette};
}

// Mutate one reusable result instead of allocating an object for every mark.
export function samplePixelIdentity(mask,x,y,side,flow,phase,out){
 x/=side;y/=side;
 const u=.5+x+(Math.sin(y*9+phase)+.35*Math.sin(x*5-phase*.7))*flow;
 const v=.5-y+(Math.sin(x*8-phase*.85)+.3*Math.sin(y*5+phase*.6))*flow;
 if(u<0||v<0||u>=1||v>=1){out.fill(0);out[4]=-1;return out;}
 const i=(Math.floor(v*mask.height)*mask.width+Math.floor(u*mask.width))*4,t=mask.texture;
 out[0]=(t[i]>>1)/127;out[1]=t[i+1]/255;out[2]=(t[i+2]-128)/127;out[3]=(t[i+3]-128)/127;out[4]=t[i]&1;
 return out;
}

export const pixelIdentityGLSL=`
vec4 identityGuide(vec2 point,out float paletteIndex){
 paletteIndex=-1.;
 vec2 viewSize=uResolution/uCanvasScale;
 float side=.82*min(viewSize.x,viewSize.y);
 vec2 p=point/side;
 float flow=(.028-.014*uIdentity)*uIdentityMotion;
 float phase=uTime*.65+uSeed*.013;
 vec2 uv=vec2(.5+p.x,.5-p.y)+vec2(
  sin(p.y*9.+phase)+.35*sin(p.x*5.-phase*.7),
  sin(p.x*8.-phase*.85)+.3*sin(p.y*5.+phase*.6)
 )*flow;
 if(any(lessThan(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return vec4(0.);
 vec4 guide=texture(uIdentityImage,uv);
 float packedInk=floor(guide.r*255.+.5);
 paletteIndex=mod(packedInk,2.);
 return vec4(floor(packedInk*.5)/127.,guide.g,(guide.ba*255.-128.)/127.);
}
`;
