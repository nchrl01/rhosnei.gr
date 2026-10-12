const endpoint='https://upic-insightx.nchrl01.workers.dev/marketplace/config';
let loading=false,config;
for(const placeholder of document.querySelectorAll('.footer-wallet')){
 const button=document.createElement('button');button.type='button';button.className='footer-wallet';button.textContent='Connect Wallet';placeholder.replaceWith(button);
 const status=document.createElement('span');status.setAttribute('role','status');status.className='wallet-status';button.after(status);
 button.addEventListener('click',async()=>{
  if(loading)return;loading=true;button.disabled=true;status.textContent='';
  try{
   if(!config){const response=await fetch(endpoint,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Wallet connections are being configured.');config=await response.json();}
   if(!config.projectId)throw Error('Wallet connections are being configured.');
   const {connect}=await import('./vendor/wallet/connect.js?v=262');
   await connect(config.projectId,account=>{button.textContent=account.isConnected&&account.address?account.address.slice(0,6)+'…'+account.address.slice(-4):'Connect Wallet';});
  }catch(error){status.textContent=error.message||'Could not connect. Please try again.';}
  finally{loading=false;button.disabled=false;}
 });
}
