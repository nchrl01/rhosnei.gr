// Canvas rendition of the PixelBlast noise/Bayer field for mobile and lost GPUs.
// Uses the same market parameters, seed and source clock as the shader.
// React Bits attribution/license: vendor/ui/REACT-BITS-LICENSE.md.
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
export function createPixelBlastCanvas(host){
 const canvas=document.createElement('canvas');canvas.className='pixel-blast-layer pixel-blast-software';canvas.setAttribute('aria-hidden','true');host.append(canvas);
 const ctx=canvas.getContext('2d',{alpha:true});let image=null;
 return {
  canvas,
  render({width,height,time=0,eventTime=0,seed=0,params,formation=1,birth=1,dither=false,ripples=[]}){
   if(!ctx)return;
   const scale=Math.min(1,320/Math.max(1,width,height));
   const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;image=null;}
   image??=ctx.createImageData(w,h);const pixels=image.data;pixels.fill(0);
   const cell=8*params.pixelSize,offset=(seed%65521)/65521*173.6,cache=new Map();
   const opacity=params.opacity*birth;
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
    if(formation<=0||hash(Math.floor(px)*12.9898+Math.floor(py)*78.233+offset)+.00001>formation)continue;
    if(feed+b8(px,py)-.5<.5)continue;
    const jitter=1+(hash(Math.floor(px)*127.1+Math.floor(py)*311.7)-.5)*params.jitter;
    const radius=Math.sqrt(Math.max(0,jitter))*.43;
    const shape=clamp((radius-Math.hypot(fract(px)-.5,fract(py)-.5))*params.pixelSize+.5);
    const edge=Math.min(x/w,y/h,1-x/w,1-y/h),t=clamp(edge/Math.max(.0001,params.edgeFade));
    const alpha=Math.round(255*clamp(shape*opacity*t*t*(3-2*t)));
    const at=(y*w+x)*4;pixels[at]=pixels[at+1]=pixels[at+2]=255;pixels[at+3]=alpha;
   }
   ctx.putImageData(image,0,0);canvas.hidden=false;
   Object.assign(canvas.dataset,{renderer:'canvas',density:params.density.toFixed(3),pixelSize:params.pixelSize.toFixed(3),patternScale:params.scale.toFixed(3),speed:params.speed.toFixed(3),edgeFade:params.edgeFade.toFixed(3),ripples:String(params.ripples?ripples.length:0)});
  },
  clear(){ctx?.clearRect(0,0,canvas.width,canvas.height);},
  close(){canvas.remove();}
 };
}
