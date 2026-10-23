import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {composeChipBar,chipHash} from '../apps/web/public/market-chip-score.js';
import {renderGameBoyRack} from '../apps/web/public/gb-chip-rack.js';

import {installOriginalityIndex} from '../apps/web/public/midi-originality.js?v=455';

// Render public Coinbase trade observations through the production score and
// APU. This is a reconstruction, not a recording of a prior browser session.
const args=Object.fromEntries(process.argv.slice(2).map(value=>{
 const split=value.indexOf('=');return [value.slice(0,split),value.slice(split+1)];
}));
if(!args['--trades']||!args['--out'])throw Error('Use --trades=/absolute/trades.json --out=/absolute/preview.wav [--coin=ETH-USD] [--seconds=24]');
const coin=args['--coin']||'ETH-USD',seconds=Math.max(4,Math.min(60,Number(args['--seconds'])||24)),sampleRate=48000;
const input=JSON.parse(await readFile(resolve(args['--trades']),'utf8'));
if(!Array.isArray(input))throw Error('Expected a Coinbase public-trades array');
const trades=input.map(row=>({at:Date.parse(row.time),price:Number(row.price),size:Number(row.size),id:String(row.trade_id)}))
 .filter(row=>Number.isFinite(row.at)&&row.price>0&&Number.isFinite(row.price)&&row.size>=0&&Number.isFinite(row.size))
 .sort((a,b)=>a.at-b.at);
if(!trades.length)throw Error('No usable trade observations');
const end=trades.at(-1).at,origin=end-seconds*1000,notes=[],observations=[];
let seed=2166136261;
for(const char of coin)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
let time=0;
for(let bar=0;time<seconds;bar++){
 const at=origin+time*1000,past=trades.filter(trade=>trade.at<=at),window=past.filter(trade=>trade.at>at-30000);
 const last=past.at(-1),first=window[0],volumeUsd=window.reduce((sum,trade)=>sum+trade.price*trade.size,0);
 const delta=last&&first?100*(last.price/first.price-1):0,activity=Math.min(1,Math.log1p(window.length/30)/Math.log(21));
 const volume=Math.min(1,Math.log1p(volumeUsd/30)/Math.log(10001)),motion=Math.min(1,Math.abs(delta)/8);
 const intensity=Math.max(activity,motion,volume*.7),tempo=40+120*intensity,beat=60/tempo;
 const metrics={price:last?.price,referencePrice:first?.price,delta,activity,volume,motion,tradeRate:window.length/30,
  fresh:window.length?1:0,observed:!!last,source:'captured-trades',availability:{volume:true,tradeRate:true,balance:false}};
 const plan=composeChipBar(seed,bar,{metrics,music:{tempo,intensity,activity,volatility:motion},active:window.length>0});
 observations.push({at:new Date(at).toISOString(),price:last?.price,volumeUsd,tradeCount:window.length,tempo,patternId:plan.drums.patternId});
 for(const event of plan.events){
  const at=time+event.beat*beat,duration=Math.min(event.duration*beat,seconds-at);
  if(at<seconds&&duration>0)notes.push({...event,at,duration});
 }
 time+=4*beat;
}
await installOriginalityIndex(await readFile(new URL('../apps/web/public/midi-originality-index.bin',import.meta.url)));
const {left,right,phrasing}=renderGameBoyRack(notes,{sampleRate,seconds,model:'dmg'}),frames=left.length;
const output=Buffer.alloc(44+frames*4);
output.write('RIFF',0);output.writeUInt32LE(output.length-8,4);output.write('WAVEfmt ',8);
output.writeUInt32LE(16,16);output.writeUInt16LE(1,20);output.writeUInt16LE(2,22);output.writeUInt32LE(sampleRate,24);
output.writeUInt32LE(sampleRate*4,28);output.writeUInt16LE(4,32);output.writeUInt16LE(16,34);output.write('data',36);output.writeUInt32LE(frames*4,40);
let peak=0,power=0,nonFinite=0;
// Same fixed listening headroom as the live chip master; no normalization or
// effects that could disguise the core's channel balance or output behavior.
for(let i=0;i<frames;i++)for(let channel=0;channel<2;channel++){
 const value=(channel?right[i]:left[i])*.72;
 if(!Number.isFinite(value)){nonFinite++;continue;}
 peak=Math.max(peak,Math.abs(value));power+=value*value;
 const n=Math.max(-1,Math.min(1,value));output.writeInt16LE(Math.round(n*(n<0?32768:32767)),44+(i*2+channel)*2);
}
if(nonFinite)throw Error('Non-finite chip output: '+nonFinite);
const path=resolve(args['--out']);await mkdir(dirname(path),{recursive:true});await writeFile(path,output);
const metadata={coin,source:'https://api.exchange.coinbase.com/products/'+coin+'/trades',
 type:'Deterministic reconstruction from public trade observations; not a historical audio recording',
 from:new Date(origin).toISOString(),to:new Date(end).toISOString(),seconds,sampleRate,seed,events:notes.length,
 chips:2,channels:[...new Set(notes.map(event=>(event.chip||0)*4+event.channel+1))].sort((a,b)=>a-b),roles:[...new Set(notes.map(event=>event.kind))],peak,rms:Math.sqrt(power/(frames*2)),
 renderIdentity:chipHash(seed,notes.length).toString(16),phrasing,observations};
await writeFile(path.replace(/\.wav$/i,'')+'.json',JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({path,...metadata,observations:observations.length},null,2));
