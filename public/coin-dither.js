// Preserve the source's dark ink, lift coloured fills to paper, and stipple
// the remaining ink. Do not edge-detect: that doubles existing drawn strokes.
export function ditherPixels(source,width,height){
 const out=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,a=source[i+3]/255;
  const light=((source[i]*.2126+source[i+1]*.7152+source[i+2]*.0722)*a+255*(1-a))/255;
  let h=Math.imul(x+1,374761393)^Math.imul(y+1,668265263);h=Math.imul(h^(h>>>13),1274126177);
  const grain=((h^(h>>>16))>>>0)/4294967296;
  const ink=light<.17&&grain>.16;
  out[i]=out[i+1]=out[i+2]=ink?0:255;out[i+3]=255;
 }
 return out;
}

// One source-only SVG filter for every displayed image, regardless of CORS.
// Grain is anchored to the displayed image, with no readback, proxy or fade.
function inkFilter(){
 const id='upic-source-ink';
 if(!document.getElementById(id)){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');
  svg.style.cssText='position:absolute;pointer-events:none;overflow:hidden';
  svg.innerHTML=`<defs><filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
   <feFlood flood-color="white" result="paper"/>
   <feComposite in="SourceGraphic" in2="paper" operator="over" result="opaque"/>
   <feColorMatrix in="opaque" type="saturate" values="0" result="gray"/>
   <feComponentTransfer in="gray" result="lifted">
    <feFuncR type="linear" slope="5" intercept="-.35"/><feFuncG type="linear" slope="5" intercept="-.35"/><feFuncB type="linear" slope="5" intercept="-.35"/>
   </feComponentTransfer>
   <feComponentTransfer in="lifted" result="ink">
    <feFuncR type="discrete" tableValues="0 1"/><feFuncG type="discrete" tableValues="0 1"/><feFuncB type="discrete" tableValues="0 1"/><feFuncA type="linear" slope="0" intercept="1"/>
   </feComponentTransfer>
   <feTurbulence type="fractalNoise" baseFrequency=".95" numOctaves="1" seed="2303" result="noise"/>
   <feColorMatrix in="noise" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="mono"/>
   <feComponentTransfer in="mono" result="grain-level">
    <feFuncR type="linear" slope="1" intercept="-.08"/><feFuncG type="linear" slope="1" intercept="-.08"/><feFuncB type="linear" slope="1" intercept="-.08"/>
   </feComponentTransfer>
   <feComponentTransfer in="grain-level" result="holes">
    <feFuncR type="discrete" tableValues="0 1"/><feFuncG type="discrete" tableValues="0 1"/><feFuncB type="discrete" tableValues="0 1"/><feFuncA type="linear" slope="0" intercept="1"/>
   </feComponentTransfer>
   <feComposite in="ink" in2="holes" operator="arithmetic" k2="1" k3="1"/>
  </filter></defs>`;
  document.body.append(svg);
 }
 return `url(#${id})`;
}

export function createCoinDither(img,fallback){
 const host=img.parentElement,filter=inkFilter();let serial=0,current='';
 img.style.opacity='1';img.style.maskImage='none';img.style.webkitMaskImage='none';
 img.style.filter=filter;img.removeAttribute('crossorigin');
 return {
  set(url){
   url=String(url||'');if(url===current&&host.dataset.dither)return;
   current=url;const token=++serial;img.hidden=true;fallback.hidden=false;delete host.dataset.dither;
   if(!url){img.removeAttribute('src');return;}
   img.onload=()=>{if(token!==serial)return;img.hidden=false;fallback.hidden=true;host.dataset.dither='source-ink';};
   img.onerror=()=>{if(token!==serial)return;img.hidden=true;fallback.hidden=false;delete host.dataset.dither;};
   img.src=url;
  },
  close(){serial++;img.onload=null;img.onerror=null;img.style.filter='none';delete host.dataset.dither;}
 };
}
