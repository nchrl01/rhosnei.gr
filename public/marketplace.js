import {ditherPixels} from './coin-dither.js?v=234';
const search=document.getElementById('marketplace-search'),buttons=[...document.querySelectorAll('[data-chain]')],title=document.getElementById('marketplace-empty-title'),note=document.getElementById('marketplace-empty-note');
let chain='all';
function update(){const query=search.value.trim(),network=buttons.find(button=>button.dataset.chain===chain)?.getAttribute('aria-label')||'All networks';title.textContent=query?'No matching artworks yet.':chain==='all'?'The first artworks are still to come.':'No '+network+' listings yet.';note.textContent=query?'Try another search, or return when verified UPIC collections are available.':'Verified UPIC collections and secondary listings will appear here when trading launches.';}
for(const button of buttons)button.addEventListener('click',()=>{chain=button.dataset.chain;for(const item of buttons)item.setAttribute('aria-pressed',String(item===button));update();});
search.addEventListener('input',update);

// Measure fine edges before choosing the dither resolution for each mark.
function logoDetail(image){
 const probe=document.createElement('canvas');probe.width=probe.height=96;
 const context=probe.getContext('2d',{willReadFrequently:true});
 const scale=88/Math.max(image.naturalWidth,image.naturalHeight),w=Math.round(image.naturalWidth*scale),h=Math.round(image.naturalHeight*scale);
 context.drawImage(image,(96-w)/2,(96-h)/2,w,h);
 const data=context.getImageData(0,0,96,96).data;
 const light=i=>(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)*data[i+3]/255;
 let edges=0,visible=0;
 for(let y=1;y<95;y++)for(let x=1;x<95;x++){
  const i=(y*96+x)*4;
  if(data[i+3]<24)continue;
  visible++;
  if(Math.abs(light(i)-light(i+4))+Math.abs(light(i)-light(i+384))>40)edges++;
 }
 return Math.min(1,edges/Math.max(visible,1)*5);
}
for(const image of document.querySelectorAll('.network-mark')){
 const render=()=>{try{
  const detail=logoDetail(image),display=image.getBoundingClientRect().width||32;
  // Detailed marks get finer samples; simple silhouettes retain larger grain.
  const resolution=Math.round(display*(1+detail));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=resolution;
  canvas.className='network-mark';canvas.setAttribute('aria-hidden','true');
  const context=canvas.getContext('2d',{willReadFrequently:true});
  const scale=resolution*.875/Math.max(image.naturalWidth,image.naturalHeight),w=Math.round(image.naturalWidth*scale),h=Math.round(image.naturalHeight*scale);
  context.drawImage(image,Math.floor((resolution-w)/2),Math.floor((resolution-h)/2),w,h);
  const pixels=context.getImageData(0,0,resolution,resolution);
  pixels.data.set(ditherPixels(pixels.data,resolution,resolution));context.putImageData(pixels,0,0);
  image.replaceWith(canvas);
 }catch{image.style.filter='grayscale(1)';}};
 if(image.complete&&image.naturalWidth)render();else image.addEventListener('load',render,{once:true});
}
