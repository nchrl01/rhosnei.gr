import {createWalletClient,http,type Address} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {nftAbi,vaultAbi} from '@upic/sdk';
import type {Collection} from '@upic/domain';
import {DB} from './db';import {deployment,type Env} from './env';import {clientFor} from './services';

/** Cadence tiers recorded on-chain by UPICCollection.signalEpoch. */
export const CADENCE=['live','daily','weekly','hibernating'] as const;
export type Cadence=typeof CADENCE[number];
const DAY=86400;
/** Runway thresholds in days: >=365 live, >=90 daily, >=30 weekly, otherwise hibernate. */
export const RUNWAY_DAYS={live:365,daily:90,weekly:30} as const;

export function dailyCost(env:Env):bigint{return BigInt(env.UPKEEP_DAILY_WEI||'20000000000000');} // 0.00002 ETH ≈ $1.80/month at $3,000
export function runwayDays(balance:bigint,cost:bigint):number{return cost===0n?Infinity:Number(balance/cost);}
export function tierFor(balance:bigint,cost:bigint,poolCovers=false):number{
 const days=runwayDays(balance,cost);
 if(days>=RUNWAY_DAYS.live)return 0;if(days>=RUNWAY_DAYS.daily)return 1;if(days>=RUNWAY_DAYS.weekly||poolCovers)return 2;return 3;
}
/** Whether a collection at this tier should emit an ERC-4906 refresh signal in this epoch. */
export function shouldSignal(tier:number,previous:number,epoch:number):boolean{
 if(tier!==previous)return tier!==3||previous!==3;
 if(tier===3)return false;if(tier===2)return epoch%7===0;return true;
}

export async function upkeepStatus(env:Env,collection:Address){
 const d=deployment(env),client=clientFor(env),cost=dailyCost(env);
 const [balance,pool,last,cadence]=await Promise.all([
  client.readContract({address:d.vault,abi:vaultAbi,functionName:'maintenance',args:[collection]}),
  client.readContract({address:d.vault,abi:vaultAbi,functionName:'maintenancePool'}),
  client.readContract({address:d.vault,abi:vaultAbi,functionName:'lastUpkeepEpoch',args:[collection]}),
  client.readContract({address:collection,abi:nftAbi,functionName:'cadence'})]);
 const days=runwayDays(balance,cost);
 return {collection,maintenanceWei:balance.toString(),poolWei:pool.toString(),dailyCostWei:cost.toString(),runwayDays:Number.isFinite(days)?days:null,
  recommended:CADENCE[tierFor(balance,cost,pool>=cost*30n)],cadence:CADENCE[Number(cadence)]??'live',lastUpkeepEpoch:Number(last)};
}

/** Daily charge per cadence tier: slower cadence costs less; hibernating costs nothing. */
export function chargeFor(tier:number,cost:bigint):bigint{return tier===0?cost:tier===1?cost/2n:tier===2?cost/7n:0n;}

/**
 * Daily upkeep. For each collection not yet handled this epoch: choose its cadence from the current
 * runway, charge that cadence's cost (collection treasury first, then the shared pool), and emit the
 * ERC-4906 signal. Hibernating collections are never charged. Only collections that needed an
 * on-chain action count toward `limit`, so stuck or frozen collections cannot starve newer ones.
 */
export async function runUpkeep(env:Env,limit=10){
 if(env.UPKEEP_ENABLED!=='true'||!env.MINT_PRIVATE_KEY)return {skipped:true};
 const d=deployment(env),client=clientFor(env),db=new DB(env),cost=dailyCost(env);
 const account=privateKeyToAccount(env.MINT_PRIVATE_KEY),wallet=createWalletClient({account,transport:http(env.RH_RPC_URL)});
 const epoch=Math.floor(Date.now()/1000/DAY);const results:Record<string,string>={};let acted=0;
 const collections=await db.list<Collection>('upic_collections',{select:'address',order:'created_at.asc',limit:'500'});
 const pool=await client.readContract({address:d.vault,abi:vaultAbi,functionName:'maintenancePool'});
 for(const {address} of collections){
  if(acted>=limit)break;
  try{
   const [last,signalled,balance,previous]=await Promise.all([
    client.readContract({address:d.vault,abi:vaultAbi,functionName:'lastUpkeepEpoch',args:[address]}),
    client.readContract({address,abi:nftAbi,functionName:'lastSignalEpoch'}),
    client.readContract({address:d.vault,abi:vaultAbi,functionName:'maintenance',args:[address]}),
    client.readContract({address,abi:nftAbi,functionName:'cadence'})]);
   if(Number(signalled)>=epoch||Number(last)>=epoch)continue; // already handled today
   const tier=tierFor(balance,cost,pool>=cost*30n),charge=chargeFor(tier,cost);
   const debit=charge>0n&&balance+pool>=charge;
   const signal=shouldSignal(tier,Number(previous),epoch);
   if(!debit&&!signal){results[address]=CADENCE[tier]!;continue;}
   acted++;
   if(debit){const {request}=await client.simulateContract({account,address:d.vault,abi:vaultAbi,functionName:'debitUpkeep',args:[address,charge]});await client.waitForTransactionReceipt({hash:await wallet.writeContract(request)});}
   if(signal){
    // Hibernation records the collection's permanent media reference (edition 1's archived token URI).
    const snapshot=tier===3?await client.readContract({address,abi:nftAbi,functionName:'tokenURI',args:[1n]}):'';
    const {request}=await client.simulateContract({account,address,abi:nftAbi,functionName:'signalEpoch',args:[tier,snapshot]});
    await client.waitForTransactionReceipt({hash:await wallet.writeContract(request)});
   }
   results[address]=CADENCE[tier]!+(debit?' charged '+charge.toString():'');
  }catch(error){results[address]='error:'+(error instanceof Error?error.message.slice(0,60):'unknown');}
 }
 return {epoch,results};
}
