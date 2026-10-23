import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {GB_INSTRUMENTS} from '../apps/web/public/gameboy-instruments.js';

// Render loopable, band-limited cycles offline. Each source root covers at
// most six semitones upward, leaving spectral headroom for transposition.
export function renderGameBoySample(instrument,midi,sampleRate=48000){
 const frequency=440*2**((midi-69)/12),frames=Math.round(sampleRate/frequency);
 const harmonicLimit=Math.floor(.31*sampleRate/frequency),table=instrument.wave;
 const mean=table.reduce((a,b)=>a+b,0)/table.length;
 const data=new Float64Array(frames);
 for(let k=1;k<=harmonicLimit;k++){
  let a=0,b=0;
  const weight=2*Math.sin(Math.PI*k/table.length)/(Math.PI*k);
  for(let step=0;step<table.length;step++){
   const phase=2*Math.PI*k*(step+.5)/table.length,value=(table[step]-mean)/7.5;
   a+=value*Math.cos(phase)*weight;b+=value*Math.sin(phase)*weight;
  }
  for(let i=0;i<frames;i++)data[i]+=a*Math.cos(2*Math.PI*k*i/frames)+b*Math.sin(2*Math.PI*k*i/frames);
 }
 const dc=data.reduce((a,b)=>a+b,0)/frames;
 const rms=Math.sqrt(data.reduce((sum,value)=>sum+(value-dc)**2,0)/frames);
 const peak=Math.max(...data.map(value=>Math.abs(value-dc)));
 const gain=Math.min(.13/Math.max(rms,1e-9),.32/Math.max(peak,1e-9));
 const bytes=Buffer.alloc(44+frames*2);
 bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(sampleRate,24);bytes.writeUInt32LE(sampleRate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++)bytes.writeInt16LE(Math.round((data[i]-dc)*gain*32767),44+i*2);
 return {bytes,frames,loopEnd:frames/sampleRate,correction:1200*Math.log2(frequency*frames/sampleRate)};
}
export async function renderGameBoyLibrary(){
 const root=fileURLToPath(new URL('../apps/web/public/samples/gameboy/',import.meta.url));await mkdir(root,{recursive:true});
 const files=[];
 for(const instrument of GB_INSTRUMENTS)for(const midi of [48,60,72,84,96]){
  const {bytes,loopEnd,correction}=renderGameBoySample(instrument,midi),file=`p${instrument.preset}-n${midi}.wav`;
  await writeFile(root+file,bytes);
  files.push({preset:instrument.preset,name:instrument.name,midi,velocity:80,file,trim:1,loop:true,loopStart:0,loopEnd,correction});
 }
 await writeFile(root+'manifest.json',JSON.stringify({version:1,library:'UPIC · GB style',source:'Original generated pulse and 32-step, 4-bit waveforms; no extracted game audio.',sampleRate:48000,files},null,2)+'\n');
 await writeFile(root+'SOURCE.txt','UPIC GB style instruments\n\nOriginal pulse and quantized wave tables authored for UPIC.\nRendered by scripts/render-gameboy.mjs, with band-limited cycles,\nzero DC, level matching and exact loop tuning. No game ROM or\nNintendo sample recordings are used. This is a musical sound palette,\nnot an emulation of Game Boy hardware or its channel limits.\n');
 console.log(`Rendered ${files.length} small loopable GB style samples.`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await renderGameBoyLibrary();
