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
 job.started=true;nextRequest=Date.now()+SPACING;
 fetch(job.url,{signal:job.controller.signal}).then(response=>{
  if(response.status===429)nextRequest=Math.max(nextRequest,Date.now()+retryDelay(response));
  if(jobs.get(job.url)===job)jobs.delete(job.url);
  for(const consumer of job.consumers){consumer.cleanup();consumer.resolve(response.clone());}
 },error=>{if(jobs.get(job.url)===job)jobs.delete(job.url);for(const consumer of job.consumers){consumer.cleanup();consumer.reject(error);}}).finally(()=>{
  job.consumers.clear();if(jobs.get(job.url)===job)jobs.delete(job.url);drain();
 });
 drain();
}
export function fetchGecko(url,{signal,priority=40}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
  let job=jobs.get(url);
  if(!job){job={url,priority,queuedAt:Date.now(),started:false,controller:new AbortController(),consumers:new Set()};jobs.set(url,job);queue.push(job);}
  job.priority=Math.max(job.priority,priority);
  const consumer={resolve,reject,cleanup:()=>signal?.removeEventListener('abort',cancel)};
  const cancel=()=>{
   consumer.cleanup();job.consumers.delete(consumer);reject(new DOMException('Aborted','AbortError'));
   if(!job.consumers.size){const index=queue.indexOf(job);if(index>=0)queue.splice(index,1);job.controller.abort();if(jobs.get(url)===job)jobs.delete(url);}
   drain();
  };
  job.consumers.add(consumer);signal?.addEventListener('abort',cancel,{once:true});drain();
 });
}
