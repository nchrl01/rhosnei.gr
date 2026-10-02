// Error diffusion keeps image detail without stamping a repeating tile over it.
// Hosts that block pixel reads use the original image with a soft CSS edge fade.
function coverage(x,y,width,height,reveal){
 const edge=Math.max(0,Math.min(1,(width-1-x)/Math.max(1,width*.13),(height-1-y)/Math.max(1,height*.1)));
 return edge*edge*(3-2*edge)*Math.max(0,Math.min(1,reveal));
}
function grain(x,y){
 // A fixed per-pixel hash avoids the large, periodic Bayer blocks on mobile.
 let value=Math.imul(x+1,374761393)^Math.imul(y+1,668265263);
 value=Math.imul(value^(value>>>13),1274126177);
 return ((value^(value>>>16))>>>0)/4294967296;
}
export function ditherPixels(source,width,height,reveal=1){
 const out=new Uint8ClampedArray(width*height*4);
 let row=new Float32Array(width+2),next=new Float32Array(width+2);
 for(let y=0;y<height;y++){
  const direction=y%2?-1:1,start=direction===1?0:width-1;
  for(let step=0;step<width;step++){
   const x=start+step*direction,i=(y*width+x)*4;
   // Composite transparent pixels onto the light page before quantization.
   const alpha=source[i+3]/255;
   const luminance=(source[i]*.2126+source[i+1]*.7152+source[i+2]*.0722)*alpha+255*(1-alpha);
   const gray=Math.max(0,Math.min(255,luminance+row[x+1])),ink=gray>=128?255:0,error=gray-ink;
   row[x+direction+1]+=error*7/16;
   next[x-direction+1]+=error*3/16;next[x+1]+=error*5/16;next[x+direction+1]+=error/16;
   out[i]=out[i+1]=out[i+2]=ink;
   out[i+3]=grain(x,y)<coverage(x,y,width,height,reveal)?255:0;
  }
  const previous=row;row=next;next=previous;next.fill(0);
 }
 return out;
}
export function createCoinDither(img,fallback){
 const host=img.parentElement,canvas=document.createElement('canvas');canvas.className='coin-dither';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;host.append(canvas);
 const context=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let serial=0,current='',pixels=null,size=96,animation=0;
 function paint(){if(!pixels||!context)return;context.putImageData(new ImageData(ditherPixels(pixels,size,size),size,size),0,0);}
 function reveal(from,to,done){
  cancelAnimationFrame(animation);const start=performance.now();
  // Quantize once per coin. Animate opacity without repeatedly processing its
  // pixels on the main thread while mobile audio is being scheduled.
  function frame(now){const p=reduced.matches?1:Math.min(1,(now-start)/300);canvas.style.opacity=String(from+(to-from)*p);if(p<1)animation=requestAnimationFrame(frame);else done?.();}
  animation=requestAnimationFrame(frame);
 }
 function load(url,token){
  img.hidden=true;canvas.hidden=true;fallback.hidden=false;pixels=null;delete host.dataset.dither;
  if(!url){img.removeAttribute('src');return;}
  if(!context){original(url,token);return;}
  const decoded=new Image();decoded.crossOrigin='anonymous';decoded.referrerPolicy='no-referrer';
  decoded.onload=()=>{
   if(token!==serial)return;
   try{
    // Render near device resolution; CSS scaling must not enlarge 64px tiles.
    size=Math.max(96,Math.min(512,Math.round((host.clientWidth||96)*Math.min(2,globalThis.devicePixelRatio||1))));canvas.width=canvas.height=size;
    const scratch=document.createElement('canvas');scratch.width=scratch.height=size;const c=scratch.getContext('2d',{willReadFrequently:true});
    if(!c)throw new Error('Image pixels unavailable');
    c.fillStyle='#fff';c.fillRect(0,0,size,size);const scale=Math.min(size/decoded.width,size/decoded.height),w=decoded.width*scale,h=decoded.height*scale;c.drawImage(decoded,(size-w)/2,(size-h)/2,w,h);
    pixels=c.getImageData(0,0,size,size).data;paint();canvas.style.opacity='0';canvas.hidden=false;fallback.hidden=true;host.dataset.dither='pixels';reveal(0,1);
   }catch{original(url,token);}
  };
  decoded.onerror=()=>{if(token===serial)original(url,token);};decoded.src=url;
 }
 // CSS grayscale and a simple gradient work without inspecting remote pixels.
 // Avoid SVG feImage/compositing: its threshold layer can become visible on iOS.
 function original(url,token){
  pixels=null;canvas.hidden=true;img.removeAttribute('crossorigin');
  img.onload=()=>{if(token!==serial)return;img.hidden=false;fallback.hidden=true;host.dataset.dither='fallback';};
  img.onerror=()=>{if(token!==serial)return;img.hidden=true;fallback.hidden=false;delete host.dataset.dither;};img.src=url;
 }
 return {set(url){if(url===current)return;current=url;const token=++serial;cancelAnimationFrame(animation);if(pixels&&!canvas.hidden)reveal(1,0,()=>{if(token===serial)load(url,token);});else load(url,token);}};
}
