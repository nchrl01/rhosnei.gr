import {isTokenIdentifier,rankCoinMatches} from './coin-search.js?v=327';
import {fetchGecko} from './gecko.js?v=277';
import {geckoPoolMarket} from './trending.js?v=345';

// Shared discovery and provider cooldowns for the player and marketplace.
const providerCooldowns=new Map();
export const sameToken=(a,b)=>/^0x[0-9a-f]{40}$/i.test(b||'')?a?.toLowerCase()===b.toLowerCase():a===b;
export function orientPair(pair,token){
 if(sameToken(pair.baseToken?.address,token))return {...pair,historyTokenSide:'base'};
 if(!sameToken(pair.quoteToken?.address,token))return null;
 const native=Number(pair.priceNative),usd=Number(pair.priceUsd),txns={};
 for(const [window,tx] of Object.entries(pair.txns||{}))txns[window]={buys:tx.sells,sells:tx.buys};
 return {...pair,marketCap:null,fdv:null,historyTokenSide:'quote',baseToken:pair.quoteToken,quoteToken:pair.baseToken,priceNative:native>0?String(1/native):null,priceUsd:native>0&&usd>0?String(usd/native):null,txns,priceChange:{}};
}
export async function fetchJSON(url,{signal}={}){
 const origin=new URL(url).origin,until=providerCooldowns.get(origin)||0;
 if(until>Date.now())throw Error('Market provider cooling down · '+Math.ceil((until-Date.now())/1000)+'s');
 const abort=new AbortController(),cancel=()=>abort.abort(),timeout=setTimeout(cancel,12000);
 signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 try{
  const r=await fetch(url,{signal:abort.signal});
  if(r.status===429||r.status===503){
   const value=r.headers.get('Retry-After'),seconds=Number(value);
   const delay=value&&Number.isFinite(seconds)?seconds*1000:value&&Number.isFinite(Date.parse(value))?Date.parse(value)-Date.now():30000;
   providerCooldowns.set(origin,Date.now()+Math.max(1000,delay));
  }
  if(!r.ok)throw Error('Market provider returned '+r.status);return await r.json();
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}
export async function findOnchainMarkets(query,{network,signal}={}){
 const priced=pair=>Number(pair?.priceUsd)>0&&Number.isFinite(Number(pair.priceUsd));
 const rank=pairs=>rankCoinMatches(pairs.filter(priced),query,{orientPair,network}).filter(priced);
 // Keep the fast search path, but an empty index or provider cooldown does
 // not mean the contract has no market. The second source must match it too.
 try{
  const data=await fetchJSON('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(query),{signal});
  const pairs=rank(data.pairs||[]);if(pairs.length)return pairs;
 }catch(error){if(signal?.aborted)throw error;}
 const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
 const geckoNetwork=network&&(aliases[network]||network),specific=geckoNetwork&&isTokenIdentifier(query);
 const params=new URLSearchParams({include:'base_token,quote_token,dex,network',page:'1'});
 if(!specific){params.set('query',query);if(geckoNetwork)params.set('network',geckoNetwork);}
 const path=specific?'/networks/'+encodeURIComponent(geckoNetwork)+'/tokens/'+encodeURIComponent(query)+'/pools':'/search/pools';
 const controller=new AbortController(),cancel=()=>controller.abort();
 signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 // Allow one provider-requested cooldown; still cancel promptly when the
 // user edits the address, selects another coin, or dismisses the search.
 const timeout=setTimeout(cancel,75000);
 try{
  for(let attempt=0;attempt<2;attempt++){
   const response=await fetchGecko('https://api.geckoterminal.com/api/v2'+path+'?'+params,{signal:controller.signal,priority:200});
   if(response.status===429&&attempt===0)continue;
   if(!response.ok)throw Error('Market search provider returned '+response.status);
   const data=await response.json();if(!Array.isArray(data.data))throw Error('Unexpected market search response');
   const included=new Map((data.included||[]).map(item=>[item.id,item]));
   return rank(data.data.map(pool=>geckoPoolMarket(pool,included,geckoNetwork||undefined)).filter(Boolean));
  }
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}
