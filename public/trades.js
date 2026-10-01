// Free REST trade observations across GeckoTerminal-indexed networks.
// HTTP polling is explicitly reported; this is not a WebSocket trade stream.
const networkAlias={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',arbitrum:'arbitrum',cronos:'cro',zksync:'zksync',pulsechain:'pulsechain'};
const same=(a,b)=>/^0x[0-9a-f]{40}$/i.test(a||'')?a.toLowerCase()===b?.toLowerCase():a===b;
export function pollPoolTrades(market,onEvent,onState){
 let closed=false,timer,controller,initialized=false,hasTrades=false,failures=0;const seen=new Set();
 const network=networkAlias[market.chainId]||market.chainId;
 const url='https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(network)+'/pools/'+encodeURIComponent(market.pairAddress)+'/trades';
 async function poll(){
  if(closed)return;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);let delay=5000;
  try{
   const response=await fetch(url,{signal:controller.signal});
   if(!response.ok){if(response.status===404){onState({connected:false,kind:'snapshot',message:'Pool not indexed by free trade provider · snapshots active'});closed=true;return;}if(response.status===429)delay=Math.max(30000,Number(response.headers.get('Retry-After'))*1000||0);throw Error('Trade provider HTTP '+response.status);}
   const data=await response.json();if(closed)return;if(!Array.isArray(data.data))throw Error('Unexpected trade response');
   const ordered=data.data.slice().sort((a,b)=>Date.parse(a.attributes?.block_timestamp)-Date.parse(b.attributes?.block_timestamp));
   if(!initialized){for(const item of ordered)seen.add(item.id);initialized=true;onState({connected:true,kind:'waiting',message:'Trade polling ready · 5s · awaiting new trades; snapshots active'});}
   else{
    for(const item of ordered){
     if(typeof item.id!=='string'||seen.has(item.id))continue;seen.add(item.id);if(seen.size>4096)seen.delete(seen.values().next().value);
     const a=item.attributes||{},baseFrom=same(a.from_token_address,market.baseToken.address),baseTo=same(a.to_token_address,market.baseToken.address);
     if(!baseFrom&&!baseTo)continue;
     const other=baseFrom?a.to_token_address:a.from_token_address;if(!same(other,market.quoteToken.address))continue;
     const baseAmount=Number(baseFrom?a.from_token_amount:a.to_token_amount),quoteAmount=Number(baseFrom?a.to_token_amount:a.from_token_amount);
     const priceUsd=Number(baseFrom?a.price_from_in_usd:a.price_to_in_usd),usdVolume=Number(a.volume_in_usd);
     if(!(baseAmount>0&&quoteAmount>0&&priceUsd>0&&Number.isFinite(priceUsd)&&Number.isFinite(usdVolume)))continue;
     hasTrades=true;onState({connected:true,kind:'trade-poll',message:'Connected · GeckoTerminal trades · 5s HTTP polling'});
     onEvent({id:item.id,signature:a.tx_hash,kind:'swap',source:'gecko',side:baseTo?'buy':'sell',baseAmount,quoteAmount,priceQuote:quoteAmount/baseAmount,priceUsd,usdVolume,block:a.block_number,occurredAt:Date.parse(a.block_timestamp),receivedAt:Date.now()});
    }
    onState({connected:true,kind:hasTrades?'trade-poll':'waiting',message:hasTrades?'Connected · GeckoTerminal trades · 5s HTTP polling':'Trade polling ready · awaiting new trades; snapshots active'});
   }
   failures=0;
  }catch(error){if(closed)return;delay=Math.max(delay,Math.min(60000,5000*2**Math.min(failures++,4)));onState({connected:false,kind:'snapshot',message:error.message+' · trade retry '+delay/1000+'s · snapshots active'});}
  finally{clearTimeout(timeout);if(!closed)timer=setTimeout(poll,delay);}
 }
 onState({connected:false,kind:'snapshot',message:'Connecting to free multi-chain trade feed…'});poll();
 return()=>{closed=true;clearTimeout(timer);controller?.abort();};
}
