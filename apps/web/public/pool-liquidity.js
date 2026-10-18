// Liquidity is specific to the selected pool; never borrow another pool's reserves.
const snapshots=new Map(),pending=new Map();
const address=value=>/^0x/i.test(value||'')?value.toLowerCase():value;
const key=pair=>pair?.chainId+':'+address(pair?.pairAddress);
export function rememberPoolLiquidity(pair,now=Date.now()){
 const raw=pair?.liquidity?.usd,value=Number(raw);
 if(raw==null||raw===''||!Number.isFinite(value)||value<0)return;
 snapshots.set(key(pair),{usd:value,at:now,source:pair.snapshotProvider==='gecko'?'GeckoTerminal':'DEX Screener'});
 if(snapshots.size>64)snapshots.delete(snapshots.keys().next().value);
}
export function poolLiquiditySnapshot(pair,now=Date.now()){
 const value=snapshots.get(key(pair));return value&&now-value.at<1800000?value:null;
}
export async function loadPoolLiquidity(pair){
 if(!pair?.pairAddress||!pair?.chainId||pair.chainId==='exchange')return;
 const id=key(pair),saved=poolLiquiditySnapshot(pair);if(saved&&Date.now()-saved.at<60000)return saved;
 if(pending.has(id))return pending.get(id);
 const job=(async()=>{
  try{
   const response=await fetch('https://api.dexscreener.com/latest/dex/pairs/'+encodeURIComponent(pair.chainId)+'/'+encodeURIComponent(pair.pairAddress),{credentials:'omit',signal:AbortSignal.timeout(12000)});
   if(!response.ok)return saved;
   const data=await response.json(),match=data.pairs?.find(row=>row.chainId===pair.chainId&&address(row.pairAddress)===address(pair.pairAddress));
   if(match)rememberPoolLiquidity(match);
  }catch{}
  return poolLiquiditySnapshot(pair);
 })();pending.set(id,job);try{return await job;}finally{pending.delete(id);}
}
