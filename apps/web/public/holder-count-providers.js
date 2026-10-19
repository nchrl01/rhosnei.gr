import {fetchTonHolders,tonAddress} from './ton-holders.js?v=350';
// Free provider snapshots. Coverage is provider-dependent; never infer holders from trades.
export const HOLDER_NETWORKS={eth:'1',bsc:'56',arbitrum:'42161',polygon_pos:'137',base:'8453',optimism:'10',avax:'43114',cro:'25',gnosis:'100',opbnb:'204',zksync:'324',linea:'59144',mantle:'5000',unichain:'130',zircuit:'48900',scroll:'534352',kcc:'321',robinhood:'4663',conflux:'1030',plasma:'9745',monad:'143',soneium:'1868',story:'1514',sonic:'146',abstract:'2741',berachain:'80094',worldchain:'480',morph:'2818',gravity:'1625',xlayer:'196',blast:'81457',manta:'169','manta-pacific':'169',tron:'tron',sui:'sui',ton:'ton'};
export function validHolderToken(network,address){
 if(network==='ton')return Boolean(tonAddress(address));
 if(network==='solana')return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address||'');
 if(network==='tron')return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address||'');
 if(network==='sui')return /^0x[0-9a-fA-F]{1,64}::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/.test(address||'')&&address.length<=256;
 return /^0x[0-9a-f]{40}$/i.test(address||'');
}
export function countValue(raw){if(!['number','string'].includes(typeof raw)||String(raw).trim()==='')return null;const count=Number(raw);return Number.isSafeInteger(count)&&count>=0?count:null;}
export async function fetchHolderCount(network,address,{goplusAccessToken}={}){
 let reason='unavailable',image_url=null;
 try{
  const response=await fetch('https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(network)+'/tokens/'+encodeURIComponent(address)+'/info',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(response.ok){
   const body=await response.json(),info=body.data?.attributes,count=countValue(info?.holders?.count);image_url=info?.image_url||null;
   if(count!==null)return {state:'snapshot',holders:count,lastUpdated:info.holders.last_updated||null,image_url,source:'GeckoTerminal',approximate:false,fetchedAt:Date.now()};
  }else if(response.status===429)reason='rate-limited';
 }catch{}
 return fetchGoPlusCount(network,address,{image_url,reason,goplusAccessToken});
}

// GoPlus returns token-unit balances, not raw integer base units.
export function goPlusBalances(row,solana=false,network=solana?'solana':'eth'){
 const accounts=new Map();
 for(const holder of (Array.isArray(row?.holders)?row.holders:[]).slice(0,1000)){
  const id=String(solana?holder.account:holder.address),raw=String(holder.balance??'');
  const validWallet=network==='sui'?/^0x[0-9a-fA-F]{64}$/.test(id):network==='tron'?/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(id):validHolderToken(network,id);
  if(!validWallet||!/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(raw)||raw.length>100)continue;
  const tokenBalance=Number(raw);if(!Number.isFinite(tokenBalance)||tokenBalance<=0)continue;
  const wallet=solana||network==='tron'?id:id.toLowerCase(),account=solana?String(holder.token_account||wallet):wallet;
  // Repeated token-account rows are not extra holdings. Distinct Solana
  // accounts owned by the same wallet are combined only within this sample.
  const key=wallet+':'+account,previous=accounts.get(key);
  if(!previous||previous.tokenBalance<tokenBalance)accounts.set(key,{id:wallet,tokenBalance});
 }
 const wallets=new Map();
 for(const holder of accounts.values())wallets.set(holder.id,(wallets.get(holder.id)||0)+holder.tokenBalance);
 return [...wallets].filter(([,value])=>Number.isFinite(value)).map(([id,tokenBalance])=>({id,tokenBalance}));
}

export async function fetchGoPlusCount(network,address,{image_url=null,reason='unavailable',signal,goplusAccessToken}={}){
 if(network==='ton')return fetchTonHolders(address,{signal});
 const chain=HOLDER_NETWORKS[network],solana=network==='solana';
 if(!solana&&!chain)return {state:reason,holders:null};
 if(!validHolderToken(network,address))return {state:'unavailable',holders:null};
 try{
  const path=solana?'solana/token_security':network==='sui'?'sui/token_security':'token_security/'+chain;
  const token=String(goplusAccessToken||'').trim();
  const headers={Accept:'application/json'};
  if(token)headers.Authorization=/^Bearer\s/i.test(token)?token:'Bearer '+token;
  const response=await fetch('https://api.gopluslabs.io/api/v1/'+path+'?'+new URLSearchParams({contract_addresses:address}),{headers,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000),credentials:'omit'});
  if(response.ok){
   const body=await response.json(),result=body.result||{},row=result[address]||(/^0x[0-9a-f]{40}$/i.test(address)?Object.entries(result).find(([mint])=>mint.toLowerCase()===address.toLowerCase())?.[1]:null),code=Number(body.code),count=[1,2].includes(code)?countValue(row?.holder_count):null;
   reason=code===4029?'rate-limited':[1,2].includes(code)?'unavailable':'goplus-code-'+String(body.code);
   // Some unsupported GoPlus tokens report zero; do not present that as a verified total.
   const holderBalances=[1,2].includes(code)?goPlusBalances(row,solana,network):[];
   if((count!==null&&count>0)||holderBalances.length)return {state:'snapshot',holders:count>0?count:null,holderBalances,lastUpdated:null,image_url,source:'GoPlus',approximate:true,fetchedAt:Date.now()};
  }else reason=response.status===429?'rate-limited':'goplus-http-'+response.status;
 }catch{reason='goplus-unavailable';}
 return {state:reason,holders:null};
}
