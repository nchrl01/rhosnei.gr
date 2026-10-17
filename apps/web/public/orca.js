// Orca Whirlpool's public account and Traded event layouts.
// https://github.com/orca-so/whirlpools/tree/main/programs/whirlpool/src
const metadataCache=new Map();
const PROGRAM='whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
const POOL_DISC=[63,149,209,12,225,128,99,9],TRADE_DISC=[225,202,73,175,147,43,160,150];
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const matches=(data,disc)=>disc.every((b,i)=>data[i]===b);
function base58(data){let n=0n;for(const b of data)n=n*256n+BigInt(b);let out='';while(n){out=alphabet[Number(n%58n)]+out;n/=58n;}for(const b of data){if(b!==0)break;out='1'+out;}return out;}
function uint(data,offset,length){let n=0n;for(let i=length-1;i>=0;i--)n=(n<<8n)+BigInt(data[offset+i]);return n;}
export function decodeOrcaTrade(data,meta,pool){
 if(data.length!==121||!matches(data,TRADE_DISC)||base58(data.slice(8,40))!==pool||data[40]>1)return null;
 const aToB=data[40]===1,input=Number(uint(data,73,8)),output=Number(uint(data,81,8));
 const a=(aToB?input:output)/10**meta.decA,b=(aToB?output:input)/10**meta.decB;
 const baseAmount=meta.baseIsA?a:b,quoteAmount=meta.baseIsA?b:a;
 const sqrt=Number(uint(data,57,16))/2**64,raw=sqrt*sqrt*10**(meta.decA-meta.decB);
 const spotQuote=meta.baseIsA?raw:1/raw,priceQuote=quoteAmount/baseAmount;
 if(!(baseAmount>0&&quoteAmount>0&&spotQuote>0&&Number.isFinite(spotQuote)&&Number.isFinite(priceQuote)))return null;
 return {kind:'swap',source:'rpc',protocol:'orca',baseAmount,quoteAmount,priceQuote,spotQuote,side:meta.baseIsA===aToB?'sell':'buy'};
}
export function subscribeOrca(market,onEvent,onState){
 let closed=false,socket,timer,abort,attempt=0;const seen=new Set();
 const notify=(connected,kind,message)=>{if(!closed)onState({connected,kind,message});};
 async function rpc(method,params){
  const response=await fetch('https://solana-rpc.publicnode.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:abort.signal});
  if(!response.ok)throw Error('Solana metadata HTTP '+response.status);const data=await response.json();if(data.error)throw Error(data.error.message);return data.result;
 }
 function retry(reason){if(closed)return;const delay=Math.min(60000,2000*2**Math.min(attempt++,5));notify(false,'snapshot',reason+' · Orca retry '+delay/1000+'s · fallback active');timer=setTimeout(connect,delay);}
 function connect(){
  if(closed)return;notify(false,'snapshot','Connecting · Orca confirmed swaps / PublicNode');
  abort=new AbortController();const controller=abort;
  const metadataTimeout=setTimeout(()=>controller.abort(),15000);
  const key=market.pairAddress+':'+market.baseToken.address+':'+market.quoteToken.address;
  // Start metadata and the subscription handshake concurrently.
  const metadata=(async()=>{
   const cached=metadataCache.get(key);if(cached&&Date.now()-cached.saved<3600000)return cached.value;
   const result=await rpc('getAccountInfo',[market.pairAddress,{encoding:'base64',commitment:'confirmed'}]);
   const account=result?.value;if(account?.owner!==PROGRAM||!Array.isArray(account.data))throw Error('Selected Orca pool is not a supported Whirlpool');
   const data=bytes(account.data[0]);if(data.length!==653||!matches(data,POOL_DISC))throw Error('Unsupported Whirlpool account layout');
   const mintA=base58(data.slice(101,133)),mintB=base58(data.slice(181,213));
   if(!((mintA===market.baseToken.address&&mintB===market.quoteToken.address)||(mintB===market.baseToken.address&&mintA===market.quoteToken.address)))throw Error('Whirlpool token metadata mismatch');
   const mints=await rpc('getMultipleAccounts',[[mintA,mintB],{encoding:'jsonParsed',commitment:'confirmed'}]);
   const decA=mints?.value?.[0]?.data?.parsed?.info?.decimals,decB=mints?.value?.[1]?.data?.parsed?.info?.decimals;
   if(![decA,decB].every(d=>Number.isInteger(d)&&d>=0&&d<=18))throw Error('Whirlpool mint decimals unavailable');
   const value={decA,decB,baseIsA:mintA===market.baseToken.address};
   metadataCache.set(key,{saved:Date.now(),value});if(metadataCache.size>128)metadataCache.delete(metadataCache.keys().next().value);
   return value;
  })();
  const ws=new WebSocket('wss://solana-rpc.publicnode.com');socket=ws;
  let failure='',heartbeat,lastMessage=Date.now(),ready=false,meta=null;const buffer=[];
  const opening=setTimeout(()=>{failure='Orca subscription timed out';ws.close();},15000);
  function receive(result,receivedAt){
   const value=result?.value;if(!value||value.err||seen.has(value.signature))return;
   const trades=[],stack=[];
   for(const [index,log] of (value.logs||[]).entries()){
    const invoke=/^Program (\w+) invoke \[\d+\]$/.exec(log);if(invoke){stack.push(invoke[1]);continue;}
    if(/^Program \w+ (success|failed:)/.test(log)){stack.pop();continue;}
    if(stack.at(-1)!==PROGRAM||!log.startsWith('Program data: '))continue;
    try{const trade=decodeOrcaTrade(bytes(log.slice(14)),meta,market.pairAddress);if(trade)trades.push({...trade,id:value.signature+':'+index,signature:value.signature,block:result.context.slot,receivedAt});}catch{}
   }
   if(!trades.length)return;seen.add(value.signature);if(seen.size>4096)seen.delete(seen.values().next().value);
   notify(true,'swap','Connected · Solana / Orca · confirmed decoded swaps');
   for(const trade of trades)onEvent(trade);
  }
  function connected(){
   if(!ready||!meta||closed||socket!==ws||ws.readyState!==WebSocket.OPEN)return;
   attempt=0;notify(true,'waiting','Connected · Orca · awaiting decoded swap; fallback active');
   for(const item of buffer)receive(item.result,item.receivedAt);buffer.length=0;
  }
  metadata.then(value=>{if(closed||socket!==ws||ws.readyState>=WebSocket.CLOSING)return;meta=value;connected();},error=>{if(closed||socket!==ws||ws.readyState>=WebSocket.CLOSING)return;failure=error.message;ws.close();}).finally(()=>clearTimeout(metadataTimeout));
  ws.onopen=()=>{
   ws.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'logsSubscribe',params:[{mentions:[market.pairAddress]},{commitment:'confirmed'}]}));
   ws.send(JSON.stringify({jsonrpc:'2.0',id:2,method:'slotSubscribe'}));
   heartbeat=setInterval(()=>{if(Date.now()-lastMessage>30000){failure='Orca stream heartbeat lost';ws.close();}},5000);
  };
  ws.onmessage=message=>{
   if(closed||socket!==ws)return;lastMessage=Date.now();let data;try{data=JSON.parse(message.data);}catch{return;}
   if(data.error){failure=data.error.message;ws.close();return;}
   if(data.id===1){clearTimeout(opening);ready=true;connected();return;}
   if(data.method!=='logsNotification'||!ready)return;
   const result=data.params?.result,receivedAt=Date.now();
   if(!meta){if(buffer.length<512)buffer.push({result,receivedAt});return;}
   receive(result,receivedAt);
  };
  ws.onerror=()=>{failure='Orca PublicNode connection failed';};
  ws.onclose=()=>{clearTimeout(opening);clearTimeout(metadataTimeout);clearInterval(heartbeat);controller.abort();if(socket===ws)retry(failure||'Orca stream closed');};
 }
 connect();return()=>{closed=true;clearTimeout(timer);abort?.abort();socket?.close();};
}
