import {describe,expect,it} from 'vitest';
import {scoreCandle} from '../public/market-replay.js';
import {composeChipBar,marketChipSignal} from '../public/market-chip-score.js';
import {chipEnsembleArrangement} from '../public/chip-ensemble-arrangement.js';
import {compileGameBoyEvent} from '../public/gb-apu-instrument.js';
import {GameBoyApu} from '../public/mame-gb-apu.js';

const seeds=[1,1917,987654,0xdeadbeef];
const sampleRate=48000,tempo=120,interval=60000;
const market={priceUsd:100,marketCap:1000000};
const fixtures=[
 {name:'quiet $600/min candle',volume:600,change:.05},
 {name:'moving $600/min candle',volume:600,change:2},
 {name:'actual movement with unknown volume',volume:undefined,change:1},
];

function candleMetrics({volume,change}){
 const close=100+change;
 const bar={time:0,open:100,high:Math.max(100,close),low:Math.min(100,close),close,volume};
 return scoreCandle([bar],market,interval,bar);
}

function score(seed,bar,metrics){
 return composeChipBar(seed,bar,{metrics,music:{...metrics.music,tempo}});
}

// The rack translates explicit pulse slots to the driver's note/chord kinds.
// Keep its real scored gain and envelope, and convert score beats to seconds
// exactly once before compiling. Checking only score event counts would miss
// support voices that quantize to volume 1 and vanish on the first decay step.
function compiledPulse(event){
 expect([0,1]).toContain(event.channel);
 const compiled=compileGameBoyEvent({...event,kind:event.channel===0?'note':'chord',duration:event.duration*60/tempo},{},sampleRate);
 expect(compiled,`${event.kind} should survive register compilation`).not.toBeNull();
 const envelope=compiled.writes.find(([address])=>address===(compiled.channel===0?0xff12:0xff17))?.[1];
 expect(envelope).toBeTypeOf('number');
 return {compiled,volume:envelope>>>4,pace:envelope&7};
}

// Execute the actual APU long enough to cross several 64 Hz envelope clocks.
// Read channel state and late-window waveform energy, not just the trigger
// register: a short initial click is not a sustained musical support note.
function soundAt(compiled,seconds){
 const apu=new GameBoyApu({sampleRate,model:'dmg'});
 apu.write(0xff26,0x80);apu.write(0xff24,0x77);apu.write(0xff25,0xff);
 for(const [address,value] of compiled.writes)apu.write(address,value);
 const sample=new Float64Array(2),frames=Math.floor(seconds*sampleRate),window=Math.min(frames,480);
 let energy=0;
 const updates=[...(compiled.updates||[])].sort((a,b)=>a.frame-b.frame);let next=0;
 for(let frame=0;frame<frames;frame++){
  while(next<updates.length&&updates[next].frame<=frame){
   for(const [address,value] of updates[next++].writes)apu.write(address,value);
  }
  apu.sample(sample);
  if(frame>=frames-window)energy+=sample[0]**2+sample[1]**2;
 }
 return {channel:apu.snapshot().channels[compiled.channel],rms:Math.sqrt(energy/(2*window))};
}

