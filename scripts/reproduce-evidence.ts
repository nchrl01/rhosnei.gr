import {readFile} from 'node:fs/promises';import {verifyPool} from '../apps/api/src/verification.ts';import type {Env} from '../apps/api/src/env.ts';
const path=process.argv[2];if(!path)throw Error('Usage: node --experimental-transform-types scripts/reproduce-evidence.ts evidence.json');
const bundle=JSON.parse(await readFile(path,'utf8'));
// Reproduction is a read-only chain operation, and requires suitable archive RPCs.
const env={SOURCE_RPC_JSON:process.env.SOURCE_RPC_JSON,MODE:process.env.UPIC_EVIDENCE_MODE==='local'?'local':'testnet'} as Env;
const result=await verifyPool(env,bundle.policy,bundle.evidence.assetKey,async()=>{},BigInt(bundle.evidence.block.number));
for(const key of ['priceUsd8','priceUsd18','supply','capUsd8','liquidityUsd8'])if(result[key as keyof typeof result]!==bundle.evidence[key])throw Error('Archived calculation mismatch: '+key);
process.stdout.write(JSON.stringify({reproduced:result,matched:true},null,2)+'\n');
