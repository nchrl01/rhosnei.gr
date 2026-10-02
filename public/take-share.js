import {requestPlaybackMode} from './audio-unlock.js?v=55';
const VERSION=1;
export function encodeScore(score){
 const bytes=new TextEncoder().encode(JSON.stringify(score));let text='';for(const byte of bytes)text+=String.fromCharCode(byte);
 return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeScore(hash){
 const raw=new URLSearchParams(hash.replace(/^#/,'' )).get('score');if(!raw)return null;
 if(raw.length>180000)throw Error('Shared score is too large');
 const bytes=Uint8Array.from(atob(raw.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));const score=JSON.parse(new TextDecoder().decode(bytes));
 if(score.version!==VERSION||![52,53].includes(score.engine)||!Number.isFinite(score.interval)||score.interval<1000||score.interval>86400000||!Array.isArray(score.rows)||!score.rows.length||score.rows.length>256)throw Error('Unsupported shared score');
 if(!score.market?.baseToken||!score.market?.quoteToken||!['chainId','pairAddress','dexId'].every(k=>typeof score.market[k]==='string'&&score.market[k].length<256))throw Error('Invalid shared coin');
 for(const token of [score.market.baseToken,score.market.quoteToken])if(!['address','symbol','name'].every(k=>typeof token[k]==='string'&&token[k].length<256))throw Error('Invalid shared coin');
 if(!(Number(score.market.priceUsd)>0)||!Number.isFinite(Number(score.market.priceUsd)))throw Error('Invalid shared price');
 if(score.market.marketCap!=null&&(!Number.isFinite(Number(score.market.marketCap))||Number(score.market.marketCap)<0))throw Error('Invalid shared market cap');
 let previous=-Infinity;
 for(const row of score.rows){if(!Array.isArray(row)||row.length!==6||!row.slice(0,5).every(Number.isFinite)||(row[0]<=previous||Math.abs(row[0])>8640000000000000)||row.slice(1,5).some(n=>n<=0)||row[2]<Math.max(row[1],row[4])||row[3]>Math.min(row[1],row[4])||row[5]!=null&&(!Number.isFinite(row[5])||row[5]<0))throw Error('Invalid shared candles');previous=row[0];}
 return score;
}
export function createTakeShare({button,dialog,snapshot,onContinue=()=>{}}){
 let active=null,lastTake=null,pending=null,epoch=0,prepared=null,urls=[];
 const get=id=>document.getElementById(id);
 function start(context,tap){
  button.disabled=false;if(active||!globalThis.MediaRecorder||!tap)return;
  let destination;
  try{
   destination=context.createMediaStreamDestination();tap.connect(destination);
   const safari=/AppleWebKit/.test(navigator.userAgent)&&!/(Chrome|Chromium|Edg)/.test(navigator.userAgent);
   const formats=safari?['audio/mp4','audio/webm;codecs=opus','audio/webm']:['audio/webm;codecs=opus','audio/mp4','audio/webm'];
   const mime=formats.find(t=>MediaRecorder.isTypeSupported(t));
   const recorder=new MediaRecorder(destination.stream,mime?{mimeType:mime}:undefined),take={recorder,destination,tap,chunks:[],started:Date.now(),score:snapshot(),epoch};
   take.done=new Promise(resolve=>take.resolve=resolve);
   recorder.ondataavailable=event=>{if(event.data.size)take.chunks.push(event.data);};
   recorder.onstop=()=>{clearTimeout(take.timer);try{tap.disconnect(destination);}catch{}for(const track of destination.stream.getTracks())track.stop();take.blob=new Blob(take.chunks,{type:recorder.mimeType});take.chunks=[];if(take.epoch===epoch)lastTake=take;take.resolve(take);};
   recorder.onerror=()=>{if(recorder.state!=='inactive')recorder.stop();};
   active=take;recorder.start(1000);requestPlaybackMode();
   // Keep one bounded take. Share or a new Listen starts a new capture.
   take.timer=setTimeout(()=>{if(active===take)void finish();},300000);
  }catch{if(destination){try{tap.disconnect(destination);}catch{}for(const track of destination.stream.getTracks())track.stop();}active=null;button.disabled=false;}
 }
 async function finish(){const take=active;if(!take)return pending||lastTake;active=null;pending=take.done;if(take.recorder.state!=='inactive')take.recorder.stop();const result=await take.done;if(pending===take.done)pending=null;return result;}
 function link(blob,label,name){const url=URL.createObjectURL(blob);urls.push(url);const a=document.createElement('a');a.href=url;a.download=name;a.textContent=label;get('share-files').append(a);}
 button.onclick=async()=>{
  button.disabled=true;
  try{
   const score=snapshot(),take=await finish();urls.forEach(URL.revokeObjectURL);urls=[];get('share-files').replaceChildren();
   const base=location.href.split('#')[0],payload=score?encodeScore(score):null;
   prepared={url:payload&&payload.length<18000?base+'#score='+payload:null,file:null};
   if(take?.blob?.size){const ext=take.blob.type.includes('mp4')?'m4a':'webm',name='AV-'+take.started+'.'+ext;prepared.file=new File([take.blob],name,{type:take.blob.type});link(take.blob,'Download exact audio take',name);}
   if(score)link(new Blob([JSON.stringify(score)],{type:'application/json'}),'Download frozen score','AV-score.json');
   get('share-note').textContent='Audio preserves the exact take (up to five minutes). The replay link freezes the candle score and coin seed; granular textures can vary. Video export and the sharing API are not connected yet.';
   if(payload&&!prepared.url)get('share-note').textContent+=' This score is too long for a replay link; download the audio or score instead.';
   get('share-link').textContent='Copy replay link';get('share-link').disabled=!prepared.url;
   get('share-native').hidden=!prepared.file||!navigator.canShare?.({files:[prepared.file]});
   dialog.showModal();onContinue();
  }catch(error){get('share-note').textContent=error.message;dialog.showModal();onContinue();}
  finally{button.disabled=false;}
 };
 get('share-link').onclick=async()=>{try{await navigator.clipboard.writeText(prepared.url);get('share-link').textContent='Copied';}catch{get('share-note').textContent='Clipboard unavailable. Download the frozen score or copy this link: '+prepared.url;}};
 get('share-native').onclick=async()=>{try{await navigator.share({files:[prepared.file],title:'AV · market take'});}catch(error){if(error.name!=='AbortError')get('share-note').textContent='Sharing unavailable here. Use Download exact audio take.';}};
 return {start,finish,reset(){epoch++;lastTake=null;pending=null;button.disabled=true;}};
}
