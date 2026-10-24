import {type ArtworkInput,type MarketFrame,ENGINE_VERSION,assertArtwork} from '@upic/domain';
import {marketChipSignal} from '../../../apps/web/public/market-chip-score.js';
import {composePerformedBar as composeChipBar} from '../../../apps/web/public/performed-market-score.js';
import {marketMusicalMapping} from '../../../apps/web/public/market-musical-mapping.js';
import {battlePattern,battlePatternFeed} from './legacy/earthbound-pattern.js';
export {ENGINE_VERSION};
export interface Note {at:number;midi?:number;duration:number;gain:number;kind:string;drum?:string;channel?:number;chip?:number;seed?:number;expression?:Record<string,unknown>;parameters?:Record<string,unknown>}
export function componentSeed(seed:string,label:string){let value=2166136261;for(const c of seed+':'+label)value=Math.imul(value^c.charCodeAt(0),16777619);return value>>>0;}
export function frameAt(input:ArtworkInput,t:number){const first=input.frames.reduce((a,b)=>a.at<=b.at?a:b),at=first.at+t*1000;return input.frames.reduce((prior,frame)=>frame.at<=at&&frame.at>=prior.at?frame:prior,first);}
const unit=(value:number)=>Math.max(0,Math.min(1,value));
const numeric=(value:unknown):number|null=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
// Frozen observations drive a deterministic reconstruction. This does not
// claim to recover an unrecorded live performance or invent missing trades.
function frameSignal(input:ArtworkInput,frame:MarketFrame,seconds:number){
 const origin=Math.min(...input.frames.map(row=>row.at)),at=origin+seconds*1000;
 const previous=input.frames.filter(row=>row.at<frame.at).sort((a,b)=>b.at-a.at)[0];
 const trades=(frame.trades||[]).filter(trade=>trade.at<=at&&trade.at>at-30000).sort((a,b)=>a.at-b.at);
 const price=numeric(frame.priceUsd),referencePrice=numeric(previous?.priceUsd)??numeric(trades.length>1?trades[0]?.priceUsd:null);
 const delta=price!==null&&referencePrice!==null&&referencePrice>0?100*(price/referencePrice-1):0;
 const observedVolume=frame.trades?trades.reduce((sum,trade)=>sum+Math.max(0,numeric(trade.volumeUsd)??0),0):numeric(frame.volumeUsd);
 const volume=observedVolume===null?0:unit(Math.log1p(Math.max(0,observedVolume))/14);
 const activity=frame.trades?unit(Math.log1p(trades.length)/Math.log(41)):volume;
 const motion=unit(Math.abs(delta)/4),age=Math.max(0,(at-frame.at)/1000),fresh=frame.stale||age>=30?0:1-age/30;
 const buyVolume=trades.filter(trade=>trade.side==='buy').reduce((sum,trade)=>sum+Math.max(0,numeric(trade.volumeUsd)??0),0);
 const tradeRate=trades.length/30,balance=trades.length&&observedVolume&&observedVolume>0?buyVolume/observedVolume:.5;
 const marketCap=numeric(frame.marketCapUsd),liquidity=numeric(frame.liquidityUsd);
 return {price,referencePrice,delta,observedVolume,activity,motion,volume,fresh,balance,tradeRate,marketCap,liquidity,source:frame.source,observed:price!==null||observedVolume!==null||trades.length>0,availability:{activity:!!frame.trades||observedVolume!==null,change:price!==null&&referencePrice!==null&&referencePrice>0,balance:trades.length>0,tradeRate:!!frame.trades,volume:observedVolume!==null,liquidity:liquidity!==null}};
}
export function score(input:ArtworkInput):Note[]{
 assertArtwork(input);const notes:Note[]=[],seed=componentSeed(input.seed,'music');
 let seconds=0;
 for(let bar=0;seconds<input.seconds;bar++){
  const frame=frameAt(input,seconds),metrics=frameSignal(input,frame,seconds);
 const intensity=Math.max(metrics.activity,metrics.motion,metrics.volume*.7),tempo=marketMusicalMapping(marketChipSignal({metrics})).tempo.bpm,beat=60/tempo;
  const plan=composeChipBar(seed,bar,{cap:numeric(frame.marketCapUsd),metrics,active:metrics.fresh>0,arpeggios:input.stage>=4,drums:input.stage>=3,textureGain:input.stage>=1?.55:0,music:{tempo,intensity,activity:metrics.activity,volatility:metrics.motion,group:metrics.delta<0?'down':'up'}});
  for(const note of plan.events){
   if(note.kind==='bass'&&input.stage<2)continue;
   const at=seconds+note.beat*beat,duration=Math.min(note.duration*beat,input.seconds-at);
   if(at<input.seconds&&duration>0)notes.push({...note,at,duration});
  }
  seconds+=4*beat;
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
type ChipRenderer={prepareChipPhrasing:()=>Promise<{ready:boolean;error?:string|null}>;renderGameBoyRack(events:Note[],options:{sampleRate:number;seconds:number;settings?:Record<string,number>}):{left:Float32Array;right:Float32Array}};
const chipModules=new Map<string,Promise<ChipRenderer>>();
const chipRenders=new WeakMap<ArtworkInput,Map<string,Promise<{left:Float32Array;right:Float32Array}>>>();
function chipModule(assetBase:string){
 const url=assetBase.replace(/\/$/,'')+'/friday-performance-rack.js?v=491';
 let pending=chipModules.get(url);
 if(!pending){pending=import(/* @vite-ignore */ url).catch(error=>{chipModules.delete(url);throw error;});chipModules.set(url,pending!);}
 return pending!;
}
export async function schedule(ctx:BaseAudioContext,input:ArtworkInput,assetBase:string,start=0,destination:AudioNode=ctx.destination,windowSeconds:number=input.seconds,offset=0){
 assertArtwork(input);
 const captured=JSON.stringify(input),cache=chipRenders.get(input)||new Map(),key=assetBase+':'+ctx.sampleRate+':'+captured;
 chipRenders.set(input,cache);
 let pending=cache.get(key);
 if(!pending){
  // The platform player updates its input object in place. Cache the captured
  // data, not just that object's identity, and bound retained generations.
  const frozen=JSON.parse(captured) as ArtworkInput;
  pending=chipModule(assetBase).then(async renderer=>{const phrasing=await renderer.prepareChipPhrasing();if(!phrasing.ready)throw Error(phrasing.error||'MIDI phrase data could not be prepared');return renderer.renderGameBoyRack(score(frozen),{sampleRate:ctx.sampleRate,seconds:frozen.seconds});}).catch(error=>{cache.delete(key);throw error;});
  if(cache.size>=2)cache.clear();cache.set(key,pending);
 }
 const rendered=await pending;
 const from=Math.max(0,Math.min(input.seconds,offset)),duration=Math.min(Math.max(0,windowSeconds),input.seconds-from);
 if(duration<=0)return ()=>{};
 // Render from the original chip reset even for a later playback window, so
 // envelopes, wave RAM, noise registers and channel steals retain their state.
 const buffer=ctx.createBuffer(2,Math.ceil(input.seconds*ctx.sampleRate),ctx.sampleRate);
 buffer.getChannelData(0).set(rendered.left);buffer.getChannelData(1).set(rendered.right);
 const source=ctx.createBufferSource(),gain=ctx.createGain();gain.gain.value=.55;
 source.buffer=buffer;source.connect(gain);gain.connect(destination);
 source.onended=()=>{source.disconnect();gain.disconnect();};source.start(Math.max(ctx.currentTime,start),from,duration);
 return ()=>{try{source.stop();}catch{}source.disconnect();gain.disconnect();};
}
export async function offline(input:ArtworkInput,assetBase:string){const ctx=new OfflineAudioContext(2,Math.ceil(input.seconds*48000),48000);await schedule(ctx,input,assetBase,0,ctx.destination,input.seconds,0);return ctx.startRendering();}
export function wav(buffer:AudioBuffer):Uint8Array {
 const channels=buffer.numberOfChannels,frames=buffer.length,bytes=new Uint8Array(44+frames*channels*2),view=new DataView(bytes.buffer);
 const text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
 text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,bytes.length-44,true);
 const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));for(let i=0;i<frames;i++)for(let c=0;c<channels;c++){const n=Math.max(-1,Math.min(1,data[c]![i]!));view.setInt16(44+(i*channels+c)*2,n<0?n*32768:n*32767,true);}return bytes;
}
