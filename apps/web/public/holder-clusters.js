// Current wallet relationships; never a historical holder reconstruction.
const ENDPOINT='https://upic-insightx.nchrl01.workers.dev';
const networks={solana:'sol',sol:'sol',ethereum:'eth',eth:'eth',base:'base'};
const cache=new Map(),HOUR=3600000;
export function createHolderClusters(){
 let epoch=0,controller,timer,state={state:'unavailable',clusters:[]};
 function snapshot(now=Date.now()){
  const age=Number.isFinite(state.fetchedAt)?Math.max(0,now-state.fetchedAt):null;
  const weight=age===null?0:Math.max(0,Math.min(1,1-(age-6*HOUR)/(18*HOUR)));
  return {...state,age,weight,clusters:weight>0?state.clusters:[]};
 }
 function close(){epoch++;controller?.abort();clearTimeout(timer);state={state:'unavailable',clusters:[]};}
 function setMarket(pair){
  close();if(!pair||!ENDPOINT)return;
  const version=epoch,network=networks[pair.chainId],input=pair.baseToken?.address;
  if(!network||!input){state={state:'unsupported-network',clusters:[]};return;}
  const address=network==='sol'?input:input.toLowerCase(),key=network+':'+address;
  state=cache.get(key)||{state:'loading',clusters:[]};
  async function refresh(){
   if(version!==epoch)return;
   if(document.hidden){timer=setTimeout(refresh,60000);return;}
   const saved=cache.get(key),now=Date.now();
   if(saved?.nextAt>now){state=saved;timer=setTimeout(refresh,saved.nextAt-now);return;}
   controller=new AbortController();const abort=controller,timeout=setTimeout(()=>abort.abort(),20000);
   try{
    const response=await fetch(ENDPOINT+'/clusters?'+new URLSearchParams({network,address}),{signal:abort.signal,credentials:'omit'});
    if(!response.ok)throw Error('Snapshot unavailable');
    const data=await response.json();if(version!==epoch)return;
    const clusters=Array.isArray(data.clusters)?data.clusters:[];
    state={...data,clusters,nextAt:Math.max(now+15*60000,Number(data.retryAt)||Number(data.expiresAt)||now+HOUR)};
    cache.set(key,state);if(cache.size>32)cache.delete(cache.keys().next().value);
   }catch{if(version===epoch){state={...state,state:'unavailable',nextAt:now+HOUR};cache.set(key,state);}}
   finally{clearTimeout(timeout);if(version===epoch)timer=setTimeout(refresh,Math.max(60000,(state.nextAt||now+HOUR)-Date.now()));}
  }
  void refresh();
 }
 return {setMarket,snapshot,close};
}
