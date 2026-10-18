import {storeCapture,coinPreview,previewKey,loadCloudCaptures} from './coin-previews.js?v=335';
import {clearLegacyCoinSnapshots} from './coin-snapshot-store.js?v=335';
import {loadCoinCatalogue,coinPlayerURL,coinOnNetwork,rememberRecentCoin} from './coin-catalogue.js?v=335';
import {bindSearchField} from './search-field.js?v=265';
const $=id=>document.getElementById(id),gallery=$('coin-gallery'),browser=$('collection-browser'),grid=$('coin-gallery-grid');
const search=$('coin-gallery-search'),network=$('coin-gallery-network'),order=$('coin-gallery-order'),count=$('coin-gallery-count');
let records=[],collectionsLoaded=false,visible=40,view='discover',refreshSaved=()=>{};
clearLegacyCoinSnapshots();
const cardUpdates=new Map();
function refreshCards(){for(const update of cardUpdates.values())update();}
const money=value=>Number.isFinite(value)&&value>=0?'$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(value):'—';
function element(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
const views=element('div',null,'coin-gallery-views');views.setAttribute('role','group');views.setAttribute('aria-label','Coin selection');
for(const [key,label] of [['discover','Discover'],['top','Top 1,000'],['trending','Trending & emerging'],['captured','Captured']]){const button=element('button',label);button.type='button';button.dataset.coinView=key;button.setAttribute('aria-pressed',String(key===view));button.addEventListener('click',()=>{view=key;visible=40;for(const b of views.children)b.setAttribute('aria-pressed',String(b===button));render();});views.append(button);}
gallery.querySelector('.coin-gallery-toolbar').before(views);

const more=element('button','Load more coins','coin-gallery-more');more.type='button';more.hidden=true;grid.after(more);const grow=()=>{visible+=40;render(true);};more.addEventListener('click',grow);
if('IntersectionObserver' in window){let scheduled=false;const observer=new IntersectionObserver(entries=>{if(scheduled||gallery.hidden||more.hidden||!entries.some(e=>e.isIntersecting))return;scheduled=true;requestAnimationFrame(()=>{if(!gallery.hidden&&!more.hidden)grow();scheduled=false;});},{rootMargin:'320px'});observer.observe(more);}
function render(append=false){
 const query=search.value.trim().toLowerCase();let items=records.filter(r=>(view!=='top'||r.top1000)&&(view!=='trending'||(r.trendingRank||r.featured)&&r.marketCap>=1e6)&&(view!=='captured'||coinPreview(r,network.value).capture)&&(network.value==='all'||r.chain===network.value||r.nativeChains?.includes(network.value)||r.platforms?.some(p=>p.chain===network.value))&&(!query||[r.name,r.symbol,r.address,...(r.platforms||[]).map(p=>p.address)].some(v=>String(v||'').toLowerCase().includes(query))));
 const cap=(a,b)=>(b.marketCap||0)-(a.marketCap||0);
 items.sort(order.value==='name'?(a,b)=>a.symbol.localeCompare(b.symbol):order.value==='recent'?(a,b)=>(coinPreview(b,network.value).capture?.capturedAt||0)-(coinPreview(a,network.value).capture?.capturedAt||0)||cap(a,b):order.value==='cap'?cap:(a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))||(a.trendingRank||999)-(b.trendingRank||999)||cap(a,b));
 if(!append){cardUpdates.clear();grid.replaceChildren();}count.textContent=items.length.toLocaleString()+' coin'+(items.length===1?'':'s');
 for(const item of items.slice(append?grid.children.length:0,visible)){
  const {selection,capture}=coinPreview(item,network.value),card=element('a',null,'coin-collectible');card.href=coinPlayerURL(selection);card.draggable=false;card.addEventListener('click',()=>rememberRecentCoin(coinPreview(item,network.value).selection));
  const art=element('div',null,'coin-collectible-art'),image=element('img');image.alt=item.symbol+' · live UPIC capture';image.width=512;image.height=512;image.loading='lazy';image.decoding='async';image.draggable=false;image.hidden=true;
  const pending=element('span','Waiting for live capture','snapshot-unavailable'),badge=element('span','','coin-capture-badge');badge.hidden=true;art.append(image,pending,badge);
  const info=element('div',null,'coin-collectible-info'),heading=element('div',null,'coin-collectible-heading');heading.append(element('h2',item.symbol),element('span','↗','coin-open'));
  const chain=element('p','','coin-chain'),capValue=element('span',money(item.marketCap)),capRow=element('div',null,'coin-collectible-cap');capRow.append(element('span','Market cap'),capValue);
  const time=element('time'),meta=element('div',null,'coin-capture-meta');meta.append(element('span','Last live capture'),time);
  const update=()=>{const {selection:chosen,capture:frame}=coinPreview(item,network.value);card.href=coinPlayerURL(chosen);chain.textContent=(chosen.chain==='off-chain'?'EXCHANGE PRODUCT':chosen.chain==='unknown'?'MARKET SEARCH':chosen.chain.toUpperCase())+(item.catalogueRank?' · #'+item.catalogueRank:'');chain.title=chosen.address?chosen.chain.toUpperCase()+' · '+chosen.address:chosen.chain==='off-chain'?'Exchange product · no blockchain contract':item.nativeChains?.includes(chosen.chain)?'Native coin · no token contract':'No indexed contract';
   if(frame){const source=frame.snapshot;if(source&&image.getAttribute('src')!==source)image.src=source;image.hidden=!source;pending.hidden=Boolean(source);badge.textContent='Live capture';badge.hidden=!source;time.textContent=new Date(frame.capturedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});time.dateTime=new Date(frame.capturedAt).toISOString();time.title=new Date(frame.capturedAt).toLocaleString();capValue.textContent=money(frame.marketCap??item.marketCap);}else{image.hidden=true;image.removeAttribute('src');pending.hidden=false;pending.textContent='Waiting for live capture';badge.hidden=true;time.textContent='Waiting';time.removeAttribute('datetime');time.removeAttribute('title');capValue.textContent=money(item.marketCap);}
  };update();cardUpdates.set(card,update);image.addEventListener('error',()=>{image.hidden=true;pending.hidden=false;pending.textContent='Capture unavailable';badge.hidden=true;});
  info.append(heading,element('p',item.name,'coin-full-name'),chain,capRow,meta);card.append(art,info);grid.append(card);
 }
 $('coin-gallery-empty').hidden=items.length>0;more.hidden=items.length<=visible;more.textContent='Load more · '+Math.min(visible,items.length)+' / '+items.length.toLocaleString();
}
async function loadFrames(){
 const [catalogue,previews]=await Promise.allSettled([loadCoinCatalogue(),loadCloudCaptures()]);
 records=catalogue.status==='fulfilled'?catalogue.value.coins.map(row=>({...row})):[];
 if(catalogue.status==='fulfilled')$('coin-gallery-asof').textContent='Catalogue as of '+new Date(catalogue.value.asOf).toLocaleString();
 const byKey=new Map();for(const row of records){byKey.set(row.key,row);for(const p of row.platforms||[])byKey.set(previewKey(p.chain,p.address),row);}
 function applyFrames(frames){for(const row of records)row.captures={};for(const frame of frames){const row=byKey.get(previewKey(frame.chain,frame.address));if(row)storeCapture(row,frame);}}
 if(previews.status==='fulfilled')applyFrames(previews.value);
 refreshSaved=async()=>{if(document.hidden||gallery.hidden)return;try{applyFrames(await loadCloudCaptures({force:true}));if(view==='captured'||order.value==='recent')render();else refreshCards();}catch{}};
 const chains=[...new Set(records.flatMap(r=>[r.chain,...(r.nativeChains||[]),...(r.platforms||[]).map(p=>p.chain)]))].sort();for(const chain of chains){const option=element('option',chain==='unknown'?'Other markets':chain.toUpperCase());option.value=chain;network.append(option);}render();
}
bindSearchField(search,$('coin-gallery-label'));
$('marketplace-coin-form').addEventListener('submit',event=>{event.preventDefault();render();document.dispatchEvent(new CustomEvent('upic:market-selected'));});
const reset=()=>{visible=40;render();};search.addEventListener('input',reset);network.addEventListener('change',reset);order.addEventListener('change',reset);
for(const tab of document.querySelectorAll('[data-marketplace-tab]'))tab.addEventListener('click',async()=>{
 const coins=tab.dataset.marketplaceTab==='coins';gallery.hidden=!coins;browser.hidden=coins;if(coins)void refreshSaved();
 for(const button of document.querySelectorAll('[data-marketplace-tab]'))button.setAttribute('aria-selected',String(button===tab));
 if(!coins&&!collectionsLoaded){collectionsLoaded=true;try{await import('./marketplace-collections.js?v=323');}catch{$('marketplace-empty-title').textContent='Collection browser unavailable';$('marketplace-empty-note').textContent='Reload to try again.';}}
});
const captureRefresh=setInterval(()=>void refreshSaved(),60000);
window.addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(captureRefresh);});
void loadFrames();

// Header search always targets the coin gallery; collections retain their own search.
document.querySelector('button.header-search')?.addEventListener('click',()=>{if(gallery.hidden)document.querySelector('[data-marketplace-tab="coins"]').click();});
document.querySelector('.marketplace-tabs').addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 const tabs=[...document.querySelectorAll('[data-marketplace-tab]')],at=tabs.indexOf(event.target);if(at<0)return;
 event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(at+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[next].focus();tabs[next].click();
});

window.addEventListener('focus',()=>void refreshSaved());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshSaved();});
