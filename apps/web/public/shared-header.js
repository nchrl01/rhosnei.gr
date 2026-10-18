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
if(document.querySelector('.site-footer')){
 void import('./footer-prices.js?v=240').catch(()=>{});
 if(document.querySelector('.footer-wallet'))void import('./wallet-connect.js?v=317').catch(()=>{
  const button=document.querySelector('.footer-wallet'),status=document.querySelector('.wallet-status');
  if(button)button.disabled=true;
  if(status)status.textContent='Wallet unavailable. Reload to try again.';
 });
}

function bindMobileSearch(){
 const button=document.querySelector('button.header-search'),form=document.querySelector('#coin-form,#marketplace-coin-form'),results=document.querySelector('#coin-search-results');
 if(!button||!form)return;
 const mobile=matchMedia('(max-width:760px)'),nodes=[form,results].filter(Boolean);
 const anchors=nodes.map(node=>{const anchor=document.createComment('search position');node.before(anchor);return anchor;});
 const panel=document.createElement('section');panel.id='mobile-coin-search';panel.className='mobile-coin-search';panel.hidden=true;panel.setAttribute('aria-label','Search coins');
 const close=document.createElement('button');close.type='button';close.className='mobile-search-close';close.textContent='Close';close.setAttribute('aria-label','Close search');panel.append(close);document.body.append(panel);
 const setOpen=(open,focus=false)=>{panel.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open){panel.style.top=document.querySelector('.market-header').getBoundingClientRect().bottom+'px';if(focus)form.querySelector('input')?.focus();}};
 const sync=()=>{setOpen(false);nodes.forEach((node,i)=>{if(mobile.matches)panel.append(node);else anchors[i].after(node);});};
 button.addEventListener('click',()=>setOpen(panel.hidden,true));close.addEventListener('click',()=>{setOpen(false);button.focus();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){setOpen(false);button.focus();}});
 document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!button.contains(event.target))setOpen(false);});
 document.addEventListener('upic:market-selected',()=>setOpen(false));
 mobile.addEventListener('change',sync);sync();
 if(location.hash==='#search'&&mobile.matches)setOpen(true,true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindMobileSearch,{once:true});else bindMobileSearch();

function bindMobileFooter(){
 const mobile=matchMedia('(max-width:760px)'),footer=document.querySelector('.site-footer'),more=footer?.querySelector('.footer-mobile-more'),panel=more?.querySelector('.footer-mobile-panel');
 if(!panel)return;
 const groups=[footer.querySelector('.footer-links'),footer.querySelector('.footer-tools')].filter(Boolean),network=footer.querySelector('.footer-networks');
 const anchors=groups.map(group=>{const a=document.createComment('footer group');group.before(a);return a;});
 const networkAnchor=document.createComment('network position');if(network)network.before(networkAnchor);
 const sync=()=>{more.open=false;groups.forEach((group,i)=>mobile.matches?panel.append(group):anchors[i].after(group));if(network){if(mobile.matches)footer.insertBefore(network,more);else networkAnchor.after(network);}};
 document.addEventListener('pointerdown',event=>{if(more.open&&!more.contains(event.target))more.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&more.open){more.open=false;more.querySelector('summary').focus();}});
 mobile.addEventListener('change',sync);sync();
}
bindMobileFooter();
const headerWallet=document.querySelector('.header-wallet');
if(headerWallet){
 let walletOpening=false;
 headerWallet.addEventListener('click',async()=>{
  if(walletOpening)return;walletOpening=true;headerWallet.disabled=true;headerWallet.setAttribute('aria-busy','true');
  try{const {openWalletConnection}=await import('./wallet-session.js?v=317');await openWalletConnection();headerWallet.title='Wallet';}
  catch(error){headerWallet.title=error.message||'Could not connect. Try again.';}
  finally{walletOpening=false;headerWallet.disabled=false;headerWallet.removeAttribute('aria-busy');}
 });
}
