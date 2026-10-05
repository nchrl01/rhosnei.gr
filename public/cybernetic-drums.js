// Browser adaptation of the 17-node drum-event network documented by GrundTon.
// Event roles follow net_drums.pd; transitions below are authored for UPIC.
const EVENTS=['kick','kick','snare','hat','hat','hat','snare','ride','kick','kick','snare','hat','hat','ride','snare','ride','rest'];
const ids={kick:16397,snare:16390,hat:16384,ride:16389};
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
const hash=text=>{let h=2166136261;for(const c of String(text)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;};
export function createCyberneticDrums(ctx,destination,{onHit=()=>{},onError=()=>{}}={}){
 const output=ctx.createGain();output.gain.value=0;output.connect(destination);
 let samples=new Map(),loading=null,retryAt=0,closed=false,enabled=true,running=false,volume=.5,seed=0,randomState=0;
 let phrase=null,lastEvent=null,restUntil=0,intensity=0,tempo=60;
 const voices=new Set();
 function random(){randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;}
 function update(){output.gain.setTargetAtTime(enabled&&running?volume:0,ctx.currentTime,.02);}
 function clear(){phrase=null;for(const v of voices){v.gain.gain.cancelScheduledValues(ctx.currentTime);v.gain.gain.setTargetAtTime(0,ctx.currentTime,.008);try{v.source.stop(ctx.currentTime+.04);}catch{}}}
 async function prepare(){
  if(loading||samples.size||closed||Date.now()<retryAt)return loading;
  loading=(async()=>{
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
   try{
    const response=await fetch('samples/earthbound-drums/manifest.json?v=149',{signal:controller.signal});if(!response.ok)throw Error('Drum manifest unavailable');
    const manifest=await response.json();
    const result=await Promise.all(Object.entries(ids).map(async([kind,id])=>{
     const item=manifest.files.find(x=>x.preset===id);if(!item)throw Error('Missing '+kind);
     const r=await fetch('samples/earthbound-drums/'+item.file+'?v=149',{signal:controller.signal});if(!r.ok)throw Error('Drum sample unavailable');
     return [kind,{buffer:await ctx.decodeAudioData(await r.arrayBuffer()),trim:item.trim}];
    }));if(!closed)samples=new Map(result);
   }finally{clearTimeout(timeout);}
  })().catch(error=>{if(!closed){retryAt=Date.now()+60000;onError(error.message);}}).finally(()=>{loading=null;});return loading;
 }
 function hit(kind,time){
  const sample=samples.get(kind);if(!sample||voices.size>=8)return;
  const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=sample.buffer;source.loop=false;
  const duration=Math.min(sample.buffer.duration,kind==='hat'?.11:kind==='ride'?.3:.48);
  const level=(kind==='hat'?.13:kind==='ride'?.1:.22)*(.4+.6*intensity)*sample.trim;
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(level,time+.003);
  gain.gain.setValueAtTime(level,Math.max(time+.003,time+duration-.025));gain.gain.linearRampToValueAtTime(0,time+duration);
  source.connect(gain);gain.connect(output);const voice={source,gain};voices.add(voice);
  source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();};source.start(time);source.stop(time+duration);onHit({kind,time});
 }
 let timer=null;
 function schedule(){
  if(!phrase||!running||!enabled||closed||ctx.state!=='running')return;
  while(phrase&&phrase.next<ctx.currentTime+.1){
   const time=phrase.next,kind=EVENTS[phrase.node];phrase.next+=60/tempo/4;
   // Never replay missed attacks after a stalled browser frame.
   if(time>=ctx.currentTime-.03&&kind!=='rest'&&(kind==='kick'||kind==='snare'||random()<.25+.65*intensity))hit(kind,Math.max(ctx.currentTime+.003,time));
   const jump=random()<.04+.2*intensity;
   phrase.node=jump?Math.floor(random()*EVENTS.length):(phrase.node+1)%EVENTS.length;
   if(++phrase.step>=32){restUntil=phrase.next+60/tempo*8;phrase=null;}
  }
 }
 void prepare();
 return {
  reset(value=seed){clear();seed=value>>>0;randomState=seed;lastEvent=null;restUntil=0;},
  setEnabled(value){enabled=!!value;if(!enabled)clear();update();},
  setRunning(value){running=!!value;if(running&&!timer)timer=setInterval(schedule,25);if(!running){clearInterval(timer);timer=null;clear();}update();},
  setMaster(value){volume=unit(value);update();},
  frame(m,{playing=false,seeking=false,ended=false,event=null}={}){
   const active=playing&&running&&enabled&&!seeking&&!ended&&ctx.state==='running';
   const cap=Number(m.context?.latestCap)||0;intensity=unit(m.music?.intensity);tempo=Math.max(40,Math.min(140,Number(m.music?.tempo)||40));
   if(!active||cap<1e6||unit(m.fresh)===0||intensity<.04){clear();return;}
   if(!samples.size){if(!loading)void prepare();return;}
   if(!phrase&&event!==null&&event!==lastEvent&&ctx.currentTime>=restUntil){lastEvent=event;randomState=(seed^hash(event))>>>0;phrase={node:seed%2?8:0,step:0,next:ctx.currentTime+.025};}
  },
  close(){closed=true;clearInterval(timer);clear();output.disconnect();},
 };
}
