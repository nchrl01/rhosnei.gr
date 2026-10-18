import {previewKey} from './coin-previews.js?v=334';

// One actual, silent live player at a time, only for cards in view. No simulated
// holdings or alternate renderer. Unreceived data never becomes artwork.
export function createLiveCaptureQueue({onCapture=()=>{}}={}){
 const cards=new Map(),cooldowns=new Map();let current=null,closed=false;
 const support=new Set(['ethereum','base','arbitrum','optimism','polygon','bsc','avalanche','gnosis','zksync','celo','robinhood','solana','fantom','cronos','linea','scroll','blast','mantle']);
 const observer=new IntersectionObserver(entries=>{for(const e of entries){const row=cards.get(e.target);if(row)row.visible=e.isIntersecting;}pump();},{rootMargin:'80px'});
 function finish(message){
  if(!current)return;const job=current;current=null;clearTimeout(job.timeout);job.iframe.remove();
  cooldowns.set(job.key,Date.now()+5*60000);if(message&&job.card.isConnected)job.status(message);
  if(!closed)setTimeout(pump,400);
 }
 function pump(){
  if(closed||current||document.hidden)return;
  for(const [card,row] of cards){
   if(!card.isConnected){observer.unobserve(card);cards.delete(card);continue;}
   const key=previewKey(row.coin.chain,row.coin.address);
   if(!row.visible||!row.coin.address||!support.has(row.coin.chain)||Date.now()-(row.capturedAt||0)<2*60000||(cooldowns.get(key)||0)>Date.now())continue;
   const request=crypto.randomUUID(),iframe=document.createElement('iframe');iframe.title='Live artwork capture';iframe.setAttribute('aria-hidden','true');iframe.tabIndex=-1;
   iframe.style.cssText='position:fixed;left:0;top:0;width:768px;height:768px;border:0;opacity:0;pointer-events:none;z-index:-1;';
   const url=new URL('instrument.html',document.baseURI);url.search=new URLSearchParams({coin:row.coin.address,network:row.coin.chain,capture:'live',captureRequest:request});iframe.src=url.href;
   current={...row,key,request,iframe,card,timeout:setTimeout(()=>finish('Live data pending'),180000)};row.status('Capturing live…');document.body.append(iframe);break;
  }
 }
 async function message(event){
  const job=current,data=event.data;if(!job||event.origin!==location.origin||event.source!==job.iframe.contentWindow||data?.type!=='upic:live-capture'||data.request!==job.request)return;
  const frame=data.frame;if(frame?.captureKind!=='live-player-frame-v1'||previewKey(frame.chain,frame.address)!==job.key||!(frame.blob instanceof Blob)||!frame.blob.size||frame.blob.size>750000||!Number.isFinite(frame.capturedAt)||Date.now()-frame.capturedAt>15000||frame.capturedAt>Date.now()+1000)return;
  job.capturedAt=frame.capturedAt;const row=cards.get(job.card);if(row)row.capturedAt=frame.capturedAt;
  onCapture(job.coin,frame);finish();
 }
 const visibility=()=>{if(document.hidden)finish();else pump();};window.addEventListener('message',message);document.addEventListener('visibilitychange',visibility);
 const timer=setInterval(pump,30000);
 return {
  watch(card,coin,capture,status){cards.set(card,{coin,capturedAt:capture?.capturedAt||0,status,visible:false});observer.observe(card);},
  reset(){for(const card of cards.keys())observer.unobserve(card);cards.clear();finish();},
  close(){closed=true;finish();observer.disconnect();clearInterval(timer);window.removeEventListener('message',message);document.removeEventListener('visibilitychange',visibility);cards.clear();},
 };
}
