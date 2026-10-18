import {coinOnNetwork} from './coin-catalogue.js?v=334';
export const previewKey=(chain,address)=>chain+':'+(/^0x[\da-f]{40}$/i.test(address||'')?address.toLowerCase():address);
export function storeCapture(coin,frame,url=null){
 if(frame?.captureKind!=='live-player-frame-v1'||!frame?.chain||!frame.address||!Number.isFinite(frame.capturedAt))return false;
 const key=previewKey(frame.chain,frame.address),previous=coin.captures?.[key];
 if(previous?.capturedAt>=frame.capturedAt)return false;
 coin.captures??={};coin.captures[key]={...frame,localURL:url};return true;
}
export function coinPreview(coin,network='all'){
 let selection=coinOnNetwork(coin,network);const frames=Object.values(coin.captures||{}).filter(f=>network==='all'||f.chain===selection.chain&&previewKey(f.chain,f.address)===previewKey(selection.chain,selection.address)).sort((a,b)=>b.capturedAt-a.capturedAt);
 const capture=frames[0]||null;
 if(capture&&network==='all')selection={...coin,chain:capture.chain,address:capture.address,key:previewKey(capture.chain,capture.address)};
 return {selection,capture};
}
