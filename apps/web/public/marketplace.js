import {readCoinSnapshots} from './coin-snapshot-store.js?v=329';
import {loadCoinCatalogue,coinPlayerURL,coinOnNetwork,rememberRecentCoin} from './coin-catalogue.js?v=331';
import {attachArtworkDither} from './coin-dither.js?v=276';
import {bindSearchField} from './search-field.js?v=265';
const $=id=>document.getElementById(id),gallery=$('coin-gallery'),browser=$('collection-browser'),grid=$('coin-gallery-grid');
const search=$('coin-gallery-search'),network=$('coin-gallery-network'),order=$('coin-gallery-order'),count=$('coin-gallery-count');
let records=[],localURLs=[],collectionsLoaded=false,visible=40,view='discover';
const money=value=>Number.isFinite(value)&&value>=0?'$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(value):'—';
function element(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
const views=element('div',null,'coin-gallery-views');views.setAttribute('role','group');views.setAttribute('aria-label','Coin selection');
for(const [key,label] of [['discover','Discover'],['top','Top 1,000'],['trending','Trending & emerging'],['captured','Captured']]){const button=element('button',label);button.type='button';button.dataset.coinView=key;button.setAttribute('aria-pressed',String(key===view));button.addEventListener('click',()=>{view=key;visible=40;for(const b of views.children)b.setAttribute('aria-pressed',String(b===button));render();});views.append(button);}
gallery.querySelector('.coin-gallery-toolbar').before(views);

const more=element('button','Load more coins','coin-gallery-more');more.type='button';more.hidden=true;grid.after(more);const grow=()=>{visible+=40;render(true);};more.addEventListener('click',grow);
if('IntersectionObserver' in window){let scheduled=false;const observer=new IntersectionObserver(entries=>{if(scheduled||gallery.hidden||more.hidden||!entries.some(e=>e.isIntersecting))return;scheduled=true;requestAnimationFrame(()=>{if(!gallery.hidden&&!more.hidden)grow();scheduled=false;});},{rootMargin:'320px'});observer.observe(more);}
function render(append=false){
 const query=search.value.trim().toLowerCase();let items=records.filter(r=>(view!=='top'||r.top1000)&&(view!=='trending'||(r.trendingRank||r.featured)&&r.marketCap>=1e6)&&(view!=='captured'||r.snapshot||r.localURL)&&(network.value==='all'||r.chain===network.value||r.platforms?.some(p=>p.chain===network.value))&&(!query||[r.name,r.symbol,r.address,...(r.platforms||[]).map(p=>p.address)].some(v=>String(v||'').toLowerCase().includes(query))));
 const cap=(a,b)=>(b.marketCap||0)-(a.marketCap||0);
 items.sort(order.value==='name'?(a,b)=>a.symbol.localeCompare(b.symbol):order.value==='recent'?(a,b)=>(b.capturedAt||0)-(a.capturedAt||0)||cap(a,b):order.value==='cap'?cap:(a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))||(a.trendingRank||999)-(b.trendingRank||999)||cap(a,b));
 if(!append)grid.replaceChildren();count.textContent=items.length.toLocaleString()+' coin'+(items.length===1?'':'s');
 for(const item of items.slice(append?grid.children.length:0,visible)){
  const captured=Boolean(item.localURL||item.snapshot),study=Boolean(!captured&&item.seedPreview),card=element('a',null,'coin-collectible');const selection=coinOnNetwork(item,network.value);card.href=coinPlayerURL(selection);card.draggable=false;card.addEventListener('click',()=>rememberRecentCoin(selection));
  const art=element('div',null,'coin-collectible-art'+(captured||study?'':' coin-logo-preview')),image=element('img');image.alt=item.symbol+(captured?' · neutral UPIC capture':study?' · neutral seed preview':' · coin artwork');if(item.localURL||item.snapshot||item.seedPreview||item.image)image.src=item.localURL||item.snapshot||item.seedPreview||item.image;image.width=512;image.height=512;image.loading='lazy';image.decoding='async';image.draggable=false;
  const badge=element('span',item.localURL?'Saved neutral frame':captured?'Neutral UPIC preview':study?'Seed preview':item.featured?'Emerging · coin artwork':item.trendingRank?'Trending · coin artwork':'Coin artwork','coin-capture-badge');
  if(study)art.title='Seed preview · fixed simulated holdings and liquidity, not a saved live frame';art.append(image);const info=element('div',null,'coin-collectible-info'),heading=element('div',null,'coin-collectible-heading');heading.append(element('h2',item.symbol),element('span','↗','coin-open'));
  const chain=element('p',(selection.chain==='unknown'?'MARKET SEARCH':selection.chain.toUpperCase())+(item.catalogueRank?' · #'+item.catalogueRank:''),'coin-chain'),capRow=element('div',null,'coin-collectible-cap');chain.title=selection.address?selection.chain.toUpperCase()+' · '+selection.address:item.contractStatus==='native'?'Native coin · no token contract':'No contract identifier indexed by the source';capRow.append(element('span','Market cap'),element('span',money(item.marketCap)));
  const at=captured?item.capturedAt:item.marketAt,time=element('time',at?new Date(at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—');if(at){time.dateTime=new Date(at).toISOString();time.title=new Date(at).toLocaleString();}
  const meta=element('div',null,'coin-capture-meta');meta.append(element('span',captured?'Last capture':study?'Seed study · market snapshot':'Market snapshot'),time);
  info.append(heading,element('p',item.name,'coin-full-name'),chain,capRow,meta);card.append(art,info);grid.append(card);if(!captured&&!study)attachArtworkDither(image);art.append(badge);
 }
 $('coin-gallery-empty').hidden=items.length>0;more.hidden=items.length<=visible;more.textContent='Load more · '+Math.min(visible,items.length)+' / '+items.length.toLocaleString();
}
async function loadFrames(){
 const [catalogue,previews,studies]=await Promise.allSettled([loadCoinCatalogue(),fetch('marketplace-preview-coins.json?v=329').then(r=>r.ok?r.json():[]),fetch('marketplace-seed-previews.json?v=331').then(r=>r.ok?r.json():{coins:[]})]);
 records=catalogue.status==='fulfilled'?catalogue.value.coins:[];
 if(catalogue.status==='fulfilled')$('coin-gallery-asof').textContent='Catalogue as of '+new Date(catalogue.value.asOf).toLocaleString();
 const byKey=new Map();for(const row of records){byKey.set(row.key,row);for(const p of row.platforms||[])byKey.set(p.chain+':'+p.address,row);}
 if(studies.status==='fulfilled')for(const study of studies.value.coins){const row=byKey.get(study.key);if(row)row.seedPreview=study.seedPreview;}
 function addFrame(frame,localURL){const existing=byKey.get(frame.key);if(existing&&(existing.capturedAt||0)>=frame.capturedAt)return;
  if(existing){const latestMarket=existing.marketAt>frame.capturedAt?{marketCap:existing.marketCap}:{};Object.assign(existing,frame,latestMarket,{localURL,platforms:existing.platforms});}
  else{const row={...frame,localURL};records.push(row);byKey.set(row.key,row);}}
 if(previews.status==='fulfilled')for(const frame of previews.value)addFrame(frame,null);
 try{for(const row of await readCoinSnapshots()){if(!(row.blob instanceof Blob)||!row.key||!Number.isFinite(row.capturedAt)||!row.address||!row.chain)continue;const localURL=URL.createObjectURL(row.blob);localURLs.push(localURL);addFrame(row,localURL);}}catch{}
 const chains=[...new Set(records.flatMap(r=>[r.chain,...(r.platforms||[]).map(p=>p.chain)]))].sort();for(const chain of chains){const option=element('option',chain==='unknown'?'Other markets':chain.toUpperCase());option.value=chain;network.append(option);}render();
}
bindSearchField(search,$('coin-gallery-label'));
$('marketplace-coin-form').addEventListener('submit',event=>{event.preventDefault();render();document.dispatchEvent(new CustomEvent('upic:market-selected'));});
const reset=()=>{visible=40;render();};search.addEventListener('input',reset);network.addEventListener('change',reset);order.addEventListener('change',reset);
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
