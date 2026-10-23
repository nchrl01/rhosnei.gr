import {marketPerformance} from './market-performance.js?v=472';
import {marketMusicalMapping} from './market-musical-mapping.js?v=472';
import {composeGameBoyDrumBar} from './gameboy-drum-pattern.js?v=472';

import {learnedMarketMelody} from './learned-market-phrase.js?v=469';
import {MIDI_PHRASE_MODEL} from './midi-phrase-model.js?v=469';
import {phraseDevelopment,developPhraseEvents} from './phrase-development.js?v=464';
import {chipEnsembleArrangement,chipMarketExpression} from './chip-ensemble-arrangement.js?v=471';
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
 const m=context.metrics||context,music=context.music||m.music||{};
 const signal=marketPerformance(m,music);
 if(signal.marketCap===null&&number(context.cap)>0)signal.marketCap=number(context.cap);
 const data=[signal.price>0?signal.price.toPrecision(10):0,signal.delta.toFixed(5),signal.activity.toFixed(4),signal.volume.toFixed(4),signal.motion.toFixed(4),signal.balance.toFixed(3),signal.tradeRate.toFixed(3)];
 const observationFingerprint=fingerprint(data);
 return {...signal,observationFingerprint,
  fingerprint:fingerprint([...data,signal.intensity.toFixed(4),signal.pressure.toFixed(4),signal.fresh.toFixed(3),signal.tradingActivity.toFixed(4),signal.observed,signal.source,signal.balanceKnown,signal.tradeRateKnown,signal.volumeKnown,signal.marketCap,signal.liquidity,signal.holders,signal.holdersKnown,signal.deltaKnown,signal.activityKnown])};
}

