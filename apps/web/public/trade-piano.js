import {createCompositionTimeline,scoreTempo} from './chip-timeline.js?v=471';
import {composeChipBar,marketChipSignal,chipSignalActive,chipHash} from './market-chip-score.js?v=480';
import {createGameBoyRack} from './gb-chip-rack.js?v=480';
import {chipEnsembleArrangement} from './chip-ensemble-arrangement.js?v=471';
import {marketActivityDecay} from './market-performance.js?v=472';
import {marketMusicalMapping} from './market-musical-mapping.js?v=472';

const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
// Compatibility name for stored mixer settings. The chip has calibrated output
// already; the previous sixfold sampled-instrument boost must never reach it.
export const EARTHBOUND_OUTPUT_GAIN=.72;
export async function preloadPianoSamples(){return [];}
export function marketResonance(cap){return Number(cap)>0?unit((Math.log10(Number(cap))-4)/4):0;}

// The public transport API stays stable. Every voice is produced by one
// pair of persistent APUs; the score, browser and visual renderer never synthesize audio.
export async function createTradePiano(ctx,destination,{onVoice=()=>{},onArpeggio=()=>{},onScoreEvent=()=>{},initialSeed=1917}={}){
 const master=ctx.createGain();master.gain.value=0;master.connect(destination);
 let chip;
 try{chip=await createGameBoyRack(ctx,master,{model:'dmg'});}catch(error){master.disconnect();throw error;}
 let seed=initialSeed>>>0,enabled=true,running=false,closed=false,held=false,volume=.5,lab={};
 let liveBeat=0,liveAt=ctx.currentTime,tempo=100,liveUntil=-Infinity,lastPrice=null,currentCap=null;
 let pending={music:{},signal:marketChipSignal(),active:false},timeline=null,segments=[],anchor=null,resume=true;
 let revision=0,lastPlan=null,lastVoiceKey=null,sourceFingerprint=null,lastPacketAt=-Infinity;
 let inputUpdatedAt=-Infinity,marketAudible=false;
 const observedEvents=new Set();
 const plans=new Map(),scheduled=new Map(),voices=new Set();
 const lookAhead=.12;
 const gain=()=>master.gain.setTargetAtTime(enabled&&running&&!held&&marketAudible?volume*EARTHBOUND_OUTPUT_GAIN:0,ctx.currentTime,.025);
 function audible(value){if(marketAudible!==value){marketAudible=value;gain();}}
 function currentSignal(context,replaying=false){
  const signal=marketChipSignal(context||{});
  if(replaying)return signal;
  // Match the visual's release when the input loop itself stops delivering
  // frames. The score timer cannot keep a cached observation fresh forever.
  const decay=marketActivityDecay(ctx.currentTime-inputUpdatedAt);
  const tradingActivity=(signal.tradingActivity??Number(chipSignalActive(signal)))*decay;
  return {...signal,tradingActivity,excitation:signal.fresh*tradingActivity,
   fingerprint:decay===1?signal.fingerprint:chipHash(signal.fingerprint,Math.round(decay*10000))};
 }
 function position(){if(!running||held)return liveBeat;return liveBeat+(ctx.currentTime-liveAt)*tempo/60;}
 function captureBeat(){liveBeat=position();liveAt=ctx.currentTime;}
 function scoreNow(){return anchor?anchor.at+(ctx.currentTime-anchor.clock)*1000*anchor.rate:null;}
 function cancelAfter(at){
  chip.cancelAfter(at);
  for(const [id,row] of scheduled)if(row.time>=at){row.voice.fading=true;row.voice.cancelled=true;scheduled.delete(id);}
  for(const voice of voices)if(voice.start>=at){voice.fading=true;voice.cancelled=true;voices.delete(voice);}
 }
 function clear(){chip.clear();for(const voice of voices){voice.fading=true;voice.cancelled=true;}voices.clear();scheduled.clear();plans.clear();resume=true;lastVoiceKey=null;}
 function silenceMarket(){
  // End held chip ownership when evidence becomes inactive. Merely muting
  // the bus would let an old sustain reappear when a later candle opens it.
  if(marketAudible)clear();
  audible(false);resume=false;
 }
 function invalidate(){cancelAfter(ctx.currentTime+.015);plans.clear();revision++;resume=false;}
 function updateContext(context,{observation=false}={}){
  inputUpdatedAt=ctx.currentTime;
  const signal=marketChipSignal(context),changed=sourceFingerprint!==signal.fingerprint,initial=sourceFingerprint===null;
  if(changed)sourceFingerprint=signal.fingerprint;
  const active=chipSignalActive(signal)&&context.active!==false;
  if(active&&(observation||initial))liveUntil=ctx.currentTime+30;
  pending={...context,signal,active:active&&ctx.currentTime<liveUntil};
  if(pending.active)audible(true);else silenceMarket();
  if(changed){captureBeat();tempo=scoreTempo({tempo:signal.source==='lab'?context.music?.tempo:marketMusicalMapping(signal).tempo.bpm});invalidate();}
  // Stale/missing data cannot renew the excitation window just by rendering.
  if(!active){cancelAfter(ctx.currentTime+.005);pending.active=false;}
  return active;
 }
 function arrangement(){
  const at=scoreNow(),beat=timeline&&at!==null?timeline.beatAt(at):position();
  const context=timeline&&at!==null?timeline.contextAtBeat(beat):pending;
  const inRange=timeline&&at!==null?!!context&&at>=context.start&&at<context.end:ctx.currentTime<liveUntil;
  const signal=currentSignal(context,!!(timeline&&at!==null)),active=!!(!closed&&running&&enabled&&!held&&ctx.state==='running'&&inRange&&context?.active!==false&&chipSignalActive(signal));
  const phrase=chipEnsembleArrangement(seed,beat,signal),audibleTempo=context?.audibleTempo||tempo;
  return {...phrase,beat,bar:Math.floor(beat/4),active:active&&!phrase.rest,audibleTempo,rest:!active||phrase.rest,secondsUntilRest:phrase.restInBeats*60/audibleTempo,secondsUntilRestEnd:(phrase.restEndBeat-beat)*60/audibleTempo,signal};
 }
 function schedulerTick(){
  if(closed||!running||!enabled||held||ctx.state!=='running')return;
  const now=ctx.currentTime,at=scoreNow(),replaying=!!(timeline&&at!==null),beat=replaying?timeline.beatAt(at):position();
  const context=replaying?timeline.contextAtBeat(beat):pending;
  const signal=currentSignal(context,replaying),validRange=replaying?context&&at>=context.start&&at<context.end:now<liveUntil;
  if(!validRange||context?.active===false||!chipSignalActive(signal)){silenceMarket();cancelAfter(now+.005);return;}
  audible(true);
  const currentBar=Math.floor(beat/4),rate=anchor?.rate||1;
  const atBeat=b=>replaying?now+(timeline.atBeat(b)-at)/1000/rate:now+(b-beat)*60/tempo;
  const lastBeat=replaying?timeline.beatAt(at+lookAhead*1000*rate):beat+lookAhead*tempo/60;
  for(let bar=resume?Math.max(0,currentBar-2):currentBar;bar<=Math.min(currentBar+8,Math.floor(lastBeat/4));bar++){
   const raw=replaying?timeline.contextAtBeat(Math.max(beat,bar*4)):pending;
   if(!raw)continue;
   const barSignal=currentSignal(raw,replaying),key=revision+':'+barSignal.fingerprint;
   let cached=plans.get(bar);
   if(!cached||cached.key!==key){
    if(cached)cancelAfter(now+.015);
    const plan=composeChipBar(seed,bar,{...raw,...lab,signal:barSignal});
    cached={key,plan};plans.set(bar,cached);
   }
   const plan=cached.plan;lastPlan=plan;
   for(let index=0;index<plan.events.length;index++){
    const event=plan.events[index],id=[bar,event.kind,event.drum||'',event.seed].join(':');
    const begin=atBeat(bar*4+event.beat),intendedEnd=atBeat(bar*4+event.beat+event.duration);
    if(scheduled.has(id)||begin>=now+lookAhead||intendedEnd<=now+.006||(!replaying&&begin>=liveUntil))continue;
    const elapsed=Math.max(0,now-begin);
    if(elapsed>.025&&(!resume||event.kind==='drum'||event.kind==='texture'))continue;
    const eventContext=replaying?timeline.contextAtBeat(bar*4+event.beat):raw;
    if(replaying){const eventAt=timeline.atBeat(bar*4+event.beat);if(!eventContext||eventAt<eventContext.start||eventAt>=eventContext.end||eventContext.active===false)continue;}
    // A candle boundary updates the controls; it is not a note-off. At fast
    // replay rates a one-second candle is only 10 ms long. Let its accepted
    // gesture finish across subsequent active candles, stopping at the first
    // known silent segment even when it is shorter than our scheduling tick.
    const releaseAt=replaying?timeline.activeUntil(timeline.atBeat(bar*4+event.beat),timeline.atBeat(bar*4+event.beat+event.duration),row=>row.active!==false&&chipSignalActive(marketChipSignal(row))):null;
    const start=Math.max(now+.006,begin),end=Math.min(intendedEnd,replaying?now+(releaseAt-at)/1000/rate:liveUntil);
    if(end-start<.006)continue;
    const amplitude=event.gain;
    const spec={...event,time:start,duration:end-start,gain:amplitude};
    const sounded=chip.schedule(spec,start);
    if(!sounded)continue;
    voices.add(sounded.voice);scheduled.set(id,{time:sounded.time,voice:sounded.voice});
    onScoreEvent({id,time:sounded.time,beat:bar*4+event.beat,midi:sounded.midi,kind:event.kind,drum:event.drum,adsr:Object.hasOwn(lab,'chipEnvelope')?null:event.expression?.adsr,gain:amplitude,duration:sounded.voice.end-sounded.time,direction:barSignal.direction,development:plan.development,isCancelled:()=>sounded.voice.cancelled,getEnd:()=>sounded.voice.end});
    if(event.kind==='arp')onArpeggio({midi:sounded.midi,step:bar*4+event.beat,time:sounded.time,tempo:raw.audibleTempo||tempo,instrument:'GB transmission'});
   }
   const voiceKey=bar+':'+key;
   if(bar===currentBar&&voiceKey!==lastVoiceKey){lastVoiceKey=voiceKey;onVoice({audible:plan.events.length>0,time:now,id:voiceKey,notes:plan.harmony.notes,instrument:'GB transmission',harmony:plan.harmony,resonance:marketResonance(raw.cap),reason:'market packets',at:at??Date.now()});}
  }
  resume=false;
  for(const voice of voices)if(voice.end<=now||voice.fading)voices.delete(voice);
  for(const [id,row] of scheduled)if(row.voice.end<now-2)scheduled.delete(id);
  for(const bar of plans.keys())if(bar<currentBar-1||bar>currentBar+8)plans.delete(bar);
 }
 const timer=setInterval(schedulerTick,25);
 function observation(event,cap,music={}){
  if(closed||!running||!enabled||held)return false;
  const price=Number(event.priceUsd??event.price),reference=Number(event.referencePrice??lastPrice);
  if(!(price>0)||!Number.isFinite(price))return false;
  // A repeated price poll is not another packet. Repeated-price swaps are
  // different: their unique event IDs still represent real trader activity.
  if(event.kind==='price-observation'&&reference>0&&Math.abs(price/reference-1)<=1e-9)return false;
  if(event.historical&&!(Number(event.volume)>0))return false;
  const identity=event.id==null?null:String(event.id);
  if(identity&&observedEvents.has(identity))return false;
  if(identity){observedEvents.add(identity);if(observedEvents.size>512)observedEvents.delete(observedEvents.values().next().value);}
  lastPrice=price;currentCap=cap;
  const source=event.metrics?.source||(event.kind==='price-observation'?'snapshots':event.kind==='swap'?'trades':event.source||'snapshots');
  const metrics={...(event.metrics||{}),price,referencePrice:reference,observed:true,source};
  if(event.metrics==null){metrics.activity=music.activity??pending.signal.activity;metrics.volume=pending.signal.volume;metrics.fresh=1;}
  const active=updateContext({music,metrics,cap,active:true},{observation:true});
  // Direct trade/price arrivals have their own audible packet. A rate budget
  // folds dense batches into the ongoing field instead of replaying a backlog.
  // No synthetic clock or changed DOM frame can manufacture these attacks.
  const phrase=chipEnsembleArrangement(seed,position(),pending.signal);
  if(active&&!anchor&&!phrase.rest&&phrase.restInBeats>.12&&ctx.currentTime-lastPacketAt>=.4&&(lab.dataGain??1)>0){
   const s=pending.signal,stamp=chipHash(seed,s.fingerprint),time=ctx.currentTime+.008;
   const gainValue=.009*(.3+.7*Math.max(s.volume,s.activity,s.motion))*s.fresh*(lab.dataGain??1)*phrase.roleGains.texture;
   const duration=Math.min(.02+.045*s.volume,phrase.restInBeats*60/tempo);
   const sounded=chip.texture({drum:'texture',gain:gainValue,duration,expression:{noiseShift:Math.max(5,Math.round(10-3*Math.max(s.motion,s.volume))),noiseWidth:15,noiseDivider:stamp%8,pan:s.balance<.4?-1:s.balance>.6?1:0,envelope:{initial:5,direction:-1,pace:1}}},time);
   if(sounded){lastPacketAt=ctx.currentTime;voices.add(sounded.voice);onScoreEvent({id:'observation:'+String(identity??stamp),time:sounded.time,midi:sounded.midi,kind:'texture',gain:gainValue,duration,direction:s.direction,isCancelled:()=>sounded.voice.cancelled,getEnd:()=>sounded.voice.end});}
  }
  return active;
 }
 return {
  configure(options={}){
   const previous=JSON.stringify(lab);lab={};
   const bounds={chipDuty:[0,3],chipEnvelope:[0,7],chipNoiseShift:[0,13],chipNoiseWidth:[0,1],chipWave:[0,4],chipStereo:[0,1],chipResonance:[0,1],textureGain:[0,1],dataGain:[0,1],drumDensity:[0,1],drumDeviation:[0,1],drumVariation:[0,65535],drumPerformance:[0,65535],drumGain:[0,1],phraseDepth:[0,1],phraseLength:[4,16],phraseGate:[.2,1],phraseVariation:[0,65535],noteGain:[0,2],chordGain:[0,2],arpGain:[0,2]};
   for(const [key,[min,max]] of Object.entries(bounds))if(Number.isFinite(options[key]))lab[key]=Math.max(min,Math.min(max,options[key]));
   if(options.drums===false)lab.drums=false;if(options.arpeggios===false)lab.arpeggios=false;
   chip.configure(lab);if(previous!==JSON.stringify(lab))invalidate();
  },
  instruments(){return [{preset:0,name:'GB transmission · two chips'}];},arrangement,
  setMaster(value){volume=unit(value);gain();},
  setRunning(value){captureBeat();running=!!value;held=!value;liveAt=ctx.currentTime;gain();if(!running)clear();},
  setEnabled(value){enabled=!!value;gain();if(!enabled)clear();},
  reset(value=seed){clear();audible(false);inputUpdatedAt=-Infinity;seed=Number(value)>>>0;timeline=null;segments=[];anchor=null;liveBeat=0;liveAt=ctx.currentTime;lastPrice=null;liveUntil=-Infinity;lastPacketAt=-Infinity;observedEvents.clear();sourceFingerprint=null;pending={music:{},signal:marketChipSignal(),active:false};revision++;},
  setArpeggioPattern(){},
  setTempo(value){captureBeat();tempo=scoreTempo({tempo:value});pending.music={...pending.music,tempo};},
  resonance(cap){currentCap=cap;return marketResonance(cap);},
  snapshot(){const state=chip.snapshot(),performance=arrangement();return {name:'GB transmission',family:'Two Game Boy APUs',error:state.error||'',loading:false,marketPhrase:'Learned motifs / market circuits',phraseSource:'Aggregate MIDI phrasing + observed data',development:lastPlan?.development??null,drums:{...lastPlan?.drums,enabled:lab.drums!==false,gain:lab.drumGain??1},preset:0,fallback:false,voices:state.voices??voices.size,phrase:running&&!held&&marketAudible,tempo:performance.audibleTempo,bass:'CH3 · 4-bit wave',roomSend:0,wetReturn:0,spaceEffect:'scored chip echoes, wave resonance and hardware envelopes',chip:state,signal:performance.signal,musicalMapping:marketMusicalMapping(performance.signal)};},
  setTimeline(value){clear();segments=value||[];timeline=createCompositionTimeline(segments,anchor?.rate||1);},
  seekTimeline(at,rate=1){held=false;clear();rate=Math.max(.1,Number(rate)||1);timeline=createCompositionTimeline(segments,rate);anchor={at,clock:ctx.currentTime,rate};gain();},
  syncTimeline(at,rate=1){if(!anchor||rate!==anchor.rate||Math.abs(scoreNow()-at)>200*Math.max(1,rate))this.seekTimeline(at,rate);},
  clearTimeline(){clear();timeline=null;segments=[];anchor=null;liveAt=ctx.currentTime;},
  trade:observation,
  observePrice:observation,
  replay(event,selection,cap,music){return observation(event,cap,music);},
  frame(m,{playing=false,seeking=false,ended=false,price,referencePrice}={}){
   if(closed)return false;
   const nextHeld=seeking||ended||!playing;if(nextHeld!==held){captureBeat();held=nextHeld;liveAt=ctx.currentTime;gain();if(held)clear();}
   if(held||!enabled||!running||ctx.state!=='running')return false;
   if(m.replay)return false;
   // Returning to live must release the historical cursor and chip ownership.
   if(anchor){clear();anchor=null;timeline=null;liveAt=ctx.currentTime;}
   const value=price??m.price,priceChanged=Number(value)>0&&Number(value)!==pending.signal.price;
   const reference=referencePrice??m.referencePrice??(priceChanged&&pending.signal.price>0?pending.signal.price:null);
   const metrics={...m,price:value,referencePrice:reference,delta:m.delta??(!priceChanged?pending.signal.delta:undefined),observed:m.observed??(Number(value)>0)};
   currentCap=m.context?.latestCap;
   const activityObserved=Number(m.activityObservedAt)>Number(pending.metrics?.activityObservedAt||0);
   return updateContext({music:m.music||{},metrics,cap:currentCap,active:true},{observation:priceChanged||activityObserved});
  },
  close(){closed=true;clearInterval(timer);clear();chip.close();master.disconnect();},
 };
}
