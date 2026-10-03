// Free, delayed holder snapshots. These are wallets, not people or viewers.
import {fetchGecko} from './gecko.js?v=39';
const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
const cache=new Map(),HOUR=3600000;
export function createHolderMetadata({onInfo=()=>{},onChange=()=>{}}={}){
 let key='',state={state:'unavailable',holders:null,watchers:null},controller,timer,epoch=0;
 function publish(next){state=next;onChange(snapshot());}
 function snapshot(now=Date.now()){
  if(state.holders===null)return {...state,weight:0,watchers:null};
  // Provider time measures the snapshot, receipt time bounds our own cache.
  const age=state.countAt?Math.max(0,now-state.countAt,now-state.receivedAt):null;
  const weight=state.countAt?Math.max(0,Math.min(1,1-(age-HOUR)/(5*HOUR))):0;
  return {...state,age,weight,watchers:null,state:age===null?'age-unknown':weight===0?'expired':state.state};
 }
 function setMarket(pair){
  epoch++;controller?.abort();clearTimeout(timer);key='';
  if(!pair){publish({state:'unavailable',holders:null,watchers:null});return;}
  const network=aliases[pair.chainId]||pair.chainId,address=pair.baseToken.address;
  key=network+':'+address;const tokenKey=key,version=epoch;
  const saved=cache.get(key);publish(saved||{state:'loading',holders:null,watchers:null});
  const url='https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(network)+'/tokens/'+encodeURIComponent(address)+'/info';
  async function refresh(){
   if(version!==epoch)return;
   controller=new AbortController();const abort=controller,timeout=setTimeout(()=>abort.abort(),45000);
   try{
    const response=await fetchGecko(url,{signal:abort.signal,priority:0});
    if(!response.ok)throw Error('Holder metadata unavailable');
    const body=await response.json(),info=body.data?.attributes;
    if(version!==epoch)return;
    onInfo(info,pair);
    const holder=info?.holders,count=Number(holder?.count),receivedAt=Date.now();
    // Null/empty is unavailable; a genuine zero is still a valid count.
    if(!['number','string'].includes(typeof holder?.count)||holder.count===''||!Number.isSafeInteger(count)||count<0){
     publish({state:'unavailable',holders:null,watchers:null,receivedAt});cache.delete(tokenKey);
    }else{
     const parsed=Date.parse(holder.last_updated),top=holder.distribution_percentage?.top_10;
     const concentration=top!=null&&top!==''&&Number.isFinite(Number(top))?Math.max(0,Math.min(1,Number(top)/100)):null;
     const next={state:'snapshot',holders:count,countAt:Number.isFinite(parsed)&&parsed<=receivedAt+300000?parsed:null,receivedAt,concentration,source:'GeckoTerminal holder snapshot',watchers:null};
     cache.set(tokenKey,next);if(cache.size>32)cache.delete(cache.keys().next().value);publish(next);
    }
   }catch{if(version===epoch)publish(state.holders===null?{state:'unavailable',holders:null,watchers:null}:{...state,state:'delayed'});}
   finally{clearTimeout(timeout);if(version===epoch)timer=setTimeout(refresh,120000);}
  }
  void refresh();
 }
 return {setMarket,snapshot,close(){epoch++;controller?.abort();clearTimeout(timer);}};
}
