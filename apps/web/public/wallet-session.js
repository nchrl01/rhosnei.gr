// Shared connection state; the wallet picker stays lazy and never signs transactions.
const endpoint='https://upic-insightx.nchrl01.workers.dev/marketplace/config';
let configLoading,opening,account=null;
const listeners=new Set();
export const getWalletAccount=()=>account?.isConnected&&account.address?account:null;
export function subscribeWalletAccount(listener){listeners.add(listener);listener(getWalletAccount());return()=>listeners.delete(listener);}
function accountChanged(value){account=value;for(const listener of listeners){try{listener(getWalletAccount());}catch{}}}
async function configuration(){
 if(!configLoading)configLoading=fetch(endpoint,{signal:AbortSignal.timeout(10000)})
  .then(async response=>{if(!response.ok)throw Error('Wallet connections are being configured.');const config=await response.json();if(!config.projectId)throw Error('Wallet connections are being configured.');return config;})
  .catch(error=>{configLoading=null;throw error;});
 return configLoading;
}
export async function openWalletConnection(){
 if(opening)return opening;
 opening=(async()=>{const config=await configuration();const {connect}=await import('./vendor/wallet/connect.js?v=281');return connect(config.projectId,accountChanged);})();
 try{return await opening;}finally{opening=null;}
}
