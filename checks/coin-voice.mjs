// Controller regression checks with generated PCM; no model, GUI or audio device.
import assert from 'node:assert/strict';
import {createCoinVoice} from '../public/ai-instruments.js';
const workers=[];let defer=false;
class WorkerStub{
 constructor(){workers.push(this);this.pending=[];}
 postMessage(data){this.pending.push(data);if(!defer)queueMicrotask(()=>this.resolve());}
 resolve(){const data=this.pending.shift();assert.ok(data);this.onmessage({data:{id:data.id,rate:24000,samples:Float32Array.from({length:2400},(_,i)=>Math.sin(i*.08)*.08)}});}
 terminate(){}
}
globalThis.Worker=WorkerStub;
const param=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},cancelAndHoldAtTime(){},cancelScheduledValues(){}});
function context(){
 const sources=[];const node=()=>({gain:param(),frequency:param(),delayTime:param(),connect(){},disconnect(){}});
 return {currentTime:0,sampleRate:24000,state:'running',sources,createGain:node,createDelay:node,createConvolver:node,createBiquadFilter:node,
 createBuffer(channels,length,rate){const rows=Array.from({length:channels},()=>new Float32Array(length));return {length,duration:length/rate,getChannelData:i=>rows[i],copyToChannel:(data,i)=>rows[i].set(data)};},
 createBufferSource(){const n={...node(),start(){n.started=true;},stop(){n.stopped=true;}};sources.push(n);return n;}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const m={fresh:1,raw:{activity:.2},music:{intensity:.01,changePct:.01}};
const ctx=context(),voice=createCoinVoice();voice.attach(ctx,{});voice.setCoin('Quietly traded coin',1);voice.setRunning(true);await voice.prepare();
function advance(seconds,opts={}){for(let i=0;i<Math.ceil(seconds/.2);i++){ctx.currentTime+=.2;voice.frame(m,{playing:true,audible:true,...opts});}}
advance(8);assert.equal(ctx.sources.length,1,'Active trading can introduce the voice even with a small price change');
advance(.2,{audible:false});assert.equal(ctx.sources[0].stopped,true,'No solo voice after accompanying music stops');
advance(5);assert.equal(ctx.sources.length,2,'Interrupted speech retries without a two-minute lockout');
ctx.sources[1].onended();advance(5);assert.equal(ctx.sources.length,2,'A complete phrase keeps the occasional-voice cooldown');
voice.setRunning(false);advance(150);assert.equal(ctx.sources.length,2,'Paused voice cannot start');voice.close();
// A coin change during synthesis must hand off to the new name automatically.
defer=true;const c2=context(),v2=createCoinVoice();v2.attach(c2,{});v2.setRunning(true);v2.setCoin('First',1);const preparing=v2.prepare();const worker=workers.at(-1);
v2.setCoin('Second',2);worker.resolve();await preparing;await tick();assert.equal(worker.pending[0].text,'Second','New coin must load after obsolete generation finishes');worker.resolve();await tick();
for(let i=0;i<40;i++){c2.currentTime+=.2;v2.frame(m,{playing:true,audible:true});}assert.equal(c2.sources.length,1);v2.close();
console.log('PASS: voice activity gate, interruption retry, completed cooldown, pause and coin switch');
