// Original asynchronous market packets for the four-channel UPIC APU.
// Stochastic gate inspiration: Tero Parviainen's Stochastic Drum Machine,
// https://codepen.io/teropa/pen/PKoYXM. No samples or reference code are used.
// A coin chooses a circuit of independent prime periods; observed market data
// excites it. There are no kick anchors, backbeats, fills, or clock-based RNG.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const number=(value,fallback=0)=>finite(value)?Number(value):fallback;
const unit=(value,fallback=0)=>clamp(number(value,fallback),0,1);
const hash=(seed,index)=>{
 let value=(seed^Math.imul(index+1,2654435761))>>>0;
 value=Math.imul(value^(value>>>16),2246822507);
 return (value^(value>>>13))>>>0;
};
const roll=(seed,index)=>hash(seed,index)/4294967296;
const voices=['kick','snare','hat','tom'];
const primes=[11,13,17,19,23,29,31,37,41,43,47];
const denominators=[24,40,56];
const lane=drum=>drum==='snare'||drum==='hat'?'noise':'tonal';
const priority={kick:4,snare:3,tom:2,hat:1};
const variationValue=value=>clamp(Math.round(number(value)),0,65535);
const baseSeed=(seed,context)=>hash(Number(seed)>>>0,variationValue(context.drumVariation)+1907);

export function gameBoyDrumControls(context={}){
 const signal=context.signal||{};
 const activity=unit(signal.activity),intensity=unit(signal.intensity),motion=unit(signal.motion);
 const volume=unit(signal.volume),tradeRate=unit(number(signal.tradeRate)/8);
 const change=unit(Math.abs(number(signal.delta))/2);
 const energy=Math.max(activity,intensity,motion,volume,tradeRate,change);
 return {
  density:unit(context.drumDensity,activity*.36+volume*.31+motion*.2+intensity*.18+tradeRate*.18+change*.12),
  deviation:unit(context.drumDeviation,motion*.55+change*.25),
  activity,intensity,motion,volume,tradeRate,energy,
 };
}

export function gameBoyDrumsActive(context={}){
 const signal=context.signal;
 if(context.drums===false||context.active===false||!signal||signal.observed!==true||unit(signal.fresh)<=0)return false;
 // Manual density/deviation and descriptive intensity cannot create activity
 // from absent or zero data. Match the shared chip score's observation gate.
 return unit(signal.activity)>0||unit(signal.motion)>0||unit(signal.volume)>0||number(signal.tradeRate)>0||Math.abs(number(signal.delta))>1e-9;
}

function identity(seed,context){
 const circuit=baseSeed(seed,context),fingerprint=number(context.signal?.observationFingerprint??context.signal?.fingerprint)>>>0;
 const state=hash(circuit,fingerprint);
 return {circuit,state,fingerprint,patternId:state.toString(16).padStart(8,'0')};
}

// Absolute phase addresses keep independent circuits running across bar
// boundaries. Performance variation changes deviations without changing the
// circuit's prime periods or its underlying observed-data occupancy.
function packets(seed,start,end,context,performance){
 const id=identity(seed,context),controls=gameBoyDrumControls(context);
 const result={...id,...controls,packets:[]};
 if(!gameBoyDrumsActive(context)||controls.density<=0)return result;
 const signal=context.signal,variation=performance?variationValue(context.drumPerformance):0;
 const playbackSeed=variation===0?id.state:hash(id.state,variation+5209);
 const denominator=denominators[hash(id.circuit,7301)%denominators.length];
 const first=hash(id.circuit,7302)%primes.length;
 const stride=1+hash(id.circuit,7303)%(primes.length-1);
 for(let voice=0;voice<voices.length;voice++){
  const drum=voices[voice],period=primes[(first+voice*stride)%primes.length]/denominator;
  const phase=(.1+.8*roll(id.circuit,voice+7351))*period;
  const weight=.48+.42*roll(id.circuit,voice+7381);
  const firstStep=Math.max(0,Math.floor((start-phase)/period)-1);
  const lastStep=Math.ceil((end-phase)/period)+1;
  for(let step=firstStep;step<=lastStep;step++){
   const address=step*251+voice*47;
   const base=roll(id.state,address)<controls.density*weight;
   if(performance){
    const probability=base?1-controls.deviation*.35:controls.deviation*.2*controls.energy;
    if(roll(playbackSeed,address+7919)>=probability)continue;
   }else if(!base)continue;
   // Perturbation is bounded inside this lane's own cycle, not a sixteenth-
   // note swing. Its sign/magnitude comes from the observed market state.
   const offset=performance?(roll(playbackSeed,address+8111)-.5)*period*.4*controls.deviation:0;
   const at=step*period+phase+offset;
   // Volume controls packet multiplicity. This depends only on recorded
   // features, never whether a UI frame happened to be the first to see them.
   const count=1+Math.floor(controls.volume*3.99);
   const spacing=Math.min(period*.65/(count+1),.035+.05*controls.motion+.04*controls.volume);
   for(let burst=0;burst<count;burst++){
    const absolute=at+burst*spacing;
    if(absolute<start||absolute>=end)continue;
    const hitSeed=hash(playbackSeed,address+burst*1223+8731);
    result.packets.push({drum,absolute,period,seed:hitSeed,base,burst,cycle:step,voice});
   }
  }
 }
 return result;
}

