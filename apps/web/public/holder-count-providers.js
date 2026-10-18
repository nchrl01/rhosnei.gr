// Free provider snapshots. Coverage is provider-dependent; never infer holders from trades.
export const HOLDER_NETWORKS={eth:'1',bsc:'56',arbitrum:'42161',polygon_pos:'137',base:'8453',optimism:'10',avax:'43114',cro:'25',gnosis:'100',opbnb:'204',zksync:'324',linea:'59144',mantle:'5000',unichain:'130',zircuit:'48900',scroll:'534352',kcc:'321',robinhood:'4663',conflux:'1030',plasma:'9745',monad:'143',soneium:'1868',story:'1514',sonic:'146',abstract:'2741',berachain:'80094',worldchain:'480',morph:'2818',gravity:'1625',xlayer:'196',blast:'81457',manta:'169'};
export function countValue(raw){if(!['number','string'].includes(typeof raw)||String(raw).trim()==='')return null;const count=Number(raw);return Number.isSafeInteger(count)&&count>=0?count:null;}
export async function fetchHolderCount(network,address){
 let reason='unavailable',image_url=null;
 try{
  const response=await fetch('https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(network)+'/tokens/'+encodeURIComponent(address)+'/info',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(response.ok){
   const body=await response.json(),info=body.data?.attributes,count=countValue(info?.holders?.count);image_url=info?.image_url||null;
   if(count!==null)return {state:'snapshot',holders:count,lastUpdated:info.holders.last_updated||null,image_url,source:'GeckoTerminal',approximate:false,fetchedAt:Date.now()};
  }else if(response.status===429)reason='rate-limited';
 }catch{}
 return fetchGoPlusCount(network,address,{image_url,reason});
}

export async function fetchGoPlusCount(network,address,{image_url=null,reason='unavailable',signal}={}){
 const chain=HOLDER_NETWORKS[network],solana=network==='solana';
 if(!solana&&!chain)return {state:reason,holders:null};
 if(!solana&&!/^0x[0-9a-f]{40}$/i.test(address))return {state:'unavailable',holders:null};
 try{
  const path=solana?'solana/token_security':'token_security/'+chain;
  const response=await fetch('https://api.gopluslabs.io/api/v1/'+path+'?'+new URLSearchParams({contract_addresses:address}),{headers:{Accept:'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000),credentials:'omit'});
  if(response.ok){
   const body=await response.json(),row=body.result?.[address]||body.result?.[address.toLowerCase()],count=[1,2].includes(body.code)?countValue(row?.holder_count):null;
   reason=body.code===4029?'rate-limited':[1,2].includes(body.code)?'unavailable':'goplus-code-'+String(body.code);
   // Some unsupported GoPlus tokens report zero; do not present that as a verified total.
   if(count!==null&&count>0)return {state:'snapshot',holders:count,lastUpdated:null,image_url,source:'GoPlus',approximate:true,fetchedAt:Date.now()};
  }else reason=response.status===429?'rate-limited':'goplus-http-'+response.status;
 }catch{reason='goplus-unavailable';}
 return {state:reason,holders:null};
}
