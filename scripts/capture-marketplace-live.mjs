import {collectiblePreview,genesisCollectibles} from '../apps/web/public/collectible-selection.js';
import {NATIVE_CONTRACT_REFERENCES} from '../apps/web/public/native-contracts.js';
import {captureFetch} from './capture-network.mjs';
import {catalogueNative,NATIVE_COINS} from '../apps/web/public/native-coins.js';
import {compareCoinNetworks,supportedCoinNetwork} from '../apps/web/public/coin-network-choice.js';
// Capture the actual player with current provider inputs and unmodified WebP pixels.
// Local runs write development artifacts under the system temporary directory.
// --publish (or CI=true) writes to the shared Cloudflare store using GitHub OIDC.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,stat,realpath} from 'node:fs/promises';
import {resolve,extname,dirname,sep,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(project,'apps/web/public');
const endpoint='https://upic-insightx.nchrl01.workers.dev/coin-captures',kind='live-player-frame-v1';
const options={limit:20,ids:null,timeout:120,concurrency:2,port:4173,all:false,top1000:false,part:0,publish:['true','1'].includes(process.env.CI),dryRun:false,checkPublisher:false,contractsOnly:false,collectibles:false};
for(let i=2;i<process.argv.length;i++){
 const arg=process.argv[i];
 if(arg==='--collectibles'){options.collectibles=true;options.contractsOnly=true;continue;}
 if(arg==='--contracts-only'){options.contractsOnly=true;continue;}
 if(arg==='--all'){options.all=true;continue;}
 if(arg==='--top1000'||arg==='--all1000'){options.top1000=true;options.all=true;continue;}
 if(arg==='--publish'){options.publish=true;continue;}
 if(arg==='--check-publisher'){options.checkPublisher=true;options.publish=true;continue;}
 if(arg==='--dry-run'){options.dryRun=true;continue;}
 if(arg==='--help'){console.log('Usage: capture-marketplace-live.mjs [--collectibles | --contracts-only] [--limit 20 | --all] [--ids id,chain:address,...] [--timeout seconds] [--concurrency 1|2] [--port 4173] [--publish] [--dry-run] [--check-publisher] [--top1000 --part 1..4]\nUses UPIC_PLAYWRIGHT_MODULE when supplied. Publishing requires GitHub Actions OIDC; local artifacts stay in a temporary directory.');process.exit(0);}
 const name=arg.slice(2);if(!arg.startsWith('--')||!['limit','ids','timeout','concurrency','port','part'].includes(name)||process.argv[i+1]===undefined)throw Error('Unknown or incomplete option: '+arg);
 const value=process.argv[++i];options[name]=name==='ids'?value.split(',').map(v=>v.trim()).filter(Boolean):Number(value);
}
for(const [name,min,max] of [['limit',1,10000],['timeout',1,3600],['concurrency',1,2],['port',1024,65535],['part',0,4]])if(!Number.isInteger(options[name])||options[name]<min||options[name]>max)throw Error('Invalid --'+name);
const keyFor=(chain,address)=>chain+':'+(/^0x[\da-f]{40}$/i.test(address||'')?address.toLowerCase():address);
function supported(coin){
 if(coin.address==='native'||coin.address?.startsWith('native:'))return catalogueNative(coin)?.address===coin.address;
 if(!coin.address||!coin.chain||coin.contractStatus==='off-chain')return false;
 return supportedCoinNetwork(coin,coin);
}
const catalogue=JSON.parse(await readFile(resolve(root,'marketplace-coin-catalogue.json'),'utf8'));
if(!Array.isArray(catalogue.coins))throw Error('Invalid coin catalogue');
// Every candidate comes from the bundled exact identity list, including alternate networks.
const identities=new Map();
for(const coin of catalogue.coins)for(const item of [catalogueNative(coin)||{},{chain:coin.chain,address:coin.address},...(coin.platforms||[])]){
 if(!item.chain||!item.address)continue;const key=keyFor(item.chain,item.address);
 if(!identities.has(key))identities.set(key,{...coin,...item,key});
}
let candidates=[...identities.values()].filter(c=>(!options.top1000||c.top1000)&&(!options.part||Math.ceil(c.catalogueRank/250)===options.part));
if(options.contractsOnly)candidates=candidates.filter(coin=>{
 const ref=Object.hasOwn(NATIVE_CONTRACT_REFERENCES,coin.id)?NATIVE_CONTRACT_REFERENCES[coin.id]:null;
 if(ref)return keyFor(coin.chain,coin.address)===keyFor(ref.chain,ref.address);
 return coin.address&&coin.address!=='native'&&!coin.address.startsWith('native:')&&coin.contractStatus!=='off-chain';
});
if(options.collectibles){
 const targets=new Set(genesisCollectibles(catalogue.coins).map(c=>collectiblePreview(c).selection?.key).filter(Boolean));
 candidates=candidates.filter(c=>targets.has(c.key));
}
if(options.ids){
 const selected=new Map();
 for(const query of options.ids){
  const exactIdentity=identities.get(query);if(exactIdentity){if(options.contractsOnly&&!candidates.some(c=>c.key===query))throw Error('A contract identity is required in contracts-only mode: '+query);selected.set(query,exactIdentity);continue;}
  const exact=catalogue.coins.filter(c=>c.id===query||c.key===query),matches=exact.length?exact:catalogue.coins.filter(c=>c.symbol?.toUpperCase()===query.toUpperCase());
  if(matches.length!==1)throw Error((matches.length?'Ambiguous':'Unknown')+' catalogue identity: '+query+'; use the CoinGecko id or chain/address key.');
  for(const coin of candidates)if(coin.id===matches[0].id)selected.set(coin.key,coin);
 }
 candidates=[...selected.values()];
}
const manifest=new Map();
async function loadManifest(){
 let cursor=null;const seen=new Set();
 do{
  const url=new URL(endpoint);if(cursor)url.searchParams.set('cursor',cursor);
  const response=await captureFetch(url);if(!response.ok)throw Error('Cloud capture metadata HTTP '+response.status);
  const body=await response.json();if(!Array.isArray(body.captures))throw Error('Invalid cloud capture metadata');
  for(const frame of body.captures)if(frame?.captureKind===kind&&frame.key===keyFor(frame.chain||frame.network,frame.address)&&identities.has(frame.key)&&Number.isFinite(frame.capturedAt))manifest.set(frame.key,frame);
  cursor=body.nextCursor||null;if(cursor){if(seen.has(cursor)||seen.size>=20)throw Error('Invalid cloud capture pagination');seen.add(cursor);}
 }while(cursor);
}
try{await loadManifest();}catch(error){if(options.publish&&!options.dryRun)throw error;console.log(String(error.message)+'; local run will not assume existing captures.');}
const unsupported=candidates.filter(c=>!supported(c)).map(c=>({id:c.id,key:c.key,symbol:c.symbol,reason:'No observed-holder provider for this network/identifier'}));
const supportedCoins=candidates.filter(supported),priority=['HI','COVENANT','JEANPHIL','PEPE','SHIB'];
const priorityFor=c=>{const index=priority.indexOf(c.symbol);return index<0?priority.length:index;};
const missing=supportedCoins.filter(c=>!manifest.has(c.key)).sort((a,b)=>priorityFor(a)-priorityFor(b)||(a.rank||10001)-(b.rank||10001)||a.key.localeCompare(b.key));
const preferred=new Map(),coveredCoins=new Set([...manifest.keys()].map(key=>identities.get(key)?.id));
for(const coin of supportedCoins){const current=preferred.get(coin.id),primary=catalogue.coins.find(c=>c.id===coin.id);if(!current||compareCoinNetworks(primary,{...coin,...manifest.get(coin.key)},{...current,...manifest.get(current.key)})<0)preferred.set(coin.id,coin);}
const uncovered=missing.filter(c=>!coveredCoins.has(c.id)&&preferred.get(c.id)?.key===c.key),alternate=missing.filter(c=>!uncovered.includes(c));
// Captures that do not exist share the oldest timestamp. Rotate that tie hourly
// so an unavailable provider cannot monopolize every scheduled batch.
const rotate=rows=>{const offset=rows.length&&!options.ids&&process.env.GITHUB_EVENT_NAME==='schedule'?Math.floor(Date.now()/3600000)*options.limit%rows.length:0;return [...rows.slice(offset),...rows.slice(0,offset)];};
const missingQueue=[...rotate(uncovered),...rotate(alternate)],existing=supportedCoins.filter(c=>manifest.has(c.key)).sort((a,b)=>manifest.get(a.key).capturedAt-manifest.get(b.key).capturedAt||a.key.localeCompare(b.key));
let pending=[...missingQueue,...existing];
if(!options.ids&&!options.all&&!options.collectibles){
 // Reserve half of scheduled and manual batches for refreshes; failed first captures must never
 // prevent existing shared frames from receiving newer observed inputs.
 const stale=existing.filter(c=>manifest.get(c.key).capturedAt<Date.now()-3600000),refresh=stale.slice(0,Math.ceil(options.limit/2));
 pending=[...refresh,...missingQueue.slice(0,options.limit-refresh.length),...stale.slice(refresh.length)];
}
if(options.top1000){
 const ordered=[...uncovered,...[...preferred.values()].filter(c=>!uncovered.some(row=>row.id===c.id)).sort((a,b)=>(manifest.get(a.key)?.capturedAt||0)-(manifest.get(b.key)?.capturedAt||0))];
 pending=ordered;
}
const queue=options.all||options.ids&&!process.argv.includes('--limit')?pending:pending.slice(0,options.limit);
const supportedCatalogueIDs=new Set([...identities.values()].filter(supported).map(c=>c.id));
const unsupportedCoins=catalogue.coins.filter(c=>(!options.top1000||c.top1000)&&!supportedCatalogueIDs.has(c.id)).map(c=>({id:c.id,symbol:c.symbol,reason:c.contractStatus==='off-chain'?'Off-chain exchange product':c.address||c.platforms?.length?'No observed-holder provider for the listed identifiers':'Native coin without an issued token identifier'}));
if(options.dryRun){await new Promise(done=>process.stdout.write(JSON.stringify({catalogueCoins:catalogue.coins.filter(c=>!options.top1000||c.top1000).length,unavailableCoins:unsupportedCoins.length,allowedIdentities:identities.size,supportedIdentities:supportedCoins.length,supportedCoins:preferred.size,existingCaptures:manifest.size,requested:queue.length,publishing:options.publish,selected:queue.map(c=>({id:c.id,key:c.key,capturedAt:manifest.get(c.key)?.capturedAt??null})),unsupported:unsupported.length},null,2)+'\n',done));process.exit(0);}
if(options.publish&&(!process.env.ACTIONS_ID_TOKEN_REQUEST_URL||!process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN))throw Error('Publishing requires GitHub Actions OIDC credentials; use a local run without --publish for development.');
let oidc=null;
async function publisherToken(force=false){
 if(!force&&oidc?.until>Date.now())return oidc.value;
 const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set('audience','upic-live-captures');
 const response=await captureFetch(url,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}});
 if(!response.ok)throw Error('GitHub publisher identity unavailable (HTTP '+response.status+')');
 const body=await response.json();if(typeof body.value!=='string'||body.value.split('.').length!==3)throw Error('Invalid GitHub publisher identity');
 // Refresh well before token expiry and the server's maximum identity age.
 let expiry=Date.now()+240000;try{expiry=Math.min(expiry,JSON.parse(Buffer.from(body.value.split('.')[1],'base64url').toString()).exp*1000-60000);}catch{}
 oidc={value:body.value,until:expiry};return oidc.value;
}
async function serverError(response){
 // Only expose a small JSON error from our endpoint, never an HTML response,
 // credentials, response headers, or an unbounded server body.
 if(!response.headers.get('content-type')?.includes('application/json'))return '';
 const reader=response.body?.getReader();if(!reader)return '';
 try{
  const chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return '';}chunks.push(value);}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(typeof data.error!=='string')return '';
  let message=data.error;for(const value of [oidc?.value,process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN])if(value)message=message.split(value).join('[redacted]');
  message=message.replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g,'[redacted]').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
  return message?': '+message:'';
 }catch{return '';}
 finally{reader.releaseLock();}
}
async function checkPublisher(){
 const token=await publisherToken(),response=await captureFetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'},{timeoutMs:30000});
 // Authentication runs before payload validation. An empty body must reach
 // validation (400), without writing an image or requiring a browser.
 if(response.status!==400)throw Error('Cloud publisher preflight failed (HTTP '+response.status+')'+await serverError(response));
 console.log('Cloud publisher preflight passed: authenticated request reached capture validation.');
}
async function publish(metadata,bytes){
 for(let attempt=0;attempt<2;attempt++){
  const token=await publisherToken(attempt>0),response=await captureFetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({metadata,imageBase64:bytes.toString('base64')})},{timeoutMs:30000});
  if(response.status===401&&attempt===0)continue;
  if(response.status===409)return {state:'retained-newer'};
  if(!response.ok)throw Error('Cloud publication failed (HTTP '+response.status+')'+await serverError(response));
  return {state:'published'};
 }
 throw Error('Cloud publisher identity rejected');
}
if(options.checkPublisher){await checkPublisher();process.exit(0);}
const output=process.env.UPIC_CAPTURE_OUTPUT_DIR?resolve(process.env.UPIC_CAPTURE_OUTPUT_DIR):await mkdtemp(join(tmpdir(),'upic-live-captures-'));
await mkdir(output,{recursive:true});
const report={startedAt:new Date().toISOString(),publishing:options.publish,contractsOnly:options.contractsOnly,collectibles:options.collectibles,allowedIdentities:identities.size,supportedIdentities:supportedCoins.length,supportedCoins:preferred.size,requested:queue.length,unsupported,unsupportedCoins,results:[]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.woff':'font/woff','.woff2':'font/woff2','.wasm':'application/wasm','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let path=resolve(root,'.'+(pathname==='/'?'/instrument.html':pathname));
  if(path!==root&&!path.startsWith(root+sep))throw Error('Invalid path');
  if((await stat(path)).isDirectory())path=resolve(path,'index.html');
  path=await realpath(path);if(!path.startsWith(root+sep))throw Error('Invalid path');
  const body=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store','Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
let browser,stopping=false,next=0;
process.once('SIGINT',()=>{stopping=true;console.log('Stopping after current captures; published frames will be retained.');});
try{
 const modulePath=process.env.UPIC_PLAYWRIGHT_MODULE||'playwright';
 const {chromium}=await import(modulePath.startsWith('/')?pathToFileURL(modulePath).href:modulePath);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+options.port;
 // HTTPS requests are fulfilled below; localhost and live socket connections
 // retain their normal browser transport.
 browser=await chromium.launch({headless:true,executablePath:process.env.UPIC_CAPTURE_EXECUTABLE||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 console.log('Capturing '+queue.length+' exact identities with '+options.concurrency+' isolated players; '+unsupported.length+' unsupported identities reported.');
 async function capture(coin){
  const expectedKey=keyFor(coin.chain,coin.address),started=Date.now(),errors=[];
  let page;const context=await browser.newContext({viewport:{width:1280,height:1200},deviceScaleFactor:1,serviceWorkers:'block'});
  try{
   // Match all requests: https://** does not cover paths reliably. Local files
   // use the local server; public HTTPS is forwarded without substituting data.
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin)return route.continue();
    if(url.protocol!=='https:')return route.abort();
    const headers={...request.headers()};for(const name of ['host','connection','content-length','accept-encoding'])delete headers[name];
    try{
     const response=await fetch(url,{method:request.method(),headers,body:['GET','HEAD'].includes(request.method())?undefined:request.postDataBuffer(),signal:AbortSignal.timeout(25000)});
     const incoming=Object.fromEntries(response.headers);delete incoming['content-encoding'];delete incoming['content-length'];incoming['access-control-allow-origin']=origin;
     await route.fulfill({status:response.status,headers:incoming,body:Buffer.from(await response.arrayBuffer())});
    }catch{await route.abort().catch(()=>{});}
   });
   page=await context.newPage();page.on('pageerror',error=>{if(errors.length<3)errors.push(error.message.slice(0,300));});
   const url=new URL('/',origin);url.search=new URLSearchParams({capture:'live',coin:coin.address==='native'||coin.address?.startsWith('native:')?coin.symbol+'/USD':coin.address,...((coin.address==='native'||coin.address?.startsWith('native:'))?{native:coin.id}:{network:coin.chain}),request:randomUUID()});
   await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:Math.min(45000,options.timeout*1000)});
   await page.waitForFunction(({expectedKey,kind,started})=>{const value=window.__upicLiveCapture,frame=value?.frame||value;return frame?.key===expectedKey&&frame.captureKind===kind&&frame.capturedAt>=started&&frame.blob instanceof Blob;},{expectedKey,kind,started},{timeout:Math.max(1,options.timeout*1000-(Date.now()-started)),polling:500});
   const captured=await page.evaluate(async()=>{
    const value=window.__upicLiveCapture,frame=value?.frame||value;
    const dataURL=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(frame.blob);});
    const {blob,...metadata}=frame;return {metadata,dataURL};
   });
   const frame=captured.metadata;
   if(frame.key!==expectedKey||frame.chain!==coin.chain||keyFor(frame.chain,frame.address)!==expectedKey||frame.captureKind!==kind||!Number.isSafeInteger(frame.capturedAt)||frame.capturedAt<started||frame.capturedAt>Date.now()+1000)throw Error('Capture identity or render timestamp failed validation');
   if(typeof captured.dataURL!=='string'||!captured.dataURL.startsWith('data:image/webp;base64,'))throw Error('Capture did not contain original WebP pixels');
   const bytes=Buffer.from(captured.dataURL.slice(captured.dataURL.indexOf(',')+1),'base64');
   if(bytes.length<20||bytes.length>750000||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Invalid capture image');
   const metadata={key:expectedKey,id:coin.id,chain:frame.chain,address:frame.address,symbol:coin.symbol,name:coin.name,captureKind:kind,capturedAt:frame.capturedAt};
   for(const key of ['marketCap','liquidity','holders','holderFetchedAt','marketObservedAt','coverage','pairAddress','renderedAt','imageAvailable'])if(frame[key]!==undefined)metadata[key]=frame[key];
   // Only the renderer can fingerprint the complete observed inputs. Aggregate
   // market metrics alone would miss changes in the actual wallet distribution.
   if(/^[\da-f]{64}$/i.test(frame.sourceDataHash||''))metadata.sourceDataHash=frame.sourceDataHash.toLowerCase();
   let outcome;
   if(options.publish)outcome=await publish(metadata,bytes);
   else{
    const name=createHash('sha256').update(expectedKey).digest('hex').slice(0,24)+'-'+frame.capturedAt+'.webp';
    await writeFile(resolve(output,name),bytes);await writeFile(resolve(output,name+'.json'),JSON.stringify(metadata,null,2)+'\n');
    outcome={state:'captured',artifact:name};
   }
   manifest.set(expectedKey,metadata);report.results.push({id:coin.id,key:expectedKey,...outcome,capturedAt:frame.capturedAt,bytes:bytes.length});console.log(coin.symbol+' '+coin.chain+' '+outcome.state);return true;
  }catch(error){
   let playerStatus=null;try{playerStatus=await page?.evaluate(()=>window.__upicCaptureStatus?.()||null);}catch{}
   const previous=manifest.get(expectedKey);report.results.push({id:coin.id,key:expectedKey,state:previous?'retained-previous':'unavailable',capturedAt:previous?.capturedAt??null,error:String(error.message||error).slice(0,500),pageErrors:errors,playerStatus});
   console.log(coin.symbol+' '+coin.chain+' '+(previous?'retained previous live capture':'no live capture')+': '+String(error.message||error).split('\n')[0]);return false;
  }finally{await context.close();}
 }
 await Promise.all(Array.from({length:options.concurrency},async()=>{while(!stopping){const coin=queue[next++];if(!coin)return;const captured=await capture(coin);if(options.top1000&&!captured&&!stopping){const primary=catalogue.coins.find(c=>c.id===coin.id);for(const alternative of supportedCoins.filter(c=>c.id===coin.id&&c.key!==coin.key).sort((a,b)=>compareCoinNetworks(primary,{...a,...manifest.get(a.key)},{...b,...manifest.get(b.key)})).slice(0,2)){if(await capture(alternative))break;}}}}));
}catch(error){console.error(String(error.message||error));process.exitCode=1;}
finally{
 await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));
 report.completedAt=new Date().toISOString();report.notAttempted=queue.slice(Math.min(next,queue.length)).map(c=>c.key);
 const reportPath=resolve(output,'report.json');await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 const completed=report.results.filter(r=>['captured','published'].includes(r.state)).length,unavailable=report.results.filter(r=>r.state==='unavailable').length;
 console.log('Finished: '+completed+' new captures; '+unavailable+' unavailable. Report: '+reportPath);
 if(options.publish&&queue.length&&!completed&&!report.results.some(r=>r.state==='retained-newer'))process.exitCode=1;
 if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,'## Shared live captures\n\n'+completed+' published; '+unavailable+' unavailable; '+report.results.filter(r=>r.state==='retained-previous').length+' previous frames retained.\n\nAttempted '+report.results.length+' of '+queue.length+' selected exact catalogue identities.\n',{flag:'a'});
}
