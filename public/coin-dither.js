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
 let serial=0,current='',pixels=null,size=96;
 // Share the decoded source once; the field never fetches or reads it per frame.
 function notify(image){try{onPixels(image);}catch(error){console.warn('Coin artwork unavailable to the visual field:',error.message);}}
 function paint(){if(!pixels)return;context.putImageData(new ImageData(ditherPixels(pixels,size,size),size,size),0,0);}
 function load(url,token){
  img.hidden=true;canvas.hidden=true;fallback.hidden=false;pixels=null;img.style.filter='none';notify(null);
  if(!url){img.removeAttribute('src');return;}
  const decoded=new Image();decoded.crossOrigin='anonymous';decoded.referrerPolicy='no-referrer';
  decoded.onload=()=>{
   if(token!==serial)return;
   try{
    size=Math.max(64,Math.min(256,Math.round(host.clientWidth||96)));canvas.width=canvas.height=size;
    const fieldImage=coinImagePixels(decoded);
    pixels=(size===fieldImage.width?fieldImage:coinImagePixels(decoded,size)).pixels;
    canvas.hidden=false;fallback.hidden=true;host.dataset.dither='pixels';paint();notify(fieldImage);
   }catch{relayOrFallback();}
  };
  let relayed=false;
  function relayOrFallback(){
   if(token!==serial)return;
   let relay='';try{const source=new URL(url);if(['cdn.dexscreener.com','coin-images.coingecko.com','assets.coingecko.com'].includes(source.hostname))relay='https://upic-insightx.nchrl01.workers.dev/artwork?revision=2&url='+encodeURIComponent(source.href);}catch{}
   if(relay&&!relayed){relayed=true;decoded.src=relay;return;}
   original(url,token);
  }
  decoded.onerror=relayOrFallback;decoded.src=url;
 }
 // A missing readable image uses the placeholder while metadata fallback
 // resolves another source. Never show a second dithering style.
 function original(url,token){
  if(token!==serial)return;
  img.hidden=true;canvas.hidden=true;fallback.hidden=false;host.dataset.dither='unavailable';
  try{onUnavailable(url);}catch{}
 }

 return {set(url){if(url===current)return;current=url;load(url,++serial);},close(){serial++;canvas.remove();}};
}
