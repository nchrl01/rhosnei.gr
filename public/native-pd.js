// The local server forwards only whitelisted numeric controls to desktop Pd.
export async function createNativePd(onError){
 const health=await fetch('/pd/status').then(r=>r.ok?r.json():Promise.reject(Error('Start the local AV server to use Native Pd')));
 if(!health.connected)throw Error('Open av-desktop.pd in Pure Data first');
 let pending=new Map(),busy=false,closed=false,failed=false;
 async function flush(){
  if(busy||closed||!pending.size)return;busy=true;
  const messages=[...pending];pending.clear();
  try{const r=await fetch('/pd/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages}),signal:AbortSignal.timeout(2000)});if(!r.ok)throw Error('Native Pd connection unavailable');failed=false;}
  catch(e){if(!failed){failed=true;onError(e);}}
  finally{busy=false;if(pending.size&&!closed)queueMicrotask(flush);}
 }
 const timer=setInterval(flush,25);
 return {native:true,sendFloat(name,value){pending.set(name,value);},flush,
  async close(){pending.set('run',0);pending.set('master',0);await flush();closed=true;clearInterval(timer);}
 };
}
