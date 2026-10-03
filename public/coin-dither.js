// Sparse dotted contours on white paper. Keep compact dark details, such as
// pupils, while clearing broad flat fills. Alpha stays opaque at every edge.
export function ditherPixels(source,width,height){
 const count=width*height,gray=new Float32Array(count),strength=new Float32Array(count),angle=new Uint8Array(count),details=new Uint8Array(count),seen=new Uint8Array(count),out=new Uint8ClampedArray(count*4);
 for(let n=0;n<count;n++){const i=n*4,a=source[i+3]/255;gray[n]=(source[i]*.2126+source[i+1]*.7152+source[i+2]*.0722)*a+255*(1-a);}
 // Preserve only small isolated black features, never a whole silhouette.
 const queue=new Int32Array(count),limit=Math.max(5,count*.018);
 for(let n=0;n<count;n++)if(!seen[n]&&gray[n]<58){
  let head=0,tail=1;queue[0]=n;seen[n]=1;
  while(head<tail){const at=queue[head++],x=at%width,y=Math.floor(at/width);
   for(const next of [x?at-1:-1,x+1<width?at+1:-1,y?at-width:-1,y+1<height?at+width:-1])if(next>=0&&!seen[next]&&gray[next]<58){seen[next]=1;queue[tail++]=next;}
  }
  if(tail<=limit)for(let j=0;j<tail;j++)details[queue[j]]=1;
 }
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const n=y*width+x,gx=-gray[n-width-1]+gray[n-width+1]-2*gray[n-1]+2*gray[n+1]-gray[n+width-1]+gray[n+width+1],gy=-gray[n-width-1]-2*gray[n-width]-gray[n-width+1]+gray[n+width-1]+2*gray[n+width]+gray[n+width+1];
  strength[n]=Math.hypot(gx,gy);const a=(Math.atan2(gy,gx)*180/Math.PI+180)%180;
  angle[n]=a<22.5||a>=157.5?0:a<67.5?1:a<112.5?2:3;
 }
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const n=y*width+x,i=n*4;let edge=false;
  if(x>0&&x<width-1&&y>0&&y<height-1){const step=[1,width+1,width,width-1][angle[n]];edge=strength[n]>65&&strength[n]>=strength[n-step]&&strength[n]>=strength[n+step];}
  let h=Math.imul(x+1,374761393)^Math.imul(y+1,668265263);h=Math.imul(h^(h>>>13),1274126177);const grain=((h^(h>>>16))>>>0)/4294967296;
  const ink=(edge&&grain>.14)||(details[n]&&grain>.08);out[i]=out[i+1]=out[i+2]=ink?0:255;out[i+3]=255;
 }
 return out;
}

// A CSS filter can process a cross-origin image that canvas may not read.
// Keep the source inside the filter: there is no feImage request, repeated tile,
// or exposed threshold overlay. Flat fills become white contour interiors.
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
   <feConvolveMatrix in="luminance" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" divisor="1" preserveAlpha="true" edgeMode="duplicate" result="edges"/>
   <feComponentTransfer in="edges">
    <feFuncR type="discrete" tableValues="1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0"/><feFuncG type="discrete" tableValues="1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0"/><feFuncB type="discrete" tableValues="1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0"/><feFuncA type="linear" slope="0" intercept="1"/>
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
