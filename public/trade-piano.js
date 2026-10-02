// CC0 sampled piano. Meaningful moves and known quiet intervals select single notes.
import {pianoHarmony} from './music-context.js?v=53';
import {createPianoPolicy} from './piano-policy.js?v=58';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
let sampleDownload;
async function loadSampleAsset(path,format){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch('samples/piano/'+path+'?v=47',{signal:controller.signal});
  if(!response.ok)throw Error('Cannot load piano asset '+path);
  return await response[format]();
 }finally{clearTimeout(timeout);}
}
// Start downloading when a market is selected, before the audio gesture. A
// missing sample must not silence all the other, successfully loaded notes.
export function preloadPianoSamples(){
 if(!sampleDownload)sampleDownload=(async()=>{
  const manifest=await loadSampleAsset('manifest.json','json');
  const results=await Promise.allSettled(manifest.files.map(async item=>{
   return {...item,bytes:await loadSampleAsset(item.file,'arrayBuffer')};
  }));
  const samples=results.filter(result=>result.status==='fulfilled').map(result=>result.value);
  if(!samples.length)throw Error('Piano samples unavailable');
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
 const decoded=await Promise.allSettled(downloaded.map(async item=>({midi:item.midi,buffer:await ctx.decodeAudioData(item.bytes.slice(0))})));
 const samples=decoded.filter(result=>result.status==='fulfilled').map(result=>{
  const sample=result.value;
  // The supplied soft samples peak at only 0.07–0.21. Match their playback
  // headroom before the chord envelope/master instead of burying them under Pd.
  let peak=0;
  for(let channel=0;channel<sample.buffer.numberOfChannels;channel++){
   for(const value of sample.buffer.getChannelData(channel))peak=Math.max(peak,Math.abs(value));
  }
  return {...sample,trim:peak>1e-5?Math.min(12,.65/peak):1};
 });
 if(!samples.length)throw Error('This browser could not decode the piano samples');
 const input=ctx.createGain(),filter=ctx.createBiquadFilter(),dry=ctx.createGain(),wet=ctx.createGain(),room=ctx.createConvolver(),master=ctx.createGain();
 filter.type='lowpass';filter.frequency.value=2600;filter.Q.value=.5;
 dry.gain.value=.8;wet.gain.value=.2;master.gain.value=0;
 const impulse=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*4.5),ctx.sampleRate);
 let noise=1917;
 for(let channel=0;channel<2;channel++){
  const data=impulse.getChannelData(channel);let smooth=0;
  for(let i=0;i<data.length;i++){noise=(Math.imul(noise,1664525)+1013904223)>>>0;smooth=.88*smooth+.12*(noise/2147483648-1);data[i]=i<ctx.sampleRate*.025?0:smooth*Math.exp(-i/ctx.sampleRate*1.7);}
 }
 room.buffer=impulse;input.connect(filter);filter.connect(dry);filter.connect(room);room.connect(wet);dry.connect(master);wet.connect(master);master.connect(destination);
 let enabled=true,running=false,volume=.5,seed=1917,closed=false,currentHarmony=null,arp=null,pattern=[],nextArp=0,lastArpBucket=null,lastPitch=null;
 const policy=createPianoPolicy(seed);
 const voices=new Set();
 function updateGain(){master.gain.setTargetAtTime(enabled&&running?volume:0,ctx.currentTime,.025);}
 function stopVoice(voice,fade=false){
  voices.delete(voice);
  if(fade){const time=ctx.currentTime;voice.gain.gain.cancelScheduledValues(time);voice.gain.gain.setTargetAtTime(0,time,.009);try{voice.source.stop(time+.035);}catch{}}
  else{try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect();}
 }
 function clear(){arp=null;currentHarmony=null;for(const voice of [...voices])stopVoice(voice);room.buffer=null;room.buffer=impulse;}
 function note(midi,time,dynamics,duration=8,kind='note'){
  while(voices.size>=32)stopVoice(voices.values().next().value,true);
  const sample=samples.reduce((a,b)=>Math.abs(a.midi-midi)<=Math.abs(b.midi-midi)?a:b);
  const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=sample.buffer;source.playbackRate.value=2**((midi-sample.midi)/12);
  duration=Math.min(duration,source.buffer.duration/source.playbackRate.value);
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(dynamics*sample.trim,time+.015);gain.gain.setTargetAtTime(0,time+Math.max(.05,duration-.22),.055);
  source.connect(gain);gain.connect(input);const voice={source,gain,kind};voices.add(voice);source.onended=()=>{source.disconnect();gain.disconnect();voices.delete(voice);};source.start(time);source.stop(time+duration);
 }
 // Audio-clock lookahead keeps attacks independent of the drawing frame rate.
 // Only a triggered four-beat phrase is scheduled; this never free-runs.
 const scheduler=setInterval(()=>{
  if(!arp||closed||!running||!enabled||ctx.state!=='running')return;
  while(arp.index<arp.notes.length&&arp.nextTime<ctx.currentTime+.12){
   const [step,pitch]=arp.notes[arp.index++],time=arp.nextTime;arp.nextTime+=arp.step;if(time<ctx.currentTime-.08)continue;
   const notes=currentHarmony?.notes;if(!notes?.length)break;
   const target=notes.reduce((sum,n)=>sum+n,0)/notes.length+9+(pitch-66)*.5;
   const candidates=notes.flatMap(n=>[n,n+12,n+24]).filter(n=>n>=48&&n<=81);
   const midi=candidates.reduce((a,b)=>Math.abs(a-target)<=Math.abs(b-target)?a:b);
   note(midi,Math.max(ctx.currentTime+.005,time),arp.gain,2.6,'arp');onArpeggio({midi,step,time,tempo:arp.tempo});
  }
  if(arp.index>=arp.notes.length)arp=null;
 },25);
 function play(selection,event,cap,music){
  const harmony=pianoHarmony(seed,event,music),tones=harmony.notes;
  currentHarmony=harmony;
  const quiet=selection.reason==='quiet',direction=Math.sign(selection.changePct);
  const target=quiet?(lastPitch??54):direction>0?58:49;
  const midi=tones.reduce((a,b)=>Math.abs(a-target)<=Math.abs(b-target)?a:b);
  const time=ctx.currentTime+.008,intensity=unit(music.intensity);
  note(midi,time,quiet?.105:.20*(.7+.3*intensity),quiet?5:7);lastPitch=midi;
  const bucket=Number.isFinite(event.chordStep)?event.chordStep:Math.floor(selection.at/30000);
  const draw=(Math.imul((seed^bucket)>>>0,2654435761)>>>0)%4;
  // The existing occasional AI phrase is allowed only after a significant move.
  // Quiet notes never start a phrase or a chord.
  if(!quiet&&pattern.length&&intensity>.015&&!arp&&time>=nextArp&&bucket!==lastArpBucket&&draw===0){
   const tempo=Math.max(40,Math.min(140,Number(music.tempo)||40)),beat=60/tempo;
   const notes=pattern.filter((_,i)=>i%2===0||pattern.length<=8).slice(0,8).map(([,pitch],i)=>[i,pitch]);
   arp={notes,index:0,nextTime:time+beat,step:beat/2,tempo,gain:.075*(.6+.4*intensity)};nextArp=time+beat*24;lastArpBucket=bucket;
  }
  onVoice({id:event.id,notes:[midi],harmony,resonance:marketResonance(cap),reason:selection.reason,changePct:selection.changePct,at:selection.at});
  return true;
 }
 return {
  setMaster(value){volume=unit(value);updateGain();},
  setRunning(value){running=Boolean(value);updateGain();if(!running)clear();},
  setEnabled(value){enabled=Boolean(value);updateGain();if(!enabled)clear();},
  reset(value=seed){clear();seed=Number(value)>>>0;policy.reset(seed);lastPitch=null;nextArp=0;lastArpBucket=null;},
  setArpeggioPattern(value){pattern=Array.isArray(value)?value.map(row=>[...row]):[];},
  setTempo(value){if(arp){arp.tempo=Math.max(40,Math.min(140,Number(value)||40));arp.step=30/arp.tempo;}},
  resonance(cap){const r=marketResonance(cap);filter.Q.setTargetAtTime(.5+2*r,ctx.currentTime,.6);wet.gain.setTargetAtTime(.2+.22*r,ctx.currentTime,.6);return r;},
  trade(event,cap,music=event.music||{}){
   if(closed||!enabled||!running||ctx.state!=='running')return false;
   this.resonance(cap);
   this.setTempo(music.tempo);
   const selection=policy.trade({...event,quietAt:ctx.currentTime*1000},music);
   return selection?play(selection,event,cap,music):false;
  },
  frame(m,{playing=false,seeking=false,ended=false,at,price,known=false,quiet=false,referencePrice}={}){
   if(closed||!enabled||!running||!playing||seeking||ended||ctx.state!=='running')return false;
   const selection=policy.idle({at,quietAt:ctx.currentTime*1000,price,music:m.music,known,quiet,referencePrice});
   return selection?play(selection,{id:'quiet:'+selection.at,at:selection.at},m.context?.latestCap,m.music||{}):false;
  },
  close(){closed=true;clearInterval(scheduler);clear();for(const node of [input,filter,dry,wet,room,master])node.disconnect();},
 };
}
