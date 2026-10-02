// CC0 sampled piano. Only an explicit trade() call creates a chord.
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
export async function createTradePiano(ctx,destination,{onVoice=()=>{}}={}){
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
 let enabled=true,running=false,volume=.5,seed=1917,index=0,closed=false;
 const voices=new Set();
 function updateGain(){master.gain.setTargetAtTime(enabled&&running?volume:0,ctx.currentTime,.025);}
 function stopVoice(voice){try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect();voices.delete(voice);}
 function clear(){for(const voice of [...voices])stopVoice(voice);room.buffer=null;room.buffer=impulse;}
 return {
  setMaster(value){volume=unit(value);updateGain();},
  setRunning(value){running=Boolean(value);updateGain();if(!running)clear();},
  setEnabled(value){enabled=Boolean(value);updateGain();if(!enabled)clear();},
  reset(value=seed){clear();seed=Number(value)>>>0;index=0;},
  resonance(cap){const r=marketResonance(cap);filter.Q.setTargetAtTime(.5+2*r,ctx.currentTime,.6);wet.gain.setTargetAtTime(.2+.22*r,ctx.currentTime,.6);return r;},
  trade(event,cap){
   if(closed||!enabled||!running||ctx.state!=='running')return false;
   this.resonance(cap);
   // Stable, consonant voicings change slowly; arrival timing remains untouched.
   const root=48+seed%5,voicings=[[0,4,7],[0,7,14],[0,4,9],[0,5,9]];
   const notes=voicings[Math.floor(index++/8)%voicings.length].map(note=>root+note);
   const time=ctx.currentTime+.008;
   const dynamics=.34/(1+voices.size/18);
   for(const midi of notes){
    while(voices.size>=48)stopVoice(voices.values().next().value);
    const sample=samples.reduce((a,b)=>Math.abs(a.midi-midi)<=Math.abs(b.midi-midi)?a:b);
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=sample.buffer;source.playbackRate.value=2**((midi-sample.midi)/12);
    const duration=Math.min(10,source.buffer.duration/source.playbackRate.value);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(dynamics*sample.trim,time+.012);gain.gain.setTargetAtTime(0,time+duration-.2,.045);
    source.connect(gain);gain.connect(input);const voice={source,gain};voices.add(voice);source.onended=()=>{source.disconnect();gain.disconnect();voices.delete(voice);};source.start(time);source.stop(time+duration);
   }
   onVoice({id:event.id,notes,resonance:marketResonance(cap),at:Date.now()});return true;
  },
  close(){closed=true;clear();for(const node of [input,filter,dry,wet,room,master])node.disconnect();},
 };
}
