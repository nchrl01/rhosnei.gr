import http from 'node:http';
import dgram from 'node:dgram';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('public'),port=Number(process.env.PORT)||4173;
const udp=dgram.createSocket('udp4');let lastPd=0;const pdState={};
udp.on('message',(data,remote)=>{if(remote.address!=='127.0.0.1')return;const text=data.toString().trim();if(text==='alive;')lastPd=Date.now();else{const match=text.match(/^(texture|tempo|master|run|av-dna) ([-+0-9.e]+);$/);if(match)pdState[match[1]]=Number(match[2]);}});
udp.on('error',e=>console.error('Pd bridge:',e.message));udp.bind(3002,'127.0.0.1');
const ranges={run:[0,1],tempo:[40,240],tonic:[24,96],seed:[0,16777215],activity:[0,1],motion:[0,1],energy:[0,1],balance:[0,1],texture:[0,1],melody:[0,1],pad:[0,1],space:[0,1],master:[0,.8],cutoff:[100,12000],heartbeat:[0,1]};
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.pd':'text/plain','.txt':'text/plain','.md':'text/plain','.zip':'application/zip'};
http.createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const connected=()=>Date.now()-lastPd<3000;
  if(path==='/pd/status'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({connected:connected(),state:pdState}));return;}
  if(path==='/pd/control'){
   // Browser requests must originate from this local page, never a remote website.
   if(req.method!=='POST'||!['http://localhost:'+port,'http://127.0.0.1:'+port].includes(req.headers.origin)){res.writeHead(403);res.end();return;}
   if(!connected()){res.writeHead(503);res.end('Open av-desktop.pd');return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>8192){res.writeHead(413);res.end();return;}}
   const {messages}=JSON.parse(body);
   if(!Array.isArray(messages)||messages.length>32)throw Error('Invalid controls');
   const commands=messages.map(item=>{if(!Array.isArray(item)||item.length!==2)throw Error('Invalid control');const [name,value]=item;const range=Object.hasOwn(ranges,name)?ranges[name]:null;if(!range||typeof value!=='number'||!Number.isFinite(value)||value<range[0]||value>range[1])throw Error('Invalid control');return name+' '+value+';';});
   for(const command of commands)await new Promise((resolve,reject)=>udp.send(command+'\n',3001,'127.0.0.1',e=>e?reject(e):resolve()));res.writeHead(204);res.end();return;
  }
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(data);
 }catch{res.writeHead(400);res.end('Invalid request or missing file');}
}).listen(port,'127.0.0.1',()=>console.log('AV + Native Pd bridge: http://localhost:'+port));
