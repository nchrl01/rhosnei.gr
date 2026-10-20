import {storeCapture,coinPreview,previewKey,loadCloudCaptures} from './coin-previews.js?v=390';
import {loadCoinCatalogue,coinOnNetwork,recentCoins,removeRecentCoin,rememberRecentCoin} from './coin-catalogue.js?v=359';
import {attachArtworkDither} from './coin-dither.js?v=276';
import {loadTrendingCoins} from './trending.js?v=391';
import {savedCoins,removeSavedCoin} from './saved-coins.js?v=394';
const money=value=>Number.isFinite(value)&&value>=0?'$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(value):'—';
function node(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
const icons={back:'<path d="m15 5-7 7 7 7"/>',paste:'<path d="M8 5H5v16h14V5h-3M9 3h6v4H9zM8 11h8M8 15h6"/>',trash:'<path d="M3 6h18M9 3h6M6 6l1 15h10l1-15M10 10v7M14 10v7"/>'};
function iconButton(label,icon,cls){const b=node('button',null,cls);b.type='button';b.setAttribute('aria-label',label);b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">'+icons[icon]+'</svg>';return b;}
export function bindMobileCoinSearch(){
 const trigger=document.querySelector('button.header-search'),form=document.querySelector('#coin-form,#marketplace-coin-form'),results=document.querySelector('#coin-search-results');if(!trigger||!form)return;
 const input=form.querySelector('input'),mobile=matchMedia('(max-width:760px)'),nodes=[form,results].filter(Boolean),anchors=nodes.map(n=>{const a=document.createComment('search position');n.before(a);return a;});
 const desktop=document.querySelector('.header-desktop-search'),header=desktop?.closest('.header-main'),desktopPanel=node('div',null,'header-search-panel');
 desktopPanel.id='header-search-panel';
 const desktopSaved=node('section',null,'saved-search-section');
 desktopSaved.setAttribute('aria-label','Saved coins');desktopPanel.append(desktopSaved);
 const feedback=[...form.querySelectorAll('#search-loader,#lookup')],feedbackAnchors=feedback.map(n=>{const anchor=document.createComment('search feedback position');n.before(anchor);return anchor;});let desktopOpen=false;
 desktopPanel.hidden=true;desktop?.append(desktopPanel);form.setAttribute('role','search');form.setAttribute('aria-label','Search coins');
 function paintDesktop(){
  if(!desktop)return;
  const hasFeedback=feedback.some(n=>!n.hidden&&n.textContent.trim()),hasResults=results&&!results.hidden;
  desktopPanel.hidden=mobile.matches||!desktopOpen||!(hasFeedback||hasResults||desktopSaved.childElementCount);
  if(!mobile.matches)input.setAttribute('aria-expanded',String(!desktopPanel.hidden));
 }
 const showDesktop=()=>{if(!mobile.matches){desktopOpen=true;paintDesktop();}};
 input.addEventListener('focus',()=>{paintDesktopSaved();showDesktop();});input.addEventListener('input',()=>{paintDesktopSaved();showDesktop();});form.addEventListener('submit',showDesktop);
 input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'&&!mobile.matches&&desktopOpen&&(!results||results.hidden)){const first=desktopSaved.querySelector('.saved-search-pick');if(first){event.preventDefault();first.focus();}}});
 if(desktop){
  let pointerInside=false;
  const observer=new MutationObserver(paintDesktop);
  for(const element of [...feedback,results].filter(Boolean))observer.observe(element,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true,characterData:true});
  desktop.addEventListener('focusin',showDesktop);
  desktop.addEventListener('pointerdown',()=>{pointerInside=true;});
  document.addEventListener('pointerup',()=>{pointerInside=false;});
  document.addEventListener('pointercancel',()=>{pointerInside=false;});
  // Safari may blur the input without focusing a clicked result button.
  // Keep that result mounted through the pointer's click so selection can run.
  desktop.addEventListener('focusout',()=>queueMicrotask(()=>{if(!pointerInside&&!desktop.contains(document.activeElement)){desktopOpen=false;paintDesktop();}}));
  document.addEventListener('pointerdown',event=>{if(!desktop.contains(event.target)){desktopOpen=false;paintDesktop();}});
  desktop.addEventListener('keydown',event=>{if(event.key==='Escape')queueMicrotask(()=>{desktopOpen=false;paintDesktop();});},true);
 }
 const dialog=node('dialog',null,'mobile-coin-search');dialog.id='mobile-coin-search';dialog.setAttribute('aria-label','Search coins');
 const top=node('div',null,'mobile-search-top'),back=iconButton('Back to player','back','mobile-search-back');top.append(back);
 const recent=node('section',null,'mobile-search-recent'),recentTop=node('div',null,'mobile-search-section-heading'),clear=iconButton('Clear recent coins','trash','mobile-search-clear'),chips=node('div',null,'mobile-search-chips');recentTop.append(node('h2','Recent'),clear);recent.append(recentTop,chips);
 const tabs=node('div',null,'mobile-search-categories');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Search category');let category='coins',visible=30;
 const suggestions=node('div',null,'mobile-search-suggestions'),status=node('p','Loading coins…','mobile-search-status');status.setAttribute('role','status');
 const filters=node('details',null,'mobile-search-filters'),filterSummary=node('summary','Filters'),filterPanel=node('div',null,'mobile-search-filter-panel');filters.append(filterSummary,filterPanel);
 const existingNetwork=document.getElementById('coin-gallery-network'),existingOrder=document.getElementById('coin-gallery-order');
 const network=existingNetwork||node('select'),order=existingOrder||node('select'),filterNodes=[],filterAnchors=[];
 if(!existingNetwork){network.setAttribute('aria-label','Network');const option=node('option','All networks');option.value='all';network.append(option);}
 if(!existingOrder){order.setAttribute('aria-label','Sort');for(const [value,text] of [['discover','Discover'],['recent','Recently updated'],['cap','Market cap'],['name','Name A–Z']]){const option=node('option',text);option.value=value;order.append(option);}}
 if(form.id==='marketplace-coin-form')order.value='cap';
 for(const [control,label] of [[network,'Network'],[order,'Sort']]){if(control===order&&form.id==='marketplace-coin-form')continue;if(control===existingNetwork||control===existingOrder){const wrapper=control.closest('label');if(!wrapper)continue;const anchor=document.createComment('search filter position');wrapper.before(anchor);filterNodes.push(wrapper);filterAnchors.push(anchor);}else{const wrapper=node('label');wrapper.append(node('span',label),control);filterPanel.append(wrapper);}}
 filters.hidden=!filterPanel.childElementCount&&!filterNodes.length;
 const categories=node('div',null,'mobile-search-category-row');categories.append(tabs,filters);
 const more=node('button','Load more coins','mobile-search-more');more.type='button';more.hidden=true;
 dialog.append(top,recent,categories,status,suggestions,more);document.body.append(dialog);let catalogue=[],trending=[],trendingLoading=null,trendingError='',loading,oldOverflow='',placeholder=input.getAttribute('placeholder');
 const paste=iconButton('Paste address','paste','mobile-search-paste');input.after(paste);
 function close(focus=true){if(dialog.open)dialog.close();document.documentElement.style.overflow=oldOverflow;if(focus)trigger.focus({preventScroll:true});trigger.setAttribute('aria-expanded','false');}
 function select(coin){coin=coinOnNetwork(coin,network.value);rememberRecentCoin(coin);paintRecent();document.dispatchEvent(new CustomEvent('upic:search-coin',{detail:coin}));}
 function selectSaved(coin){
  // A bookmark remembers the exact market; the discovery filter must not replace it.
  rememberRecentCoin(coin);paintRecent();desktopOpen=false;paintDesktop();if(dialog.open)close(false);
  document.dispatchEvent(new CustomEvent('upic:search-coin',{detail:coin}));
 }
 function matchingSaved(){const q=input.value.trim().toLowerCase();return savedCoins().filter(coin=>!q||[coin.symbol,coin.name,coin.address,coin.query,coin.chain,coin.nativeId,coin.exchangeId].some(value=>String(value||'').toLowerCase().includes(q)));}
 function clearQuery(){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();}
 function savedRow(coin){
  const row=node('div',null,'saved-search-row'),pick=node('button',null,'saved-search-pick'),image=node('img'),identity=node('span',null,'saved-search-identity'),remove=iconButton('Remove '+coin.symbol+' from saved','trash','saved-search-remove');
  row.dataset.key=coin.key;pick.type='button';pick.setAttribute('aria-label','Open saved '+coin.symbol+' on '+(coin.nativeId||coin.chain)+(coin.exchangeId?' via '+coin.exchangeId:''));
  image.alt='';image.draggable=false;image.loading='lazy';image.src=coin.image||'upic-logo-transparent.svg?v=116';image.addEventListener('error',()=>{image.src='upic-logo-transparent.svg?v=116';},{once:true});
  const market=coin.source==='ccxt'?[coin.nativeId,coin.exchangeId,coin.exchangeSymbol].filter(Boolean).join(' · '):[coin.chain,coin.address?coin.address.slice(0,6)+'…'+coin.address.slice(-4):''].filter(Boolean).join(' · ');
  identity.append(node('span',coin.symbol),node('small',coin.name||coin.symbol),node('small',market));pick.append(image,identity);pick.addEventListener('click',()=>selectSaved(coin));
  remove.addEventListener('click',()=>{try{removeSavedCoin(coin.key);}catch(error){const message=node('p',error.message,'saved-search-empty');message.setAttribute('role','alert');row.after(message);}});
  row.append(pick,remove);return row;
 }
 function renderSaved(container,{desktop=false}={}){
  const all=savedCoins(),rows=matchingSaved(),previous=[...container.querySelectorAll('.saved-search-row')],focused=previous.findIndex(row=>row.contains(document.activeElement)),focusedKey=previous[focused]?.dataset.key,removeFocused=document.activeElement?.classList.contains('saved-search-remove');
  container.replaceChildren();
  if(desktop){
   const heading=node('div',null,'saved-search-heading');heading.append(node('h2','Saved'));
   if(input.value.trim()&&all.length){const reset=node('button','Show all','saved-search-show-all');reset.type='button';reset.setAttribute('aria-label','Clear search to show all saved coins');reset.addEventListener('click',clearQuery);heading.append(reset);}
   container.append(heading);
  }
  if(rows.length){for(const coin of rows)container.append(savedRow(coin));}
  else container.append(node('p',all.length?'No saved coins match this search.':'Save a coin in the player to find it here.','saved-search-empty'));
  if(focused>=0){
   const next=[...container.querySelectorAll('.saved-search-row')],row=next.find(row=>row.dataset.key===focusedKey)||next[Math.min(focused,next.length-1)];
   (row?.querySelector(removeFocused?'.saved-search-remove':'.saved-search-pick')||input).focus({preventScroll:true});
  }
 }
 function paintDesktopSaved(){if(desktop){renderSaved(desktopSaved,{desktop:true});paintDesktop();}}
 function paintRecent(){chips.replaceChildren();const rows=recentCoins().slice(0,6);recent.hidden=!rows.length;for(const coin of rows){const chip=node('div',null,'mobile-search-chip'),pick=node('button',null),remove=node('button','×','mobile-search-remove'),artwork=node('span',null,'mobile-search-chip-artwork');pick.type=remove.type='button';const img=node('img');img.alt='';img.draggable=false;img.src=coin.image||'upic-logo-transparent.svg?v=116';img.addEventListener('error',()=>{img.src='upic-logo-transparent.svg?v=116';},{once:true});artwork.append(img);pick.append(artwork,node('span',coin.symbol));pick.addEventListener('click',()=>select(coin));remove.setAttribute('aria-label','Remove '+coin.symbol+' from recent');remove.addEventListener('click',()=>{removeRecentCoin(coin.key);paintRecent();});chip.append(pick,remove);chips.append(chip);attachArtworkDither(img);}}
 function paint(){
  dialog.dataset.category=category;filters.hidden=category==='saved'||!filterPanel.childElementCount&&!filterNodes.length;
  const q=input.value.trim().toLowerCase(),liveResults=category!=='saved'&&results&&!results.hidden;suggestions.hidden=Boolean(liveResults);tabs.hidden=false;status.hidden=Boolean(liveResults);more.hidden=Boolean(liveResults);if(liveResults)return;
  if(category==='saved'){status.textContent='Saved on this device';more.hidden=true;renderSaved(suggestions);return;}
  const source=category==='trending'?trending:catalogue;let rows=source.filter(r=>(network.value==='all'||r.chain===network.value||r.nativeChains?.includes(network.value)||r.platforms?.some(p=>p.chain===network.value))&&(!q||[r.name,r.symbol,r.address,...(r.platforms||[]).map(p=>p.address)].some(v=>String(v||'').toLowerCase().includes(q))));
  rows.sort((a,b)=>order.value==='recent'?(coinPreview(b,network.value).capture?.capturedAt||0)-(coinPreview(a,network.value).capture?.capturedAt||0):order.value==='cap'?(b.marketCap||0)-(a.marketCap||0):order.value==='name'?a.symbol.localeCompare(b.symbol):q?Number(b.symbol.toLowerCase()===q)-Number(a.symbol.toLowerCase()===q)||(b.marketCap||0)-(a.marketCap||0):Number(Boolean(b.featured))-Number(Boolean(a.featured))||(a.trendingRank||999)-(b.trendingRank||999)||(b.marketCap||0)-(a.marketCap||0));
  suggestions.replaceChildren();status.textContent=rows.length?(q?'Matching coins':category==='trending'?'Trending · 24H':form.id==='marketplace-coin-form'?'Genesis Collection':'Coins'):((category==='trending'?trendingLoading:loading)?category==='trending'?'Loading trending coins…':'Loading coins…':q?'No local matches. Press Search to search live markets.':category==='trending'?trendingError||'No trending coins above $1M on this network.':'No coins available.');
  more.hidden=rows.length<=visible;for(const row of rows.slice(0,visible)){const {selection:coin,capture}=coinPreview(row,network.value);const button=node('button',null,'mobile-search-coin');button.type='button';const artwork=node('span',null,'mobile-search-artwork'),img=node('img');img.alt='';img.src=capture?.snapshot||coin.image||'upic-logo-transparent.svg?v=116';img.draggable=false;img.loading='lazy';artwork.append(img);const identity=node('span',null,'mobile-search-identity');identity.append(node('span',coin.symbol,'mobile-search-symbol'),node('small',coin.name||coin.symbol),node('small',(coin.chain==='unknown'?'MARKET SEARCH':(coin.chain||'').toUpperCase())+(coin.address?' · '+coin.address.slice(0,5)+'…'+coin.address.slice(-4):'')));img.addEventListener('error',()=>{if(capture?.snapshot){img.src=coin.image||'upic-logo-transparent.svg?v=116';attachArtworkDither(img);}},{once:true});const metrics=node('span',null,'mobile-search-metrics');metrics.append(node('span','MC '+money(coin.marketCap)));if(coin.volume!=null)metrics.append(node('small','V '+money(coin.volume)));if(coin.liquidity!=null)metrics.append(node('small','L '+money(coin.liquidity)));button.append(artwork,identity,metrics);button.addEventListener('click',()=>select(coin));suggestions.append(button);if(!capture?.snapshot)attachArtworkDither(img);}
 }
 function setCategory(key){
  category=key;visible=30;for(const button of tabs.children)button.setAttribute('aria-pressed',String(button.dataset.category===key));
  if(key==='saved'){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));}paint();
  if(dialog.open&&key!=='saved')void load();if(key==='trending')void loadTrending();
 }
 for(const [key,label] of [['coins','Coins'],['trending','Trending'],['saved','Saved']]){const button=node('button',label);button.type='button';button.dataset.category=key;button.setAttribute('aria-pressed',String(key===category));button.addEventListener('click',()=>setCategory(key));tabs.append(button);}
 form.addEventListener('submit',()=>{if(category==='saved')setCategory('coins');});
 window.addEventListener('upic:saved-coins-changed',()=>{paintDesktopSaved();if(category==='saved')paint();});
 async function loadTrending(){
  if(trendingLoading)return trendingLoading;trendingError='';
  trendingLoading=loadTrendingCoins().then(rows=>{
   const known=new Map(catalogue.map(coin=>[previewKey(coin.chain,coin.address),coin]));
   trending=rows.filter(coin=>coin.marketCap>=1e6).map(coin=>({...known.get(coin.key),...coin}));
   const existing=new Set([...network.options].map(option=>option.value));
   for(const chain of new Set(trending.map(coin=>coin.chain))){if(existing.has(chain))continue;const option=node('option',chain.toUpperCase());option.value=chain;network.append(option);}
  }).catch(()=>{trendingError='Trending is unavailable. Tap Trending to retry.';}).finally(()=>{trendingLoading=null;paint();});paint();return trendingLoading;
 }
 async function load(force=false){if(loading)return loading;loading=Promise.allSettled([catalogue.length?Promise.resolve(null):loadCoinCatalogue(),loadCloudCaptures({force})]).then(([data,previews])=>{
  if(data.status==='fulfilled'&&data.value)catalogue=data.value.coins.filter(c=>form.id==='marketplace-coin-form'?c.top1000:c.top1000||(!(c.trendingRank||c.featured)||c.marketCap>=1e6)).map(c=>({...c,captures:{}}));const map=new Map();for(const row of catalogue){map.set(row.key,row);for(const p of row.platforms||[])map.set(previewKey(p.chain,p.address),row);}
  if(previews.status==='fulfilled'){for(const row of catalogue)row.captures={};for(const frame of previews.value){const row=map.get(previewKey(frame.chain,frame.address));if(row)storeCapture(row,frame);}}
  if(!existingNetwork){const added=new Set([...network.options].map(o=>o.value));for(const chain of [...new Set(catalogue.flatMap(c=>[c.chain,...(c.nativeChains||[]),...(c.platforms||[]).map(p=>p.chain)]))].sort()){if(added.has(chain))continue;const option=node('option',chain==='unknown'?'Other markets':chain.toUpperCase());option.value=chain;network.append(option);}}
 }).finally(()=>{loading=null;paint();});paint();return loading;}
 const refreshCaptures=()=>{if(dialog.open&&category!=='saved'&&!document.hidden){void load(true);if(category==='trending')void loadTrending();}},captureRefresh=setInterval(refreshCaptures,60000);window.addEventListener('focus',refreshCaptures);document.addEventListener('visibilitychange',refreshCaptures);window.addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(captureRefresh);});

 function open(){if(!mobile.matches)return;oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';dialog.showModal();trigger.setAttribute('aria-expanded','true');paintRecent();paint();if(category!=='saved')void load();if(category==='trending')void loadTrending();input.focus();input.select();}
 function arrange(){
  close(false);desktopOpen=false;form.dataset.searchNetwork=mobile.matches?network.value:'all';
  filterNodes.forEach((n,i)=>mobile.matches?filterPanel.append(n):filterAnchors[i].after(n));
  nodes.forEach((n,i)=>{if(mobile.matches){if(n===form)top.append(n);else dialog.append(n);}else if(desktop){if(n===form)desktop.prepend(n);else desktopPanel.append(n);}else anchors[i].after(n);});
  feedback.forEach((n,i)=>mobile.matches||!desktop?feedbackAnchors[i].after(n):desktopPanel.insertBefore(n,results||null));
  if(desktop)desktop.hidden=mobile.matches;header?.classList.toggle('has-desktop-search',!mobile.matches);
  input.setAttribute('aria-controls',!mobile.matches&&desktop?desktopPanel.id:results?.id||dialog.id);
  document.body.classList.toggle('desktop-header-search',Boolean(desktop)&&!mobile.matches);
  if(placeholder===null)input.removeAttribute('placeholder');else input.setAttribute('placeholder',placeholder);paintDesktopSaved();paintDesktop();
 }
 trigger.addEventListener('click',open);back.addEventListener('click',()=>close());dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>{document.documentElement.style.overflow=oldOverflow;trigger.setAttribute('aria-expanded','false');});
 clear.addEventListener('click',()=>{try{localStorage.removeItem('upic-recent-coins-v1');}catch{}paintRecent();});
 paste.addEventListener('pointerdown',event=>event.stopPropagation());paste.addEventListener('click',async event=>{event.stopPropagation();try{const value=(await navigator.clipboard.readText()).trim();if(!value||value.length>250||/[\r\n]/.test(value))return;input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();}catch{status.hidden=false;status.textContent='Touch and hold the search field to paste.';}});
 const grow=()=>{visible+=30;paint();};more.addEventListener('click',grow);if('IntersectionObserver' in window){let scheduled=false;const observer=new IntersectionObserver(entries=>{if(scheduled||!dialog.open||more.hidden||!entries.some(e=>e.isIntersecting))return;scheduled=true;requestAnimationFrame(()=>{if(dialog.open&&!more.hidden)grow();scheduled=false;});},{root:dialog,rootMargin:'240px'});observer.observe(more);}network.addEventListener('change',()=>{form.dataset.searchNetwork=mobile.matches?network.value:'all';if(results){input.dispatchEvent(new Event('input',{bubbles:true}));results.hidden=true;results.replaceChildren();}visible=30;paint();});order.addEventListener('change',()=>{visible=30;paint();});input.addEventListener('input',()=>{visible=30;paint();});if(results)new MutationObserver(paint).observe(results,{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('upic:market-selected',()=>{if(dialog.open)close();});mobile.addEventListener('change',arrange);arrange();if(location.hash==='#search'&&mobile.matches)open();
}
