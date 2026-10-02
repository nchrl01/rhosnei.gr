import assert from 'node:assert/strict';
import {orchestraTargets,orchestraParameters,orchestraTempo,ORCHESTRA_LAYERS} from '../public/orchestra.js';
import {createEnvionHarness} from './envion.mjs';
const market={activity:.8,volume:.8,motion:.6,texture:.7,fresh:1,balance:.5};
for(let phrase=0;phrase<4;phrase++){
 const targets=orchestraTargets(market,true,phrase);
 assert.ok(Math.abs(ORCHESTRA_LAYERS.reduce((sum,name)=>sum+targets[name],0)-.72)<1e-9);
 for(const name of ORCHESTRA_LAYERS)assert.equal(orchestraTargets({...market,fresh:0},false,phrase)[name],0);
}
for(const [cap,bpm] of [[10000,10],[1000000,100],[10000000,200]])assert.equal(orchestraTempo({context:{latestCap:cap}}),bpm);
const results={};
for(const layer of [...ORCHESTRA_LAYERS.filter(name=>name!=='envion'),'ensemble']){
 const harness=await createEnvionHarness();
 try{
  await harness.initialize();await harness.assertClean();
  for(const [name,value] of Object.entries({...orchestraParameters(market),tempo:120,tonic:48,texture:.7,motion:.6,activity:.8,energy:.8,balance:.5,seed:123,master:.8,run:1}))harness.pd.sendFloat(name,value);
  const levels=layer==='ensemble'?orchestraTargets(market,true):Object.fromEntries([...ORCHESTRA_LAYERS,'space'].map(name=>[name,name===layer?.5:0]));
  for(const [name,value] of Object.entries(levels))harness.pd.sendFloat(name,value);
  await harness.render(2);results[layer]=await harness.render(3);assert.ok(results[layer].rms>1e-6,layer+' must produce audio');
  if(layer==='ensemble'){harness.pd.sendFloat('run',0);await harness.render(.2);assert.equal((await harness.render(.2)).peak,0);}
  await harness.assertClean();
 }finally{await harness.close();}
}
console.log(JSON.stringify({results},null,2));
