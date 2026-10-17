import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const file=await readFile('.env.local-deploy','utf8');const env={...process.env,...Object.fromEntries(file.trim().split('\n').map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}))};
const result=spawnSync('forge',['script','script/Deploy.s.sol:Deploy','--rpc-url','http://127.0.0.1:8545','--broadcast'],{cwd:'contracts',env,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
const configure=spawnSync(process.execPath,['infra/local-setup.mjs','contracts/deployments/31337.json'],{stdio:'inherit'});process.exit(configure.status||0);
