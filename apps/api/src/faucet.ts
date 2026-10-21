import {createWalletClient,http,parseEther,type Address} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {deployment,coordinator,type Env} from './env';import {clientFor} from './services';

/**
 * Tester drip: a small amount of test gas once per signed-in wallet per 24h. The test utility
 * token has its own on-chain faucet, so only native gas is sent here. Staging sits behind
 * Cloudflare Access, so only invited testers can reach this route.
 */
export async function drip(env:Env,wallet:Address){
 if(env.MODE!=='testnet'||!env.FAUCET_PRIVATE_KEY)throw Error('faucet-unconfigured');
 const d=deployment(env),client=clientFor(env),account=privateKeyToAccount(env.FAUCET_PRIVATE_KEY);
 const amount=BigInt(env.FAUCET_DRIP_WEI||parseEther('0.005').toString());
 if(await client.getBalance({address:account.address})<amount*2n)throw Error('faucet-empty');
 if(await client.getBalance({address:wallet})>=amount*4n)return {sent:false,reason:'balance-sufficient'};
 const claim=await coordinator(env).fetch('https://internal/faucet-claim',{method:'POST',body:JSON.stringify({wallet})});
 if(!claim.ok)throw Error('faucet-rate-limited');
 try{
  const hash=await createWalletClient({account,transport:http(env.RH_RPC_URL)}).sendTransaction({chain:null,to:wallet,value:amount});
  return {sent:true,hash,amount:amount.toString(),chainId:d.chainId};
 }catch{await coordinator(env).fetch('https://internal/faucet-release',{method:'POST',body:JSON.stringify({wallet})});throw Error('faucet-send-failed');}
}
