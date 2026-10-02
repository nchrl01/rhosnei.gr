// Actual libpd WASM checks. No browser, GUI, speakers, or audio device is opened.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createPd} from '../public/vendor/libpd-wasm.js';
import {decodePdBytes,decodeWave,applyEnvionMarket} from '../public/envion.js';
const PUBLIC=new URL('../public/',import.meta.url),ROOT='orchestra/envion/';
export async function createEnvionHarness({sampleRate=44100,entry,extraFiles={}}={}) {
 const events=[],requests=[],times=[];let Processor,nodePort,namespace=0,pd;
 const context=vm.createContext({console,performance,TextDecoder,TextEncoder,setTimeout,clearTimeout,sampleRate,
  AudioWorkletProcessor:class{constructor(){this.port={postMessage:e=>{events.push(e);queueMicrotask(()=>nodePort?.onmessage?.({data:e}));}};}},registerProcessor:(_name,klass)=>Processor=klass});
 vm.runInContext(await fs.readFile(new URL('vendor/libpd-worklet-full.js',PUBLIC),'utf8'),context);
 const RealmBytes=vm.runInContext('Uint8Array',context);
 const intoRealm=msg=>({...msg,...(msg.content instanceof Uint8Array?{content:new RealmBytes(msg.content)}:{}),...(msg.files?{files:msg.files.map(f=>({...f,...(f.content instanceof Uint8Array?{content:new RealmBytes(f.content)}:{})}))}:{})});
 // createPd uses the same wrapper and namespace conversion as the website.
 const originalNode=globalThis.AudioWorkletNode;
 globalThis.AudioWorkletNode=class{constructor(){this.port=nodePort={onmessage:null,postMessage:msg=>queueMicrotask(()=>this.processor._onMessage(intoRealm(msg)))};this.processor=new Processor();}connect(){}disconnect(){}};
 const orchestra=JSON.parse(await fs.readFile(new URL('patches/orchestra/manifest.json',PUBLIC),'utf8'));
 const envion=JSON.parse(await fs.readFile(new URL('patches/envion/manifest.json',PUBLIC),'utf8'));
 const files={};
 for(const name of orchestra.files)files['orchestra/'+name]=await fs.readFile(new URL('patches/orchestra/'+name,PUBLIC),'utf8');
 for(const name of envion.files)files[ROOT+name]=await fs.readFile(new URL('patches/envion/'+name,PUBLIC),'utf8');
 for(const name of envion.initialAssets)files[ROOT+name]=name.endsWith('.pd')?await fs.readFile(new URL('patches/envion/'+name,PUBLIC),'utf8'):new Uint8Array(await fs.readFile(new URL('patches/envion/'+name,PUBLIC)));
 Object.assign(files,extraFiles);
 const pending=new Set(),requestErrors=[];
 async function stageRead(atoms) {
  const [id,method,...args]=atoms;
  // These are the original soundfiler reads, using -resize in the source.
  const fileIndex=args.findIndex(arg=>!arg.startsWith('-')&&!/^[-+]?\d+(?:\.\d+)?$/.test(arg));
  assert.ok(fileIndex>=0,'read request must identify its file');
  let requested=args[fileIndex],relative=requested.replace(/^\/patches\/orchestra\/envion\//,'');
  relative=relative.replace(/^\.\//,'');
  if(!files[ROOT+relative]) {
   const raw=await fs.readFile(new URL('patches/envion/'+relative,PUBLIC));
   files[ROOT+relative]=new Uint8Array(raw);await pd.writeFile(ROOT+relative,new Uint8Array(raw));
  }
  args[fileIndex]='/patches/'+ROOT+relative;
  pd.sendMessage(id+'-soundfile-ready',method,args.map(a=>/^[-+]?\d+(?:\.\d+)?$/.test(a)?Number(a):a));
  requests.push({id,method,path:relative});
 }
 let recordingPath;
 function printed(text) {
  const record=decodePdBytes(text,'av-envion-recorder-bytes');
  if(record){
   if(record[0]==='open'){recordingPath=record.at(-1).replace(/^\/patches\//,'');return;}
   const task=(record[0]==='start'?pd.startRecording(recordingPath):record[0]==='stop'?pd.stopRecording():Promise.resolve()).catch(error=>requestErrors.push(error));pending.add(task);task.finally(()=>pending.delete(task));return;
  }
  const atoms=decodePdBytes(text,'av-envion-soundfile-bytes');
  if(!atoms)return;
  const task=Promise.resolve().then(()=>stageRead(atoms)).catch(error=>requestErrors.push(error));pending.add(task);task.finally(()=>pending.delete(task));
 }
 try {pd=await createPd({audioContext:{audioWorklet:{addModule:async()=>{}},destination:{}},packages:['vanilla','cyclone','else'],files,entry:entry||'orchestra/'+orchestra.entry,workletUrl:'headless',onPrint:printed});}
 finally{globalThis.AudioWorkletNode=originalNode;}
 const processor=pd.node.processor,left=new Float32Array(128),right=new Float32Array(128);
 function process(seconds) {
  let square=0,peak=0;const blocks=Math.ceil(seconds*sampleRate/128);
  for(let i=0;i<blocks;i++){const start=performance.now();processor.process([],[[left,right]]);times.push(performance.now()-start);for(const channel of [left,right])for(const value of channel){assert.ok(Number.isFinite(value),'DSP output must stay finite');square+=value*value;peak=Math.max(peak,Math.abs(value));}}
  return {rms:Math.sqrt(square/(blocks*256)),peak};
 }
 async function flush() {for(let i=0;i<10;i++){await Promise.resolve();if(pending.size)await Promise.all([...pending]);else if(i>2)break;}if(requestErrors.length)throw requestErrors[0];}
 async function render(seconds){await flush();const result=process(seconds);await flush();return result;}
 pd.subscribe('av-envion-id',m=>namespace=Number(m.values[0]));
 pd.subscribe('av-envion-stop-request',()=>{if(namespace)pd.sendFloat(namespace+'-met0',0);});
 for(const receiver of ['av-envion-voice','av-envion-sample-frames','av-output-left','av-output-right','generation','av-tone-voice','av-poly-voice','av-perc-voice','av-envion-value-c0-72','av-envion-value-c0-350','av-envion-value-c0-355','av-envion-value-c0-356'])pd.subscribe(receiver,()=>{});
 async function initialize() {
  pd.sendFloat('run',0);pd.sendFloat('av-envion-ready',0);pd.sendBang('av-envion-identify');await render(.03);
  assert.ok(namespace>0,'original Envion namespace must be announced');
  pd.sendBang('av-envion-main-preset');await flush();await render(.1);
  pd.sendFloat(namespace+'-met0',0);pd.sendFloat('av-envion-market',1);pd.sendFloat('av-envion-ready',1);await flush();
 }
 function seriousErrors(){return events.filter(e=>e.type==='error'||e.type==='print'&&/error|couldn't create|connection failed|no such object|no matching send/i.test(e.text)&&!/is deprecated/.test(e.text));}
 async function assertClean() {const errors=seriousErrors();if(errors.length){const log=path.join(os.tmpdir(),'av-envion-check.log');await fs.writeFile(log,events.filter(e=>e.type==='print'||e.type==='error').map(e=>e.text||e.message).join('\n'));assert.fail(`Pd diagnostics (${errors.length}); full log ${log}\n`+errors.slice(0,12).map(e=>e.text||e.message).join('\n'));}}
 return {pd,events,files,requests,times,render,flush,initialize,assertClean,get namespace(){return namespace;},async close(){await pd.close();}};
}

export async function checkEnvion() {
 const h=await createEnvionHarness();try {
  await h.initialize();
  await h.assertClean();
  assert.ok(h.events.some(e=>e.receiver==='av-envion-sample-frames'&&e.value>1000),'MAIN PRESET must load original audio');
  h.pd.sendFloat('tempo',120);h.pd.sendFloat('seed',1917);h.pd.sendFloat('activity',1);h.pd.sendFloat('energy',.8);h.pd.sendFloat('motion',.5);h.pd.sendFloat('texture',.5);h.pd.sendFloat('master',.8);h.pd.sendFloat('run',1);h.pd.sendFloat('melody',.5);
  for(const k of ['tones','poly','filtered','percussion','space'])h.pd.sendFloat(k,0);
  applyEnvionMarket(h.pd,h.namespace,{motion:.5,activity:.8,texture:.5,volume:.8,balance:.5},120);
  await h.render(3); // Discard initial gain ramps and any startup tails.
  const melody=await h.render(5);assert.ok(melody.rms>1e-6,'original Envion alone must produce audio');
  h.pd.sendFloat('av-envion-ui-c0-72',2.5);await h.flush();assert.ok(h.events.some(e=>e.receiver==='av-envion-value-c0-72'&&e.value===2.5),'stretch value must traverse original Pd control');
  h.pd.sendFloat('av-envion-ui-c0-350',900);h.pd.sendFloat('av-envion-ui-c0-355',1);h.pd.sendFloat('av-envion-ui-c0-356',1);h.pd.sendBang('av-envion-row-random');
  const nuke=await h.render(3);console.log('isolated original DSP',{melody,nuke});for(const [name,value] of [['av-envion-value-c0-350',900],['av-envion-value-c0-355',1],['av-envion-value-c0-356',1]])assert.ok(h.events.some(e=>e.receiver===name&&e.value===value),'original Nuke control '+name);
  assert.ok(nuke.rms>1e-6,'Nuke routing must keep rendering sound');
  assert.ok(h.events.some(e=>e.receiver==='av-envion-voice'),'Envion must emit actual audio activity feedback');
  for(const amount of [.2,.6,.95]){applyEnvionMarket(h.pd,h.namespace,{motion:amount,activity:amount,texture:amount,volume:amount,balance:1-amount});await h.render(1);const mapped=await h.render(2);assert.ok(mapped.rms>1e-7,'market-driven routes must keep producing audio');await h.assertClean();}
  const recordingPath='orchestra/envion/recordings/check.wav';
  await h.pd.writeFile(recordingPath,new Uint8Array());
  h.pd.sendSymbol('av-envion-file-c44-2','/patches/'+recordingPath);
  await h.render(.75);h.pd.sendBang('av-envion-ui-c44-1');await h.flush();
  await new Promise(resolve=>setTimeout(resolve,30));
  await h.assertClean();
  const recordedBytes=await h.pd.readFile(recordingPath);
  console.log('recordedBytes',recordedBytes.length);
  const recording=decodeWave(recordedBytes);
  assert.ok(recording&&recording.frames>30000,'original recorder bridge must finalize a stereo WAV');
  assert.equal(recording.channels.length,2);
  assert.ok(recording.channels.some(channel=>channel.some(value=>Math.abs(value)>1e-6)),'original recorder must capture actual audio');
  h.pd.sendFloat('run',0);await h.render(.2);assert.equal((await h.render(.2)).peak,0,'pause must mute original patch');
  h.pd.sendFloat('run',1);h.pd.sendFloat('master',0);await h.render(.2);assert.equal((await h.render(.2)).peak,0,'master zero must mute');
  await h.assertClean();console.log(JSON.stringify({envion:{namespace:h.namespace,melody,nuke,recording:{frames:recording.frames,channels:recording.channels.length},sampleReads:h.requests}},null,2));
 }catch(error){console.error(error.message);throw error;}finally{await h.close();}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await checkEnvion();
