import {composePreDrumBar} from './pre-drum-arrangement.js?v=481';
import {marketChipSignal,chipSignalActive,chipHash} from './market-chip-score.js?v=480';
import {marketMusicalMapping} from './market-musical-mapping.js?v=472';
import {chartCharacter} from './music-context.js?v=208';
import {phraseArrangement} from './phrase-arrangement.js?v=449';
const unit=value=>Math.max(0,Math.min(1,Number(value)||0));

export function performedArrangement(seed,beat,signal={}){
 const phrase=phraseArrangement(seed,beat),active=chipSignalActive(signal);
 return {...phrase,active:active&&!phrase.rest,roleGains:{texture:active?phrase.layers.envion:0},
  grainDensity:0,grainDurationBeats:0,grainOverlap:0};
}

// The approved pre-drum score, performed by three real GB APUs. A score
// address reconstructs its own chord slots, so seek/export need no RNG history.
export function composePerformedBar(seed,bar,context={}){
 const signal=marketChipSignal(context),mapping=marketMusicalMapping(signal);
 const active=context.active!==false&&chipSignalActive(signal);
 const delta=mapping.known.change?signal.delta:0;
 const tempo=context.audibleTempo||(signal.source==='lab'?context.music?.tempo:null)||mapping.tempo.bpm;
 const character=chartCharacter({group:delta<0?'down':'up',capChangePct:delta,intensity:signal.intensity,volatility:signal.motion});
 const music={...context.music,character,group:delta<0?'down':'up',tempo,activity:signal.activity,intensity:signal.intensity,changePct:delta};
 const high=mapping.known.holders?55+mapping.arpeggio.span:76;
 const plan=composePreDrumBar(seed,bar,{...context,music,cap:signal.marketCap,active,pitchLow:55,pitchHigh:Math.min(79,high),phraseLearning:1});
 const events=[],presence=signal.fresh*Math.sqrt(unit(signal.tradingActivity));let chordIndex=0;
 for(const [index,event] of plan.events.entries()){
  const base={...event,seed:chipHash(seed,bar*257+index),expression:{}};
  const gain=event.gain*presence;
  if(event.kind==='chord'){
   const slot=chordIndex++%4,channel=slot%2;
   Object.assign(base,{chip:1+Math.floor(slot/2),channel,kind:channel?'chord_high':'chord_low',gain:gain*(context.chordGain??1),
    expression:{duty:channel?2:1,pan:channel?1:-1,envelope:{initial:10,pace:0},adsr:{attack:.035,decay:.12,sustain:.78+.12*(mapping.harmony.musicality-.5),release:.22*(.75+.5*mapping.harmony.musicality)}}});
  }else if(event.kind==='bass'){
   Object.assign(base,{chip:0,channel:2,midi:Math.max(28,event.midi),gain:gain*.5*(context.noteGain??1),expression:{wave:4,pan:0,adsr:{attack:.01,decay:.09,sustain:.7,release:.15}}});
  }else{
   Object.assign(base,{chip:0,channel:0,kind:'arp',gain:gain*.7*(context.arpGain??1)*(context.dataGain??1),expression:{allowedPitches:event.allowedPitches,duty:2,pan:0,envelope:{initial:9,pace:0},adsr:{attack:.012,decay:.07,sustain:.72,release:.12}}});
  }
  if(base.gain>0&&base.duration>=.025)events.push(base);
 }
 const room=performedArrangement(seed,bar*4+1.5,signal);
 const resonance=Number.isFinite(context.chipResonance)?unit(context.chipResonance):0;
 const textureWave=resonance?Array.from({length:32},(_,i)=>Math.round(7.5+7*(Math.sin(i*Math.PI/16)+.3*resonance*Math.sin(i*Math.PI*3/16))/(1+.3*resonance))):4;
 if(active&&!room.rest&&bar%2===1){
  const duration=Math.min(3,room.restInBeats),gain=.012*room.layers.envion*presence*(context.textureGain??1);
  if(duration>.05&&gain>0)events.push({kind:'drone',chip:2,channel:2,beat:1.5,midi:plan.harmony.root-12,duration,gain,seed:chipHash(seed,bar*257+251),
   expression:{wave:textureWave,cents:Math.sign(delta)*8,vibrato:{depth:5,cycles:1},adsr:{attack:.08,decay:.2,sustain:.75,release:.3}}});
 }
 return {...plan,signal,events:events.sort((a,b)=>a.beat-b.beat),
  development:{stage:'pre-drum',motifId:chipHash(seed,113).toString(16),supportGain:1,cadenceBeat:null,sourceBar:bar},
  drums:{enabled:false,patternId:'pre-drum',density:0,deviation:0},musicalMapping:mapping};
}
