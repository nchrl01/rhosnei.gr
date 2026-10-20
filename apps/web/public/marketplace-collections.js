import {attachArtworkDither} from './coin-dither.js?v=276';
import {bindSearchField} from './search-field.js?v=381';
const API='https://upic-insightx.nchrl01.workers.dev/marketplace';
const search=document.getElementById('marketplace-search'),buttons=[...document.querySelectorAll('[data-chain]')],title=document.getElementById('marketplace-empty-title'),note=document.getElementById('marketplace-empty-note'),empty=document.querySelector('.marketplace-empty'),count=document.getElementById('marketplace-result-count');
const grid=document.createElement('div');grid.className='marketplace-grid';grid.id='marketplace-grid';empty.before(grid);
const back=document.createElement('button');back.textContent='← All collections';back.hidden=true;grid.before(back);
const more=document.createElement('button');more.textContent='Load more';more.hidden=true;grid.after(more);
const retry=document.createElement('button');retry.textContent='Try again';retry.hidden=true;empty.append(retry);
const sort=document.getElementById('marketplace-sort');let sortMode='volume';
function syncSort(){const defaultLabel=collection?'Collection order':query?'Relevance':'Popular this week';sort.textContent=sortMode==='name'?'Name A–Z':defaultLabel;sort.title='Click to switch order';sort.setAttribute('aria-label',sort.textContent+'. Switch to '+(sortMode==='name'?defaultLabel:'Name A–Z'));}
const form=document.getElementById('marketplace-form'),submit=document.getElementById('marketplace-submit'),feedback=document.getElementById('marketplace-feedback'),loaderHost=document.getElementById('marketplace-loader');
bindSearchField(search,document.getElementById('address-label'));
let loader,loadingState=null;
import('./vendor/ui/upic-ui.js?v=391').then(module=>{loader=module.mountLoader(loaderHost);loaderHost.hidden=!loadingState;loader.update(loadingState);}).catch(()=>{});
function searchBusy(value){busy=value;syncSort();loaderHost.hidden=!value;title.hidden=value;empty.querySelector('img').hidden=value;empty.querySelector('a').hidden=value;submit.disabled=value;submit.textContent=value?'Searching…':'Search';submit.setAttribute('aria-busy',String(value));form.setAttribute('aria-busy',String(value));grid.setAttribute('aria-busy',String(value));loadingState=value?{status:'working',label:collection?'Loading NFTs':'Loading collections',startedAt:performance.now(),operation:String(revision)}:null;loader?.update(loadingState);}
let chain='all',next='',busy=false,controller,revision=0,rows=[],collection='',query='';
function safeURL(value,host){try{const u=new URL(value);return u.protocol==='https:'&&(!host||u.hostname===host)?u.href:'';}catch{return '';}}
function render(){
 syncSort();
 grid.replaceChildren();const items=sortMode==='name'?[...rows].sort((a,b)=>(a.name||'').localeCompare(b.name||'')):rows;
 for(const item of items){
  if(item.is_disabled||item.is_nsfw)continue;
  const card=document.createElement(collection?'a':'button');card.className='collection-card';
  if(collection){const href=safeURL(item.opensea_url,'opensea.io');if(!href)continue;card.href=href;card.target='_blank';card.rel='noopener noreferrer';}
  else{card.type='button';card.addEventListener('click',()=>{collection=item.collection;next='';back.hidden=false;void load();});}
  const image=document.createElement('img');image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';const src=safeURL(item.display_image_url||item.image_url);if(src)image.src=src;image.addEventListener('error',()=>{image.removeAttribute('src');});
  const name=document.createElement('h2');name.textContent=item.name||item.collection||('#'+item.identifier);
  const label=document.createElement('span');label.textContent=collection?'View / trade on OpenSea ↗':(item.contracts?.map(c=>c.chain).filter((v,i,a)=>a.indexOf(v)===i).join(' · ').toUpperCase()||'Explore collection');const artwork=document.createElement('span');artwork.className='collection-artwork';artwork.append(image);card.draggable=false;card.addEventListener('dragstart',event=>event.preventDefault());card.append(artwork,name,label);grid.append(card);attachArtworkDither(image);
 }
 count.textContent=grid.children.length+(collection?' NFTs':' collections');empty.hidden=grid.children.length>0;
 if(!grid.children.length&&!busy){title.textContent='No results';note.textContent='Try another collection or network.';}
 more.hidden=!next;more.disabled=busy;
}
async function load(append=false){
 controller?.abort();controller=new AbortController();const current=++revision;searchBusy(true);more.disabled=true;retry.hidden=true;feedback.textContent='';
 if(!append){rows=[];next='';grid.replaceChildren();empty.hidden=false;title.textContent=collection?'Loading NFTs':'Loading collections';note.textContent='';count.textContent='';}
 try{
  const params=new URLSearchParams();if(chain!=='all'&&!collection)params.set('chain',chain);if(collection)params.set('collection',collection);else if(query)params.set('query',query);if(append&&next)params.set('next',next);
  const response=await fetch(API+(collection?'/nfts':query?'/search':'/collections')+'?'+params,{signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Collections are unavailable.');if(current!==revision)return;
  const incoming=collection?data.nfts:query?(data.results||[]).filter(x=>x.type==='collection').map(x=>x.collection):data.collections;
  const unique=new Map([...rows,...(Array.isArray(incoming)?incoming:[])].filter(Boolean).map(item=>[collection?item.contract+':'+item.identifier:item.collection,item]));rows=[...unique.values()];next=query&&!collection?'':data.next||'';searchBusy(false);render();
 }catch(error){if(error.name==='AbortError'||current!==revision)return;searchBusy(false);empty.hidden=false;title.textContent='Collections unavailable';note.textContent=error.message;more.hidden=true;retry.hidden=false;}
}
function chooseNetwork(value){chain=value;collection='';back.hidden=true;for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.chain===chain));void load();}
for(const button of buttons)button.addEventListener('click',()=>chooseNetwork(button.dataset.chain));
form.addEventListener('submit',event=>{event.preventDefault();if(busy)return;query=search.value.trim();collection='';back.hidden=true;void load();});
search.addEventListener('input',()=>{controller?.abort();revision++;searchBusy(false);feedback.textContent='';if(!rows.length){title.textContent='Search collections';note.textContent='Press Search to find matching collections.';}});
search.addEventListener('keydown',event=>{
 if(event.key==='ArrowDown'){const first=grid.querySelector('button,a');if(first){event.preventDefault();first.focus();}}
 if(event.key==='Escape'){controller?.abort();revision++;searchBusy(false);feedback.textContent='Search cancelled';if(!rows.length){title.textContent='Search collections';note.textContent='Enter a name or contract address above.';}}
});
grid.addEventListener('keydown',event=>{if(event.key==='Escape'){search.focus();return;}if(!['ArrowRight','ArrowLeft'].includes(event.key))return;const cards=[...grid.children],index=cards.indexOf(document.activeElement);const target=cards[index+(event.key==='ArrowRight'?1:-1)];if(target){event.preventDefault();target.focus();}});
back.addEventListener('click',()=>{collection='';back.hidden=true;void load();});more.addEventListener('click',()=>load(true));retry.addEventListener('click',()=>load());sort.addEventListener('click',()=>{sortMode=sortMode==='name'?'volume':'name';syncSort();render();});
async function networks(){
 try{
  const response=await fetch(API+'/chains');if(!response.ok)return;
  const data=await response.json(),supported=new Set(data.chains.map(c=>c.chain));
  for(const b of buttons)if(b.dataset.chain!=='all'&&!supported.has(b.dataset.chain))b.hidden=true;
  const group=document.querySelector('.marketplace-networks');
  for(const c of data.chains){
   const existing=buttons.find(b=>b.dataset.chain===c.chain);
   if(existing)continue;
   if(!/^[a-z_]+$/.test(c.chain))continue;
   const button=document.createElement('button');button.type='button';button.dataset.chain=c.chain;
   button.setAttribute('aria-label',c.name);button.setAttribute('aria-pressed',String(c.chain===chain));
   const icon=document.createElement('img');icon.className='network-mark';icon.src='images/networks/'+c.chain+'.svg';icon.alt='';icon.width=32;icon.height=32;icon.draggable=false;
   const label=document.createElement('span');label.className='network-name';label.setAttribute('aria-hidden','true');label.textContent=c.name;
   button.append(icon,label);button.addEventListener('click',()=>chooseNetwork(c.chain));buttons.push(button);group.append(button);
  }
 }catch{}
}
syncSort();void networks();void load();
