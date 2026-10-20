import {catalogueNative} from './native-coins.js?v=359';
import {storeCapture,coinPreview,previewKey,loadCloudCaptures} from './coin-previews.js?v=359';
import {clearLegacyCoinSnapshots} from './coin-snapshot-store.js?v=335';
import {loadCoinCatalogue,coinPlayerURL,coinOnNetwork,rememberRecentCoin} from './coin-catalogue.js?v=359';
import {bindMarketplaceCoinSearch} from './marketplace-coin-search.js?v=350';
const $=id=>document.getElementById(id),gallery=$('coin-gallery'),grid=$('coin-gallery-grid');
const search=$('coin-gallery-search'),network=$('coin-gallery-network'),order=$('coin-gallery-order'),count=$('coin-gallery-count');
let records=[],visible=40,refreshSaved=()=>{};
clearLegacyCoinSnapshots();
const cardUpdates=new Map();
function refreshCards(){for(const update of cardUpdates.values())update();}
const money=value=>Number.isFinite(value)&&value>=0?'$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(value):'—';
function element(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
const more=element('button','Load more coins','coin-gallery-more');more.type='button';more.hidden=true;grid.after(more);const grow=()=>{visible+=40;render(true);};more.addEventListener('click',grow);
if('IntersectionObserver' in window){let scheduled=false;const observer=new IntersectionObserver(entries=>{if(scheduled||gallery.hidden||more.hidden||!entries.some(e=>e.isIntersecting))return;scheduled=true;requestAnimationFrame(()=>{if(!gallery.hidden&&!more.hidden)grow();scheduled=false;});},{rootMargin:'320px'});observer.observe(more);}
function render(append=false){
 let items=records.filter(r=>r.top1000&&(network.value==='all'||r.chain===network.value||r.nativeChains?.includes(network.value)||r.platforms?.some(p=>p.chain===network.value)));
 const cap=(a,b)=>(b.marketCap||0)-(a.marketCap||0);
 items.sort(order.value==='name'?(a,b)=>a.symbol.localeCompare(b.symbol):order.value==='recent'?(a,b)=>(coinPreview(b,network.value).capture?.capturedAt||0)-(coinPreview(a,network.value).capture?.capturedAt||0)||cap(a,b):cap);
 if(!append){cardUpdates.clear();grid.replaceChildren();}count.textContent=items.length.toLocaleString()+' coin'+(items.length===1?'':'s');
 for(const item of items.slice(append?grid.children.length:0,visible)){
  let selectedNetwork=network.value;const {selection,capture}=coinPreview(item,selectedNetwork),card=element('a',null,'coin-collectible');card.href=coinPlayerURL(selection);card.draggable=false;card.addEventListener('click',()=>rememberRecentCoin(coinPreview(item,selectedNetwork).selection));
  const art=element('div',null,'coin-collectible-art'),image=element('img');image.alt=item.symbol+' · live UPIC capture';image.width=512;image.height=512;image.loading='lazy';image.decoding='async';image.draggable=false;image.hidden=true;
  const pending=element('span','Waiting for live capture','snapshot-unavailable'),badge=element('span','','coin-capture-badge');badge.hidden=true;art.append(image,pending,badge);
  const info=element('div',null,'coin-collectible-info'),heading=element('div',null,'coin-collectible-heading');heading.append(element('h2',item.symbol),element('span','↗','coin-open'));
  const chain=element('p','','coin-chain'),capValue=element('span',money(item.marketCap)),capRow=element('div',null,'coin-collectible-cap');capRow.append(element('span','Market cap'),capValue);
  const time=element('time'),meta=element('div',null,'coin-capture-meta');meta.append(element('span','Last live capture'),time);
  const update=()=>{const {selection:chosen,capture:frame}=coinPreview(item,selectedNetwork);card.href=coinPlayerURL(chosen);chain.textContent=(chosen.chain==='off-chain'?'EXCHANGE PRODUCT':chosen.chain==='unknown'?'MARKET SEARCH':chosen.chain.toUpperCase())+(item.catalogueRank?' · #'+item.catalogueRank:'');chain.title=chosen.address?chosen.chain.toUpperCase()+' · '+chosen.address:chosen.chain==='off-chain'?'Exchange product · no blockchain contract':item.nativeChains?.includes(chosen.chain)?'Native coin · no token contract':'No indexed contract';
   if(frame){const source=frame.snapshot;if(source&&image.getAttribute('src')!==source)image.src=source;image.hidden=!source;pending.hidden=Boolean(source);badge.textContent='Live capture';badge.hidden=!source;time.textContent=new Date(frame.capturedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});time.dateTime=new Date(frame.capturedAt).toISOString();time.title=new Date(frame.capturedAt).toLocaleString();capValue.textContent=money(frame.marketCap??item.marketCap);}else{image.hidden=true;image.removeAttribute('src');pending.hidden=false;pending.textContent='Waiting for live capture';badge.hidden=true;time.textContent='Waiting';time.removeAttribute('datetime');time.removeAttribute('title');capValue.textContent=money(item.marketCap);}
  };update();cardUpdates.set(card,update);image.addEventListener('error',()=>{image.hidden=true;pending.hidden=false;pending.textContent='Capture unavailable';badge.hidden=true;});
  info.append(heading,element('p',item.name,'coin-full-name'),chain,capRow,meta);card.append(art,info);const wrapper=element('div',null,'coin-collectible-wrapper');wrapper.append(card);
  const choices=[...new Set([item.chain,...(item.nativeChains||[]),...(item.platforms||[]).map(p=>p.chain)])].filter(c=>c&&!['unknown','off-chain'].includes(c));
  if(choices.length>1){const label=element('label','Network','coin-network-choice'),select=element('select');select.setAttribute('aria-label',item.symbol+' network');for(const chain of choices){const option=element('option',chain.toUpperCase()+(Object.values(item.captures||{}).some(f=>f.chain===chain)?' · Live capture':''));option.value=chain;select.append(option);}select.value=selection.chain;select.addEventListener('change',()=>{selectedNetwork=select.value;update();});label.append(select);wrapper.append(label);}grid.append(wrapper);
 }
 $('coin-gallery-empty').hidden=items.length>0;more.hidden=items.length<=visible;more.textContent='Load more · '+Math.min(visible,items.length)+' / '+items.length.toLocaleString();
}
const networkIcons=["ethereum", "base", "solana", "arbitrum", "polygon", "optimism", "avalanche", "robinhood", "abstract", "animechain", "ape_chain", "arc", "bera_chain", "blast", "flow", "gunzilla", "hyperevm", "hyperliquid", "ink", "megaeth", "monad", "ronin", "sei", "shape", "somnia", "soneium", "stablechain", "unichain", "zora"];
const networkAliases={bera_chain:'berachain',sei:'sei-network',ape_chain:'apechain',animechain:'animechain',stablechain:'stable',hyperevm:'hyperevm'};
const networkGroup=document.querySelector('.marketplace-networks');
networkGroup.replaceChildren();
function networkButton(chain,name,icon){const button=element('button');button.type='button';button.dataset.chain=chain;button.setAttribute('aria-pressed',String(chain==='all'));button.setAttribute('aria-label',name);if(icon){const image=element('img',null,'network-mark');image.src='images/networks/'+icon+'.svg';image.alt='';image.width=32;image.height=32;image.draggable=false;button.append(image,element('span',name,'network-name'));}else button.textContent=name;button.addEventListener('click',()=>{if(![...network.options].some(o=>o.value===chain)){const option=element('option',name);option.value=chain;network.append(option);}network.value=chain;for(const item of networkGroup.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item===button));network.dispatchEvent(new Event('change'));});networkGroup.append(button);}
networkButton('all','All networks');

