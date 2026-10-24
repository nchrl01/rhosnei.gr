import {composeChipBar as composeFridayBar} from './friday-transmission-score.js?v=491';
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
 const plan=composePreDrumBar(seed,bar,{...context,music,cap:signal.marketCap,active,pitchLow:43,pitchHigh:Math.min(67,high-12),phraseLearning:1});
 const events=[],presence=signal.fresh*Math.sqrt(unit(signal.tradingActivity));let chordIndex=0;
 for(const [index,event] of plan.events.entries()){
  const base={...event,seed:chipHash(seed,bar*257+index),expression:{}};
  const gain=event.gain*presence;
  if(event.kind==='chord'){
   const slot=chordIndex++%4,channel=slot%2;
   Object.assign(base,{chip:1+Math.floor(slot/2),channel,midi:event.midi-12,kind:channel?'chord_high':'chord_low',gain:gain*(context.chordGain??1),
    expression:{duty:channel?2:1,pan:channel?1:-1,envelope:{initial:10,pace:0},adsr:{attack:.006+.008*(chipHash(seed,bar*31+slot)/4294967296),decay:.16,sustain:.58+.14*mapping.harmony.musicality,release:.28}}});
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
 // The Friday circuit occupies spare lanes, never the chord or bass lanes.
 // Its asynchronous interruptions remain local to this quieter countervoice.
 const machine=composeFridayBar(seed,bar,{...context,signal,active,octaves:true,deepRegister:true});
 const occupied=new Set(),classes=plan.harmony.notes.map(n=>(n%12+12)%12);
 for(const event of machine.events){
  const room=performedArrangement(seed,bar*4+event.beat,signal);
  if(!active||room.rest)continue;
  const bucket=Math.floor(event.beat*2);
  if(occupied.has(bucket)||occupied.size>=4)continue;
  occupied.add(bucket);
  const noise=event.channel===3,wave=event.channel===2;
  const chip=wave?1:0,channel=noise?3:wave?2:1;
  let midi=event.midi;
  if(!noise&&Number.isFinite(midi)){
   const candidates=Array.from({length:25},(_,i)=>midi-12+i).filter(n=>classes.includes((n%12+12)%12));
   midi=candidates.sort((a,b)=>Math.abs(a-event.midi)-Math.abs(b-event.midi))[0]??midi;
  }
  const duration=Math.min(event.duration,.45,room.restInBeats);
  const gain=event.gain*presence*(noise?.12:.24)*(context.textureGain??1);
  if(duration>=.025&&gain>0)events.push({...event,chip,channel,midi,duration,gain,
   drum:noise?'texture':undefined,kind:noise?'texture':wave?'drone':'arp',
   expression:{...event.expression,allowedPitches:noise?undefined:[midi],pan:0,adsr:noise?undefined:{attack:.008,decay:.07,sustain:.45,release:.08}}});
 }
 events.sort((a,b)=>a.beat-b.beat);
 const lanes=new Map();
 for(const event of events){const key=event.chip+':'+event.channel,previous=lanes.get(key);if(previous)previous.duration=Math.min(previous.duration,event.beat-previous.beat);lanes.set(key,event);}
 return {...plan,signal,events:events.filter(e=>e.duration>=.025),
  development:{stage:'musical-transmission',motifId:chipHash(seed,113).toString(16),supportGain:1,cadenceBeat:null,sourceBar:bar},
  drums:{enabled:events.some(e=>e.drum),patternId:machine.drums?.patternId||'Friday countervoice',density:machine.drums?.density||0,deviation:machine.drums?.deviation||0},musicalMapping:mapping};
}
