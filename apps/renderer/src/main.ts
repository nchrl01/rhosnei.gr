import {createServer} from 'node:http';import {readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';import {resolve,extname} from 'node:path';import {spawn} from 'node:child_process';
import {chromium} from 'playwright';import type {ArtworkInput,Job} from '@upic/domain';import {ENGINE_VERSION,assertArtwork} from '@upic/domain';
const API=process.env.UPIC_API_URL||'http://127.0.0.1:8787',TOKEN=process.env.RENDERER_TOKEN||'',IPFS=process.env.IPFS_API||'http://127.0.0.1:5001';
// Behind Cloudflare Access (private staging), every API call also carries the CI service token.
const ACCESS:Record<string,string>=process.env.CF_ACCESS_CLIENT_ID?{'CF-Access-Client-Id':process.env.CF_ACCESS_CLIENT_ID,'CF-Access-Client-Secret':process.env.CF_ACCESS_CLIENT_SECRET||''}:{};
const root=resolve(process.env.REPO_ROOT||'../..'),artifacts=resolve(process.env.ARTIFACTS_DIR||root+'/artifacts');
if(TOKEN.length<32)throw Error('Configure RENDERER_TOKEN');
const configuration=await fetch(API+'/v1/config',{headers:ACCESS}).then(r=>{if(!r.ok)throw Error('API config '+r.status+(r.status===403||r.status===302?' (check CF_ACCESS_CLIENT_ID/SECRET)':''));return r.json();}) as {deployment:{mode:string}};
const localMode=configuration.deployment.mode==='local';
const local=createServer(async(req,res)=>{try{const path=new URL(req.url||'/', 'http://localhost').pathname;if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><script src="/renderer.js"></script>');return;}
 const base=path==='/renderer.js'?root+'/apps/renderer/dist':root+'/apps/web/public';const file=resolve(base,'.'+path);if(!file.startsWith(resolve(base)+'/'))throw Error('path');
 res.setHeader('Content-Type',({'.js':'text/javascript','.wav':'audio/wav','.wasm':'application/wasm'} as Record<string,string>)[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise<void>(r=>local.listen(8790,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage','--no-sandbox']});
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
async function request(path:string,body:unknown){const r=await fetch(API+path,{method:'POST',headers:{...ACCESS,Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('API '+r.status);return r.json();}
async function run(cmd:string,args:string[]){await new Promise<void>((resolve,reject)=>{const p=spawn(cmd,args,{stdio:['ignore','ignore','pipe']});let error='';p.stderr.on('data',v=>{error=(error+v).slice(-2000);});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error('Encoder failed: '+error)));});}
async function pin(name:string,data:Uint8Array,mime:string){
 // Preserve a local pin even when remote publication fails.
 const localForm=new FormData();localForm.append('file',new Blob([data as Uint8Array<ArrayBuffer>],{type:mime}),name);
 const localResult=await fetch(IPFS+'/api/v0/add?cid-version=1&pin=true',{method:'POST',body:localForm});if(!localResult.ok)throw Error('Local IPFS pin failed');const cid=(await localResult.json() as {Hash:string}).Hash;
 if(localMode)return 'ipfs://'+cid;
 if(!process.env.PINATA_JWT)throw Error('PINATA_JWT is required for public testnet archives');
 await request('/internal/storage/reserve',{bytes:data.length,files:1});
 const form=new FormData();form.append('file',new Blob([data as Uint8Array<ArrayBuffer>],{type:mime}),name);form.append('pinataOptions',JSON.stringify({cidVersion:1}));
 const remote=await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS',{method:'POST',headers:{Authorization:'Bearer '+process.env.PINATA_JWT},body:form});if(!remote.ok)throw Error('Remote pin failed');
 const hash=(await remote.json() as {IpfsHash:string}).IpfsHash;if(hash!==cid)throw Error('IPFS CID mismatch');return 'ipfs://'+cid;
}
async function render(job:Job){
 const payload=job.payload,input=payload.input as ArtworkInput;assertArtwork(input);
 const folder=resolve(artifacts,job.id);await mkdir(folder,{recursive:true});
 const page=await browser.newPage({viewport:{width:2048,height:2048},deviceScaleFactor:1});
 try{
  await page.goto('http://127.0.0.1:8790');await page.waitForFunction(()=>Boolean(window.upicRender));await page.evaluate(v=>window.upicRender.set(v),input);
  await page.evaluate(()=>window.upicRender.frame(0,2048));await page.locator('canvas').screenshot({path:folder+'/poster.png'});
  const sound=await page.evaluate(()=>window.upicRender.audio());await writeFile(folder+'/audio.wav',Uint8Array.from(sound));
  await page.setViewportSize({width:720,height:720});
  for(let i=0;i<input.seconds*24;i++){await page.evaluate(t=>window.upicRender.frame(t,720),i/24);await page.locator('canvas').screenshot({path:folder+'/frame-'+String(i).padStart(4,'0')+'.png'});}
  await run('ffmpeg',['-y','-framerate','24','-i',folder+'/frame-%04d.png','-i',folder+'/audio.wav','-t','20','-c:v','libx264','-pix_fmt','yuv420p','-crf','28','-c:a','aac','-b:a','128k','-movflags','+faststart',folder+'/preview.mp4']);
  const image=await pin('poster.png',await readFile(folder+'/poster.png'),'image/png'),video=await pin('preview.mp4',await readFile(folder+'/preview.mp4'),'video/mp4');
  const manifestValue={engine_version:ENGINE_VERSION,input,evidence_uri:payload.evidenceURI,renderer:'chromium-141-playwright-1.56.1-ffmpeg',frame_rate:24};
  const manifest=await pin('manifest.json',new TextEncoder().encode(JSON.stringify(manifestValue)),'application/json');
  const metadata={name:String(payload.name)+' #'+String(payload.edition).padStart(3,'0'),description:localMode?'LOCAL TEST FIXTURE — no real blockchain milestone is claimed.':'Autonomous market-responsive UPIC artwork. Blockchain reconstruction is attested by an authorized verifier.',edition:payload.edition,genesis:Number(payload.edition)===1,seed:input.seed,stage:input.stage,engine_version:ENGINE_VERSION,source_chain:input.frames[0]!.chain,source_token:input.frames[0]!.token,highest_verified_cap_usd8:payload.verifiedCapUsd8,image,animation_url:video,external_url:payload.externalURL,manifest,evidence_uri:payload.evidenceURI,attributes:[{trait_type:'Edition',value:payload.edition},{trait_type:'Evolution stage',value:input.stage},{trait_type:'Genesis',value:Number(payload.edition)===1},{trait_type:'Source chain',value:input.frames[0]!.chain}]};
  const uri=await pin('metadata.json',new TextEncoder().encode(JSON.stringify(metadata)),'application/json');
  await request('/internal/render/'+job.id+'/complete',{lease:job.lease_token,result:{uri,image,animation_url:video,manifest}});
  for(let i=0;i<input.seconds*24;i++)await rm(folder+'/frame-'+String(i).padStart(4,'0')+'.png');
 }finally{await page.close();}
}
while(!stopping){let job:Job|null=null;try{job=await request('/internal/render/claim',{}) as Job|null;if(job)await render(job);}catch(error){process.stderr.write('Render job failed: '+(error instanceof Error?error.message:'unknown')+'\n');if(job)await request('/internal/render/'+job.id+'/fail',{lease:job.lease_token}).catch(()=>{});}if(!job)await new Promise(r=>setTimeout(r,5000));}
await browser.close();await new Promise<void>(r=>local.close(()=>r()));
