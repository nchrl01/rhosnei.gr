// Bounded local player frames: never a screen recording or an on-chain listing.
const DB='upic-coin-snapshots-v1',LIMIT=24;
let database;
function open(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('frames',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function readCoinSnapshots(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('frames'),r=tx.objectStore('frames').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveCoinSnapshot(frame){
 if(!frame.key||!(frame.blob instanceof Blob)||frame.blob.size>750000)return;
 const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction('frames','readwrite'),store=tx.objectStore('frames');store.put(frame);const r=store.getAll();r.onsuccess=()=>{for(const row of r.result.sort((a,b)=>b.capturedAt-a.capturedAt).slice(LIMIT))store.delete(row.key);};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
export function archivePlayerFrames({getMarket,getVisual,eligible}){
 let busy=false,lastKey='',lastAt=0;
 async function capture(){
  if(busy||document.hidden||!eligible())return;
  const market=getMarket(),visual=getVisual(),state=visual?.snapshot();
  if(!market||!state?.totalHolders||state.holderSource==='unavailable'||state.holderLoading)return;
  const address=market.baseToken.address,key=market.chainId+':'+(/^0x/i.test(address)?address.toLowerCase():address);
  if(key===lastKey&&Date.now()-lastAt<60000)return;
  busy=true;let frame;
  try{
   frame=visual.captureStill(512);
   const blob=await new Promise(resolve=>frame.toBlob(resolve,'image/webp',.86));
   if(!blob||getMarket()!==market)return;
   await saveCoinSnapshot({key,chain:market.chainId,address,symbol:market.baseToken.symbol,name:market.baseToken.name||market.baseToken.symbol,marketCap:state.marketCap,liquidity:state.liquidity,holders:state.totalHolders,capturedAt:Date.now(),source:'Saved UPIC player frame',coverage:state.holderCoverage,blob});
   lastKey=key;lastAt=Date.now();
  }catch{}finally{if(frame)frame.width=frame.height=1;busy=false;}
 }
 const timer=setInterval(capture,15000);return()=>clearInterval(timer);
}
