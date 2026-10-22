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
 opening=(async()=>{const config=await configuration();const {connect}=await import('./vendor/wallet/connect.js?v=420');return connect(config.projectId,accountChanged);})();
 try{return await opening;}finally{opening=null;}
}
export async function ensureWalletAccount(){
 if(getWalletAccount())return getWalletAccount();
 if(connecting)return connecting;
 connecting=(async()=>{
  const modal=await openWalletConnection();
  accountChanged(modal.getAccount());
  if(getWalletAccount()){await modal.close();return getWalletAccount();}
  return new Promise((resolve,reject)=>{
   let settled=false,offAccount=()=>{},offState=()=>{},closedTimer;
   const finish=(error,value)=>{
    if(settled)return;settled=true;clearTimeout(timeout);clearTimeout(closedTimer);offAccount();offState();
    if(error)reject(error);else{void modal.close();resolve(value);}
   };
   const check=value=>{accountChanged(value);if(getWalletAccount())finish(null,getWalletAccount());};
   const timeout=setTimeout(()=>finish(Error('Sign-in timed out. Please try again.')),180000);
   offAccount=modal.subscribeAccount(check);
   offState=modal.subscribeState(state=>{
    if(state.open){clearTimeout(closedTimer);return;}
    // Account notification can arrive just after the picker closes.
    closedTimer=setTimeout(()=>{check(modal.getAccount());if(!settled)finish(Error('Sign-in cancelled.'));},250);
   });
   check(modal.getAccount());
   if(!modal.getState().open&&!settled)closedTimer=setTimeout(()=>finish(Error('Sign-in cancelled.')),250);
  });
 })();
 try{return await connecting;}finally{connecting=null;}
}
export async function signWalletMessage(message,expectedAccount=getWalletAccount()){
 if(!expectedAccount?.address)throw Error('Connect a wallet to sign in.');
 const namespace=expectedAccount.namespace||String(expectedAccount.caipAddress||'').split(':')[0];
 const {signProfileMessage}=await import('./vendor/wallet/connect.js?v=420');
 const signature=await signProfileMessage(message,{...expectedAccount,namespace});
 return {account:{...expectedAccount,namespace},signature,namespace};
}

export async function profileWalletController(){
 const config=await configuration();const {connect}=await import('./vendor/wallet/connect.js?v=420');
 return connect(config.projectId,accountChanged,{silent:true});
}
