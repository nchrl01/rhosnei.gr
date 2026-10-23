import {describe,expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {GB_INSTRUMENTS,gameBoyProfile,createGameBoyBuffer} from '../public/gameboy-instruments.js';
import {EARTHBOUND_PRESETS,earthboundPreset} from '../public/earthbound-instruments.js';
import {renderGameBoySample} from '../../../scripts/render-gameboy.mjs';

describe('GB style instrument library',()=>{
 it('covers every seeded melodic preset and preserves assignments',()=>{
  const melodic=EARTHBOUND_PRESETS.filter(id=>![145,146].includes(id));
  expect(GB_INSTRUMENTS.map(item=>item.preset).sort((a,b)=>a-b)).toEqual(melodic.sort((a,b)=>a-b));
  for(let seed=0;seed<100;seed++)expect(gameBoyProfile(earthboundPreset(seed))).toBeTruthy();
  for(const item of GB_INSTRUMENTS){
   expect(item.wave).toHaveLength(32);
   expect(item.wave.every(value=>Number.isInteger(value)&&value>=0&&value<=15)).toBe(true);
  }
  expect(gameBoyProfile(145)).toBeNull();
 });
 it('renders bounded zero-DC loop cycles with corrected equal-tempered tuning',()=>{
  for(const item of GB_INSTRUMENTS)for(const midi of [48,60,72,84,96]){
   const sample=renderGameBoySample(item,midi),{bytes,frames,correction}=sample;
   expect(bytes.toString('ascii',0,4)).toBe('RIFF');expect(bytes.readUInt32LE(24)).toBe(48000);
   expect(bytes.readUInt32LE(40)).toBe(frames*2);expect(sample.loopEnd).toBe(frames/48000);
   expect(48000/frames*2**(correction/1200)).toBeCloseTo(440*2**((midi-69)/12),8);
   const pcm=Array.from({length:frames},(_,i)=>bytes.readInt16LE(44+i*2)/32768);
   const mean=pcm.reduce((sum,value)=>sum+value,0)/frames;
   const rms=Math.sqrt(pcm.reduce((sum,value)=>sum+value*value,0)/frames);
   expect(Math.abs(mean)).toBeLessThan(.00002);expect(rms).toBeGreaterThan(.1);expect(rms).toBeLessThan(.131);
   expect(Math.max(...pcm.map(Math.abs))).toBeLessThanOrEqual(.321);
   expect(bytes.length).toBeLessThan(900);
  }
 });
 it('ships reproducible files and complete metadata for every selectable instrument',async()=>{
  const root=new URL('../public/samples/gameboy/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  expect(manifest.files).toHaveLength(GB_INSTRUMENTS.length*5);
  for(const entry of manifest.files){
   const instrument=GB_INSTRUMENTS.find(item=>item.preset===entry.preset);
   expect(entry.loop).toBe(true);expect(entry.loopStart).toBe(0);
   expect(Buffer.compare(await readFile(new URL(entry.file,root)),renderGameBoySample(instrument,entry.midi).bytes)).toBe(0);
  }
 });
 it('preserves exact loop duration on 44.1 kHz and 48 kHz output devices',()=>{
  const sample=renderGameBoySample(GB_INSTRUMENTS[0],96),bytes=sample.bytes.buffer.slice(sample.bytes.byteOffset,sample.bytes.byteOffset+sample.bytes.byteLength);
  for(const sampleRate of [44100,48000]){
   const context={sampleRate,createBuffer:(channels,length,rate)=>({sampleRate:rate,duration:length/rate,getChannelData:()=>new Float32Array(length)})};
   const buffer=createGameBoyBuffer(context,bytes);
   expect(buffer.sampleRate).toBe(48000);expect(buffer.duration).toBe(sample.loopEnd);
  }
 });
 it('preloads the GB bank through the real loader without requesting GeneralUser',async()=>{
  const requests=[];
  vi.stubGlobal('fetch',async path=>{
   requests.push(String(path));
   const file=new URL('../public/'+String(path).split('?')[0],import.meta.url);
   const data=await readFile(file);
   return {ok:true,json:async()=>JSON.parse(data.toString()),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
  });
  try{
   const {preloadPianoSamples}=await import('../public/trade-piano.js');
   const samples=await preloadPianoSamples(1917,13);
   expect(samples.filter(item=>item.preset===13)).toHaveLength(5);
   expect(samples.some(item=>item.preset===145)).toBe(true);
   expect(samples.some(item=>item.preset===146)).toBe(true);
   expect(requests.some(path=>path.includes('samples/gameboy/'))).toBe(true);
   expect(requests.some(path=>path.includes('generaluser'))).toBe(false);
  }finally{vi.unstubAllGlobals();}
 });
});
