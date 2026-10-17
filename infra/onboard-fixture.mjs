import {readFile} from 'node:fs/promises';
const config=Object.fromEntries((await readFile('apps/api/.dev.vars','utf8')).split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
const deployment=JSON.parse(config.DEPLOYMENT_JSON||'{}');if(deployment.chainId!==31337)throw Error('Local fixtures are forbidden for testnet deployments');
const policy=await fetch('http://127.0.0.1:3890/policy').then(r=>r.json());
const r=await fetch('http://127.0.0.1:8787/admin/assets',{method:'POST',headers:{Authorization:'Bearer '+config.ADMIN_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(policy)});if(!r.ok)throw Error('Onboarding failed: '+r.status);process.stdout.write(JSON.stringify(await r.json())+'\n');
