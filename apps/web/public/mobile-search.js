import {storeCapture,coinPreview,previewKey,loadCloudCaptures} from './coin-previews.js?v=390';
import {loadCoinCatalogue,coinOnNetwork,recentCoins,removeRecentCoin,rememberRecentCoin} from './coin-catalogue.js?v=359';
import {attachArtworkDither} from './coin-dither.js?v=276';
import {loadTrendingCoins} from './trending.js?v=391';
import {savedCoins,savedCoinsState,loadSavedCoins,signInSavedCoins,removeSavedCoin} from './saved-coins.js?v=422';
// Use the same network artwork as the marketplace, with native coin logos where available.
const networkMarks=Object.fromEntries(['ethereum','base','solana','arbitrum','polygon','optimism','avalanche','robinhood','abstract','animechain','ape_chain','arc','bera_chain','blast','flow','gunzilla','hyperevm','hyperliquid','ink','megaeth','monad','ronin','sei','shape','somnia','soneium','stablechain','unichain','zora'].map(icon=>[({ape_chain:'apechain',bera_chain:'berachain',sei:'sei-network',stablechain:'stable',zora:'zora-network'})[icon]||icon,'images/networks/'+icon+'.svg']));
networkMarks.bsc='images/networks/bsc.png';
function searchNetworks(rows){
 const represented=new Set(rows.flatMap(coin=>[coin.chain,...(coin.nativeChains||[]),...(coin.platforms||[]).map(platform=>platform.chain)]).filter(Boolean));
 const native=new Map();for(const coin of rows)if(coin.contractStatus==='native')for(const chain of coin.nativeChains||[coin.nativeChain||coin.chain])if(!native.has(chain)&&/^https?:\/\//.test(coin.image||''))native.set(chain,coin);
 const preferred=Object.keys(networkMarks),names={bsc:'BNB Chain',apechain:'ApeChain',berachain:'Berachain','sei-network':'Sei','zora-network':'Zora',hyperevm:'HyperEVM'};
 return [...represented].map(chain=>({chain,name:names[chain]||native.get(chain)?.name||chain.replace(/[-_]/g,' ').replace(/\b\w/g,char=>char.toUpperCase()),image:networkMarks[chain]||native.get(chain)?.image})).filter(item=>item.image).sort((a,b)=>{const ai=preferred.indexOf(a.chain),bi=preferred.indexOf(b.chain);return(ai<0?999:ai)-(bi<0?999:bi)||a.name.localeCompare(b.name);});
}
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
  desktopPanel.hidden=mobile.matches||!desktopOpen||!(hasFeedback||hasResults||desktopSaved.childElementCount||desktopPanel.contains(categories));
  if(!mobile.matches)input.setAttribute('aria-expanded',String(!desktopPanel.hidden));
 }
 const showDesktop=()=>{if(!mobile.matches){const opening=!desktopOpen;desktopOpen=true;if(opening){paintRecent();paint();void load();if(category==='trending')void loadTrending();}paintDesktop();}};
 input.addEventListener('focus',()=>{paintDesktopSaved();showDesktop();if(!mobile.matches)void loadSavedCoins().catch(()=>{});});input.addEventListener('input',()=>{paintDesktopSaved();showDesktop();});form.addEventListener('submit',showDesktop);
 input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'&&!mobile.matches&&desktopOpen&&(!results||results.hidden)){const first=desktopPanel.querySelector('.mobile-search-coin,.saved-search-pick');if(first){event.preventDefault();first.focus();}}});
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
 const mobileFeedback=node('div',null,'mobile-search-feedback'),content=node('div',null,'mobile-search-content');
 const suggestions=node('div',null,'mobile-search-suggestions'),status=node('p','Loading coins…','mobile-search-status');status.setAttribute('role','status');
 const filters=node('button','Networks','mobile-search-filters'),filterPanel=node('div',null,'mobile-search-filter-panel');filters.type='button';filters.open=false;filters.setAttribute('aria-expanded','false');filters.setAttribute('aria-controls','mobile-search-networks');filterPanel.id='mobile-search-networks';filterPanel.hidden=true;filterPanel.setAttribute('role','group');filterPanel.setAttribute('aria-label','Filter by network');
 // Search filters are independent of the marketplace gallery filter.
 const existingNetwork=null,network=node('select');
 if(!existingNetwork){const option=node('option','All networks');option.value='all';network.append(option);}
 const categories=node('div',null,'mobile-search-category-row');categories.append(tabs,filters,filterPanel);
 filters.addEventListener('click',()=>{filters.open=!filters.open;paint();});
 filterPanel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();filters.open=false;paint();filters.focus();}});
 const more=node('button','Load more coins','mobile-search-more');more.type='button';more.hidden=true;
 content.append(mobileFeedback,status,suggestions,more);dialog.append(top,categories,recent,content);document.body.append(dialog);let catalogue=[],trending=[],trendingLoading=null,trendingError='',loading,paintedRows='',oldOverflow='',placeholder=input.getAttribute('placeholder');
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
  image.alt='';image.draggable=false;image.loading='lazy';if(coin.image)image.src=coin.image;else image.dataset.unavailable='true';image.addEventListener('error',()=>{image.dataset.unavailable='true';},{once:true});
  const market=coin.source==='ccxt'?[coin.nativeId,coin.exchangeId,coin.exchangeSymbol].filter(Boolean).join(' · '):[coin.chain,coin.address?coin.address.slice(0,6)+'…'+coin.address.slice(-4):''].filter(Boolean).join(' · ');
  identity.append(node('span',coin.symbol),node('small',coin.name||coin.symbol),node('small',market));pick.append(image,identity);pick.addEventListener('click',()=>selectSaved(coin));
  remove.addEventListener('click',async()=>{remove.disabled=true;remove.setAttribute('aria-busy','true');try{await removeSavedCoin(coin.key);}catch(error){const message=node('p',error.message||'Could not remove this saved coin.','saved-search-empty');message.setAttribute('role','alert');row.after(message);}finally{remove.disabled=false;remove.setAttribute('aria-busy','false');}});
  row.append(pick,remove);return row;
 }
 function renderSaved(container,{desktop=false}={}){
  if(!savedCoinsState().account){container.replaceChildren();return;}
  const state=savedCoinsState(),all=savedCoins(),rows=matchingSaved(),previous=[...container.querySelectorAll('.saved-search-row')],focused=previous.findIndex(row=>row.contains(document.activeElement)),focusedKey=previous[focused]?.dataset.key,removeFocused=document.activeElement?.classList.contains('saved-search-remove');
  container.setAttribute('aria-busy',String(state.status==='loading'));
  // Keep loaded rows and keyboard focus stable during a profile refresh.
  if(state.status==='loading'&&previous.length)return;
  container.replaceChildren();
  if(desktop){
   const heading=node('div',null,'saved-search-heading');heading.append(node('h2','Saved'));
   if(input.value.trim()&&all.length){const reset=node('button','Show all','saved-search-show-all');reset.type='button';reset.setAttribute('aria-label','Clear search to show all saved coins');reset.addEventListener('click',clearQuery);heading.append(reset);}
   container.append(heading);
  }
  if(state.status==='signed-out'||state.status==='error'){
   const prompt=node('p',state.status==='signed-out'?(state.error||'Sign in to see your saved coins.'):state.error||'Saved coins are unavailable.','saved-search-empty'),action=node('button',state.status==='signed-out'?'Sign in':'Try again','saved-search-action');action.type='button';
   action.addEventListener('click',async()=>{
    action.disabled=true;action.setAttribute('aria-busy','true');const signIn=state.status==='signed-out',reopen=signIn&&dialog.open;
    // Native dialogs sit above the wallet picker; release the top layer first.
    if(signIn){if(reopen)close(false);desktopOpen=false;paintDesktop();}
    try{if(signIn)await signInSavedCoins();else await loadSavedCoins();paintDesktopSaved();if(category==='saved')paint();}
    catch(error){prompt.textContent=error.message||'Could not load saved coins.';prompt.setAttribute('role','alert');}
    finally{action.disabled=false;action.setAttribute('aria-busy','false');if(signIn){if(reopen&&mobile.matches)open({refresh:false});else if(!mobile.matches){desktopOpen=true;paintDesktopSaved();}}}
   });
   container.append(prompt,action);
  }else if(state.status==='loading'){const loading=node('p','Loading saved coins…','saved-search-empty');loading.setAttribute('role','status');container.append(loading);}
  else if(rows.length){for(const coin of rows)container.append(savedRow(coin));}
  else container.append(node('p',all.length?'No saved coins match this search.':'Save a coin in the player to find it here.','saved-search-empty'));
  if(focused>=0&&state.status==='ready'){
   const next=[...container.querySelectorAll('.saved-search-row')],row=next.find(row=>row.dataset.key===focusedKey)||next[Math.min(focused,next.length-1)];
   (row?.querySelector(removeFocused?'.saved-search-remove':'.saved-search-pick')||input).focus({preventScroll:true});
  }
 }
 function paintDesktopSaved(){if(desktop){renderSaved(desktopSaved,{desktop:true});paintDesktop();}}
 function paintRecent(){chips.replaceChildren();const rows=recentCoins().slice(0,6);recent.hidden=!rows.length;for(const coin of rows){const chip=node('div',null,'mobile-search-chip'),pick=node('button',null),remove=node('button','×','mobile-search-remove'),artwork=node('span',null,'mobile-search-chip-artwork');pick.type=remove.type='button';const img=node('img');img.alt='';img.draggable=false;if(coin.image)img.src=coin.image;else artwork.dataset.unavailable='true';img.addEventListener('error',()=>{artwork.dataset.unavailable='true';},{once:true});artwork.append(img);pick.append(artwork,node('span',coin.symbol));pick.addEventListener('click',()=>select(coin));remove.setAttribute('aria-label','Remove '+coin.symbol+' from recent');remove.addEventListener('click',()=>{removeRecentCoin(coin.key);paintRecent();});chip.append(pick,remove);chips.append(chip);if(coin.image)attachArtworkDither(img);}}
 function paintNetworks(){
  const rows=searchNetworks([...catalogue,...trending]),signature=rows.map(row=>row.chain+':'+row.image).join('|');
  if(filterPanel.dataset.networks!==signature){
   filterPanel.dataset.networks=signature;filterPanel.replaceChildren();
   for(const item of [{chain:'all',name:'All networks'},...rows]){
    const button=node('button',item.chain==='all'?'All':null,'mobile-search-network');button.type='button';button.dataset.chain=item.chain;button.title=item.name;button.setAttribute('aria-label',item.name);
    if(item.image){const image=node('img');image.src=item.image;image.alt='';image.width=image.height=28;image.draggable=false;button.append(image);}
    button.addEventListener('click',()=>{if(![...network.options].some(option=>option.value===item.chain)){const option=node('option',item.name);option.value=item.chain;network.append(option);}network.value=item.chain;network.dispatchEvent(new Event('change'));});filterPanel.append(button);
   }
  }
  for(const button of filterPanel.children)button.setAttribute('aria-pressed',String(button.dataset.chain===network.value));
  filters.hidden=category==='saved';filterPanel.hidden=filters.hidden||!filters.open;filters.setAttribute('aria-expanded',String(!filterPanel.hidden));
 }
 function paint(){
  const signedIn=Boolean(savedCoinsState().account);
  const savedTab=tabs.querySelector('[data-category="saved"]');if(savedTab)savedTab.hidden=!signedIn;
  if(category==='saved'&&!signedIn){category='coins';for(const button of tabs.children)button.setAttribute('aria-pressed',String(button.dataset.category==='coins'));}
  dialog.dataset.category=category;if(desktop)desktopPanel.dataset.category=category;paintNetworks();
  const q=input.value.trim().toLowerCase(),liveResults=category!=='saved'&&results&&!results.hidden;recent.hidden=Boolean(q)||!chips.childElementCount;suggestions.hidden=Boolean(liveResults);tabs.hidden=false;status.hidden=Boolean(liveResults);more.hidden=Boolean(liveResults);if(liveResults)return;
  if(category==='saved'){paintedRows='';status.dataset.loading='false';content.setAttribute('aria-busy','false');status.textContent=savedCoinsState().status==='ready'?'Saved in your profile':'';status.hidden=!status.textContent;more.hidden=true;renderSaved(suggestions);return;}
  const source=category==='trending'?trending:catalogue;
  const pending=Boolean(category==='trending'?trendingLoading:loading)&&!source.length;
  status.dataset.loading=String(pending);content.setAttribute('aria-busy',String(pending));
  let rows=source.filter(r=>(network.value==='all'||r.chain===network.value||r.nativeChains?.includes(network.value)||r.platforms?.some(p=>p.chain===network.value))&&(!q||[r.name,r.symbol,r.address,...(r.platforms||[]).map(p=>p.address)].some(v=>String(v||'').toLowerCase().includes(q))));
  rows.sort((a,b)=>form.id==='marketplace-coin-form'&&category==='coins'?(b.marketCap||0)-(a.marketCap||0):q?Number(b.symbol.toLowerCase()===q)-Number(a.symbol.toLowerCase()===q)||(b.marketCap||0)-(a.marketCap||0):Number(Boolean(b.featured))-Number(Boolean(a.featured))||(a.trendingRank||999)-(b.trendingRank||999)||(b.marketCap||0)-(a.marketCap||0));
  status.textContent=rows.length?(q?'Matching coins':category==='trending'?'Trending · 24H':form.id==='marketplace-coin-form'?'Genesis Collection':'Coins'):(pending?category==='trending'?'Loading trending coins…':'Loading coins…':q?'No local matches. Press Search to search live markets.':category==='trending'?trendingError||'No trending coins above $1M on this network.':'No coins available.');
  more.hidden=rows.length<=visible;
  const rowsKey=JSON.stringify([category,network.value,q,visible,rows.slice(0,visible).map(row=>{const view=coinPreview(row,network.value);return [row.key,view.selection.key,view.capture?.capturedAt,row.image,row.marketCap];})]);
  if(rowsKey===paintedRows)return;paintedRows=rowsKey;
  const focusedKey=suggestions.contains(document.activeElement)?document.activeElement.dataset.key:null;
  suggestions.replaceChildren();
  for(const row of rows.slice(0,visible)){const {selection:coin,capture}=coinPreview(row,network.value);const button=node('button',null,'mobile-search-coin');button.type='button';button.dataset.key=row.key;const artwork=node('span',null,'mobile-search-artwork'),img=node('img');img.alt='';if(capture?.snapshot||coin.image)img.src=capture?.snapshot||coin.image;else artwork.dataset.unavailable='true';img.draggable=false;img.loading='lazy';artwork.append(img);const identity=node('span',null,'mobile-search-identity');identity.append(node('span',coin.symbol,'mobile-search-symbol'),node('small',coin.name||coin.symbol),node('small',(coin.chain==='unknown'?'MARKET SEARCH':(coin.chain||'').toUpperCase())+(coin.address?' · '+coin.address.slice(0,5)+'…'+coin.address.slice(-4):'')));let fallback=false;img.addEventListener('error',()=>{if(capture?.snapshot&&coin.image&&!fallback){fallback=true;img.src=coin.image;attachArtworkDither(img);}else artwork.dataset.unavailable='true';});const metrics=node('span',null,'mobile-search-metrics');metrics.append(node('span',money(coin.marketCap)),node('small','Market cap'));button.append(artwork,identity,metrics);button.addEventListener('click',()=>select(coin));suggestions.append(button);if(!capture?.snapshot&&coin.image)attachArtworkDither(img);}
  if(focusedKey)[...suggestions.children].find(row=>row.dataset.key===focusedKey)?.focus({preventScroll:true});
 }
 function setCategory(key){
  if(key==='saved'&&!savedCoinsState().account)key='coins';
  category=key;visible=30;filters.open=false;if(results){results.hidden=true;input.setAttribute('aria-expanded','false');}for(const button of tabs.children)button.setAttribute('aria-pressed',String(button.dataset.category===key));
  if(key==='saved'){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));void loadSavedCoins().catch(()=>{});}paint();
  if((dialog.open||desktopOpen)&&key!=='saved')void load();if(key==='trending')void loadTrending();
 }
 for(const [key,label] of [['coins','Coins'],['trending','Trending'],['saved','Saved']]){const button=node('button',label);button.type='button';button.dataset.category=key;button.setAttribute('aria-pressed',String(key===category));button.addEventListener('click',()=>setCategory(key));tabs.append(button);}
 form.addEventListener('submit',()=>{if(category!=='coins')setCategory('coins');});
 window.addEventListener('upic:saved-coins-changed',()=>{paintDesktopSaved();paint();});
 async function loadTrending(){
  if(trendingLoading)return trendingLoading;trendingError='';
  trendingLoading=loadTrendingCoins().then(rows=>{
   const known=new Map(catalogue.map(coin=>[previewKey(coin.chain,coin.address),coin]));
   trending=rows.filter(coin=>coin.marketCap>=1e6).map(coin=>({...known.get(coin.key),...coin}));
   const existing=new Set([...network.options].map(option=>option.value));
   for(const chain of new Set(trending.map(coin=>coin.chain))){if(existing.has(chain))continue;const option=node('option',chain.toUpperCase());option.value=chain;network.append(option);}
  }).catch(()=>{trendingError='Trending is unavailable. Tap Trending to retry.';}).finally(()=>{trendingLoading=null;paint();});paint();return trendingLoading;
 }
 async function load(force=false){
  if(loading)return loading;
  // Publish the usable catalogue immediately; preview images arrive independently.
  const data=catalogue.length?Promise.resolve():loadCoinCatalogue().then(data=>{
   catalogue=data.coins.filter(c=>form.id==='marketplace-coin-form'?c.top1000:c.top1000||(!(c.trendingRank||c.featured)||c.marketCap>=1e6)).map(c=>({...c,captures:{}}));
   if(!existingNetwork){const added=new Set([...network.options].map(o=>o.value));for(const chain of [...new Set(catalogue.flatMap(c=>[c.chain,...(c.nativeChains||[]),...(c.platforms||[]).map(p=>p.chain)]))].sort()){if(added.has(chain))continue;const option=node('option',chain==='unknown'?'Other markets':chain.toUpperCase());option.value=chain;network.append(option);}}
   paint();
  });
  const previews=loadCloudCaptures({force}).then(async frames=>{
   await data;const map=new Map();for(const row of catalogue){map.set(row.key,row);for(const p of row.platforms||[])map.set(previewKey(p.chain,p.address),row);row.captures={};}
   for(const frame of frames){const row=map.get(previewKey(frame.chain,frame.address));if(row)storeCapture(row,frame);}
  });
  loading=Promise.allSettled([data,previews]).finally(()=>{loading=null;paint();});paint();return loading;
 }
 const refreshCaptures=()=>{if((dialog.open||desktopOpen)&&category!=='saved'&&!document.hidden){void load(true);if(category==='trending')void loadTrending();}},captureRefresh=setInterval(refreshCaptures,60000);window.addEventListener('focus',refreshCaptures);document.addEventListener('visibilitychange',refreshCaptures);window.addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(captureRefresh);});

 function open({refresh=true}={}){if(!mobile.matches)return;form.dataset.searchNetwork=network.value;oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';dialog.showModal();trigger.setAttribute('aria-expanded','true');paintRecent();paint();if(refresh){if(category==='saved')void loadSavedCoins().catch(()=>{});else void load();if(category==='trending')void loadTrending();}input.focus();input.select();}
 function arrange(){
  close(false);desktopOpen=false;form.dataset.searchNetwork=network.value;
  const panel=!mobile.matches&&desktop?desktopPanel:dialog;
  panel.append(categories,recent,content);desktopSaved.hidden=true;
  nodes.forEach((n,i)=>{if(n===form){if(mobile.matches)top.append(n);else if(desktop)desktop.prepend(n);else anchors[i].after(n);}else content.insertBefore(n,suggestions);});
  feedback.forEach(n=>mobileFeedback.append(n));
  if(desktop)desktop.hidden=mobile.matches;header?.classList.toggle('has-desktop-search',!mobile.matches);
  input.setAttribute('aria-controls',!mobile.matches&&desktop?desktopPanel.id:results?.id||dialog.id);
  document.body.classList.toggle('desktop-header-search',Boolean(desktop)&&!mobile.matches);
  if(placeholder===null)input.removeAttribute('placeholder');else input.setAttribute('placeholder',placeholder);paintDesktopSaved();paintDesktop();
 }
 trigger.addEventListener('click',open);back.addEventListener('click',()=>close());dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>{document.documentElement.style.overflow=oldOverflow;trigger.setAttribute('aria-expanded','false');});
 clear.addEventListener('click',()=>{try{localStorage.removeItem('upic-recent-coins-v1');}catch{}paintRecent();});
 paste.addEventListener('pointerdown',event=>event.stopPropagation());paste.addEventListener('click',async event=>{event.stopPropagation();try{const value=(await navigator.clipboard.readText()).trim();if(!value||value.length>250||/[\r\n]/.test(value))return;input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();}catch{status.hidden=false;status.textContent='Touch and hold the search field to paste.';}});
 const grow=()=>{visible+=30;paint();};more.addEventListener('click',grow);if('IntersectionObserver' in window){let scheduled=false;const observer=new IntersectionObserver(entries=>{if(scheduled||!dialog.open||more.hidden||!entries.some(e=>e.isIntersecting))return;scheduled=true;requestAnimationFrame(()=>{if(dialog.open&&!more.hidden)grow();scheduled=false;});},{root:dialog,rootMargin:'240px'});observer.observe(more);}network.addEventListener('change',()=>{form.dataset.searchNetwork=network.value;if(results){input.dispatchEvent(new Event('input',{bubbles:true}));results.hidden=true;results.replaceChildren();}visible=30;paint();});input.addEventListener('input',()=>{visible=30;paint();});if(results)new MutationObserver(paint).observe(results,{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('upic:market-selected',()=>{desktopOpen=false;paintDesktop();if(dialog.open)close();});mobile.addEventListener('change',arrange);arrange();if(location.hash==='#search'&&mobile.matches)open();
}
