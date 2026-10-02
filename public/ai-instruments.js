import {createVoiceReverb} from './voice-space.js?v=57';
const KEY='av.ai-arps.v1';
export function validArp(pattern){return Array.isArray(pattern)&&pattern.length>=3&&pattern.length<=16&&pattern.every(row=>Array.isArray(row)&&row.length===2&&Number.isInteger(row[0])&&row[0]>=0&&row[0]<16&&Number.isInteger(row[1])&&row[1]>=48&&row[1]<=83)&&pattern.every((row,i)=>!i||row[0]>pattern[i-1][0]);}
export function seededArp(seed){const notes=seed%2?[60,67,63,72,67,63,60,67]:[60,64,67,72,67,64,60,67];return notes.map((n,i)=>[i,n]);}
function backgroundModel(path,onStatus,timeout){
 let worker,id=0,job,timer;
 function stop(){worker?.terminate();worker=null;clearTimeout(timer);const pending=job;job=null;pending?.reject(Error('Model cancelled'));}
 return {request(payload){
  if(job)return Promise.reject(Error('Model busy'));
  if(!worker){worker=new Worker(new URL(path,import.meta.url),{type:'module'});worker.onmessage=({data})=>{if(data.status)onStatus(data.status);if(!job||data.id!==job.id)return;const pending=job;job=null;clearTimeout(timer);if(data.error){worker.terminate();worker=null;pending.reject(Error(data.error));}else pending.resolve(data);};worker.onerror=e=>{onStatus('Model unavailable · click Retry');stop();};}
  return new Promise((resolve,reject)=>{job={id:++id,resolve,reject};worker.postMessage({...payload,id});timer=setTimeout(()=>{onStatus('Model download timed out · click Retry');stop();},timeout);});
 },stop};
}
export function createArpeggioAI({onStatus=()=>{},onPattern=()=>{}}={}){
 let cache=new Map(),seed=0,epoch=0,pattern=seededArp(0),source='seeded',loading=false,retryAt=0;
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');cache=new Map(saved.filter(([s,p])=>Number.isInteger(s)&&validArp(p)).slice(-64));}catch{}
 const runner=backgroundModel('./arp-ai-worker.js?v=56',text=>{if(source!=='frozen')onStatus(text);},150000);
 function publish(){onPattern(pattern,source);}
 return {
  setSeed(value,frozen){epoch++;retryAt=0;seed=value>>>0;pattern=validArp(frozen)?frozen:cache.get(seed)||seededArp(seed);source=validArp(frozen)?'frozen':cache.has(seed)?'ai':'seeded';publish();onStatus(source==='seeded'?'Seeded arpeggios · AI loads with Listen':source==='frozen'?'Frozen arpeggio score':'AI arpeggios ready');},
  async prepare(){if(source!=='seeded'||loading||Date.now()<retryAt)return;loading=true;const token=epoch,current=seed;
   try{const result=await runner.request({seed:current});if(!validArp(result.pattern))throw Error('Invalid musical phrase');cache.delete(current);cache.set(current,result.pattern);if(cache.size>64)cache.delete(cache.keys().next().value);try{localStorage.setItem(KEY,JSON.stringify([...cache]));}catch{}if(token===epoch){pattern=result.pattern;source='ai';publish();}}
   catch{retryAt=Date.now()+60000;if(token===epoch)onStatus('AI unavailable · seeded arpeggios active · Retry');}
   finally{loading=false;}
  },
  retry(){retryAt=0;void this.prepare();},
  snapshot(){return pattern.map(row=>[...row]);},
  close(){runner.stop();loading=false;},
 };
}
export function createCoinVoice({onStatus=()=>{}}={}){
 let ctx,destination,master,input,space,volume=.5,enabled=true,running=false,name='',seed=0,epoch=0,buffer=null,loading=false,source=null,lastClock=null,elapsed=0,next=12,cache=new Map(),retryAt=0;
 const runner=backgroundModel('./voice-ai-worker.js?v=56',onStatus,240000);
 function hush(){if(source){try{source.stop();}catch{}source.disconnect();source=null;}space?.clear();}
 function update(){if(master&&ctx)master.gain.setTargetAtTime(enabled&&running?volume:0,ctx.currentTime,.03);}
 return {
  attach(context,out){if(ctx===context)return;ctx=context;destination=out;master=ctx.createGain();master.gain.value=0;master.connect(destination);space=createVoiceReverb(ctx,master);input=space.input;update();},
  setCoin(text,value){hush();epoch++;retryAt=0;name=String(text||'').replace(/[\p{C}<>]/gu,'').trim().slice(0,80);seed=value>>>0;buffer=null;elapsed=0;lastClock=null;next=12+seed%8;onStatus('Coin voice · loads with Listen');},
  setMaster(value){volume=Math.max(0,Math.min(1,Number(value)||0));update();},
  setEnabled(value){enabled=Boolean(value);update();if(!enabled)hush();else if(running)void this.prepare();},
  setRunning(value){running=Boolean(value);lastClock=null;update();if(!running)hush();},
  reset(){hush();elapsed=0;lastClock=null;next=12+seed%8;},
  async prepare(){if(!ctx||!name||!enabled||loading||buffer||Date.now()<retryAt)return;loading=true;const token=epoch,current=name;
   try{let result=cache.get(current);if(!result){result=await runner.request({text:current});cache.set(current,result);if(cache.size>8)cache.delete(cache.keys().next().value);}
    if(token!==epoch)return;const samples=result.samples;if(!(samples instanceof Float32Array)||!samples.length||samples.length>24000*30||!Number.isFinite(result.rate)||result.rate<8000||result.rate>48000)throw Error('Invalid voice audio');
    buffer=ctx.createBuffer(1,samples.length,result.rate);let peak=0;for(const n of samples)if(Number.isFinite(n))peak=Math.max(peak,Math.abs(n));const trim=peak>0?Math.min(3,.28/peak):1;buffer.copyToChannel(Float32Array.from(samples,n=>Number.isFinite(n)?n*trim:0),0);onStatus('Coin voice ready · moving markets only');
   }catch{retryAt=Date.now()+60000;if(token===epoch)onStatus('Coin voice unavailable · click Retry');}
   finally{loading=false;}
  },
  retry(){retryAt=0;void this.prepare();},
  frame(m,{playing=false,seeking=false,ended=false}={}){
   if(!ctx)return;const active=running&&enabled&&playing&&!seeking&&!ended&&ctx.state==='running';const clock=ctx.currentTime,dt=lastClock===null?0:Math.max(0,clock-lastClock);lastClock=clock;
   if(!active){hush();return;}elapsed+=dt;
   // Both % movement and contextual intensity must be present. Quiet markets
   // never become a timed announcement loop; each call is one finite name.
   const moving=(m.fresh||0)>0&&(m.music?.intensity||0)>.035&&Math.abs(m.music?.changePct||0)>.3;
   if(!moving){hush();return;}
   if(!buffer){void this.prepare();return;}
   if(elapsed<next||source)return;
   source=ctx.createBufferSource();source.buffer=buffer;const spoken=source;source.onended=()=>{spoken.disconnect();if(source===spoken)source=null;};source.connect(input);source.start();next=elapsed+110+seed%50;
  },
  close(){this.setRunning(false);runner.stop();epoch++;buffer=null;loading=false;space?.close();space=null;master?.disconnect();master=null;input=null;ctx=null;},
 };
}