export function chipSignalActive(signal){
 const activity=signal.tradingActivity??Number(signal.activity>0||signal.volume>0||signal.tradeRate>0||Math.abs(signal.delta)>1e-9||signal.motion>0);
 return !!signal.observed&&signal.fresh>0&&activity>0;
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
 const {energy,pace,volume,motion,intensity,tradingActivity}=chipMarketExpression(signal);
 const mapping=marketMusicalMapping(signal),direction=mapping.change.direction;
 const {stability,musicality,gate:liquidityGate}=mapping.harmony;
 const fracture=unit(context.phraseDepth??.82),gate=clamp(number(context.phraseGate,.72),.2,1);
 const pulseGain=number(context.dataGain,1),textureGain=number(context.textureGain,.55);
 const expression=(kind,id)=>({
  // A coin keeps its voice while activity changes its articulation. Only a
  // strong move bends a selected note; normal phrases retain definite pitch.
  duty:clamp(chipHash(identity,['chord_low','chord_high'].includes(kind)?29:23)%3+(mapping.change.magnitude>.35?direction:0),0,3),
  envelope:['bass','drone'].includes(kind)?0:{initial:kind.startsWith('chord')?11+Math.round(3*volume):8+Math.round(4*intensity),direction:-1,pace:kind.startsWith('chord')?0:2+Math.floor((1-pace)*3)},
  // Register routing creates space inside the chips. Root/bass stay central;
  // the two chord tones occupy opposite sides, independently of trade bias.
  wave:chipHash(identity,31)%2,pan:kind==='bass'||kind==='drone'?0:kind==='chord_low'?-1:kind==='chord_high'?1:signal.balanceKnown&&signal.balance<.3?-1:signal.balanceKnown&&signal.balance>.7?1:0,
  slide:['lead','arp'].includes(kind)&&mapping.change.magnitude>.2&&roll(identity,id+83)<.22?direction*fracture*mapping.change.magnitude*(1.4-.8*stability):0,
  noiseWidth:motion>.65?7:15,noiseShift:clamp(Math.round(9-6*energy-2*motion-2*mapping.change.signed),0,13),
 });
 const add=(beat,midi,duration,gain,kind,id,extra={})=>{
  gain*=kind.startsWith('chord')||kind==='drone'?(context.chordGain??1):['arp','echo','lead'].includes(kind)?(context.arpGain??1):(context.noteGain??1);
  if(beat<0||beat>=4||gain<=0)return;
  const event={beat,midi,duration:['arp','echo'].includes(kind)?duration:Math.min(duration,4-beat),gain:gain*signal.fresh,kind,expression:{...expression(kind,id),...extra},seed:chipHash(identity,id)};
  events.push(event);return event;
 };
 // Stable, newly generated two-bar material. Price ticks change expression,
 // not the random seed or the entire melodic memory. Harmony develops every
 // two bars; the answer and return recall the same rhythmic/interval idea.
 // Build a stable pool of possible notes at full occupancy. Actual observed
 // activity admits notes below; it never changes the generator's RNG walk.
 const motifMusic={intensity:1,activity:1,group:harmony.group};
 const groove={events:[0,.75,1.5,2.5,3.25].map(beat=>({beat,duration:.5,accent:1}))};
 const phrase=learnedMarketMelody(seed,development.sourceBar,{harmony,groove,music:motifMusic,
  phraseLearning:1,phraseVariation:context.phraseVariation??0,phraseLength:context.phraseLength??8,
  phraseDepth:.4,pitchLow:60+identity%5,pitchHigh:79+identity%5,phraseGate:gate});
 if(context.arpeggios!==false){
  for(const [i,event] of developPhraseEvents(phrase,development).slice(0,7).entries()){
   const id=development.sourceBar*101+i;
   if(roll(identity,id+10007)>=tradingActivity*unit(.32+.5*energy+.18*intensity))continue;
   const articulation=(.72+.5*(1-pace)+.15*volume)*(.7+.4*liquidityGate);
   // Greater observed liquidity gives stronger harmonic settlement, using
   // only this newly generated phrase's allowed pitches. The learned rhythm,
   // motif development and final source-originality screen still apply.
   const settle=event.beat%1<.15&&roll(identity,id+10009)<stability*.4;
   const target=nearest(event.midi,notes.flatMap(note=>[note,note+12,note+24]));
   const midi=settle&&event.allowedPitches?.length?nearest(target,event.allowedPitches):event.midi;
   add(event.beat,midi,Math.max(.12,Math.min(1.5,event.duration*articulation)),.062*(.45+.35*energy+.2*intensity)*event.accent*pulseGain,'lead',id,
    {allowedPitches:event.allowedPitches,...(event.duration>.4?{sustain:{hold:.48+.24*musicality,steps:2}}:{})});
  }
 }
 if(context.arpeggios!==false&&development.cadenceBeat!==null&&events.some(event=>event.kind==='lead')){
  const ending=development.cadenceBeat-.5,last=events.filter(e=>e.kind==='lead').at(-1)?.midi??72;
  const tonic=[root+24,root+36].filter(n=>n>=55&&n<=90);
  add(ending,nearest(last,tonic),.5,.056*(.55+.45*energy)*pulseGain,'lead',919,{allowedPitches:tonic});
 }
 // Sparse harmony is a phrase decision, not another low-probability gate on
 // each note. An eligible observation gets one seeded entrance every four
 // bars; stronger actual data can add the opposite entrance, two bars away.
 // Recency can release the whole chord, but quiet valid candles do not lose
 // their harmonic role merely because their volume rate is below a coin flip.
 const chordCycle=Math.floor(bar/4),chordPhase=chipHash(identity,203)%4;
 const chordSlot=bar%4===chordPhase||(energy>=.55&&bar%4===(chordPhase+2)%4);
 const chordEntrance=chordSlot&&roll(identity,bar+21001)<Math.sqrt(tradingActivity);
 const chordBeat=(chipHash(identity,chordCycle+21101)%4)*.25;
 const chordDuration=(.65+1.25*(1-motion)+.25*volume)*(.65+.45*liquidityGate);
 // Match the visual's smooth market-cap identity range. This changes only
 // harmonic colour in legal wave RAM at an onset; it cannot activate sound,
 // change the root or retune an already sounding voice. Unknown is neutral.
 const cap=number(signal.marketCap,null),capPosition=cap>0?unit(Math.log10(cap/1e7)/Math.log10(5)):.5;
 const capColour=capPosition*capPosition*(3-2*capPosition);
 const resonance=unit(context.chipResonance??(.12+.42*motion+.15*volume+.1*intensity+.21*(1-musicality)*mapping.change.magnitude));
 const resonantWave=Array.from({length:32},(_,i)=>{
  const phase=i/32*2*Math.PI,peak=2+chipHash(identity,797)%4;
  // Resonance is baked into legal 4-bit wave RAM. It is a changing harmonic
  // peak in the waveform, not an extra filter or oscillator outside the APU.
  const colour=.08+.16*capColour;
  const value=Math.sin(phase)+resonance*.65*Math.sin(phase*peak)+colour*Math.sin(phase*3);
  return Math.round(clamp(7.5+value*7/(1+resonance*.65+colour),0,15));
 });
 if(chordEntrance){
  [notes[1],notes[2]].forEach((midi,i)=>add(chordBeat+i*.025,midi,chordDuration-i*.025,
   .032*(.7+.3*energy),'chord_'+(i?'high':'low'),211+i,
   {sustain:{hold:.55+.2*musicality,steps:3},dutyShift:mapping.change.magnitude>.25?{at:.36,duty:i?2:1}:undefined}));
  const ground=add(chordBeat,tone(degree)+12,chordDuration,.03*(.7+.3*energy),'drone',218,{wave:resonantWave,pan:0,sustain:{hold:.65,steps:2}});
  if(ground)ground.ensembleRole='chord'; // Root plus two pulses form a true chord.
 }else if((bar+chipHash(identity,217))%2===0&&roll(identity,bar+21801)<tradingActivity*(.12+.35*volume+.25*(1-pace))){
  const beat=1.65+.25*(chipHash(identity,bar+21803)%3);
  add(beat,tone(degree)+12,.8+1.25*volume+.65*(1-pace),.034*(.7+.3*energy),'drone',218,{wave:resonantWave,pan:0,sustain:{hold:.5+.25*musicality,steps:2}});
 }
 // One coherent answer gesture occupies the actual response window. Its
 // pooled timing remains stable within the coin/score pair. Observed holder
 // population chooses two to four notes and register span; market cap shapes
 // their spacing. Independent note coin flips used to erase quiet responses.
 const pair=Math.floor(bar/2),pairStart=pair*8;
 const arpSeed=chipHash(identity,pair+301),arpCount=mapping.arpeggio.notes;
 const arpRoot=Math.min(72,notes[0]+12),arpSpan=mapping.arpeggio.span;
 const arpPalette=[0,12,24].flatMap(octave=>notes.map(note=>arpRoot+note-notes[0]+octave)).filter(note=>note<=arpRoot+arpSpan);
 const arpPitches=Array.from({length:arpCount},(_,i)=>nearest(arpRoot+arpSpan*i/(arpCount-1),arpPalette));
 if(direction<0)arpPitches.reverse();
 const response=chipEnsembleArrangement(seed,pairStart,signal).responseWindow;
 const first=response.start+.45;
 const answer=chipEnsembleArrangement(seed,first,signal);
 const answerEnd=Math.min(response.end-.2,answer.restStartBeat);
 const sampledGap=statistic('lead.inter_onset_beats',arpSeed,5,.5,n=>n>=.25&&n<=.75)/mapping.rhythm.rate;
 const arpGap=Math.min(sampledGap,Math.max(0,answerEnd-first-.32)/3);
 const room=Math.max(0,answerEnd-first-.32-3*arpGap);
 const arpStart=first+Math.min(.125,room)*roll(identity,pair+30501);
 const arpEntrance=arpGap>=.08&&roll(identity,pair+30101)<Math.sqrt(tradingActivity);
 let echoSource=null;
 if(context.arpeggios!==false&&arpEntrance)for(let i=0;i<arpCount;i++){
  const beat=arpStart+i*arpGap-start;
  const midi=arpPitches[i],pooledGate=statistic('lead.gate',arpSeed,i+41,.72,n=>n>=.5&&n<=1);
  const accent=statistic('lead.accent',arpSeed,i+51,.95,n=>n>=.8&&n<=1.15);
  const duration=Math.min(.45,Math.max(.2,arpGap*pooledGate*(.75+.35*liquidityGate))),gain=.038*(.5+.5*energy)*accent*pulseGain;
  const envelope={initial:11+Math.round(2*intensity),direction:-1,pace:3};
  add(beat,midi,duration,gain,'arp',301+i,{envelope});
  if(i===arpCount-1)echoSource={beat:arpStart+i*arpGap,midi,duration,gain,envelope};
 }
 if(echoSource){
  const sourceArrangement=chipEnsembleArrangement(seed,echoSource.beat,signal);
  const sourceGain=sourceArrangement.roleGains.arp;
  const sourceSurvives=!sourceArrangement.rest&&sourceArrangement.restInBeats>=.04&&sourceGain>0;
  const delay=[.25,.375,.5][chipHash(identity,pair+350)%3],count=musicality>.55&&pace<.65?2:1;
  // A tail follows its sounded answer, including across the middle bar. It
  // inherits the source's actual gain/recency instead of being erased by the
  // dry response window closing. Common rests, inactivity and CH2 ownership
  // still stop it. Quantized echoDecay is compiled to a lower chip level.
  if(sourceSurvives)for(let i=1;i<=count;i++){
   const echo=add(echoSource.beat+echoSource.duration+delay*i-start,echoSource.midi,.24+.18*liquidityGate,echoSource.gain,'echo',351+i,
    {slide:0,pan:i%2?-1:1,echoDecay:i===1?.65:.35,envelope:{...echoSource.envelope,pace:0},sustain:{hold:.65,steps:1}});
   if(echo){echo.ensembleRole='tail';echo.sourceRoleGain=sourceGain;echo.sourceScoreBeat=echoSource.beat;}
  }
 }
 // Bass timing/gates come from the same corpus, with root/fifth choices tied
 // to this harmonic field. Its half-level wave leaves headroom for the lead.
 const bassSeed=chipHash(identity,development.sourceBar+401);
 for(let i=0,beat=0;i<3&&beat<3.8;i++){
  const gap=statistic('bass.inter_onset_beats',bassSeed,i+1,1.5,n=>n>=.75&&n<=2.5);
  const duration=statistic('bass.duration_beats',bassSeed,i+9,1,n=>n>=.35&&n<=2);
  const articulation=statistic('bass.gate',bassSeed,i+17,.8,n=>n>=.5&&n<=1);
  const bass=tone(degree)+(i===1&&energy>.4?7:0);
  if(roll(identity,development.sourceBar*11+i+40101)<tradingActivity*(.45+.35*pace+.2*volume))add(beat,bass,Math.min(duration,gap*articulation),.025*(.75+.25*energy),'bass',401+i);
  beat+=gap/mapping.rhythm.rate;
 }
 // Envion's density/overlap logic becomes short legal noise grains on
 // the second chip. Candidate times are local, stable bar addresses. Market
 // data alters eligibility, duration and overlap, never the whole clock grid.
 const spacing=.23+.13*roll(identity,71),phase=roll(identity,bar+706)*spacing;
 if(textureGain>0)for(let step=0;step*spacing+phase<4;step++){
  const beat=step*spacing+phase,address=bar*32+step;
  const cloud=chipEnsembleArrangement(seed,start+beat,signal);
  if(roll(identity,address+601)>=cloud.grainDensity)continue;
  const duration=Math.min(cloud.grainDurationBeats*(.7+.3*cloud.grainOverlap),spacing*2);
  events.push({kind:'texture',drum:'texture',beat,duration,
   gain:.018*textureGain*(.35+.65*cloud.textureWeight)*signal.fresh,seed:chipHash(identity,address+601),
   expression:{...expression('texture',address+601),noiseWidth:cloud.interference>.3?7:motion>.65?7:15,noiseDivider:chipHash(identity,address+607)%8,envelope:{initial:3+Math.round(3*cloud.textureWeight),direction:-1,pace:1}}});
 }
 const drums=composeGameBoyDrumBar(seed,bar,{...context,signal},development);
 const melody=events.filter(event=>event.kind==='lead'&&chipEnsembleArrangement(seed,start+event.beat,signal).roleGains.lead>0);
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
  // A response run may cross its middle bar line. Its last pre-line note
  // still gets a complete gate; shared rests and the next channel owner
  // remain the actual release limits.
  event.duration=Math.min(event.duration,['arp','echo'].includes(event.kind)?Infinity:4-event.beat,arrangement.restInBeats);
  const role=event.ensembleRole??(event.kind.startsWith('chord')?'chord':event.kind==='echo'?'arp':event.kind);
  event.gain*=role==='tail'?event.sourceRoleGain:(arrangement.roleGains[role]??arrangement.phraseGain);
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
