// Shared connection state; profile signatures happen only through explicit sign-in.
const endpoint='https://upic-insightx.nchrl01.workers.dev/marketplace/config';
let configLoading,opening,connecting,account=null;
const listeners=new Set();
export const getWalletAccount=()=>account?.isConnected&&account.address?account:null;
export function subscribeWalletAccount(listener){listeners.add(listener);listener(getWalletAccount());return()=>listeners.delete(listener);}
function accountChanged(value){
 const [namespace,chainId]=String(value?.caipAddress||'').split(':');
 account=value?{...value,namespace:value.namespace||namespace||null,chainId:value.chainId??chainId??null}:null;
 for(const listener of listeners){try{listener(getWalletAccount());}catch{}}
}
async function configuration(){
 if(!configLoading)configLoading=fetch(endpoint,{signal:AbortSignal.timeout(10000)})
  .then(async response=>{if(!response.ok)throw Error('Wallet connections are being configured.');const config=await response.json();if(!config.projectId)throw Error('Wallet connections are being configured.');return config;})
  .catch(error=>{configLoading=null;throw error;});
 return configLoading;
}
export async function openWalletConnection(){
 if(opening)return opening;
 opening=(async()=>{const config=await configuration();const {connect}=await import('./vendor/wallet/connect.js?v=437');return connect(config.projectId,accountChanged);})();
 try{return await opening;}finally{opening=null;}
}
export async function ensureWalletAccount(){
 if(getWalletAccount())return getWalletAccount();
 if(connecting)return connecting;
 connecting=(async()=>{
  const modal=await openWalletConnection();
  accountChanged(modal.getAccount());
  if(getWalletAccount()){const connected=getWalletAccount();await modal.close();return connected;}
  return new Promise((resolve,reject)=>{
   let settled=false,cancelRequested=false,timedOut=false,timeout,finishTimer;
   const disposers=[],page=globalThis.document;
   const hidden=()=>page?.hidden===true;
   const finish=(error,value)=>{
    if(settled)return;settled=true;clearTimeout(timeout);clearTimeout(finishTimer);
    for(const off of disposers.splice(0)){try{off();}catch{}}
    if(error)reject(error);else{void Promise.resolve().then(()=>modal.close()).catch(()=>{});resolve(value);}
   };
   const check=value=>{if(settled)return;accountChanged(value);if(getWalletAccount())finish(null,getWalletAccount());};
   const finishAfterAccountDelivery=delay=>{
    clearTimeout(finishTimer);
    if(settled||hidden()||!cancelRequested&&!timedOut)return;
    finishTimer=setTimeout(()=>{
     if(hidden()||settled)return;
     check(modal.getAccount());if(settled)return;
     if(cancelRequested&&modal.getState().open)cancelRequested=false;
     if(timedOut)finish(Error('Sign-in timed out. Please try again.'));
     else if(cancelRequested)finish(Error('Sign-in cancelled.'));
    },delay);
   };
   // Mobile wallet handoffs can close the SDK panel before its account arrives.
   // Only our wrapper's explicit user-dismiss event is a cancellation.
   const onClose=()=>{if(settled)return;cancelRequested=true;check(modal.getAccount());finishAfterAccountDelivery(500);};
   const onState=state=>{if(state.open){cancelRequested=false;if(!timedOut)clearTimeout(finishTimer);}};
   const onVisible=()=>{if(hidden()||settled)return;check(modal.getAccount());finishAfterAccountDelivery(1000);};
   if(page?.addEventListener){page.addEventListener('visibilitychange',onVisible);disposers.push(()=>page.removeEventListener('visibilitychange',onVisible));}
   timeout=setTimeout(()=>{timedOut=true;check(modal.getAccount());finishAfterAccountDelivery(0);},180000);
   // A subscription may deliver a restored account before returning its disposer.
   const listen=(subscribe,listener)=>{if(settled)return;const off=subscribe(listener);if(typeof off==='function'){if(settled)off();else disposers.push(off);}};
   try{
    listen(listener=>modal.subscribeAccount(listener),check);
    listen(listener=>modal.subscribeState(listener),onState);
    listen(listener=>modal.subscribeClose(listener),onClose);
    check(modal.getAccount());
   }catch(error){finish(error);}
  });
 })();
 try{return await connecting;}finally{connecting=null;}
}
export async function signWalletMessage(message,expectedAccount=getWalletAccount()){
 if(!expectedAccount?.address)throw Error('Connect a wallet to sign in.');
 const namespace=expectedAccount.namespace||String(expectedAccount.caipAddress||'').split(':')[0];
 const {signProfileMessage}=await import('./vendor/wallet/connect.js?v=437');
 const signature=await signProfileMessage(message,{...expectedAccount,namespace});
 return {account:{...expectedAccount,namespace},signature,namespace};
}

export async function profileWalletController(){
 const config=await configuration();const {connect}=await import('./vendor/wallet/connect.js?v=437');
 return connect(config.projectId,accountChanged,{silent:true});
}
