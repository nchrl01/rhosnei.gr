// Operator-run scheduler: Wrangler local development does not execute cron.
import {readFile} from 'node:fs/promises';
const vars=Object.fromEntries((await readFile('apps/api/.dev.vars','utf8')).split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const api='http://127.0.0.1:8787';
const config=await fetch(api+'/v1/config').then(r=>r.json());
if(config.deployment?.chainId!==31337||config.deployment.mode!=='local')throw Error('Local scheduler only');
async function post(path,body={}){const r=await fetch(api+path,{method:'POST',headers:{Authorization:'Bearer '+vars.ADMIN_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Scheduler request failed: '+r.status);}
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
while(!stopping){try{
 if(process.argv.includes('--fixture')){const assets=await fetch(api+'/v1/assets').then(r=>r.json());for(const a of assets)if(a.token==='0x0000000000000000000000000000000000001111')await post('/admin/verify',{assetKey:a.asset_key});}
 await post('/admin/tick');process.stdout.write('Local background work scheduled.\n');
}catch(e){process.stderr.write(String(e)+'\n');}
 if(!stopping)await new Promise(r=>setTimeout(r,60000));
}
