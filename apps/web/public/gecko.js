// One shared free-provider budget: foreground chart/live work precedes backfill.
// Provider docs differ (10 vs 30 requests/min); use the conservative 10/min rate.
const SPACING=6000,queue=[],jobs=new Map();let nextRequest=0,timer;
function retryDelay(response){
 const header=response.headers.get('Retry-After'),seconds=Number(header);
 return header&&Number.isFinite(seconds)?Math.max(0,seconds*1000):header&&Number.isFinite(Date.parse(header))?Math.max(0,Date.parse(header)-Date.now()):60000;
}
function drain(){
 clearTimeout(timer);if(!queue.length)return;
 const wait=nextRequest-Date.now();if(wait>0){timer=setTimeout(drain,wait);return;}
 const now=Date.now();queue.sort((a,b)=>(b.priority+Math.min(30,(now-b.queuedAt)/1000))-(a.priority+Math.min(30,(now-a.queuedAt)/1000))||a.queuedAt-b.queuedAt);
 const job=queue.shift();if(!job.consumers.size){drain();return;}
 job.started=true;nextRequest=Date.now()+SPACING;let retry=false;
 // URL validation and request setup share the same rejection/cleanup path.
 Promise.resolve().then(()=>fetch(job.url,{signal:job.controller.signal})).then(response=>{
  const delay=!response.ok&&(response.status===429||response.headers.has('Retry-After'))?retryDelay(response):null;
  if(delay!==null)nextRequest=Math.max(nextRequest,Date.now()+delay);
  // A short provider quota wait keeps this job and its joined
  // consumers queued, with the same six-second budget and cancellation signal.
  if(response.status===429&&delay<=10000&&job.retries<3&&job.consumers.size&&!job.controller.signal.aborted){
   job.retries++;retry=true;response.body?.cancel().catch(()=>{});return;
  }
  if(jobs.get(job.url)===job)jobs.delete(job.url);
  for(const consumer of job.consumers){consumer.cleanup();consumer.resolve(response.clone());}
 }).catch(error=>{retry=false;if(jobs.get(job.url)===job)jobs.delete(job.url);for(const consumer of job.consumers){consumer.cleanup();consumer.reject(error);}}).finally(()=>{
  if(retry&&job.consumers.size&&!job.controller.signal.aborted){job.started=false;queue.push(job);}
  else{job.consumers.clear();if(jobs.get(job.url)===job)jobs.delete(job.url);}
  drain();
 });
 drain();
}
export function fetchGecko(url,{signal,priority=40}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
  let job=jobs.get(url);
  if(!job){job={url,priority,queuedAt:Date.now(),started:false,retries:0,controller:new AbortController(),consumers:new Set()};jobs.set(url,job);queue.push(job);}
  job.priority=Math.max(job.priority,priority);
  const consumer={resolve,reject,cleanup:()=>signal?.removeEventListener('abort',cancel)};
  const cancel=()=>{
   consumer.cleanup();job.consumers.delete(consumer);reject(new DOMException('Aborted','AbortError'));
   if(!job.consumers.size){const index=queue.indexOf(job);if(index>=0)queue.splice(index,1);job.controller.abort();if(jobs.get(url)===job)jobs.delete(url);}
   drain();
  };
  job.consumers.add(consumer);signal?.addEventListener('abort',cancel,{once:true});queueMicrotask(drain);
 });
}
