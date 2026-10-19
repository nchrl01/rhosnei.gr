// Bayer grain with image-specific black and white points, without edge fading.
// All thumbnails share this treatment, independent of market-cap milestones.
export const BAYER=[0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
export function imageLevels(source){
 const histogram=new Float64Array(256);let weight=0;
 for(let i=0;i<source.length;i+=4){
  const alpha=source[i+3]/255;if(alpha<=0)continue;
  const luminance=Math.round(source[i]*.2126+source[i+1]*.7152+source[i+2]*.0722);
  histogram[luminance]+=alpha;weight+=alpha;
 }
 if(!weight)return {black:0,white:255};
 const percentile=fraction=>{let cumulative=0;for(let n=0;n<256;n++){cumulative+=histogram[n];if(cumulative>=weight*fraction)return n;}return 255;};
 const black=percentile(.005),white=percentile(.995);
 // Flat artwork has no useful tonal range to stretch.
 return white-black>=16?{black,white}:{black:0,white:255};
}
export function ditherPixels(source,width,height){
 const out=new Uint8ClampedArray(width*height*4);
 const {black,white}=imageLevels(source),range=white-black;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,threshold=(BAYER[(y%8)*8+x%8]+.5)/64;
  const luminance=Math.max(0,Math.min(1,(source[i]*.2126+source[i+1]*.7152+source[i+2]*.0722-black)/range));
  const ink=Math.pow(luminance,.88)>threshold?255:17;
  out[i]=out[i+1]=out[i+2]=ink;
  out[i+3]=source[i+3];
 }
 return out;
}
// Keep field artwork independent of the avatar's display size. Contain the
// original aspect ratio and composite transparency onto the same white ground.
export function coinImagePixels(image,size=256){
 const width=Number(image.naturalWidth||image.width),height=Number(image.naturalHeight||image.height);
 if(!(width>0&&height>0))throw Error('Coin artwork has no decoded dimensions');
 const scratch=document.createElement('canvas');scratch.width=scratch.height=size;
 const context=scratch.getContext('2d',{willReadFrequently:true});
 const scale=Math.min(size/width,size/height),w=width*scale,h=height*scale;
 context.drawImage(image,(size-w)/2,(size-h)/2,w,h);
 // Preserve original colours and alpha for the field's palette before the
 // avatar's white paper ground is added.
 const originalPixels=context.getImageData(0,0,size,size).data;
 context.globalCompositeOperation='destination-over';context.fillStyle='#fff';context.fillRect(0,0,size,size);
 return {pixels:context.getImageData(0,0,size,size).data,originalPixels,width:size,height:size};
}
export function createCoinDither(img,fallback,{onPixels=()=>{},onUnavailable=()=>{}}={}){
 const host=img.parentElement,canvas=document.createElement('canvas');canvas.className='coin-dither';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;host.append(canvas);
 const context=canvas.getContext('2d');
 let serial=0,current='',currentKey='',pixels=null,size=96,stopReveal=()=>{},stopImageLoad=()=>{};
 // Share the decoded source once; the field never fetches or reads it per frame.
 function notify(image){try{onPixels(image);}catch(error){console.warn('Coin artwork unavailable to the visual field:',error.message);}}
 function paint(){if(!pixels)return;context.putImageData(new ImageData(ditherPixels(pixels,size,size),size,size),0,0);}
 function load(url,token){
  stopImageLoad();stopReveal();img.hidden=true;canvas.hidden=true;fallback.hidden=false;pixels=null;img.style.filter='none';notify(null);
  if(!url){img.removeAttribute('src');return;}
  let loadTimer,finished=false;
  const decoded=new Image();stopImageLoad=()=>{finished=true;clearTimeout(loadTimer);decoded.onload=decoded.onerror=null;};decoded.crossOrigin='anonymous';decoded.referrerPolicy='no-referrer';
  decoded.onload=()=>{
   clearTimeout(loadTimer);if(token!==serial||finished)return;
   try{
    size=Math.max(64,Math.min(256,Math.round(host.clientWidth||96)));canvas.width=canvas.height=size;
    const fieldImage=coinImagePixels(decoded);
    pixels=(size===fieldImage.width?fieldImage:coinImagePixels(decoded,size)).pixels;
    canvas.hidden=false;fallback.hidden=true;host.dataset.dither='pixels';canvas.style.filter='none';stopReveal=ditherReveal(canvas,pixels,size,size,host);finished=true;notify(fieldImage);
   }catch{relayOrFallback();}
  };
  let relayed=false;
  function relayOrFallback(){
   clearTimeout(loadTimer);if(token!==serial||finished)return;
   let relay='';try{const source=new URL(url);if(['cdn.dexscreener.com','coin-images.coingecko.com','assets.coingecko.com'].includes(source.hostname))relay='https://upic-insightx.nchrl01.workers.dev/artwork?revision=2&url='+encodeURIComponent(source.href);}catch{}
   if(relay&&!relayed){relayed=true;start(relay);return;}
   finished=true;decoded.onload=decoded.onerror=null;original(url,token);
  }
  function start(source){loadTimer=setTimeout(relayOrFallback,12000);decoded.src=source;}
  decoded.onerror=relayOrFallback;start(url);
 }
 // A missing readable image uses the placeholder while metadata fallback
 // resolves another source. Never show a second dithering style.
 function original(url,token){
  if(token!==serial)return;
  img.hidden=true;canvas.hidden=true;fallback.hidden=false;host.dataset.dither='unavailable';
  try{onUnavailable(url);}catch{}
 }

 return {set(url,key=''){if(url===current&&key===currentKey)return;current=url;currentKey=key;load(url,++serial);},close(){serial++;stopImageLoad();stopReveal();canvas.remove();}};
}

