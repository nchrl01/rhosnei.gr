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
 let ctx,destination,master,input,space,speechGate,clearTimer,volume=.5,enabled=true,running=false,name='',seed=0,epoch=0,buffer=null,loading=null,source=null,tailActive=false,lastClock=null,musicSince=null,elapsed=0,next=4,cache=new Map(),retryAt=0;
 const runner=backgroundModel('./voice-ai-worker.js?v=65',onStatus,240000);
 // A silent frame must not rebuild a long stereo convolution every 150 ms.
 // Clear only once after actual speech or its tail has entered this room.
 function hold(param,time){if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);else{const value=param.value;param.cancelScheduledValues(time);param.setValueAtTime(value,time);}}
 function hush(){
  if(!tailActive&&!source)return;
  tailActive=false;const retiring=source;source=null;if(retiring)next=elapsed+4;
  const time=ctx.currentTime;hold(speechGate.gain,time);speechGate.gain.linearRampToValueAtTime(0,time+.025);
  if(retiring)try{retiring.stop(time+.03);}catch{}
  clearTimeout(clearTimer);clearTimer=setTimeout(()=>{clearTimer=null;retiring?.disconnect();space?.clear();},50);
 }
 function update(){if(master&&ctx)master.gain.setTargetAtTime(enabled&&running?volume:0,ctx.currentTime,.03);}
 return {
  attach(context,out){if(ctx===context)return;ctx=context;destination=out;master=ctx.createGain();master.gain.value=0;master.connect(destination);speechGate=ctx.createGain();speechGate.gain.value=0;speechGate.connect(master);space=createVoiceReverb(ctx,speechGate);input=space.input;update();},
  setCoin(text,value){hush();epoch++;retryAt=0;name=String(text||'').replace(/[\p{C}<>]/gu,'').trim().slice(0,80);seed=value>>>0;buffer=null;elapsed=0;lastClock=null;next=4+seed%5;musicSince=null;onStatus('Coin whisper · loads with Listen');},
  setMaster(value){volume=Math.max(0,Math.min(1,Number(value)||0));update();},
  setEnabled(value){enabled=Boolean(value);update();if(!enabled)hush();else if(running)void this.prepare();},
  setRunning(value){running=Boolean(value);lastClock=null;musicSince=null;update();if(!running)hush();},
  reset(){hush();elapsed=0;lastClock=null;next=4+seed%5;musicSince=null;},
  async prepare(){if(!ctx||!name||!enabled||loading||buffer||Date.now()<retryAt)return;
   const request={epoch,name,context:ctx};loading=request;
   try{let result=cache.get(request.name);if(!result){result=await runner.request({text:request.name});}
    if(request.epoch!==epoch||request.context!==ctx)return;
    const samples=result.samples;if(!(samples instanceof Float32Array)||!samples.length||samples.length>24000*30||!Number.isFinite(result.rate)||result.rate<8000||result.rate>48000)throw Error('Invalid voice audio');
    let peak=0,power=0;for(const n of samples)if(Number.isFinite(n)){peak=Math.max(peak,Math.abs(n));power+=n*n;}
    if(peak<1e-6)throw Error('Empty voice audio');
    cache.set(request.name,result);if(cache.size>8)cache.delete(cache.keys().next().value);
    // Loudness-normalize the whisper without turning sharp consonants into peaks.
    const rms=Math.sqrt(power/samples.length),trim=Math.min(6,.28/peak,.045/Math.max(rms,1e-6));
    buffer=ctx.createBuffer(1,samples.length,result.rate);buffer.copyToChannel(Float32Array.from(samples,n=>Number.isFinite(n)?n*trim:0),0);onStatus('Coin whisper ready · waiting for accompanying music');
   }catch(error){if(request.epoch===epoch){retryAt=Date.now()+60000;onStatus('Coin voice unavailable · '+error.message+' · Retry');}}
   finally{if(loading===request){loading=null;if(request.epoch!==epoch&&ctx&&enabled&&running)void this.prepare();}}
  },
  retry(){retryAt=0;void this.prepare();},
  frame(m,{playing=false,seeking=false,ended=false,audible=false}={}){
   if(!ctx)return;const active=running&&enabled&&playing&&!seeking&&!ended&&ctx.state==='running';const clock=ctx.currentTime,dt=lastClock===null?0:Math.max(0,clock-lastClock);lastClock=clock;
   if(!active){musicSince=null;hush();return;}elapsed+=Math.min(dt,1);
   // Prepare independently of the speech gate, including after switching coins
   // while the previous name is still being generated.
   if(!buffer)void this.prepare();
   const raw=m.raw||m;
   const moving=(m.fresh||0)>0&&((raw.activity||0)>.005||(m.tradeRate||0)>0||Math.abs(m.music?.changePct||0)>.3||Number(m.replay?.volume)>0);
   // A finite phrase needs actual accompanying music; its own reverb is excluded.
   if(!audible||volume===0){musicSince=null;hush();return;}
   musicSince??=clock;
   if(source||!buffer||!moving||elapsed<next||clock-musicSince<.3)return;
   clearTimeout(clearTimer);clearTimer=null;hold(speechGate.gain,clock);speechGate.gain.linearRampToValueAtTime(1,clock+.02);
   source=ctx.createBufferSource();source.buffer=buffer;const spoken=source;
   source.onended=()=>{spoken.disconnect();if(source===spoken){source=null;next=elapsed+90+seed%50;onStatus('Coin whisper ready · accompanies instruments only');}};
   source.connect(input);source.start();tailActive=true;onStatus('Whispering coin name');

  },
  close(){this.setRunning(false);clearTimeout(clearTimer);clearTimer=null;runner.stop();epoch++;buffer=null;loading=null;musicSince=null;space?.close();space=null;speechGate?.disconnect();speechGate=null;master?.disconnect();master=null;input=null;ctx=null;},
 };
}
