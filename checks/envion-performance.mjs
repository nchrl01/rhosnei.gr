// Offline libpd renders; no browser, desktop control, audio device or speakers.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {buildPerformanceCatalog,createEnvionPerformance} from '../public/envion-performance.js';
import {applyEnvionMarket} from '../public/envion-market.js';
import {createEnvionHarness} from './envion.mjs';
const root=new URL('../public/patches/envion/',import.meta.url);
const model=JSON.parse(await fs.readFile(new URL('model.json',root),'utf8'));
const {banks}=JSON.parse(await fs.readFile(new URL('performance-catalog.json',root),'utf8'));
const catalog=buildPerformanceCatalog(model,banks);
const market={motion:.75,activity:.85,volume:.8,texture:.7,balance:.7,context:{pressure:.8,shock:.65,direction:1}};
const planner=createEnvionPerformance(catalog,1917),samples=new Set(),presets=new Set(),envelopes=new Set(),variations=new Set();
for(let i=0;i<6000;i++){
 const plan=planner.next(market,160,i*8);assert.ok(plan);
 samples.add(plan.material.sample);presets.add(plan.material.preset.index);envelopes.add(plan.material.bank.path);variations.add(plan.summary);
 assert.ok(plan.row>=0&&plan.row<plan.material.bank.rows);
 assert.ok(plan.values[461]<=65&&plan.values[379]<=.25);
 for(const value of [...Object.values(plan.values),...Object.values(plan.extra)])assert.ok(Number.isFinite(value));
}
assert.equal(samples.size,catalog.samples.length,'entire bundled audio library must be reachable');
assert.equal(presets.size,catalog.presets.length,'every bundled preset button must be reachable');
assert.equal(envelopes.size,banks.length,'every envelope bank must be reachable');
assert.ok(variations.size>500,'unchanged market readings must still yield varied phrases');
const low=createEnvionPerformance(catalog,77),high=createEnvionPerformance(catalog,77);let lowDist=0,highDist=0;
for(let i=0;i<500;i++){
 lowDist+=low.next({...market,motion:.05,volume:.05,activity:.05},80,i*8).extra['c53-40'];
 highDist+=high.next({...market,motion:.95,volume:.95,activity:.95},180,i*8).extra['c53-40'];
}
assert.ok(highDist>lowDist*2,'volatile market should increase distortion probability');
console.log('Reachable library', {samples:samples.size,presets:presets.size,envelopes:envelopes.size,lowDist,highDist});
const h=await createEnvionHarness();
try{
 await h.initialize();h.pd.sendFloat('tempo',160);h.pd.sendFloat('master',.5);h.pd.sendFloat('melody',.6);h.pd.sendFloat('run',1);
 const runPlanner=createEnvionPerformance(catalog,149),results=[];
 for(let i=0;i<catalog.presets.length;i++){
  const plan=runPlanner.next(market,160,i*16,true),preset=catalog.presets[i];
  plan.material.preset=preset;plan.material.sample=preset.assets.find(p=>p.startsWith('audio/'))||plan.material.sample;
  h.pd.sendBang('av-envion-ui-c0-'+preset.index);await h.render(.06);
  h.pd.sendSymbol('av-envion-file-c0-49','/patches/orchestra/envion/'+plan.material.sample);await h.render(.06);
  for(const asset of [plan.material.tape,plan.material.ir])await h.pd.writeFile('orchestra/envion/'+asset,new Uint8Array(await fs.readFile(new URL(asset,root))));
  h.pd.sendSymbol(h.namespace+'-open','/patches/orchestra/envion/'+plan.material.tape);
  h.pd.sendSymbol(h.namespace+'-tape-IR','/patches/orchestra/envion/'+plan.material.ir);
  h.pd.sendSymbol('av-envion-file-c0-30','/patches/orchestra/envion/'+plan.material.bank.path);
  applyEnvionMarket(h.pd,h.namespace,market,160,undefined,plan);
  for(const action of plan.actions)h.pd.sendBang('av-envion-ui-c0-'+action);
  await h.render(.15);const sound=await h.render(.8);
  assert.ok(Number.isFinite(sound.rms)&&Number.isFinite(sound.peak),preset.name+' must render finite audio');
  results.push({preset:preset.name,rms:Number(sound.rms.toFixed(7)),peak:sound.peak});
 }
 assert.ok(results.filter(x=>x.rms>1e-6).length>=Math.ceil(results.length*.8),'preset routes should remain audible');
 await h.assertClean();
 h.pd.sendFloat('run',0);await h.render(.1);assert.equal((await h.render(.1)).peak,0,'Pause must mute all active effects');
 console.log(JSON.stringify({renders:results},null,2));
}finally{await h.close();}
