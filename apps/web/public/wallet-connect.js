import {getWalletAccount,subscribeWalletAccount,openWalletConnection} from './wallet-session.js?v=447';
let opening,statusIndex=0;

// Keep wallet initialization independent of the page's market and audio engines.
export function initializeWalletButtons(root=document){
 for(const placeholder of root.querySelectorAll('.footer-wallet')){
  if(placeholder.dataset.walletReady==='true')continue;
  const button=placeholder.tagName==='BUTTON'?placeholder:document.createElement('button');
  const icon=placeholder.querySelector('svg')?.cloneNode(true);
  const label=document.createElement('span');label.className='wallet-label';label.textContent='Connect Wallet';
  button.type='button';button.className='footer-wallet';button.dataset.walletReady='true';
  button.setAttribute('aria-haspopup','dialog');button.removeAttribute('aria-disabled');
  button.replaceChildren(...(icon?[icon,label]:[label]));
  if(button!==placeholder)placeholder.replaceWith(button);
  let status=button.nextElementSibling;
  if(!status?.classList.contains('wallet-status')){status=document.createElement('span');status.className='wallet-status';button.after(status);}
  if(!status.id){do{status.id='wallet-status-'+(++statusIndex);}while(document.getElementById(status.id)!==status&&document.getElementById(status.id));}
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
  button.setAttribute('aria-describedby',status.id);
  let currentAccount=getWalletAccount();
  const paint=()=>{
   const address=currentAccount?.isConnected&&currentAccount.address;
   label.textContent=button.disabled?'Opening…':address?address.slice(0,6)+'…'+address.slice(-4):'Connect Wallet';
   button.setAttribute('aria-label',address?'Open wallet '+address:'Connect Wallet');
   if(address)button.title=address;else button.removeAttribute('title');
  };
  subscribeWalletAccount(account=>{currentAccount=account;paint();});
  button.addEventListener('click',async()=>{
   if(opening)return;
   button.disabled=true;button.setAttribute('aria-busy','true');status.textContent='';paint();
   opening=openWalletConnection();
   try{await opening;}
   catch(error){status.textContent=error.message||'Could not connect. Please try again.';}
   finally{opening=null;button.disabled=false;button.removeAttribute('aria-busy');paint();}
  });
 }
}

initializeWalletButtons();
