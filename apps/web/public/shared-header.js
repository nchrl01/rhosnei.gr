import {bindMobileCoinSearch} from './mobile-search.js?v=429';
import {bindListeningVolume} from './listening-volume.js?v=281';

function markCurrentPage(){
 const canonical=path=>path.replace(/\/index\.html$/,'/').replace(/\/$/,'')||'/';
 for(const link of document.querySelectorAll('.header-links a,.footer-links a')){
  const target=new URL(link.href);
  if(target.origin===location.origin&&canonical(target.pathname)===canonical(location.pathname))link.setAttribute('aria-current','page');
 }
}
function bindFooterPriceToggle(){
 const button=document.querySelector('.footer-price-toggle');if(!button)return;
 const quotes=[...button.querySelectorAll('[data-footer-coin]')];let selected=0;
 const paint=()=>{quotes.forEach((quote,index)=>quote.hidden=index!==selected);const next=quotes[(selected+1)%quotes.length]?.dataset.footerCoin;button.setAttribute('aria-label','Show '+next+' price');button.title='Switch to '+next;};
 button.addEventListener('click',()=>{selected=(selected+1)%quotes.length;paint();});paint();
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
bindFooterPriceToggle();
bindListeningVolume();
bindRangeTracks();
bindNetworkDisclosure();
keepArtworkUndraggable();
removeRetiredSampleStorage();

// Optional footer features cannot prevent navigation or volume from starting.
if(document.querySelector('.site-footer')&&new URLSearchParams(location.search).get('capture')!=='live'){
 void import('./footer-prices.js?v=240').catch(()=>{});
 if(document.querySelector('.footer-wallet'))void import('./wallet-connect.js?v=429').catch(()=>{
  const button=document.querySelector('.footer-wallet'),status=document.querySelector('.wallet-status');
  if(button)button.disabled=true;
  if(status)status.textContent='Wallet unavailable. Reload to try again.';
 });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindMobileCoinSearch,{once:true});else bindMobileCoinSearch();

const headerWallet=new URLSearchParams(location.search).get('capture')==='live'?null:document.querySelector('.header-wallet');
if(headerWallet){
 headerWallet.setAttribute('aria-label','Profile');headerWallet.title='Profile';
 void import('./profile.js?v=429').then(({bindProfile})=>bindProfile(headerWallet)).catch(()=>{
  headerWallet.title='Profile is unavailable. Reload to try again.';
 });
}

function bindMobilePlayerOrder(){
 const transport=document.querySelector('.instrument-page .transport'),title=document.querySelector('.coin-title'),readings=title?.querySelector('.coin-live-readings'),avatar=title?.querySelector('.coin-avatar'),name=title?.querySelector('#coin-name'),address=title?.querySelector('#coin-address');
 if(!transport||!readings||!avatar||!name)return;
 const home=document.createComment('transport position'),avatarHome=document.createComment('avatar position'),nameHome=document.createComment('coin name position'),addressHome=document.createComment('coin address position');transport.before(home);avatar.before(avatarHome);name.before(nameHome);address?.before(addressHome);
 const heading=document.createElement('div');heading.className='mobile-player-heading';
 const mobile=matchMedia('(max-width:760px)');
 const arrange=()=>{if(mobile.matches){title.append(heading);heading.append(avatar,name);if(address)heading.append(address);readings.before(transport);}else{avatarHome.after(avatar);nameHome.after(name);if(address)addressHome.after(address);heading.remove();home.after(transport);}};
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

if(document.querySelector('[data-report-issue]'))void import('./report-issue.js?v=361').then(m=>m.bindIssueReporter()).catch(()=>{});
