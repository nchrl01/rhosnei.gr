import {bindMobileCoinSearch} from './mobile-search.js?v=344';
import {bindListeningVolume} from './listening-volume.js?v=281';

function markCurrentPage(){
 const canonical=path=>path.replace(/\/index\.html$/,'/').replace(/\/$/,'')||'/';
 for(const link of document.querySelectorAll('.header-links a,.footer-links a')){
  const target=new URL(link.href);
  if(target.origin===location.origin&&canonical(target.pathname)===canonical(location.pathname))link.setAttribute('aria-current','page');
 }
}
function bindRangeTracks(){
 const paint=input=>{
  if(!input.matches?.('input[type=range]')||input.classList.contains('envion-slider'))return;
  const min=Number(input.min||0),max=Number(input.max||100),value=Number(input.value);
  input.style.setProperty('--range-fill',Math.max(0,Math.min(100,(value-min)/(max-min||1)*100))+'%');
 };
 document.querySelectorAll('input[type=range]').forEach(paint);
 document.addEventListener('input',event=>paint(event.target));
}
function bindNetworkDisclosure(){
 const details=document.querySelector('.footer-networks'),panel=details?.querySelector('.footer-networks-panel'),summary=details?.querySelector('summary');
 if(!details||!panel||!summary)return;
 const place=()=>{
  if(!details.open)return;
  const rect=summary.getBoundingClientRect(),gutter=8;
  const width=Math.min(190,window.innerWidth-gutter*2);
  const height=Math.min(panel.scrollHeight,Math.max(80,rect.top-gutter*2));
  panel.style.setProperty('--network-menu-left',Math.max(gutter,Math.min(rect.right-width,window.innerWidth-width-gutter))+'px');
  panel.style.setProperty('--network-menu-top',Math.max(gutter,rect.top-height-gutter)+'px');
  panel.style.maxHeight=Math.max(80,rect.top-gutter*2)+'px';
 };
 details.addEventListener('toggle',()=>{summary.setAttribute('aria-expanded',String(details.open));place();});
 document.addEventListener('pointerdown',event=>{if(details.open&&!details.contains(event.target))details.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&details.open){details.open=false;summary.focus({preventScroll:true});}});
 window.addEventListener('resize',place);
 window.addEventListener('scroll',place,true);
 summary.setAttribute('aria-expanded',String(details.open));
}
function keepArtworkUndraggable(){
 document.addEventListener('dragstart',event=>{if(event.target.closest?.('img,canvas,.coin-avatar,.trending-avatar,.collection-card'))event.preventDefault();},true);
}
function removeRetiredSampleStorage(){
 try{const cleanup=indexedDB.deleteDatabase('upic-envion-samples-v1');cleanup.onerror=()=>{};}catch{}
}
markCurrentPage();
bindListeningVolume();
bindRangeTracks();
bindNetworkDisclosure();
keepArtworkUndraggable();
removeRetiredSampleStorage();

// Optional footer features cannot prevent navigation or volume from starting.
if(document.querySelector('.site-footer')&&new URLSearchParams(location.search).get('capture')!=='live'){
 void import('./footer-prices.js?v=240').catch(()=>{});
 if(document.querySelector('.footer-wallet'))void import('./wallet-connect.js?v=317').catch(()=>{
  const button=document.querySelector('.footer-wallet'),status=document.querySelector('.wallet-status');
  if(button)button.disabled=true;
  if(status)status.textContent='Wallet unavailable. Reload to try again.';
 });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindMobileCoinSearch,{once:true});else bindMobileCoinSearch();

