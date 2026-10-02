import {fetchGecko} from './gecko.js?v=39';
const aliases={eth:'ethereum',polygon_pos:'polygon',avax:'avalanche',ftm:'fantom',cro:'cronos'};
const money=value=>value!=null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?'$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(Number(value)):null;
function node(tag,text,className){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;}
function safeImage(url){try{const parsed=new URL(url);return parsed.protocol==='https:'?parsed.href:null;}catch{return null;}}
export function startTrending(onPick){
 const list=document.getElementById('trending-list'),status=document.getElementById('trending-status'),duration=document.getElementById('trending-duration');
 let generation=0,controller,timer,updated=null,offset=0,width=0,lastFrame=0,initialPick=true;
 let hovered=false,focused=false,dragging=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const items=new Map();
 const key=item=>item.chain+':'+(/^0x/i.test(item.address)?item.address.toLowerCase():item.address);
 function card(item,duplicate=false){
  const article=node('article',null,'trending-card');article.dataset.tokenKey=key(item);
  const pick=node('button',null,'trending-pick');pick.type='button';pick.title=item.name+' · '+item.network+' · '+item.address;
  pick.setAttribute('aria-label','Play '+item.name+' on '+item.network+', market cap '+(money(item.marketCap)||'unknown'));
  const avatar=node('span',item.symbol.slice(0,2),'trending-avatar'),url=safeImage(item.image);
  avatar.setAttribute('aria-hidden','true');
  if(url){const img=node('img');img.src=url;img.alt='';img.width=24;img.height=24;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>{img.remove();avatar.textContent=item.symbol.slice(0,2);};avatar.textContent='';avatar.append(img);}
  pick.append(avatar,node('b',item.symbol,'trending-name'),node('span',money(item.marketCap)||'MCAP —','trending-market-cap'));
  pick.onclick=()=>onPick(item);article.append(pick);
  if(duplicate){article.setAttribute('aria-hidden','true');pick.tabIndex=-1;}
  return article;
 }
 const track=node('div',null,'ticker-track'),empty=node('button',null,'trending-empty');empty.type='button';empty.setAttribute('aria-live','polite');list.replaceChildren(track,empty);
 function placeholder(message,busy=false){empty.hidden=items.size>0;empty.textContent=message;empty.disabled=busy;list.setAttribute('aria-busy',String(busy));empty.classList.toggle('is-loading',busy);}
 empty.onclick=()=>refresh();
 const resize=new ResizeObserver(()=>{width=track.firstElementChild?.getBoundingClientRect().width||0;offset=width?offset%width:0;});resize.observe(list);
 function anchor(){
  const group=track.firstElementChild;if(!group)return null;const left=group.getBoundingClientRect().left;
  for(const card of group.children){const rect=card.getBoundingClientRect(),start=rect.left-left;if(start<=offset&&start+rect.width>offset)return {key:card.dataset.tokenKey,within:offset-start};}
  return null;
 }
 function render(){
  const held=anchor(),coins=[...items.values()],group=node('div',null,'ticker-group');
  group.append(...coins.map(item=>card(item)));track.replaceChildren(group);
  // A loop always covers the viewport, even when only a few coins exist.
  if(coins.length)while(group.getBoundingClientRect().width<list.clientWidth){group.append(...coins.map(item=>card(item,true)));}
  const repeat=node('div',null,'ticker-group');repeat.append(...[...group.children].map(cardNode=>{const item=items.get(cardNode.dataset.tokenKey);return card(item,true);}));repeat.setAttribute('aria-hidden','true');track.append(repeat);
  width=group.getBoundingClientRect().width;
  if(held){const match=[...group.children].find(card=>card.dataset.tokenKey===held.key);if(match){offset=match.getBoundingClientRect().left-group.getBoundingClientRect().left+Math.min(held.within,match.getBoundingClientRect().width);}}
  offset=width?offset%width:0;track.style.transform=reduced.matches?'none':`translateX(${-offset}px)`;
 }
 list.addEventListener('pointerenter',()=>{hovered=true;});list.addEventListener('pointerleave',()=>{hovered=false;});
 list.addEventListener('focusin',e=>{focused=e.target.matches(':focus-visible');const card=e.target.closest('.trending-card');if(card&&width&&e.target.matches(':focus-visible')&&!dragging){offset=(card.getBoundingClientRect().left-track.getBoundingClientRect().left)%width;}});list.addEventListener('focusout',e=>{focused=!!e.relatedTarget?.matches?.(':focus-visible')&&list.contains(e.relatedTarget);});
 list.addEventListener('pointerdown',()=>{dragging=true;});window.addEventListener('pointerup',e=>{dragging=false;if(e.pointerType!=='mouse')hovered=false;});window.addEventListener('pointercancel',()=>{dragging=false;});
 list.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY)&&width){e.preventDefault();offset=((offset+e.deltaX)%width+width)%width;}},{passive:false});
 list.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)&&width){e.preventDefault();offset=((offset+(e.key==='ArrowRight'?180:-180))%width+width)%width;}});
 function animate(now){
  const elapsed=lastFrame?Math.min(100,now-lastFrame):0;lastFrame=now;
  if(!document.hidden&&width&&!hovered&&!focused&&!dragging&&!reduced.matches)offset=(offset+elapsed*.035)%width;
  track.style.transform=reduced.matches?'none':`translateX(${-offset}px)`;
  if(!reduced.matches)list.scrollLeft=0;
  requestAnimationFrame(animate);
 }
 requestAnimationFrame(animate);
 async function refresh(){
  const gen=++generation;controller?.abort();clearTimeout(timer);controller=new AbortController();const signal=controller.signal;
  let timeout=setTimeout(()=>controller.abort(),35000);const next=new Map();let total=0;
  status.textContent='Loading trending markets…';
  placeholder('Loading trending coins',true);
  try{
   for(let page=1;page<=10;page++){
    const r=await fetchGecko('https://api.geckoterminal.com/api/v2/networks/trending_pools?include=base_token,network&duration='+encodeURIComponent(duration.value)+'&page='+page,{signal,priority:5});
    if(!r.ok)throw Error('Trending provider HTTP '+r.status);const data=await r.json();if(gen!==generation||signal.aborted)return;
    if(!Array.isArray(data.data))throw Error('Unexpected trending response');const included=new Map((data.included||[]).map(x=>[x.id,x]));
    for(const pool of data.data){
     total++;const networkID=pool.relationships?.network?.data?.id,token=included.get(pool.relationships?.base_token?.data?.id)?.attributes,network=included.get(networkID)?.attributes;
     if(!networkID||!token?.address)continue;
     const item={rank:total,chain:aliases[networkID]||networkID,network:network?.name||networkID,address:token.address,symbol:token.symbol||token.name||'TOKEN',name:token.name||token.symbol||'Token',image:token.image_url,marketCap:pool.attributes?.market_cap_usd,fdv:pool.attributes?.fdv_usd};
     if(!next.has(key(item)))next.set(key(item),item);
    }
    items.clear();for(const [id,item] of next)items.set(id,item);updated=Date.now();render();placeholder('',true);
    if(page===1){clearTimeout(timeout);timeout=setTimeout(()=>controller.abort(),180000);}
    // Open the highest-ranked pool on first load. This is intentionally not an
    // autoplay action: mobile browsers require a direct tap before audio starts.
    if(initialPick&&items.size){initialPick=false;onPick([...items.values()][0],{initial:true,autoplay:false});}
    status.textContent=items.size+' coins · '+total+' trending pools · fetched '+new Date(updated).toLocaleTimeString()+(data.data.length<20||page===10?' · refresh every 5 min':' · loading more…');
    if(data.data.length<20)break;
   }
   if(!items.size){status.textContent='No indexed trending coins returned';placeholder('No trending coins · click this bar to refresh');}
  }catch(error){if(gen!==generation)return;status.textContent=(items.size?items.size+' coins · retained '+(updated?new Date(updated).toLocaleTimeString():'earlier')+' data · ':'')+(error.name==='AbortError'?'Trending request timed out':error.message)+' · click Refresh to retry';placeholder('Trending unavailable · click this bar to refresh');}
  finally{clearTimeout(timeout);if(gen===generation){list.setAttribute('aria-busy','false');empty.disabled=false;empty.classList.remove('is-loading');timer=setTimeout(refresh,items.size?300000:60000);}}
 }
 document.getElementById('trending-refresh').onclick=refresh;
 duration.onchange=refresh;
 refresh();
}
