import {contractPlayerURL} from './collectible-selection.js?v=445';
// One static, timestamped catalogue. Opening the browser does not poll 1,000 coins.
let pending;
export function loadCoinCatalogue(){return pending??=fetch('marketplace-coin-catalogue.json?v=445',{credentials:'same-origin'}).then(async response=>{if(!response.ok)throw Error('Coin catalogue unavailable');const data=await response.json();if(!Array.isArray(data.coins))throw Error('Invalid coin catalogue');return data;}).catch(error=>{pending=null;throw error;});}
const nativeOnNetwork=(item,network)=>Boolean(network&&(item.nativeChain===network||item.nativeChains?.includes(network)||(item.contractStatus==='native'&&!item.nativeChain&&!item.nativeChains?.length&&item.chain===network)));
export const coinPlayerURL=contractPlayerURL;

export function rememberRecentCoin(coin){
 if(!coin?.symbol||!(coin.address||coin.query))return;
 try{const rows=JSON.parse(localStorage.getItem('upic-recent-coins-v1')||'[]');const key=coin.key||coin.chain+':'+coin.address;localStorage.setItem('upic-recent-coins-v1',JSON.stringify([{key,id:coin.id,chain:coin.chain,address:coin.address,symbol:coin.symbol,name:coin.name,query:coin.query,image:coin.image,contractStatus:coin.contractStatus,nativeChain:coin.nativeChain,nativeChains:coin.nativeChains},...rows.filter(r=>r.key!==key)].slice(0,12)));}catch{}
}
export function recentCoins(){try{const rows=JSON.parse(localStorage.getItem('upic-recent-coins-v1')||'[]');return Array.isArray(rows)?rows.filter(r=>r&&typeof r.symbol==='string'&&typeof(r.address||r.query)==='string').slice(0,12):[];}catch{return [];}}
export function removeRecentCoin(key){try{localStorage.setItem('upic-recent-coins-v1',JSON.stringify(recentCoins().filter(r=>r.key!==key)));}catch{}}

// A network filter must open that network's identifier, not another chain's primary.
export function coinOnNetwork(item,network){
 if(!network||network==='all'||item.contractStatus==='off-chain')return item;
 if(nativeOnNetwork(item,network))return {...item,chain:network,address:null,key:item.id?'coingecko:'+item.id:network+':native'};
 if(item.chain===network)return item;
 const platform=item.platforms?.find(p=>p.chain===network);
 return platform?{...item,chain:platform.chain,address:platform.address,key:platform.chain+':'+platform.address}:item;
}
