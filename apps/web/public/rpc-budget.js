// One request in flight; all Robinhood subscriptions share this budget.
const queue=[];
let active=false,nextAt=0,timer;
const spacing=750;
function cooldown(response){
 const value=response?.headers.get('Retry-After'),seconds=Number(value);
 const delay=value&&Number.isFinite(seconds)?seconds*1000:value&&Number.isFinite(Date.parse(value))?Date.parse(value)-Date.now():30000;
 nextAt=Math.max(nextAt,Date.now()+Math.max(1000,delay));
}
function drain(){
 clearTimeout(timer);
 if(active||!queue.length)return;
 const wait=nextAt-Date.now();if(wait>0){timer=setTimeout(drain,wait);return;}
 queue.sort((a,b)=>(b.priority+(Date.now()-b.at)/1000)-(a.priority+(Date.now()-a.at)/1000));
 const job=queue.shift();job.signal?.removeEventListener('abort',job.cancel);
 if(job.signal?.aborted){job.reject(new DOMException('Aborted','AbortError'));drain();return;}
 active=true;nextAt=Date.now()+spacing;
 job.run().then(job.resolve,job.reject).finally(()=>{active=false;drain();});
}
export function budgetedRPC(url,method,params,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
  const job={resolve,reject,signal,priority:method==='eth_getBlockByNumber'?0:20,at:Date.now()};
  job.cancel=()=>{const index=queue.indexOf(job);if(index>=0){queue.splice(index,1);reject(new DOMException('Aborted','AbortError'));}signal?.removeEventListener('abort',job.cancel);drain();};
  job.run=async()=>{
   const controller=new AbortController(),abort=()=>controller.abort();
   signal?.addEventListener('abort',abort,{once:true});
   const timeout=setTimeout(abort,12000);
   try{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:controller.signal});
    if(response.status===429||response.status===503)cooldown(response);
    if(!response.ok)throw Error('Robinhood RPC HTTP '+response.status);
    const data=await response.json();
    if(data.error){if(/rate|too many|quota|limit exceeded/i.test(data.error.message||''))cooldown(response);throw Error(data.error.message||'RPC request failed');}
    return data.result;
   }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
  };
  signal?.addEventListener('abort',job.cancel,{once:true});queue.push(job);drain();
 });
}
