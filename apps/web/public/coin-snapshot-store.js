// Temporary pixels for the trusted capture runner. Normal browsing never archives.
const DB='upic-coin-snapshots-v1',LIMIT=24,KIND='live-player-frame-v1';
let legacyRemoved=false;
export function clearLegacyCoinSnapshots(){
 if(legacyRemoved)return;legacyRemoved=true;
 try{const request=indexedDB.deleteDatabase(DB);request.onerror=()=>{};}catch{}
}
clearLegacyCoinSnapshots();
const keyFor=(chain,address)=>chain+':'+(/^0x[\da-f]{40}$/i.test(address||'')?address.toLowerCase():address);
const validFrame=frame=>frame?.captureKind===KIND&&frame.key===keyFor(frame.chain,frame.address)&&typeof frame.chain==='string'&&typeof frame.address==='string'&&Number.isFinite(frame.capturedAt)&&frame.capturedAt>0&&frame.blob instanceof Blob;
function publishCapture(frame){
 if(!validFrame(frame)||!frame.blob.size||frame.blob.size>750000)return false;
 document.dispatchEvent(new CustomEvent('upic:snapshot-saved',{detail:{key:frame.key,capturedAt:frame.capturedAt,frame}}));return true;
}
// Inspect the copied pixels without changing their brightness or geometry.
export function meaningfulCapture(canvas){
 const width=canvas.width,height=canvas.height;if(!(width>0&&height>0))return false;
 const pixels=canvas.getContext('2d')?.getImageData(0,0,width,height).data;if(!pixels)return false;
 let lit=0,peak=0,energy=0;
 for(let i=0;i<pixels.length;i+=4){const brightness=Math.max(pixels[i],pixels[i+1],pixels[i+2])*pixels[i+3]/255;peak=Math.max(peak,brightness);energy+=brightness;if(brightness>=16)lit++;}
 return peak>=32&&lit>=Math.max(12,Math.ceil(width*height*.0001))&&energy>=width*height*.01;
}
export function archivePlayerFrames({captureMode=false,getMarket,getVisual,eligible}){
 if(!captureMode)return()=>{};
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
   const saved=publishCapture({key,chain:market.chainId,address,symbol:market.baseToken.symbol,name:market.baseToken.name||market.baseToken.symbol,marketCap:state.marketCap,liquidity:state.liquidity,holders:state.totalHolders,capturedAt:state.renderedAt,holderFetchedAt:state.holderFetchedAt??null,marketObservedAt:state.marketObservedAt??null,source:'Live UPIC player frame',coverage:state.holderCoverage,captureKind:KIND,blob});
   if(saved){lastAt.set(key,state.renderedAt);if(lastAt.size>LIMIT)lastAt.delete(lastAt.keys().next().value);}
  }catch{}finally{if(frame)frame.width=frame.height=1;busy=false;}
 }
 const timer=setInterval(capture,1000);void capture();return()=>{closed=true;clearInterval(timer);};
}
