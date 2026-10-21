#!/usr/bin/env node
// Generates fresh, throwaway testnet keys on YOUR machine. Keys are never written to disk or
// committed; pass --gh to store them straight into the GitHub Environments with the gh CLI:
//   node infra/staging/new-keys.mjs --gh            (requires `gh auth login` with repo admin)
//   node infra/staging/new-keys.mjs                 (prints them so you can paste into GitHub)
// Roles: deployer (contract admin), mint signer (also upkeeper + metadata publisher, needs gas),
// verifier (signs evolutions/creations, no gas), relayer (submits evolutions, needs gas), faucet (needs gas).
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {spawnSync} from 'node:child_process';

const roles={TESTNET_DEPLOYER_KEY:'deployer',MINT_PRIVATE_KEY:'mint signer / upkeeper',VERIFIER_PRIVATE_KEY:'verifier',RELAYER_PRIVATE_KEY:'relayer',FAUCET_PRIVATE_KEY:'tester faucet'};
const keys=Object.fromEntries(Object.keys(roles).map(name=>[name,generatePrivateKey()]));
const address=name=>privateKeyToAccount(keys[name]).address;
const vars={MINT_SIGNER:address('MINT_PRIVATE_KEY'),VERIFIER_SIGNER:address('VERIFIER_PRIVATE_KEY')};

if(process.argv.includes('--gh')){
 const run=(args,input)=>{const r=spawnSync('gh',args,{input,encoding:'utf8'});if(r.status!==0)throw Error(`gh ${args.slice(0,3).join(' ')} failed: ${r.stderr}`);};
 run(['secret','set','TESTNET_DEPLOYER_KEY','--env','testnet'],keys.TESTNET_DEPLOYER_KEY);
 for(const [k,v] of Object.entries(vars))run(['variable','set',k,'--env','testnet','--body',v]);
 for(const k of ['MINT_PRIVATE_KEY','VERIFIER_PRIVATE_KEY','RELAYER_PRIVATE_KEY','FAUCET_PRIVATE_KEY'])run(['secret','set',k,'--env','staging'],keys[k]);
 console.log('Stored keys in GitHub Environments "testnet" and "staging".');
}else{
 console.log('# Secrets (keep private). testnet env: TESTNET_DEPLOYER_KEY. staging env: the other four.');
 for(const [k,v] of Object.entries(keys))console.log(`${k}=${v}`);
 console.log('\n# testnet environment variables');for(const [k,v] of Object.entries(vars))console.log(`${k}=${v}`);
}
console.log('\nFund these addresses with test ETH from the faucet (https://faucet.testnet.chain.robinhood.com):');
for(const k of ['TESTNET_DEPLOYER_KEY','MINT_PRIVATE_KEY','RELAYER_PRIVATE_KEY','FAUCET_PRIVATE_KEY'])console.log(`  ${roles[k].padEnd(24)} ${address(k)}`);