function bindMobileFooter(){
 const mobile=matchMedia('(max-width:760px)'),footer=document.querySelector('.site-footer'),more=footer?.querySelector('.footer-mobile-more'),panel=more?.querySelector('.footer-mobile-panel');
 if(!panel)return;
 const summary=more.querySelector('summary'),sheet=document.createElement('dialog');sheet.className='footer-mobile-sheet';sheet.id='footer-site-menu';sheet.setAttribute('aria-label','Site links');
 const heading=document.createElement('div');heading.className='footer-sheet-heading';
 const title=document.createElement('span');title.textContent='More';
 const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Close site menu');close.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
 heading.append(title,close);sheet.append(heading,panel);document.body.append(sheet);
 summary.setAttribute('aria-controls',sheet.id);summary.setAttribute('aria-haspopup','dialog');summary.setAttribute('aria-expanded','false');
 const groups=[footer.querySelector('.footer-links'),footer.querySelector('.footer-tools')].filter(Boolean),network=footer.querySelector('.footer-networks');
 const anchors=groups.map(group=>{const a=document.createComment('footer group');group.before(a);return a;});
 const networkAnchor=document.createComment('network position');if(network)network.before(networkAnchor);
 more.addEventListener('toggle',()=>{const open=mobile.matches&&more.open;summary.setAttribute('aria-expanded',String(open));if(open&&!sheet.open){if(network)network.open=false;sheet.showModal();}else if(!open&&sheet.open)sheet.close();});
 close.addEventListener('click',()=>sheet.close());
 sheet.addEventListener('close',()=>{more.open=false;summary.setAttribute('aria-expanded','false');if(mobile.matches)summary.focus({preventScroll:true});});
 sheet.addEventListener('click',event=>{if(event.target!==sheet)return;const box=sheet.getBoundingClientRect();if(event.clientY<box.top||event.clientY>box.bottom||event.clientX<box.left||event.clientX>box.right)sheet.close();});
 const sync=()=>{more.open=false;if(sheet.open)sheet.close();groups.forEach((group,i)=>mobile.matches?panel.append(group):anchors[i].after(group));if(network){if(mobile.matches)footer.insertBefore(network,more);else networkAnchor.after(network);}};
 mobile.addEventListener('change',sync);sync();
}
bindMobileFooter();
const headerWallet=new URLSearchParams(location.search).get('capture')==='live'?null:document.querySelector('.header-wallet');
if(headerWallet){
 let walletOpening=false,walletSession;
 const paintAccount=account=>{
  const label=account?.address?'Wallet account':'Sign in';
  headerWallet.setAttribute('aria-label',label);headerWallet.title=label;
 };
 const loadWalletSession=()=>{
  if(!walletSession)walletSession=import('./wallet-session.js?v=317').then(session=>{
   session.subscribeWalletAccount(paintAccount);return session;
  }).catch(error=>{walletSession=null;throw error;});
  return walletSession;
 };
 headerWallet.setAttribute('aria-haspopup','dialog');
 void loadWalletSession().catch(()=>{});
 headerWallet.addEventListener('click',async()=>{
  if(walletOpening)return;walletOpening=true;headerWallet.setAttribute('aria-busy','true');
  try{const session=await loadWalletSession();paintAccount(session.getWalletAccount());await session.openWalletConnection();}
  catch(error){headerWallet.title=error.message||'Could not connect. Try again.';}
  finally{walletOpening=false;headerWallet.removeAttribute('aria-busy');}
 });
}

function bindMobilePlayerOrder(){
 const transport=document.querySelector('.instrument-page .transport'),title=document.querySelector('.coin-title'),readings=title?.querySelector('.coin-live-readings'),avatar=title?.querySelector('.coin-avatar'),name=title?.querySelector('#coin-name');
 if(!transport||!readings||!avatar||!name)return;
 const home=document.createComment('transport position'),avatarHome=document.createComment('avatar position'),nameHome=document.createComment('coin name position');transport.before(home);avatar.before(avatarHome);name.before(nameHome);
 const heading=document.createElement('div');heading.className='mobile-player-heading';
 const mobile=matchMedia('(max-width:760px)');
 const arrange=()=>{if(mobile.matches){title.append(heading);heading.append(avatar,name);readings.before(transport);}else{avatarHome.after(avatar);nameHome.after(name);heading.remove();home.after(transport);}};
 mobile.addEventListener('change',arrange);arrange();
}
bindMobilePlayerOrder();

function bindVisualizerHeaderOffset(){
 const header=document.querySelector('.instrument-page .market-header');
 if(!header)return;
 const footer=document.querySelector('.site-footer');
 const measure=()=>{
  document.documentElement.style.setProperty('--instrument-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
  const footerHeight=footer&&getComputedStyle(footer).position==='fixed'?footer.getBoundingClientRect().height:0;
  document.documentElement.style.setProperty('--instrument-footer-height',Math.ceil(footerHeight)+'px');
 };
 measure();
 if(typeof ResizeObserver==='function'){
  const observer=new ResizeObserver(measure);observer.observe(header);if(footer)observer.observe(footer);
 }
 else window.addEventListener('resize',measure);
}
bindVisualizerHeaderOffset();
