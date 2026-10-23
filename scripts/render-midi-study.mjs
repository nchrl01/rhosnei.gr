#!/usr/bin/env node
// Offline audition of generated study events using UPIC's authored GB bank.
// This does not launch a browser, play through speakers, or change the app.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gameBoyProfile} from '../apps/web/public/gameboy-instruments.js';

const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/render-midi-study.mjs score.events.json output.wav');
const score=JSON.parse(fs.readFileSync(input,'utf8'));
const events=score.events;
if(!Array.isArray(events)||events.length>20000)throw Error('Invalid score event count');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../apps/web/public/samples/gameboy');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const rate=44100,cache=new Map();
const getSample=entry=>{
 if(cache.has(entry.file))return cache.get(entry.file);
 const bytes=fs.readFileSync(path.join(root,entry.file));
 if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.readUInt16LE(22)!==1||bytes.readUInt16LE(34)!==16)throw Error('Invalid mono PCM bank sample');
 const frames=bytes.readUInt32LE(40)/2,wave=Float32Array.from({length:frames},(_,i)=>bytes.readInt16LE(44+i*2)/32768);
 const sample={wave,rate:bytes.readUInt32LE(24)};cache.set(entry.file,sample);return sample;
};
let seconds=0;
for(const e of events){
 if(!Number.isFinite(e.start_seconds)||e.start_seconds<0||!Number.isFinite(e.duration_seconds)||e.duration_seconds<=0||e.duration_seconds>16||!Number.isInteger(e.midi)||e.midi<0||e.midi>127||!Number.isFinite(e.velocity)||e.velocity<1||e.velocity>127)throw Error('Invalid generated event');
 seconds=Math.max(seconds,e.start_seconds+e.duration_seconds);
}
if(seconds>180||seconds<=0)throw Error('Study must be between 0 and 180 seconds');
const frames=Math.ceil((seconds+.25)*rate),left=new Float32Array(frames),right=new Float32Array(frames);
for(const e of events){
 const preset=e.gb_preset??(e.role==='bass'?31:e.role==='chords'?139:23),profile=gameBoyProfile(preset);
 const entry=manifest.files.filter(s=>s.preset===preset).sort((a,b)=>Math.abs(a.midi-e.midi)-Math.abs(b.midi-e.midi))[0];
 if(!entry||!profile)throw Error(`No GB instrument ${preset}`);
 const sample=getSample(entry),step=sample.rate/rate*2**((e.midi-entry.midi+(entry.correction||0)/100)/12);
 const duration=e.duration_seconds,attack=Math.min(profile.attack,duration*.15),decay=Math.min(profile.decay,duration*.25),release=Math.min(profile.release,duration*.3);
 const sustain=profile.sustain,pan=e.role==='bass'?0:e.role==='chords'?-.2:.2;
 const l=Math.cos((pan+1)*Math.PI/4),r=Math.sin((pan+1)*Math.PI/4);
 const gain=e.velocity/127*(e.role==='chords'?.25:e.role==='bass'?.65:.62);
 const filter=1-Math.exp(-2*Math.PI*profile.cutoff/rate),start=Math.round(e.start_seconds*rate),length=Math.floor(duration*rate);
 let phase=0,low=0;
 for(let i=0;i<length&&start+i<frames;i++){
  const whole=Math.floor(phase),fraction=phase-whole;
  const raw=sample.wave[whole%sample.wave.length]*(1-fraction)+sample.wave[(whole+1)%sample.wave.length]*fraction;
  low+=filter*(raw-low);
  const t=i/rate;
  let envelope=t<attack?t/attack:t<attack+decay?1-(1-sustain)*(t-attack)/decay:sustain;
  if(t>duration-release)envelope*=Math.max(0,(duration-t)/release);
  const value=low*envelope*gain;
  left[start+i]+=value*l;right[start+i]+=value*r;phase+=step;
 }
}
let peak=0,sum=0;
for(let i=0;i<frames;i++){peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));sum+=left[i]**2+right[i]**2;}
const scale=Math.min(2.5,.89/Math.max(peak,1e-9));
const bytes=Buffer.alloc(44+frames*4);
bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*4,28);bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(frames*4,40);
for(let i=0;i<frames;i++){bytes.writeInt16LE(Math.round(left[i]*scale*32767),44+i*4);bytes.writeInt16LE(Math.round(right[i]*scale*32767),46+i*4);}
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,bytes);
const report={source:path.resolve(input),audio:path.resolve(output),sampleRate:rate,seconds:frames/rate,events:events.length,peak:peak*scale,rms:Math.sqrt(sum/(frames*2))*scale,clippedSamples:0,masterGain:scale,renderer:'Offline GB bank audition; not a browser/live-engine capture'};
fs.writeFileSync(output.replace(/\.wav$/i,'')+'.audio-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
