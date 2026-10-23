import {composeGameBoyDrumBar} from './gameboy-drum-pattern.js?v=469';

import {learnedMarketMelody} from './learned-market-phrase.js?v=469';
import {MIDI_PHRASE_MODEL} from './midi-phrase-model.js?v=469';
import {phraseDevelopment,developPhraseEvents} from './phrase-development.js?v=464';
import {chipEnsembleArrangement} from './chip-ensemble-arrangement.js?v=469';
import {phraseArrangement} from './phrase-arrangement.js?v=449';

// Original market-to-register composition. No imported songs, drum loops,
// stored source melodies, or human backbeat templates. Pooled MIDI statistics
// shape new phrases; a coin chooses the circuit and observed data excites it.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(n,fallback=0)=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n):fallback;
const unit=n=>clamp(number(n),0,1);
export const chipHash=(seed,n)=>{let x=((seed>>>0)^Math.imul((n|0)+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);return (x^(x>>>13))>>>0;};
const roll=(seed,n)=>chipHash(seed,n)/4294967296;
function fingerprint(values){let h=2166136261;for(const value of values){for(const char of String(value))h=Math.imul(h^char.charCodeAt(0),16777619)>>>0;}return h;}

export function marketChipSignal(context={}){
 if(context.signal)return context.signal;
 const m=context.metrics||context,music=context.music||m.music||{},raw=m.raw||m;
 const price=number(m.price??m.context?.latestPrice??m.replay?.price);
 const reference=number(m.referencePrice);
 const delta=reference>0&&price>0?100*(price/reference-1):number(m.delta??music.lastMove??music.changePct);
 const activity=unit(raw.activity??music.activity),volume=unit(raw.volume);
 const motion=unit(raw.motion??music.volatility),intensity=unit(music.intensity);
 const observed=m.observed??(price>0||[raw.activity,raw.motion,raw.volume,music.activity,music.intensity,music.changePct].some(x=>x!=null&&Number.isFinite(Number(x))));
 const fresh=unit(m.fresh??(observed?1:0));
 const balance=m.availability?.balance===false?.5:clamp(number(m.balance,.5),0,1),tradeRate=Math.max(0,number(m.tradeRate));
 const source=m.source??m.replay?.source??(m.decoded?'trades':'snapshots');
 const balanceKnown=m.availability?.balance!==false&&Number.isFinite(m.balance)&&source!=='candles';
 const tradeRateKnown=m.availability?.tradeRate===true||m.decoded===true||source==='lab'||source==='trades';
 const volumeKnown=m.availability?.volume!==false&&raw.volume!=null;
 const data=[price>0?price.toPrecision(10):0,delta.toFixed(5),activity.toFixed(4),volume.toFixed(4),motion.toFixed(4),balance.toFixed(3),tradeRate.toFixed(3)];
 const observationFingerprint=fingerprint(data);
 // Cache identity includes every feature that affects the sound. Freshness
 // can change expression without pretending a new market event arrived.
 return {price,delta,activity,volume,motion,intensity,balance,tradeRate,fresh,observed:!!observed,balanceKnown,tradeRateKnown,volumeKnown,observationFingerprint,fingerprint:fingerprint([...data,intensity.toFixed(4),fresh.toFixed(3),!!observed,source,balanceKnown,tradeRateKnown,volumeKnown]),source};
}

export function chipSignalActive(signal){
 return !!signal.observed&&signal.fresh>0&&(signal.activity>0||signal.volume>0||signal.tradeRate>0||Math.abs(signal.delta)>1e-9||signal.motion>0);
}

// Sample pooled timing/articulation, never a source song or MIDI track.
function statistic(key,seed,index,fallback,allowed=()=>true){
 const rows=(MIDI_PHRASE_MODEL.distributions[key]||[]).filter(([value])=>allowed(value));
 const total=rows.reduce((sum,[,weight])=>sum+weight,0);
 if(!total)return fallback;
 let chance=roll(seed,index)*total;
 for(const [value,weight] of rows){chance-=weight;if(chance<=0)return value;}
 return fallback;
}
const nearest=(value,palette)=>palette.reduce((best,n)=>Math.abs(n-value)<Math.abs(best-value)?n:best,palette[0]);
export function chipPhraseArrangement(seed,beat){
 const state=phraseArrangement(seed,beat),bar=Math.floor(beat/4),development=phraseDevelopment(seed,bar);
 if(development.cadenceBeat===null)return state;
 const restStartBeat=bar*4+development.cadenceBeat,restEndBeat=(bar+1)*4,rest=beat>=restStartBeat;
 return {...state,rest,restStartBeat,restEndBeat,restInBeats:Math.max(0,restStartBeat-beat),phraseGain:rest?0:state.phraseGain};
}

export function composeChipBar(seed,bar,context={}){
 const signal=marketChipSignal(context),active=context.active!==false&&chipSignalActive(signal);
 const identity=chipHash(seed,113),events=[],start=bar*4;
 const root=36+identity%12,minor=chipHash(identity,19)%3!==0;
 const scale=minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
 const degree=[0,5,3,0][Math.floor(bar/2)%4];
 const tone=n=>root+scale[n%7]+12*Math.floor(n/7);
 const notes=[tone(degree)+12,tone(degree+2)+12,tone(degree+4)+12];
 const harmony={root,index:degree,notes,name:minor?'Minor transmission':'Major transmission',character:'machine',group:minor?'down':'up'};
 const development=phraseDevelopment(seed,bar,context);
 const meta={signal,development,harmony,groove:'Learned phrases / asynchronous market circuits'};
 if(!active)return {...meta,events,drums:{patternId:identity.toString(16),density:0,deviation:0}};
 const energy=unit(Math.max(signal.activity,signal.motion,signal.volume*.7,Math.min(1,signal.tradeRate/8)));
 const tension=unit(signal.motion+Math.abs(signal.delta)/8),direction=Math.sign(signal.delta);
 const fracture=unit(context.phraseDepth??.82),gate=clamp(number(context.phraseGate,.72),.2,1);
 const pulseGain=number(context.dataGain,1),textureGain=number(context.textureGain,.55);
 const expression=(kind,id)=>({
  // A coin keeps its voice while activity changes its articulation. Only a
  // strong move bends a selected note; normal phrases retain definite pitch.
  duty:chipHash(identity,['chord_low','chord_high'].includes(kind)?29:23)%3,
  envelope:['bass','drone'].includes(kind)?0:{initial:kind.startsWith('chord')?8:12,direction:-1,pace:kind.startsWith('chord')?0:2+Math.floor((1-energy)*3)},
  wave:chipHash(identity,31)%2,pan:kind==='bass'?0:signal.balanceKnown&&signal.balance<.3?-1:signal.balanceKnown&&signal.balance>.7?1:0,
  slide:kind==='arp'&&tension>.55&&roll(identity,id+83)<.18?direction*fracture*Math.min(2,tension*2):0,
  noiseWidth:signal.motion>.65?7:15,noiseShift:clamp(Math.round(9-6*energy-2*signal.motion),0,13),
 });
 const add=(beat,midi,duration,gain,kind,id,extra={})=>{
  gain*=kind.startsWith('chord')||kind==='drone'?(context.chordGain??1):['arp','echo','lead'].includes(kind)?(context.arpGain??1):(context.noteGain??1);
  if(beat<0||beat>=4||gain<=0)return;
  events.push({beat,midi,duration:Math.min(duration,4-beat),gain:gain*signal.fresh,kind,expression:{...expression(kind,id),...extra},seed:chipHash(identity,id)});
 };
 // Stable, newly generated two-bar material. Price ticks change expression,
 // not the random seed or the entire melodic memory. Harmony develops every
 // two bars; the answer and return recall the same rhythmic/interval idea.
 const motifMusic={intensity:.55,activity:.55,group:harmony.group};
 const groove={events:[0,.75,1.5,2.5,3.25].map(beat=>({beat,duration:.5,accent:1}))};
 const phrase=learnedMarketMelody(seed,development.sourceBar,{harmony,groove,music:motifMusic,
  phraseLearning:1,phraseVariation:context.phraseVariation??0,phraseLength:context.phraseLength??8,
  phraseDepth:.4,pitchLow:60+identity%5,pitchHigh:79+identity%5,phraseGate:gate});
 if(context.arpeggios!==false){
  for(const [i,event] of developPhraseEvents(phrase,development).slice(0,7).entries()){
   add(event.beat,event.midi,Math.max(.18,Math.min(1.35,event.duration)),.062*(.55+.45*energy)*event.accent*pulseGain,'lead',development.sourceBar*101+i,
    {allowedPitches:event.allowedPitches});
  }
 }
 if(context.arpeggios!==false&&development.cadenceBeat!==null){
  const ending=development.cadenceBeat-.5,last=events.filter(e=>e.kind==='lead').at(-1)?.midi??72;
  const tonic=[root+24,root+36].filter(n=>n>=55&&n<=90);
  add(ending,nearest(last,tonic),.5,.056*(.55+.45*energy)*pulseGain,'lead',919,{allowedPitches:tonic});
 }
 // A second chip supplies actual simultaneous harmony while the first
 // keeps independent lead, arpeggio and bass lines. The root is the drone;
 // two upper pulse tones complete its chord without mono-channel theft.
 const chordVoicing=[notes[1],notes[2]],chordDuration=development.cadenceBeat??3.9;
 chordVoicing.forEach((midi,i)=>add(i*.025,midi,chordDuration-i*.025,
  .022*(.7+.3*energy),'chord_'+(i?'high':'low'),211+i));
 const resonance=unit(context.chipResonance??(.25+.5*signal.motion+.15*signal.volume));
 const resonantWave=Array.from({length:32},(_,i)=>{
  const phase=i/32*2*Math.PI,peak=2+chipHash(identity,797)%4;
  // Resonance is baked into legal 4-bit wave RAM. It is a changing harmonic
  // peak in the waveform, not an extra filter or oscillator outside the APU.
  const value=Math.sin(phase)+resonance*.65*Math.sin(phase*peak)+.16*Math.sin(phase*3);
  return Math.round(clamp(7.5+value*7/(1+resonance*.65+.16),0,15));
 });
 add(1.65,tone(degree)+12,Math.max(.1,chordDuration-1.65),.034*(.7+.3*energy),'drone',218,{wave:resonantWave,pan:0});
 // Arps use a compact repeated chord circuit. Echo repeats consume the same
 // pulse lane and decay through real 4-bit envelopes, with gaps reserved here.
 const arpSeed=chipHash(identity,development.sourceBar+301),arpPalette=[...notes,notes[0]+12];
 const arpGap=statistic('lead.inter_onset_beats',arpSeed,5,.75,n=>n>=.5&&n<=1.5);
 const arpNotes=[];
 if(context.arpeggios!==false)for(let i=0,beat=.5;i<5&&beat<3.85;i++,beat+=arpGap){
  const index=(i+(direction<0?arpPalette.length-1:0))%arpPalette.length;
  const midi=arpPalette[direction<0?arpPalette.length-1-index:index]+12;
  const duration=Math.min(.32,arpGap*.48),gain=.025*(.5+.5*energy)*pulseGain;
  add(beat,midi,duration,gain,'arp',301+i,{slide:0,envelope:{initial:9,direction:-1,pace:2}});
  arpNotes.push({beat,midi,duration,gain});
 }
 const echo=arpNotes.at(-1);
 if(echo&&echo.beat<3.1){
  for(let i=1;i<=2;i++)add(echo.beat+i*.28,echo.midi,.16,echo.gain*(i===1?.5:.22),'echo',351+i,
   {slide:0,pan:i%2?-1:1,envelope:{initial:i===1?7:5,direction:-1,pace:1}});
 }
 // Bass timing/gates come from the same corpus, with root/fifth choices tied
 // to this harmonic field. Its half-level wave leaves headroom for the lead.
 const bassSeed=chipHash(identity,development.sourceBar+401);
 for(let i=0,beat=0;i<3&&beat<3.8;i++){
  const gap=statistic('bass.inter_onset_beats',bassSeed,i+1,1.5,n=>n>=.75&&n<=2.5);
  const duration=statistic('bass.duration_beats',bassSeed,i+9,1,n=>n>=.35&&n<=2);
  const articulation=statistic('bass.gate',bassSeed,i+17,.8,n=>n>=.5&&n<=1);
  const bass=tone(degree)+(i===1&&energy>.4?7:0);
  add(beat,bass,Math.min(duration,gap*articulation),.025*(.75+.25*energy),'bass',401+i);
  beat+=gap;
 }
 // Envion's density/overlap logic becomes short legal noise grains on
 // the second chip. Prime phase remains coin-specific; the ensemble decides
 // when this cloud surfaces and when it leaves the foreground clear.
 const cloud=chipEnsembleArrangement(seed,start+.01,signal);
 const spacing=Math.max(.18,cloud.grainSpacingBeats),phase=roll(identity,71)*spacing;
 if(textureGain>0)for(let step=Math.max(0,Math.ceil((start-phase)/spacing));step*spacing+phase<start+4;step++){
  if(roll(identity,step+601)>cloud.grainDensity)continue;
  events.push({kind:'texture',drum:'texture',beat:step*spacing+phase-start,duration:cloud.grainDurationBeats,
   gain:.018*textureGain*(.4+.6*energy)*signal.fresh,seed:chipHash(identity,step+601),
   expression:{...expression('texture',step+601),noiseDivider:chipHash(identity,step+607)%8,envelope:{initial:5,direction:-1,pace:1}}});
 }
 const drums=composeGameBoyDrumBar(seed,bar,{...context,signal},development);
 const melody=events.filter(event=>event.kind==='lead');
 for(const event of drums.events){
  // Tonal percussion uses CH1 only in gaps, leaving the motif intelligible.
  if(['kick','tom'].includes(event.drum)&&melody.some(note=>event.beat<note.beat+note.duration+.04&&event.beat+event.duration>note.beat-.06))continue;
  const accent=statistic('drums.accent',identity,event.seed,.85,n=>n>=.45&&n<=1.15);
  const articulation=statistic('drums.gate',identity,event.seed+1,.75,n=>n>=.3&&n<=1);
  events.push({...event,gain:event.gain*accent*(context.drumGain??1),duration:event.duration*(.65+.35*articulation)});
 }
 // All eight slots breathe together, including the irregular noise circuits.
 const phrased=[];
 for(const event of events){
  const arrangement=chipEnsembleArrangement(seed,start+event.beat,signal);
  if(arrangement.rest||arrangement.restInBeats<.04||event.gain<=0)continue;
  event.duration=Math.min(event.duration,4-event.beat,arrangement.restInBeats);
  const role=event.kind.startsWith('chord')?'chord':event.kind==='echo'?'arp':event.kind;
  event.gain*=arrangement.roleGains[role]??arrangement.phraseGain;
  if(event.gain<=0)continue;
  if(development.cadenceBeat!==null){
   if(event.beat>=development.cadenceBeat)continue;
   event.duration=Math.min(event.duration,development.cadenceBeat-event.beat);
  }
  if(event.duration>=.025)phrased.push(event);
 }
 const chip=e=>['chord_low','chord_high','drone','texture'].includes(e.kind)?1:0;
 const channel=e=>e.kind==='texture'||(e.kind==='drum'&&['hat','snare'].includes(e.drum))?3:['bass','drone'].includes(e.kind)?2:['arp','echo','chord_high'].includes(e.kind)?1:0;
 const priority=e=>e.kind==='lead'?5:e.kind==='drum'?4:e.kind==='texture'?1:3;
 phrased.sort((a,b)=>a.beat-b.beat||priority(b)-priority(a));
 const accepted=[],last=Array(8).fill(null);
 for(const event of phrased){
  const ch=channel(event),unit=chip(event),slot=unit*4+ch,previous=last[slot];
  if(previous&&event.beat-previous.beat<.012)continue;
  if(previous)previous.duration=Math.min(previous.duration,event.beat-previous.beat);
  event.channel=ch;event.chip=unit;accepted.push(event);last[slot]=event;
 }
 return {...meta,events:accepted.filter(e=>e.duration>=.025),drums:{patternId:drums.patternId,density:drums.density,deviation:drums.deviation,performance:drums.performance}};
}
