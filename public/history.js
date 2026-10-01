const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',arbitrum:'arbitrum',cronos:'cro'};
export function loadHistory(market,onUpdate){
 let closed=false,timer,controller;const rows=new Map();
 const created=Number(market.pairCreatedAt)||null,age=created?Date.now()-created:Infinity;
 const timeframe=age<86400000?'minute':age<30*86400000?'hour':'day';
 const interval={minute:60000,hour:3600000,day:86400000}[timeframe];
 const key='av-history:'+market.chainId+':'+market.pairAddress+':'+market.baseToken.address;
 const network=aliases[market.chainId]||market.chainId;
 const base='https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(network)+'/pools/'+encodeURIComponent(market.pairAddress)+'/ohlcv/'+timeframe;
 let before=Math.floor(Date.now()/1000)+1,pages=0,failures=0;
 function report(state,message){onUpdate({candles:[...rows.values()].sort((a,b)=>a.time-b.time),interval,timeframe,state,message,created});}
 try{const cached=JSON.parse(localStorage.getItem(key));if(cached&&cached.timeframe===timeframe&&Date.now()-cached.saved<600000&&Array.isArray(cached.candles)){for(const bar of cached.candles)rows.set(bar.time,bar);report(cached.state,'Cached '+cached.timeframe+' history');return()=>{closed=true;};}}catch{}
 async function page(){
  if(closed)return;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);let delay=10000;
  try{
   const query=new URLSearchParams({aggregate:'1',limit:'1000',currency:'usd',token:market.baseToken.address,before_timestamp:String(before),include_empty_intervals:'false'});
   const r=await fetch(base+'?'+query,{signal:controller.signal});if(!r.ok){if(r.status===429)delay=Math.max(30000,Number(r.headers.get('Retry-After'))*1000||0);throw Error('History provider HTTP '+r.status);}
   const data=await r.json();if(closed)return;const list=data.data?.attributes?.ohlcv_list;if(!Array.isArray(list))throw Error('Unexpected history response');
   let added=0;
   for(const row of list){if(row.length<6||!row.every(v=>Number.isFinite(Number(v))))continue;const [seconds,open,high,low,close,volume]=row.map(Number);if(seconds<=0||open<=0||close<=0||low<=0||high<Math.max(open,close)||low>Math.min(open,close)||volume<0)continue;const bar={time:seconds*1000,open,high,low,close,volume};if(!rows.has(bar.time)){rows.set(bar.time,bar);added++;}}
   pages++;failures=0;const oldest=rows.size?Math.min(...rows.keys()):null;
   const reached=created&&oldest!=null&&oldest<=created+interval;
   const exhausted=list.length===0||added===0,limited=pages>=20,done=reached||exhausted||limited;
   const state=reached?'pool-start':done?'partial':'loading';
   report(state,reached?'History reaches selected pool creation':exhausted?'Earliest available history reached; earlier trading may be missing':limited?'History request limit reached · partial coverage':'Loading earlier market history…');
   if(done){closed=true;try{localStorage.setItem(key,JSON.stringify({saved:Date.now(),candles:[...rows.values()],state,timeframe}));}catch{}return;}
   before=Math.floor(oldest/1000);timer=setTimeout(page,delay);
  }catch(error){if(closed)return;failures++;report(rows.size?'partial':'unavailable',error.message+' · launch history not confirmed');if(failures<3)timer=setTimeout(page,Math.max(delay,10000*2**failures));}
  finally{clearTimeout(timeout);}
 }
 report('loading','Loading market history…');page();return()=>{closed=true;clearTimeout(timer);controller?.abort();};
}
