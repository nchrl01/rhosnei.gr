import {savedCoins,savedCoinsState,loadSavedCoins,signInSavedCoins,signOutSavedCoins,removeSavedCoin} from './saved-coins.js?v=395';
import {openWalletConnection} from './wallet-session.js?v=395';

const make=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
const shortAddress=address=>address?address.slice(0,6)+'…'+address.slice(-4):'';
const marketLabel=coin=>coin.source==='ccxt'?[coin.nativeId,coin.exchangeId,coin.exchangeSymbol].filter(Boolean).join(' · '):[coin.chain,shortAddress(coin.address)].filter(Boolean).join(' · ');
const plainError=error=>error?.message||'Could not load your saved coins. Please try again.';

export function bindProfile(button){
 if(!button||button.dataset.profileReady==='true')return;
 button.dataset.profileReady='true';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','profile-dialog');button.setAttribute('aria-expanded','false');
 if(!document.querySelector('link[data-profile-style]')){
  const link=make('link');link.rel='stylesheet';link.href=new URL('./profile.css?v=395',import.meta.url).href;link.dataset.profileStyle='true';document.head.append(link);
 }
 const dialog=make('dialog',null,'profile-dialog');dialog.id='profile-dialog';dialog.setAttribute('aria-labelledby','profile-title');
 const heading=make('div',null,'profile-heading'),title=make('h1','Profile'),close=make('button','×','profile-close');title.id='profile-title';close.type='button';close.setAttribute('aria-label','Close profile');heading.append(title,close);
 const account=make('div',null,'profile-account'),identity=make('div',null,'profile-identity'),accountActions=make('div',null,'profile-account-actions'),wallet=make('button','Account','profile-account-action'),signOut=make('button','Sign out','profile-sign-out');wallet.type=signOut.type='button';accountActions.append(wallet,signOut);account.append(identity,accountActions);
 const section=make('section',null,'profile-saved'),sectionHeading=make('div',null,'profile-section-heading'),savedTitle=make('h2','Saved'),refresh=make('button','Refresh','profile-refresh');
 savedTitle.id='profile-saved-title';section.setAttribute('aria-labelledby',savedTitle.id);refresh.type='button';sectionHeading.append(savedTitle,refresh);
 const status=make('p',null,'profile-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const signIn=make('button','Sign in','profile-sign-in');signIn.type='button';
 const list=make('div',null,'profile-saved-list'),retry=make('button','Try again','profile-retry');retry.type='button';
 section.append(sectionHeading,status,signIn,list,retry);dialog.append(heading,account,section);document.body.append(dialog);
 const pending=new Set();let busy=false,busyLabel='',errorMessage='',oldOverflow='';

 function show(){
  if(!dialog.open){oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';dialog.showModal();}
  button.setAttribute('aria-expanded','true');paint();
 }
 function hide(){if(dialog.open){document.documentElement.style.overflow=oldOverflow;button.setAttribute('aria-expanded','false');dialog.close();}}
 function renderRows(rows){
  const previous=[...list.children],focused=document.activeElement,oldIndex=previous.findIndex(row=>row.contains(focused)),oldKey=previous[oldIndex]?.dataset.key,wasRemove=focused?.classList.contains('profile-saved-remove');
  list.replaceChildren();
  for(const coin of rows){
   const row=make('div',null,'profile-saved-row');row.dataset.key=coin.key;
   const link=make('a',null,'profile-saved-pick');link.href=coin.url;link.setAttribute('aria-label','Open saved '+coin.symbol+' · '+marketLabel(coin));
   const image=make('img');image.alt='';image.width=image.height=40;image.draggable=false;
   if(coin.image){image.src=coin.image;image.addEventListener('error',()=>{image.hidden=true;},{once:true});}else image.hidden=true;
   const description=make('span',null,'profile-saved-description');description.append(make('span',coin.symbol),make('small',coin.name||coin.symbol),make('small',marketLabel(coin)));
   link.append(image,description);
   link.addEventListener('click',event=>{
    if(!document.getElementById('coin-form')||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();hide();document.dispatchEvent(new CustomEvent('upic:search-coin',{detail:coin}));
   });
   const remove=make('button',null,'profile-saved-remove');remove.type='button';
   remove.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18M9 3h6M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>';
   remove.setAttribute('aria-label','Remove '+coin.symbol+' from Saved');remove.setAttribute('aria-busy',String(pending.has(coin.key)));remove.setAttribute('aria-disabled',String(pending.has(coin.key)));
   remove.addEventListener('click',async()=>{
    if(pending.has(coin.key))return;pending.add(coin.key);errorMessage='';paint();
    try{await removeSavedCoin(coin.key);}catch(error){errorMessage=plainError(error);}
    finally{pending.delete(coin.key);paint();}
   });
   row.append(link,remove);list.append(row);
  }
  if(oldIndex>=0&&dialog.open){
   const next=[...list.children],row=next.find(row=>row.dataset.key===oldKey)||next[Math.min(oldIndex,next.length-1)];
   (row?.querySelector(wasRemove?'.profile-saved-remove':'.profile-saved-pick')||close).focus({preventScroll:true});
  }
 }
 function paint(){
  const state=savedCoinsState(),authenticated=Boolean(state.account),loading=state.status==='loading',rows=authenticated?savedCoins():[];
  button.setAttribute('aria-label','Profile');button.title='Profile';
  account.hidden=!authenticated;identity.replaceChildren();
  if(authenticated){identity.append(make('span',shortAddress(state.account.address),'profile-account-address'),make('small',state.account.namespace==='solana'?'Solana account':'Ethereum account'));identity.title=state.account.address||'';}
  wallet.disabled=signOut.disabled=busy;refresh.hidden=!authenticated;refresh.disabled=busy||loading;refresh.setAttribute('aria-busy',String(loading));
  signIn.hidden=authenticated||loading;signIn.disabled=busy;signIn.textContent='Sign in';
  retry.hidden=!(state.status==='error'&&authenticated)&&!errorMessage;retry.disabled=busy||loading;
  section.setAttribute('aria-busy',String(loading||busy||pending.size>0));
  const message=errorMessage||state.error||(
   busy?busyLabel:
   loading?'Loading saved coins…':
   !authenticated?'Sign in to keep your saved coins in your profile.':
   pending.size?'Removing from Saved…':
   !rows.length?'Your saved coins will appear here.':'');
  status.textContent=message;status.hidden=!message;status.setAttribute('role',errorMessage||state.status==='error'?'alert':'status');
  renderRows(rows);
 }
 async function refreshSaved(){
  errorMessage='';paint();try{await loadSavedCoins();}catch(error){errorMessage=plainError(error);}finally{paint();}
 }
 signIn.addEventListener('click',async()=>{
  if(busy)return;busy=true;busyLabel='Complete sign-in in your wallet.';errorMessage='';hide();
  try{await signInSavedCoins();}catch(error){errorMessage=plainError(error);}
  finally{busy=false;show();}
 });
 wallet.addEventListener('click',async()=>{
  if(busy)return;busy=true;busyLabel='Opening account…';errorMessage='';hide();
  try{await openWalletConnection();}
  catch(error){errorMessage=plainError(error);show();}
  finally{busy=false;paint();}
 });
 signOut.addEventListener('click',async()=>{if(busy)return;busy=true;busyLabel='Signing out…';errorMessage='';paint();try{await signOutSavedCoins();}catch(error){errorMessage=plainError(error);}finally{busy=false;paint();}});
 refresh.addEventListener('click',refreshSaved);retry.addEventListener('click',refreshSaved);
 button.addEventListener('click',()=>{show();void refreshSaved();});close.addEventListener('click',hide);
 dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)hide();}});
 dialog.addEventListener('close',()=>{if(dialog.open)return;document.documentElement.style.overflow=oldOverflow;button.setAttribute('aria-expanded','false');button.focus({preventScroll:true});});
 window.addEventListener('upic:saved-coins-changed',paint);paint();
}
