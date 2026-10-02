import assert from 'node:assert/strict';
import {createEnvionHarness} from './envion.mjs';
import {hardstyleActive} from '../public/hardstyle-state.js';
for(const [cap,expected] of [[999999,false],[1000000,true],[1200000,true],[null,false],[NaN,false]])assert.equal(hardstyleActive({context:{latestCap:cap},fresh:1}),expected);
assert.equal(hardstyleActive({context:{latestCap:2000000},fresh:1},false),false);
for(const part of ['av-hardstyle']){
 const entry='orchestra/check.pd',source=`#N canvas 0 0 800 600 12;
#X obj 20 20 av-conductor;
#X obj 20 60 ${part};
#X obj 20 120 dac~;
#X connect 1 0 2 0;
#X connect 1 1 2 1;
`;
 const h=await createEnvionHarness({entry,extraFiles:{[entry]:source}});
 try{
  for(const [key,value] of Object.entries({tempo:100,tonic:48,texture:.6,ambience:0,run:1,'hardstyle-active':0,'hardstyle-chance':100}))h.pd.sendFloat(key,value);
  assert.equal((await h.render(1)).peak,0);
  h.pd.sendFloat(part==='av-hardstyle'?'hardstyle-active':'ambience',1);
  h.pd.sendFloat('seed',149);
  const first=await h.render(2.8),rest=await h.render(5),later=await h.render(12);
  assert.ok(first.rms>1e-5&&later.rms>1e-5,part+' produces repeated phrases');
  if(part==='av-hardstyle')assert.ok(rest.rms<1e-6,'hardstyle leaves long rests between phrases');
  h.pd.sendFloat(part==='av-hardstyle'?'hardstyle-active':'ambience',0);await h.render(.3);assert.ok((await h.render(1)).peak<1e-9,part+' removal silences output');
  await h.assertClean();console.log(part,{first,later});
 }finally{await h.close();}
}
