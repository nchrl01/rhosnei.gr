// Fine serpentine error diffusion preserves image detail at device resolution.
// Clear near-white paper and near-black ink before diffusing the midtones.
// Composite onto white and keep every pixel opaque: no edge fade or reveal.
export function ditherPixels(source,width,height){
 const out=new Uint8ClampedArray(width*height*4);
 let row=new Float32Array(width+2),next=new Float32Array(width+2);
 for(let y=0;y<height;y++){
  const direction=y%2?-1:1,start=direction===1?0:width-1;
  for(let step=0;step<width;step++){
   const x=start+step*direction,i=(y*width+x)*4,alpha=source[i+3]/255;
   const luminance=(source[i]*.2126+source[i+1]*.7152+source[i+2]*.0722)*alpha+255*(1-alpha);
   const base=Math.max(0,Math.min(1,(luminance-16)/223));
   const tone=255*(.42+.58*Math.pow(base,.55));
   const gray=Math.max(0,Math.min(255,tone+row[x+1])),ink=gray>=128?255:0,error=gray-ink;
   row[x+direction+1]+=error*7/16;
   next[x-direction+1]+=error*3/16;next[x+1]+=error*5/16;next[x+direction+1]+=error/16;
   out[i]=out[i+1]=out[i+2]=ink;out[i+3]=255;
  }
  const previous=row;row=next;next=previous;next.fill(0);
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
   <feColorMatrix in="opaque" type="saturate" values="0" result="luminance"/>
   <feComponentTransfer in="luminance" result="gray">
    <feFuncR type="gamma" amplitude="1" exponent=".55" offset="0"/><feFuncG type="gamma" amplitude="1" exponent=".55" offset="0"/><feFuncB type="gamma" amplitude="1" exponent=".55" offset="0"/>
   </feComponentTransfer>
   <feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="1" seed="1917" stitchTiles="stitch" result="noise"/>
   <feColorMatrix in="noise" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="mono-noise"/>
   <feComponentTransfer in="mono-noise" result="grain">
    <feFuncR type="linear" slope="3" intercept="-1"/><feFuncG type="linear" slope="3" intercept="-1"/><feFuncB type="linear" slope="3" intercept="-1"/>
   </feComponentTransfer>
   <feComposite in="gray" in2="grain" operator="arithmetic" k2="1" k3=".24" k4="-.12" result="threshold"/>
   <feComponentTransfer in="threshold" result="binary">
    <feFuncR type="discrete" tableValues="0 1"/><feFuncG type="discrete" tableValues="0 1"/><feFuncB type="discrete" tableValues="0 1"/><feFuncA type="linear" slope="0" intercept="1"/>
   </feComponentTransfer>
   <feTurbulence type="fractalNoise" baseFrequency="1.35" numOctaves="1" seed="2303" result="paper-grain"/>
   <feColorMatrix in="paper-grain" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="paper-mono"/>
   <feComponentTransfer in="paper-mono" result="paper-holes">
    <feFuncR type="discrete" tableValues="0 0 0 0 0 1 1 1 1 1"/><feFuncG type="discrete" tableValues="0 0 0 0 0 1 1 1 1 1"/><feFuncB type="discrete" tableValues="0 0 0 0 0 1 1 1 1 1"/><feFuncA type="linear" slope="0" intercept="1"/>
   </feComponentTransfer>
   <feComposite in="binary" in2="paper-holes" operator="arithmetic" k2="1" k3="1"/>
  </filter></defs>`;
  document.body.append(svg);
 }
 return `url(#${id})`;
}

export function createCoinDither(img,fallback){
 const host=img.parentElement,canvas=document.createElement('canvas');canvas.className='coin-dither';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;host.append(canvas);
 const context=canvas.getContext('2d');
 for(const element of [img,canvas]){element.style.opacity='1';element.style.maskImage='none';element.style.webkitMaskImage='none';}
 canvas.style.imageRendering='auto';
 let serial=0,current='',decodedImage=null,size=0,resizeFrame=0;
 function paint(decoded,force=false){
  if(!context)return false;
  // Fine grain follows device resolution, including Retina phone artwork.
  const nextSize=Math.max(64,Math.min(512,Math.round((host.clientWidth||96)*Math.min(2,globalThis.devicePixelRatio||1))));
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
