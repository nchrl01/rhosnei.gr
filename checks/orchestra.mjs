import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {orchestraTargets,orchestraParameters,ORCHESTRA_LAYERS} from '../public/orchestra.js';
const m={activity:.8,volume:.8,motion:.6,texture:.7,fresh:1,balance:.5};
for(let phrase=0;phrase<4;phrase++){
 const t=orchestraTargets(m,true,phrase);
 assert.ok(Math.abs(ORCHESTRA_LAYERS.reduce((sum,k)=>sum+t[k],0)-.72)<1e-9);
 for(const k of ORCHESTRA_LAYERS)assert.equal(orchestraTargets({...m,fresh:0},false,phrase)[k],0);
}
const events=[];let Processor,readyResolve,readyReject;
const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
const context=vm.createContext({console,performance,TextDecoder,TextEncoder,setTimeout,clearTimeout,sampleRate:48000,
 AudioWorkletProcessor:class{constructor(){this.port={postMessage:e=>{events.push(e);if(e.type==='ready')readyResolve();if(e.type==='error')readyReject(Error(e.message));}};}},
 registerProcessor:(name,klass)=>Processor=klass});
vm.runInContext(await fs.readFile(new URL('../public/vendor/libpd-worklet.js',import.meta.url),'utf8'),context);
const pd=new Processor();await ready;
const base=new URL('../public/patches/orchestra/',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',base),'utf8'));
const files=await Promise.all(manifest.files.map(async name=>({path:'orchestra/'+name,content:await fs.readFile(new URL(name,base),'utf8')})));
pd._onMessage({type:'load',files,openPath:'orchestra/market.pd'});
const send=(receiver,value)=>pd._onMessage({type:'float',receiver,value});
for(const receiver of ['generation','av-tone-voice','av-poly-voice','av-perc-voice','av-output-left','av-output-right'])pd._onMessage({type:'bind',receiver});
for(const [key,value] of Object.entries({...orchestraParameters(m),tempo:120,tonic:48,texture:.7,motion:.6,activity:.8,energy:.8,balance:.5,seed:123,master:.8,run:1}))send(key,value);
const left=new Float32Array(128),right=new Float32Array(128),times=[];
function render(seconds){let square=0,peak=0;const n=Math.ceil(seconds*48000/128);for(let i=0;i<n;i++){const start=performance.now();pd.process([],[[left,right]]);times.push(performance.now()-start);for(const channel of [left,right])for(const x of channel){assert.ok(Number.isFinite(x));square+=x*x;peak=Math.max(peak,Math.abs(x));}}return {rms:Math.sqrt(square/(n*256)),peak};}
const results={};
for(const layer of ORCHESTRA_LAYERS){for(const k of ORCHESTRA_LAYERS)send(k,k===layer?.5:0);results[layer]=render(5);assert.ok(results[layer].rms>1e-6,layer+' must produce audio');}
for(const [k,v] of Object.entries(orchestraTargets(m,true)))send(k,v);
results.ensemble=render(5);send('run',0);render(1);results.stopped=render(1);assert.equal(results.stopped.peak,0);
send('run',1);send('master',0);render(1);assert.equal(render(1).peak,0);
const errors=events.filter(e=>e.type==='error'||e.type==='print'&&/error|couldn't create|connection failed|no such object/i.test(e.text));assert.deepEqual(errors,[]);
for(const receiver of ['generation','av-tone-voice','av-poly-voice','av-perc-voice','av-output-left'])assert.ok(events.some(e=>e.receiver===receiver),'feedback '+receiver);
times.sort((a,b)=>a-b);
console.log(JSON.stringify({results,processMs:{median:times[Math.floor(times.length*.5)],p99:times[Math.floor(times.length*.99)]},feedback:events.filter(e=>e.type==='recv-float').length},null,2));
