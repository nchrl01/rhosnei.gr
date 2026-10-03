// Browser-safe public exchange adapter. No account, API key or trading calls.
let worker=null,serial=0;
const pending=new Map(),streams=new Map();
function runtime(){
 if(worker)return worker;
 worker=new Worker(new URL('./ccxt-worker.js?v=87',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{
  if(data.stream){streams.get(data.stream)?.(data.type,data.value);return;}
  const request=pending.get(data.id);if(!request)return;pending.delete(data.id);clearTimeout(request.timer);
  data.error?request.reject(Error(data.error)):request.resolve(data.result);
 };
 worker.onerror=()=>{
  const error=Error('Exchange data could not load. Try the search again.');
  for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}pending.clear();
  for(const callback of streams.values())callback('status',{connected:false,kind:'exchange',message:error.message});
  worker?.terminate();worker=null;
 };
 return worker;
}
function request(method,...args){
 return new Promise((resolve,reject)=>{
  const target=runtime(),id=++serial;
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('Exchange request timed out. The venue may be unavailable in this browser or region.'));},45000);
  pending.set(id,{resolve,reject,timer});target.postMessage({id,method,args});
 });
}
export const isExchangeMarket=pair=>pair?.source==='ccxt'||pair?.chainId==='exchange';
export const isExchangeQuery=text=>/^(?:cex:)?(?:kraken|coinbase|coinbaseexchange|binance):/i.test(text)||/^[a-z0-9]+[/-](USD|USDT|USDC)$/i.test(text);
export const searchExchangeMarkets=query=>request('search',query);
export const prepareExchangeMarket=pair=>request('snapshot',pair.exchangeId||pair.dexId,pair.exchangeSymbol||pair.pairAddress.split(':').slice(1).join(':'));
export function subscribeExchangeMarket(pair,onTrade,onStatus,onBook){
 const id='market-'+(++serial);let closed=false;
 streams.set(id,(type,value)=>{if(closed)return;if(type==='trades')for(const trade of value)onTrade(trade);else if(type==='status')onStatus(value);else if(type==='book')onBook?.(value);});
 request('subscribe',pair.exchangeId,pair.exchangeSymbol,id).catch(error=>{if(!closed)onStatus({connected:false,kind:'exchange',message:error.message});});
 return()=>{closed=true;streams.delete(id);if(worker)void request('stop',id).catch(()=>{});};
}
const historyPending=new Map();
function historyPage(args){
 const key=JSON.stringify({...args,until:Math.floor(args.until/1000)});
 if(!historyPending.has(key))historyPending.set(key,request('history',args).finally(()=>historyPending.delete(key)));
 return historyPending.get(key);
}
export function loadExchangeHistory(pair,onUpdate,options={}){
 let closed=false;const raw=new Map(),id=pair.exchangeId||pair.dexId,symbol=pair.exchangeSymbol||pair.pairAddress.slice(id.length+1);
 const timeframe=options.timeframe||'hour',aggregate=options.aggregate||1;
 const interval={minute:60000,hour:3600000,day:86400000}[timeframe]*aggregate;
 const frame=String(aggregate)+({minute:'m',hour:'h',day:'d'}[timeframe]);
 const key='upic-ccxt-history-v1:'+id+':'+symbol+':'+frame;
 let bars=[],before=Date.now(),lastOldest=Infinity;
 function report(state,message,detail={}){if(!closed)onUpdate({candles:bars,interval,timeframe,state,message,created:null,error:null,retrying:false,...detail});}
 try{
  const cached=JSON.parse(localStorage.getItem(key));
  if(cached?.saved>Date.now()-86400000&&Array.isArray(cached.bars)){
   bars=cached.bars.filter(b=>Number.isFinite(b.time)&&b.open>0&&b.high>=b.close&&b.low>0&&b.close>0).slice(-1200);
   report('cached','Saved exchange history · refreshing');
  }
 }catch{}
 if(!bars.length)report('loading','Loading '+pair.exchangeName+' history');
 async function load(){
  const saved=bars,limit=Math.min(3,Math.max(1,options.maxPages||3));
  let obtained=false;
  try{
   for(let page=0;page<limit&&!closed;page++){
    const data=await historyPage({id,symbol,timeframe:frame,until:before,limit:300});if(closed)return;
    const valid=data.rows.filter(row=>row.length>=6&&row.every(Number.isFinite)&&row[0]<before&&row[1]>0&&row[3]>0&&row[4]>0&&row[2]>=Math.max(row[1],row[4])&&row[3]<=Math.min(row[1],row[4])&&row[5]>=0);
    if(!valid.length)break;
    const oldest=Math.min(...valid.map(row=>row[0]));
    if(oldest>=lastOldest)break;lastOldest=oldest;
    for(const row of valid)raw.set(row[0],{row,through:Math.min(row[0]+data.interval,data.observedAt)});
    const grouped=new Map();
    for(const {row:[at,open,high,low,close,volume],through} of [...raw.values()].sort((a,b)=>a.row[0]-b.row[0])){
     const time=Math.floor(at/interval)*interval,previous=grouped.get(time);
     if(previous){previous.high=Math.max(previous.high,high);previous.low=Math.min(previous.low,low);previous.close=close;previous.volume+=volume*close;previous.observedThrough=Math.max(previous.observedThrough,through);}
     else grouped.set(time,{time,open,high,low,close,volume:volume*close,volumeEstimated:true,observedThrough:through});
    }
    const merged=new Map(saved.map(bar=>[bar.time,bar]));for(const [time,bar] of grouped)merged.set(time,bar);
    bars=[...merged.values()].sort((a,b)=>a.time-b.time).slice(-1200);obtained=true;
    report(page+1<limit?'loading':'partial','Exchange history · estimated quote volume · available coverage only');
    before=oldest;
    if(valid.length<300||id==='kraken')break;
   }
   if(!obtained&&!bars.length)throw Error('Exchange returned no candles for this pair');
   report('partial','Exchange history · base volume × close estimate · launch coverage not assumed');
   try{
    localStorage.setItem(key,JSON.stringify({saved:Date.now(),bars}));
    const keys=Object.keys(localStorage).filter(k=>k.startsWith('upic-ccxt-history-v1:'));
    while(keys.length>12){const old=keys.shift();if(old!==key)localStorage.removeItem(old);}
   }catch{}
  }catch(error){report(bars.length?'partial':'unavailable','Exchange history: '+error.message,{error:error.message||'Exchange history refresh failed'});}
 }
 void load();return()=>{closed=true;};
}
