export {HOLDER_NETWORKS,countValue,fetchHolderCount,fetchGoPlusCount} from '../../apps/web/public/holder-count-providers.js';
import {countValue} from '../../apps/web/public/holder-count-providers.js';
// Credential stays in the Worker. This endpoint is the official Robinhood index.
export async function fetchBlockscoutCount(network,address,apiKey){
 if(network!=='robinhood'||!apiKey||!/^0x[0-9a-f]{40}$/i.test(address))return null;
 try{
  const url=new URL('https://api.blockscout.com/4663/api/v2/tokens/'+address);
  url.searchParams.set('apikey',apiKey);
  const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)return null;
  const token=await response.json();
  if(token.address_hash?.toLowerCase()!==address.toLowerCase())return null;
  const count=countValue(token.holders_count);
  return count===null?null:{state:'snapshot',holders:count,lastUpdated:null,image_url:token.icon_url||null,source:'Blockscout Robinhood index',approximate:false,fetchedAt:Date.now()};
 }catch{return null;}
}
