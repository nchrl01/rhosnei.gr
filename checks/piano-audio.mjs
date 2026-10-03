// A muted, isolated OfflineAudioContext render; this never uses a user's browser.
// Install Playwright separately or supply AV_PLAYWRIGHT_MODULE with its import path.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const {chromium}=await import(process.env.AV_PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../public/',import.meta.url));
const server=http.createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://offline').pathname);
  if(name==='/render'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Piano offline render</title>');return;}
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root)){res.writeHead(403).end();return;}
  const bytes=await fs.readFile(file);
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':'application/octet-stream');
  res.end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--mute-audio']});
 const page=await browser.newPage();
 // Rendering uses only local source and the licensed piano samples.
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/render`);
 const result=await page.evaluate(async()=>{
  const {createTradePiano}=await import('/trade-piano.js');
  async function render({pause=false,burst=false,sampleRate=48000}={}){
   const offline=new OfflineAudioContext(2,sampleRate*16,sampleRate);
   const context=new Proxy(offline,{get(target,key){
    if(key==='state')return 'running';
    const value=Reflect.get(target,key,target);
    return typeof value==='function'?value.bind(target):value;
   }});
   let notes=0;
   const piano=await createTradePiano(context,offline.destination,{onVoice:()=>notes++});
   piano.reset(1917);piano.setMaster(.5);piano.setRunning(true);
   const music={intensity:.4,tempo:70,character:'serene'};
   const accepted=piano.trade({id:'fixture-0',at:0,price:1.06,referencePrice:1,historical:true,volume:100},1000000,music);
   let transport;
   if(pause){transport=offline.suspend(2).then(()=>{piano.setRunning(false);return offline.resume();});}
   if(burst){
    // Each following 6% observation arrives on the actual rendering clock.
    let price=1.06;
    const waits=Array.from({length:8},(_,i)=>offline.suspend((i+1)*.9).then(()=>{
     price*=1.06;
     piano.trade({id:'fixture-'+(i+1),at:(i+1)*900,price,historical:true,volume:100},1000000,music);
     return offline.resume();
    }));
    transport=Promise.all(waits);
   }
   const buffer=await offline.startRendering();await transport;
   let peak=0,maxJump=0,finite=true,checksum=0;
   const windows=Array.from({length:16},(_,second)=>{
    let energy=0;
    for(let channel=0;channel<2;channel++){
     const data=buffer.getChannelData(channel);
     for(let i=second*sampleRate;i<(second+1)*sampleRate;i++){
      finite&&=Number.isFinite(data[i]);energy+=data[i]**2;
      peak=Math.max(peak,Math.abs(data[i]));
      if(i)maxJump=Math.max(maxJump,Math.abs(data[i]-data[i-1]));
      checksum+=data[i]*(1+i%31);
     }
    }
    return Math.sqrt(energy/(sampleRate*2));
   });
   piano.close();return {accepted,notes,finite,peak,maxJump,checksum,windows};
  }
  return {normal:await render(),repeat:await render(),paused:await render({pause:true}),burst:await render({burst:true}),highRate:await render({sampleRate:96000})};
 });
 for(const [name,render] of Object.entries(result)){
  assert.equal(render.accepted,true,name+' must accept the meaningful movement');
  assert.equal(render.finite,true,name+' must have finite audio');
  assert.ok(render.peak>.01&&render.peak<.7,name+' must be audible with mix headroom');
  assert.ok(render.maxJump<.04,name+' must not contain a sharp discontinuity');
 }
 assert.equal(result.normal.notes,1,'One selected observation must remain a single note');
 assert.ok(result.normal.windows[6]>.0005,'Ambient body must remain measurable six seconds later');
 assert.ok(result.normal.windows[14]<1e-7,'The finite room must eventually decay to silence');
 assert.equal(result.normal.checksum,result.repeat.checksum,'Replay must render the same seeded phrase');
 assert.ok(result.paused.windows.slice(3).every(rms=>rms<1e-7),'Pause must silence the entire room');
 assert.equal(result.burst.notes,9,'Spaced meaningful movements must keep sounding through voice replacement');
 console.log(JSON.stringify(result,null,2));
 console.log('PASS: actual sampled output, sustained finite room, stable replay, pause, bounded polyphony, 48/96 kHz.');
}finally{await browser?.close();server.close();}
