// Robinhood's public HTTP RPC: direct block observations, not a WebSocket feed.
// Deployments: https://developers.uniswap.org/docs/protocols/v4/deployments
const RPC='https://rpc.mainnet.chain.robinhood.com';
const MANAGER='0x8366a39cc670b4001a1121b8f6a443a643e40951',STATE='0xf3334192d15450cdd385c8b70e03f9a6bd9e673b';
const INITIALIZE='0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438';
const SWAP='0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f';
const ZERO='0x0000000000000000000000000000000000000000';
const hex=n=>'0x'+n.toString(16),signed=n=>n>=(1n<<255n)?n-(1n<<256n):n;
function words(data){return /^0x(?:[0-9a-f]{64})+$/i.test(data||'')?data.slice(2).match(/.{64}/g).map(w=>BigInt('0x'+w)):[];}
function spot(sqrt,meta){const ratio=(Number(sqrt)/2**96)**2*10**(meta.dec0-meta.dec1);return meta.baseIs0?ratio:1/ratio;}
export function decodeV4Swap(log,meta,pool){
 if(log.address?.toLowerCase()!==MANAGER||log.topics?.[0]!==SWAP||log.topics?.[1]?.toLowerCase()!==pool.toLowerCase())return null;
 const data=words(log.data);if(data.length!==6)return null;
 const a=signed(data[0]),b=signed(data[1]);if(!a||!b||(a>0n)===(b>0n))return null;
 const base=meta.baseIs0?a:b,quote=meta.baseIs0?b:a;
 const baseAmount=Math.abs(Number(base))/10**meta.baseDecimals,quoteAmount=Math.abs(Number(quote))/10**meta.quoteDecimals,spotQuote=spot(data[2],meta);
 if(!(baseAmount>0&&quoteAmount>0&&spotQuote>0&&Number.isFinite(spotQuote)))return null;
 // v4 balance deltas describe the caller: positive base is a buy.
 return {kind:'swap',source:'rpc',protocol:'v4',baseAmount,quoteAmount,priceQuote:quoteAmount/baseAmount,spotQuote,side:base>0n?'buy':'sell'};
}
export function subscribeRobinhoodV4(market,onEvent,onState){
 let closed=false,timer,meta,cursor,initialHead,failures=0,lastState=0;const controllers=new Set(),seen=new Set(),blockTimes=new Map();
 const pool=market.pairAddress.toLowerCase();
 function state(connected,message){if(!closed)onState({connected,kind:connected?'rpc-poll':'snapshot',message});}
 async function rpc(method,params){
  const controller=new AbortController();controllers.add(controller);const timeout=setTimeout(()=>controller.abort(),12000);
  try{const r=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:controller.signal});if(!r.ok)throw Error('Robinhood RPC HTTP '+r.status);const data=await r.json();if(data.error)throw Error(data.error.message);return data.result;}
  finally{clearTimeout(timeout);controllers.delete(controller);}
 }
 function blockTime(block){
  if(!blockTimes.has(block)){blockTimes.set(block,rpc('eth_getBlockByNumber',[block,false]).then(b=>Number(BigInt(b.timestamp))*1000));if(blockTimes.size>128)blockTimes.delete(blockTimes.keys().next().value);}
  return blockTimes.get(block);
 }
 async function priceAt(block){
  const data=words(await rpc('eth_call',[{to:STATE,data:'0xc815641c'+pool.slice(2)},block]));
  if(data.length!==4||data[0]===0n)throw Error('Uniswap v4 pool state unavailable');
  const priceQuote=spot(data[0],meta);if(!(priceQuote>0&&Number.isFinite(priceQuote)))throw Error('Invalid v4 pool price');
  const occurredAt=await blockTime(block);if(closed)return;
  onEvent({kind:'market-price',source:'rpc-state',protocol:'v4',priceQuote,block:Number(BigInt(block)),occurredAt,receivedAt:Date.now()});lastState=Date.now();
 }
 async function boot(){
  state(false,'Connecting · Robinhood / Uniswap v4 direct RPC');
  try{
   if(!/^0x[0-9a-f]{64}$/.test(pool))throw Error('Selected market is not a v4 pool identifier');
   const [chain,headHex]=await Promise.all([rpc('eth_chainId',[]),rpc('eth_blockNumber',[])]);if(Number(BigInt(chain))!==4663)throw Error('Unexpected Robinhood RPC chain');
   const head=Number(BigInt(headHex));let initialization;
   // The provider permits at most ten million blocks per log query.
   for(let end=head,page=0;end>=0&&page<8&&!initialization;page++){
    if(closed)return;const start=Math.max(0,end-9999999);
    const logs=await rpc('eth_getLogs',[{address:MANAGER,topics:[INITIALIZE,pool],fromBlock:hex(start),toBlock:hex(end)}]);
    initialization=logs.find(l=>!l.removed&&l.topics?.length===4);end=start-1;
   }
   if(!initialization)throw Error('Pool initialization not found within supported lookback');
   const token0='0x'+initialization.topics[2].slice(-40).toLowerCase(),token1='0x'+initialization.topics[3].slice(-40).toLowerCase();
   const base=market.baseToken.address.toLowerCase(),quote=market.quoteToken.address.toLowerCase();
   if(!((base===token0&&quote===token1)||(base===token1&&quote===token0)))throw Error('v4 initialization tokens do not match selected market');
   const decimals=async token=>token===ZERO?18:Number(BigInt(await rpc('eth_call',[{to:token,data:'0x313ce567'},headHex])));
   const [dec0,dec1]=await Promise.all([decimals(token0),decimals(token1)]);if(![dec0,dec1].every(d=>Number.isInteger(d)&&d>=0&&d<=36))throw Error('Unsupported v4 currency decimals');
   meta={dec0,dec1,baseIs0:base===token0,baseDecimals:base===token0?dec0:dec1,quoteDecimals:base===token0?dec1:dec0};
   cursor=head;initialHead=head;await priceAt(headHex);if(closed)return;
   state(true,'Connected · Robinhood / Uniswap v4 · direct RPC polling ≥2s');failures=0;poll();
  }catch(error){if(closed)return;state(false,error.message+' · indexed fallback active');timer=setTimeout(boot,Math.min(60000,5000*2**Math.min(failures++,4)));}
 }
 async function poll(){
  if(closed)return;let delay=2000;
  try{
   const head=Number(BigInt(await rpc('eth_blockNumber',[]))),end=Math.min(head,cursor+10000);
   const start=Math.max(0,Math.min(cursor,head)-64);
   const logs=await rpc('eth_getLogs',[{address:MANAGER,topics:[SWAP,pool],fromBlock:hex(start),toBlock:hex(end)}]);
   if(closed)return;let fresh=false;
   for(const log of logs.sort((a,b)=>Number(BigInt(a.blockNumber)-BigInt(b.blockNumber))||Number(BigInt(a.logIndex)-BigInt(b.logIndex)))){
    const id=log.transactionHash+':'+log.logIndex;
    if(log.removed){seen.delete(id);onEvent({id,removed:true,receivedAt:Date.now()});continue;}
    if(seen.has(id)||Number(BigInt(log.blockNumber))<=initialHead)continue;
    const trade=decodeV4Swap(log,meta,pool);if(!trade)continue;
    seen.add(id);if(seen.size>4096)seen.delete(seen.values().next().value);fresh=true;
    const receivedAt=Date.now();onEvent({...trade,id,signature:log.transactionHash,block:Number(BigInt(log.blockNumber)),receivedAt});
    blockTime(log.blockNumber).then(occurredAt=>{if(!closed)onEvent({kind:'timing',id,occurredAt,receivedAt,precision:'block-timestamp'});}).catch(()=>{});
   }
   cursor=end;if(!fresh&&Date.now()-lastState>=10000)await priceAt(hex(head));
   if(closed)return;failures=0;state(true,'Connected · Robinhood / Uniswap v4 · direct RPC polling ≥2s');if(end<head)delay=0;
  }catch(error){if(closed)return;delay=Math.min(60000,5000*2**Math.min(failures++,4));state(false,error.message+' · RPC retry '+delay/1000+'s · indexed fallback active');}
  if(!closed)timer=setTimeout(poll,delay);
 }
 boot();return()=>{closed=true;clearTimeout(timer);for(const controller of controllers)controller.abort();};
}
