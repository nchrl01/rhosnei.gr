// Original pixels from the live player, with bounded local retention.
const DB='upic-coin-snapshots-v1',LIMIT=24,KIND='live-player-frame-v1';
let database;
const keyFor=(chain,address)=>chain+':'+(/^0x[\da-f]{40}$/i.test(address||'')?address.toLowerCase():address);
const validFrame=frame=>frame?.captureKind===KIND&&frame.key===keyFor(frame.chain,frame.address)&&typeof frame.chain==='string'&&typeof frame.address==='string'&&Number.isFinite(frame.capturedAt)&&frame.capturedAt>0&&frame.blob instanceof Blob;
let channel;
try{channel=new BroadcastChannel('upic-coin-snapshots-v1');channel.onmessage=event=>{if(event.data?.type==='saved')document.dispatchEvent(new CustomEvent('upic:snapshot-saved',{detail:{key:event.data.key,capturedAt:event.data.capturedAt}}));};}catch{}
function open(){return database??=new Promise((resolve,reject)=>{
 let settled=false;const timer=setTimeout(()=>{settled=true;reject(Error('Capture storage timed out'));},1500);
 const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('frames',{keyPath:'key'});
 r.onsuccess=()=>{clearTimeout(timer);if(settled){r.result.close();return;}settled=true;resolve(r.result);};
 r.onerror=()=>{clearTimeout(timer);settled=true;reject(r.error);};
}).catch(error=>{database=null;throw error;});}
export async function readCoinSnapshots(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('frames'),r=tx.objectStore('frames').getAll();r.onsuccess=()=>resolve(r.result.filter(validFrame));r.onerror=()=>reject(r.error);});}
export async function saveCoinSnapshot(frame){
 if(!validFrame(frame)||!frame.blob.size||frame.blob.size>750000)return false;
 const db=await open();let saved=false;
 await new Promise((resolve,reject)=>{const tx=db.transaction('frames','readwrite'),store=tx.objectStore('frames'),previous=store.get(frame.key);
  previous.onsuccess=()=>{if(validFrame(previous.result)&&previous.result.capturedAt>=frame.capturedAt)return;store.put(frame);saved=true;const r=store.getAll();r.onsuccess=()=>{const rows=r.result.filter(validFrame).sort((a,b)=>b.capturedAt-a.capturedAt);for(const row of r.result)if(!validFrame(row))store.delete(row.key);for(const row of rows.slice(LIMIT))store.delete(row.key);};};
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });
 if(saved){const detail={key:frame.key,capturedAt:frame.capturedAt};document.dispatchEvent(new CustomEvent('upic:snapshot-saved',{detail}));try{channel?.postMessage({type:'saved',...detail});}catch{}}
 return saved;
}
// Inspect the copied pixels without changing their brightness or geometry.
export function meaningfulCapture(canvas){
 const width=canvas.width,height=canvas.height;if(!(width>0&&height>0))return false;
 const pixels=canvas.getContext('2d')?.getImageData(0,0,width,height).data;if(!pixels)return false;
 let lit=0,peak=0,energy=0;
 for(let i=0;i<pixels.length;i+=4){const brightness=Math.max(pixels[i],pixels[i+1],pixels[i+2])*pixels[i+3]/255;peak=Math.max(peak,brightness);energy+=brightness;if(brightness>=16)lit++;}
 return peak>=32&&lit>=Math.max(12,Math.ceil(width*height*.0001))&&energy>=width*height*.01;
}
export function archivePlayerFrames({getMarket,getVisual,eligible}){
 let busy=false,closed=false;const lastAt=new Map();
 async function capture(){
  if(closed||busy||document.hidden||!eligible())return;
  const market=getMarket(),visual=getVisual(),state=visual?.snapshot(),address=market?.baseToken?.address;
  if(!market||!address||!state)return;const key=keyFor(market.chainId,address),now=Date.now();
  if(state.sourceCoinKey!==key||state.renderedPlaying!==true||state.holderSnapshotReady!==true||state.holderSource!=='observed-wallet-sample'||state.holderLoading||!(state.markCount>0)||!(state.transportPresence>=.99))return;
  if(!Number.isFinite(state.renderedAt)||now-state.renderedAt<0||now-state.renderedAt>2000||now-(lastAt.get(key)||0)<60000)return;
  busy=true;let frame;
  try{
   frame=visual.captureStill(512);if(!meaningfulCapture(frame))return;
   const blob=await new Promise(resolve=>frame.toBlob(resolve,'image/webp',.86));
   if(closed||!blob||getMarket()!==market||document.hidden||!eligible())return;
   const current=visual.snapshot();if(current.sourceCoinKey!==key||current.renderedPlaying!==true||current.holderLoading)return;
   const saved=await saveCoinSnapshot({key,chain:market.chainId,address,symbol:market.baseToken.symbol,name:market.baseToken.name||market.baseToken.symbol,marketCap:state.marketCap,liquidity:state.liquidity,holders:state.totalHolders,capturedAt:state.renderedAt,holderFetchedAt:state.holderFetchedAt??null,marketObservedAt:state.marketObservedAt??null,source:'Live UPIC player frame',coverage:state.holderCoverage,captureKind:KIND,blob});
   if(saved){lastAt.set(key,state.renderedAt);if(lastAt.size>LIMIT)lastAt.delete(lastAt.keys().next().value);}
  }catch{}finally{if(frame)frame.width=frame.height=1;busy=false;}
 }
 const timer=setInterval(capture,1000);void capture();return()=>{closed=true;clearInterval(timer);};
}
