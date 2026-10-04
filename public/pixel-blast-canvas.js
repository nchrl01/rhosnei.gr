// Canvas rendition of the PixelBlast noise/Bayer field for mobile and lost GPUs.
// Uses the same market parameters, seed and source clock as the shader.
// React Bits attribution/license: vendor/ui/REACT-BITS-LICENSE.md.
import {ditherPixels} from './coin-dither.js?v=119';
const fract=x=>x-Math.floor(x);
const hash=n=>fract(Math.sin(n)*43758.5453);
const fade=x=>x*x*x*(x*(x*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=x=>Math.max(0,Math.min(1,x));
const b2=(x,y)=>fract(Math.floor(x)/2+Math.floor(y)**2*.75);
const b4=(x,y)=>b2(x*.5,y*.5)*.25+b2(x,y);
const b8=(x,y)=>b4(x*.5,y*.5)*.25+b2(x,y);
function noise(x,y,z){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),n=ix+iy*57+iz*113;
 const a=fade(fract(x)),b=fade(fract(y)),c=fade(fract(z));
 return mix(mix(mix(hash(n),hash(n+1),a),mix(hash(n+57),hash(n+58),a),b),mix(mix(hash(n+113),hash(n+114),a),mix(hash(n+170),hash(n+171),a),b),c)*2-1;
}
// Prepare once when coin artwork changes, using the same image levels and
// Bayer grain as the coin avatar. Dark ink becomes light on the black stage.
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
 const dither=ditherPixels(rgba,w,h),data=new Uint8Array(w*h);
 for(let n=0;n<data.length;n++)data[n]=dither[n*4]<128?dither[n*4+3]:0;
 return {width:w,height:h,data};
}
function identityInk(mask,fx,fy,w,h,time,offset,params){
 const side=.82*Math.min(w,h),x=fx/side,y=fy/side;
 const flow=((1-params.identity)*.1+.012)*params.identityMotion,phase=time*.65+offset*.013;
 const u=.5+x+(Math.sin(y*9+phase)+.35*Math.sin(x*5-phase*.7))*flow;
 const v=.5-y+(Math.sin(x*8-phase*.85)+.3*Math.sin(y*5+phase*.6))*flow;
 if(u<0||v<0||u>=1||v>=1)return 0;
 return mask.data[Math.floor(v*mask.height)*mask.width+Math.floor(u*mask.width)]/255;
}
export function createPixelBlastCanvas(host){
 const canvas=document.createElement('canvas');canvas.className='pixel-blast-layer pixel-blast-software';canvas.setAttribute('aria-hidden','true');host.append(canvas);
 const ctx=canvas.getContext('2d',{alpha:true});let image=null,identityMask=null;
 return {
  canvas,
  setImage(mask){identityMask=mask;},
  render({width,height,time=0,eventTime=0,seed=0,params,dither=false,ripples=[]}){
   if(!ctx)return;
   const scale=Math.min(1,320/Math.max(1,width,height));
   const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;image=null;}
   image??=ctx.createImageData(w,h);const pixels=image.data;pixels.fill(0);
   const cell=8*params.pixelSize,offset=(seed%65521)/65521*173.6,cache=new Map();
   const identity=identityMask?params.identity:0;
   const columns=Math.ceil(w/params.pixelSize)+2,rows=Math.ceil(h/params.pixelSize)+2;
   const firstX=Math.floor(-w/2/params.pixelSize),firstY=Math.floor(-h/2/params.pixelSize);
   const dots=identity>0?new Float32Array(columns*rows).fill(-1):null;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const fx=x+.5-w/2,fy=h-y-.5-h/2,cx=Math.floor(fx/cell),cy=Math.floor(fy/cell),key=cx+':'+cy;
    let feed=cache.get(key);
    if(feed===undefined){
     const u=cx*cell/h,v=cy*cell/h;let sum=1,freq=1;
     for(let octave=0;octave<5;octave++){sum+=noise((u*params.scale+offset)*freq,(v*params.scale+offset*.317)*freq,time*.05*freq);freq*=1.25;}
     feed=(sum*.5+.5)*.5-.65+(params.density-.5)*.3;
     if(params.ripples)for(const p of ripples){
      const age=Math.max(0,eventTime-p.time),r=Math.hypot(u-((p.x*w-w/2-cell/2)/h),v-((p.y*h-h/2-cell/2)/h));
      const ring=Math.exp(-(((r-params.rippleSpeed*age)/params.rippleThickness)**2))*Math.exp(-age-10*r)*params.rippleIntensity*p.strength;
      feed=Math.max(feed,ring);
     }
     cache.set(key,feed);
    }
    const px=fx/params.pixelSize,py=fy/params.pixelSize;
    let maskInk=0;
    if(identity>0){
     const dotKey=(Math.floor(py)-firstY)*columns+Math.floor(px)-firstX;
     maskInk=dots[dotKey];
     if(maskInk<0){
      maskInk=identityInk(identityMask,(Math.floor(px)+.5)*params.pixelSize,(Math.floor(py)+.5)*params.pixelSize,w,h,time,offset,params);
      dots[dotKey]=maskInk;
     }
     const imageFeed=mix(feed-.25,.68+.16*Math.min(3,params.density)+.13*feed,maskInk);
     feed=mix(feed,imageFeed,identity);
    }
    if(feed+b8(px,py)-.5<.5)continue;
    const jitter=1+(hash(Math.floor(px)*127.1+Math.floor(py)*311.7)-.5)*params.jitter;
    const backgroundScale=mix(1,.7+.3*maskInk,identity);
    const dotSize=Math.min(params.pixelSize,Math.max(1,Math.round(params.pixelSize*params.dotScale*jitter*backgroundScale)));
    if(Math.max(Math.abs(fract(px)-.5),Math.abs(fract(py)-.5))*params.pixelSize>dotSize*.5)continue;
    const ink=Math.round(255*clamp(params.dotStrength)*mix(1,.45+.55*maskInk,identity));
    const at=(y*w+x)*4;pixels[at]=pixels[at+1]=pixels[at+2]=ink;pixels[at+3]=255;
   }
   ctx.putImageData(image,0,0);canvas.hidden=false;
   Object.assign(canvas.dataset,{renderer:'canvas',density:params.density.toFixed(3),pixelSize:params.pixelSize.toFixed(3),dotSize:Math.max(1,params.pixelSize*params.dotScale).toFixed(3),dotStrength:params.dotStrength.toFixed(3),patternScale:params.scale.toFixed(3),speed:params.speed.toFixed(3),edgeFade:'0',ripples:String(params.ripples?ripples.length:0),identity:identity.toFixed(3),identityImage:String(!!identityMask)});
  },
  clear(){ctx?.clearRect(0,0,canvas.width,canvas.height);},
  close(){identityMask=null;image=null;canvas.remove();}
 };
}
