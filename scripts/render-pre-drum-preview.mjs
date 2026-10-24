import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {composePreDrumBar} from '../apps/web/public/pre-drum-arrangement.js';
import {renderGameBoyScore} from '../apps/web/public/gb-apu-instrument.js';
import {marketChipSignal} from '../apps/web/public/market-chip-score.js';
import {marketMusicalMapping} from '../apps/web/public/market-musical-mapping.js';
import {chartCharacter} from '../apps/web/public/music-context.js';
import {phraseArrangement} from '../apps/web/public/phrase-arrangement.js';
import {installOriginalityIndex} from '../apps/web/public/midi-originality.js?v=455';
const arg=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return[a.slice(0,i),a.slice(i+1)];}));
if(!arg['--trades']||!arg['--out'])throw Error('Expected --trades=... --out=...');
const seconds=24,sampleRate=48000,seed=3790142981;
const trades=JSON.parse(await readFile(resolve(arg['--trades']),'utf8')).map(r=>({at:Date.parse(r.time),price:+r.price,size:+r.size})).filter(r=>Number.isFinite(r.at)&&r.price>0&&r.size>=0).sort((a,b)=>a.at-b.at);
const end=trades.at(-1).at,origin=end-seconds*1000,scores=[[],[],[]],observations=[],ends=Array(4).fill(-Infinity);
let time=0;
for(let bar=0;time<seconds;bar++){
 const now=origin+time*1000,window=trades.filter(t=>t.at<=now&&t.at>now-30000),last=window.at(-1),first=window[0];
 const activity=Math.min(1,Math.log1p(window.length/30)/Math.log(21)),volumeUsd=window.reduce((a,t)=>a+t.price*t.size,0),volume=Math.min(1,Math.log1p(volumeUsd/30)/Math.log(10001));
 const delta=first&&last?100*(last.price/first.price-1):0,motion=Math.min(1,Math.abs(delta)/8),intensity=Math.max(activity,motion,.7*volume);
 const metrics={observed:!!last,fresh:window.length?1:0,tradingActivity:window.length?1:0,price:last?.price,referencePrice:first?.price,activity,volume,motion,tradeRate:window.length/30,source:'trades'};
 const signal=marketChipSignal({metrics}),mapping=marketMusicalMapping(signal),tempo=mapping.tempo.bpm,beatSeconds=60/tempo;
 const character=chartCharacter({group:delta<0?'down':'up',capChangePct:delta,intensity,volatility:motion});
 const music={character,group:delta<0?'down':'up',tempo,activity,intensity,changePct:delta};
 const plan=composePreDrumBar(seed,bar,{music,cap:null,active:mapping.active,pitchLow:55,pitchHigh:76});
 observations.push({bar,at:new Date(now).toISOString(),delta,tempo,tradeCount:window.length,harmony:plan.harmony});
 for(const event of plan.events){
  const at=time+event.beat*beatSeconds,duration=Math.min(event.duration*beatSeconds,seconds-at);if(duration<=0)continue;
  if(event.kind==='chord'){
   let slot=ends.findIndex(t=>t<=at);if(slot<0)slot=ends.indexOf(Math.min(...ends));ends[slot]=at+duration;
   const chip=1+Math.floor(slot/2),channel=slot%2;
   scores[chip].push({at,duration,midi:event.midi,gain:event.gain,kind:channel?'chord':'note',expression:{duty:channel?2:1,pan:channel?1:-1,envelope:{initial:10,pace:0},adsr:{attack:.035,decay:.12,sustain:.78,release:.22}}});
  }else if(event.kind==='bass')scores[0].push({at,duration,midi:Math.max(28,event.midi),gain:event.gain*.5,kind:'bass',expression:{wave:4,pan:0,adsr:{attack:.01,decay:.09,sustain:.7,release:.15}}});
  else scores[0].push({at,duration,midi:event.midi,gain:event.gain*.7,kind:'note',expression:{allowedPitches:event.allowedPitches,duty:2,pan:0,envelope:{initial:9,pace:0},adsr:{attack:.012,decay:.07,sustain:.72,release:.12}}});
 }
 // A very quiet, sustained wave texture follows the original Envion phrase
 // window. No drum sequencer; shared rests end this proposal as well.
 const room=phraseArrangement(seed,bar*4+1.5);
 if(mapping.active&&!room.rest&&bar%2===1){
  const at=time+1.5*beatSeconds,duration=Math.min(3*beatSeconds,room.restInBeats*beatSeconds,seconds-at);
  if(duration>.05)scores[2].push({at,duration,midi:plan.harmony.root-12,gain:.012*room.layers.envion,kind:'bass',expression:{wave:4,cents:delta<0?-8:8,vibrato:{depth:5,cycles:1},adsr:{attack:.08,decay:.2,sustain:.75,release:.3}}});
 }
 time+=4*beatSeconds;
}
await installOriginalityIndex(await readFile(new URL('../apps/web/public/midi-originality-index.bin',import.meta.url)));
const rendered=scores.map(score=>renderGameBoyScore(score,{seconds,sampleRate,model:'dmg'})),frames=seconds*sampleRate,out=Buffer.alloc(44+frames*4);
out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(frames*4,40);
let peak=0,power=0;
for(let i=0;i<frames;i++)for(let ch=0;ch<2;ch++){
 const value=rendered.reduce((sum,r)=>sum+(ch?r.right[i]:r.left[i]),0)*.35*.72;
 if(!Number.isFinite(value))throw Error('Invalid chip sample');peak=Math.max(peak,Math.abs(value));power+=value*value;
 out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,value))*32767),44+(i*2+ch)*2);
}
const path=resolve(arg['--out']);await mkdir(dirname(path),{recursive:true});await writeFile(path,out);
await writeFile(path.replace(/\.wav$/,'.json'),JSON.stringify({sourceRevision:'e516f11',sourceTime:'2026-10-23T21:30:13+03:00',kind:'Local pre-drum arrangement reconstructed through current GB APUs; not original historical audio',seconds,seed,chips:3,drums:false,peak,rms:Math.sqrt(power/(frames*2)),notes:scores.map(s=>s.length),phrasing:rendered.map(r=>r.phrasing),observations},null,2));
console.log(path);