// Audio Lab retains a compact sixteen-cell display. Cells are a visualization
// of the first eight beats of the asynchronous circuit, not a playback grid.
// Coincident display bins resolve to the stronger voice on each hardware lane.
export function gameBoyDrumPattern(seed,context={}){
 const plan=packets(seed,0,8,context,false);
 const cells=Object.fromEntries(voices.map(drum=>[drum,Array(16).fill(false)]));
 for(const event of plan.packets)cells[event.drum][Math.min(15,Math.floor(event.absolute*2))]=true;
 for(let index=0;index<16;index++){
  if(cells.kick[index])cells.tom[index]=false;
  if(cells.snare[index])cells.hat[index]=false;
 }
 return {patternId:plan.patternId,density:plan.density,cells,mode:'market-packets'};
}

export function composeGameBoyDrumBar(seed,bar,context={},development={}){
 const position=Math.max(0,Math.floor(number(bar))),start=position*4;
 const plan=packets(seed,start,start+4,context,true);
 const {patternId,density,deviation,activity,intensity,motion,volume,energy}=plan;
 const result={events:[],patternId,density,deviation,performance:variationValue(context.drumPerformance),mode:'market-packets',signalFingerprint:plan.fingerprint};
 if(!plan.packets.length)return result;
 const signal=context.signal,delta=number(signal.delta),direction=Math.sign(delta);
 const change=unit(Math.abs(delta)/2),balance=unit(signal.balance,.5),fresh=unit(signal.fresh);
 const support=unit(development.supportGain,1);
 const cutoffs=[4,context.cutoffBeat,development.cadenceBeat].filter(finite).map(Number);
 const cutoff=clamp(Math.min(...cutoffs),0,4),candidates=[];
 for(const packet of plan.packets){
  const beat=packet.absolute-start;
  if(beat>=cutoff)continue;
  const tonal=lane(packet.drum)==='tonal',fraction=roll(packet.seed,31);
  const duration=Math.min((tonal?.06:.025)+(.04+.12*volume)*(1-.55*motion),packet.period*.58,cutoff-beat);
  const gain=(.026+.067*energy+.022*intensity)*(packet.burst===0?1:.72)*support*fresh;
  if(duration<.012||gain<=0)continue;
  const duty=(hash(plan.circuit,packet.voice+43)+Math.floor(balance*4)+(direction>0?1:0))&3;
  const pan=balance<.4?-1:balance>.6?1:0;
  const initial=clamp(Math.round((3+9*Math.max(volume,intensity,activity))*support*fresh*(packet.burst===0?1:.72)),1,12);
  const expression={
   duty,
   envelope:{initial,direction:motion>.78&&fraction>.5?1:-1,pace:clamp(Math.round(1+(1-motion)*4+fraction*2),1,7)},
   noiseShift:clamp(Math.round(9-7*motion-2*activity+2*roll(plan.circuit,packet.voice+59)),0,13),
   noiseWidth:motion>.25+.5*roll(plan.circuit,packet.voice+61)?7:15,
   noiseDivider:hash(packet.seed,67)&7,
   pan:packet.burst%2?-pan:pan,
   slide:direction*(1.5+change*16+motion*4),
  };
  const event={
   kind:'drum',drum:packet.drum,beat,duration,gain,seed:packet.seed,expression,
   drumLane:lane(packet.drum),drumStep:Math.floor((packet.absolute%8)*2),
   drumBase:packet.base,drumEmbellishment:packet.burst>0,
   drumPatternId:patternId,packetCycle:packet.cycle,packetPeriod:packet.period,
   signalFingerprint:plan.fingerprint,
  };
  if(tonal)event.midi=clamp((packet.drum==='kick'?34:48)+hash(plan.circuit,packet.voice+71)%29+Math.round(direction*change*9),28,96);
  candidates.push(event);
 }
 // These are hardware resource limits, not musical beat accents. Resolve
 // near-coincident packets and let the next packet replace its lane's tail.
 candidates.sort((a,b)=>a.beat-b.beat||priority[b.drum]-priority[a.drum]);
 const distinct=[];
 for(const event of candidates){
  const collision=distinct.findIndex(previous=>previous.drumLane===event.drumLane&&Math.abs(previous.beat-event.beat)<.012);
  if(collision<0)distinct.push(event);
  else if(event.gain>distinct[collision].gain)distinct[collision]=event;
 }
 if(distinct.length>24){
  distinct.sort((a,b)=>Number(a.drumEmbellishment)-Number(b.drumEmbellishment)||b.gain-a.gain||a.beat-b.beat);
  distinct.length=24;
 }
 distinct.sort((a,b)=>a.beat-b.beat||priority[b.drum]-priority[a.drum]);
 const previousByLane={};
 for(const event of distinct){
  const previous=previousByLane[event.drumLane];
  if(previous)previous.duration=Math.min(previous.duration,event.beat-previous.beat);
  previousByLane[event.drumLane]=event;
 }
 result.events=distinct.filter(event=>event.duration>=.012);
 return result;
}
