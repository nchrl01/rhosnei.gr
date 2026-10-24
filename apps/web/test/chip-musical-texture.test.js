import {describe,it,expect} from 'vitest';
import {composeChipBar} from '../public/market-chip-score.js';
import {compileGameBoyEvent} from '../public/gb-apu-instrument.js';
import {chipEnsembleArrangement} from '../public/chip-ensemble-arrangement.js';
const signal={observed:true,fresh:1,tradingActivity:1,activity:.6,activityKnown:true,volume:.6,volumeKnown:true,motion:.4,intensity:.5,delta:3,deltaKnown:true,liquidity:1e7,marketCap:1e7};
const plans=s=>Array.from({length:16},(_,bar)=>composeChipBar(1917,bar,{signal:s}));
describe('musical GB texture and market expression',()=>{
 it('uses the existing market harmonic characters, with different rising and falling harmony',()=>{
  const up=plans(signal),down=plans({...signal,delta:-3});
  expect(up[0].harmony.group).toBe('up');expect(down[0].harmony.group).toBe('down');
  expect(up.map(p=>p.harmony.notes)).not.toEqual(down.map(p=>p.harmony.notes));
  expect(up[0].harmony.progression).toBeTruthy();
 });
 it('lets chords cross bar lines but finish before the next common breath',()=>{
  let crossing=0;
  plans(signal).forEach((p,bar)=>p.events.filter(e=>e.kind.startsWith('chord')).forEach(e=>{
   if(e.beat+e.duration>4)crossing++;
   expect(e.duration).toBeLessThanOrEqual(chipEnsembleArrangement(1917,bar*4+e.beat,signal).restInBeats);
   expect(e.expression.sustain.steps).toBe(3);
  }));
  expect(crossing).toBeGreaterThan(0);
 });
 it('compiles fractional tuning and slow pitch motion to bounded legal register updates',()=>{
  const base={kind:'bass',midi:55,duration:3,gain:.08,expression:{sustain:{hold:.6,steps:2}}};
  const plain=compileGameBoyEvent(base),tuned=compileGameBoyEvent({...base,expression:{...base.expression,cents:18,vibrato:{depth:12,cycles:1.5}}});
  expect(tuned.writes).not.toEqual(plain.writes);
  expect(tuned.updates.length).toBeLessThanOrEqual(16);
  expect(tuned.updates.some(u=>u.writes.some(([a])=>a===0xff1d))).toBe(true);
  expect(tuned.updates.every(u=>u.frame<tuned.durationFrames)).toBe(true);
 });
 it('holds noise textures rather than decaying them into clicks',()=>{
  const c=compileGameBoyEvent({kind:'texture',gain:.08,duration:.8,expression:{envelope:{initial:8,pace:0},sustain:{hold:.4,steps:3}}});
  expect(c.writes.find(([a])=>a===0xff21)[1]&7).toBe(0);
  expect(c.updates.length).toBeGreaterThan(0);
  expect(c.updates.every(u=>u.writes.some(([a])=>a===0xff21))).toBe(true);
 });
 it('does not revive textures or harmony when observations stop',()=>{
  for(const patch of [{fresh:0},{observed:false},{tradingActivity:0}])expect(plans({...signal,...patch}).every(p=>p.events.length===0)).toBe(true);
 });
});
