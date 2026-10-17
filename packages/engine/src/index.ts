import {type ArtworkInput,ENGINE_VERSION,assertArtwork} from '@upic/domain';
import {composeMarketBar} from './legacy/market-composition.js';
import {battlePattern,battlePatternFeed} from './legacy/earthbound-pattern.js';
export {ENGINE_VERSION};
export interface Note {at:number;midi:number;duration:number;gain:number;kind:string}
export function componentSeed(seed:string,label:string){let value=2166136261;for(const c of seed+':'+label)value=Math.imul(value^c.charCodeAt(0),16777619);return value>>>0;}
export function frameAt(input:ArtworkInput,t:number){const at=input.frames[0]!.at+t*1000;return input.frames.filter(f=>f.at<=at).at(-1)||input.frames[0]!;}
export function score(input:ArtworkInput):Note[]{
 assertArtwork(input);const notes:Note[]=[],seed=componentSeed(input.seed,'music'),tempo=100,beat=60/tempo;
 for(let bar=0;bar*4*beat<input.seconds;bar++){
  const frame=frameAt(input,bar*4*beat),cap=Number(frame.marketCapUsd||0),tradeVolume=frame.trades?.reduce((v,t)=>v+Number(t.volumeUsd),0),activity=Math.min(1,Math.log1p(tradeVolume??Number(frame.volumeUsd||0))/14)||0.15;
  const direction=frame.trades?.at(-1)?.side==='sell'?'down':'up';
  const plan=composeMarketBar(seed,bar,{cap,active:true,arpeggios:input.stage>=4,music:{tempo,intensity:.3,activity,group:direction,character:'serene'}});
  for(const note of plan.events){if(note.kind==='bass'&&input.stage<2)continue;const at=(bar*4+note.beat)*beat;if(at<input.seconds)notes.push({at,midi:note.midi,duration:note.duration*beat,gain:note.gain,kind:note.kind});}
  if(input.stage>=3)for(let i=0;i<4;i++)notes.push({at:(bar*4+i)*beat,midi:36,duration:.1,gain:.03,kind:'percussion'});
 }return notes.sort((a,b)=>a.at-b.at);
}
export function draw(canvas:HTMLCanvasElement,input:ArtworkInput,t:number){
 const ctx=canvas.getContext('2d');if(!ctx)return;const frame=frameAt(input,t),seed=componentSeed(input.seed,'visual');
 const pattern=battlePattern(input.seed,t),w=canvas.width,h=canvas.height,step=Math.max(4,Math.floor(w/110));
 ctx.fillStyle='#080808';ctx.fillRect(0,0,w,h);ctx.fillStyle='#eee';
 const intensity=.25+input.stage*.055,phase=seed/4294967296*100+Math.log1p(Number(frame.priceUsd||0))*.7;
 const movement=.08+Math.min(1,Math.log1p(Number(frame.volumeUsd||0))/14)*.14;
 for(let y=step;y<h-step;y+=step)for(let x=step;x<w-step;x+=step){
  const u=(x-w/2)/h,v=(y-h/2)/h,edge=Math.min(x/w,1-x/w,y/h,1-y/h);
  const noise=Math.sin(x*.029+y*.017+phase+t*movement)*Math.cos(x*.019-y*.033+phase);
  const feed=battlePatternFeed(u*3,v*3,t,pattern,.22+noise*.09);
  if(feed+intensity<.47||edge<.035)continue;
  const radius=Math.max(.5,step*(.09+input.stage*.012))*(.7+.3*Math.sin(phase+x+y));
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
 }
 // Market motion stays separate from stage-dependent layer unlocks.
 if(frame.stale){ctx.font=Math.max(10,w/80)+'px monospace';ctx.fillText('cached market observation',step,h-step);}
}
const buffers=new Map<string,Promise<AudioBuffer>>();
async function sample(ctx:BaseAudioContext,url:string){
 if(!buffers.has(url))buffers.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('sample-unavailable');return r.arrayBuffer();}).then(bytes=>ctx.decodeAudioData(bytes)).catch(e=>{buffers.delete(url);throw e;}));
 return buffers.get(url)!;
}
export async function schedule(ctx:BaseAudioContext,input:ArtworkInput,assetBase:string,start=0,destination:AudioNode=ctx.destination,windowSeconds=20,offset=0){
 const bank=componentSeed(input.seed,'voice')%2?80:48;
 const lead=await sample(ctx,assetBase+'/samples/generaluser/b0-p'+bank+'-n60-v104.wav');
 const bus=ctx.createGain();bus.gain.value=.7;bus.connect(destination);const sources:AudioScheduledSourceNode[]=[];
 for(const note of score(input)){
  if(note.at>=Math.min(input.seconds,offset+windowSeconds)||note.at<offset)continue;
  const gain=ctx.createGain(),at=start+note.at-offset,end=Math.min(start+windowSeconds,at+note.duration+.1);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(note.gain,at+.008);gain.gain.exponentialRampToValueAtTime(.00001,end);gain.connect(bus);
  let source:AudioScheduledSourceNode;
  if(note.kind==='bass'||note.kind==='percussion'){const o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(note.kind==='bass'?440*2**((note.midi-69)/12):90,at);if(note.kind==='percussion')o.frequency.exponentialRampToValueAtTime(30,end);o.connect(gain);source=o;}
  else {const s=ctx.createBufferSource();s.buffer=lead;s.playbackRate.value=2**((note.midi-60)/12);s.connect(gain);source=s;}
  source.start(at);source.stop(end);sources.push(source);
 }
 return ()=>{for(const source of sources)try{source.stop();}catch{}bus.disconnect();};
}
export async function offline(input:ArtworkInput,assetBase:string){const ctx=new OfflineAudioContext(2,input.seconds*48000,48000);await schedule(ctx,input,assetBase);return ctx.startRendering();}
export function wav(buffer:AudioBuffer):Uint8Array {
 const channels=buffer.numberOfChannels,frames=buffer.length,bytes=new Uint8Array(44+frames*channels*2),view=new DataView(bytes.buffer);
 const text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
 text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,bytes.length-44,true);
 const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));for(let i=0;i<frames;i++)for(let c=0;c<channels;c++){const n=Math.max(-1,Math.min(1,data[c]![i]!));view.setInt16(44+(i*channels+c)*2,n<0?n*32768:n*32767,true);}return bytes;
}
