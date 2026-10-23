import {searchNetworks} from './network-marks.js?v=448';
import {collectiblePreview,genesisCollectibles} from './collectible-selection.js?v=448';
import {storeCapture,loadCloudCaptures} from './coin-previews.js?v=448';
import {clearLegacyCoinSnapshots} from './coin-snapshot-store.js?v=448';
import {loadCoinCatalogue,coinPlayerURL,rememberRecentCoin} from './coin-catalogue.js?v=448';
import {bindMarketplaceCoinSearch} from './marketplace-coin-search.js?v=456';
const $=id=>document.getElementById(id),gallery=$('coin-gallery'),grid=$('coin-gallery-grid');
const search=$('coin-gallery-search'),network=$('coin-gallery-network'),count=$('coin-gallery-count');
let records=[],visible=40,refreshSaved=()=>{},candidateCoins=[],refreshing=null;
const cards=new Map();
const rejectedPreviews=new Set();
clearLegacyCoinSnapshots();
const money=value=>Number.isFinite(value)&&value>=0?'$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(value):'—';
function element(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
const more=element('button','Load more coins','coin-gallery-more');more.type='button';more.hidden=true;grid.after(more);const grow=()=>{visible+=40;render(true);};more.addEventListener('click',grow);
if('IntersectionObserver' in window){let scheduled=false;const observer=new IntersectionObserver(entries=>{if(scheduled||gallery.hidden||more.hidden||!entries.some(e=>e.isIntersecting))return;scheduled=true;requestAnimationFrame(()=>{if(!gallery.hidden&&!more.hidden)grow();scheduled=false;});},{rootMargin:'320px'});observer.observe(more);}
function render(append=false){
 let items=records.filter(r=>{const source=collectiblePreview(r,network.value).capture?.snapshot;return source&&!rejectedPreviews.has(source);});
 const cap=(a,b)=>(b.marketCap||0)-(a.marketCap||0);
 items.sort(cap);
 const shown=items.slice(0,visible),shownIds=new Set(shown.map(item=>item.id));
 for(const [id,value] of cards)if(!shownIds.has(id)){value.wrapper.remove();cards.delete(id);}
 grid.querySelectorAll('.coin-placeholder').forEach(node=>node.remove());count.textContent=items.length.toLocaleString()+' coin'+(items.length===1?'':'s');
 for(const item of shown){
  const existing=cards.get(item.id);if(existing){existing.update();grid.append(existing.wrapper);continue;}
  const card=element('a',null,'coin-collectible');card.draggable=false;card.addEventListener('click',event=>{const chosen=collectiblePreview(item,network.value).selection;if(!chosen){event.preventDefault();return;}rememberRecentCoin(chosen);});
  const art=element('div',null,'coin-collectible-art'),image=element('img');image.alt=item.symbol+' artwork';image.width=512;image.height=512;image.loading=cards.size<8?'eager':'lazy';if(cards.size<2)image.fetchPriority='high';image.decoding='async';image.draggable=false;image.hidden=true;const previewStatus=element('span','Loading preview…','snapshot-unavailable');previewStatus.setAttribute('role','status');art.append(image,previewStatus);
  const info=element('div',null,'coin-collectible-info'),heading=element('div',null,'coin-collectible-heading');heading.append(element('h2',item.symbol),element('span','↗','coin-open'));
  const chain=element('p','','coin-chain'),capValue=element('span',money(item.marketCap)),capRow=element('div',null,'coin-collectible-cap');capRow.append(element('span','Market cap'),capValue);
  info.append(heading,element('p',item.name,'coin-full-name'),chain,capRow);
  const update=()=>{
   const {selection:chosen,capture:frame}=collectiblePreview(item,network.value),url=coinPlayerURL(chosen);
   card.setAttribute('aria-disabled',String(!url));card.classList.toggle('is-contract-unavailable',!url);
   if(url)card.href=url;else card.removeAttribute('href');
   heading.querySelector('h2').textContent=chosen?.symbol||item.symbol;
   heading.querySelector('.coin-open').textContent=url?'↗':'Pending';
   info.querySelector('.coin-full-name').textContent=chosen?.name||item.name;
   chain.textContent=chosen?[(chosen.chain==='solana'?'SOL':chosen.chain.toUpperCase()),chosen.contractReference?.kind==='bridged'?'BINANCE-PEG':chosen.contractReference?.kind==='wrapped'?'WRAPPED':'',item.catalogueRank?'#'+item.catalogueRank:''].filter(Boolean).join(' · '):'CONTRACT UNAVAILABLE';
   chain.title=chosen?.address||'No verified contract is available for this collectible.';
   const source=frame?.snapshot;
   previewStatus.hidden=Boolean(source&&image.getAttribute('src')===source&&image.complete&&image.naturalWidth>0);previewStatus.textContent='Loading preview…';
   if(source){if(image.getAttribute('src')!==source){image.style.opacity='0';image.hidden=false;image.src=source;}}else{image.hidden=true;image.removeAttribute('src');}
   capValue.textContent=money(frame?.marketCap??chosen?.marketCap);
  };image.addEventListener('load',()=>{if(image.hasAttribute('src')){image.hidden=false;image.style.opacity='1';previewStatus.hidden=true;}});image.addEventListener('error',()=>{const source=image.getAttribute('src');if(source){rejectedPreviews.add(source);}selectReadyCoins();});update();
  card.append(art,info);const wrapper=element('div',null,'coin-collectible-wrapper');wrapper.append(card);cards.set(item.id,{wrapper,update});grid.append(wrapper);
 }
 $('coin-gallery-empty').hidden=items.length>0;more.hidden=items.length<=visible;more.textContent='Load more · '+Math.min(visible,items.length)+' / '+items.length.toLocaleString();
}
const networkGroup=document.querySelector('.marketplace-networks');
// Keep the complete server-rendered network row while the manifest loads.
networkGroup.inert=true;networkGroup.setAttribute('aria-busy','true');
function networkButton(chain,name,imageURL){const button=element('button');button.type='button';button.dataset.chain=chain;button.setAttribute('aria-pressed',String(chain==='all'));button.setAttribute('aria-label',name);if(imageURL){const image=element('img',null,'network-mark');image.src=imageURL;image.alt='';image.width=32;image.height=32;image.draggable=false;image.addEventListener('error',()=>{image.remove();button.prepend(element('span',chain.slice(0,2).toUpperCase(),'network-fallback'));},{once:true});button.append(image,element('span',name,'network-name'));}else{button.textContent=chain==='all'?'All':name;button.title=name;}button.addEventListener('click',()=>{if(![...network.options].some(o=>o.value===chain)){const option=element('option',name);option.value=chain;network.append(option);}network.value=chain;for(const item of networkGroup.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item===button));network.dispatchEvent(new Event('change'));});networkGroup.append(button);}
// Manifest metadata determines the initial collection. Images load naturally
// in visible cards, rather than downloading/decoding 100 images in serial
// batches before the first card can appear. A failed image gives its slot to
// the next contract-linked candidate; no invented preview is substituted.
function selectReadyCoins(){
 records=genesisCollectibles(candidateCoins,Infinity).filter(coin=>{
  const source=collectiblePreview(coin).capture?.snapshot;
  return source&&!rejectedPreviews.has(source);
 }).slice(0,100);
 if(!records.length)$('coin-gallery-empty').textContent='Previews are temporarily unavailable. Please try again shortly.';
 const chains=[...new Set(records.flatMap(coin=>(coin.platforms||[]).map(p=>p.chain).concat(collectiblePreview(coin).selection.chain)).filter(chain=>records.some(coin=>{const source=collectiblePreview(coin,chain).capture?.snapshot;return source&&!rejectedPreviews.has(source);})))].sort();
 network.replaceChildren();const all=element('option','All networks');all.value='all';network.append(all);
 for(const chain of chains){const option=element('option',chain==='solana'?'SOL':chain.toUpperCase());option.value=chain;network.append(option);}
 const selected=networkGroup.querySelector('[aria-pressed=true]')?.dataset.chain||'all';network.value=chains.includes(selected)?selected:'all';
 networkGroup.replaceChildren();networkButton('all','All networks');
 for(const chain of chains){const mark=searchNetworks(candidateCoins).find(item=>item.chain===chain);networkButton(chain,mark?.name||chain,mark?.image);}
 for(const button of networkGroup.children)button.setAttribute('aria-pressed',String(button.dataset.chain===network.value));
 networkGroup.inert=false;networkGroup.setAttribute('aria-busy','false');grid.setAttribute('aria-busy','false');
 render();
}
async function loadFrames(){
 count.textContent='Loading previews…';
 grid.setAttribute('aria-busy','true');
 const [catalogue,initialFrames]=await Promise.all([loadCoinCatalogue(),loadCloudCaptures()]);
 candidateCoins=catalogue.coins.map(coin=>({...coin,captures:{}}));
 const byKey=new Map();
 for(const coin of candidateCoins){const selection=collectiblePreview(coin).selection;if(selection){const rows=byKey.get(selection.key)||[];rows.push(coin);byKey.set(selection.key,rows);}}
 async function refresh(force=false,initial){
  const frames=initial||await loadCloudCaptures({force});
  for(const frame of frames)for(const coin of byKey.get(frame.key)||[])storeCapture(coin,frame);
  selectReadyCoins();
 }
 refreshSaved=async()=>{if(document.hidden||gallery.hidden)return;if(refreshing)return refreshing;refreshing=refresh(true).catch(()=>{/* Keep loaded previews during an outage. */}).finally(()=>{refreshing=null;});return refreshing;};
 await refresh(false,initialFrames);
}

bindMarketplaceCoinSearch();
const reset=()=>{visible=40;render();};network.addEventListener('change',reset);
const captureRefresh=setInterval(()=>void refreshSaved(),60000);
window.addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(captureRefresh);});
const retry=element('button','Try again','coin-gallery-more');retry.type='button';retry.hidden=true;$('coin-gallery-empty').after(retry);
function loadFailure(){grid.setAttribute('aria-busy','false');grid.querySelectorAll('.coin-placeholder').forEach(node=>node.remove());retry.hidden=false;count.textContent='Collection unavailable';$('coin-gallery-empty').textContent='The collection could not load. Please try again shortly.';$('coin-gallery-empty').hidden=false;}
retry.addEventListener('click',()=>{retry.hidden=true;$('coin-gallery-empty').hidden=true;void loadFrames().catch(loadFailure);});
void loadFrames().catch(loadFailure);

document.querySelector('button.header-search')?.addEventListener('click',()=>{if(matchMedia('(min-width:761px)').matches)search?.focus();});

window.addEventListener('focus',()=>void refreshSaved());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshSaved();});
