// Offline decoder/scheduling checks. Web Audio is modeled here, not rendered.
// Usage: node checks/wersi.mjs [path-to-private-cartridge.BIN]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {decodeCartridge,cycleCoefficients,ROM1_SHA256} from '../public/wersi-rom.js';
import {createWersiBank} from '../public/wersi-bank.js';
const raw=await fs.readFile(process.argv[2]||new URL('../.local/wersi-rom1.bin',import.meta.url));
const buffer=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
const bank=decodeCartridge(buffer);
assert.equal(bank.patches.length,20);assert.equal(bank.waves.length,39);
assert.equal(bank.patches[0].name,'MARIMB');assert.equal(bank.patches[19].name,'LASER');
assert.equal(bank.patches[12].layers.length,4);
assert.equal(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join(''),ROM1_SHA256);
const damaged=buffer.slice(0);new Uint8Array(damaged)[100]^=1;assert.throws(()=>decodeCartridge(damaged),/checksum/);
let maxWaveError=0;
for(const wave of bank.waves)for(const cycle of wave.cycles){
 const {real,imag}=cycleCoefficients(cycle),mean=cycle.reduce((a,b)=>a+b,0)/cycle.length,peak=Math.max(...cycle.map(x=>Math.abs(x-mean)),1e-6);
 for(let i=0;i<cycle.length;i++){let value=0;for(let h=1;h<real.length;h++){const angle=2*Math.PI*h*i/cycle.length;value+=real[h]*Math.cos(angle)+imag[h]*Math.sin(angle);}maxWaveError=Math.max(maxWaveError,Math.abs(value-(cycle[i]-mean)/peak*.7));}
}
assert.ok(maxWaveError<1e-5);
class Param{constructor(value=0){this.value=value;}setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}linearRampToValueAtTime(v){assert.ok(Number.isFinite(v));}exponentialRampToValueAtTime(v){assert.ok(v>0&&Number.isFinite(v));}}
class Node{constructor(context){this.context=context;this.connections=[];}connect(to){this.connections.push(to);}disconnect(){this.connections=[];}}
const contexts=[];
class Context{
 constructor(){this.currentTime=0;this.sampleRate=48000;this.oscillators=[];this.gains=[];this.destination=new Node(this);contexts.push(this);}
 async resume(){}
 createGain(){const n=new Node(this);n.gain=new Param();this.gains.push(n);return n;}
 createBiquadFilter(){const n=new Node(this);n.frequency=new Param();n.Q=new Param();return n;}
 createStereoPanner(){const n=new Node(this);n.pan=new Param();return n;}
 createPeriodicWave(real,imag){assert.equal(real.length,imag.length);assert.ok([...real,...imag].every(Number.isFinite));return {real,imag};}
 createOscillator(){const n=new Node(this);n.frequency=new Param();n.detune=new Param();n.stops=[];n.setPeriodicWave=w=>n.wave=w;n.start=t=>{n.started=t;};n.stop=t=>n.stops.push(t);this.oscillators.push(n);return n;}
}
class Element{constructor(){this.value='';this.disabled=false;}replaceChildren(...children){this.children=children;}}
const elements=new Map(),container={querySelector(selector){if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);}};
globalThis.document={createElement:()=>new Element()};globalThis.AudioContext=Context;
globalThis.location={hostname:'example.org'};globalThis.localStorage={getItem:()=>null,removeItem(){},setItem(){}};
let stored=buffer;
globalThis.indexedDB={open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={objectStore(){return {get(){const r={};queueMicrotask(()=>{r.result=stored;r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return r;},put(b){stored=b;return this.get();},delete(){stored=null;return this.get();}};}};return tx;}};request.onsuccess();});return request;}};
let loadedResolve;const loaded=new Promise(resolve=>loadedResolve=resolve),events=[];
const controller=createWersiBank(container,()=>loadedResolve(),index=>events.push(index));await loaded;
assert.equal(controller.loaded,true);
const ctx=new Context();controller.attach(ctx,ctx.destination);
const metrics={motion:.7,texture:.7,volume:.8};
controller.update(metrics,{playing:true,native:false,master:.5,seed:1917,phrase:0,budget:.72});
assert.equal(controller.state.level,.144);
controller.receive('generation',16);controller.receive('note',60);
assert.ok(ctx.oscillators.length>0);assert.equal(events.length,1);
assert.ok(ctx.oscillators.every(o=>o.wave&&o.frequency.value>0&&Number.isFinite(o.frequency.value)&&o.stops[0]>o.started));
for(let i=0;i<30;i++)controller.receive('note',60+i%7);
assert.ok(ctx.oscillators.some(o=>o.stops.includes(undefined)),'voice stealing stops old oscillators');
controller.update(metrics,{playing:false,native:false,master:.5,seed:0,phrase:0,budget:.72});
assert.ok(ctx.oscillators.every(o=>o.stops.includes(undefined)),'paused orchestra stops all cartridge voices');
elements.get('[data-rom-patch]').value='12';await elements.get('[data-rom-audition]').onclick();
const preview=contexts.at(-1);assert.equal(preview.oscillators.length,4,'S-BRAS audition uses four linked layers');
controller.update(metrics,{playing:false,native:false,master:.5,seed:0,phrase:0,budget:.72});
assert.ok(preview.oscillators.every(o=>!o.stops.includes(undefined)),'paused control refresh leaves audition playing');
controller.setMaster(0);assert.equal(preview.gains[0].gain.value,0,'listening volume immediately mutes audition');
controller.stop();assert.ok(preview.oscillators.every(o=>o.stops.includes(undefined)));
const before=ctx.oscillators.length;
controller.update(metrics,{playing:true,native:true,master:.5,seed:0,phrase:0,budget:.72});controller.receive('note',60);assert.equal(controller.state.level,0);assert.equal(ctx.oscillators.length,before);
controller.update(metrics,{playing:true,native:false,master:.5,seed:0,phrase:0,budget:0});controller.receive('note',60);assert.equal(ctx.oscillators.length,before);
await elements.get('[data-rom-clear]').onclick();assert.equal(controller.loaded,false);
console.log(JSON.stringify({patches:20,referencedWaveBlocks:39,maxWaveError,voiceScheduling:'passed',auditionScheduling:'passed',polyphonyStopAndNativeGating:'passed',audioRendered:false},null,2));
