import {ditherPixels} from './coin-dither.js?v=234';
const search=document.getElementById('marketplace-search'),buttons=[...document.querySelectorAll('[data-chain]')],title=document.getElementById('marketplace-empty-title'),note=document.getElementById('marketplace-empty-note');
let chain='all';
function update(){const query=search.value.trim(),network=buttons.find(button=>button.dataset.chain===chain)?.getAttribute('aria-label')||'All networks';title.textContent=query?'No matching artworks yet.':chain==='all'?'The first artworks are still to come.':'No '+network+' listings yet.';note.textContent=query?'Try another search, or return when verified UPIC collections are available.':'Verified UPIC collections and secondary listings will appear here when trading launches.';}
for(const button of buttons)button.addEventListener('click',()=>{chain=button.dataset.chain;for(const item of buttons)item.setAttribute('aria-pressed',String(item===button));update();});
search.addEventListener('input',update);

for(const image of document.querySelectorAll('.network-mark')){
 const render=()=>{try{const canvas=document.createElement('canvas');canvas.width=canvas.height=32;canvas.className='network-mark';canvas.setAttribute('aria-hidden','true');const context=canvas.getContext('2d',{willReadFrequently:true});const scale=28/Math.max(image.naturalWidth,image.naturalHeight),w=Math.round(image.naturalWidth*scale),h=Math.round(image.naturalHeight*scale);context.drawImage(image,Math.floor((32-w)/2),Math.floor((32-h)/2),w,h);const pixels=context.getImageData(0,0,32,32);pixels.data.set(ditherPixels(pixels.data,32,32));context.putImageData(pixels,0,0);image.replaceWith(canvas);}catch{image.style.filter='grayscale(1)';}};
 if(image.complete&&image.naturalWidth)render();else image.addEventListener('load',render,{once:true});
}
