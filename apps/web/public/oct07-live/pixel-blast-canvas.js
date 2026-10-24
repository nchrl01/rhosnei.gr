import {originalArtworkPalette} from '../upic-artwork-palette.js';
import {battlePattern,battlePatternFeed} from './earthbound-pattern.js?v=427';
import {EARTHBOUND_LOOP_DURATION,TAU,loopTime,loopPhase} from './earthbound-loop.js?v=427';
import {earthboundMotionFrame,earthboundFieldWarp} from './earthbound-presentation.js?v=492';
import {holderClusterFeed} from './holder-cluster-field.js?v=169';
import {capitalFeed} from './capital-field.js?v=167';
// Canvas rendition of the PixelBlast noise/Bayer field for mobile and lost GPUs.
// Uses the same market parameters, seed and source clock as the shader.
// React Bits attribution/license: vendor/ui/REACT-BITS-LICENSE.md.
import {ditherPixels} from './coin-dither.js?v=217';
import {artworkForeground} from './artwork-foreground.js?v=391';
import {artworkBackgroundTone} from './artwork-background-tone.js?v=473';
const fract=x=>x-Math.floor(x);
const hash=n=>fract(Math.sin(n)*43758.5453);
const fade=x=>x*x*x*(x*(x*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=x=>Math.max(0,Math.min(1,x));
const b2=(x,y)=>fract(Math.floor(x)/2+Math.floor(y)**2*.75);
const b4=(x,y)=>b2(x*.5,y*.5)*.25+b2(x,y);
const b8=(x,y)=>b4(x*.5,y*.5)*.25+b2(x,y);
// Noise revisits the same integer corners across marks and adjacent frames.
// Cache their exact values in a bounded table, rather than repeat sine calls.
const noiseKeys=new Float64Array(4096).fill(NaN),noiseValues=new Float64Array(4096);
function noiseHash(n){const index=n&4095;if(noiseKeys[index]!==n){noiseKeys[index]=n;noiseValues[index]=hash(n);}return noiseValues[index];}
function noise(x,y,z){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),n=ix+iy*57+iz*113;
 const a=fade(fract(x)),b=fade(fract(y)),c=fade(fract(z));
 return mix(mix(mix(noiseHash(n),noiseHash(n+1),a),mix(noiseHash(n+57),noiseHash(n+58),a),b),mix(mix(noiseHash(n+113),noiseHash(n+114),a),mix(noiseHash(n+170),noiseHash(n+171),a),b),c)*2-1;
}
// Prepare once when coin artwork changes, using the same image levels and
// Bayer grain as the coin avatar. Select the subject, rather than always
// treating a dark background as ink on the black stage.
export function preparePixelIdentity(source){
 const width=Math.floor(Number(source?.width)),height=Math.floor(Number(source?.height)),pixels=source?.originalPixels||source?.pixels;
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
 const foreground=artworkForeground(rgba,w,h),dither=ditherPixels(rgba,w,h),data=new Uint8Array(w*h);
 for(let n=0;n<data.length;n++)data[n]=foreground.polarity==='alpha'||(foreground.polarity==='light'?dither[n*4]>=128:dither[n*4]<128)?rgba[n*4+3]:0;
 // A separate smooth artwork mask controls size only; selection keeps its
 // original dither mask so changing liquidity cannot move or remove marks.
 const sizeData=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let sum=0,n=0;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;
   sum+=data[yy*w+xx]/255;n++;
  }
  sizeData[y*w+x]=sum/n;
 }
 const palette=originalArtworkPalette(rgba,{includeNeutrals:true}),colors=new Float32Array(w*h*3);
 for(let n=0;n<w*h;n++){
  const i=n*4,r=rgba[i]/255,g=rgba[i+1]/255,b=rgba[i+2]/255;
  const distance=c=>(r-c[0])**2+(g-c[1])**2+(b-c[2])**2;
  const primary=distance(palette[0])<distance(palette[1])?palette[0]:palette[1];
  const peak=Math.max(...primary),level=Math.max(.4,Math.sqrt(peak));
  for(let c=0;c<3;c++)colors[n*3+c]=peak>.001?primary[c]/peak*level:.4;
 }
 const backgroundTone=artworkBackgroundTone(rgba,w,h);
 return {width:w,height:h,data,sizeData,rgba,palette,colors,backgroundTone,...foreground};
}
function identityInk(mask,fx,fy,w,h,time,offset,params){
 const side=(params.fullscreen?Math.max(w,h):.82*Math.min(w,h)),x=fx/side,y=fy/side;
 const flow=((1-params.identity)*.1+.012)*params.identityMotion,phase=time*.65+offset*.013;
 const u=.5+x+(flow?(Math.sin(y*9+phase)+.35*Math.sin(x*5-phase*.7))*flow:0);
 const v=.5-y+(flow?(Math.sin(x*8-phase*.85)+.3*Math.sin(y*5+phase*.6))*flow:0);
 if(u<0||v<0||u>=1||v>=1)return 0;
 return mask.data[Math.floor(v*mask.height)*mask.width+Math.floor(u*mask.width)]/255;
}
export function createPixelBlastCanvas(host){
 const canvas=document.createElement('canvas');canvas.className='pixel-blast-layer pixel-blast-software';canvas.setAttribute('aria-hidden','true');canvas.style.width='100%';canvas.style.height='100%';host.append(canvas);
 const ctx=canvas.getContext('2d',{alpha:true});let identityMask=null,counts=null,accents=null,output=null,lastCoverage=0,geometryKey=null,geometry=[];
 const layerCanvas=document.createElement("canvas"),layerContext=layerCanvas.getContext("2d");
 const candidates=[],sampleCache=new Map();let sampleFrame=0,occupiedPixels=null;
 return {
  canvas,
  coverage(){return lastCoverage;},
  setImage(mask){identityMask=mask;Object.assign(canvas.dataset,{maskPolarity:mask?.polarity||'none',maskConfidence:(mask?.confidence||0).toFixed(3),maskBackground:mask?.background?.map(Math.round).join(',')||'unknown',backgroundTone:mask?.backgroundTone?.kind||'none',backgroundToneConfidence:(mask?.backgroundTone?.confidence||0).toFixed(3)});},
  render({width,height,time=0,liquidTime,eventTime=0,seed=0,params,dither=false,ripples=[],preserve=false}){
   if(!ctx)return;
   time=loopTime(time);
   const angle=loopPhase(time),orbitX=(Math.cos(angle)-1)*EARTHBOUND_LOOP_DURATION/TAU,orbitZ=Math.sin(angle)*EARTHBOUND_LOOP_DURATION/TAU;
   const viewWidth=Math.max(1,Number(width)||1),viewHeight=Math.max(1,Number(height)||1);
   const dpr=Math.min(Math.max(1,globalThis.devicePixelRatio||1),2,Math.sqrt((params.pixelBudget||1.2e6)/(viewWidth*viewHeight)));
   const w=Math.max(1,Math.floor(viewWidth*dpr)),h=Math.max(1,Math.floor(viewHeight*dpr));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   if(!preserve)ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;ctx.globalCompositeOperation="source-over";
   if(!output||output.width!==w||output.height!==h){output=ctx.createImageData(w,h);counts=new Uint8Array(w*h);accents=new Uint8Array(w*h);occupiedPixels=new Uint32Array(w*h);layerCanvas.width=w;layerCanvas.height=h;}
   counts.fill(0);accents.fill(0);output.data.fill(0);
   let occupied=0;sampleFrame++;
   const requested=Math.max(0,Math.round(params.holderCount||0));
   const cellSize=requested?Math.min(params.cellSize,Math.sqrt(viewWidth*viewHeight/(requested*3))):params.cellSize,grid=Math.max(2,Math.round(cellSize*dpr)),ratio=grid/cellSize;
   const cssWidth=w/ratio,cssHeight=h/ratio,originX=Math.floor(w/2),originY=Math.floor(h/2);
   const pattern=battlePattern(params.patternKey??seed,time);
   const cell=Math.max(12,Math.min(24,Number(params.patternSampleSize)||16)),offset=(seed%65521)/65521*173.6;
   const presentationMotion=earthboundMotionFrame(time,seed,params),patternContrast=Math.max(1,Math.min(2.5,Number(params.patternContrast)||1));
   const noiseOctaves=Math.max(1,Math.min(5,Math.round(Number(params.patternNoiseOctaves)||5)));
   const selectionNoise=params.selectionNoise==null?1:clamp(params.selectionNoise);
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
   function samplePoint(cx,cy){
    const key=cx+cy*65536;let sample=sampleCache.get(key);
    if(sample===undefined){sample={cx,cy,frame:0,feed:0,warpX:0,warpY:0};sampleCache.set(key,sample);}
    return sample;
   }
   function sampleAt(sample){
    if(sample.frame!==sampleFrame){
     const {cx,cy}=sample;
     const u0=cx*cell/cssHeight,v0=cy*cell/cssHeight;
     let warpX=0,warpY=0;
     for(const p of packets){
      const dx=(cx*cell-p.x)/100,dy=(cy*cell-p.y)/65;
      const weight=Math.exp(-(dx*dx+dy*dy)*1.5)*p.envelope*p.strength*70/cssHeight;
      warpX+=((p.dx??1)-dy*.35)*weight;warpY+=((p.dy??0)+dx*.35)*weight;
     }
     const [u,v]=earthboundFieldWarp(u0+warpX,v0+warpY,presentationMotion);let sum=1,freq=1;
     for(let octave=0;octave<noiseOctaves;octave++){sum+=noise((u*params.scale+offset+orbitX*.05)*freq,(v*params.scale+offset*.317)*freq,orbitZ*.05*freq);freq*=1.25;}
     let feed=(sum*.5+.5)*.5-.65+(params.density-.5)*.3;
     feed+=params.ecosystem*noise(u*6+offset*.19+orbitX*.04,v*6+offset*.41,orbitZ*.04);
     feed=Math.max(feed,.07+.045*noise(u*14+offset+orbitX*.03,v*14+offset,orbitZ*.03));
     feed=battlePatternFeed(u*Math.max(.2,params.scale/.25),v*Math.max(.2,params.scale/.25),time,pattern,feed);
     feed=.5+(feed-.5)*patternContrast;
     feed+=holderClusterFeed(cx*cell/cssWidth,cy*cell/cssHeight,cssWidth/cssHeight,params.holderGroups);
     sample.frame=sampleFrame;sample.feed=feed;sample.warpX=warpX;sample.warpY=warpY;
    }
    return sample;
   }
   const identity=identityMask?params.identity:0;
   const pixelPresence=clamp(params.pixelPresence??1);
   const markDirection=Number(params.markDirection)||0;
   const shapeWeights=params.shapeWeights||(markDirection>0?[0,1,0]:markDirection<0?[0,0,1]:[1,0,0]);
   // A morph still contains the dot shape. Keep it in the artwork palette
   // until it resolves to an actual plus or cross; tiny marks always rasterize
   // as circles below and must never receive a directional accent.
   const accentDirection=shapeWeights[0]===0?(shapeWeights[1]===1?1:shapeWeights[2]===1?-1:0):0;
   const firstX=Math.floor(-originX/grid),firstY=Math.floor(-originY/grid);
   const lastX=Math.ceil((w-originX)/grid),lastY=Math.ceil((h-originY)/grid);
   candidates.length=0;
   const nextGeometryKey=[w,h,grid,cellSize,cell,seed,params.edgeFade,pixelPresence,requested].join(':');
   if(nextGeometryKey!==geometryKey){
    geometryKey=nextGeometryKey;geometry=[];sampleCache.clear();
    for(let py=firstY;py<lastY;py++)for(let px=firstX;px<lastX;px++){
    if(pixelPresence<=.0001||hash(px*73.17+py*193.41+7.3)>pixelPresence)continue;
    const fx=(px+.5)*cellSize,fy=(py+.5)*cellSize;
    // Position directly on the integer backing-pixel lattice. Multiplying
    // fractional source cells by their reciprocal scale drifts around .5,
    // making Math.round alternate between narrower and wider row gaps.
    const centerX=originX+(px+.5)*grid,centerY=originY+(py+.5)*grid;
    const edge=Math.min(centerX/w,1-centerX/w,centerY/h,1-centerY/h);
    const edgeT=params.edgeFade>0?clamp(edge/params.edgeFade):1;
    let taper=edgeT*edgeT*(3-2*edgeT);
    if(requested&&params.edgeFade>0){
     // Blend all four edges instead of selecting the nearest one (square rings).
     const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
     const nx=centerX/w,ny=centerY/h;
     const variation=.9+.18*noise(nx*4+offset,ny*4+offset*.31,0);
     const reach=params.edgeFade*variation;
     taper=smooth(nx/reach)*smooth((1-nx)/reach)*smooth(ny/reach)*smooth((1-ny)/reach);
    }
    if(edge<=0||(!requested&&taper<=.015))continue;
    const sx=fx/cell,sy=fy/cell,cx=Math.floor(sx),cy=Math.floor(sy);
    geometry.push({px,py,fx,fy,centerX,centerY,taper,tx:fract(sx),ty:fract(sy),a:samplePoint(cx,cy),b:samplePoint(cx+1,cy),c:samplePoint(cx,cy+1),d:samplePoint(cx+1,cy+1),threshold:hash(px*73.17+py*193.41+seed*.37),accent:hash(px*157.31+py*97.13+seed*.113)<.2});
    }
   }
   for(const mark of geometry){
    const {px,py,fx,fy,centerX,centerY,taper,threshold,accent}=mark;
    // Sparse stable perimeter: shrink and remove cells rather than draw a rim.
    if(!requested&&hash(px*127.1+py*311.7+19.7)>taper*taper)continue;
    // Snap the source cell first, then displace its sample continuously so
    // small liquid movement survives without moving the square lattice.
    const {tx,ty}=mark;
    const a=sampleAt(mark.a),b=sampleAt(mark.b),cc=sampleAt(mark.c),dd=sampleAt(mark.d);
    let feed=mix(mix(a.feed,b.feed,tx),mix(cc.feed,dd.feed,tx),ty);
    const warpX=mix(mix(a.warpX,b.warpX,tx),mix(cc.warpX,dd.warpX,tx),ty),warpY=mix(mix(a.warpY,b.warpY,tx),mix(cc.warpY,dd.warpY,tx),ty);
    let maskInk=0;
    if(identity>0){
     maskInk=identityInk(identityMask,fx+warpX*cssHeight*(1-identity),fy+warpY*cssHeight*(1-identity),cssWidth,cssHeight,time,offset,params);
     const imageFeed=mix(-.05,1.05,maskInk);
     feed=mix(feed,imageFeed,identity);
    }
    if(!requested&&feed+b8(px,py)-.5<.5)continue;
    // Artwork, edge taper and jitter choose occupancy, never mark dimensions.
    // Keep at least one physical pixel of separation on every lattice path.
    const diameter=Math.min(Math.max(1,grid-1),Math.max(1,Math.round(params.dotSize*ratio)));
    // A stable continuous threshold avoids Bayer tiles turning into solid blocks
    // when selecting an exact population. Pattern motion still drives feed.
    const score=feed+(threshold-.5)*selectionNoise+Math.log(Math.max(.000001,taper*taper))*.35;
    mark.diameter=diameter;mark.score=score;candidates.push(mark);
   }
   // Partition the highest-scoring population without sorting every cell.
   if(requested&&requested<candidates.length){
    let lo=0,hi=candidates.length-1;const target=requested-1;
    while(lo<hi){
     const pivot=candidates[(lo+hi)>>>1].score;let i=lo,j=hi;
     while(i<=j){
      while(candidates[i].score>pivot)i++;
      while(candidates[j].score<pivot)j--;
      if(i<=j){const swap=candidates[i];candidates[i++]=candidates[j];candidates[j--]=swap;}
     }
     if(target<=j)hi=j;else if(target>=i)lo=i;else break;
    }
   }
   const selectedCount=requested?Math.min(requested,candidates.length):candidates.length;
   canvas.dataset.markCount=String(selectedCount);
   let accentMarkCount=0,minDiameter=Infinity,maxDiameter=0;
   for(let selectedIndex=0;selectedIndex<selectedCount;selectedIndex++){
    const {centerX,centerY,diameter,accent}=candidates[selectedIndex];
    if(diameter<minDiameter)minDiameter=diameter;if(diameter>maxDiameter)maxDiameter=diameter;
    const accentGlyph=accent&&diameter>=3&&accentDirection!==0;
    if(accentGlyph)accentMarkCount++;
    const left=Math.round(centerX-diameter*.5),bottom=Math.round(centerY-diameter*.5),top=h-bottom-diameter;
    const x0=Math.max(0,left),y0=Math.max(0,top),x1=Math.min(w,left+diameter),y1=Math.min(h,top+diameter);
    if(x1<=x0||y1<=y0)continue;
    const radius=diameter*.5,halfStroke=Math.max(1,Math.round(diameter*.23))*.5;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
     const dx=x-left+.5-radius,dy=y-top+.5-radius;
     const weights=shapeWeights;
     const inside=diameter<3?dx*dx+dy*dy<=radius*radius:
      (Math.hypot(dx,dy)-radius)*weights[0]+(Math.min(Math.abs(dx),Math.abs(dy))-halfStroke)*weights[1]+(Math.abs(Math.abs(dx)-Math.abs(dy))*.70710678-halfStroke)*weights[2]<=0;
     if(!inside)continue;
     const index=y*w+x;if(!counts[index])occupiedPixels[occupied++]=index;
     counts[index]=Math.min(2,counts[index]+1);if(accentGlyph)accents[index]=Math.min(2,accents[index]+1);
    }
   }
   canvas.dataset.accentMarkCount=String(accentMarkCount);
   canvas.dataset.markDiameterRange=selectedCount?minDiameter+','+maxDiameter:'0,0';
   const ink=(params.inkColor??1)*255,color=clamp(params.artworkColor||0);
   const side=params.fullscreen?Math.max(w,h):.82*Math.min(w,h),mask=identityMask;
   // Only pixels belonging to resolved directional glyphs carry an accent.
   // Dots, including small-size fallbacks and every transitional shape, retain
   // the existing baseline/milestone palette.
   const accentR=(accentDirection>0?81:255)/255,accentG=(accentDirection>0?215:102)/255,accentB=(accentDirection>0?123:114)/255;
   for(let pixel=0;pixel<occupied;pixel++){
    const n=occupiedPixels[pixel],i=n*4;let r=1,g=1,b=1,quiet=0;
    if(mask&&(color||identity>0&&mask.backgroundTone?.empty)){
     const px=n%w,py=Math.floor(n/w);
     const u=.5+(px-w/2)/side,v=.5+(py-h/2)/side;
     if(u>=0&&u<1&&v>=0&&v<1){
      const m=Math.floor(v*mask.height)*mask.width+Math.floor(u*mask.width),amount=color*mask.rgba[m*4+3]/255,c=m*3;
      if(color&&mask.colors){r=mix(1,mask.colors[c],amount);g=mix(1,mask.colors[c+1],amount);b=mix(1,mask.colors[c+2],amount);}
      quiet=(mask.backgroundTone?.empty?.[m]||0)/255*(mask.backgroundTone?.confidence||0)*clamp(identity);
     }
    }
    if(accents[n]){const amount=Math.min(1,accents[n]/counts[n]);r=mix(r,accentR,amount);g=mix(g,accentG,amount);b=mix(b,accentB,amount);}
    // Subtle tone only: retain every holder mark and its liquidity-driven size.
    // Outside-image ripple grain and uncertain photos keep their original ink.
    // Preserve full directional accents so rising/falling market cues stay clear.
    const tone=1-.42*quiet*(1-(accents[n]?Math.min(1,accents[n]/counts[n]):0));
    output.data[i]=ink*r*tone;output.data[i+1]=ink*g*tone;output.data[i+2]=ink*b*tone;output.data[i+3]=255;
   }
   lastCoverage=occupied/counts.length;
   layerContext.putImageData(output,0,0);ctx.drawImage(layerCanvas,0,0);
   canvas.hidden=false;
   Object.assign(canvas.dataset,{renderer:'canvas',density:params.density.toFixed(3),pixelSize:params.pixelSize.toFixed(3),basePixelSize:params.pixelSize.toFixed(3),cellSize:cellSize.toFixed(3),dotSize:params.dotSize.toFixed(3),dotStrength:params.dotStrength.toFixed(3),patternScale:params.scale.toFixed(3),speed:params.speed.toFixed(3),edgeFade:params.edgeFade.toFixed(3),ecosystem:params.ecosystem.toFixed(3),jitter:params.jitter.toFixed(3),ripples:String(params.ripples?ripples.length:0),rippleIntensity:params.rippleIntensity.toFixed(3),rippleSpeed:params.rippleSpeed.toFixed(3),rippleThickness:params.rippleThickness.toFixed(3),liquid:String(params.liquid),liquidStrength:params.liquidStrength.toFixed(3),liquidRadius:params.liquidRadius.toFixed(3),liquidWobbleSpeed:params.liquidWobbleSpeed.toFixed(3),noiseAmount:params.noiseAmount.toFixed(3),balance:params.balance.toFixed(3),direction:params.direction.toFixed(3),identity:identity.toFixed(3),identityMotion:params.identityMotion.toFixed(3),identityImage:String(!!identityMask)});
  },
  clear(){ctx?.clearRect(0,0,canvas.width,canvas.height);lastCoverage=0;canvas.dataset.markCount='0';canvas.dataset.accentMarkCount='0';},
  close(){identityMask=null;canvas.remove();}
 };
}
