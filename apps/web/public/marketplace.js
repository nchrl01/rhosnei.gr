import {readCoinSnapshots} from './coin-snapshot-store.js?v=323';
import {bindSearchField} from './search-field.js?v=265';
const $=id=>document.getElementById(id),gallery=$('coin-gallery'),browser=$('collection-browser'),grid=$('coin-gallery-grid');
const search=$('coin-gallery-search'),network=$('coin-gallery-network'),order=$('coin-gallery-order'),count=$('coin-gallery-count');
let records=[],localURLs=[],collectionsLoaded=false;
const money=value=>Number.isFinite(value)&&value>=0?'$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(value):'—';
function element(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
function instrumentURL(item){return './?'+new URLSearchParams({coin:item.address,network:item.chain});}
function render(){
 const query=search.value.trim().toLowerCase();let items=records.filter(r=>(network.value==='all'||r.chain===network.value)&&(!query||[r.name,r.symbol,r.address].some(v=>String(v).toLowerCase().includes(query))));
 items.sort(order.value==='cap'?(a,b)=>(b.marketCap||0)-(a.marketCap||0):order.value==='name'?(a,b)=>a.symbol.localeCompare(b.symbol):(a,b)=>b.capturedAt-a.capturedAt);
 grid.replaceChildren();count.textContent=items.length+' coin'+(items.length===1?'':'s');
 for(const item of items){
  const card=element('a',null,'coin-collectible');card.href=instrumentURL(item);card.draggable=false;
  const art=element('div',null,'coin-collectible-art'),image=element('img');image.alt=item.symbol+' · last captured UPIC visual';image.src=item.localURL||item.snapshot;image.width=512;image.height=512;image.loading='lazy';image.draggable=false;
  image.addEventListener('error',()=>{image.hidden=true;art.append(element('span','Snapshot unavailable','snapshot-unavailable'));},{once:true});
  const badge=element('span',item.localURL?'Saved player frame':'Captured preview','coin-capture-badge');
  art.append(image,badge);const info=element('div',null,'coin-collectible-info'),heading=element('div',null,'coin-collectible-heading');heading.append(element('h2',item.symbol),element('span','↗','coin-open'));
  const chain=element('p',item.chain.toUpperCase(),'coin-chain'),cap=element('div',null,'coin-collectible-cap');cap.append(element('span','Market cap'),element('span',money(item.marketCap)));
  const time=element('time',new Date(item.capturedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}));time.dateTime=new Date(item.capturedAt).toISOString();time.title='Captured '+new Date(item.capturedAt).toLocaleString();
  const meta=element('div',null,'coin-capture-meta');meta.append(element('span','Last snapshot'),time);
  info.append(heading,chain,cap,meta);card.append(art,info);grid.append(card);
 }
 $('coin-gallery-empty').hidden=items.length>0;
}
async function loadFrames(){
 try{
  const response=await fetch('marketplace-preview-coins.json?v=323');if(!response.ok)throw Error('snapshots');records=await response.json();
 }catch{records=[];}
 try{const saved=await readCoinSnapshots();const merged=new Map(records.map(r=>[r.key,r]));for(const row of saved){if(!(row.blob instanceof Blob)||!row.key||!Number.isFinite(row.capturedAt)||!row.address||!row.chain)continue;const previous=merged.get(row.key);if(previous&&previous.capturedAt>=row.capturedAt)continue;const localURL=URL.createObjectURL(row.blob);localURLs.push(localURL);merged.set(row.key,{...row,localURL});}records=[...merged.values()];}catch{}
 const chains=[...new Set(records.map(r=>r.chain))];for(const chain of chains){const option=element('option',chain.toUpperCase());option.value=chain;network.append(option);}render();
}
bindSearchField(search,$('coin-gallery-label'));
$('marketplace-coin-form').addEventListener('submit',event=>{event.preventDefault();render();document.dispatchEvent(new CustomEvent('upic:market-selected'));});
search.addEventListener('input',render);network.addEventListener('change',render);order.addEventListener('change',render);
for(const tab of document.querySelectorAll('[data-marketplace-tab]'))tab.addEventListener('click',async()=>{
 const coins=tab.dataset.marketplaceTab==='coins';gallery.hidden=!coins;browser.hidden=coins;
 for(const button of document.querySelectorAll('[data-marketplace-tab]'))button.setAttribute('aria-selected',String(button===tab));
 if(!coins&&!collectionsLoaded){collectionsLoaded=true;try{await import('./marketplace-collections.js?v=323');}catch{$('marketplace-empty-title').textContent='Collection browser unavailable';$('marketplace-empty-note').textContent='Reload to try again.';}}
});
window.addEventListener('pagehide',()=>localURLs.forEach(URL.revokeObjectURL),{once:true});
void loadFrames();

// Header search always targets the coin gallery; collections retain their own search.
document.querySelector('button.header-search')?.addEventListener('click',()=>{if(gallery.hidden)document.querySelector('[data-marketplace-tab="coins"]').click();});
document.querySelector('.marketplace-tabs').addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 const tabs=[...document.querySelectorAll('[data-marketplace-tab]')],at=tabs.indexOf(event.target);if(at<0)return;
 event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(at+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[next].focus();tabs[next].click();
});
