// The local server forwards only whitelisted numeric controls to desktop Pd.
export async function createNativePd(onError,onTelemetry=()=>{}){
 const health=await fetch('/pd/status',{signal:AbortSignal.timeout(2000)}).then(r=>r.ok?r.json():Promise.reject(Error('Start the local AV server to use Native Pd')));
 if(!health.connected||!health.orchestra)throw Error('Open patches/orchestra/av-desktop.pd in Pure Data first');
 let pending=new Map(),flight=null,closed=false,closing=false,closePromise=null,failed=false;
 const subscribers=new Map();let telemetryBusy=false;
 const telemetry=setInterval(async()=>{
  if(closed||closing||telemetryBusy||!subscribers.size)return;telemetryBusy=true;
  try{
   const r=await fetch('/pd/status',{signal:AbortSignal.timeout(1500)});
   if(!r.ok)throw Error('Native telemetry unavailable');
   const report=await r.json();if(closed||closing)return;
   onTelemetry({connected:report.connected&&report.orchestra,running:report.state?.run===1});
   if(!report.connected||!report.orchestra||report.state?.run!==1)return;
   for(const [name,callbacks] of subscribers){const value=report.state[name];if(Number.isFinite(value))for(const callback of callbacks)callback({receiver:name,selector:'float',values:[value]});}
  }catch{if(!closed&&!closing)onTelemetry({connected:false,running:false});}
  finally{telemetryBusy=false;}
 },250);
 function flush(){
  if(flight)return flight;
  if(closed||!pending.size)return Promise.resolve(true);
  flight=(async()=>{
   let delivered=true;
   while(pending.size&&!closed){
    const messages=[...pending];pending.clear();
    try{
     const r=await fetch('/pd/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages}),signal:AbortSignal.timeout(2000)});
     if(!r.ok)throw Error('Native Pd connection unavailable');failed=false;
    }catch(e){delivered=false;if(!failed){failed=true;onError(e);}}
   }
   return delivered;
  })().finally(()=>{flight=null;});
  return flight;
 }
 const timer=setInterval(flush,25);
 return {native:true,sendFloat(name,value){if(!closed&&!closing)pending.set(name,value);},flush,
  subscribe(name,callback){if(!subscribers.has(name))subscribers.set(name,new Set());subscribers.get(name).add(callback);return()=>subscribers.get(name)?.delete(callback);},
  close(){
   if(closePromise)return closePromise;
   closing=true;clearInterval(timer);clearInterval(telemetry);
   // Replace queued controls with the stop packet. The running drain must send
   // this after its current request, and close awaits that entire drain.
   pending.clear();pending.set('run',0);pending.set('master',0);
   closePromise=(async()=>{let delivered=await flush();while(pending.size)delivered=(await flush())&&delivered;return delivered;})().finally(()=>{closed=true;subscribers.clear();onTelemetry({connected:false,running:false});});
   return closePromise;
  }
 };
}
