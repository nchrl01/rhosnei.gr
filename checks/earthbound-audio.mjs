// Muted, isolated rendering of the shipped sampled engine. No user browser/device.
// AV_PLAYWRIGHT_MODULE and AV_CHROMIUM_EXECUTABLE may point to bundled runtimes.
// Optional args: market cap (default 1m), stress | arps | reset | pending | audition.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.AV_PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../public/',import.meta.url)),cap=Number(process.argv[2])||1e6,mode=process.argv[3]||'normal';
const server=http.createServer(async(req,res)=>{
 try{const name=decodeURIComponent(new URL(req.url,'http://offline').pathname);if(name==='/render'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>EarthBound offline measurement</title>');return;}const file=path.resolve(root,'.'+name);if(!file.startsWith(root)){res.writeHead(403).end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.AV_CHROMIUM_EXECUTABLE?{executablePath:process.env.AV_CHROMIUM_EXECUTABLE}:{}),args:['--mute-audio']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.stack));await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());await page.goto('http://127.0.0.1:'+server.address().port+'/render');
 const results=await page.evaluate(async({cap,mode})=>{
  // The real engine's scheduler is advanced on the offline audio clock, so
  // rendering speed cannot skip its 25ms arpeggio lookahead callbacks.
  const timers=new Map(),realSet=window.setInterval,realClear=window.clearInterval;let timerId=-1;
  window.setInterval=(fn,ms)=>{if(ms===25){const id=timerId--;timers.set(id,fn);return id;}return realSet(fn,ms);};window.clearInterval=id=>{if(timers.has(id))timers.delete(id);else realClear(id);};
  const {createTradePiano,EARTHBOUND_OUTPUT_GAIN}=await import('/trade-piano.js'),{EARTHBOUND_INSTRUMENTS,earthboundPreset}=await import('/earthbound-instruments.js');
  async function render(preset,kind){
   const rate=48000,seconds=kind==='arps'?14:8,offline=new OfflineAudioContext(4,rate*seconds,rate);
   const context=new Proxy(offline,{get(target,key){if(key==='state')return 'running';const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
   const tap=offline.createGain(),raw=offline.createChannelSplitter(2),main=offline.createGain(),limiter=offline.createDynamicsCompressor(),listen=offline.createGain(),out=offline.createChannelSplitter(2),merge=offline.createChannelMerger(4);
   // Main site's actual EarthBound bus2 × engine gain1.5, limiter, volume50%.
   main.gain.value=3;listen.gain.value=.5;limiter.threshold.value=0;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.12;
   tap.connect(raw);raw.connect(merge,0,0);raw.connect(merge,1,1);tap.connect(main);main.connect(limiter);limiter.connect(listen);listen.connect(out);out.connect(merge,0,2);out.connect(merge,1,3);merge.connect(offline.destination);
   let piano;const notes=[],arpNotes=[];
   try{
    let instrumentSeed=1917;if(kind==='reset'){instrumentSeed=0;while(earthboundPreset(instrumentSeed)!==preset)instrumentSeed++;}
    piano=await createTradePiano(context,tap,{onVoice:event=>notes.push(event),onArpeggio:event=>arpNotes.push(event)});piano.reset(instrumentSeed);piano.configure({preset,arpeggios:['arps','pending'].includes(kind)});piano.setMaster(1);piano.setRunning(true);
    const music={intensity:['arps','stress','pending'].includes(kind)?1:.4,activity:.6,tempo:['arps','pending'].includes(kind)?140:100,character:'hopeful',tonic:48};
    const event={id:kind+'-0',at:0,receivedAt:0,priceUsd:1.0001,referencePrice:1,volume:100,chordStep:0,historical:kind!=='live'};
    const selection={reason:'activity',changePct:.01,at:0,harmonyStep:0,harmonyCharacter:'hopeful'};
    const accepted=kind==='live'?piano.trade(event,cap,music):piano.replay(event,selection,cap,music);
    const initial=[];
    if(kind==='reset'){piano.reset(instrumentSeed);piano.configure({preset,arpeggios:false});piano.replay({...event,id:'immediate-restart'},selection,cap,music);initial.push(offline.suspend(.06).then(async()=>{await new Promise(resolve=>setTimeout(resolve,80));return offline.resume();}));}
    const checkpoints=kind==='stress'?Array.from({length:19},(_,i)=>(i+1)*.15):kind==='arps'?Array.from({length:Math.floor((seconds-.1)/.05)},(_,i)=>(i+1)*.05):kind==='audition'?[3,6]:kind==='reset'?[1.5,1.56,3,3.06,4.5,4.56]:kind==='pending'?[.05,.1,.15,.2,.26]:[];
    const pending=initial.concat(checkpoints.map((at,index)=>offline.suspend(at).then(async()=>{if(kind==='pending'){if(at<.2){for(const fn of timers.values())fn();}else if(at===.2){piano.reset(instrumentSeed);piano.setRunning(false);}else await new Promise(resolve=>setTimeout(resolve,80));}else if(kind==='arps'){for(const fn of timers.values())fn();}else if(kind==='reset'&&index%2){await new Promise(resolve=>setTimeout(resolve,80));}else{if(kind==='reset'){piano.reset(instrumentSeed);piano.configure({preset,arpeggios:false});}piano.replay({...event,id:kind+'-'+(index+1),chordStep:index+1},{...selection,at:at*1000},cap,music);}return offline.resume();})));
    const buffer=await offline.startRendering();await Promise.all(pending);
    const measure=channels=>{let peak=0,peakAt=0,finite=true;const windows=[];for(let second=0;second<seconds;second++){let energy=0;for(const channel of channels){const data=buffer.getChannelData(channel);for(let i=second*rate;i<(second+1)*rate;i++){finite&&=Number.isFinite(data[i]);if(Math.abs(data[i])>peak){peak=Math.abs(data[i]);peakAt=i/rate;}energy+=data[i]**2;}}windows.push(Math.sqrt(energy/(rate*channels.length)));}return {peak,peakAt,finite,firstSecondRms:windows[0],firstSecondDb:20*Math.log10(windows[0]),perSecondRms:windows};};
    const engine=measure([0,1]),listening=measure([2,3]);
    const result={preset,name:EARTHBOUND_INSTRUMENTS.find(instrument=>instrument.preset===preset).name,outputGain:EARTHBOUND_OUTPUT_GAIN,kind,accepted,notes:notes.length,arpNotes:arpNotes.length,harmonyIndices:notes.map(n=>n.harmony.index),engine,listening,preLimiterPeak:engine.peak*3,fullVolumeLimitedPeak:listening.peak*2};
    if(kind==='audition'){const pcm=new Int16Array(rate*seconds*2);for(let i=0;i<rate*seconds;i++)for(let channel=0;channel<2;channel++)pcm[i*2+channel]=Math.round(Math.max(-1,Math.min(1,buffer.getChannelData(channel+2)[i]))*32767);const bytes=new Uint8Array(pcm.buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));result.pcm=btoa(binary);result.rate=rate;}
    return result;
   }finally{piano?.close();}
  }
  try{const results=[];for(const item of ['audition','pending'].includes(mode)?EARTHBOUND_INSTRUMENTS.filter(i=>i.preset===146):EARTHBOUND_INSTRUMENTS){if(mode==='normal'){results.push(await render(item.preset,'live'));results.push(await render(item.preset,'replay'));}else results.push(await render(item.preset,mode));}return results;}finally{window.setInterval=realSet;window.clearInterval=realClear;}
 },{cap,mode});
 if(process.env.AV_AUDIO_EVIDENCE&&mode!=='audition')await fs.writeFile(process.env.AV_AUDIO_EVIDENCE,JSON.stringify({cap,mode,results},null,2));
 assert.deepEqual(errors,[],'Engine scheduling must not throw browser errors');
 for(const result of results){assert.equal(result.accepted,true,result.name+' must accept active trade');assert.ok(result.engine.finite&&result.listening.finite,result.name+' must produce finite samples');assert.ok(result.engine.firstSecondRms>.003,result.name+' must have measurable musical body');assert.ok(result.engine.peak<1,result.name+' must retain engine headroom');assert.ok(result.fullVolumeLimitedPeak<1,result.name+' must remain below full scale after the main limiter');assert.ok(result.harmonyIndices.every(i=>i===0),'Activity alone must retain the first harmony');if(mode==='stress'){assert.equal(result.notes,20);assert.ok(result.preLimiterPeak<.99,result.name+' must remain below full scale before limiting at maximum intensity');}if(mode==='arps')assert.ok(result.arpNotes>8,result.name+' must schedule a finite interlocking phrase');}
 if(mode==='normal')for(let i=0;i<results.length;i+=2)assert.ok(Math.abs(results[i].engine.firstSecondRms-results[i+1].engine.firstSecondRms)<1e-7,'Live and replay onsets must sound equivalent');
 if(mode==='pending'){assert.ok(results[0].arpNotes>0,'Fixture must schedule an arpeggio before cancelling it');assert.ok(results[0].engine.perSecondRms.slice(1).every(rms=>rms<1e-7),'Cancelling pending notes must leave no audible tail');}
 if(process.env.AV_AUDIO_EXAMPLE&&mode==='audition'){const r=results[0],pcm=Buffer.from(r.pcm,'base64'),header=Buffer.alloc(44);header.write('RIFF',0);header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(r.rate,24);header.writeUInt32LE(r.rate*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);await fs.mkdir(path.dirname(process.env.AV_AUDIO_EXAMPLE),{recursive:true});await fs.writeFile(process.env.AV_AUDIO_EXAMPLE,Buffer.concat([header,pcm]));delete r.pcm;}
 for(const result of results)delete result.pcm;
 const evidence={cap,mode,scope:'Actual sampled engine; raw stereo and website limiter/50% listening chain,isolatedOfflineAudioContext',results};if(process.env.AV_AUDIO_EVIDENCE)await fs.writeFile(process.env.AV_AUDIO_EVIDENCE,JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({pass:true,cap,mode,results:results.map(r=>({preset:r.preset,name:r.name,kind:r.kind,notes:r.notes,arpNotes:r.arpNotes,engineRmsDb:r.engine.firstSecondDb,enginePeak:r.engine.peak,preLimiterPeak:r.preLimiterPeak,fullVolumeLimitedPeak:r.fullVolumeLimitedPeak}))},null,2));
}finally{await browser?.close();server.close();}