describe('audible chip support from real candle controls',()=>{
 for(const fixture of fixtures)describe(fixture.name,()=>{
  it.each(seeds)('keeps a recognizable arpeggio response for coin seed %s',seed=>{
   const metrics=candleMetrics(fixture),signal=marketChipSignal({metrics});
   expect(signal.tradingActivity).toBe(1);
   expect(signal.volumeKnown).toBe(fixture.volume!==undefined);
   // One complete eight-bar form covers introduce, answer, vary and return.
   for(let pair=0;pair<4;pair++){
    const pairStart=pair*8,response=chipEnsembleArrangement(seed,pairStart,signal).responseWindow;
    const notes=[0,1].flatMap(offset=>{
     const bar=pair*2+offset;
     return score(seed,bar,metrics).events.filter(event=>event.kind==='arp').map(event=>({...event,at:bar*4+event.beat}));
    });
    expect(notes.length,`${fixture.name}, seed ${seed}, response ${pair}`).toBeGreaterThanOrEqual(2);
    expect(notes.length).toBeLessThanOrEqual(4);
    expect(new Set(notes.map(event=>event.midi)).size).toBeGreaterThanOrEqual(2);
    for(const event of notes){
     expect(event.at).toBeGreaterThan(response.start);
     expect(event.at+event.duration).toBeLessThanOrEqual(response.end+1e-9);
     const {compiled,volume,pace}=compiledPulse(event);
     expect(volume).toBeGreaterThanOrEqual(1);
     expect(soundAt(compiled,.025).channel.volume).toBeGreaterThanOrEqual(2);
     expect(pace).toBe(0);
     expect(compiled.durationFrames/sampleRate).toBeGreaterThanOrEqual(.06);
     const late=soundAt(compiled,.06);
     expect(late.channel.enabled).toBe(true);
     expect(late.channel.volume).toBeGreaterThan(0);
     expect(late.rms).toBeGreaterThan(.001);
    }
   }
  });

  it.each(seeds)('keeps audible held chords without filling every bar for coin seed %s',seed=>{
   const metrics=candleMetrics(fixture),plans=Array.from({length:8},(_,bar)=>score(seed,bar,metrics));
   const chordBars=plans.flatMap((plan,bar)=>plan.events.some(event=>event.kind.startsWith('chord_'))?[bar]:[]);
   // These modest aggregate inputs receive one entrance per four bars.
   expect(chordBars).toHaveLength(2);
   expect(chordBars[1]-chordBars[0]).toBe(4);
   expect(plans.filter(plan=>!plan.events.some(event=>event.kind.startsWith('chord_')))).toHaveLength(6);
   for(const bar of chordBars){
    const chord=plans[bar].events.filter(event=>event.kind.startsWith('chord_'));
    expect(chord.map(event=>event.kind).sort()).toEqual(['chord_high','chord_low']);
    expect(plans[bar].events.some(event=>event.kind==='drone'&&event.ensembleRole==='chord')).toBe(true);
    for(const event of chord){
     const {compiled,volume,pace}=compiledPulse(event);
     expect(volume).toBeGreaterThanOrEqual(1);
     expect(soundAt(compiled,.025).channel.volume).toBeGreaterThanOrEqual(2);
     expect(pace).toBe(0);
     expect(compiled.durationFrames/sampleRate).toBeGreaterThan(.3);
     const held=soundAt(compiled,.25);
     expect(held.channel.enabled).toBe(true);
     expect(held.channel.volume).toBe(soundAt(compiled,.025).channel.volume);
     expect(held.rms).toBeGreaterThan(.001);
    }
   }
  });
 });

 it.each(seeds)('still leaves chord-free bars under strong actual activity, seed %s',seed=>{
  const metrics={source:'trades',observed:true,fresh:1,tradingActivity:1,activity:1,volume:1,motion:1,
   tradeRate:8,balance:.5,price:102,referencePrice:100,availability:{volume:true,tradeRate:true,balance:true},music:{intensity:1}};
  const chordBars=Array.from({length:8},(_,bar)=>score(seed,bar,metrics)).flatMap((plan,bar)=>plan.events.some(event=>event.kind.startsWith('chord_'))?[bar]:[]);
  expect(chordBars).toHaveLength(4);
  expect(chordBars.every((bar,index)=>index===0||bar-chordBars[index-1]>=2)).toBe(true);
 });

 it.each(seeds)('does not manufacture support from zero volume, absent evidence or stale input, seed %s',seed=>{
  const active=candleMetrics(fixtures[1]);
  const quiet=[
   candleMetrics({volume:0,change:2}),
   candleMetrics({volume:undefined,change:0}),
   {...active,fresh:0},
   {...active,observed:false},
  ];
  for(const metrics of quiet)for(let bar=0;bar<8;bar++)expect(score(seed,bar,metrics).events).toEqual([]);
 });
});
