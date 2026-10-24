import {describe,expect,it} from 'vitest';
import {audioPresentationTime,createChipVisualEvents} from '../public/chip-visual-events.js';

describe('performed chip voices drive visible events',()=>{
 const note={id:'a',time:1,kind:'arp',gain:.025,duration:.25,midi:72,direction:1};
 it('waits for output-clock onset and then produces a readable trigger',()=>{
  const cues=createChipVisualEvents();expect(cues.enqueue(note,.9)).toBe(true);
  expect(cues.sample(.999).events).toBe(0);
  expect(cues.sample(1.02)).toMatchObject({events:1,direction:1});
  expect(cues.sample(1.02).arp).toBeGreaterThan(.4);
  expect(cues.sample(1.6).events).toBe(0);
 });
 it('does not flash cancelled or silent notes or duplicate callbacks',()=>{
  const cues=createChipVisualEvents();let cancelled=false;
  expect(cues.enqueue({...note,isCancelled:()=>cancelled},.9)).toBe(true);
  expect(cues.enqueue(note,.9)).toBe(false);
  cancelled=true;expect(cues.sample(1.05).attack).toBe(0);
  expect(cues.enqueue({...note,gain:0},.9)).toBe(false);
 });
 it('holds for actual sustain and follows channel stealing/end updates',()=>{
  const cues=createChipVisualEvents();let end=3;
  cues.enqueue({...note,kind:'chord_low',duration:2,getEnd:()=>end},.9);
  expect(cues.sample(2).chord).toBeGreaterThan(.2);
  end=2;expect(cues.sample(2.5).chord).toBe(0);
 });
 it.each(['lead','arp','bass','texture','drum','echo','chord_high','drone'])('shows accepted %s events',kind=>{
  const cues=createChipVisualEvents();cues.enqueue({...note,kind},.9);
  const role=kind.startsWith('chord')||kind==='drone'?'chord':kind;
  expect(cues.sample(1.03)[role]).toBeGreaterThan(0);
 });
 it.each([{active:false},{reducedMotion:true}])('clears on transport or motion restrictions %j',options=>{
  const cues=createChipVisualEvents();cues.enqueue(note,.9);
  expect(cues.sample(1.03,options).events).toBe(0);
  expect(cues.snapshot().queued).toBe(0);
 });
 it('drops future and obsolete events rather than accumulating a backlog',()=>{
  const cues=createChipVisualEvents();expect(cues.enqueue({...note,time:5},1)).toBe(false);
  expect(cues.enqueue({...note,time:0},1)).toBe(false);
 });
 it('aligns to DAC presentation timestamps and falls back to reported latency',()=>{
  const ctx={state:'running',currentTime:10,baseLatency:.01,outputLatency:.03};
  expect(audioPresentationTime(ctx,1000)).toBeCloseTo(9.96);
  ctx.getOutputTimestamp=()=>({contextTime:9.9,performanceTime:950});
  expect(audioPresentationTime(ctx,1000)).toBeCloseTo(9.95);
  expect(audioPresentationTime({...ctx,state:'suspended'},1000)).toBe(null);
 });
});

it('makes EarthBound sustain follow the same ADSR phases and actual voice end',()=>{
 const cues=createChipVisualEvents();let end=2;
 cues.enqueue({id:'adsr',time:1,kind:'chord_low',duration:1,gain:.055,midi:60,adsr:{attack:.06,decay:.12,sustain:.5,release:.15},getEnd:()=>end},.9);
 const start=cues.sample(1.005).sustain,peak=cues.sample(1.06).sustain,held=cues.sample(1.4).sustain,release=cues.sample(1.95).sustain;
 expect(start).toBeLessThan(peak);expect(held).toBeLessThan(peak);expect(release).toBeLessThan(held);
 end=1.95;expect(cues.sample(2.3).sustain).toBe(0);
});