// Reveal the source through ordered pixel holes, rather than an opacity fade.
export function ditherReveal(canvas,source,width,height,host=canvas.parentElement){
 const ctx=canvas.getContext('2d'),dither=ditherPixels(source,width,height),frame=new ImageData(width,height);
 let amount=0,target=0,raf=0,last=0;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 function paint(){for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,threshold=(BAYER[(y%8)*8+x%8]+.5)/64,data=amount>threshold?source:dither;
  frame.data[i]=data[i];frame.data[i+1]=data[i+1];frame.data[i+2]=data[i+2];frame.data[i+3]=data[i+3];
 }ctx.putImageData(frame,0,0);}
 function tick(now){raf=0;if(!canvas.isConnected)return;const dt=last?Math.min(40,now-last):16;last=now;amount+=Math.sign(target-amount)*Math.min(Math.abs(target-amount),dt/420);paint();if(amount!==target)raf=requestAnimationFrame(tick);}
 function set(value){target=value;if(reduced.matches){amount=value;paint();return;}if(!raf){last=0;raf=requestAnimationFrame(tick);}}
 const enter=()=>set(1),leave=()=>set(0);host.addEventListener('pointerenter',enter);host.addEventListener('pointerleave',leave);host.addEventListener('focusin',enter);host.addEventListener('focusout',leave);paint();
 return ()=>{cancelAnimationFrame(raf);host.removeEventListener('pointerenter',enter);host.removeEventListener('pointerleave',leave);host.removeEventListener('focusin',enter);host.removeEventListener('focusout',leave);};
}
export function attachArtworkDither(img){
 if(img.dataset.artworkDitherAttached==='true')return;
 img.dataset.artworkDitherAttached='true';
 img.draggable=false;img.addEventListener('dragstart',e=>e.preventDefault());
 const host=img.parentElement;host.classList.add('dither-artwork','dither-pending');
 // Hide the original in this same render task, before a cached image can flash.
 // The local mark also covers missing images or a provider that never responds.
 const fallback=document.createElement('span'),mark=document.createElement('img');
 fallback.className='artwork-fallback';fallback.setAttribute('aria-hidden','true');
 mark.src=new URL('./upic-logo-transparent.svg?v=116',import.meta.url).href;mark.alt='';mark.draggable=false;fallback.append(mark);host.append(fallback);
 let processing=false,finished=false,timeout,decoded;
 function cleanup(){clearTimeout(timeout);img.removeEventListener('load',ready);img.removeEventListener('error',failed);if(decoded){decoded.onload=null;decoded.onerror=null;}}
 function failed(){
  if(finished)return;finished=true;cleanup();host.classList.remove('dither-pending');
  // Canvas access may fail while the source itself is usable. Retain that
  // artwork in monochrome; a missing source keeps the local placeholder.
  if(img.naturalWidth&&img.getAttribute('src')){img.style.filter='grayscale(1)';fallback.remove();}
 }
 function ready(){
  if(finished||processing||!img.naturalWidth||!img.isConnected)return;
  processing=true;timeout=setTimeout(failed,12000);
  decoded=new Image();decoded.crossOrigin='anonymous';decoded.referrerPolicy='no-referrer';
  let relayed=false;
  function relayOrFail(){
   if(finished)return;
   if(!relayed){try{const url=new URL(img.currentSrc||img.src);if(['cdn.dexscreener.com','coin-images.coingecko.com','assets.coingecko.com','i2c.seadn.io','i.seadn.io'].includes(url.hostname)){relayed=true;decoded.src='https://upic-insightx.nchrl01.workers.dev/artwork?url='+encodeURIComponent(url.href);return;}}catch{}}
   failed();
  }
  decoded.onerror=relayOrFail;
  decoded.onload=()=>{if(finished)return;if(!img.isConnected){finished=true;cleanup();return;}let canvas;try{
   const size=Math.max(32,Math.min(240,Math.round(img.clientWidth||200)));canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.className='artwork-dither';canvas.setAttribute('aria-hidden','true');
   const ctx=canvas.getContext('2d',{willReadFrequently:true}),scale=Math.max(size/decoded.naturalWidth,size/decoded.naturalHeight);
   ctx.drawImage(decoded,(size-decoded.naturalWidth*scale)/2,(size-decoded.naturalHeight*scale)/2,decoded.naturalWidth*scale,decoded.naturalHeight*scale);
   const data=ctx.getImageData(0,0,size,size).data;ditherReveal(canvas,data,size,size,host.closest('.collection-card')||host);host.append(canvas);host.classList.add('dither-ready');host.classList.remove('dither-pending');fallback.remove();finished=true;cleanup();
  }catch{canvas?.remove();relayOrFail();}};
  decoded.src=img.currentSrc||img.src;
 }
 img.addEventListener('load',ready);img.addEventListener('error',failed);
 if(img.complete){if(img.naturalWidth)ready();else failed();}
}
