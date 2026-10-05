import assert from 'node:assert/strict';
import {MATH_FAMILIES,mathIdentity,createMathPatterns} from '../public/math-patterns.js';
import {createEnvionHarness} from './envion.mjs';
const byId=new Map(MATH_FAMILIES.map(p=>[p.id,p]));
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
close(byId.get('funk').graph(-8),2.5);
close(byId.get('funk').graph(-5),2.5);
close(byId.get('funk').graph(-7.8),4.2*Math.exp(-3.2)-1.7);
close(byId.get('bounce').graph(-7.3),2.8);
close(byId.get('bounce').graph(-6.145),3.6*.65**2-.8);
close(byId.get('fourier').graph(-7.875),1+4/Math.PI*Math.SQRT1_2);
close(byId.get('heart').graph(0),-.6);
assert.ok(Number.isNaN(byId.get('tangent').graph(.5)));
assert.ok(byId.get('tangent').breakAt(.51,.49));
assert.ok(Number.isNaN(byId.get('reference-sine-ratio').graph(0)));
assert.deepEqual(byId.get('reference-sine-ratio').sample(.5),[0,0]);
const chosen=new Map();
for(let seed=0;chosen.size<MATH_FAMILIES.length&&seed<1000;seed++)for(const pattern of mathIdentity(seed))if(!chosen.has(pattern.id))chosen.set(pattern.id,{seed,pattern});
assert.equal(chosen.size,23);
for(const {pattern} of chosen.values()){
 const [xmin,xmax]=pattern.graphSpan,[ymin,ymax]=pattern.graphRange;
 assert.equal(pattern.graphCache.points[0].x,xmin);
 assert.ok(pattern.graphCache.points.at(-1).x>xmax-(xmax-xmin)*1e-6,'Entire source domain must be plotted');
 assert.ok(pattern.graphCache.points.length>=2401);
 for(let i=0;i<=10000;i++){
  const phase=i/10000,x=xmin+phase*(xmax-xmin),y=pattern.graph(x),[raw,gate]=pattern.sample(phase);
  assert.ok(Number.isFinite(raw)&&Number.isFinite(gate)&&gate>=0&&gate<=1,pattern.id+' must have safe audio controls');
  if(Number.isFinite(y)&&!['tangent','reference-sine-ratio'].includes(pattern.id))assert.ok(y>=ymin-1e-8&&y<=ymax+1e-8,pattern.id+' finite curve must fit its plotting range');
 }
}
const extraFiles={'orchestra/math-check.pd':'#N canvas 0 0 300 200 12;\n#X obj 20 20 av-math-voice 0;\n#X obj 20 100 dac~ 1 2;\n#X connect 0 0 1 0;\n#X connect 0 0 1 1;\n'};
const sampleRate=Number(process.env.MATH_SAMPLE_RATE)||44100;
const harness=await createEnvionHarness({entry:'orchestra/math-check.pd',extraFiles,sampleRate});
const results=[];
try{
 harness.pd.sendFloat('run',1);
 for(const pattern of MATH_FAMILIES){
  harness.pd.sendFloat('math-0-gate',0);harness.pd.sendFloat('math-0-aux-gate',0);harness.pd.sendFloat('math-0-level',0);await harness.render(.15);
  harness.pd.sendFloat('math-0-drive',pattern.drive);harness.pd.sendFloat('math-0-level',.22);let peak=0,total=0,nonzero=0;
  for(let frame=0;frame<120;frame++){
   const phase=frame/120,[raw,gate]=pattern.sample(phase),[lo,hi]=pattern.graphRange,x=pattern.graphSpan[0]+phase*(pattern.graphSpan[1]-pattern.graphSpan[0]);
   const [aux,auxGate]=pattern.aux?.(x,517)||[0,0];
   harness.pd.sendFloat('math-0-pitch',Math.max(24,Math.min(84,48+raw*12)));
   harness.pd.sendFloat('math-0-cutoff',350+Math.max(0,Math.min(1,(raw-lo)/(hi-lo)))*2200);
   harness.pd.sendFloat('math-0-gate',gate);harness.pd.sendFloat('math-0-aux-pitch',Math.max(24,Math.min(96,48+aux*12)));harness.pd.sendFloat('math-0-aux-gate',auxGate);
   const rendered=await harness.render(1/30);peak=Math.max(peak,rendered.peak);total+=rendered.rms**2;if(rendered.peak>1e-5)nonzero++;
  }
  assert.ok(peak>.001,pattern.id+' must produce measurable actual Pd output');assert.ok(peak<.4,pattern.id+' must retain output headroom');
  harness.pd.sendFloat('math-0-gate',0);harness.pd.sendFloat('math-0-aux-gate',0);harness.pd.sendFloat('math-0-level',0);await harness.render(.15);assert.equal((await harness.render(.1)).peak,0,pattern.id+' must stop after the phrase');
  results.push({id:pattern.id,peak,rms:Math.sqrt(total/120),audibleFrames:nonzero});
 }
 harness.pd.sendFloat('math-0-gate',.5);harness.pd.sendFloat('math-0-level',.22);await harness.render(.5);assert.equal((await harness.render(.1)).peak,0,'Pd watchdog must silence a stalled control stream');
 await harness.assertClean();
 console.log(JSON.stringify({sampleRate,functions:results,watchdog:true},null,2));
}finally{await harness.close();}
// The marker and the audio controls must use the same source x/y.
let sent=new Map();const engine=createMathPatterns({send:(name,value)=>sent.set(name,value)});
engine.setSeed(517);
for(let frame=0;frame<450;frame++){
 const view=engine.frame({context:{latestCap:5000000},fresh:1,music:{intensity:.8,tempo:120},replay:{}},{playing:true,ready:true,event:'fixture',clock:frame/30});
 for(const slot of view.slots)if(slot.performing){const pattern=byId.get(slot.id),[raw,gate]=pattern.sample(slot.phase);close(slot.graphCursor.y,pattern.graph(slot.graphCursor.x));close(sent.get('math-'+slot.slot+'-pitch'),Math.max(24,Math.min(84,48+raw*12)));close(sent.get('math-'+slot.slot+'-gate'),gate);}
}
console.log('PASS: all 23 formulas / graph domains, same graph and sound phase, actual Pd output, phrase stop and watchdog silence.');
