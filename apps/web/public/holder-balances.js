import {fetchGoPlusCount,HOLDER_NETWORKS} from './holder-count-providers.js?v=306';
// Actual indexed ERC-20 balances. Public Blockscout reads require no API key.
// A bounded, paginated sample is never expanded into invented wallets.
const EXPLORERS={ethereum:'https://eth.blockscout.com',eth:'https://eth.blockscout.com',base:'https://base.blockscout.com',arbitrum:'https://arbitrum.blockscout.com',optimism:'https://explorer.optimism.io',polygon:'https://polygon.blockscout.com',polygon_pos:'https://polygon.blockscout.com',zksync:'https://zksync.blockscout.com',celo:'https://celo.blockscout.com',robinhood:'https://robinhoodchain.blockscout.com'};
const ALIASES={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
const LIMIT=10000,TTL=15*60000,MAX_AGE=60*60000,cache=new Map();
const addressPattern=/^0x[0-9a-f]{40}$/i;
export function tokenUnits(raw,decimals){
 const value=String(raw??'');
 if(!/^\d{1,100}$/.test(value)||!Number.isInteger(decimals)||decimals<0||decimals>80)return null;
 const padded=value.padStart(decimals+1,'0');
 const amount=Number(decimals?padded.slice(0,-decimals)+'.'+padded.slice(-decimals):padded);
 return Number.isFinite(amount)&&amount>0?amount:null;
}
const empty=state=>({state,source:'Blockscout',records:[],weight:0,totalHolders:null,complete:false,truncated:false});
const sleep=(ms,signal)=>new Promise((resolve,reject)=>{
 if(signal.aborted){reject(signal.reason);return;}
 const abort=()=>{clearTimeout(timer);reject(signal.reason);};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
 signal.addEventListener('abort',abort,{once:true});
});
export function createHolderBalances({onChange=()=>{}}={}){
 let state=empty('unavailable'),controller=null,timer=null,epoch=0;
 function snapshot(now=Date.now()){
  const age=state.fetchedAt?Math.max(0,now-state.fetchedAt):null;
  const weight=age!==null&&age<MAX_AGE?1:0;
  return {...state,age,weight,records:weight?state.records:[],state:age!==null&&!weight?'expired':state.state};
 }
 function publish(next){state=next;onChange();}
 function close(){epoch++;controller?.abort();clearTimeout(timer);state=empty('unavailable');}
 function setMarket(pair){
  close();const version=epoch,host=EXPLORERS[pair?.chainId],input=pair?.baseToken?.address;
  const network=pair?.geckoNetwork||ALIASES[pair?.chainId]||pair?.chainId,solana=network==='solana';
  if((!host&&!HOLDER_NETWORKS[network]&&!solana)||!(solana?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/:addressPattern).test(input||'')){publish(empty(pair?'unsupported-network':'unavailable'));return;}
  const address=solana?input:input.toLowerCase(),key=network+':'+address;
  const saved=cache.get(key);publish(saved||empty('loading'));
  async function refresh(){
   if(version!==epoch)return;
   if(document.hidden){timer=setTimeout(refresh,30000);return;}
   const cached=cache.get(key);
   if(cached?.state!=='loading'&&cached?.nextAt>Date.now()){publish(cached);timer=setTimeout(refresh,cached.nextAt-Date.now());return;}
   controller=new AbortController();const signal=controller.signal;
   const current=()=>version===epoch&&!signal.aborted;
   const url=host+'/api/v2/tokens/'+address;
   async function read(target){
    const timeout=AbortSignal.timeout(20000);
    const response=await fetch(target,{signal:AbortSignal.any([signal,timeout]),credentials:'omit',headers:{Accept:'application/json'}});
    if(!response.ok){const error=Error('holder-provider-'+response.status);error.rateLimited=response.status===429;throw error;}
    return response.json();
   }
   async function sample(){
    const result=await fetchGoPlusCount(network,address,{signal});if(!current())return;
    if(!result.holderBalances?.length){const error=Error('holder-sample-unavailable');error.rateLimited=result.state==='rate-limited';throw error;}
    publish({source:'GoPlus',network,address,totalHolders:result.holders,fetchedAt:result.fetchedAt,state:'snapshot',coverage:'top-holder-sample',records:result.holderBalances,complete:false,truncated:false,nextAt:Date.now()+TTL});
   }
   try{
    if(!host){await sample();return;}
    const token=await read(url);if(!current())return;
    const decimals=token.decimals==null?NaN:Number(token.decimals);
    if(token.type!=='ERC-20'||!Number.isInteger(decimals)||decimals<0||decimals>80)throw Error('unsupported-token');
    const rawCount=token.holders_count,count=rawCount==null||rawCount===''?NaN:Number(rawCount);
    const totalHolders=Number.isSafeInteger(count)&&count>=0?count:null;
    const records=new Map(),seenCursors=new Set();let next={},pages=0,invalid=0,finished=false;
    const startedAt=Date.now();
    // Timestamp records retrieval, not an invented on-chain block time.
    const base={source:'Blockscout',network:pair.chainId,address,totalHolders,decimals,fetchedAt:startedAt,coverage:'largest-indexed-balances',complete:false,truncated:false};
    do{
     while(document.hidden)await sleep(30000,signal);
     await sleep(750,signal);if(!current())return;
     const data=await read(url+'/holders'+(Object.keys(next).length?'?'+new URLSearchParams(next):''));
     if(!current())return;
     if(!Array.isArray(data.items))throw Error('invalid-holder-response');
     for(const item of data.items){
      const id=item.address?.hash,amount=tokenUnits(item.value,decimals);
      if(!addressPattern.test(id||'')){invalid++;continue;}
      if(amount===null){if(!/^0+$/.test(String(item.value)))invalid++;continue;}
      const normalized=id.toLowerCase();
      if(records.has(normalized)||records.size<LIMIT)records.set(normalized,{id:normalized,tokenBalance:amount,balanceRaw:String(item.value),decimals,isContract:item.address.is_contract===true});
     }
     pages++;
     const cursor=data.next_page_params;
     finished=cursor==null;
     next={};
     if(!finished){
      if(typeof cursor!=='object'||Array.isArray(cursor))throw Error('invalid-holder-cursor');
      for(const name of ['value','address_hash','items_count'])if(cursor[name]!=null){
       const value=String(cursor[name]);
       if(name==='address_hash'?!addressPattern.test(value):!/^\d{1,100}$/.test(value))throw Error('invalid-holder-cursor');
       next[name]=value;
      }
      const cursorKey=JSON.stringify(next);
      if(!Object.keys(next).length||seenCursors.has(cursorKey))throw Error('repeated-holder-cursor');
      seenCursors.add(cursorKey);
     }
     const truncated=!finished&&records.size>=LIMIT;
     const nextState={...base,state:finished||truncated?'snapshot':'loading',records:[...records.values()],pages,invalid,complete:finished&&invalid===0,truncated,nextAt:Date.now()+TTL};
     publish(nextState);cache.set(key,nextState);if(cache.size>8)cache.delete(cache.keys().next().value);
     if(finished||truncated)break;
    }while(pages<250);
    if(!finished&&state.records.length<LIMIT)publish({...state,state:'partial',complete:false});
   }catch(error){
    if(!current())return;
    if(host&&!snapshot().records.length){try{await sample();return;}catch(fallbackError){error=fallbackError;if(!current())return;}}
    publish({...state,state:state.records.length?'delayed':error.rateLimited?'rate-limited':'unavailable',complete:false,nextAt:Date.now()+(error.rateLimited?5*60000:2*60000)});
   }finally{
    if(current()){cache.set(key,state);timer=setTimeout(refresh,Math.max(60000,(state.nextAt||Date.now()+TTL)-Date.now()));}
   }
  }
  void refresh();
 }
 return {setMarket,snapshot,close};
}
