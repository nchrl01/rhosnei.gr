// Open Solana JSON-RPC protocol; no proprietary SDK or API key.
export function subscribePool(address,onEvent,onStatus){
 let socket,timer,closed=false,attempt=0;const seen=new Set();
 function connect(){
  if(closed)return;onStatus('Connecting to public Solana RPC…');
  socket=new WebSocket('wss://api.mainnet-beta.solana.com');
  const timeout=setTimeout(()=>socket.close(),12000);
  socket.onopen=()=>{socket.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'logsSubscribe',params:[{mentions:[address]},{commitment:'confirmed'}]}));};
  socket.onmessage=message=>{
   if(closed)return;
   let data;try{data=JSON.parse(message.data);}catch{return;}
   if(data.id===1){clearTimeout(timeout);if(data.error){onStatus('RPC subscription rejected · snapshot fallback');socket.close();return;}attempt=0;onStatus('Connected · confirmed pool activity');}
   const result=data.params?.result,value=result?.value;
   if(data.method!=='logsNotification'||!value||value.err||seen.has(value.signature))return;
   seen.add(value.signature);if(seen.size>512)seen.delete(seen.values().next().value);
   onEvent({signature:value.signature,slot:result.context.slot,receivedAt:Date.now(),kind:'pool-transaction'});
  };
  socket.onerror=()=>onStatus('Public RPC unavailable · snapshot fallback');
  socket.onclose=()=>{clearTimeout(timeout);if(closed)return;onStatus('Stream disconnected · retrying; using snapshots');timer=setTimeout(connect,Math.min(60000,2000*2**attempt++));};
 }
 connect();return()=>{closed=true;clearTimeout(timer);socket?.close();};
}
