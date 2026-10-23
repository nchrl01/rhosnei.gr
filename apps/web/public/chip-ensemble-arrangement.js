import {phraseArrangement} from './phrase-arrangement.js?v=449';
import {phraseDevelopment} from './phrase-development.js?v=464';
import {MIDI_PHRASE_MODEL} from './midi-phrase-model.js?v=469';

// Arrangement only: the caller schedules every sound through its GB APUs.
// Local Envion references used as compositional mechanisms, without importing
// its samples, DSP, clocks or random state:
// - envion-market.js controls 26/35/737: activity shortens gesture spacing and
//   duration; 747: volume raises overlap; 822: motion raises modulation depth.
// - patches/envion/Envion_v5.2_Plugdata.pd, `enviongran`: round-robin grain
//   routes with interval = (graindur / 2) / overlap, each scanned through a
//   grain-env. `make-grain-env` includes raised-cosine and Gaussian windows.
// - envion-performance.js: material choices held at musical boundaries.
// - envion.js applyCurrent(): rests stop generation, letting envelopes finish.
// Here those ideas become score-beat windows and bounded register-grain
// proposals. The score must cap each accepted event at restInBeats; this pure
// planner cannot finish an envelope or create a rest by itself.

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const numeric=(value,fallback=0)=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):fallback;
const unit=value=>clamp(numeric(value),0,1);
const hash=(seed,index)=>{
 let value=((seed>>>0)^Math.imul((index|0)+1,2654435761))>>>0;
 value=Math.imul(value^(value>>>16),2246822507);
 return (value^(value>>>13))>>>0;
};
const cosine=value=>.5-.5*Math.cos(Math.PI*unit(value));
function windowAt(position,start,end,edge=.4){
 if(position<=start||position>=end)return 0;
 return cosine(Math.min((position-start)/edge,(end-position)/edge,1));
}
function corpusActivity(role,beat){
 const phase=((beat%32)+32)%32,quarter=Math.floor((phase%4)*4);
 const long=MIDI_PHRASE_MODEL.distributions[`${role}.phrase_32_activity:${Math.floor(phase)}`];
 const short=MIDI_PHRASE_MODEL.distributions[`${role}.quarter_beat_activity:${quarter}`];
 // Pooled occupancy shapes a modest phrase accent, never an imported rhythm
 // or permission to play without a fresh market observation.
 return Math.sqrt(unit(long?.active??1)*unit(short?.active??1));
}
const profiles={
 introduce:{lead:1,arp:.76,chord:.66,bass:.84,drone:.4,texture:.35,drum:.52},
 answer:{lead:.85,arp:.94,chord:.57,bass:.8,drone:.64,texture:.64,drum:.5},
 vary:{lead:.92,arp:.92,chord:.76,bass:.88,drone:.58,texture:.76,drum:.68},
 return:{lead:1,arp:.72,chord:.82,bass:.84,drone:.4,texture:.32,drum:.45},
};
const responseWindows={introduce:[4.75,7.8],answer:[.35,4.25],vary:[2.25,6.75],return:[4.5,6.75]};

// Keep related measurements on one axis: rate/activity describe pace, while
// return/motion describe movement. Adding every version of a price move would
// exaggerate it. Recency controls occupancy, and freshness remains a single
// gain factor applied by the score, not another invented activity source.
export function chipMarketExpression(signal={}){
 const activity=unit(signal.activity),volume=signal.volumeKnown===false?0:unit(signal.volume);
 const tradeRate=signal.tradeRateKnown===false?0:Math.max(0,numeric(signal.tradeRate));
 const motion=unit(Math.max(unit(signal.motion),Math.abs(numeric(signal.delta))/8));
 const pace=Math.max(activity,unit(Math.log1p(tradeRate)/Math.log(9)));
 const intensity=unit(signal.intensity),pressure=unit(signal.pressure);
 const legacyActivity=activity>0||volume>0||motion>0||tradeRate>0;
 const tradingActivity=unit(signal.tradingActivity??Number(legacyActivity));
 const active=!!signal.observed&&unit(signal.fresh)>0&&tradingActivity>0;
 return {activity,volume,tradeRate,motion,pace,intensity,pressure,tradingActivity,active,
  energy:unit(.45*pace+.3*volume+.25*motion),direction:Math.sign(numeric(signal.direction,numeric(signal.delta)))};
}

/**
 * Pure, seek-addressable orchestration over two GB sound chips.
 * roleGains include the shared phrase envelope and market eligibility, but
 * not freshness attenuation; apply signal.fresh once in the caller's score.
 * grainDensity / textureWeight are normalized proposals, not extra voices.
 * Grain duration and spacing use score beats, never a free-running clock.
 */
