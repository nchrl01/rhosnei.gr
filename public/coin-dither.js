// Original first-release Bayer treatment, restored with only fading removed.
// Keep the original <img> available when a remote host disallows pixel reads.
export const BAYER=[0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
export function ditherPixels(source,width,height){
 const out=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,threshold=(BAYER[(y%8)*8+x%8]+.5)/64;
  const luminance=(source[i]*.2126+source[i+1]*.7152+source[i+2]*.0722)/255;
  const ink=Math.pow(luminance,.88)>threshold?255:17;
  out[i]=out[i+1]=out[i+2]=ink;
  out[i+3]=source[i+3];
 }
 return out;
}
let filterSerial=0;
export function createCoinDither(img,fallback){
 const filterId=`coin-bayer-filter-${++filterSerial}`;
 const host=img.parentElement,canvas=document.createElement('canvas');canvas.className='coin-dither';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;host.append(canvas);
 // SVG can threshold SourceGraphic without exposing cross-origin image bytes
 // to JavaScript. This preserves real monochrome dithering in the CORS fallback.
 const threshold=document.createElement('canvas');threshold.width=threshold.height=64;const tc=threshold.getContext('2d');
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){const gray=Math.round((BAYER[(y%8)*8+x%8]+.5)/64*255);tc.fillStyle=`rgb(${gray},${gray},${gray})`;tc.fillRect(x,y,1,1);}
 const defs=document.createElementNS('http://www.w3.org/2000/svg','svg');defs.setAttribute('width','0');defs.setAttribute('height','0');defs.setAttribute('aria-hidden','true');defs.style.position='absolute';
 defs.innerHTML=`<defs><filter id="${filterId}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0" result="gray"/><feImage href="${threshold.toDataURL()}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="threshold"/><feComposite in="gray" in2="threshold" operator="arithmetic" k1="0" k2="1" k3="-1" k4="0.5"/><feComponentTransfer><feFuncR type="discrete" tableValues="0 1"/><feFuncG type="discrete" tableValues="0 1"/><feFuncB type="discrete" tableValues="0 1"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer></filter></defs>`;host.append(defs);
 const context=canvas.getContext('2d');
 let serial=0,current='',pixels=null,size=96;
 function paint(){if(!pixels)return;context.putImageData(new ImageData(ditherPixels(pixels,size,size),size,size),0,0);}
 function load(url,token){
  img.hidden=true;canvas.hidden=true;fallback.hidden=false;pixels=null;img.style.filter='none';
  if(!url){img.removeAttribute('src');return;}
  const decoded=new Image();decoded.crossOrigin='anonymous';decoded.referrerPolicy='no-referrer';
  decoded.onload=()=>{
   if(token!==serial)return;
   try{
    size=Math.max(64,Math.min(256,Math.round(host.clientWidth||96)));canvas.width=canvas.height=size;
    const scratch=document.createElement('canvas');scratch.width=scratch.height=size;const c=scratch.getContext('2d',{willReadFrequently:true});
    c.fillStyle='#fff';c.fillRect(0,0,size,size);const scale=Math.min(size/decoded.width,size/decoded.height),w=decoded.width*scale,h=decoded.height*scale;c.drawImage(decoded,(size-w)/2,(size-h)/2,w,h);
    pixels=c.getImageData(0,0,size,size).data;canvas.hidden=false;fallback.hidden=true;host.dataset.dither='pixels';paint();
   }catch{original(url,token);}
  };
  decoded.onerror=()=>{if(token===serial)original(url,token);};decoded.src=url;
 }
 // Retain the original SVG dithering for restricted hosts, without its fade mask.
 function original(url,token){
  img.removeAttribute('crossorigin');img.onload=()=>{if(token!==serial)return;img.hidden=false;fallback.hidden=true;host.dataset.dither='mask';img.style.filter=`url(#${filterId})`;};img.onerror=()=>{if(token!==serial)return;img.hidden=true;fallback.hidden=false;};img.src=url;
 }
 return {set(url){if(url===current)return;current=url;load(url,++serial);},close(){serial++;canvas.remove();defs.remove();}};
}
