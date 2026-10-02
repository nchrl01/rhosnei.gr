import {fetchGecko} from './gecko.js?v=39';
const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',arbitrum:'arbitrum',cronos:'cro'};
export function loadHistory(market,onUpdate,options={}){
 let closed=false,timer,controller;const rows=new Map();
 const created=Number(market.pairCreatedAt)||null,age=created?Date.now()-created:Infinity;
 const timeframe=options.timeframe||(age<86400000?'minute':age<30*86400000?'hour':'day');
 const aggregate=options.aggregate||1,maxPages=options.maxPages||20;
 const interval={minute:60000,hour:3600000,day:86400000}[timeframe]*aggregate;
 const key='av-history-v2:'+market.chainId+':'+market.pairAddress+':'+market.baseToken.address+':'+timeframe+':'+aggregate;
 const network=aliases[market.chainId]||market.chainId;
 const base='https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(network)+'/pools/'+encodeURIComponent(market.pairAddress)+'/ohlcv/'+timeframe;
 let before=Math.floor(Date.now()/1000)+1,pages=0,failures=0,cachedComplete=false,cachedLatest=null,cacheGap=false,pendingGap=null;
 function report(state,message){onUpdate({candles:[...rows.values()].sort((a,b)=>a.time-b.time),interval,timeframe,state,message,created});}
 function save(state,complete=false){try{localStorage.setItem(key,JSON.stringify({saved:Date.now(),candles:[...rows.values()],state,timeframe,complete,gap:pendingGap}));}catch{}}
 // Render saved history immediately, including older cache, but always refresh
 // the newest page. A cache hit must never freeze the current candle for 10 min.
 try{
  const cached=JSON.parse(localStorage.getItem(key));
  if(cached&&cached.timeframe===timeframe&&Date.now()-cached.saved<86400000&&Array.isArray(cached.candles)){
   for(const bar of cached.candles)if(Number.isFinite(bar.time)&&bar.open>0&&bar.close>0)rows.set(bar.time,bar);
   pendingGap=cached.gap&&Number.isFinite(cached.gap.through)?cached.gap:null;
   cacheGap=!!pendingGap;cachedComplete=cached.complete===true&&!cacheGap;cachedLatest=rows.size?Math.max(...rows.keys()):null;
   report('cached','Saved '+cached.timeframe+' history · refreshing latest candles…');
  }
 }catch{}
 async function page(){
  if(closed)return;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);let delay=0;const requestedAt=Date.now();
  try{
   const query=new URLSearchParams({aggregate:String(aggregate),limit:'1000',currency:'usd',token:market.baseToken.address,before_timestamp:String(before),include_empty_intervals:'false'});
   const r=await fetchGecko(base+'?'+query,{signal:controller.signal,priority:pages===0?(options.priority??80):20});if(!r.ok){if(r.status===429)delay=Math.max(30000,Number(r.headers.get('Retry-After'))*1000||0);throw Error('History provider HTTP '+r.status);}
   const data=await r.json();if(closed)return;const list=data.data?.attributes?.ohlcv_list;if(!Array.isArray(list))throw Error('Unexpected history response');
   const validTimes=[];
   for(const row of list){if(row.length<6||!row.every(v=>Number.isFinite(Number(v))))continue;const [seconds,open,high,low,close,volume]=row.map(Number);if(seconds<=0||open<=0||close<=0||low<=0||high<Math.max(open,close)||low>Math.min(open,close)||volume<0)continue;const bar={time:seconds*1000,open,high,low,close,volume,observedThrough:Math.min(seconds*1000+interval,requestedAt)};validTimes.push(bar.time);rows.set(bar.time,bar);}
   if(list.length&&!validTimes.length)throw Error('History page contains no valid candles');
   pages++;failures=0;const oldest=rows.size?Math.min(...rows.keys()):null;
   const pageOldest=validTimes.length?Math.min(...validTimes):null;
   if(pageOldest!=null){
    if(pendingGap){if(pageOldest<=pendingGap.through+interval)pendingGap=null;}
    else if(pages===1&&cachedLatest!=null&&pageOldest>cachedLatest+interval)pendingGap={through:cachedLatest,from:pageOldest};
    cacheGap=!!pendingGap;if(cacheGap)cachedComplete=false;
   }
   const reached=!cacheGap&&created&&oldest!=null&&oldest<=created+interval;
   const exhausted=list.length===0||(pages>1&&pageOldest!=null&&pageOldest/1000>=before),limited=pages>=maxPages,done=reached||exhausted||limited||cachedComplete;
   const state=reached?'pool-start':done?'partial':'loading';
   report(state,reached?'History reaches selected pool creation':exhausted?'Earliest available history reached; earlier trading may be missing':cachedComplete?'Saved history refreshed':limited?(cacheGap?'History request limit reached · saved/latest history gap remains':'History request limit reached · partial coverage'):'Loading earlier market history…');
   save(state,!cacheGap&&(reached||exhausted||cachedComplete));
   if(done){closed=true;return;}
   before=Math.floor(pageOldest/1000);timer=setTimeout(page,delay);
  }catch(error){if(closed)return;failures++;report(rows.size?'partial':'unavailable',error.message+' · launch history not confirmed');if(failures<3)timer=setTimeout(page,Math.max(delay,10000*2**failures));}
  finally{clearTimeout(timeout);}
 }
 if(!rows.size)report('loading','Loading market history…');page();return()=>{closed=true;clearTimeout(timer);controller?.abort();};
}
