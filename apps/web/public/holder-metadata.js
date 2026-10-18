// Free, delayed holder snapshots. These are wallets, not people or viewers.
import {fetchGecko} from './gecko.js?v=277';
import {createHolderClusters} from './holder-clusters.js?v=168';
const RELAY='https://upic-insightx.nchrl01.workers.dev/holders';
const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
const cache=new Map(),HOUR=3600000;
export function holderCountReadout(info={},historical=false){
 const available=Number.isSafeInteger(info.holders)&&info.holders>=0&&info.state!=='expired';
 const label=historical?'HOLDERS · LATEST':'HOLDERS';
 const value=available?info.holders.toLocaleString('en'):'Waiting';
 const reported=info.countAt?' · reported '+new Date(info.countAt).toLocaleString():' · snapshot time unavailable';
 const title=available?'Total token-holder wallets · latest provider snapshot'+reported+(info.state==='delayed'?' · updates delayed':'')
  :'Waiting for holder data';
 return {label,value,title};
}
export function createHolderMetadata({onInfo=()=>{},onChange=()=>{}}={}){
 const clusters=createHolderClusters();
 let key='',state={state:'unavailable',holders:null,watchers:null},controller,timer,epoch=0;
 function publish(next){state=next;onChange(snapshot());}
 function snapshot(now=Date.now()){
  const relationships=clusters.snapshot(now);
  if(state.holders===null)return {...state,weight:0,watchers:null,relationships};
  // Provider time measures the snapshot, receipt time bounds our own cache.
  const age=state.countAt?Math.max(0,now-state.countAt,now-state.receivedAt):null;
  const weight=state.countAt?Math.max(0,Math.min(1,1-(age-HOUR)/(5*HOUR))):0;
  return {...state,age,weight,watchers:null,relationships,state:age===null?'age-unknown':weight===0?'expired':state.state};
 }
 function setMarket(pair){
  clusters.setMarket(pair);
  epoch++;controller?.abort();clearTimeout(timer);key='';
  if(!pair){publish({state:'unavailable',holders:null,watchers:null});return;}
  const network=aliases[pair.chainId]||pair.chainId,input=pair.baseToken.address;
  const address=/^0x[0-9a-fA-F]{40}$/.test(input)?input.toLowerCase():input;
  key=network+':'+address;const tokenKey=key,version=epoch;
  const saved=cache.get(key);publish(saved||{state:'loading',holders:null,watchers:null});
  const url='https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(network)+'/tokens/'+encodeURIComponent(address)+'/info';
  async function refresh(){
   if(version!==epoch)return;
   if(typeof document!=='undefined'&&document.hidden){timer=setTimeout(refresh,30000);return;}
   controller=new AbortController();const abort=controller,timeout=setTimeout(()=>abort.abort(),120000);
   try{
    let response,info;
    try{
     response=await fetch(RELAY+'?'+new URLSearchParams({network,address}),{signal:abort.signal,credentials:'omit'});
     if(response.ok){
      const result=await response.json();
      if(result.state==='rate-limited'){publish({...state,state:state.holders===null?'rate-limited':'delayed'});return;}
      info={image_url:result.image_url,holders:{count:result.holders,last_updated:result.lastUpdated}};
     }
    }catch(error){if(abort.signal.aborted)throw error;}
    // Compatibility while the backend deployment is rolling out.
    if(!info){
     response=await fetchGecko(url,{signal:abort.signal,priority:45});
     if(!response.ok)throw Error('Holder metadata unavailable');
     const body=await response.json();info=body.data?.attributes;
    }
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
 return {setMarket,snapshot,close(){clusters.close();epoch++;controller?.abort();clearTimeout(timer);}};
}
