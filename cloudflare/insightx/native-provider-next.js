const MAX_SAMPLE=100,MAX_AGE=6*3600000;
const sample={totalHolders:null,complete:false,truncated:false,supply:null,referencePrice:null,referenceMarketCap:null,sourceAt:null,indexCadence:'provider-indexed'};
const units=(value,decimals)=>{
 const text=String(value??'');if(!/^\d{1,40}$/.test(text))return null;
 const result=Number(text)/10**decimals;return Number.isFinite(result)&&result>0?result:null;
};
const fresh=(value,now)=>Number.isSafeInteger(value)&&value<=now+300000&&now-value<MAX_AGE;
const post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function result(records,meta){if(!records.length)throw Error('empty-native-account-sample');return {...sample,records,...meta};}

// Toncenter documents a public keyless limit of one request/second. The relay
// caches hourly. The registry identifies the-open-network / GRAM, never the
// unrelated Ethereum token whose current symbol is TON (Tokamak Network).
// https://docs.ton.org/api/v3/stats/get-top-accounts-by-balance
export async function loadTonNative(read){
 const body=await read('https://toncenter.com/api/v3/topAccountsByBalance?limit=100');
 if(!Array.isArray(body))throw Error('invalid-ton-accounts');
 const records=[],seen=new Set();
 for(const row of body.slice(0,MAX_SAMPLE)){
  const id=typeof row.account==='string'?row.account.toLowerCase():'',tokenBalance=units(row.balance,9);
  if(!/^-?\d{1,3}:[a-f0-9]{64}$/.test(id)||!tokenBalance||seen.has(id))continue;
  seen.add(id);records.push({id,tokenBalance});
 }
 // This endpoint has no ledger timestamp. Never label retrieval time as source time.
 return result(records,{source:'Toncenter native account balances',scope:'public-native-accounts-includes-contracts',coverage:'top-holder-sample'});
}

// Koios public POST bodies are limited to 5 KiB: 70 stake addresses fit. These
// are aggregates of UTXOs attached to stake credentials, excluding enterprise
// addresses and unwithdrawn staking rewards; they are not a census of wallets.
// https://api.koios.rest/#post-/account_info
export async function loadCardanoNative(read){
 const list=await read('https://api.koios.rest/api/v1/account_list?limit=70');
 if(!Array.isArray(list))throw Error('invalid-cardano-account-list');
 const valid=id=>typeof id==='string'&&/^stake1[023456789acdefghjklmnpqrstuvwxyz]{53}$/.test(id);
 const ids=[...new Set(list.slice(0,70).map(row=>row.stake_address).filter(valid))];
 if(!ids.length)throw Error('empty-cardano-account-list');
 const body=await read('https://api.koios.rest/api/v1/account_info',post({_stake_addresses:ids}));
 if(!Array.isArray(body))throw Error('invalid-cardano-balances');
 const allowed=new Set(ids),seen=new Set(),records=[];
 for(const row of body.slice(0,70)){
  const id=row.stake_address,tokenBalance=units(row.utxo,6);
  if(!allowed.has(id)||!tokenBalance||seen.has(id))continue;
  seen.add(id);records.push({id,tokenBalance});
 }
 return result(records,{source:'Koios Cardano stake-account UTXOs',scope:'stake-credential-utxos-excludes-rewards-enterprise',coverage:'ledger-account-sample'});
}

// The public Cosmos Directory REST proxy is explicitly offered to applications.
// Bank balances exclude delegated staking balances; address ordering is not rank.
// https://github.com/eco-stake/cosmos-directory#api-documentation
// https://docs.cosmos.network/sdk/latest/api-reference/grpc/bank
export async function loadCosmosNative(read){
 const body=await read('https://rest.cosmos.directory/cosmoshub/cosmos/bank/v1beta1/denom_owners/uatom?pagination.limit=100');
 if(!Array.isArray(body?.denom_owners))throw Error('invalid-cosmos-balances');
 const records=[],seen=new Set();
 for(const row of body.denom_owners.slice(0,MAX_SAMPLE)){
  const id=row.address,tokenBalance=units(row.balance?.amount,6);
  if(typeof id!=='string'||!/^cosmos1[023456789acdefghjklmnpqrstuvwxyz]{38,58}$/.test(id)||row.balance?.denom!=='uatom'||!tokenBalance||seen.has(id))continue;
  seen.add(id);records.push({id,tokenBalance});
 }
 return result(records,{source:'Cosmos Directory ATOM bank balances',scope:'bank-balances-excludes-delegated-stake',coverage:'ledger-account-sample'});
}

// The rich-list amount is rounded whole KAS. Use it ONLY to select addresses;
// fetch their actual current sompi balances in one bounded batch.
// https://api.kaspa.org/openapi.json
export async function loadKaspaNative(read,now=Date.now()){
 const list=await read('https://api.kaspa.org/addresses/top?limit=1');
 const top=Array.isArray(list)?list[0]:null;
 if(!Array.isArray(top?.ranking)||!fresh(top.timestamp,now))throw Error('invalid-kaspa-rich-list');
 const valid=id=>typeof id==='string'&&/^kaspa:[023456789acdefghjklmnpqrstuvwxyz]{61,63}$/.test(id);
 const ids=[...new Set(top.ranking.slice(0,MAX_SAMPLE).map(row=>row.address).filter(valid))];
 if(!ids.length)throw Error('empty-kaspa-rich-list');
 const body=await read('https://api.kaspa.org/addresses/balances',post({addresses:ids}));
 if(!Array.isArray(body))throw Error('invalid-kaspa-balances');
 const allowed=new Set(ids),seen=new Set(),records=[];
 for(const row of body.slice(0,MAX_SAMPLE)){
  const id=row.address,tokenBalance=units(row.balance,8);
  if(!allowed.has(id)||!tokenBalance||seen.has(id))continue;
  seen.add(id);records.push({id,tokenBalance});
 }
 // The current balance response is unstamped. Membership time belongs to the
 // earlier ranking, and must not be presented as the balances' block timestamp.
 return result(records,{source:'Kaspa public indexed balances',scope:'public-native-addresses',coverage:'top-holder-sample',membershipAt:top.timestamp});
}
