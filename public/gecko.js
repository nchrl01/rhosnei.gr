// Share the public provider's request budget between trade and history requests.
let nextRequest=0,timer;const queue=[];
function drain(){
 clearTimeout(timer);if(!queue.length)return;
 const wait=nextRequest-Date.now();if(wait>0){timer=setTimeout(drain,wait);return;}
 const item=queue.shift();item.signal?.removeEventListener('abort',item.cancel);
 if(item.signal?.aborted){item.reject(new DOMException('Aborted','AbortError'));drain();return;}
 nextRequest=Date.now()+8000;item.resolve(fetch(item.url,{signal:item.signal}));drain();
}
export function fetchGecko(url,{signal}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
  const item={url,signal,resolve,reject};
  item.cancel=()=>{const index=queue.indexOf(item);if(index>=0)queue.splice(index,1);reject(new DOMException('Aborted','AbortError'));drain();};
  signal?.addEventListener('abort',item.cancel,{once:true});queue.push(item);drain();
 });
}
