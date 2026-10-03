// Render the shipped Pd set in the site's actual libpd WASM engine.
// No browser, GUI, microphone, speakers or audio device is opened.
import assert from 'node:assert/strict';
import {createEnvionHarness} from './envion.mjs';
import {createDataSonification} from '../public/data-sonification.js';
const entry='orchestra/check-data.pd';
const source=`#N canvas 0 0 800 600 12;
#X obj 20 20 av-conductor;
#X obj 20 70 av-data;
#X obj 20 130 dac~;
#X connect 1 0 2 0;
#X connect 1 1 2 1;
`;
const h=await createEnvionHarness({entry,extraFiles:{[entry]:source}});
const score=createDataSonification({send:(k,v)=>h.pd.sendFloat(k,v),event:k=>h.pd.sendBang(k)});
const quiet={fresh:1,raw:{activity:0,volume:0,motion:0},music:{intensity:0},balance:.5};
const moderate={fresh:1,raw:{activity:.3,volume:.3,motion:.2},music:{intensity:.3},balance:.5,texture:.5};
const busy={fresh:1,raw:{activity:1,volume:1,motion:1},music:{intensity:1},balance:.5,texture:.5};
const holders={...quiet,audience:{holders:500000,weight:1,concentration:.4}};
let clock=0;
async function render(metrics,seconds,options={}){
 let square=0,peak=0,frames=0;
 const start=h.events.length;
 for(let t=0;t<seconds;t+=.125){score.frame(metrics,{playing:true,clock,...options});const audio=await h.render(.125);clock+=.125;square+=audio.rms**2;peak=Math.max(peak,audio.peak);frames++;}
 return {rms:Math.sqrt(square/frames),peak,onsets:h.events.slice(start).filter(e=>e.receiver==='data-onset').map(e=>e.value)};
}
async function reset(seed=1917){
 h.pd.sendFloat('run',0);score.reset(seed);await h.render(.25);h.pd.sendFloat('seed',seed);await h.render(.125);h.pd.sendFloat('tempo',120);h.pd.sendFloat('run',1);
}
try {
 h.pd.subscribe('data-onset',()=>{});
 await reset();
 assert.equal((await render(quiet,2)).peak,0,'An inactive market must be silent');
 assert.equal((await render({...quiet,music:{intensity:1},context:{latestCap:1000000000}},2)).peak,0,'High capitalization or historic movement alone must not invent current activity');
 const normal=await render(moderate,12);
 await reset();const active=await render(busy,12);
 assert.ok(active.rms>normal.rms*2,'A fast, changing market must produce substantially more sonic energy');
 assert.ok(active.onsets.length>normal.onsets.length*2,'Actual clocked density must rise with market activity');
 assert.equal(new Set(active.onsets).size,5,'All five distinct Pd voices must execute');
 assert.ok(active.peak<.3,'The data set must retain headroom');
 for(const [name,options] of [['pause',{playing:false}],['seek',{seeking:true}],['ended',{ended:true}]]){
  await render(busy,.4,options);assert.ok((await render(busy,.3,options)).peak<1e-8,name+' must silence data pulses and their tails');
  assert.ok((await render(busy,1)).rms>1e-5,'Resuming after '+name+' must recover output');
 }
 // Holder metadata may still inform visuals, but never opens a sustained voice.
 await render(holders,.4);
 assert.ok((await render(holders,2)).peak<1e-8,'Holder metadata alone must remain silent after drone removal');
 for(let i=0;i<4;i++){score.frame(busy,{playing:true,clock});const background=await h.render(1);clock++;assert.ok(background.rms>1e-5,'A throttled one-second background timer must preserve finite data pulses');}
 await h.render(2.8);assert.ok((await h.render(.25)).peak<1e-8,'Stopped browser control updates must close the Pd watchdog');
 assert.ok((await render(busy,2)).rms>1e-5,'The Pd watchdog must recover when control updates resume');
 score.setEnabled(false);await render(busy,.25);assert.equal((await render(busy,.25)).peak,0,'Removing the bundle must silence it');score.setEnabled(true);
 await reset();await render({...busy,fresh:0},.3);assert.equal((await render({...busy,fresh:0},.3)).peak,0,'Stale market observations must not drive pulses');
 // Resetting a captured score must reproduce its five-voice event sequence.
 await reset(8191);const first=await render(busy,4);await reset(8191);const again=await render(busy,4);assert.deepEqual(again.onsets,first.onsets,'The same seed and transport restart must reproduce the Pd phrase');
 // Direct swap bangs remain bounded and cannot treat snapshots/history as swaps.
 assert.equal(score.event({kind:'snapshot'},{playing:true,clock}),false);
 assert.equal(score.event({kind:'swap'},{playing:true,replay:true,clock}),false);
 assert.equal(score.event({kind:'swap'},{playing:false,clock}),false);
 assert.equal(score.event({kind:'swap'},{playing:true,clock}),true);
 assert.equal(score.event({kind:'swap'},{playing:true,clock:clock+.01}),false);
 await h.assertClean();
 console.log(JSON.stringify({pass:true,normal:{rms:normal.rms,peak:normal.peak,onsets:normal.onsets.length},active:{rms:active.rms,peak:active.peak,onsets:active.onsets.length,voices:[...new Set(active.onsets)]},checks:['real WASM DSP','five distinct voices','activity-scaled energy','pause/seek/end','no holder drone','background timer cadence','watchdog recovery','bundle removal','stale silence','repeatable seeded phrase','bounded live-swap triggers']},null,2));
} finally {await h.close();}
