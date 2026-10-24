import {gameBoyDrumControls} from './friday-transmission-packets.js?v=489';
import {composeChipBar as composeFridayBar} from './friday-transmission-score.js?v=491';
import {marketChipSignal,chipSignalActive,chipHash} from './market-chip-score.js?v=480';
import {marketMusicalMapping} from './market-musical-mapping.js?v=472';
import {phraseArrangement} from './phrase-arrangement.js?v=449';
import {chipVoiceEnvelope,resonantChipWave} from './chip-voice-timbre.js?v=486';
const unit=value=>Math.max(0,Math.min(1,Number(value)||0));

export function performedArrangement(seed,beat,signal={}){
 const phrase=phraseArrangement(seed,beat),active=chipSignalActive(signal);
 return {...phrase,active:active&&!phrase.rest,roleGains:{texture:active?phrase.layers.envion:0},grainDensity:0,grainDurationBeats:0,grainOverlap:0};
}

// The complete Friday process remains the source of clocks, note proposals,
// observation-driven pattern changes and four-channel interruption. Research
// informs low-register dialogue and per-packet articulation, not a substitute
// bar grid: https://musictech.com/features/squarepusher-interview/
export function composePerformedBar(seed,bar,context={}){
 const signal=marketChipSignal(context),mapping=marketMusicalMapping(signal);
 const active=context.active!==false&&chipSignalActive(signal);
 const packetDensity=gameBoyDrumControls({...context,signal}).density;
 const drumDensity=context.drumDensity??(mapping.known.marketCap?packetDensity*mapping.rhythm.rate:packetDensity);
 const plan=composeFridayBar(seed,bar,{...context,signal,active,drumDensity,octaves:true,deepRegister:true});
 const phase=((bar%8)+8)%8,section=['current','current','fracture','fracture','suspension','response','return','return'][phase];
 const events=[],liquidity=mapping.harmony.musicality,recency=Math.sqrt(unit(signal.tradingActivity));
 const resonance=Number.isFinite(context.chipResonance)?unit(context.chipResonance):.12+.38*mapping.change.magnitude+.18*liquidity;
 for(const event of plan.events){
  const state=performedArrangement(seed,bar*4+event.beat,signal);
  if(!active||state.rest)continue;
  const e={...event,chip:0,expression:{...event.expression}},variation=chipHash(seed,event.seed^Math.imul(bar+1,193))/4294967296;
  e.duration=Math.min(e.duration,state.restInBeats);
  const noise=e.channel===3;
  // Measured holder population opens more of the existing arp proposals.
  // An estimated visual population never becomes a musical observation.
  if(e.kind==='arp'&&mapping.known.holders&&variation>.6+.4*mapping.arpeggio.population)continue;
  // Noise breathes around the low pitched line, with no high-register hook
  // or new drum pattern replacing the original asynchronous proposals.
  e.gain*=recency*(noise?(section==='suspension'?.46:section==='response'?.65:.85):1);
  if(!noise){
   e.expression.resonance=resonance;
   e.expression.cents=Math.sign(signal.delta)*(variation-.5)*16;
   if(e.kind==='bass'&&variation>.45)e.expression.wave=resonantChipWave({resonance,harmonic:2+phase%3,phase:variation,grit:mapping.change.magnitude*.3});
   // Leave most hardware-decay packets untouched. Only longer voices swell;
   // fitting ADSR into every tiny grain would erase Friday's articulation.
   if(e.duration>.24&&variation>.72)e.expression.adsr=chipVoiceEnvelope(e.kind==='bass'?'bass':e.kind==='chord'?'chord':'arp',
    {variation,liquidity,activity:mapping.tempo.activity,tension:mapping.change.magnitude,phrase:phase});
   if(e.channel<2&&variation>.55)e.expression.dutyShift={duty:(Number(e.expression.duty)+1)%4,at:.3+.4*variation};
  }
  if(e.duration>=.012&&e.gain>0)events.push(e);
 }
 // Any phrase breath changed the last gate; reassert mono ownership after
 // modulation. The next note always interrupts the same physical channel.
 events.sort((a,b)=>a.beat-b.beat);const last=[null,null,null,null];
 for(const event of events){const previous=last[event.channel];if(previous)previous.duration=Math.min(previous.duration,event.beat-previous.beat);last[event.channel]=event;}
 return {...plan,signal,events:events.filter(e=>e.duration>=.012),musicalMapping:mapping,
  development:{...plan.development,stage:section,source:'Friday four-channel process',register:'low',resonance},
  drums:{...plan.drums,enabled:events.some(e=>e.drum),density:plan.drums.density}};
}
