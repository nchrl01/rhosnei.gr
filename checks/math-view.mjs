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
  if(name==='/check'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/math-pattern-view.css"><style>body{background:black;color:white;margin:16px}#view{width:100%;max-width:600px}</style><div id="view"></div>');return;}
  const file=path.resolve(root,'.'+name);if(!file.startsWith(root))throw Error('Path');const bytes=await fs.readFile(file);res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.AV_CHROMIUM_PATH||undefined,headless:true,args:['--mute-audio']});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/check');
  const result=await page.evaluate(async()=>{
   const {createMathPatternView}=await import('/math-pattern-view.js'),{mathIdentity}=await import('/math-patterns.js');
   const renderer=createMathPatternView(document.getElementById('view'));const profile=mathIdentity(517);
   const slots=profile.map(p=>({...p,enabled:true,performing:true,graphDomain:p.graphCache.domain,graphPoints:p.graphCache.points,graphCursor:{x:0,y:p.graph(0)},graphOverlays:p.graphCache.auxiliary.length?[{points:p.graphCache.auxiliary}]:[]}));
   renderer.update({seed:517,playing:true,globalEnabled:true,slots});
   const paths=[...document.querySelectorAll('.math-pattern-curve')],initial=paths.map(p=>p.getAttribute('d'));
   const initialVisible=[...document.querySelectorAll('.math-pattern-marker')].filter(n=>n.getAttribute('visibility')==='visible').length;
   let geometryWrites=0;const observer=new MutationObserver(changes=>{geometryWrites+=changes.filter(c=>c.attributeName==='d').length;});for(const p of paths)observer.observe(p,{attributes:true});
   for(let frame=0;frame<120;frame++)renderer.update({seed:517,playing:true,globalEnabled:true,slots:slots.map((slot,i)=>{const x=slot.graphDomain.xMin+(slot.graphDomain.xMax-slot.graphDomain.xMin)*frame/120;return {...slot,graphCursor:{x,y:profile[i].graph(x)}};})});
   await new Promise(resolve=>setTimeout(resolve,0));observer.disconnect();
   const stable=paths.every((p,i)=>p.getAttribute('d')===initial[i]);
   renderer.update({seed:517,playing:false,slots:slots.map(s=>({...s,performing:false}))});
   return {cards:document.querySelectorAll('.math-pattern-card:not([hidden])').length,formulaElements:document.querySelectorAll('.math-pattern-formula').length,hasEquationText:/y\s*=/.test(document.getElementById('view').textContent),finite:initial.every(d=>d&&!/NaN|Infinity/.test(d)),fullShapes:slots.every(s=>s.graphPoints.length>=2401),geometryWrites,stable,initialVisible,markersAfterPause:[...document.querySelectorAll('.math-pattern-marker')].filter(n=>n.getAttribute('visibility')==='visible').length,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.equal(result.cards,5);assert.equal(result.formulaElements,0);assert.equal(result.hasEquationText,false);assert.equal(result.finite,true);assert.equal(result.fullShapes,true);assert.equal(result.geometryWrites,0);assert.equal(result.stable,true);assert.ok(result.initialVisible>0);assert.equal(result.markersAfterPause,0);assert.equal(result.overflow,false);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,...result,errors}));await page.close();
 }
 console.log('PASS: desktop/mobile full geometry, no equations, finite curves, cached paths, moving markers and pause cleanup.');
}finally{await browser?.close();server.close();}
