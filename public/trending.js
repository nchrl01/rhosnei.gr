import {fetchGecko} from './gecko.js?v=39';
const REFRESH_MS=30000;
const aliases={eth:'ethereum',polygon_pos:'polygon',avax:'avalanche',ftm:'fantom',cro:'cronos'};
const money=value=>value!=null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?'$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(Number(value)):null;
function node(tag,text,className){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;}
function safeImage(url){try{const parsed=new URL(url);return parsed.protocol==='https:'?parsed.href:null;}catch{return null;}}
export function startTrending(onPick){
 const list=document.getElementById('trending-list'),status=document.getElementById('trending-status'),duration=document.getElementById('trending-duration');
 let generation=0,controller,timer,updated=null,offset=0,width=0,lastFrame=0,initialPick=true;
 let hovered=false,focused=false,dragging=false,pending=null,failures=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const items=new Map();
 const key=item=>item.chain+':'+(/^0x/i.test(item.address)?item.address.toLowerCase():item.address);
 function card(item,duplicate=false){
  const article=node('article',null,'trending-card');article.dataset.tokenKey=key(item);article.dataset.rank=String(item.rank);
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
  for(const card of group.children){const rect=card.getBoundingClientRect(),start=rect.left-left;const position=reduced.matches?list.scrollLeft:offset;if(start<=position&&start+rect.width>position)return {key:card.dataset.tokenKey,within:position-start};}
  return null;
 }
 function render(){
  const held=anchor(),focusKey=document.activeElement?.closest('.trending-card')?.dataset.tokenKey,coins=[...items.values()],group=node('div',null,'ticker-group');
  group.append(...coins.map(item=>card(item)));track.replaceChildren(group);
  // A loop always covers the viewport, even when only a few coins exist.
  if(coins.length)while(group.getBoundingClientRect().width<list.clientWidth){group.append(...coins.map(item=>card(item,true)));}
  const repeat=node('div',null,'ticker-group');repeat.append(...[...group.children].map(cardNode=>{const item=items.get(cardNode.dataset.tokenKey);return card(item,true);}));repeat.setAttribute('aria-hidden','true');track.append(repeat);
  width=group.getBoundingClientRect().width;
  if(held){const match=[...group.children].find(card=>card.dataset.tokenKey===held.key);if(match){offset=match.getBoundingClientRect().left-group.getBoundingClientRect().left+Math.min(held.within,match.getBoundingClientRect().width);}}
  offset=width?offset%width:0;track.style.transform=reduced.matches?'none':`translateX(${-offset}px)`;
  if(reduced.matches)list.scrollLeft=offset;
  if(focusKey){const target=[...group.children].find(el=>el.dataset.tokenKey===focusKey)?.querySelector('button');(target||list).focus({preventScroll:true});}
 }
 list.addEventListener('pointerenter',()=>{hovered=true;});list.addEventListener('pointerleave',()=>{hovered=false;});
 list.addEventListener('focusin',e=>{focused=e.target.matches(':focus-visible');const card=e.target.closest('.trending-card');if(card&&width&&e.target.matches(':focus-visible')&&!dragging){offset=(card.getBoundingClientRect().left-track.getBoundingClientRect().left)%width;}});list.addEventListener('focusout',e=>{focused=!!e.relatedTarget?.matches?.(':focus-visible')&&list.contains(e.relatedTarget);});
 let pointer=null,suppressClick=false,manualUntil=0;
 function moveBy(delta){
  if(!width)return;
  manualUntil=performance.now()+1800;
  if(reduced.matches){list.scrollLeft+=delta;return;}
  offset=((offset+delta)%width+width)%width;
  track.style.transform=`translateX(${-offset}px)`;
 }
 list.addEventListener('pointerdown',e=>{
  if(e.button!==0||!width)return;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,last:e.clientX};suppressClick=false;dragging=true;
 });
 list.addEventListener('pointermove',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
  if(!suppressClick){
   if(Math.abs(dx)<6||Math.abs(dx)<=Math.abs(dy))return;
   suppressClick=true;list.setPointerCapture(e.pointerId);list.classList.add('is-dragging');
  }
  moveBy(pointer.last-e.clientX);pointer.last=e.clientX;
 });
 function release(e){
  if(!pointer||pointer.id!==e.pointerId)return;
  if(list.hasPointerCapture(e.pointerId))list.releasePointerCapture(e.pointerId);
  pointer=null;dragging=false;list.classList.remove('is-dragging');manualUntil=performance.now()+1800;
  if(e.pointerType!=='mouse')hovered=false;
  // Let a completed click reach its original coin before applying a new order.
  if(pending)setTimeout(()=>{if(!dragging&&pending){const next=pending;pending=null;applyRanking(next);}},0);
 }
 window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
 list.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;}},true);
 list.addEventListener('dragstart',e=>e.preventDefault());
 list.addEventListener('wheel',e=>{
  if(!width)return;
  const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
  if(!delta)return;e.preventDefault();moveBy(delta*(e.deltaMode===1?16:e.deltaMode===2?list.clientWidth:1));
 },{passive:false});
 list.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)&&width){e.preventDefault();moveBy(e.key==='ArrowRight'?180:-180);}});
 function animate(now){
  const elapsed=lastFrame?Math.min(100,now-lastFrame):0;lastFrame=now;
  if(!document.hidden&&width&&!hovered&&!focused&&!dragging&&now>=manualUntil&&!reduced.matches)offset=(offset+elapsed*.035)%width;
  track.style.transform=reduced.matches?'none':`translateX(${-offset}px)`;
  if(!reduced.matches)list.scrollLeft=0;
  requestAnimationFrame(animate);
 }
 requestAnimationFrame(animate);
 function applyRanking(next){
  if(dragging){pending=next;return;}
  const changed=JSON.stringify([...items.values()])!==JSON.stringify([...next.values()]);
  items.clear();for(const [id,item] of next)items.set(id,item);
  if(changed)render();
  placeholder(next.size?'':'No trending coins · click this bar to refresh',false);
  if(initialPick&&items.size){initialPick=false;onPick([...items.values()][0],{initial:true,autoplay:false});}
 }
 async function refresh(){
  const gen=++generation;controller?.abort();clearTimeout(timer);pending=null;
  const request=new AbortController();controller=request;const signal=request.signal;
  const timeout=setTimeout(()=>request.abort(),35000);
  status.textContent=items.size?'Updating trending order…':'Loading trending markets…';
  placeholder('Loading trending coins',true);
  try{
   // Refresh the leading page as one ranking snapshot. Deep pagination used
   // to occupy the shared free-provider budget and delay the next ranking.
   const response=await fetchGecko('https://api.geckoterminal.com/api/v2/networks/trending_pools?include=base_token,network&duration='+encodeURIComponent(duration.value)+'&page=1',{signal,priority:30});
   if(!response.ok)throw Error('Trending provider HTTP '+response.status);
   const data=await response.json();if(gen!==generation||signal.aborted)return;
   if(!Array.isArray(data.data))throw Error('Unexpected trending response');
   const included=new Map((data.included||[]).map(x=>[x.id,x])),next=new Map();let rank=0;
   for(const pool of data.data){
    rank++;const networkID=pool.relationships?.network?.data?.id,token=included.get(pool.relationships?.base_token?.data?.id)?.attributes,network=included.get(networkID)?.attributes;
    if(!networkID||!token?.address)continue;
    const item={rank,chain:aliases[networkID]||networkID,network:network?.name||networkID,address:token.address,symbol:token.symbol||token.name||'TOKEN',name:token.name||token.symbol||'Token',image:token.image_url,marketCap:pool.attributes?.market_cap_usd,fdv:pool.attributes?.fdv_usd};
    if(!next.has(key(item)))next.set(key(item),item);
   }
   updated=Date.now();failures=0;applyRanking(next);
   status.textContent=next.size+' coins · top '+data.data.length+' trending pools · checked '+new Date(updated).toLocaleTimeString()+' · auto refresh 30s · provider-cached ranking';
   if(!next.size)placeholder('No trending coins · click this bar to refresh');
  }catch(error){
   if(gen!==generation)return;failures++;
   status.textContent=(items.size?items.size+' coins · retained '+(updated?new Date(updated).toLocaleTimeString():'earlier')+' data · ':'')+(error.name==='AbortError'?'Trending request timed out':error.message)+' · retrying automatically';
   placeholder('Trending unavailable · click this bar to refresh');
  }finally{
   clearTimeout(timeout);
   if(gen===generation){list.setAttribute('aria-busy','false');empty.disabled=false;empty.classList.remove('is-loading');if(!document.hidden)timer=setTimeout(refresh,failures?Math.min(300000,30000*2**failures):REFRESH_MS);}
  }
 }
 document.addEventListener('visibilitychange',()=>{
  clearTimeout(timer);
  if(!document.hidden)refresh();
 });
 document.getElementById('trending-refresh').onclick=refresh;
 duration.onchange=refresh;
 refresh();
}