export function chipEnsembleArrangement(seed,scoreBeat,signal={}){
 const beat=Math.max(0,numeric(scoreBeat)),bar=Math.floor(beat/4);
 const base=phraseArrangement(seed,beat),development=phraseDevelopment(seed,bar);
 const phraseStart=base.phrase*32,pairBeat=beat%8,barBeat=beat%4;
 const {volume,motion,pace,intensity,tradingActivity,active}=chipMarketExpression(signal);

 // Extend the existing common breaths to the authored answer/return cadences.
 // Compute future windows as well as the current one so sustained chord/drone
 // events begun in earlier bars can end at the same known boundary.
 const breaths=[{start:base.restStartBeat,end:base.restEndBeat}];
 for(const within of [3,7]){
  const cadence=phraseDevelopment(seed,base.phrase*8+within).cadenceBeat;
  if(cadence!==null)breaths.push({start:phraseStart+within*4+cadence,end:phraseStart+(within+1)*4});
 }
 breaths.sort((a,b)=>a.start-b.start);
 const merged=[];
 for(const next of breaths){
  const previous=merged.at(-1);
  if(previous&&next.start<=previous.end)previous.end=Math.max(previous.end,next.end);
  else merged.push({...next});
 }
 const current=merged.find(row=>beat>=row.start&&beat<row.end);
 const next=current||merged.find(row=>row.start>beat)||{start:phraseStart+32,end:phraseStart+32};
 const rest=!!current,phraseGain=active&&!rest?base.phraseGain:0;

 // Phrase identity moves only with the score. Market updates alter expression
 // below; they cannot exchange lead and accompaniment in the middle of a tick.
 const displacement=((hash(seed,71)%5)-2)*.0625;
 const [responseStart,responseEnd]=responseWindows[development.stage];
 const response=windowAt(pairBeat,responseStart+displacement,responseEnd+displacement,.45);
 const leadFocus=1-response,arpFocus=response;
 // CH3's slower ground and short chip grains answer the chord's opening.
 // This gives chords an audible attack before the surrounding field thickens.
 const field=windowAt(barBeat,1.4,3.95,.55);
 const chordFocus=1-.65*field,droneFocus=.15+.85*field;
 const overlap=4*leadFocus*arpFocus;
 const profile=profiles[development.stage];
 const learned={lead:corpusActivity('lead',beat),bass:corpusActivity('bass',beat),drum:corpusActivity('drums',beat)};
 const interference=active&&!rest?overlap*tradingActivity*(.2+.8*motion):0;
 const roleGains={
  lead:profile.lead*leadFocus*(.82+.18*learned.lead)*(.6+.4*intensity),
  arp:profile.arp*arpFocus*(.82+.18*learned.lead)*(.3+.7*pace),
  chord:profile.chord*chordFocus*(.4+.35*volume+.25*(1-motion)),
  bass:profile.bass*(.88+.12*learned.bass)*(.55+.3*pace+.15*volume),
  drone:profile.drone*droneFocus*(.55+.45*(1-pace)),
  texture:profile.texture*(.25+.75*Math.max(response,field))*(.3+.7*motion)*(1-.25*interference),
  drum:profile.drum*(.72+.28*learned.drum)*(.45+.55*pace)*(1-.35*interference),
 };
 // Admissions become sparse as observed activity settles; the remaining
 // notes also recede instead of leaving an occasional full-level late hit.
 // This is activity recency, not a second application of data freshness.
 const presence=Math.sqrt(tradingActivity);
 for(const role of Object.keys(roleGains))roleGains[role]=unit(roleGains[role]*phraseGain*presence);

 // Envion's inverse duration / positive overlap relationship, constrained to
 // at most two chip-grain occupants. These are proposals for real channels;
 // saturation must drop/replace grains, never allocate an external synth.
 const excitation=unit(.45*pace+.35*volume+.2*motion);
 // Observed liquidity only colours the size of an already eligible grain.
 // Missing liquidity stays neutral and can never create an audible event.
 const liquidity=numeric(signal.liquidity,null);
 const space=liquidity!==null&&liquidity>=0?unit(Math.log10(1+liquidity)/7):.5;
 const grainDurationBeats=(.12+.5*(1-pace))*(.8+.4*space);
 const grainOverlap=.35+.65*volume;
 const grainSpacingBeats=grainDurationBeats/(1+grainOverlap);
 const textureWindow=.2+.8*Math.max(response,field);
 const grainDensity=active&&!rest?unit(tradingActivity*excitation*textureWindow*(.9+.2*space)):0;
 const textureWeight=active&&!rest?unit(Math.sqrt(pace)*.45+volume*.2+motion*.35)*textureWindow:0;
 return {
  beat,bar,phrase:base.phrase,phase:base.phase,stage:development.stage,development,
  active,rest,phraseGain,restStartBeat:next.start,restEndBeat:next.end,
  restInBeats:rest?0:Math.max(0,next.start-beat),
  roleGains,textureWeight,grainDensity,grainDurationBeats,grainSpacingBeats,grainOverlap,
  interference,
  windows:{lead:leadFocus,arp:arpFocus,chord:chordFocus,drone:droneFocus,texture:textureWindow},
 };
}
