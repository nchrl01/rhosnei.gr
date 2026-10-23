import {catalogueNative} from './native-coins.js?v=359';
import {compareCoinNetworks,supportedCoinNetwork} from './coin-network-choice.js?v=440';
import {coinOnNetwork} from './coin-catalogue.js?v=440';
const captureEndpoint='https://upic-insightx.nchrl01.workers.dev/coin-captures';
let cachedCaptures=[],loadedAt=0,loading;
export const previewKey=(chain,address)=>chain+':'+(/^0x[\da-f]{40}$/i.test(address||'')?address.toLowerCase():address);
function cloudCapture(frame){
 const chain=frame?.chain||frame?.network,address=frame?.address;
 if(frame?.captureKind!=='live-player-frame-v1'||typeof chain!=='string'||!chain||typeof address!=='string'||!address||address.length>250||!Number.isFinite(frame.capturedAt)||frame.capturedAt<=0||frame.capturedAt>Date.now()+60000)return null;
 const key=previewKey(chain,address);if(frame.key&&frame.key!==key)return null;
 const url=new URL(captureEndpoint+'/image');url.search=new URLSearchParams({network:chain,address,v:String(frame.capturedAt)});
 return {key,chain,address,captureKind:frame.captureKind,capturedAt:frame.capturedAt,symbol:frame.symbol,name:frame.name,marketCap:frame.marketCap,liquidity:frame.liquidity,holders:frame.holders,coverage:frame.coverage,imageAvailable:frame.imageAvailable,marketObservedAt:frame.marketObservedAt,snapshot:url.href};
}
// Metadata is kept in memory only. Images are served by the shared Worker.
export async function loadCloudCaptures({force=false}={}){
 if(loading)return loading;
 if(!force&&Date.now()-loadedAt<60000)return cachedCaptures;
 loading=(async()=>{
  const latest=new Map(),seen=new Set();let cursor='';
  do{
   const url=new URL(captureEndpoint);if(cursor)url.searchParams.set('cursor',cursor);
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Shared captures unavailable');
   const data=await response.json();if(!Array.isArray(data.captures))throw Error('Invalid shared capture manifest');
   for(const raw of data.captures){const frame=cloudCapture(raw);if(frame&&(!latest.has(frame.key)||latest.get(frame.key).capturedAt<frame.capturedAt))latest.set(frame.key,frame);}
   cursor=typeof data.nextCursor==='string'?data.nextCursor:'';
   if(cursor&&seen.has(cursor))throw Error('Invalid shared capture cursor');if(cursor)seen.add(cursor);
  }while(cursor);
  cachedCaptures=[...latest.values()];loadedAt=Date.now();return cachedCaptures;
 })().finally(()=>{loading=null;});return loading;
}
export function storeCapture(coin,frame){
 frame=cloudCapture(frame);if(!frame)return false;
 const key=previewKey(frame.chain,frame.address),previous=coin.captures?.[key];
 if(previous?.capturedAt>=frame.capturedAt)return false;
 coin.captures??={};coin.captures[key]=frame;return true;
}
export function coinPreview(coin,network='all'){
 let selection=coinOnNetwork(coin,network);
 const frames=Object.values(coin.captures||{}).filter(f=>network==='all'||f.chain===selection.chain&&previewKey(f.chain,f.address)===previewKey(selection.chain,selection.address||(catalogueNative(selection)?.address||selection.address))).sort((a,b)=>network==='all'?compareCoinNetworks(coin,a,b):b.capturedAt-a.capturedAt);
 const capture=frames[0]||null;
 if(capture&&network==='all')selection={...coin,chain:capture.chain,address:capture.address,key:previewKey(capture.chain,capture.address)};
 else if(network==='all'&&!catalogueNative(coin)&&coin.contractStatus!=='off-chain'){
  const candidates=[{chain:coin.chain,address:coin.address},...(coin.platforms||[])].filter(candidate=>supportedCoinNetwork(coin,candidate)).sort((a,b)=>compareCoinNetworks(coin,a,b));
  if(candidates[0])selection={...coin,...candidates[0],key:previewKey(candidates[0].chain,candidates[0].address)};
 }
 return {selection,capture};
}
