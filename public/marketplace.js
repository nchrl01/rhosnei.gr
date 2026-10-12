const API='https://upic-insightx.nchrl01.workers.dev/marketplace';
const search=document.getElementById('marketplace-search'),buttons=[...document.querySelectorAll('[data-chain]')],title=document.getElementById('marketplace-empty-title'),note=document.getElementById('marketplace-empty-note'),empty=document.querySelector('.marketplace-empty'),count=document.getElementById('marketplace-result-count');
const grid=document.createElement('div');grid.className='marketplace-grid';empty.before(grid);
const back=document.createElement('button');back.textContent='← All collections';back.hidden=true;grid.before(back);
const more=document.createElement('button');more.textContent='Load more';more.hidden=true;grid.after(more);
const retry=document.createElement('button');retry.textContent='Try again';retry.hidden=true;empty.append(retry);
const sort=document.getElementById('marketplace-sort');sort.replaceChildren();for(const [value,label]of [['volume','Popular this week'],['name','Name A–Z']]){const option=document.createElement('option');option.value=value;option.textContent=label;sort.append(option);}
let chain='all',next='',busy=false,controller,revision=0,rows=[],collection='',query='',timer;
function safeURL(value,host){try{const u=new URL(value);return u.protocol==='https:'&&(!host||u.hostname===host)?u.href:'';}catch{return '';}}
function render(){
 grid.replaceChildren();const items=sort.value==='name'?[...rows].sort((a,b)=>(a.name||'').localeCompare(b.name||'')):rows;
 for(const item of items){
  if(item.is_disabled||item.is_nsfw)continue;
  const card=document.createElement(collection?'a':'button');card.className='collection-card';
  if(collection){const href=safeURL(item.opensea_url,'opensea.io');if(!href)continue;card.href=href;card.target='_blank';card.rel='noopener noreferrer';}
  else{card.type='button';card.addEventListener('click',()=>{collection=item.collection;next='';back.hidden=false;void load();});}
  const image=document.createElement('img');image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';const src=safeURL(item.display_image_url||item.image_url);if(src)image.src=src;image.addEventListener('error',()=>{image.removeAttribute('src');});
  const name=document.createElement('h2');name.textContent=item.name||item.collection||('#'+item.identifier);
  const label=document.createElement('span');label.textContent=collection?'View / trade on OpenSea ↗':(item.contracts?.map(c=>c.chain).filter((v,i,a)=>a.indexOf(v)===i).join(' · ')||'Explore collection');card.append(image,name,label);grid.append(card);
 }
 count.textContent=grid.children.length+(collection?' NFTs':' collections');empty.hidden=grid.children.length>0;
 if(!grid.children.length&&!busy){title.textContent='No results';note.textContent='Try another collection or network.';}
 more.hidden=!next;more.disabled=busy;
}
async function load(append=false){
 controller?.abort();controller=new AbortController();const current=++revision;busy=true;more.disabled=true;retry.hidden=true;
 if(!append){rows=[];next='';grid.replaceChildren();empty.hidden=false;title.textContent=collection?'Loading NFTs':'Loading collections';note.textContent='';count.textContent='';}
 try{
  const params=new URLSearchParams();if(chain!=='all'&&!collection)params.set('chain',chain);if(collection)params.set('collection',collection);else if(query)params.set('query',query);if(append&&next)params.set('next',next);
  const response=await fetch(API+(collection?'/nfts':query?'/search':'/collections')+'?'+params,{signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Collections are unavailable.');if(current!==revision)return;
  const incoming=collection?data.nfts:query?(data.results||[]).filter(x=>x.type==='collection').map(x=>x.collection):data.collections;
  const unique=new Map([...rows,...(Array.isArray(incoming)?incoming:[])].filter(Boolean).map(item=>[collection?item.contract+':'+item.identifier:item.collection,item]));rows=[...unique.values()];next=query&&!collection?'':data.next||'';busy=false;render();
 }catch(error){if(error.name==='AbortError'||current!==revision)return;busy=false;empty.hidden=false;title.textContent='Collections unavailable';note.textContent=error.message;more.hidden=true;retry.hidden=false;}
}
function chooseNetwork(value){chain=value;collection='';back.hidden=true;for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.chain===chain));void load();}
for(const button of buttons)button.addEventListener('click',()=>chooseNetwork(button.dataset.chain));
search.placeholder='Search collections or contract addresses';search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{query=search.value.trim();collection='';back.hidden=true;void load();},650);});
back.addEventListener('click',()=>{collection='';back.hidden=true;void load();});more.addEventListener('click',()=>load(true));retry.addEventListener('click',()=>load());sort.addEventListener('change',render);
async function networks(){try{const response=await fetch(API+'/chains');if(!response.ok)return;const data=await response.json();const supported=new Set(data.chains.map(c=>c.chain));for(const b of buttons)if(b.dataset.chain!=='all'&&!supported.has(b.dataset.chain))b.hidden=true;const extra=data.chains.filter(c=>!buttons.some(b=>b.dataset.chain===c.chain));if(!extra.length)return;const select=document.createElement('select');select.setAttribute('aria-label','More networks');const placeholder=new Option('More networks','');select.append(placeholder);for(const c of extra)select.append(new Option(c.name,c.chain));select.addEventListener('change',()=>{if(select.value)chooseNetwork(select.value);});document.querySelector('.marketplace-networks').append(select);}catch{}}
void networks();void load();
