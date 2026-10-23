import {composeMarketBar,createCompositionTimeline,scoreTempo} from './market-composition.js?v=465';
import {createGameBoyDrums} from './gameboy-drums.js?v=465';
import {gameBoyDrumsActive} from './gameboy-drum-pattern.js?v=465';
import {compositionContext} from './composition-context.js?v=464';
import {marketPhraseIdentity} from './market-phrase.js?v=453';
import {prepareLearnedPhrases,createMelodyOriginalityGuard} from './learned-market-phrase.js?v=455';
import {phraseArrangement} from './phrase-arrangement.js?v=449';
import {createGameBoyBuffer} from './gameboy-instruments.js?v=451';
// Seeded GB style melodic voices and a dedicated EarthBound Kraken bass.
import {createPianoPolicy} from './piano-policy.js?v=208';
import {EARTHBOUND_PRESETS,EARTHBOUND_INSTRUMENTS,earthboundPreset,instrumentProfile,instrumentPitch} from './earthbound-instruments.js?v=451';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
// Instrument assets are level-matched near 0.13 RMS before their short
// envelopes. Calibrate this shared engine so chord bodies survive the mix;
// keep the listening slider and instrument-specific dynamics independent.
export const EARTHBOUND_OUTPUT_GAIN=6;
let sampleManifest;
const sampleAssets=new Map();
async function loadSampleAsset(path,format){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{const response=await fetch('samples/'+path+'?v='+(path.startsWith('gameboy/')?451:209),{signal:controller.signal});if(!response.ok)throw Error('Cannot load instrument '+path);return await response[format]();}finally{clearTimeout(timeout);}
}
function instrumentManifest(){
 return sampleManifest??=Promise.all([loadSampleAsset('gameboy/manifest.json','json'),loadSampleAsset('earthbound/manifest.json','json')]).then(([chip,bass])=>[
  ...chip.files.map(item=>({...item,file:'gameboy/'+item.file})),
  ...bass.files.filter(item=>[145,146].includes(item.preset)).map(item=>({...item,file:'earthbound/'+item.file})),
 ]).catch(error=>{sampleManifest=null;throw error;});
}
export async function preloadPianoSamples(seed=1917,preset=earthboundPreset(seed)){
 const manifest=await instrumentManifest(),wanted=manifest.filter(item=>item.preset===preset||item.preset===145||item.preset===146);
 const results=await Promise.allSettled(wanted.map(async item=>{
  if(!sampleAssets.has(item.file))sampleAssets.set(item.file,loadSampleAsset(item.file,'arrayBuffer').catch(error=>{sampleAssets.delete(item.file);throw error;}));
  return {...item,bytes:await sampleAssets.get(item.file)};
 }));
 const samples=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
 if(!samples.some(s=>s.preset===preset))throw Error('Selected instrument samples unavailable');
 // Keep at most three banks worth of downloaded samples between coin changes.
 while(sampleAssets.size>26)sampleAssets.delete(sampleAssets.keys().next().value);
 return samples;
}
export function marketResonance(cap){
 const value=Number(cap);
 return value>0&&Number.isFinite(value)?unit((Math.log10(value)-4)/4):0;
}
export async function createTradePiano(ctx,destination,{onVoice=()=>{},onArpeggio=()=>{},onScoreEvent=()=>{},initialSeed=1917}={}){
 // The melody stays gated until its source-sequence index has been verified.
 // Load alongside samples; harmony and bass need not wait for this download.
 void prepareLearnedPhrases().catch(()=>{});
 const melodyGuard=createMelodyOriginalityGuard();
 const decodeSample=async item=>({...item,trim:Number(item.trim)||1,buffer:item.file.startsWith('gameboy/')?createGameBoyBuffer(ctx,item.bytes):await ctx.decodeAudioData(item.bytes.slice(0))});
 const downloaded=await preloadPianoSamples(initialSeed);
 // Generated chip cycles and mono Kraken samples are level-matched offline. Startup no longer scans every
 // decoded sample on the main thread while the Pd engine is already sounding.
 const decoded=await Promise.allSettled(downloaded.map(decodeSample));
 let samples=decoded.filter(result=>result.status==='fulfilled').map(result=>result.value);
 if(!samples.some(s=>s.preset===earthboundPreset(initialSeed)))throw Error('This browser could not decode the instrument samples');
 const instrumentFilter=ctx.createBiquadFilter(),instrumentSend=ctx.createGain(),roomInput=ctx.createBiquadFilter(),dry=ctx.createGain(),wet=ctx.createGain(),room=ctx.createConvolver(),tailGate=ctx.createGain(),master=ctx.createGain();
 // Dry GB-style voices carry their own sustain. Two quiet, discrete repeats
 // suggest distance without a diffuse reverb tail. This is GB-inspired DSP,
 // not a claim of four-channel hardware emulation.
 instrumentFilter.type='lowpass';instrumentFilter.frequency.value=7000;instrumentFilter.Q.value=.55;
 instrumentSend.gain.value=.25;
 roomInput.type='highpass';roomInput.frequency.value=75;roomInput.Q.value=.707;
 dry.gain.value=.7;wet.gain.value=.6;master.gain.value=0;
 const impulse=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*.31),ctx.sampleRate);
 impulse.getChannelData(0)[Math.round(ctx.sampleRate*.15)]=.65;
 impulse.getChannelData(1)[Math.round(ctx.sampleRate*.3)]=.3;
 room.normalize=false;
 room.buffer=impulse;instrumentFilter.connect(dry);instrumentFilter.connect(instrumentSend);instrumentSend.connect(roomInput);roomInput.connect(room);room.connect(wet);dry.connect(tailGate);wet.connect(tailGate);tailGate.connect(master);master.connect(destination);
 const bassFilter=ctx.createBiquadFilter(),bassGain=ctx.createGain();bassFilter.type='lowpass';bassFilter.frequency.value=900;bassGain.gain.value=.7;bassFilter.connect(bassGain);bassGain.connect(tailGate);
 // Chip percussion shares the score and output gate, with its own dry path.
 const drumBus=ctx.createGain();drumBus.connect(tailGate);
 const drums=createGameBoyDrums(ctx,drumBus);
 const reflections=[];
 let lastMarketCue=null;
 let enabled=true,running=false,volume=.5,seed=initialSeed>>>0,closed=false,pattern=[],roomDirty=false,roomTimer=null,reopenAt=0,lastResonance=-1;
 const policy=createPianoPolicy(seed);

 const voices=new Set();
 function chooseInstrument(value){
  const id=earthboundPreset(value);
  return samples.find(sample=>sample.preset===id)||samples.find(sample=>![145,146].includes(sample.preset))||samples[0];
 }
 let instrument=chooseInstrument(seed);
 let profile=instrumentProfile(instrument.preset),currentCap=null,desiredPreset=instrument.preset,bankLoading=false,bankEpoch=0,bankError='';
 async function selectBank(preset){
  if(preset===desiredPreset&&!bankError)return;
  desiredPreset=preset;bankLoading=true;bankError='';const token=++bankEpoch;
  clear();barCache.clear();
  try{
   const source=await preloadPianoSamples(seed,preset);
   const decoded=await Promise.all(source.map(decodeSample));
   if(closed||token!==bankEpoch)return;
   samples=decoded;instrument=samples.find(s=>s.preset===preset);profile={...instrumentProfile(preset),...Object.fromEntries(['attack','decay','sustain','release','phraseMax'].filter(key=>key in lab).map(key=>[key,lab[key]]))};lastResonance=-1;
  }catch(error){if(token===bankEpoch)bankError=error.message;}
  finally{if(token===bankEpoch)bankLoading=false;}
 }
 let lab={};
 let timeline=null,timelineSegments=[],replayAnchor=null,lastObservedPrice=null,liveBeat=0,liveAt=ctx.currentTime,liveTempo=100,pendingContext={music:{},cap:0,active:false},liveUntil=-Infinity;
 let scheduled=new Set(),barCache=new Map(),liveContexts=new Map(),resumeNotes=true,lastHarmonyBar=null,transportHeld=false;
 function labRoom(){for(const [key,param] of [['cutoff',instrumentFilter.frequency],['q',instrumentFilter.Q],['roomSend',instrumentSend.gain],['dry',dry.gain],['wet',wet.gain]])if(Number.isFinite(lab[key]))param.setTargetAtTime(lab[key],ctx.currentTime,.05);}
 function updateGain(){master.gain.setTargetAtTime(enabled&&running?volume*EARTHBOUND_OUTPUT_GAIN:0,ctx.currentTime,.025);}
 function hold(param,time){
  if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);
  else{const value=param.value;param.cancelScheduledValues(time);param.setValueAtTime(value,time);}
 }
 function stopVoice(voice,when=ctx.currentTime){
  const time=Math.max(ctx.currentTime,when);
  if(voice.fading&&voice.fadeAt<=time)return;voice.fading=true;voice.fadeAt=time;
  // A lookahead note has not sounded yet. Cancel it in silence; holding a
  // fresh GainNode's default value could otherwise create a full-level burst.
  if(voice.start>=time){
   if(voice.kind==='arp')melodyGuard.cancel(voice);
   voice.gain.gain.cancelScheduledValues(time);voice.gain.gain.setValueAtTime(0,time);
   try{voice.source.stop(time);}catch{}
   return;
  }
  hold(voice.gain.gain,time);voice.gain.gain.linearRampToValueAtTime(0,time+.035);
  try{voice.source.stop(time+.04);}catch{}
 }
 function clear(){
  scheduled.clear();resumeNotes=true;
  drums.clear();
  melodyGuard.cancelAfter(ctx.currentTime);
  for(const voice of voices)stopVoice(voice);
  if(!roomDirty||roomTimer!==null)return;
  clearTimeout(roomTimer);const time=ctx.currentTime;reopenAt=time+.075;
  hold(tailGate.gain,time);tailGate.gain.linearRampToValueAtTime(0,time+.035);
  // Keep the output gate shut until the room is actually cleared. A late
  // main-thread callback cannot reset a still-audible convolution buffer.
  roomTimer=setTimeout(()=>{roomTimer=null;if(closed)return;room.buffer=null;room.buffer=impulse;roomDirty=[...voices].some(voice=>!voice.fading);
   const now=ctx.currentTime;hold(tailGate.gain,now);tailGate.gain.linearRampToValueAtTime(1,now+.02);
  },55);
 }
 function note(midi,time,dynamics,duration=3.5,kind='note',attack=.018,elapsed=0,expression={},allowedPitches=[]){
  const intendedEnd=time+duration;
  time=Math.max(time,reopenAt,ctx.currentTime+.012);
  // A seek can delay the new attack while clearing the room. Preserve the
  // scored end rather than letting that delay extend a note into the rest.
  duration=Math.min(duration,intendedEnd-time);
  if(duration<.025)return null;
  const voiceProfile=kind==='bass'?instrumentProfile(145):profile;
  midi=instrumentPitch(midi,voiceProfile);
  // Chords retain their scored body; articulation belongs to each role.
  duration=Math.max(.025,duration);
  if(kind!=='chord'&&kind!=='bass')duration=Math.min(duration,lab.phraseMax??1.2);
  dynamics*=kind==='chord'?(lab.chordGain??1):kind==='arp'||kind==='interlock'?(lab.arpGain??1):(lab.noteGain??1);
  const preset=kind==='bass'?145+seed%2:instrument.preset;
  const velocity=preset===34?64:preset===35?104:kind==='chord'||dynamics<.05?64:104;
  const candidates=samples.filter(s=>s.preset===preset);
  if(!candidates.length||!(dynamics>0))return null;
  if(kind==='arp'){
   midi=melodyGuard.choose(midi,allowedPitches.map(n=>instrumentPitch(n,voiceProfile)));
   if(midi===null)return null;
  }
  const sample=candidates.reduce((a,b)=>Math.abs(a.midi-midi)*8+Math.abs((a.velocity??velocity)-velocity)<=Math.abs(b.midi-midi)*8+Math.abs((b.velocity??velocity)-velocity)?a:b);
  // Never remove a checked lead attack while later notes still depend on it.
  // Reclaim accompaniment first; reject an extra voice if only leads remain.
  const active=[...voices].filter(voice=>!voice.fading&&voice.end>time).sort((a,b)=>a.end-b.end);
  while(active.length>=18){const index=active.findIndex(voice=>voice.kind!=='arp');if(index<0)return null;stopVoice(active.splice(index,1)[0],time-.035);}
  const source=ctx.createBufferSource(),gain=ctx.createGain();gain.gain.value=0;source.buffer=sample.buffer;source.playbackRate.value=2**((midi-sample.midi+(sample.correction||0)/100)/12);
  const loopEnd=Math.min(sample.loopEnd,source.buffer.duration);
  source.loop=Boolean(sample.loop&&sample.loopStart>=0&&loopEnd>sample.loopStart);
  if(source.loop){source.loopStart=sample.loopStart;source.loopEnd=loopEnd;}
  else duration=Math.min(duration,source.buffer.duration/source.playbackRate.value);
  const end=time+duration,peak=dynamics*sample.trim,release=Math.min((kind==='chord'?.22:voiceProfile.release)*(expression.release??1),duration*.3);
  const onset=Math.min(Math.max(.003,Math.min(lab.attack??attack,voiceProfile.attack)*(expression.attack??1)),duration*.15);
  const decay=Math.min(voiceProfile.decay*(expression.decay??1),duration*.25),body=peak*voiceProfile.sustain*(expression.sustain??1);
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(elapsed>0?body:peak,time+onset);
  gain.gain.exponentialRampToValueAtTime(Math.max(.000001,body),time+onset+decay);
  gain.gain.setValueAtTime(body,end-release);gain.gain.linearRampToValueAtTime(0,end);
  source.connect(gain);gain.connect(kind==='bass'?bassFilter:instrumentFilter);const voice={source,gain,kind,start:time,end,fading:false};voices.add(voice);roomDirty=true;source.onended=()=>{source.disconnect();gain.disconnect();voices.delete(voice);};let offset=Math.max(0,elapsed)*source.playbackRate.value;
  if(source.loop&&offset>=source.loopEnd)offset=source.loopStart+(offset-source.loopStart)%(source.loopEnd-source.loopStart);
  if(!source.loop&&offset>=source.buffer.duration){source.disconnect();gain.disconnect();voices.delete(voice);return null;}
  source.start(time,offset);source.stop(end);
  if(kind==='arp')melodyGuard.remember(midi,time,voice);
  return {time,midi,voice};
 }
 // Stable score clock: no pattern restarts when a new chart frame arrives.
 function queueContext(selection,event,cap,music){
  pendingContext={music:{...music},cap,active:selection?.reason!=='quiet',harmonyStep:selection?.harmonyStep??pendingContext.harmonyStep??0};
  // Cached trades arrive in batches at least eight seconds apart. Keep a
  // bounded phrase window between those batches. Each real observation lets
  // the unified phrase complete, without restarting its shared beat clock.
  const phraseWindow=Math.min(24,Math.max(1.2,(lab.phraseLength??8)*60/scoreTempo(music)));
  const activityWindow=event?.source==='gecko'?Math.max(10,phraseWindow):phraseWindow;
  liveUntil=Math.max(liveUntil,ctx.currentTime+activityWindow);
  return true;
 }
 function scoreNow(){return replayAnchor?replayAnchor.at+(ctx.currentTime-replayAnchor.clock)*1000*replayAnchor.rate:null;}
 function livePosition(){const now=ctx.currentTime;liveBeat+=(now-liveAt)*liveTempo/60;liveAt=now;return liveBeat;}
 function arrangement(){
  const now=ctx.currentTime,position=scoreNow(),replaying=timeline&&position!==null;
  // Reading the arrangement must not advance or reset the scheduler clock.
  const beat=replaying?timeline.beatAt(position):liveBeat+(running&&!transportHeld?(now-liveAt)*liveTempo/60:0);
  const context=replaying?timeline.contextAtBeat(beat):pendingContext;
  const marketActive=replaying?!!context&&position>=context.start&&position<context.end&&context.active!==false:pendingContext.active&&now<liveUntil;
  const active=Boolean(!closed&&!bankLoading&&!bankError&&running&&enabled&&!transportHeld&&ctx.state==='running'&&marketActive);
  const state=phraseArrangement(seed,beat),audibleTempo=replaying?(context?.audibleTempo||liveTempo):liveTempo;
  const until=b=>replaying?Math.max(0,(timeline.atBeat(b)-position)/1000/replayAnchor.rate):Math.max(0,(b-beat)*60/audibleTempo);
  if(!active)return {...state,active:false,audibleTempo,phraseGain:1,rest:false,restInBeats:Infinity,secondsUntilRest:Infinity,secondsUntilRestEnd:Infinity,layers:{piano:1,envion:1,data:1}};
  return {...state,active,audibleTempo,secondsUntilRest:state.rest?0:until(state.restStartBeat),secondsUntilRestEnd:until(state.restEndBeat)};
 }
 const lookAhead=.25;
 const scheduler=setInterval(()=>{
  if(closed||bankLoading||bankError||!running||!enabled||transportHeld||ctx.state!=='running')return;
  const now=ctx.currentTime,position=scoreNow(),replaying=timeline&&position!==null;
  const beat=replaying?timeline.beatAt(position):livePosition();
  const activeContext=replaying?timeline.contextAtBeat(beat):pendingContext;
  const active=replaying?!!activeContext&&position>=activeContext.start&&position<activeContext.end&&activeContext.active!==false:pendingContext.active&&now<liveUntil;
  // Quiet periods stop new attacks; already sounding notes and room tails
  // finish their scored envelopes instead of being chopped at the gate.
  if(!active){drums.cancelAfter(now);if(!replaying)liveContexts.clear();resumeNotes=false;return;}
  // Smoothing and cached bars must not reopen the raw market activity gate.
  const drumsActive=gameBoyDrumsActive(activeContext);
  if(!drumsActive)drums.cancelAfter(now);
  const rate=replaying?replayAnchor.rate:1;
  const atBeat=b=>replaying?now+(timeline.atBeat(b)-position)/1000/rate:now+(b-beat)*60/liveTempo;
  const lastBeat=replaying?timeline.beatAt(position+lookAhead*1000*rate):beat+lookAhead*liveTempo/60;
  const currentBar=Math.floor(beat/4);
  if(!replaying&&lastHarmonyBar!==currentBar)liveTempo=scoreTempo(pendingContext.music);
  for(let bar=currentBar;bar<=Math.min(currentBar+24,Math.floor(lastBeat/4));bar++){
   let plan=barCache.get(bar);
   if(!plan){
    const rawContext=replaying?timeline.contextAtBeat(bar*4):{...pendingContext,music:{...pendingContext.music},active:pendingContext.active&&now<liveUntil};
    if(!rawContext)continue;
    if(!replaying)liveContexts.set(bar,rawContext);
    const previous=[];
    for(let offset=1;offset<=Math.min(3,bar);offset++)previous.push(replaying?timeline.contextAtBeat((bar-offset)*4):liveContexts.get(bar-offset));
    const context=compositionContext(rawContext,previous);
    if(!replaying&&bar===currentBar){liveTempo=scoreTempo(context.music);}
    plan=composeMarketBar(seed,bar,{...context,active:context.active!==false,pitchLow:Math.max(profile.low,60),pitchHigh:profile.high,arpeggios:lab.arpeggios,drums:lab.drums!==false&&gameBoyDrumsActive(rawContext),drumDensity:lab.drumDensity,drumDeviation:lab.drumDeviation,drumVariation:lab.drumVariation,phraseDepth:lab.phraseDepth,phraseLength:lab.phraseLength,phraseGate:lab.phraseGate,phraseShape:lab.phraseShape,phraseLearning:lab.phraseLearning,phraseVariation:lab.phraseVariation,landmarkBar:replaying&&context.music?.movement?.event?Math.ceil(timeline.beatAt(context.music.movement.event.at)/4):context.music?.movement?.event?.id!==lastMarketCue?bar:null},pattern);
    if(context.music?.movement?.event)lastMarketCue=context.music.movement.event.id;
    barCache.set(bar,plan);
   }
   for(let index=0;index<plan.events.length;index++){
    const e=plan.events[index],id=bar+':'+index;
    if(e.kind==='arp'&&lab.arpeggios===false)continue;
    if(e.kind==='drum'&&(!drumsActive||lab.drums===false||lab.drumGain===0||(replaying&&!gameBoyDrumsActive(timeline.contextAtBeat(bar*4+e.beat)))))continue;
    if(replaying&&timeline.contextAtBeat(bar*4+e.beat)?.active===false)continue;
    if(replaying&&e.kind==='drum'){
     const eventAt=timeline.atBeat(bar*4+e.beat),eventContext=timeline.contextAtBeat(bar*4+e.beat);
     // The timeline lookup retains its final row beyond the capture's end.
     // Do not turn that convenient lookup into new percussion after history.
     if(!eventContext||eventAt<eventContext.start||eventAt>=eventContext.end)continue;
    }
    const begin=atBeat(bar*4+e.beat),end=atBeat(bar*4+e.beat+e.duration);
    if(scheduled.has(id)||begin>=now+lookAhead||end<=now+.015||(!replaying&&begin>=liveUntil))continue;
    if(begin<now-.06&&!resumeNotes)continue;
    // Only sustain a note that spans the chosen timestamp. Do not re-fire
    // an earlier attack or walk through a backlog on a seek.
    const elapsed=Math.max(0,now-begin),start=Math.max(now+.012,begin);
    scheduled.add(id);
    // Percussion has no held state to reconstruct when seeking into a hit.
    if(e.kind==='drum'&&elapsed>.06)continue;
    const gain=e.gain*(e.kind==='drum'?(lab.drumGain??1):1);
    const drumStart=Math.max(start,reopenAt);
    const sounded=e.kind==='drum'?drums.hit({drum:e.drum,time:drumStart,duration:end-drumStart,gain:e.gain,seed:e.seed??seed}):note(e.midi,start,gain,end-start,e.kind,.012,elapsed,e.expression,e.allowedPitches);
    // Publish only accepted attacks at their actual AudioContext onset. A
    // sustained note reconstructed after a seek is not a new visual accent.
    if(sounded&&elapsed<.06)onScoreEvent({id,time:sounded.time,beat:bar*4+e.beat,midi:sounded.midi,kind:e.kind,drum:e.drum,gain,duration:sounded.voice.end-sounded.time,development:plan.development,isCancelled:()=>sounded.voice.fading});
    if(sounded&&e.kind==='arp')onArpeggio({midi:sounded.midi,step:bar*16+e.beat*4,time:sounded.time,tempo:replaying?timeline.contextAtBeat(bar*4).audibleTempo:liveTempo,instrument:instrument.name});
   }
   if(bar===currentBar&&lastHarmonyBar!==bar){
    lastHarmonyBar=bar;
    const context=replaying?timeline.contextAtBeat(bar*4):pendingContext;
    onVoice({audible:plan.events.length>0,time:now,id:'bar:'+bar,notes:plan.harmony.notes,instrument:instrument.name,harmony:plan.harmony,resonance:marketResonance(context.cap),reason:'score',at:position??Date.now()});
   }
  }
  resumeNotes=false;
  // Bounded memory on long sessions. The score itself can always reconstruct a bar.
  for(const key of barCache.keys())if(key<currentBar-2||key>currentBar+26)barCache.delete(key);
  for(const key of liveContexts.keys())if(key<currentBar-4||key>currentBar+26)liveContexts.delete(key);
  for(const key of scheduled)if(Number(key.split(':')[0])<currentBar-2)scheduled.delete(key);
 },25);
 return {
  // Optional audition controls. No overrides are installed by the main site.
  configure(options={}){
   const previousPhrase=JSON.stringify([lab.phraseDepth,lab.phraseLength,lab.phraseGate,lab.phraseShape,lab.phraseLearning,lab.phraseVariation,lab.arpeggios,lab.drums,lab.drumDensity,lab.drumDeviation,lab.drumVariation]);
   lab={};const bounds={drumDensity:[0,1],drumDeviation:[0,1],drumVariation:[0,65535],drumGain:[0,1],phraseDepth:[0,1],phraseLength:[4,16],phraseGate:[.2,1],phraseShape:[-1,22],phraseLearning:[0,1],phraseVariation:[0,65535],cutoff:[100,16000],q:[.1,5],roomSend:[0,1],dry:[0,1.5],wet:[0,2],attack:[.003,.3],decay:[.02,.6],sustain:[.01,.95],release:[.02,.5],phraseMax:[.15,3],noteGain:[0,2],chordGain:[0,2],arpGain:[0,2]};
   for(const [key,[min,max]] of Object.entries(bounds))if(Number.isFinite(options[key]))lab[key]=Math.max(min,Math.min(max,options[key]));
   if(options.arpeggios===false){lab.arpeggios=false;}
   if(options.drums===false){lab.drums=false;}
   drumBus.gain.setTargetAtTime(lab.drums===false?0:(lab.drumGain??1),ctx.currentTime,.008);
   const currentPhrase=JSON.stringify([lab.phraseDepth,lab.phraseLength,lab.phraseGate,lab.phraseShape,lab.phraseLearning,lab.phraseVariation,lab.arpeggios,lab.drums,lab.drumDensity,lab.drumDeviation,lab.drumVariation]);
   if(previousPhrase!==currentPhrase){
    const state=arrangement(),currentBar=Math.floor(state.beat/4),position=scoreNow();
    const boundary=ctx.currentTime+(timeline&&position!==null?(timeline.atBeat((currentBar+1)*4)-position)/1000/replayAnchor.rate:((currentBar+1)*4-state.beat)*60/liveTempo);
    // Finish the current bar; replace both its next-bar plan and any attacks
    // already queued by lookahead, including their screening history entries.
    for(const voice of voices)if(voice.start>=boundary)stopVoice(voice);
    drums.cancelAfter(boundary);
    melodyGuard.cancelAfter(boundary);
    for(const key of barCache.keys())if(key>currentBar)barCache.delete(key);
    for(const key of liveContexts.keys())if(key>currentBar)liveContexts.delete(key);
    for(const key of scheduled)if(Number(key.split(':')[0])>currentBar)scheduled.delete(key);
   }
   if(lab.arpeggios===false)for(const voice of voices)if(voice.kind==='arp')stopVoice(voice);
   if(lab.drums===false||lab.drumGain===0)drums.clear();
   const target=EARTHBOUND_PRESETS.includes(options.preset)&&![145,146].includes(options.preset)?options.preset:earthboundPreset(seed);
   void selectBank(target);
   profile={...instrumentProfile(instrument.preset),...Object.fromEntries(['attack','decay','sustain','release','phraseMax'].filter(key=>key in lab).map(key=>[key,lab[key]]))};
   lastResonance=-1;this.resonance(currentCap);
  },
  instruments(){return EARTHBOUND_INSTRUMENTS.filter(s=>![145,146].includes(s.preset));},
  arrangement,
  setMaster(value){volume=unit(value);updateGain();},
  setRunning(value){transportHeld=!value;if(!value&&running&&!replayAnchor)livePosition();running=Boolean(value);liveAt=ctx.currentTime;updateGain();if(!running)clear();else void prepareLearnedPhrases().catch(()=>{});},
  setEnabled(value){enabled=Boolean(value);updateGain();if(!enabled)clear();},
  reset(value=seed){clear();melodyGuard.reset();lastMarketCue=null;seed=Number(value)>>>0;void selectBank(earthboundPreset(seed));profile=instrumentProfile(instrument.preset);lastResonance=-1;this.resonance(currentCap);policy.reset(seed);timeline=null;timelineSegments=[];replayAnchor=null;lastObservedPrice=null;liveBeat=0;liveAt=ctx.currentTime;barCache.clear();liveContexts.clear();lastHarmonyBar=null;pendingContext={music:{},cap:0,active:false};liveUntil=-Infinity;},
  setArpeggioPattern(value){pattern=Array.isArray(value)?value.map(row=>[...row]):[];},
  setTempo(value){pendingContext.music={...pendingContext.music,tempo:scoreTempo({tempo:value})};},
  resonance(cap){currentCap=cap;const r=marketResonance(cap);if(Math.abs(r-lastResonance)>.0001){lastResonance=r;const clarity=unit((Math.log10(Math.max(1000,Number(cap)||1000))-4)/3);instrumentFilter.frequency.setTargetAtTime(profile.cutoff*(.7+.3*clarity),ctx.currentTime,.2);instrumentSend.gain.setTargetAtTime(.25,ctx.currentTime,.4);dry.gain.setTargetAtTime(.7,ctx.currentTime,.4);wet.gain.setTargetAtTime(.6,ctx.currentTime,.4);}labRoom();return r;},
  snapshot(){const plan=barCache.get(Math.floor(arrangement().beat/4));return {name:bankLoading?'Loading GB instruments…':bankError?'Instrument unavailable':instrument.name,error:bankError,loading:bankLoading,family:profile.family,marketPhrase:marketPhraseIdentity(seed,lab.phraseShape).name,phraseSource:(lab.phraseLearning??1)>0?'Learned MIDI phrasing':'Function contour',development:plan?.development??null,drums:{...plan?.drums,...drums.snapshot(),enabled:lab.drums!==false,gain:lab.drumGain??1},originality:melodyGuard.snapshot(),preset:instrument.preset,fallback:instrument.preset!==earthboundPreset(seed),voices:[...voices].filter(v=>!v.fading&&v.end>ctx.currentTime).length,phrase:running,tempo:liveTempo,bass:'Kraken Sine '+(1+seed%2),roomSend:instrumentSend.gain.value,wetReturn:wet.gain.value,spaceEffect:'short-chip-echo'};},
  setTimeline(segments){timelineSegments=segments;timeline=createCompositionTimeline(segments,replayAnchor?.rate||1);barCache.clear();scheduled.clear();lastHarmonyBar=null;},
  seekTimeline(at,rate=1){transportHeld=false;clear();barCache.clear();lastHarmonyBar=null;rate=Math.max(.1,Number(rate)||1);if(!replayAnchor||replayAnchor.rate!==rate)timeline=createCompositionTimeline(timelineSegments,rate);replayAnchor={at,clock:ctx.currentTime,rate};},
  syncTimeline(at,rate=1){if(!replayAnchor||rate!==replayAnchor.rate||Math.abs(scoreNow()-at)>250*Math.max(1,rate))this.seekTimeline(at,rate);},
  replay(event,selection,cap,music){if(!selection)return false;return queueContext(selection,event,cap,music);},
  observePrice(event,cap,music=event.music||{}){
   if(closed||!enabled||!running||ctx.state!=='running')return false;
   this.resonance(cap);this.setTempo(music.tempo);
   const price=Number(event.priceUsd??event.price),previous=Number(event.referencePrice??lastObservedPrice);
   if(price>0)lastObservedPrice=price;
   if(!(price>0&&previous>0)||Math.abs(price/previous-1)<1e-9)return false;
   const selection=policy.observe({...event,quietAt:ctx.currentTime*1000},music);
   return queueContext(selection||{reason:'activity'},event,cap,music);
  },
  trade(event,cap,music=event.music||{}){
   if(closed||!enabled||!running||ctx.state!=='running')return false;
   this.resonance(cap);
   this.setTempo(music.tempo);
   const price=Number(event.priceUsd??event.price);
   if(!(price>0)||!Number.isFinite(price)||(event.historical&&!(Number(event.volume)>0)))return false;
   const selection=policy.trade({...event,quietAt:ctx.currentTime*1000},music);
   return queueContext(selection||{reason:'activity'},event,cap,music);
  },
  frame(m,{playing=false,seeking=false,ended=false,at,price,known=false,quiet=false,referencePrice}={}){
   if(closed)return false;
   transportHeld=seeking||ended||!playing;
   if(seeking||ended||!playing){if(voices.size||drums.snapshot().voices||roomDirty)clear();return false;}
   if(!enabled||!running||ctx.state!=='running')return false;
   this.resonance(m.context?.latestCap);this.setTempo(m.music?.tempo);
   if(m.replay)return false;
   const active=ctx.currentTime<liveUntil;
   pendingContext={...pendingContext,music:{...m.music,activity:m.activity},cap:m.context?.latestCap,active};
   if(!gameBoyDrumsActive(pendingContext))drums.cancelAfter(ctx.currentTime);
   return false;
  },
  close(){closed=true;clearInterval(scheduler);clearTimeout(roomTimer);master.gain.setTargetAtTime(0,ctx.currentTime,.012);drums.close();for(const voice of voices)stopVoice(voice);setTimeout(()=>{for(const node of [instrumentFilter,instrumentSend,roomInput,dry,wet,room,tailGate,master,bassFilter,bassGain,drumBus,...reflections])node.disconnect();},50);},
 };
}
