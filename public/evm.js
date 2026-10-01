// Standard Uniswap V2/V3 pool events; fork-specific ABIs use snapshot fallback.
export const EVM_RPC={
 ethereum:'ethereum-rpc',base:'base-rpc',bsc:'bsc-rpc',arbitrum:'arbitrum-one-rpc',
 polygon:'polygon-bor-rpc',optimism:'optimism-rpc',avalanche:'avalanche-c-chain-rpc'
};
const V2='0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
const V3='0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
const isAddress=s=>/^0x[0-9a-f]{40}$/i.test(s||'');
const signed=x=>x>=(1n<<255n)?x-(1n<<256n):x;
export function decodeSwap(log,meta){
 if(!/^0x(?:[0-9a-f]{64})+$/i.test(log.data||''))return null;
 const words=log.data.slice(2).match(/.{64}/g).map(x=>BigInt('0x'+x));
 let a,b;
 if(log.topics?.[0]===V2&&words.length===4){a=words[0]-words[2];b=words[1]-words[3];}
 else if(log.topics?.[0]===V3&&words.length===5){a=signed(words[0]);b=signed(words[1]);}
 else return null;
 // Exclude zero-sided or same-direction movements, not ordinary two-token swaps.
 if(a===0n||b===0n||(a>0n)===(b>0n))return null;
 const baseDelta=meta.baseIs0?a:b,quoteDelta=meta.baseIs0?b:a;
 const baseAmount=Math.abs(Number(baseDelta))/10**meta.baseDecimals;
 const quoteAmount=Math.abs(Number(quoteDelta))/10**meta.quoteDecimals;
 const priceQuote=quoteAmount/baseAmount;
 if(!Number.isFinite(priceQuote)||priceQuote<=0||!Number.isFinite(baseAmount))return null;
 return {priceQuote,baseAmount,quoteAmount,side:baseDelta<0n?'buy':'sell',protocol:log.topics[0]===V2?'v2':'v3'};
}
export function subscribeEvm(market,onEvent,onState){
 const host=EVM_RPC[market.chainId];
 if(!host||!isAddress(market.pairAddress)){
  onState({connected:false,kind:'snapshot',message:'Snapshot feed · no direct pool decoder for this market'});return()=>{};
 }
 let closed=false,socket,retry,attempt=0;const seen=new Set();
 function connect(){
  if(closed)return;onState({connected:false,kind:'snapshot',message:'Connecting · '+market.chainId+' / PublicNode'});
  const ws=new WebSocket('wss://'+host+'.publicnode.com');socket=ws;
  let nextId=10,lastMessage=Date.now(),meta=null,ready=false,failure='',heartbeat;
  const pending=new Map(),buffer=[];
  const openTimeout=setTimeout(()=>{failure='Connection timed out';ws.close();},15000);
  function request(method,params){return new Promise((resolve,reject)=>{
   const id=nextId++;const timeout=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},10000);
   pending.set(id,{resolve,reject,timeout});ws.send(JSON.stringify({jsonrpc:'2.0',id,method,params}));
  });}
  async function call(to,data){return request('eth_call',[{to,data},'latest']);}
  function receive(log){
   const id=log.transactionHash+':'+log.logIndex;
   if(log.removed){seen.delete(id);onEvent({id,removed:true,receivedAt:Date.now()});return;}
   if(seen.has(id))return;const trade=decodeSwap(log,meta);if(!trade)return;
   seen.add(id);if(seen.size>4096)seen.delete(seen.values().next().value);
   onState({connected:true,kind:'swap',message:'Connected · '+market.chainId+' · decoded '+trade.protocol.toUpperCase()+' swaps'});
   onEvent({...trade,id,signature:log.transactionHash,block:Number(BigInt(log.blockNumber)),receivedAt:Date.now(),kind:'swap'});
  }
  ws.onopen=async()=>{
   lastMessage=Date.now();heartbeat=setInterval(()=>{
    // Request/response heartbeat works even on slow chains and quiet pools.
    if(Date.now()-lastMessage>35000){failure='Heartbeat lost';ws.close();return;}
    if(ready)request('eth_blockNumber',[]).catch(()=>{failure='Heartbeat failed';ws.close();});
   },15000);
   try{
    const [token0Raw,token1Raw]=await Promise.all([call(market.pairAddress,'0x0dfe1681'),call(market.pairAddress,'0xd21220a7')]);
    const token0=('0x'+token0Raw.slice(-40)).toLowerCase(),token1=('0x'+token1Raw.slice(-40)).toLowerCase();
    const base=market.baseToken.address.toLowerCase(),quote=market.quoteToken.address.toLowerCase();
    if(!isAddress(token0)||!isAddress(token1)||!((token0===base&&token1===quote)||(token1===base&&token0===quote)))throw Error('Pool token metadata does not match this market');
    const [d0,d1]=await Promise.all([call(token0,'0x313ce567'),call(token1,'0x313ce567')]);
    const dec0=Number(BigInt(d0)),dec1=Number(BigInt(d1));
    if(!Number.isInteger(dec0)||!Number.isInteger(dec1)||dec0>36||dec1>36)throw Error('Unsupported token decimals');
    meta={baseIs0:token0===base,baseDecimals:token0===base?dec0:dec1,quoteDecimals:token0===base?dec1:dec0};
    await request('eth_subscribe',['logs',{address:market.pairAddress,topics:[[V2,V3]]}]);
    if(closed)return;ready=true;clearTimeout(openTimeout);attempt=0;
    onState({connected:true,kind:'waiting',message:'Connected · '+market.chainId+' · awaiting supported swap; snapshots active'});
    for(const log of buffer)receive(log);buffer.length=0;
   }catch(error){if(closed)return;failure=error.message;ws.close();}
  };
  ws.onmessage=message=>{
   if(closed)return;lastMessage=Date.now();let data;try{data=JSON.parse(message.data);}catch{return;}
   if(pending.has(data.id)){const p=pending.get(data.id);pending.delete(data.id);clearTimeout(p.timeout);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);return;}
   if(data.method!=='eth_subscription'||!data.params?.result)return;
   const log=data.params.result;if(!meta||!ready){if(buffer.length<256)buffer.push(log);}else receive(log);
  };
  ws.onerror=()=>{failure='PublicNode connection failed';};
  ws.onclose=event=>{
   clearTimeout(openTimeout);clearInterval(heartbeat);
   for(const p of pending.values()){clearTimeout(p.timeout);p.reject(Error('Connection closed'));}pending.clear();
   if(closed)return;const delay=Math.min(60000,2000*2**Math.min(attempt++,5));
   onState({connected:false,kind:'snapshot',message:(failure||'Stream closed ('+event.code+')')+' · snapshots · retry '+delay/1000+'s'});
   retry=setTimeout(connect,delay);
  };
 }
 connect();return()=>{closed=true;clearTimeout(retry);socket?.close();};
}
