const KEY='av.ai-arps.v2';
export function validArp(pattern){return Array.isArray(pattern)&&pattern.length>=3&&pattern.length<=16&&pattern.every(row=>Array.isArray(row)&&row.length===2&&Number.isInteger(row[0])&&row[0]>=0&&row[0]<16&&Number.isInteger(row[1])&&row[1]>=48&&row[1]<=83)&&pattern.every((row,i)=>!i||row[0]>pattern[i-1][0]);}
export function seededArp(seed){const notes=seed%2?[60,67,63,72,67,63,60,67]:[60,64,67,72,67,64,60,67];return notes.map((n,i)=>[i,n]);}
function backgroundModel(path,onStatus,timeout){
 let worker,id=0,job,timer;
 function stop(reason){worker?.terminate();worker=null;clearTimeout(timer);const pending=job;job=null;pending?.reject(reason||new DOMException('Model cancelled','AbortError'));}
 return {request(payload){
  if(job)return Promise.reject(Error('Model busy'));
  if(!worker){worker=new Worker(new URL(path,import.meta.url),{type:'module'});worker.onmessage=({data})=>{if(data.status)onStatus(data.status);if(!job||data.id!==job.id)return;const pending=job;job=null;clearTimeout(timer);if(data.error){worker.terminate();worker=null;pending.reject(Error(data.error));}else pending.resolve(data);};worker.onerror=e=>{onStatus('Model unavailable · click Retry');stop(Error('Model unavailable'));};}
  return new Promise((resolve,reject)=>{job={id:++id,resolve,reject};try{worker.postMessage({...payload,id});}catch(error){stop(error);return;}timer=setTimeout(()=>{onStatus('Model download timed out · click Retry');stop(Error('Model timed out'));},timeout);});
 },stop};
}
export function createArpeggioAI({onStatus=()=>{},onPattern=()=>{}}={}){
 let cache=new Map(),seed=0,epoch=0,pattern=seededArp(0),source='seeded',loading=false,retryAt=0;
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');cache=new Map(saved.filter(([s,p])=>Number.isInteger(s)&&validArp(p)).slice(-64));}catch{}
 const runner=backgroundModel('./arp-ai-worker.js?v=146',text=>{if(source!=='frozen')onStatus(text);},150000);
 function publish(){onPattern(pattern,source);}
 return {
  setSeed(value,frozen){epoch++;retryAt=0;seed=value>>>0;pattern=validArp(frozen)?frozen:cache.get(seed)||seededArp(seed);source=validArp(frozen)?'frozen':cache.has(seed)?'ai':'seeded';publish();onStatus(source==='seeded'?'Seeded arpeggios · AI loads with Listen':source==='frozen'?'Frozen arpeggio score':'AI arpeggios ready');},
  freezeScore(){
   const key='upic.replay-arps.v1:'+seed;let saved;
   try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{}
   if(!validArp(saved)){saved=this.snapshot();try{localStorage.setItem(key,JSON.stringify(saved));}catch{}}
   this.setSeed(seed,saved);
  },
  async prepare(){if(source!=='seeded'||loading||Date.now()<retryAt)return;loading=true;const token=epoch,current=seed;
   try{const result=await runner.request({seed:current});if(!validArp(result.pattern))throw Error('Invalid musical phrase');cache.delete(current);cache.set(current,result.pattern);if(cache.size>64)cache.delete(cache.keys().next().value);try{localStorage.setItem(KEY,JSON.stringify([...cache]));}catch{}if(token===epoch){pattern=result.pattern;source='ai';publish();}}
   catch(error){if(error.name!=='AbortError'){retryAt=Date.now()+60000;if(token===epoch)onStatus('AI unavailable · seeded arpeggios active · Retry');}}
   finally{loading=false;}
  },
  retry(){retryAt=0;void this.prepare();},
  snapshot(){return pattern.map(row=>[...row]);},
  suspend(){runner.stop();},
  close(){runner.stop();loading=false;},
 };
}
