import {battlePattern,battlePatternFeed} from './earthbound-pattern.js?v=214';
import {holderClusterFeed} from './holder-cluster-field.js?v=169';
import {capitalFeed} from './capital-field.js?v=167';
// Canvas rendition of the PixelBlast noise/Bayer field for mobile and lost GPUs.
// Uses the same market parameters, seed and source clock as the shader.
// React Bits attribution/license: vendor/ui/REACT-BITS-LICENSE.md.
import {ditherPixels} from './coin-dither.js?v=217';
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
 const canvas=document.createElement('canvas');canvas.className='pixel-blast-layer pixel-blast-software';canvas.setAttribute('aria-hidden','true');canvas.style.width='100%';canvas.style.height='100%';host.append(canvas);
 const ctx=canvas.getContext('2d',{alpha:true});let identityMask=null,counts=null,output=null,lastCoverage=0;
 const layerCanvas=document.createElement("canvas"),layerContext=layerCanvas.getContext("2d");
 return {
  canvas,
  coverage(){return lastCoverage;},
  setImage(mask){identityMask=mask;},
  render({width,height,time=0,liquidTime,eventTime=0,seed=0,params,dither=false,ripples=[],preserve=false}){
   if(!ctx)return;
   const viewWidth=Math.max(1,Number(width)||1),viewHeight=Math.max(1,Number(height)||1);
   const dpr=Math.min(Math.max(1,globalThis.devicePixelRatio||1),2,Math.sqrt(1.2e6/(viewWidth*viewHeight)));
   const w=Math.max(1,Math.floor(viewWidth*dpr)),h=Math.max(1,Math.floor(viewHeight*dpr));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   if(!preserve)ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;ctx.globalCompositeOperation="source-over";
   if(!output||output.width!==w||output.height!==h){output=ctx.createImageData(w,h);counts=new Uint8Array(w*h);layerCanvas.width=w;layerCanvas.height=h;}
   counts.fill(0);output.data.fill(0);
   const cellSize=params.cellSize,grid=Math.max(2,Math.round(cellSize*dpr)),ratio=grid/cellSize;
   const cssWidth=w/ratio,cssHeight=h/ratio,originX=Math.floor(w/2),originY=Math.floor(h/2);
   const pattern=battlePattern(params.patternKey??seed,time);
   const cell=16,offset=(seed%65521)/65521*173.6,cache=new Map();
   const liquidRadius=Math.max(.001,.12*params.liquidRadius),grainFrame=Math.floor(time*12);
   const touches=params.liquid?ripples.filter(p=>eventTime-p.time>=0&&eventTime-p.time<3).map(p=>{
    let dx=Number.isFinite(p.dx)?p.dx:params.direction,dy=Number.isFinite(p.dy)?p.dy:(params.balance-.5)*.6;
    const length=Math.hypot(dx,dy);
    if(length>.000001){dx/=length;dy/=length;}else{dx=1;dy=0;}
    return {x:(p.x*w-originX)/ratio/cssHeight,y:(p.y*h-originY)/ratio/cssHeight,dx,dy,strength:Math.exp(-(eventTime-p.time)*1.8)*p.strength};
   }):[];
   const packets=ripples.filter(p=>eventTime>=p.time&&eventTime-p.time<=1.8).map(p=>{
    const age=eventTime-p.time,t=clamp(age/.16),out=clamp((age-.25)/1.55);
    return {...p,x:(p.x*w-originX)/ratio,y:(p.y*h-originY)/ratio,envelope:t*t*(3-2*t)*(1-out*out*(3-2*out))};
   });
   function sampleAt(cx,cy){
    const key=cx+':'+cy;let sample=cache.get(key);
    if(sample===undefined){
     const u0=cx*cell/cssHeight,v0=cy*cell/cssHeight;
     let warpX=0,warpY=0;
     for(const p of packets){
      const dx=(cx*cell-p.x)/100,dy=(cy*cell-p.y)/65;
      const weight=Math.exp(-(dx*dx+dy*dy)*1.5)*p.envelope*p.strength*70/cssHeight;
      warpX+=((p.dx??1)-dy*.35)*weight;warpY+=((p.dy??0)+dx*.35)*weight;
     }
     const u=u0+warpX,v=v0+warpY;let sum=1,freq=1;
     for(let octave=0;octave<5;octave++){sum+=noise((u*params.scale+offset)*freq,(v*params.scale+offset*.317)*freq,time*.05*freq);freq*=1.25;}
     let feed=(sum*.5+.5)*.5-.65+(params.density-.5)*.3;
     feed+=params.ecosystem*noise(u*6+offset*.19,v*6+offset*.41,time*.04);
     feed=Math.max(feed,.07+.045*noise(u*14+offset,v*14+offset,time*.03));
     feed=battlePatternFeed(u*Math.max(.2,params.scale/.25),v*Math.max(.2,params.scale/.25),time,pattern,feed);
     feed+=holderClusterFeed(cx*cell/cssWidth,cy*cell/cssHeight,cssWidth/cssHeight,params.holderGroups);
     sample={feed,warpX,warpY};cache.set(key,sample);
    }
    return sample;
   }
   const identity=identityMask?params.identity:0;
   const pixelPresence=clamp(params.pixelPresence??1);
   const markDirection=Number(params.markDirection)||0;
   const firstX=Math.floor(-originX/grid),firstY=Math.floor(-originY/grid);
   const lastX=Math.ceil((w-originX)/grid),lastY=Math.ceil((h-originY)/grid);
   let previousInk=-1;
   // Share the shader's integer lattice and bottom-up origin. Cell ownership
   // and mark bounds agree even when either canvas dimension is odd.
   for(let py=firstY;py<lastY;py++)for(let px=firstX;px<lastX;px++){
    if(pixelPresence<=.0001||hash(px*73.17+py*193.41+7.3)>pixelPresence)continue;
    const fx=(px+.5)*cellSize,fy=(py+.5)*cellSize;
    const centerX=originX+fx*ratio,centerY=originY+fy*ratio;
    const edge=Math.min(centerX/w,1-centerX/w,centerY/h,1-centerY/h);
    const edgeT=params.edgeFade>0?clamp(edge/params.edgeFade):1;
    const taper=edgeT*edgeT*(3-2*edgeT);
    if(edge<=0||taper<=.015)continue;
    // Sparse stable perimeter: shrink and remove cells rather than draw a rim.
    if(hash(px*127.1+py*311.7+19.7)>taper*taper)continue;
    // Snap the source cell first, then displace its sample continuously so
    // small liquid movement survives without moving the square lattice.
    const sx=fx/cell,sy=fy/cell,cx=Math.floor(sx),cy=Math.floor(sy),tx=fract(sx),ty=fract(sy);
    const a=sampleAt(cx,cy),b=sampleAt(cx+1,cy),cc=sampleAt(cx,cy+1),dd=sampleAt(cx+1,cy+1);
    const sample={};for(const name of ['feed','warpX','warpY'])sample[name]=mix(mix(a[name],b[name],tx),mix(cc[name],dd[name],tx),ty);
    let feed=sample.feed;
    let maskInk=0;
    if(identity>0){
     maskInk=identityInk(identityMask,fx+sample.warpX*cssHeight*(1-identity),fy+sample.warpY*cssHeight*(1-identity),cssWidth,cssHeight,time,offset,params);
     const imageFeed=mix(-.05,1.05,maskInk);
     feed=mix(feed,imageFeed,identity);
    }
    if(feed+b8(px,py)-.5<.5)continue;
    const jitter=1+(hash(px*127.1+py*311.7)-.5)*params.jitter;
    const backgroundScale=mix(1,.7+.3*maskInk,identity);
    const localSize=1; // Wallet-driven jitter owns size variation.
    const dotSize=(params.dotSize*localSize*jitter*backgroundScale*Math.sqrt(pixelPresence))*taper;
    const diameter=Math.max(1,Math.round(dotSize*ratio));
    const left=Math.round(centerX-diameter*.5),bottom=Math.round(centerY-diameter*.5),top=h-bottom-diameter;
    const x0=Math.max(0,left),y0=Math.max(0,top),x1=Math.min(w,left+diameter),y1=Math.min(h,top+diameter);
    if(x1<=x0||y1<=y0)continue;
    const radius=diameter*.5,halfStroke=Math.max(1,Math.round(diameter*.23))*.5;
    const directed=diameter>=3&&markDirection!==0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
     const dx=x-left+.5-radius,dy=y-top+.5-radius;
     const inside=!directed?dx*dx+dy*dy<=radius*radius
      :markDirection>0?Math.min(Math.abs(dx),Math.abs(dy))<=halfStroke
      :Math.abs(Math.abs(dx)-Math.abs(dy))*.70710678<=halfStroke;
     if(!inside)continue;
     const index=y*w+x;counts[index]=Math.min(2,counts[index]+1);
    }
   }
   let occupied=0;
   for(let n=0;n<counts.length;n++)if(counts[n]){
    occupied++;const ink=(params.inkColor??1)*255,i=n*4;
    output.data[i]=output.data[i+1]=output.data[i+2]=ink;output.data[i+3]=255;
   }
   lastCoverage=occupied/counts.length;
   layerContext.putImageData(output,0,0);ctx.drawImage(layerCanvas,0,0);
   canvas.hidden=false;
   Object.assign(canvas.dataset,{renderer:'canvas',density:params.density.toFixed(3),pixelSize:params.pixelSize.toFixed(3),basePixelSize:params.pixelSize.toFixed(3),cellSize:cellSize.toFixed(3),dotSize:params.dotSize.toFixed(3),dotStrength:params.dotStrength.toFixed(3),patternScale:params.scale.toFixed(3),speed:params.speed.toFixed(3),edgeFade:params.edgeFade.toFixed(3),ecosystem:params.ecosystem.toFixed(3),jitter:params.jitter.toFixed(3),ripples:String(params.ripples?ripples.length:0),rippleIntensity:params.rippleIntensity.toFixed(3),rippleSpeed:params.rippleSpeed.toFixed(3),rippleThickness:params.rippleThickness.toFixed(3),liquid:String(params.liquid),liquidStrength:params.liquidStrength.toFixed(3),liquidRadius:params.liquidRadius.toFixed(3),liquidWobbleSpeed:params.liquidWobbleSpeed.toFixed(3),noiseAmount:params.noiseAmount.toFixed(3),balance:params.balance.toFixed(3),direction:params.direction.toFixed(3),identity:identity.toFixed(3),identityMotion:params.identityMotion.toFixed(3),identityImage:String(!!identityMask)});
  },
  clear(){ctx?.clearRect(0,0,canvas.width,canvas.height);},
  close(){identityMask=null;canvas.remove();}
 };
}
