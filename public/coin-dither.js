// Restore the original ordered dither: fine charcoal dots, with light tones
// lifted slightly so the source remains recognisable. Keep every edge opaque.
export const BAYER=[0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
export function ditherPixels(source,width,height){
 const out=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,threshold=(BAYER[(y%8)*8+x%8]+.5)/64;
  const alpha=source[i+3]/255;
  const luminance=((source[i]*.2126+source[i+1]*.7152+source[i+2]*.0722)*alpha+255*(1-alpha))/255;
  const ink=Math.pow(luminance,.88)>threshold?255:17;
  out[i]=out[i+1]=out[i+2]=ink;
  out[i+3]=255;
 }
 return out;
}

// A CSS filter can process a cross-origin image that canvas may not read.
// Keep the source inside the filter: there is no feImage request, repeated tile,
// or exposed threshold overlay. White stays white and black stays black.
function opaqueDitherFilter(){
 const id='upic-opaque-image-dither';
 if(!document.getElementById(id)){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');
  svg.style.cssText='position:absolute;pointer-events:none;overflow:hidden';
  svg.innerHTML=`<defs><filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
   <feFlood flood-color="white" result="paper"/>
   <feComposite in="SourceGraphic" in2="paper" operator="over" result="opaque"/>
   <feColorMatrix in="opaque" type="saturate" values="0" result="gray"/>
   <feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="1" seed="1917" stitchTiles="stitch" result="noise"/>
   <feColorMatrix in="noise" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="mono-noise"/>
   <feComponentTransfer in="mono-noise" result="grain">
    <feFuncR type="linear" slope="3" intercept="-1"/><feFuncG type="linear" slope="3" intercept="-1"/><feFuncB type="linear" slope="3" intercept="-1"/>
   </feComponentTransfer>
   <feComposite in="gray" in2="grain" operator="arithmetic" k2="1" k3=".9" k4="-.45" result="threshold"/>
   <feComponentTransfer in="threshold">
    <feFuncR type="discrete" tableValues="0 1"/><feFuncG type="discrete" tableValues="0 1"/><feFuncB type="discrete" tableValues="0 1"/><feFuncA type="linear" slope="0" intercept="1"/>
   </feComponentTransfer>
  </filter></defs>`;
  document.body.append(svg);
 }
 return `url(#${id})`;
}

export function createCoinDither(img,fallback){
 const host=img.parentElement,canvas=document.createElement('canvas');canvas.className='coin-dither';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;host.append(canvas);
 const context=canvas.getContext('2d');
 for(const element of [img,canvas]){element.style.opacity='1';element.style.maskImage='none';element.style.webkitMaskImage='none';}
 canvas.style.imageRendering='pixelated';
 let serial=0,current='',decodedImage=null,size=0,resizeFrame=0;
 function paint(decoded,force=false){
  if(!context)return false;
  // Match the original CSS-pixel dot spacing instead of making the pattern
  // progressively finer on Retina displays. The small logo retains 64px detail.
  const nextSize=Math.max(64,Math.min(256,Math.round(host.clientWidth||96)));
  if(!force&&nextSize===size)return true;
  const scratch=document.createElement('canvas');scratch.width=scratch.height=nextSize;const c=scratch.getContext('2d',{willReadFrequently:true});
  if(!c)throw new Error('Image pixels unavailable');
  c.fillStyle='#fff';c.fillRect(0,0,nextSize,nextSize);
  const scale=Math.min(nextSize/decoded.width,nextSize/decoded.height),w=decoded.width*scale,h=decoded.height*scale;
  c.drawImage(decoded,(nextSize-w)/2,(nextSize-h)/2,w,h);
  const pixels=c.getImageData(0,0,nextSize,nextSize);
  pixels.data.set(ditherPixels(pixels.data,nextSize,nextSize));
  size=nextSize;canvas.width=canvas.height=size;context.putImageData(pixels,0,0);
  return true;
 }
 function load(url,token){
  img.hidden=true;canvas.hidden=true;fallback.hidden=false;decodedImage=null;delete host.dataset.dither;img.style.filter='none';
  if(!url){img.removeAttribute('src');return;}
  if(!context){original(url,token);return;}
  const decoded=new Image();decoded.crossOrigin='anonymous';decoded.referrerPolicy='no-referrer';
  decoded.onload=()=>{
   if(token!==serial)return;
   try{
    paint(decoded,true);decodedImage=decoded;canvas.hidden=false;fallback.hidden=true;host.dataset.dither='pixels';
   }catch{original(url,token);}
  };
  decoded.onerror=()=>{if(token===serial)original(url,token);};decoded.src=url;
 }
 // No proxy, re-upload, canvas read, or fade is needed for restricted hosts.
 function original(url,token){
  decodedImage=null;canvas.hidden=true;img.removeAttribute('crossorigin');
  img.onload=()=>{if(token!==serial)return;img.style.filter=opaqueDitherFilter();img.hidden=false;fallback.hidden=true;host.dataset.dither='filter';};
  img.onerror=()=>{if(token!==serial)return;img.hidden=true;fallback.hidden=false;delete host.dataset.dither;};img.src=url;
 }
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{
  if(!decodedImage||resizeFrame)return;
  resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;if(decodedImage)try{paint(decodedImage);}catch{original(current,serial);}});
 }):null;observer?.observe(host);
 return {
  set(url){url=String(url||'');if(url===current&&host.dataset.dither)return;current=url;load(url,++serial);},
  close(){serial++;observer?.disconnect();if(resizeFrame)cancelAnimationFrame(resizeFrame);decodedImage=null;canvas.remove();}
 };
}
