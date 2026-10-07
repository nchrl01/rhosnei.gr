import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('public'),port=Number(process.env.PORT)||4173;
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.pd':'text/plain','.txt':'text/plain','.md':'text/plain','.zip':'application/zip','.wav':'audio/wav','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.wasm':'application/wasm'};
Object.assign(mime,{'.otf':'font/otf','.ttf':'font/ttf'});
http.createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(data);
 }catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end(error.code==='ENOENT'?'File not found':'Invalid request');}
}).listen(port,'127.0.0.1',()=>console.log('UPIC: http://localhost:'+port));
