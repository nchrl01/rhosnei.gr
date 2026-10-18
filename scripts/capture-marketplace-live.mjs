// Capture the actual player. No simulated inputs, substituted artwork, or brightness changes.
// Examples: node scripts/capture-marketplace-live.mjs --limit 5
//           node scripts/capture-marketplace-live.mjs --ids hi,covenant-x402,jean-phil --timeout 180
//           UPIC_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/capture-marketplace-live.mjs --all
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,rename,stat,realpath} from 'node:fs/promises';
import {resolve,extname,dirname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {HOLDER_NETWORKS} from '../apps/web/public/holder-count-providers.js';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(project,'apps/web/public');
const manifestPath=resolve(root,'marketplace-preview-coins.json'),kind='live-player-frame-v1';
const options={limit:5,ids:null,timeout:180,concurrency:2,port:4173,all:false};
for(let i=2;i<process.argv.length;i++){
 const arg=process.argv[i];
 if(arg==='--all'||arg==='--all1000'){options.all=true;continue;}
 if(arg==='--help'){console.log('Usage: capture-marketplace-live.mjs [--limit 5 | --all] [--ids id,symbol,...] [--timeout seconds] [--concurrency 1|2] [--port 4173]\nUses UPIC_PLAYWRIGHT_MODULE when supplied. The default port matches the Worker localhost CORS policy.');process.exit(0);}
 const name=arg.slice(2);if(!arg.startsWith('--')||!['limit','ids','timeout','concurrency','port'].includes(name)||process.argv[i+1]===undefined)throw Error('Unknown or incomplete option: '+arg);
 const value=process.argv[++i];options[name]=name==='ids'?value.split(',').map(v=>v.trim()).filter(Boolean):Number(value);
}
for(const [name,min,max] of [['limit',1,10000],['timeout',1,3600],['concurrency',1,2],['port',1024,65535]])if(!Number.isInteger(options[name])||options[name]<min||options[name]>max)throw Error('Invalid --'+name);
const keyFor=(chain,address)=>chain+':'+(/^0x[\da-f]{40}$/i.test(address||'')?address.toLowerCase():address);
const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
const explorers=new Set(['ethereum','eth','base','arbitrum','optimism','polygon','polygon_pos','zksync','celo','robinhood']);
function supported(coin){
 if(!coin.address||!coin.chain)return false;
 if(coin.chain==='solana')return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(coin.address);
 return /^0x[\da-f]{40}$/i.test(coin.address)&&(explorers.has(coin.chain)||Boolean(HOLDER_NETWORKS[aliases[coin.chain]||coin.chain]));
}
const catalogue=JSON.parse(await readFile(resolve(root,'marketplace-coin-catalogue.json'),'utf8'));
if(!Array.isArray(catalogue.coins))throw Error('Invalid coin catalogue');
let candidates=catalogue.coins;
if(options.ids){candidates=options.ids.map(query=>{
 const exact=catalogue.coins.filter(c=>c.id===query||c.key===query);const matches=exact.length?exact:catalogue.coins.filter(c=>c.symbol?.toUpperCase()===query.toUpperCase());
 if(matches.length!==1)throw Error((matches.length?'Ambiguous':'Unknown')+' catalogue identity: '+query+'; use the CoinGecko id or chain/address key.');return matches[0];
 });}
const priority=['HI','COVENANT','JEANPHIL','PEPE','SHIB'];
const rank=c=>{const i=priority.indexOf(c.symbol);return i<0?priority.length:i;};
candidates=[...new Map(candidates.map(c=>[c.key,c])).values()].sort((a,b)=>rank(a)-rank(b)||Number(Boolean(b.featured))-Number(Boolean(a.featured))||(a.trendingRank||999)-(b.trendingRank||999)||(b.marketCap||0)-(a.marketCap||0));
const unsupported=candidates.filter(c=>!supported(c)).map(c=>({id:c.id,key:c.key,symbol:c.symbol,reason:c.address?'No observed-holder provider for this network/identifier':'No on-chain token identifier'}));
const supportedCoins=candidates.filter(supported),queue=options.all||options.ids&&!process.argv.includes('--limit')?supportedCoins:supportedCoins.slice(0,options.limit);
const manifest=new Map();
try{for(const frame of JSON.parse(await readFile(manifestPath,'utf8'))){if(frame?.captureKind===kind&&frame.key===keyFor(frame.chain,frame.address)&&Number.isFinite(frame.capturedAt)&&typeof frame.snapshot==='string'&&frame.snapshot.startsWith('images/marketplace/live/'))manifest.set(frame.key,frame);}}catch(error){if(error.code!=='ENOENT')throw error;}
const runId=randomUUID(),report={startedAt:new Date().toISOString(),requested:queue.length,unsupported,results:[]};
let persistence=Promise.resolve();
async function atomic(path,contents){const temporary=path+'.'+runId+'.tmp';await writeFile(temporary,contents);await rename(temporary,path);}
function persistManifest(){return atomic(manifestPath,JSON.stringify([...manifest.values()].sort((a,b)=>a.key.localeCompare(b.key)),null,2)+'\n');}
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
process.once('SIGINT',()=>{stopping=true;console.log('Stopping after current captures; saved frames will be retained.');});
try{
 const modulePath=process.env.UPIC_PLAYWRIGHT_MODULE||'playwright';
 const {chromium}=await import(modulePath.startsWith('/')?pathToFileURL(modulePath).href:modulePath);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+options.port;
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 await mkdir(resolve(root,'images/marketplace/live'),{recursive:true});
 // Legacy seed/neutral entries are not eligible shared live captures.
 await persistManifest();
 console.log('Capturing '+queue.length+' supported coins with '+options.concurrency+' isolated players; '+unsupported.length+' unsupported identities reported.');
 async function capture(coin){
  const expectedKey=keyFor(coin.chain,coin.address),started=Date.now(),errors=[];
  const context=await browser.newContext({viewport:{width:1280,height:1200},deviceScaleFactor:1});
  try{
   const page=await context.newPage();page.on('pageerror',error=>{if(errors.length<3)errors.push(error.message.slice(0,300));});
   const url=new URL('/',origin);url.search=new URLSearchParams({capture:'live',coin:coin.address,network:coin.chain,request:randomUUID()});
   await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:Math.min(45000,options.timeout*1000)});
   await page.waitForFunction(({expectedKey,kind,started})=>{const value=window.__upicLiveCapture,frame=value?.frame||value;return frame?.key===expectedKey&&frame.captureKind===kind&&frame.capturedAt>=started&&frame.blob instanceof Blob;},{expectedKey,kind,started},{timeout:Math.max(1,options.timeout*1000-(Date.now()-started)),polling:500});
   const captured=await page.evaluate(async()=>{
    const value=window.__upicLiveCapture,frame=value?.frame||value;
    const dataURL=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(frame.blob);});
    const {blob,...metadata}=frame;return {metadata,dataURL};
   });
   const frame=captured.metadata;
   if(frame.key!==expectedKey||frame.chain!==coin.chain||keyFor(frame.chain,frame.address)!==expectedKey||frame.captureKind!==kind||!Number.isFinite(frame.capturedAt)||frame.capturedAt<started||frame.capturedAt>Date.now()+1000)throw Error('Capture identity or render timestamp failed validation');
   if(typeof captured.dataURL!=='string'||!captured.dataURL.startsWith('data:image/webp;base64,'))throw Error('Capture did not contain original WebP pixels');
   const bytes=Buffer.from(captured.dataURL.slice(captured.dataURL.indexOf(',')+1),'base64');
   if(bytes.length<20||bytes.length>750000||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Invalid capture image');
   let outcome;
   const work=persistence.then(async()=>{
    const previous=manifest.get(expectedKey);if(previous?.capturedAt>=frame.capturedAt){outcome={id:coin.id,key:expectedKey,state:'retained-newer',capturedAt:previous.capturedAt};return;}
    const hash=createHash('sha256').update(expectedKey).digest('hex').slice(0,24),asset='images/marketplace/live/'+hash+'-'+frame.capturedAt+'.webp';
    await atomic(resolve(root,asset),bytes);
    const metadata={key:expectedKey,id:coin.id,chain:frame.chain,address:frame.address,symbol:coin.symbol,name:coin.name,captureKind:kind,capturedAt:frame.capturedAt,source:'Live UPIC player frame',snapshot:asset};
    for(const key of ['marketCap','liquidity','holders','holderFetchedAt','marketObservedAt','coverage','pairAddress','renderedAt'])if(frame[key]!==undefined)metadata[key]=frame[key];
    manifest.set(expectedKey,metadata);await persistManifest();outcome={id:coin.id,key:expectedKey,state:'captured',capturedAt:frame.capturedAt,asset};
   });persistence=work.catch(()=>{});await work;report.results.push(outcome);console.log(coin.symbol+' '+outcome.state);
  }catch(error){const previous=manifest.get(expectedKey);report.results.push({id:coin.id,key:expectedKey,state:previous?'retained-previous':'unavailable',capturedAt:previous?.capturedAt??null,error:String(error.message||error).slice(0,500),pageErrors:errors});console.log(coin.symbol+' '+(previous?'retained previous live capture':'no live capture')+': '+String(error.message||error).split('\n')[0]);}
  finally{await context.close();}
 }
 await Promise.all(Array.from({length:options.concurrency},async()=>{while(!stopping){const coin=queue[next++];if(!coin)return;await capture(coin);}}));
 await persistence;
 report.completedAt=new Date().toISOString();report.notAttempted=queue.slice(Math.min(next,queue.length)).map(c=>c.id);
 const reportPath=resolve(project,'scripts/data/marketplace-live-capture-report.json');await mkdir(dirname(reportPath),{recursive:true});await atomic(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log('Finished: '+report.results.filter(r=>r.state==='captured').length+' new captures; '+report.results.filter(r=>r.state==='unavailable').length+' unavailable. Report: '+reportPath);
}catch(error){console.error(String(error.message||error));process.exitCode=1;}
finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
