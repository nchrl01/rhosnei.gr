import {loadCoinCatalogue} from './coin-catalogue.js?v=335';
const aliases={eth:'ethereum',polygon_pos:'polygon',avax:'avalanche',ftm:'fantom',cro:'cronos'};
const network=value=>aliases[value]||value;
const address=value=>/^0x[\da-f]{40}$/i.test(value||'')?value.toLowerCase():value;
let pending;
// Exact identities only: matching a ticker can attach another token's artwork.
export async function catalogueCoinArtwork(chain,token){
 if(!chain||!token)return '';
 try{
  const images=await (pending??=loadCoinCatalogue().then(data=>{
   const index=new Map();
   for(const coin of data.coins){
    let url;try{url=new URL(coin.image);}catch{continue;}
    if(url.protocol!=='https:'||url.username||url.password)continue;
    for(const p of [{chain:coin.chain,address:coin.address},...(coin.platforms||[])]){
     if(!p.chain||!p.address)continue;const key=network(p.chain)+':'+address(p.address);
     // Conflicting catalogue identities are not a safe image reference.
     if(index.has(key)&&index.get(key)!==url.href)index.set(key,'');else if(!index.has(key))index.set(key,url.href);
    }
   }
   return index;
  }).catch(error=>{pending=null;throw error;}));
  return images.get(network(chain)+':'+address(token))||'';
 }catch{return '';}
}
