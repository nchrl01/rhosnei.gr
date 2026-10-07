// Seeded EarthBound instruments following the existing piano composition engine.
import {createPianoPhrasing,pianoNuance} from './piano-phrasing.js?v=152';
import {pianoArticulation,interlockingPiano,interlockPitch} from './piano-interlock.js?v=146';
import {createPianoPolicy} from './piano-policy.js?v=61';
import {earthboundPreset,instrumentProfile,instrumentPitch} from './earthbound-instruments.js?v=147';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
let sampleDownload;
const sampleAssets=new Map();
async function loadSampleAsset(path,format){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch('samples/earthbound/'+path+'?v=147',{signal:controller.signal});
  if(!response.ok)throw Error('Cannot load instrument asset '+path);
  return await response[format]();
 }finally{clearTimeout(timeout);}
}
// Start downloading when a market is selected, before the audio gesture. A
// missing sample must not silence all the other, successfully loaded notes.
export function preloadPianoSamples(){
 if(!sampleDownload)sampleDownload=(async()=>{
  const manifest=await loadSampleAsset('manifest.json','json');
  const results=await Promise.allSettled(manifest.files.map(async item=>{
   if(!sampleAssets.has(item.file))sampleAssets.set(item.file,loadSampleAsset(item.file,'arrayBuffer').catch(error=>{sampleAssets.delete(item.file);throw error;}));
   return {...item,bytes:await sampleAssets.get(item.file)};
  }));
  const samples=results.filter(result=>result.status==='fulfilled').map(result=>result.value);
  if(!samples.length)throw Error('Piano samples unavailable');
  if(samples.length<manifest.files.length)sampleDownload=null;
  return samples;
 })().catch(error=>{sampleDownload=null;throw error;});
 return sampleDownload;
}
export function marketResonance(cap){
 const value=Number(cap);
 return value>0&&Number.isFinite(value)?unit((Math.log10(value)-4)/4):0;
}
export async function createTradePiano(ctx,destination,{onVoice=()=>{},onArpeggio=()=>{}}={}){
 const downloaded=await preloadPianoSamples();
 // Mono, short assets are normalized offline. Startup no longer scans every
 // decoded sample on the main thread while the Pd engine is already sounding.
 const decoded=await Promise.allSettled(downloaded.map(async item=>({...item,trim:Number(item.trim)||1,buffer:await ctx.decodeAudioData(item.bytes.slice(0))})));
 const samples=decoded.filter(result=>result.status==='fulfilled').map(result=>result.value);
 if(!samples.length)throw Error('This browser could not decode the EarthBound samples');
 const instrumentFilter=ctx.createBiquadFilter(),instrumentSend=ctx.createGain(),roomInput=ctx.createBiquadFilter(),dry=ctx.createGain(),wet=ctx.createGain(),room=ctx.createConvolver(),tailGate=ctx.createGain(),master=ctx.createGain();
 // Harmony notes and arpeggios share one instrument and its dry/room balance.
 // One fixed convolution is shared by all notes; seeking/pause clears its tail.
 instrumentFilter.type='lowpass';instrumentFilter.frequency.value=7000;instrumentFilter.Q.value=.55;
 instrumentSend.gain.value=.25;
 // Remove sub-bass only from the room; the direct instrument stays intact.
 roomInput.type='highpass';roomInput.frequency.value=75;roomInput.Q.value=.707;
 dry.gain.value=.34;wet.gain.value=1.45;master.gain.value=0;
 // Eight seconds at ordinary phone sample rates; cap unusually high
 // device rates at 3.84 MB for the two floating-point impulse channels.
 const impulse=ctx.createBuffer(2,Math.min(480000,Math.ceil(ctx.sampleRate*8)),ctx.sampleRate);
 let noise=1917;
 for(let channel=0;channel<2;channel++){
  const data=impulse.getChannelData(channel);let smooth=0,diffuse=0;
  for(let i=0;i<data.length;i++){
   noise=(Math.imul(noise,1664525)+1013904223)>>>0;
   smooth=.84*smooth+.16*(noise/2147483648-1);diffuse=.96*diffuse+.04*smooth;
   const t=i/ctx.sampleRate,bloom=Math.min(1,t/.18),fade=Math.min(1,(data.length-1-i)/(ctx.sampleRate*1.2));
   // A flatter late decay holds the note's harmonic body like a pad. The
   // complete response still ends within this one fixed eight-second buffer.
   // This bloom affects the room only, never the sampled hammer's attack.
   data[i]=(.65*smooth+.35*diffuse)*bloom*Math.exp(-t*.38)*fade;
  }
 }
 room.buffer=impulse;instrumentFilter.connect(dry);instrumentFilter.connect(instrumentSend);instrumentSend.connect(roomInput);roomInput.connect(room);room.connect(wet);dry.connect(tailGate);wet.connect(tailGate);tailGate.connect(master);master.connect(destination);
 let enabled=true,running=false,volume=.5,seed=1917,closed=false,arp=null,pattern=[],nextArp=0,lastArpBucket=null,roomDirty=false,roomTimer=null,reopenAt=0,lastResonance=-1;
 const policy=createPianoPolicy(seed);
 const phrasing=createPianoPhrasing(seed);
 const voices=new Set();
 function chooseInstrument(value){
  const id=earthboundPreset(value);
  return samples.find(sample=>sample.preset===id)||samples.find(sample=>sample.preset===1)||samples[0];
 }
 let instrument=chooseInstrument(seed);
 let profile=instrumentProfile(instrument.preset),currentCap=null;
 let interlock=null,lab={};
 function labRoom(){for(const [key,param] of [['cutoff',instrumentFilter.frequency],['q',instrumentFilter.Q],['roomSend',instrumentSend.gain],['dry',dry.gain],['wet',wet.gain]])if(Number.isFinite(lab[key]))param.setTargetAtTime(lab[key],ctx.currentTime,.05);}
 function updateGain(){master.gain.setTargetAtTime(enabled&&running?volume:0,ctx.currentTime,.025);}
 function hold(param,time){
  if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);
  else{const value=param.value;param.cancelScheduledValues(time);param.setValueAtTime(value,time);}
 }
 function stopVoice(voice,when=ctx.currentTime){
  const time=Math.max(ctx.currentTime,when);
  if(voice.fading&&voice.fadeAt<=time)return;voice.fading=true;voice.fadeAt=time;
  hold(voice.gain.gain,time);voice.gain.gain.linearRampToValueAtTime(0,time+.035);
  try{voice.source.stop(time+.04);}catch{}
 }
 function clear(){
  arp=null;interlock=null;for(const voice of voices)stopVoice(voice);
  if(!roomDirty||roomTimer!==null)return;
  clearTimeout(roomTimer);const time=ctx.currentTime;reopenAt=time+.075;
  hold(tailGate.gain,time);tailGate.gain.linearRampToValueAtTime(0,time+.035);
  // Keep the output gate shut until the room is actually cleared. A late
  // main-thread callback cannot reset a still-audible convolution buffer.
  roomTimer=setTimeout(()=>{roomTimer=null;if(closed)return;room.buffer=null;room.buffer=impulse;roomDirty=[...voices].some(voice=>!voice.fading);
   const now=ctx.currentTime;hold(tailGate.gain,now);tailGate.gain.linearRampToValueAtTime(1,now+.02);
  },55);
 }
 function note(midi,time,dynamics,duration=3.5,kind='note',attack=.018){
  time=Math.max(time,reopenAt,ctx.currentTime+.012);
  // Reserve voices at their audible onset, not when the lookahead schedules
  // them. Expired voices must not steal a note that has not sounded yet.
  const active=[...voices].filter(voice=>!voice.fading&&voice.end>time).sort((a,b)=>a.end-b.end);
  while(active.length>=8)stopVoice(active.shift(),time-.035);
  midi=instrumentPitch(midi,profile);
  // Use the arpeggiator's articulation for the harmonic layer as well, so
  // held sample loops do not build a second, competing pad around the phrase.
  duration=Math.min(duration*profile.gate,profile.phraseMax);
  dynamics*=kind==='chord'?(lab.chordGain??1):kind==='arp'||kind==='interlock'?(lab.arpGain??1):(lab.noteGain??1);
  const sample=instrument;
  const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=sample.buffer;source.playbackRate.value=2**((midi-sample.midi+(sample.correction||0)/100)/12);
  const loopEnd=Math.min(sample.loopEnd,source.buffer.duration);
  source.loop=Boolean(sample.loop&&sample.loopStart>=0&&loopEnd>sample.loopStart);
  if(source.loop){source.loopStart=sample.loopStart;source.loopEnd=loopEnd;}
  else duration=Math.min(duration,source.buffer.duration/source.playbackRate.value);
  const end=time+duration,peak=dynamics*sample.trim,release=Math.min(profile.release,duration*.3);
  const onset=Math.min(Math.max(.003,Math.min(lab.attack??attack,profile.attack)),duration*.15);
  const decay=Math.min(profile.decay,duration*.35),body=peak*profile.sustain;
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(peak,time+onset);
  gain.gain.exponentialRampToValueAtTime(Math.max(.000001,body),time+onset+decay);
  gain.gain.setValueAtTime(body,end-release);gain.gain.linearRampToValueAtTime(0,end);
  source.connect(gain);gain.connect(instrumentFilter);const voice={source,gain,kind,end,fading:false};voices.add(voice);roomDirty=true;source.onended=()=>{source.disconnect();gain.disconnect();voices.delete(voice);};source.start(time);source.stop(end);
  return time;
 }
 // Audio-clock lookahead keeps attacks independent of the drawing frame rate.
 // Finite triggered passages use a fixed pulse within each four-beat bar.
 const scheduler=setInterval(()=>{
  if(interlock&&!closed&&running&&enabled&&ctx.state==='running'){
   while(interlock.index<interlock.events.length){
    const event=interlock.events[interlock.index];
    if(event.tick>=interlock.boundary){
     const boundaryTime=interlock.start+interlock.boundary*interlock.step;
     if(boundaryTime>=ctx.currentTime+.12)break;
     if(interlock.activity<.025){interlock=null;break;}
     interlock.tempo=interlock.pendingTempo;interlock.step=30/interlock.tempo;
     interlock.start=boundaryTime-interlock.boundary*interlock.step;interlock.boundary+=8;
    }
    const time=interlock.start+event.tick*interlock.step;
    if(time>=ctx.currentTime+.12)break;
    interlock.index++;
    if(time<ctx.currentTime-.08)continue;
    const dynamics=Math.max(.25,Math.min(1,interlock.activity/interlock.initialActivity));
    const sounded=note(event.midi,time,event.gain*dynamics,event.duration,'interlock',profile.attack);
    onArpeggio({midi:instrumentPitch(event.midi,profile),step:event.tick,time:sounded,tempo:interlock.tempo,instrument:instrument.name});
   }
   if(interlock&&interlock.index>=interlock.events.length)interlock=null;
  }
  if(!arp||closed||!running||!enabled||ctx.state!=='running')return;
  while(arp.index<arp.notes.length&&arp.nextTime<ctx.currentTime+.12){
   const [step,pitch]=arp.notes[arp.index++],time=arp.nextTime;arp.nextTime+=arp.step;if(time<ctx.currentTime-.08)continue;
   const notes=arp.harmony;if(!notes?.length)break;
   const target=notes.reduce((sum,n)=>sum+n,0)/notes.length+9+(pitch-66)*.5;
   const candidates=notes.flatMap(n=>[n,n+12,n+24]).filter(n=>n>=48&&n<=81);
   const cost=n=>Math.abs(n-target)+(arp.previous===null?0:Math.abs(n-arp.previous)*.45);
   const midi=candidates.reduce((a,b)=>cost(a)<=cost(b)?a:b),nuance=pianoNuance(arp.seed,step);
   arp.previous=midi;
   const sounded=note(midi,time+nuance.delay,arp.gain*nuance.velocity,1.1*nuance.duration,'arp',nuance.attack);onArpeggio({midi:instrumentPitch(midi,profile),step,time:sounded,tempo:arp.tempo,instrument:instrument.name});
  }
  if(arp.index>=arp.notes.length)arp=null;
 },25);
 function play(selection,event,cap,music){
  const quiet=selection.reason==='quiet',phrase=phrasing.next(event,music,{quiet,changePct:selection.changePct});
  const {midi,harmony}=phrase,intensity=unit(music.intensity);
  const time=note(midi,ctx.currentTime+phrase.delay,.075*(quiet?.6:.6+.4*intensity)*phrase.velocity,(quiet?2.4:1.6)*phrase.duration,'note',phrase.attack);
  // Significant moves sound the current harmony on this coin's instrument.
  // Arpeggios decorate that chord; they do not replace its harmonic onset.
  const chordNotes=quiet?[]:[...new Set(harmony.notes)].slice(0,3);
  for(const pitch of chordNotes){
   if(pitch===midi)continue;
   note(pitch,time,.052*(.6+.4*intensity)*phrase.velocity,1.6*phrase.duration,'chord',phrase.attack);
  }
  const bucket=Number.isFinite(event.chordStep)?event.chordStep:Math.floor(selection.at/30000);
  const draw=(Math.imul((seed^bucket)>>>0,2654435761)>>>0)%4;
  if(!quiet&&arp){arp=null;} // A new harmony replaces the previous finite phrase.
  if(!quiet&&interlock){
   for(let i=interlock.index;i<interlock.events.length;i++){
    const event=interlock.events[i];event.midi=interlockPitch(event,harmony);
   }
   interlock.tonic=music.tonic;
  }
  if(lab.arpeggios!==false&&!quiet&&!interlock&&!(pattern.length&&draw===0&&time>=nextArp&&bucket!==lastArpBucket)){
   const events=interlockingPiano((seed^bucket)>>>0,cap,intensity,harmony);
   if(events.length){
    const tempo=Math.max(40,Math.min(140,Number(music.tempo)||40));
    arp=null;interlock={events,index:0,start:time+30/tempo,step:30/tempo,tempo,pendingTempo:tempo,boundary:8,activity:intensity,initialActivity:Math.max(.04,intensity),tonic:music.tonic};
   }
  }
  // The existing occasional AI phrase is allowed only after a significant move.
  // Quiet notes never start a phrase or a chord.
  if(lab.arpeggios!==false&&!quiet&&!interlock&&pattern.length&&intensity>.015&&!arp&&time>=nextArp&&bucket!==lastArpBucket&&draw===0){
   const tempo=Math.max(40,Math.min(140,Number(music.tempo)||40)),beat=60/tempo;
   const notes=pattern.filter((_,i)=>i%2===0||pattern.length<=8).slice(0,8).map(([,pitch],i)=>[i,pitch]);
   arp={notes,index:0,nextTime:time+beat,step:beat/2,tempo,gain:.075*(.6+.4*intensity),harmony:[...harmony.notes],tonic:music.tonic,seed:(seed^bucket)>>>0,previous:null};nextArp=time+beat*24;lastArpBucket=bucket;
  }
  onVoice({time,id:event.id,notes:[...new Set([midi,...chordNotes])].map(pitch=>instrumentPitch(pitch,profile)),instrument:instrument.name,harmony,resonance:marketResonance(cap),reason:selection.reason,changePct:selection.changePct,at:selection.at});
  return true;
 }
 return {
  // Optional audition controls. No overrides are installed by the main site.
  configure(options={}){
   lab={};const bounds={cutoff:[100,16000],q:[.1,5],roomSend:[0,1],dry:[0,1.5],wet:[0,2],attack:[.003,.3],decay:[.02,.6],sustain:[.01,.95],release:[.02,.5],phraseMax:[.15,3],noteGain:[0,2],chordGain:[0,2],arpGain:[0,2]};
   for(const [key,[min,max]] of Object.entries(bounds))if(Number.isFinite(options[key]))lab[key]=Math.max(min,Math.min(max,options[key]));
   if(options.arpeggios===false){lab.arpeggios=false;arp=null;interlock=null;}
   const selected=samples.find(sample=>sample.preset===options.preset)||chooseInstrument(seed);
   if(selected!==instrument){clear();instrument=selected;}
   profile={...instrumentProfile(instrument.preset),...Object.fromEntries(['attack','decay','sustain','release','phraseMax'].filter(key=>key in lab).map(key=>[key,lab[key]]))};
   lastResonance=-1;this.resonance(currentCap);
  },
  instruments(){return samples.map(({preset,name})=>({preset,name}));},
  setMaster(value){volume=unit(value);updateGain();},
  setRunning(value){running=Boolean(value);updateGain();if(!running)clear();},
  setEnabled(value){enabled=Boolean(value);updateGain();if(!enabled)clear();},
  reset(value=seed){clear();seed=Number(value)>>>0;instrument=chooseInstrument(seed);profile=instrumentProfile(instrument.preset);lastResonance=-1;this.resonance(currentCap);policy.reset(seed);phrasing.reset(seed);nextArp=0;lastArpBucket=null;},
  setArpeggioPattern(value){pattern=Array.isArray(value)?value.map(row=>[...row]):[];},
  setTempo(value){const tempo=Math.max(40,Math.min(140,Number(value)||40));if(arp){arp.tempo=tempo;arp.step=30/tempo;}if(interlock)interlock.pendingTempo=tempo;},
  resonance(cap){currentCap=cap;const r=marketResonance(cap),a=pianoArticulation(cap);if(Math.abs(r-lastResonance)>.0001){lastResonance=r;instrumentFilter.frequency.setTargetAtTime(profile.cutoff,ctx.currentTime,.08);instrumentSend.gain.setTargetAtTime(profile.room,ctx.currentTime,.08);dry.gain.setTargetAtTime(.34+.5*a,ctx.currentTime,.8);wet.gain.setTargetAtTime(1.45-1.15*a,ctx.currentTime,.8);}labRoom();return r;},
  snapshot(){return {name:instrument.name,family:profile.family,preset:instrument.preset,fallback:instrument.preset!==earthboundPreset(seed),voices:[...voices].filter(v=>!v.fading&&v.end>ctx.currentTime).length,phrase:Boolean(interlock||arp),tempo:interlock?.tempo??arp?.tempo??null,roomSend:profile.room,wetReturn:1.45-1.15*pianoArticulation(currentCap)};},
  replay(event,selection,cap,music){if(closed||!enabled||!running||ctx.state!=='running'||!selection)return false;this.resonance(cap);this.setTempo(music.tempo);return play(selection,event,cap,music);},
  trade(event,cap,music=event.music||{}){
   if(closed||!enabled||!running||ctx.state!=='running')return false;
   this.resonance(cap);
   this.setTempo(music.tempo);
   const selection=policy.trade({...event,quietAt:ctx.currentTime*1000},music);
   return selection?play(selection,event,cap,music):false;
  },
  frame(m,{playing=false,seeking=false,ended=false,at,price,known=false,quiet=false,referencePrice}={}){
   if(closed)return false;
   if(seeking||ended||!playing){if(arp||interlock||roomDirty)clear();return false;}
   if(!enabled||!running||ctx.state!=='running')return false;
   this.resonance(m.context?.latestCap);this.setTempo(m.music?.tempo);
   if(interlock)interlock.activity=unit(m.music?.intensity);
   if(arp&&Number.isFinite(m.music?.tonic)&&Number.isFinite(arp.tonic)&&m.music.tonic!==arp.tonic){
    const shift=m.music.tonic-arp.tonic;arp.harmony=arp.harmony.map(n=>n+shift);arp.tonic=m.music.tonic;
   }
   if(interlock&&Number.isFinite(m.music?.tonic)&&Number.isFinite(interlock.tonic)&&m.music.tonic!==interlock.tonic){
    const shift=m.music.tonic-interlock.tonic;
    for(let i=interlock.index;i<interlock.events.length;i++){const event=interlock.events[i];event.midi+=shift;while(event.midi>93)event.midi-=12;while(event.midi<57)event.midi+=12;}
    interlock.tonic=m.music.tonic;
   }
   if(interlock||arp)return false;
   if(m.replay)return false; // Quiet history notes are part of the frozen score.
   const selection=policy.idle({at,quietAt:ctx.currentTime*1000,price,music:m.music,known,quiet,referencePrice});
   return selection?play(selection,{id:'quiet:'+selection.at,at:selection.at},m.context?.latestCap,m.music||{}):false;
  },
  close(){closed=true;clearInterval(scheduler);clearTimeout(roomTimer);arp=null;master.gain.setTargetAtTime(0,ctx.currentTime,.012);for(const voice of voices)stopVoice(voice);setTimeout(()=>{for(const node of [instrumentFilter,instrumentSend,roomInput,dry,wet,room,tailGate,master])node.disconnect();},50);},
 };
}
