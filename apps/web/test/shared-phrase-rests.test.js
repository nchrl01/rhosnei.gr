import {describe,expect,it} from 'vitest';
import {createDataSonification} from '../public/data-sonification.js';
import {createOrchestraConductor} from '../public/orchestra.js';
import {phraseArrangement} from '../public/phrase-arrangement.js';

const observedMarket={fresh:1,tradingActivity:1,activity:1,volume:1,motion:.5,balance:.5,texture:.5,music:{intensity:1,tonic:60},context:{pressure:.5}};
const quietMarket={...observedMarket,tradingActivity:0};
const sounding={active:true,rest:false,layers:{data:.4,envion:.6}};
const resting={active:true,rest:true,layers:{data:0,envion:0}};
const swap={kind:'swap'};

function dataFixture(initial=sounding){
 let arrangement=initial;
 const controls=[],events=[];
 const data=createDataSonification({send:(name,value)=>controls.push([name,value]),event:name=>events.push(name),getArrangement:()=>arrangement});
 return {data,controls,events,setArrangement:value=>{arrangement=value;},last:name=>controls.findLast(([control])=>control===name)?.[1]};
}

describe('shared phrase rests in market data voices',()=>{
 it('checks the current score at asynchronous trade and price callbacks, even before the next frame',()=>{
  const f=dataFixture();
  f.data.frame(observedMarket,{playing:true,clock:0});
  f.data.observePrice(100,{playing:true,clock:0});
  f.setArrangement(resting);
  expect(f.data.event(swap,{playing:true,clock:.2})).toBe(false);
  expect(f.data.observePrice(101,{playing:true,clock:.3})).toBe(false);
  expect(f.events).toEqual([]);
 });

 it('preserves the previous voice level and output enable during the breath',()=>{
  const f=dataFixture();
  f.data.frame(observedMarket,{playing:true,clock:0});
  expect(f.data.event(swap,{playing:true,clock:.1})).toBe(true);
  const level=f.last('data-level');
  f.setArrangement(resting);
  f.data.frame(observedMarket,{playing:true,clock:.2});
  expect(f.last('data-level')).toBeCloseTo(level,10);
  expect(f.last('data-enabled')).toBe(1);
  expect(f.data.snapshot().rest).toBe(true);
  expect(f.events).toEqual(['data-trade']);
 });

 it('leaves a quiet market silent regardless of phrase dynamics',()=>{
  const f=dataFixture();
  for(const [clock,arrangement] of [[0,sounding],[.2,resting],[1,sounding]]){
   f.setArrangement(arrangement);f.data.frame(quietMarket,{playing:true,clock});
   expect(f.last('data-level')).toBe(0);
   expect(f.last('data-density')).toBe(0);
  }
  expect(f.events).toEqual([]);
 });

 it('lets the finite observation tail decay without treating old activity totals as fresh events',()=>{
  const f=dataFixture();
  f.data.frame(observedMarket,{playing:true,clock:0});
  f.data.event(swap,{playing:true,clock:.1});
  f.setArrangement(resting);
  f.data.frame(quietMarket,{playing:true,clock:.2});
  expect(f.last('data-level')).toBeGreaterThan(0);
  expect(f.last('data-enabled')).toBe(1);
  f.data.frame(quietMarket,{playing:true,clock:2});
  expect(f.last('data-level')).toBe(0);
  expect(f.events).toEqual(['data-trade']);
 });

 it('drops replay observations inside rests and waits for a new observation after the rest',()=>{
  const f=dataFixture(resting),candle=at=>({...observedMarket,replay:{at,volume:10}});
  f.data.frame(candle(1000),{playing:true,clock:0});
  f.data.frame(candle(2000),{playing:true,clock:.2});
  expect(f.events).toEqual([]);
  f.setArrangement(sounding);
  f.data.frame(candle(2000),{playing:true,clock:.4});
  expect(f.events).toEqual([]);
  f.data.frame(candle(3000),{playing:true,clock:.6});
  expect(f.events).toEqual(['data-trade']);
  f.data.frame(candle(1000),{playing:true,clock:.8});
  expect(f.events).toEqual(['data-trade']);
 });

 it('accepts only the next live observation after a rest and does not release a backlog',()=>{
  const f=dataFixture(resting);
  f.data.frame(observedMarket,{playing:true,clock:0});
  for(const clock of [.1,.3,.5])f.data.event(swap,{playing:true,clock});
  f.setArrangement(sounding);
  f.data.frame(observedMarket,{playing:true,clock:.8});
  expect(f.events).toEqual([]);
  expect(f.data.event(swap,{playing:true,clock:1})).toBe(true);
  expect(f.events).toEqual(['data-trade']);
 });

 it('reads an activated score before the first callback after an inactive period',()=>{
  const f=dataFixture({active:false,rest:false});
  f.data.frame(quietMarket,{playing:true,clock:0});
  // App callbacks activate piano's score first, then consult it here.
  const start=phraseArrangement(1917,0),insideRest=(start.restStartBeat+start.restEndBeat)/2;
  f.setArrangement({...phraseArrangement(1917,insideRest),active:true});
  expect(f.data.event(swap,{playing:true,clock:3})).toBe(false);
  f.setArrangement({...phraseArrangement(1917,start.restEndBeat),active:true});
  expect(f.data.event(swap,{playing:true,clock:4})).toBe(true);
  expect(f.events).toEqual(['data-trade']);
 });

 it('clears old price references and tails on reset',()=>{
  const f=dataFixture();
  f.data.frame(observedMarket,{playing:true,clock:0});
  f.data.observePrice(100,{playing:true,clock:0});
  f.data.observePrice(101,{playing:true,clock:.2});
  f.data.reset(27);
  expect(f.last('data-level')).toBe(0);
  expect(f.last('data-enabled')).toBe(0);
  f.data.frame(quietMarket,{playing:true,clock:.3});
  expect(f.last('data-level')).toBe(0);
  expect(f.data.observePrice(200,{playing:true,clock:.4})).toBe(false);
  expect(f.events).toEqual(['data-trade']);
  expect(f.data.observePrice(201,{playing:true,clock:.6})).toBe(true);
 });

 it.each([{playing:false},{playing:true,seeking:true},{playing:true,ended:true}])('retains the transport stop for %j',transport=>{
  const f=dataFixture();
  f.data.frame(observedMarket,{playing:true,clock:0});
  f.data.event(swap,{playing:true,clock:.1});
  f.data.frame(observedMarket,{...transport,clock:.2});
  expect(f.last('data-enabled')).toBe(0);
  expect(f.last('data-level')).toBe(0);
  expect(f.data.event(swap,{playing:true,clock:.4})).toBe(false);
  expect(f.events).toEqual(['data-trade']);
 });
});

