// Open Solana JSON-RPC protocol; no proprietary SDK or API key.
export function subscribePool(address,onEvent,onStatus){
 let socket,timer,closed=false,attempt=0;const seen=new Set();
 function connect(){
  if(closed)return;onStatus('Connecting to PublicNode…');
  const connection=new WebSocket('wss://solana-rpc.publicnode.com');socket=connection;
  let failure='',heartbeat,lastMessage=Date.now();
  const timeout=setTimeout(()=>{failure='Subscription timed out';connection.close();},12000);
  connection.onopen=()=>{
   connection.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'logsSubscribe',params:[{mentions:[address]},{commitment:'confirmed'}]}));
   connection.send(JSON.stringify({jsonrpc:'2.0',id:2,method:'slotSubscribe'}));
   heartbeat=setInterval(()=>{if(Date.now()-lastMessage>30000){failure='Stream heartbeat lost';connection.close();}},5000);
  };
  connection.onmessage=message=>{
   if(closed)return;
   lastMessage=Date.now();
   let data;try{data=JSON.parse(message.data);}catch{return;}
   if(data.id===1){clearTimeout(timeout);if(data.error){failure='Subscription rejected: '+data.error.message;connection.close();return;}attempt=0;onStatus('Connected · PublicNode · confirmed pool activity');}
   if(data.id===2&&data.error){failure='Heartbeat subscription rejected: '+data.error.message;connection.close();return;}
   const result=data.params?.result,value=result?.value;
   if(data.method!=='logsNotification'||!value||value.err||seen.has(value.signature))return;
   seen.add(value.signature);if(seen.size>512)seen.delete(seen.values().next().value);
   onEvent({signature:value.signature,slot:result.context.slot,receivedAt:Date.now(),kind:'pool-transaction'});
  };
  connection.onerror=()=>{failure='PublicNode connection failed';onStatus(failure+' · snapshot fallback');};
  connection.onclose=event=>{clearTimeout(timeout);clearInterval(heartbeat);if(closed)return;const delay=Math.min(60000,2000*2**Math.min(attempt++,5));onStatus((failure||'Stream closed (code '+event.code+')')+' · retry in '+delay/1000+'s · snapshots active');timer=setTimeout(connect,delay);};
 }
 connect();return()=>{closed=true;clearTimeout(timer);socket?.close();};
}
