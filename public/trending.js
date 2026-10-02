import {fetchGecko} from './gecko.js?v=1';
const aliases={eth:'ethereum',polygon_pos:'polygon',avax:'avalanche',ftm:'fantom',cro:'cronos'};
const money=value=>value!=null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?'$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(Number(value)):null;
function node(tag,text,className){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;}
function safeImage(url){try{const parsed=new URL(url);return parsed.protocol==='https:'?parsed.href:null;}catch{return null;}}
export function startTrending(onPick){
 const list=document.getElementById('trending-list'),status=document.getElementById('trending-status'),duration=document.getElementById('trending-duration');
 let generation=0,controller,timer,updated=null,offset=0,width=0,lastFrame=0;
 let hovered=false,focused=false,dragging=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const items=new Map();
 const key=item=>item.chain+':'+(/^0x/i.test(item.address)?item.address.toLowerCase():item.address);
 function card(item,duplicate=false){
  const article=node('article',null,'trending-card'),pick=node('button',null,'trending-pick');pick.type='button';pick.title='Load '+item.name+' on '+item.network;pick.setAttribute('aria-label',pick.title);
  const avatar=node('span',item.symbol.slice(0,2),'trending-avatar'),url=safeImage(item.image);
  if(url){const img=node('img');img.src=url;img.alt='';img.width=32;img.height=32;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>{img.remove();avatar.textContent=item.symbol.slice(0,2);};avatar.textContent='';avatar.append(img);}
  const title=node('span',null,'trending-title');title.append(node('b',item.symbol),node('small','#'+item.rank+' · '+item.network));pick.append(avatar,title,node('span','↗','trending-arrow'));pick.onclick=()=>onPick(item);article.append(pick);
  const cap=node('div',null,'trending-cap'),marketCap=money(item.marketCap);cap.append(node('span','MCAP'),node('strong',marketCap||'Unknown'));
  if(!marketCap&&money(item.fdv))cap.append(node('small','FDV '+money(item.fdv)));article.append(cap);
  const ca=node('div',null,'trending-ca'),address=node('code',item.address);address.title=item.address;
  const copy=node('button','Copy CA');copy.type='button';copy.setAttribute('aria-label','Copy '+item.symbol+' contract address');copy.onclick=async()=>{try{await navigator.clipboard.writeText(item.address);copy.textContent='Copied';}catch{copy.textContent='Select CA';address.focus();}setTimeout(()=>{copy.textContent='Copy CA';},1800);};
  address.tabIndex=0;ca.append(address,copy);article.append(ca);if(duplicate){article.setAttribute('aria-hidden','true');for(const el of article.querySelectorAll('button,[tabindex]'))el.tabIndex=-1;}return article;
 }
 const track=node('div',null,'ticker-track');list.replaceChildren(track);
 const resize=new ResizeObserver(()=>{width=track.firstElementChild?.getBoundingClientRect().width||0;offset=width?offset%width:0;});resize.observe(list);
 function render(){
  const coins=[...items.values()],group=node('div',null,'ticker-group'),repeat=node('div',null,'ticker-group');
  group.append(...coins.map(item=>card(item)));repeat.append(...coins.map(item=>card(item,true)));repeat.setAttribute('aria-hidden','true');
  track.replaceChildren(group,repeat);width=group.getBoundingClientRect().width;offset=width?offset%width:0;
 }
 list.addEventListener('pointerenter',()=>{hovered=true;});list.addEventListener('pointerleave',()=>{hovered=false;});
 list.addEventListener('focusin',e=>{focused=true;const card=e.target.closest('.trending-card');if(card&&width){offset=(card.getBoundingClientRect().left-track.getBoundingClientRect().left)%width;}});list.addEventListener('focusout',e=>{focused=list.contains(e.relatedTarget);});
 list.addEventListener('pointerdown',()=>{dragging=true;});window.addEventListener('pointerup',e=>{dragging=false;if(e.pointerType!=='mouse')hovered=false;});window.addEventListener('pointercancel',()=>{dragging=false;});
 list.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY)&&width){e.preventDefault();offset=((offset+e.deltaX)%width+width)%width;}},{passive:false});
 list.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)&&width){e.preventDefault();offset=((offset+(e.key==='ArrowRight'?180:-180))%width+width)%width;}});
 function animate(now){
  const elapsed=lastFrame?Math.min(100,now-lastFrame):0;lastFrame=now;
  if(!document.hidden&&width&&!hovered&&!focused&&!dragging&&!reduced.matches&&!list.classList.contains('expanded'))offset=(offset+elapsed*.035)%width;
  track.style.transform=reduced.matches||list.classList.contains('expanded')?'none':`translateX(${-offset}px)`;
  requestAnimationFrame(animate);
 }
 requestAnimationFrame(animate);
 async function refresh(){
  const gen=++generation;controller?.abort();clearTimeout(timer);controller=new AbortController();const signal=controller.signal;
  const timeout=setTimeout(()=>controller.abort(),600000),next=new Map();let total=0;
  status.textContent='Loading trending markets…';
  try{
   for(let page=1;page<=10;page++){
    const r=await fetchGecko('https://api.geckoterminal.com/api/v2/networks/trending_pools?include=base_token,network&duration='+encodeURIComponent(duration.value)+'&page='+page,{signal});
    if(!r.ok)throw Error('Trending provider HTTP '+r.status);const data=await r.json();if(gen!==generation||signal.aborted)return;
    if(!Array.isArray(data.data))throw Error('Unexpected trending response');const included=new Map((data.included||[]).map(x=>[x.id,x]));
    for(const pool of data.data){
     total++;const networkID=pool.relationships?.network?.data?.id,token=included.get(pool.relationships?.base_token?.data?.id)?.attributes,network=included.get(networkID)?.attributes;
     if(!networkID||!token?.address)continue;
     const item={rank:total,chain:aliases[networkID]||networkID,network:network?.name||networkID,address:token.address,symbol:token.symbol||token.name||'TOKEN',name:token.name||token.symbol||'Token',image:token.image_url,marketCap:pool.attributes?.market_cap_usd,fdv:pool.attributes?.fdv_usd};
     if(!next.has(key(item)))next.set(key(item),item);
    }
    items.clear();for(const [id,item] of next)items.set(id,item);updated=Date.now();render();
    status.textContent=items.size+' coins · '+total+' trending pools · fetched '+new Date(updated).toLocaleTimeString()+(data.data.length<20||page===10?' · refresh every 5 min':' · loading more…');
    if(data.data.length<20)break;
   }
   if(!items.size)status.textContent='No indexed trending coins returned';
  }catch(error){if(gen!==generation)return;status.textContent=(items.size?items.size+' coins · retained '+(updated?new Date(updated).toLocaleTimeString():'earlier')+' data · ':'')+error.message+' · retry in 5 min';}
  finally{clearTimeout(timeout);if(gen===generation){timer=setTimeout(refresh,300000);}}
 }
 document.getElementById('trending-refresh').onclick=refresh;
 duration.onchange=()=>{items.clear();render();refresh();};
 document.getElementById('trending-expand').onclick=e=>{const expanded=list.classList.toggle('expanded');e.currentTarget.textContent=expanded?'Ticker':'Show list';e.currentTarget.setAttribute('aria-expanded',String(expanded));};
 refresh();
}
