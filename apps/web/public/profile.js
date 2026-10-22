import {savedCoins,savedCoinsState,loadSavedCoins,signInSavedCoins,signOutSavedCoins,removeSavedCoin} from './saved-coins.js?v=432';
import {profileWalletController} from './wallet-session.js?v=432';
import {pendingProfileSignIn,endProfileSignIn} from './profile-sign-in-intent.js?v=432';

const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const shortAddress=value=>value?value.slice(0,6)+'…'+value.slice(-4):'';
const homeURL=new URL('./',import.meta.url),profileURL=new URL('./profile.html',import.meta.url);
const logoURL=new URL('./upic-logo-transparent.svg',import.meta.url).href;
const message=error=>error?.message||'Please try again.';
const svgNS='http://www.w3.org/2000/svg';
function profileColor(account){
 const fallback=[...(account?.address||'')].reduce((sum,char)=>(sum*31+char.charCodeAt(0))%360,0);
 const hue=Number.isFinite(account?.avatarHue)?account.avatarHue:fallback;
 const channel=n=>{const k=(n+hue/30)%12;return Math.round(255*(1-Math.max(-1,Math.min(k-3,9-k,1)))/2);};
 return [channel(0),channel(8),channel(4)];
}
function tintFilter(){
 const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');svg.style.position='absolute';
 const filter=document.createElementNS(svgNS,'filter');filter.id='upic-profile-tint';filter.setAttribute('color-interpolation-filters','sRGB');
 const levels=document.createElementNS(svgNS,'feComponentTransfer');
 for(const channel of ['R','G','B']){const step=document.createElementNS(svgNS,'feFunc'+channel);step.setAttribute('type','discrete');step.setAttribute('tableValues','0 1');levels.append(step);}
 const matrix=document.createElementNS(svgNS,'feColorMatrix');matrix.setAttribute('type','matrix');filter.append(levels,matrix);svg.append(filter);document.body.append(svg);return matrix;
}
const icons={
 fund:'<path d="M12 3v18M17 7H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6"/>',
 send:'<path d="m4 3 17 9-17 9 4-9-4-9Zm4 9h13"/>',
 activity:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6h5"/>',
 disconnect:'<path d="M12 2v10M6 5a9 9 0 1 0 12 0"/>'
};

export function bindProfile(button){
 if(!button||button.dataset.profileReady)return;button.dataset.profileReady='true';
 const originalIcon=button.innerHTML,page=document.getElementById('profile-page-content');
 if(!document.querySelector('link[data-profile-style]')){const link=make('link');link.rel='stylesheet';link.href=new URL('./profile.css?v=432',import.meta.url).href;link.dataset.profileStyle='true';document.head.append(link);}
 const matrix=tintFilter();let signingIn=false;
 const notice=make('p',null,'profile-notice');notice.hidden=true;notice.setAttribute('role','status');document.body.append(notice);
 function paintHeader(){
  const account=savedCoinsState().account,color=profileColor(account);
  button.setAttribute('aria-label',account?'Profile':'Sign in');button.title=account?'Profile':'Sign in';
  button.classList.toggle('has-profile-color',Boolean(account));button.classList.remove('has-profile-avatar');
  button.style.setProperty('--profile-color',`rgb(${color.join(' ')})`);
  button.innerHTML=account?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="var(--profile-color)" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9" r="3" fill="#fff"/><path d="M5.7 17.8C6.8 12.6 17.2 12.6 18.3 17.8A8.3 8.3 0 0 1 5.7 17.8Z" fill="#fff"/></svg>':originalIcon;
  matrix.setAttribute('values',color.map(c=>[.2126*c/255,.7152*c/255,.0722*c/255,0,0].join(' ')).join(' ')+' 0 0 0 1 0');
 }
 async function startSignIn(){
  if(savedCoinsState().account){if(!page)location.assign(profileURL.href);return;}
  if(signingIn)return;signingIn=true;notice.hidden=true;button.setAttribute('aria-busy','true');
  try{await signInSavedCoins();if(savedCoinsState().account)location.assign(profileURL.href);}
  catch(error){if(!/cancelled/i.test(message(error))){notice.textContent=message(error);notice.hidden=false;}}
  finally{signingIn=false;button.removeAttribute('aria-busy');paintHeader();}
 }
 button.addEventListener('click',startSignIn);
 window.addEventListener('upic:saved-coins-changed',paintHeader);paintHeader();
 if(!page){
  let resume;
  const offerResume=()=>{
   if(savedCoinsState().account){endProfileSignIn();return;}
   if(signingIn||savedCoinsState().status==='loading'||resume?.open||!pendingProfileSignIn())return;
   resume=make('dialog',null,'upic-wallet-dialog upic-login-resume');resume.setAttribute('aria-label','Finish signing in');
   const heading=make('header'),title=make('h2','Finish signing in'),close=make('button','×');close.type='button';close.setAttribute('aria-label','Cancel sign-in');heading.append(title,close);
   const copy=make('p','Continue with your wallet to finish signing in.'),proceed=make('button','Continue','upic-login-continue');proceed.type='button';
   const dismiss=()=>{resume.close();resume.remove();};
   close.addEventListener('click',()=>{endProfileSignIn();dismiss();});
   resume.addEventListener('cancel',event=>{event.preventDefault();endProfileSignIn();dismiss();});
   proceed.addEventListener('click',()=>{dismiss();void startSignIn();});
   resume.append(heading,copy,proceed);document.body.append(resume);resume.showModal();
  };
  window.addEventListener('pageshow',offerResume);offerResume();return;
 }
 if(!savedCoinsState().account){location.replace(homeURL.href);return;}
 mountProfile(page);
}

