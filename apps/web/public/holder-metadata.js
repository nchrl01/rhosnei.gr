import {createHolderBalances} from './holder-balances.js?v=334';
import {fetchGoPlusCount} from './holder-count-providers.js?v=306';
// Free, delayed holder snapshots. These are wallets, not people or viewers.
import {createHolderClusters} from './holder-clusters.js?v=168';
const RELAY='https://upic-insightx.nchrl01.workers.dev/holders';
const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
const cache=new Map(),HOUR=3600000;
let nextDirectAt=0;
try{for(const [key,value] of JSON.parse(localStorage.getItem('upic-holder-counts-v1')||'[]').slice(-32)){if(Number.isSafeInteger(value?.holders)&&value.holders>=0&&Date.now()-value.receivedAt<30*60000)cache.set(key,value);}}catch{}
function saveCounts(){try{localStorage.setItem('upic-holder-counts-v1',JSON.stringify([...cache].slice(-32)));}catch{}}
async function browserCount(network,address,signal){
 const delay=Math.max(0,nextDirectAt-Date.now());nextDirectAt=Date.now()+delay+6000;
 if(delay>30000)return {state:'budget-wait',holders:null,retryAt:Date.now()+delay};
 if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const result=await fetchGoPlusCount(network,address,{signal});
 if(result.state==='rate-limited')nextDirectAt=Math.max(nextDirectAt,Date.now()+60000);
 return result;
}
export function holderCountReadout(info={},historical=false){
 const available=Number.isSafeInteger(info.holders)&&info.holders>=0;
 const label=historical?'HOLDERS · LATEST':'HOLDERS';
 const value=available?(info.approximate?'≈ ':'')+info.holders.toLocaleString('en'):'Waiting';
 const reported=info.countAt?' · reported '+new Date(info.countAt).toLocaleString():' · snapshot time unavailable';
 const title=available?'Total token-holder wallets · '+(info.source||'provider')+' snapshot'+reported+(['delayed','expired'].includes(info.state)?' · latest available; updates delayed':'')
  :'Waiting for holder data';
 const h=info.holdings;const coverage=!historical&&h?.weight>0?' · Visual: '+h.records.length.toLocaleString('en')+' observed balances · '+h.source+(h.complete?' (complete indexed list)':h.truncated?' (10,000 display limit)':h.state==='loading'?' (loading more)':' (partial sample)'):historical?' · Historical balances unavailable':' · Individual balances unavailable';
 return {label,value,title:title+coverage};
}
export function createHolderMetadata({onInfo=()=>{},onChange=()=>{}}={}){
 const clusters=createHolderClusters();
 const balances=createHolderBalances({onChange:()=>onChange(snapshot())});
 let key='',state={state:'unavailable',holders:null,watchers:null},controller,timer,epoch=0;
 function publish(next){state=next;onChange(snapshot());}
 function snapshot(now=Date.now()){
  const relationships=clusters.snapshot(now),holdings=balances.snapshot(now);
  if(state.holders===null)return {...state,weight:0,watchers:null,relationships,holdings};
  // Provider time measures the snapshot, receipt time bounds our own cache.
  const age=state.countAt?Math.max(0,now-state.countAt,now-state.receivedAt):null;
  const weight=state.countAt?Math.max(0,Math.min(1,1-(age-HOUR)/(5*HOUR))):0;
  return {...state,age,weight,watchers:null,relationships,holdings,state:age===null?'age-unknown':weight===0?'expired':state.state};
 }
 function setMarket(pair){
  clusters.setMarket(pair);balances.setMarket(pair);
  epoch++;controller?.abort();clearTimeout(timer);key='';
  if(!pair){publish({state:'unavailable',holders:null,watchers:null});return;}
  const network=pair.geckoNetwork||aliases[pair.chainId]||pair.chainId,input=pair.baseToken.address;
  const address=/^0x[0-9a-fA-F]{40}$/.test(input)?input.toLowerCase():input;
  key=network+':'+address;const tokenKey=key,version=epoch;
  const saved=cache.get(key);publish(saved||{state:'loading',holders:null,watchers:null});
  async function refresh(){
   if(version!==epoch)return;
   if(typeof document!=='undefined'&&document.hidden){timer=setTimeout(refresh,30000);return;}
   controller=new AbortController();const abort=controller,timeout=setTimeout(()=>abort.abort(),120000);
   try{
    let result;
    try{
     const response=await fetch(RELAY+'?'+new URLSearchParams({network,address}),{signal:abort.signal,credentials:'omit'});
     if(response.ok)result=await response.json();
    }catch{if(abort.signal.aborted)return;}
    if(result?.holders==null)result=await browserCount(network,address,abort.signal);
    if(version!==epoch)return;
    const raw=result.holders,count=Number(raw),receivedAt=Date.now();
    if(result.image_url)try{onInfo({image_url:result.image_url},pair);}catch{}
    if(!['number','string'].includes(typeof raw)||String(raw).trim()===''||!Number.isSafeInteger(count)||count<0){
     publish(state.holders===null?{state:result.state||'unavailable',holders:null,watchers:null,retryAt:result.retryAt}:{...state,state:'delayed',retryAt:result.retryAt});
    }else{
     const parsed=Date.parse(result.lastUpdated);
     const next={state:result.state==='delayed'?'delayed':'snapshot',holders:count,countAt:Number.isFinite(parsed)&&parsed<=receivedAt+300000?parsed:null,receivedAt,source:result.source||'GeckoTerminal',approximate:Boolean(result.approximate),retryAt:result.retryAt,watchers:null};
     cache.set(tokenKey,next);if(cache.size>32)cache.delete(cache.keys().next().value);saveCounts();publish(next);
    }
   }catch{if(version===epoch)publish(state.holders===null?{state:'unavailable',holders:null,watchers:null}:{...state,state:'delayed'});}
   finally{clearTimeout(timeout);if(version===epoch)timer=setTimeout(refresh,state.retryAt?Math.max(30000,Math.min(1800000,state.retryAt-Date.now())):state.holders===null?60000:1800000);}
  }
  if(saved&&Date.now()-saved.receivedAt<30*60000&&(network!=='robinhood'||saved.source==='Blockscout Robinhood index'))timer=setTimeout(refresh,30*60000-(Date.now()-saved.receivedAt));
  else void refresh();
 }
 return {setMarket,snapshot,close(){clusters.close();balances.close();epoch++;controller?.abort();clearTimeout(timer);}};
}
