const NEAR_RPC='https://free.rpc.fastnear.com';
const MAX_SAMPLE=100,MAX_AGE=6*3600000;
const sample={totalHolders:null,complete:false,truncated:false,supply:null,referencePrice:null,referenceMarketCap:null};
const nearId=value=>typeof value==='string'&&value.length>=2&&value.length<=64&&/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);
const hash=value=>typeof value==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const unsigned=value=>typeof value==='string'&&/^\d{1,40}$/.test(value)?BigInt(value):null;
const fresh=(value,now)=>Number.isSafeInteger(value)&&value<=now+300000&&now-value<MAX_AGE;
async function rpc(read,method,params){
 const body=await read(NEAR_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 if(body?.error||!Object.hasOwn(body||{},'result'))throw Error('near-rpc-error');return body.result;
}

// NEAR documents FASTNEAR's keyless mainnet RPC. Pin the two state queries to
// one finalized block; never combine different snapshots or infer total holders.
// https://docs.near.org/api/rpc/providers
// https://docs.near.org/api/rpc/block-chunk#block-effects
// https://docs.near.org/api/rpc/contracts#view-account-changes
export async function loadNearNative(read,now=Date.now()){
 const block=await rpc(read,'block',{finality:'final'}),header=block?.header;
 const blockHash=header?.hash,height=header?.height;
 // String nanoseconds retain their precision; convert to integer milliseconds.
 const nanos=unsigned(header?.timestamp_nanosec??String(header?.timestamp??''));
 const sourceAt=nanos===null?NaN:Number(nanos/1000000n);
 if(!hash(blockHash)||!Number.isSafeInteger(height)||height<=0||!fresh(sourceAt,now))throw Error('invalid-near-finalized-block');
 const effects=await rpc(read,'block_effects',{block_id:blockHash});
 const touched=effects?.changes??effects?.block_effects;
 if(effects?.block_hash!==blockHash||!Array.isArray(touched))throw Error('invalid-near-block-effects');
 const ids=[...new Set(touched.filter(row=>row.type==='account_touched'&&nearId(row.account_id)).map(row=>row.account_id))].slice(0,MAX_SAMPLE);
 if(!ids.length)throw Error('empty-near-block-sample');
 const state=await rpc(read,'changes',{changes_type:'account_changes',account_ids:ids,block_id:blockHash});
 if(state?.block_hash!==blockHash||!Array.isArray(state?.changes))throw Error('invalid-near-account-changes');
 const allowed=new Set(ids),balances=new Map();
 for(const row of state.changes){
  const change=row.change,id=change?.account_id;if(!allowed.has(id))continue;
  if(row.type==='account_deletion'){balances.delete(id);continue;}
  if(row.type!=='account_update')continue;
  const amount=unsigned(change.amount),locked=unsigned(change.locked);
  // Keep the last occurrence, including rewards after a receipt and deletions.
  if(amount===null||locked===null){balances.delete(id);continue;}
  const total=amount+locked,scale=1000000000000000000000000n;
  const tokenBalance=Number(String(total/scale)+'.'+String(total%scale).padStart(24,'0'));
  if(!Number.isFinite(tokenBalance)||tokenBalance<=0)balances.delete(id);else balances.set(id,tokenBalance);
 }
 const records=[...balances].map(([id,tokenBalance])=>({id,tokenBalance}));
 if(!records.length)throw Error('empty-near-account-sample');
 return {...sample,records,source:'FASTNEAR finalized account balances',scope:'finalized-block-accounts-includes-locked-stake',coverage:'recent-account-sample',sourceAt,sourceBlockHash:blockHash,sourceHeight:height,balanceBasis:'last-account-state-in-finalized-block',indexCadence:'finalized-block'};
}

const APT_TYPE='0x1::aptos_coin::AptosCoin',APT_FA='0x'+'0'.repeat(63)+'a';
const aptAddress=value=>typeof value==='string'&&/^0x[a-f0-9]{64}$/.test(value);
const aptTimestamp=value=>typeof value==='string'?Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(value)?value:value+'Z'):NaN;
const APT_QUERY=`{
 ledger_infos { chain_id }
 processor_status(where:{processor:{_eq:"fungible_asset_processor"}},limit:1) { processor last_success_version last_transaction_timestamp }
 fungible_asset_metadata(where:{asset_type:{_eq:"${APT_TYPE}"}},limit:1) { asset_type decimals }
 current_fungible_asset_balances(where:{asset_type:{_eq:"${APT_TYPE}"},is_primary:{_eq:true},amount:{_gt:"0"}},limit:100) {
  owner_address storage_id asset_type asset_type_v2 amount is_primary last_transaction_version
 }
}`;

// Aptos Labs explicitly publishes this free indexer. Its unified balance view
// already merges migrated Coin/FA representations: do not sum both again.
// Primary stores are a bounded account sample; secondary stores and delegated
// stake are outside this feed's scope, and the page is not a rich list.
// https://aptos.dev/build/indexer/indexer-api
// https://aptos.dev/build/indexer/indexer-api/indexer-reference#current_fungible_asset_balances
export async function loadAptosNative(read,now=Date.now()){
 const body=await read('https://api.mainnet.aptoslabs.com/v1/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:APT_QUERY})});
 if(body?.errors?.length)throw Error('aptos-graphql-error');
 const data=body?.data,status=data?.processor_status?.[0],metadata=data?.fungible_asset_metadata?.[0];
 const indexerAt=aptTimestamp(status?.last_transaction_timestamp),version=Number(status?.last_success_version);
 if(data?.ledger_infos?.length!==1||data.ledger_infos[0].chain_id!==1||status?.processor!=='fungible_asset_processor'||!fresh(indexerAt,now)||!Number.isSafeInteger(version)||version<=0||metadata?.asset_type!==APT_TYPE||metadata.decimals!==8||!Array.isArray(data.current_fungible_asset_balances))throw Error('invalid-aptos-native-index');
 const records=[],seen=new Set();
 for(const row of data.current_fungible_asset_balances.slice(0,MAX_SAMPLE)){
  const id=typeof row.owner_address==='string'?row.owner_address.toLowerCase():'',storage=typeof row.storage_id==='string'?row.storage_id.toLowerCase():'';
  const amount=unsigned(String(row.amount??'')),last=Number(row.last_transaction_version);
  if(!aptAddress(id)||!aptAddress(storage)||row.asset_type!==APT_TYPE||row.is_primary!==true||(row.asset_type_v2!=null&&String(row.asset_type_v2).toLowerCase()!==APT_FA)||amount===null||amount<=0n||!Number.isSafeInteger(last)||last<0||last>version)continue;
  // A primary native store has one owner. Multiple returned rows for that owner
  // are not silently summed or guessed through a schema/migration inconsistency.
  if(seen.has(id))throw Error('duplicate-aptos-primary-store');
  const scale=100000000n,tokenBalance=Number(String(amount/scale)+'.'+String(amount%scale).padStart(8,'0'));
  if(!Number.isFinite(tokenBalance)||tokenBalance<=0)continue;
  seen.add(id);records.push({id,tokenBalance});
 }
 if(!records.length)throw Error('empty-aptos-primary-balances');
 // Processor time proves index freshness, not a pinned timestamp shared by all
 // current rows. Old last-change times are valid for untouched current balances.
 return {...sample,records,source:'Aptos Labs current native balances',scope:'primary-native-stores-excludes-secondary-and-stake',coverage:'ledger-account-sample',sourceAt:null,indexerAt,sourceVersion:version,indexCadence:'current-indexed-state',balanceBasis:'unified-native-primary-store-balance'};
}