async function loadFrames(){
 const [catalogue,previews]=await Promise.allSettled([loadCoinCatalogue(),loadCloudCaptures()]);
 records=catalogue.status==='fulfilled'?catalogue.value.coins.filter(row=>row.top1000).slice(0,1000).map(row=>({...row})):[];
 if(catalogue.status==='fulfilled')$('coin-gallery-asof').textContent='Catalogue as of '+new Date(catalogue.value.asOf).toLocaleString();
 const byKey=new Map();for(const row of records){byKey.set(row.key,row);const native=catalogueNative(row);if(native)byKey.set(previewKey(native.chain,native.address),row);for(const p of row.platforms||[])byKey.set(previewKey(p.chain,p.address),row);}
 function applyFrames(frames){for(const row of records)row.captures={};for(const frame of frames){const row=byKey.get(previewKey(frame.chain,frame.address));if(row)storeCapture(row,frame);}}
 if(previews.status==='fulfilled')applyFrames(previews.value);
 refreshSaved=async()=>{if(document.hidden||gallery.hidden)return;try{applyFrames(await loadCloudCaptures({force:true}));if(order.value==='recent')render();else refreshCards();}catch{}};
 const chains=[...new Set(records.flatMap(r=>[r.chain,...(r.nativeChains||[]),...(r.platforms||[]).map(p=>p.chain)]))].sort();for(const chain of chains){const option=element('option',chain==='unknown'?'Other markets':chain.toUpperCase());option.value=chain;network.append(option);}for(const icon of networkIcons){const chain=networkAliases[icon]||icon;if(chains.includes(chain))networkButton(chain,chain.toUpperCase(),icon);}render();
}
bindMarketplaceCoinSearch();
const reset=()=>{visible=40;render();};network.addEventListener('change',reset);order.addEventListener('change',reset);
const captureRefresh=setInterval(()=>void refreshSaved(),60000);
window.addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(captureRefresh);});
void loadFrames();

document.querySelector('button.header-search')?.addEventListener('click',()=>{if(matchMedia('(min-width:761px)').matches)search.focus();});

window.addEventListener('focus',()=>void refreshSaved());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshSaved();});
