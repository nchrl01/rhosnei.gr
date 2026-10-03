// Public market data only. The official CCXT build runs off the audio/UI thread.
import './vendor/ccxt/ccxt.browser.min.js?v=87';
const CCXT=self.ccxt.pro;
const venues={kraken:'Kraken',coinbaseexchange:'Coinbase Exchange',binance:'Binance'};
const names={BTC:'Bitcoin',ETH:'Ethereum',SOL:'Solana',DOGE:'Dogecoin',XRP:'XRP',ADA:'Cardano',AVAX:'Avalanche',DOT:'Polkadot',LINK:'Chainlink',LTC:'Litecoin',BCH:'Bitcoin Cash',SUI:'Sui',PEPE:'Pepe',SHIB:'Shiba Inu',TRX:'TRON',TON:'Toncoin',UNI:'Uniswap',AAVE:'Aave',XLM:'Stellar'};
const instances=new Map(),loading=new Map();
let subscription=null,subscriptionEpoch=0,requestedStream=null;
function make(id){
 if(!Object.hasOwn(venues,id)||!CCXT[id])throw Error('Unsupported exchange');
 return new CCXT[id]({enableRateLimit:true,timeout:12000,newUpdates:true,options:{defaultType:'spot',fetchCurrencies:false,fetchMarkets:{types:['spot']},tradesLimit:1000}});
}
async function exchange(id){
 if(!instances.has(id))instances.set(id,make(id));
 const ex=instances.get(id);
 if(!ex.markets){
  if(!loading.has(id))loading.set(id,ex.loadMarkets().catch(error=>{loading.delete(id);throw error;}));
  await loading.get(id);
 }
 return ex;
}
function pair(ex,m){
 return {source:'ccxt',exchangeId:ex.id,exchangeSymbol:m.symbol,exchangeName:venues[ex.id],quoteApproximate:m.quote!=='USD',chainId:'exchange',dexId:ex.id,pairAddress:ex.id+':'+m.symbol,
  baseToken:{address:'cex:'+ex.id+':'+m.symbol,symbol:m.base,name:names[m.base]||ex.currencies?.[m.base]?.name||m.base},
  quoteToken:{address:m.quote,symbol:m.quote,name:m.quote},priceUsd:null,priceNative:null,marketCap:null,liquidity:{usd:null},txns:{},volume:{},priceChange:{},historyTokenSide:'base'};
}
function parseQuery(text){
 let q=String(text).trim().replace(/^cex:/i,'').replace(/^\$/,'');
 let venue=null;
 const colon=q.indexOf(':');if(colon>=0){venue=q.slice(0,colon).toLowerCase();q=q.slice(colon+1);if(venue==='coinbase')venue='coinbaseexchange';if(!Object.hasOwn(venues,venue))throw Error('Use kraken:, coinbase: or binance: before the pair.');}
 const alias=Object.entries(names).find(([,name])=>name.toLowerCase()===q.toLowerCase());
 return {venue,q:(alias?.[0]||q).toUpperCase().replace(/\s/g,'').replace('-', '/')};
}
async function search(query){
 const {venue,q}=parseQuery(query),errors=[];
 const groups=await Promise.all(Object.keys(venues).filter(id=>!venue||venue===id).map(async id=>{
  try{
   const ex=await exchange(id);
   return Object.values(ex.markets).filter(m=>m.spot&&m.active!==false&&['USD','USDT','USDC'].includes(m.quote)&&(q.includes('/')?m.symbol===q:m.base===q||(names[m.base]||'').toUpperCase().startsWith(q)))
    .sort((a,b)=>['USD','USDT','USDC'].indexOf(a.quote)-['USD','USDT','USDC'].indexOf(b.quote)).slice(0,5).map(m=>pair(ex,m));
  }catch(error){errors.push(venues[id]+': '+(error.message||'unavailable'));return [];}
 }));
 return {pairs:groups.flat().slice(0,12),errors};
}
async function snapshot(id,symbol){
 const ex=await exchange(id),m=ex.market(symbol),ticker=await ex.fetchTicker(symbol);
 const price=Number(ticker.last??ticker.close??ticker.bid??ticker.ask);
 if(!(price>0))throw Error('Exchange has not provided a current price');
 return {...pair(ex,m),priceUsd:String(price),priceNative:String(price),exchangeObservedAt:Number(ticker.timestamp)||Date.now()};
}
function emit(stream,type,value){if(subscription===stream&&!stream.closed)postMessage({stream:stream.id,type,value});}
function stop(){
 subscriptionEpoch++;requestedStream=null;const old=subscription;subscription=null;if(!old)return;
 old.closed=true;clearInterval(old.health);
 void old.ex.close().catch(()=>{});
}
async function subscribe(id,symbol,streamID){
 stop();requestedStream=streamID;const epoch=subscriptionEpoch;const cached=await exchange(id);if(epoch!==subscriptionEpoch)return false;
 const ex=make(id);ex.setMarkets(cached.markets,cached.currencies);
 const stream={id:streamID,ex,closed:false,seen:new Set(),connected:false,lastPacket:0,lastTradeAt:0,lastBookAt:0,lastBookEmit:0,retry:0};subscription=stream;
 const status=(connected,message)=>{stream.connected=connected;emit(stream,'status',{connected,kind:'exchange',message:venues[id]+' · '+message});};
 status(false,'connecting to live trades…');
 stream.health=setInterval(()=>{
  const clients=Object.values(ex.clients||{}),open=clients.some(client=>client.connection?.readyState===1);
  if(stream.connected&&(!open||Date.now()-stream.lastPacket>45000))status(false,open?'stream quiet · waiting for fresh data':'disconnected · reconnecting');
 },3000);
 async function trades(){
  let baseline=Date.now(),failed=0;
  while(!stream.closed){
   try{
    const list=await ex.watchTrades(symbol);if(stream.closed)break;
    const now=Date.now();stream.lastPacket=now;failed=0;status(true,'live trades');
    const events=[];
    for(const trade of [...list].sort((a,b)=>a.timestamp-b.timestamp)){
     const at=Number(trade.timestamp),price=Number(trade.price),amount=Number(trade.amount);
     if(!Number.isFinite(at)||!(price>0)||!(amount>0))continue;
     const key=String(trade.id??[at,price,amount,trade.side].join(':'));
     if(stream.seen.has(key))continue;stream.seen.add(key);if(stream.seen.size>10000)stream.seen.delete(stream.seen.values().next().value);
     // Ignore subscription snapshots/backlogs. A recovered connection begins
     // with fresh events; missed trades are not invented or replayed as live.
     if(trade.info?.type==='last_match'||at<baseline||now-at>10000||at>now+5000)continue;
     const uid='ccxt:'+id+':'+symbol+':'+key;
     events.push({kind:'swap',source:'ccxt',protocol:id,id:uid,signature:uid,receivedAt:now,occurredAt:at,precision:'exchange-timestamp',priceQuote:price,priceUsd:price,quoteAmount:price*amount,usdVolume:price*amount,baseAmount:amount,side:['buy','sell'].includes(trade.side)?trade.side:'unknown'});
     stream.lastTradeAt=Math.max(stream.lastTradeAt,at);
    }
    if(events.length)emit(stream,'trades',events);
   }catch(error){
    if(stream.closed)break;
    status(false,'trade stream unavailable · retrying');failed++;
    await new Promise(resolve=>setTimeout(resolve,Math.min(15000,1000*2**Math.min(failed,4))));baseline=Date.now();
   }
  }
 }
 async function book(){
  if(!ex.has.watchOrderBook&&!ex.has.fetchOrderBook)return;
  while(!stream.closed){
   try{
    // CCXT's Coinbase level2 subscription requires credentials; use its
    // public REST book without attempting authenticated channels.
    const polled=id==='coinbaseexchange';
    const orderbook=polled?await ex.fetchOrderBook(symbol):await ex.watchOrderBook(symbol,id==='kraken'?25:20);if(stream.closed)break;
    const now=Date.now();stream.lastPacket=now;stream.lastBookAt=now;
    if(now-stream.lastBookEmit<150)continue;stream.lastBookEmit=now;
    const bid=Number(orderbook.bids?.[0]?.[0]),ask=Number(orderbook.asks?.[0]?.[0]),mid=(bid+ask)/2;
    if(!(bid>0&&ask>=bid))continue;
    const total=levels=>levels.slice(0,25).reduce((sum,[price,amount])=>Math.abs(price/mid-1)<=.01?sum+Number(price)*Number(amount):sum,0);
    const buys=total(orderbook.bids),sells=total(orderbook.asks),depth=buys+sells;
    emit(stream,'book',{at:now,bid,ask,depth,balance:depth>0?buys/depth:.5,levels:25,polling:polled});
    if(polled)await new Promise(resolve=>setTimeout(resolve,5000));
   }catch(error){if(stream.closed)break;emit(stream,'book',{at:0,depth:null,balance:null});await new Promise(resolve=>setTimeout(resolve,5000));}
  }
 }
 void trades();void book();return true;
}
async function history({id,symbol,timeframe='1m',until,limit=300}){
 const ex=await exchange(id),seconds=ex.parseTimeframe(timeframe);
 let frame=timeframe;
 if(!ex.timeframes?.[frame]){
  frame=Object.keys(ex.timeframes||{}).filter(t=>seconds%ex.parseTimeframe(t)===0&&ex.parseTimeframe(t)<=seconds).sort((a,b)=>ex.parseTimeframe(b)-ex.parseTimeframe(a))[0];
  if(!frame)throw Error('This exchange does not provide the selected timeframe');
 }
 const interval=ex.parseTimeframe(frame)*1000,count=Math.min(300,Math.max(1,Number(limit)||300));
 const end=Number(until)||Date.now(),since=Math.max(0,end-count*interval);
 const params=id==='binance'?{endTime:end}:id==='coinbaseexchange'?{until:end}:{};
 const observedAt=Date.now(),rows=await ex.fetchOHLCV(symbol,frame,since,count,params);
 return {rows,interval,observedAt};
}
self.onmessage=async({data})=>{
 const {id,method,args=[]}=data||{};
 try{
  let result;
  if(method==='search')result=await search(...args);
  else if(method==='snapshot')result=await snapshot(...args);
  else if(method==='history')result=await history(...args);
  else if(method==='subscribe')result=await subscribe(...args);
  else if(method==='stop'){if(!args[0]||requestedStream===args[0]||subscription?.id===args[0])stop();result=true;}
  else throw Error('Unknown public data operation');
  postMessage({id,result});
 }catch(error){postMessage({id,error:String(error.message||error).slice(0,300)});}
};