function mountProfile(page){
 const root=make('section',null,'profile-content');root.setAttribute('aria-label','Your UPIC profile');
 const layout=make('div',null,'profile-layout'),account=make('aside',null,'profile-account');account.setAttribute('aria-label','Wallet');
 const identity=make('div',null,'profile-identity'),avatar=make('img',null,'profile-avatar');avatar.src=logoURL;avatar.alt='Your UPIC avatar';
 const address=make('button',null,'profile-account-address');address.type='button';
 const walletName=make('p',null,'profile-wallet-name'),balance=make('p','—', 'profile-balance');balance.setAttribute('aria-label','Wallet balance');
 const walletIcon=make('img',null,'profile-provider-icon');walletIcon.alt='';walletIcon.hidden=true;walletIcon.addEventListener('error',()=>walletIcon.hidden=true);
 const identityRow=make('div',null,'profile-address-row');
 const network=make('button','⌄','profile-network');network.type='button';network.title='Choose network';
 identityRow.append(walletIcon,address,network);identity.append(avatar,identityRow,balance);
 const reconnect=make('button','Reconnect wallet','profile-reconnect');reconnect.type='button';reconnect.hidden=true;
 const actions=make('div',null,'profile-wallet-actions'),walletStatus=make('p','Loading wallet…','profile-wallet-status');walletStatus.setAttribute('role','status');
 const buttons={};
 for(const [key,label] of [['fund','Fund wallet'],['send','Send'],['activity','Activity'],['disconnect','Disconnect']]){
  const b=make('button',null,'profile-wallet-action');b.type='button';b.dataset.action=key;
  const icon=make('span',null,'profile-action-icon');icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${icons[key]}</svg>`;
  b.append(icon,make('span',label));if(key!=='disconnect'){const arrow=make('span','›','profile-action-arrow');arrow.setAttribute('aria-hidden','true');b.append(arrow);}b.disabled=key!=='disconnect';buttons[key]=b;actions.append(b);
 }
 account.append(identity,actions,walletStatus,reconnect);
 const content=make('section',null,'profile-library');content.setAttribute('aria-label','Your library');
 const tabs=make('div',null,'profile-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Profile sections');
 const savedTab=make('button','Saved'),collectionTab=make('button','Collection');savedTab.type=collectionTab.type='button';savedTab.id='profile-saved-tab';collectionTab.id='profile-collection-tab';
 for(const [b,id] of [[savedTab,'profile-saved'],[collectionTab,'profile-collection']]){b.setAttribute('role','tab');b.setAttribute('aria-controls',id);}
 tabs.append(savedTab,collectionTab);
 const saved=make('div',null,'profile-saved');saved.id='profile-saved';saved.setAttribute('role','tabpanel');saved.setAttribute('aria-labelledby',savedTab.id);
 const toolbar=make('div',null,'profile-library-toolbar'),refresh=make('button','Refresh','profile-refresh');refresh.type='button';toolbar.append(refresh);
 const status=make('p',null,'profile-status');status.setAttribute('role','status');
 const list=make('div',null,'profile-saved-list'),retry=make('button','Try again','profile-retry');retry.type='button';saved.append(toolbar,status,list,retry);
 const collection=make('div',null,'profile-collection');collection.id='profile-collection';collection.setAttribute('role','tabpanel');collection.setAttribute('aria-labelledby',collectionTab.id);
 collection.append(make('p','Tokenized artworks will appear here when collecting is available.'));const explore=make('a','Explore artworks');explore.href=new URL('./upic/marketplace/',import.meta.url).href;collection.append(explore);
 content.append(tabs,saved,collection);layout.append(account,content);root.append(layout);page.replaceChildren(root);
 let active='saved',error='',controller=null,details=null,pending=new Set(),disconnecting=false,rowsSignature='';
 function choose(tab){active=tab;paint();}
 savedTab.addEventListener('click',()=>choose('saved'));collectionTab.addEventListener('click',()=>choose('collection'));
 tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();choose(event.key==='Home'?'saved':event.key==='End'?'collection':active==='saved'?'collection':'saved');(active==='saved'?savedTab:collectionTab).focus();});
 address.addEventListener('click',async()=>{const value=savedCoinsState().account?.address;if(!value)return;try{await navigator.clipboard.writeText(value);address.textContent='Copied';setTimeout(()=>{if(address.isConnected)address.textContent=shortAddress(value);},1500);}catch{walletStatus.textContent='Could not copy address.';walletStatus.hidden=false;}});
 function renderRows(rows){
  const signature=JSON.stringify([rows,[...pending]]);if(signature===rowsSignature)return;rowsSignature=signature;
  const focused=document.activeElement,rowKey=focused?.closest('.profile-saved-row')?.dataset.key,wasRemove=focused?.classList.contains('profile-saved-remove');
  list.replaceChildren();
  for(const coin of rows){
   const row=make('div',null,'profile-saved-row');row.dataset.key=coin.key;
   const link=make('a',null,'profile-saved-pick');link.href=new URL(coin.url,homeURL).href;
   const image=make('img');image.alt='';image.width=image.height=48;if(coin.image){image.src=coin.image;image.addEventListener('error',()=>image.hidden=true,{once:true});}else image.hidden=true;
   const label=make('span',null,'profile-saved-description');label.append(make('span',coin.symbol));if(coin.name&&coin.name.toLowerCase()!==coin.symbol.toLowerCase())label.append(make('small',coin.name));
   label.append(make('small',coin.source==='ccxt'?[coin.exchangeId,coin.exchangeSymbol].filter(Boolean).join(' · '):[(coin.chain==='solana'?'SOL':coin.chain||'').toUpperCase(),shortAddress(coin.address)].filter(Boolean).join(' · ')));link.append(image,label);
   const remove=make('button',null,'profile-saved-remove');remove.type='button';remove.setAttribute('aria-label','Remove '+coin.symbol+' from Saved');remove.disabled=pending.has(coin.key);remove.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18M9 3h6M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>';
   remove.addEventListener('click',async()=>{if(pending.has(coin.key))return;pending.add(coin.key);error='';paint();try{await removeSavedCoin(coin.key);}catch(e){error=message(e);}finally{pending.delete(coin.key);paint();}});
   row.append(link,remove);list.append(row);
  }
  if(rowKey){const row=[...list.children].find(n=>n.dataset.key===rowKey);(row?.querySelector(wasRemove?'.profile-saved-remove':'.profile-saved-pick')||refresh).focus({preventScroll:true});}
 }
 function paintWallet(){
  const user=savedCoinsState().account;if(!user)return;
  address.textContent=shortAddress(user.address);address.title=user.address;address.setAttribute('aria-label','Copy wallet address '+user.address);
  const matches=details?.connected&&details.namespace===user.namespace&&(user.namespace==='eip155'?details.address?.toLowerCase()===user.address.toLowerCase():details.address===user.address);
  walletName.textContent=matches?details.wallet:'';walletName.hidden=!walletName.textContent;
  network.setAttribute('aria-label','Choose network'+(matches?' · '+details.network:''));network.title=matches?details.network:'Choose network';network.disabled=!matches;
  walletIcon.hidden=!matches||!details.walletIcon;if(matches&&details.walletIcon){walletIcon.src=details.walletIcon;walletIcon.title=details.wallet;}
  identityRow.title=matches?details.wallet:'';
  const value=Number(details?.balance);balance.textContent=matches&&details.balance!=null&&Number.isFinite(value)?`${new Intl.NumberFormat('en',{maximumFractionDigits:4,minimumFractionDigits:3}).format(value)} ${details.symbol}`:'—';
  for(const key of ['fund','send','activity'])buttons[key].disabled=!matches;
  reconnect.hidden=!controller||Boolean(matches);walletStatus.hidden=Boolean(matches);if(!matches)walletStatus.textContent=controller?'Connect your wallet to use wallet actions.':'Loading wallet…';
 }
 function paint(){
  const state=savedCoinsState();if(!state.account){if(!disconnecting)location.replace(homeURL.href);return;}
  for(const [b,key] of [[savedTab,'saved'],[collectionTab,'collection']]){b.setAttribute('aria-selected',String(active===key));b.tabIndex=active===key?0:-1;}
  saved.hidden=active!=='saved';collection.hidden=active!=='collection';refresh.disabled=state.status==='loading';saved.setAttribute('aria-busy',String(state.status==='loading'));
  status.textContent=error||state.error||(state.status==='loading'?'Loading saved coins…':!savedCoins().length?'Your saved coins will appear here.':'');status.hidden=!status.textContent;retry.hidden=!error&&!state.error;
  renderRows(savedCoins());paintWallet();
 }
 async function refreshSaved(){error='';try{await loadSavedCoins();}catch(e){error=message(e);}paint();}
 refresh.addEventListener('click',refreshSaved);retry.addEventListener('click',refreshSaved);
 for(const [key,view] of [['fund','FundWallet'],['send','WalletSend'],['activity','Transactions']])buttons[key].addEventListener('click',()=>{void controller?.openAction(view).catch(e=>{walletStatus.textContent=message(e);walletStatus.hidden=false;});});
 reconnect.addEventListener('click',()=>{void controller?.openAction('Connect').catch(e=>{walletStatus.textContent=message(e);walletStatus.hidden=false;});});
 network.addEventListener('click',()=>{void controller?.openAction('Networks').catch(e=>{walletStatus.textContent=message(e);walletStatus.hidden=false;});});
 buttons.disconnect.addEventListener('click',async()=>{if(disconnecting)return;disconnecting=true;buttons.disconnect.disabled=true;try{await Promise.all([signOutSavedCoins(),controller?.disconnect()]);location.replace(homeURL.href);}catch(e){walletStatus.textContent=message(e);walletStatus.hidden=false;disconnecting=false;buttons.disconnect.disabled=false;}});
 window.addEventListener('upic:saved-coins-changed',paint);paint();void refreshSaved();
 void profileWalletController().then(api=>{controller=api;api.subscribeDetails(value=>{details=value;paintWallet();});}).catch(e=>{walletStatus.textContent=message(e);walletStatus.hidden=false;});
}
