// One static, timestamped catalogue. Opening the browser does not poll 1,000 coins.
let pending;
export function loadCoinCatalogue(){return pending??=fetch('marketplace-coin-catalogue.json?v=325',{credentials:'same-origin'}).then(async response=>{if(!response.ok)throw Error('Coin catalogue unavailable');const data=await response.json();if(!Array.isArray(data.coins))throw Error('Invalid coin catalogue');return data;}).catch(error=>{pending=null;throw error;});}
export function coinPlayerURL(item){
 const params=new URLSearchParams({coin:item.address||item.query||item.symbol+'/USD'});if(item.address&&item.chain)params.set('network',item.chain);
 return './?'+params;
}
export function rememberRecentCoin(coin){
 if(!coin?.symbol||!(coin.address||coin.query))return;
 try{const rows=JSON.parse(localStorage.getItem('upic-recent-coins-v1')||'[]');const key=coin.key||coin.chain+':'+coin.address;localStorage.setItem('upic-recent-coins-v1',JSON.stringify([{key,chain:coin.chain,address:coin.address,symbol:coin.symbol,name:coin.name,query:coin.query,image:coin.image},...rows.filter(r=>r.key!==key)].slice(0,12)));}catch{}
}
export function recentCoins(){try{const rows=JSON.parse(localStorage.getItem('upic-recent-coins-v1')||'[]');return Array.isArray(rows)?rows.filter(r=>r&&typeof r.symbol==='string'&&typeof(r.address||r.query)==='string').slice(0,12):[];}catch{return [];}}
export function removeRecentCoin(key){try{localStorage.setItem('upic-recent-coins-v1',JSON.stringify(recentCoins().filter(r=>r.key!==key)));}catch{}}
