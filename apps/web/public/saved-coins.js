const STORAGE_KEY='saved-coins-v1',LIMIT=100;
const venues=new Set(['kraken','coinbaseexchange','binance']);
let cache=null;
const text=(value,max=250)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';
const tokenKey=value=>/^0x[0-9a-f]+$/i.test(value)?value.toLowerCase():value;
function imageURL(value){
 const input=text(value,2048);if(!input)return '';
 try{
  const base=globalThis.location?.href||'https://upic.invalid/';
  const url=new URL(input,base);
  return !url.username&&!url.password&&(url.protocol==='https:'||url.protocol==='http:'&&url.origin===new URL(base).origin)?url.href:'';
 }catch{return '';}
}
function normalized(coin){
 if(!coin||typeof coin!=='object')return null;
 const source=coin.source==='ccxt'?'ccxt':'dex';
 const chain=text(coin.chain||coin.network,80).toLowerCase();
 const nativeId=text(coin.nativeId,100).toLowerCase();
 if(nativeId&&!/^[a-z0-9-]+$/.test(nativeId))return null;
 let address=text(coin.address),query='',exchangeId='',exchangeSymbol='',key='';
 if(source==='ccxt'){
  exchangeId=text(coin.exchangeId,40).toLowerCase();
  exchangeSymbol=text(coin.exchangeSymbol,80).toUpperCase();
  if(!venues.has(exchangeId)||!/^[A-Z0-9.]+\/(?:USD|USDT|USDC)$/.test(exchangeSymbol))return null;
  address=null;query='cex:'+exchangeId+':'+exchangeSymbol;
  key=query+(nativeId?':native:'+nativeId:'');
 }else{
  if(!/^[a-z0-9_-]+$/.test(chain)||!address||/[\s?&#]/.test(address))return null;
  query=address;key=chain+':'+tokenKey(address);
 }
 const params=new URLSearchParams({coin:query});
 if(source==='dex')params.set('network',chain);
 if(nativeId)params.set('native',nativeId);
 return {
  key,source,chain:source==='ccxt'?'exchange':chain,network:source==='ccxt'?'exchange':chain,address,query,
  exchangeId,exchangeSymbol,nativeId,
  symbol:text(coin.symbol,40)||exchangeSymbol.split('/')[0]||address,
  name:text(coin.name,120)||text(coin.symbol,40)||exchangeSymbol.split('/')[0]||address,
  image:imageURL(coin.image),url:'./?'+params,
  savedAt:Number.isFinite(coin.savedAt)&&coin.savedAt>0?coin.savedAt:Date.now(),
 };
}
function read(){
 if(cache)return cache;
 try{
  const raw=JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY)||'[]'),seen=new Set();
  cache=(Array.isArray(raw)?raw:[]).map(normalized).filter(coin=>coin&&!seen.has(coin.key)&&seen.add(coin.key)).slice(0,LIMIT);
 }catch{cache=[];}
 return cache;
}
function changed(){globalThis.window?.dispatchEvent(new CustomEvent('upic:saved-coins-changed',{detail:{coins:savedCoins()}}));}
function write(coins){
 try{globalThis.localStorage.setItem(STORAGE_KEY,JSON.stringify(coins));}
 catch{throw Error('Could not save on this device. Allow browser storage and try again.');}
 cache=coins;changed();
}
export function savedCoins(){return read().map(coin=>({...coin}));}
export function isCoinSaved(key){return typeof key==='string'&&read().some(coin=>coin.key===key);}
export function toggleSavedCoin(coin){
 const item=normalized(coin);if(!item)throw Error('This coin could not be saved.');
 if(isCoinSaved(item.key)){removeSavedCoin(item.key);return false;}
 write([{...item,savedAt:Date.now()},...read()].slice(0,LIMIT));return true;
}
export function removeSavedCoin(key){
 const coins=read();if(!coins.some(coin=>coin.key===key))return false;
 write(coins.filter(coin=>coin.key!==key));return true;
}
export function savedCoinForMarket(pair,image=''){
 if(!pair?.baseToken)return null;
 const exchange=pair.source==='ccxt'||pair.chainId==='exchange';
 return normalized({
  source:exchange?'ccxt':'dex',chain:pair.chainId,address:exchange?null:pair.baseToken.address,
  exchangeId:pair.exchangeId||pair.dexId,exchangeSymbol:pair.exchangeSymbol||pair.pairAddress?.split(':').slice(1).join(':'),
  nativeId:pair.nativeAsset?.id||pair.nativeId,
  symbol:pair.baseToken.symbol,name:pair.baseToken.name,
  image:image||pair.info?.imageUrl||pair.baseToken.imageUrl,
 });
}
globalThis.window?.addEventListener('storage',event=>{
 if(event.key!==STORAGE_KEY&&event.key!==null)return;
 cache=null;changed();
});
