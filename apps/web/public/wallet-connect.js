const endpoint='https://upic-insightx.nchrl01.workers.dev/marketplace/config';
let configLoading,opening,statusIndex=0;

function configuration(){
 if(!configLoading)configLoading=fetch(endpoint,{signal:AbortSignal.timeout(10000)})
  .then(async response=>{
   if(!response.ok)throw Error('Wallet connections are being configured.');
   const config=await response.json();
   if(!config.projectId)throw Error('Wallet connections are being configured.');
   return config;
  }).catch(error=>{configLoading=null;throw error;});
 return configLoading;
}

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
  let currentAccount;
  const paint=()=>{
   const address=currentAccount?.isConnected&&currentAccount.address;
   label.textContent=button.disabled?'Opening…':address?address.slice(0,6)+'…'+address.slice(-4):'Connect Wallet';
   button.setAttribute('aria-label',address?'Open wallet '+address:'Connect Wallet');
   if(address)button.title=address;else button.removeAttribute('title');
  };
  const accountChanged=account=>{currentAccount=account;paint();};
  button.addEventListener('click',async()=>{
   if(opening)return;
   button.disabled=true;button.setAttribute('aria-busy','true');status.textContent='';paint();
   opening=(async()=>{
    const config=await configuration();
    const {connect}=await import('./vendor/wallet/connect.js?v=281');
    await connect(config.projectId,accountChanged);
   })();
   try{await opening;}
   catch(error){status.textContent=error.message||'Could not connect. Please try again.';}
   finally{opening=null;button.disabled=false;button.removeAttribute('aria-busy');paint();}
  });
 }
}

initializeWalletButtons();
