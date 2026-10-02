import assert from 'node:assert/strict';
import {orchestraTargets,orchestraParameters,orchestraTempo,ORCHESTRA_LAYERS} from '../public/orchestra.js';
import {createEnvionHarness} from './envion.mjs';
const m={activity:.8,volume:.8,motion:.6,texture:.7,fresh:1,balance:.5};
for(let phrase=0;phrase<4;phrase++){
 const t=orchestraTargets(m,true,phrase);
 assert.ok(Math.abs(ORCHESTRA_LAYERS.reduce((sum,k)=>sum+t[k],0)-.72)<1e-9);
 for(const k of ORCHESTRA_LAYERS)assert.equal(orchestraTargets({...m,fresh:0},false,phrase)[k],0);
}
for(const [cap,bpm] of [[10000,10],[1000000,100],[10000000,200]])assert.equal(orchestraTempo({context:{latestCap:cap}}),bpm);
assert.ok(orchestraTargets({...m,texture:1},true).space>orchestraTargets({...m,texture:0},true).space);
const results={},times=[];
// Fresh WASM instance per part avoids previous parts' delay/reverb tails masking
// a disconnected or silent part. Every source control and binary asset is real.
for(const layer of [...ORCHESTRA_LAYERS,'ensemble']) {
 const h=await createEnvionHarness();try{
  await h.initialize();await h.assertClean();
  for(const [key,value] of Object.entries({...orchestraParameters(m),tempo:120,tonic:48,texture:.7,motion:.6,activity:.8,energy:.8,balance:.5,seed:123,master:.8,run:1}))h.pd.sendFloat(key,value);
  const levels=layer==='ensemble'?orchestraTargets(m,true):Object.fromEntries([...ORCHESTRA_LAYERS,'space'].map(k=>[k,k===layer?.5:0]));
  for(const [k,v] of Object.entries(levels))h.pd.sendFloat(k,v);
  await h.render(3); // Exclude startup gain ramps and shared delay transients.
  results[layer]=await h.render(5);assert.ok(results[layer].rms>1e-6,layer+' must produce audio from a fresh graph');
  const voiceReceiver={melody:'av-envion-voice',tones:'av-tone-voice',poly:'av-poly-voice',percussion:'av-perc-voice'}[layer];
  if(voiceReceiver)assert.ok(h.events.some(e=>e.receiver===voiceReceiver),'isolated audio feedback '+voiceReceiver);
  if(layer==='ensemble') {
   h.pd.sendFloat('run',0);await h.render(.2);results.stopped=await h.render(.2);assert.equal(results.stopped.peak,0);
   h.pd.sendFloat('run',1);h.pd.sendFloat('master',0);await h.render(.2);assert.equal((await h.render(.2)).peak,0);
   for(const receiver of ['generation','av-output-left','av-output-right'])assert.ok(h.events.some(e=>e.receiver===receiver),'feedback '+receiver);
  }
  await h.assertClean();times.push(...h.times);
 }finally{await h.close();}
}
const impulse=`#N canvas 20 20 600 420 12;
#X obj 30 30 r fire;
#X msg 30 70 1 0 \\, 0 0 1;
#X obj 30 110 vline~;
#X obj 30 150 av-freeverb;
#X obj 30 220 dac~;
#X connect 0 0 1 0;
#X connect 1 0 2 0;
#X connect 2 0 3 0;
#X connect 2 0 3 1;
#X connect 3 0 4 0;
#X connect 3 1 4 1;
`;
const tails={};
for(const texture of [0,1]) {
 const h=await createEnvionHarness({entry:'impulse.pd',extraFiles:{'impulse.pd':impulse}});try{
  h.pd.sendFloat('texture',texture);await h.render(.6);h.pd.sendBang('fire');await h.render(1);tails[texture]=await h.render(2.5);await h.assertClean();
 }finally{await h.close();}
}
assert.ok(tails[1].rms>tails[0].rms*5,'higher liquidity must extend actual Freeverb decay');
times.sort((a,b)=>a-b);
console.log(JSON.stringify({results,freeverbTail:tails,processMs:{median:times[Math.floor(times.length*.5)],p99:times[Math.floor(times.length*.99)],quantum:128/44100*1000}},null,2));
