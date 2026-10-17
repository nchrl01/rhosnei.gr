import {chartHarmony} from './harmonic-characters.js?v=208';
const KEY='av.ai-arps.v3';
export function validArp(pattern){return Array.isArray(pattern)&&pattern.length>=3&&pattern.length<=16&&pattern.every(row=>Array.isArray(row)&&row.length===2&&Number.isInteger(row[0])&&row[0]>=0&&row[0]<16&&Number.isInteger(row[1])&&row[1]>=48&&row[1]<=83)&&pattern.every((row,i)=>!i||row[0]>pattern[i-1][0]);}
export function seededArp(seed){
 let state=(Number(seed)^0x9e3779b9)>>>0;
 const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const rhythms=[[0,2,4,6,8,10,12,14],[0,3,6,8,11,14],[0,1,4,6,8,9,12,15],[0,2,5,7,10,12,14],[0,4,7,8,12,15],[0,2,3,6,8,10,11,14]];
 const contours=[[0,1,2,3,2,1,0,2],[3,2,1,0,1,2,3,1],[0,2,1,3,1,2,0,1],[0,1,0,2,0,3,2,1],[1,3,2,0,2,1,3,0],[0,3,1,2,3,0,2,1]];
 const rhythm=rhythms[Math.floor(rand()*rhythms.length)],shape=contours[Math.floor(rand()*contours.length)],rotation=Math.floor(rand()*8),tones=[60,64,67,72,76],lift=rand()>.6?1:0;
 return rhythm.map((tick,i)=>[tick,tones[Math.min(4,shape[(i+rotation)%8]+lift)]]);
}

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
 let cache=new Map(),seed=0,epoch=0,pattern=seededArp(0),source='seeded',loading=false,retryAt=0,context={character:'serene',tonic:48};
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');cache=new Map(saved.filter(([s,p])=>Number.isInteger(s)&&validArp(p)).slice(-64));}catch{}
 const runner=backgroundModel('./arp-ai-worker.js?v=209',text=>{if(source!=='frozen')onStatus(text);},150000);
 function publish(){onPattern(pattern,source);}
 return {
  setSeed(value,frozen){epoch++;retryAt=0;seed=value>>>0;pattern=validArp(frozen)?frozen:cache.get(seed)||seededArp(seed);source=validArp(frozen)?'frozen':cache.has(seed)?'ai':'seeded';publish();onStatus(source==='seeded'?'Seeded arpeggios · AI is optional':source==='frozen'?'Frozen arpeggio score':'AI arpeggios ready');},
  setContext(music={}){context={...music};},
  freezeScore(){
   const key='upic.replay-arps.v1:'+seed;let saved;
   try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{}
   if(!validArp(saved)){saved=this.snapshot();try{localStorage.setItem(key,JSON.stringify(saved));}catch{}}
   this.setSeed(seed,saved);
  },
  async prepare(){if(source!=='seeded'||loading||Date.now()<retryAt)return;loading=true;const token=epoch,current=seed;
   try{const result=await runner.request({seed:current,chords:modelChords(context),minor:context.group==='down'});if(!validArp(result.pattern))throw Error('Invalid musical phrase');cache.delete(current);cache.set(current,result.pattern);if(cache.size>64)cache.delete(cache.keys().next().value);try{localStorage.setItem(KEY,JSON.stringify([...cache]));}catch{}if(token===epoch){pattern=result.pattern;source='ai';publish();}}
   catch(error){if(error.name!=='AbortError'){retryAt=Date.now()+60000;if(token===epoch)onStatus('AI unavailable · seeded arpeggios active · Retry');}}
   finally{loading=false;}
  },
  retry(){retryAt=0;void this.prepare();},
  snapshot(){return pattern.map(row=>[...row]);},
  suspend(){runner.stop();},
  close(){runner.stop();loading=false;},
 };
}

function modelChords(music){
 const plan=chartHarmony(music.character||'serene',music);
 return plan.chords.map(notes=>{const intervals=notes.map(n=>(n-notes[0]+12)%12),root=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][((notes[0]%12)+12)%12];return root+(intervals.includes(3)?intervals.includes(6)?'dim':'m':'');});
}
