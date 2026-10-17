import {readFile,writeFile} from 'node:fs/promises';import {randomBytes,createHmac} from 'node:crypto';import {mnemonicToAccount} from 'viem/accounts';
const mnemonic='test test test test test test test test test test test junk';
const accounts=Array.from({length:4},(_,i)=>mnemonicToAccount(mnemonic,{addressIndex:i}));
const secret=()=>randomBytes(32).toString('hex');const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const payload=encode({alg:'HS256',typ:'JWT'})+'.'+encode({role:'service_role',exp:Math.floor(Date.now()/1000)+86400*30});
const jwt=payload+'.'+createHmac('sha256','local-development-secret-only-at-least-32-characters').update(payload).digest('base64url');
let old='';try{old=await readFile('apps/api/.dev.vars','utf8');}catch{}
const prior=Object.fromEntries(old.split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
let deployment={};const manifest=process.argv[2];if(manifest){deployment=JSON.parse(await readFile(manifest,'utf8'));if(deployment.chainId!==31337||deployment.mode!=='local')throw Error('Local setup cannot use testnet deployment');}
const variables={ADMIN_TOKEN:prior.ADMIN_TOKEN||secret(),RENDERER_TOKEN:prior.RENDERER_TOKEN||secret(),SESSION_SECRET:prior.SESSION_SECRET||secret(),POSTGREST_TOKEN:jwt,RH_RPC_URL:'http://127.0.0.1:8545',DEPLOYMENT_JSON:manifest?JSON.stringify(deployment):prior.DEPLOYMENT_JSON||'{}',MINT_PRIVATE_KEY:accounts[1].getHdKey().privateKey?Buffer.from(accounts[1].getHdKey().privateKey).toString('hex'):'',VERIFIER_PRIVATE_KEY:Buffer.from(accounts[2].getHdKey().privateKey).toString('hex'),RELAYER_PRIVATE_KEY:Buffer.from(accounts[3].getHdKey().privateKey).toString('hex'),SOURCE_RPC_JSON:JSON.stringify({ethereum:['http://127.0.0.1:3890','http://localhost:3891']}),PINATA_GATEWAY:'http://127.0.0.1:8080',IPFS_API:'http://127.0.0.1:5001',PUBLIC_APP_URL:'http://localhost:5173'};
for(const key of ['MINT_PRIVATE_KEY','VERIFIER_PRIVATE_KEY','RELAYER_PRIVATE_KEY'])variables[key]='0x'+variables[key];
await writeFile('apps/api/.dev.vars',Object.entries(variables).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});
await writeFile('.env.local-deploy','DEPLOYER_PRIVATE_KEY=0x'+Buffer.from(accounts[0].getHdKey().privateKey).toString('hex')+'\nMINT_SIGNER='+accounts[1].address+'\nVERIFIER_SIGNER='+accounts[2].address+'\n',{mode:0o600});
await writeFile('infra/.env.renderer','RENDERER_TOKEN='+variables.RENDERER_TOKEN+'\n',{mode:0o600});
process.stdout.write('Local configuration written. Secrets omitted. These are public Anvil test accounts; never use them on another network.\n');