describe('phrase dynamics in the ensemble conductor',()=>{
 it('does not turn a phrase rest into an output mute',()=>{
  const conductor=createOrchestraConductor(),control=createOrchestraConductor();
  const frame=arrangement=>({...observedMarket,arrangement});
  conductor.update(frame(sounding),true,0);control.update(frame(sounding),true,0);
  const duringRest=conductor.update(frame(resting),true,150);
  const heldGain=control.update(frame(sounding),true,150);
  expect(duringRest.levels.melody).toBeCloseTo(heldGain.levels.melody,12);
  expect(duringRest.levels.melody).toBeGreaterThan(0);
 });

 it('keeps quiet and disabled layers silent instead of overriding their gates',()=>{
  const conductor=createOrchestraConductor();
  for(const [now,arrangement] of [[0,sounding],[150,resting],[300,sounding]])expect(conductor.update({...quietMarket,arrangement},true,now).levels.melody).toBe(0);
  conductor.setBundle('envion',false);
  expect(conductor.update({...observedMarket,arrangement:sounding},true,450).levels.melody).toBe(0);
 });

 it('clears a previous phrase gain on reset and preserves bundle selection',()=>{
  const conductor=createOrchestraConductor(),fresh=createOrchestraConductor();
  conductor.update({...observedMarket,arrangement:sounding},true,0);
  conductor.reset();
  expect(conductor.update(observedMarket,true,150).levels.melody).toBeCloseTo(fresh.update(observedMarket,true,150).levels.melody,12);
  conductor.setBundle('envion',false);conductor.reset();
  expect(conductor.update(observedMarket,true,300).levels.melody).toBe(0);
 });
});
