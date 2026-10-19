const SOL_RPC='https://solana-rpc.publicnode.com';
const XRP_RPC='https://mainnet.xrpl-rpc.com';
const MAX_SAMPLE=100,MAX_AGE=6*3600000,RIPPLE_EPOCH=946684800;
const solAddress=value=>typeof value==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const xrpAddress=value=>typeof value==='string'&&/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(value);
const amount=(value,decimals)=>{
 const text=String(value??'');if(!/^\d{1,22}$/.test(text))return null;
 const result=Number(text)/10**decimals;return Number.isFinite(result)&&result>=0?result:null;
};
const fresh=(sourceAt,now)=>Number.isSafeInteger(sourceAt)&&sourceAt<=now+300000&&now-sourceAt<MAX_AGE;
async function rpc(read,url,method,params){
 const body=await read(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 if(body?.error||body?.result?.error||!Object.hasOwn(body||{},'result'))throw Error('native-rpc-error');
 return body.result;
}
const sample={totalHolders:null,complete:false,truncated:false,supply:null,referencePrice:null,referenceMarketCap:null};

// PublicNode's free endpoint supports finalized blocks, but its indexed rich-list
// methods require a token. Keep this sample explicitly scoped to block activity.
// https://solana.com/docs/rpc/http/getblock
export async function loadSolanaNative(read,now=Date.now()){
 const slot=await rpc(read,SOL_RPC,'getSlot',[{commitment:'finalized'}]);
 if(!Number.isSafeInteger(slot)||slot<=0)throw Error('invalid-solana-slot');
 const block=await rpc(read,SOL_RPC,'getBlock',[slot,{commitment:'finalized',transactionDetails:'accounts',rewards:false,maxSupportedTransactionVersion:1}]);
 const sourceAt=Number(block?.blockTime)*1000;
 if(!Array.isArray(block?.transactions)||!fresh(sourceAt,now))throw Error('invalid-solana-block');
 const ids=new Set();
 for(const row of block.transactions){
  const keys=row.transaction?.accountKeys;
  if(!Array.isArray(keys)||keys.some(key=>key.pubkey==='Vote111111111111111111111111111111111111111'))continue;
  for(const key of keys){if(ids.size<MAX_SAMPLE&&key.signer===true&&solAddress(key.pubkey))ids.add(key.pubkey);}
  if(ids.size===MAX_SAMPLE)break;
 }
 // A selected signer may receive or spend again later in the same block without
 // signing that transaction. Inspect EVERY occurrence and retain its last balance.
 const balances=new Map();
 for(const row of block.transactions){
  const keys=row.transaction?.accountKeys,values=row.meta?.postBalances;
  if(!Array.isArray(keys)||!Array.isArray(values)||keys.length!==values.length)continue;
  for(let i=0;i<keys.length;i++){
   const id=keys[i]?.pubkey;if(!ids.has(id))continue;
   const tokenBalance=amount(values[i],9);if(tokenBalance===null)balances.delete(id);else balances.set(id,tokenBalance);
  }
 }
 const records=[...balances].filter(([,value])=>value>0).map(([id,tokenBalance])=>({id,tokenBalance}));
 if(!records.length)throw Error('empty-solana-block-sample');
 return {...sample,records,source:'PublicNode Solana finalized balances',scope:'finalized-block-participants',coverage:'recent-account-sample',sourceAt,sourceSlot:slot,indexCadence:'finalized-block',balanceBasis:'last-post-transaction-balance'};
}

// Ankr explicitly offers this no-key public endpoint for wallet/dApp/backend use.
// https://xrpl-rpc.com/ — unlike Ripple's non-business public demonstration servers.
// ledger_data is ordered by ledger key, not account wealth; never label it rich-list.
export async function loadXrpNative(read,now=Date.now()){
 const records=[],seen=new Set();let ledgerHash=null,ledgerIndex=null,sourceAt=null,totalSupply=null,marker;
 for(let page=0;page<3&&records.length<MAX_SAMPLE;page++){
  const request={binary:false,type:'account',limit:100,...(ledgerHash?{ledger_hash:ledgerHash}:{ledger_index:'validated'}),...(marker?{marker}:{})};
  const body=await rpc(read,XRP_RPC,'ledger_data',[request]);
  if(body?.validated!==true||!Array.isArray(body.state)||!/^[A-F0-9]{64}$/i.test(body.ledger_hash||''))throw Error('invalid-xrp-ledger');
  if(page===0){
   ledgerHash=body.ledger_hash;ledgerIndex=body.ledger_index;
   const header=body.ledger;if(!header||header.closed!==true||header.ledger_hash!==ledgerHash)throw Error('invalid-xrp-ledger-header');
   sourceAt=(Number(header.close_time)+RIPPLE_EPOCH)*1000;
   if(!fresh(sourceAt,now))throw Error('delayed-xrp-ledger');
   // This includes escrow and other noncirculating XRP, so it is deliberately
   // NOT returned as circulating supply for market-cap calculation.
   totalSupply=amount(header.total_coins,6);
  }else if(body.ledger_hash!==ledgerHash||body.ledger_index!==ledgerIndex)throw Error('changed-xrp-ledger');
  for(const row of body.state){
   const id=row.Account,tokenBalance=amount(row.Balance,6);
   if(records.length>=MAX_SAMPLE)break;
   if(row.LedgerEntryType!=='AccountRoot'||!xrpAddress(id)||!tokenBalance||seen.has(id))continue;
   seen.add(id);records.push({id,tokenBalance});
  }
  marker=body.marker;
  if(!marker)break;
  if(typeof marker!=='string'||!/^[a-f0-9]{64}$/i.test(marker))throw Error('invalid-xrp-marker');
 }
 if(!records.length)throw Error('empty-xrp-account-sample');
 return {...sample,records,source:'Ankr XRP validated balances',scope:'public-account-balances-excludes-escrow',coverage:'ledger-account-sample',sourceAt,sourceLedger:ledgerIndex,sourceLedgerHash:ledgerHash,totalSupply,indexCadence:'validated-ledger'};
}

// Hedera's public mirror publishes balance snapshots in tinybars (1e8 per HBAR).
// Account-id order is a bounded ledger sample, not a ranking of all holders.
// https://docs.hedera.com/reference/rest-api/balances
export async function loadHederaNative(read,now=Date.now()){
 const body=await read('https://mainnet-public.mirrornode.hedera.com/api/v1/balances?limit=100&order=asc&account.balance=gt:0');
 const sourceAt=Math.floor(Number(body?.timestamp)*1000);
 if(!Array.isArray(body?.balances)||!fresh(sourceAt,now))throw Error('invalid-hedera-balances');
 const seen=new Set(),records=[];
 for(const row of body.balances.slice(0,MAX_SAMPLE)){
  const id=row.account,tokenBalance=amount(row.balance,8);
  if(typeof id!=='string'||!/^\d+\.\d+\.\d+$/.test(id)||id.length>60||!tokenBalance||seen.has(id))continue;
  seen.add(id);records.push({id,tokenBalance});
 }
 if(!records.length)throw Error('empty-hedera-account-sample');
 return {...sample,records,source:'Hedera public mirror balances',scope:'public-account-balances',coverage:'ledger-account-sample',sourceAt,indexCadence:'provider-indexed'};
}

// Nodely's free public indexer is explicitly available for production backends.
// https://nodely.io/docs/free/start
export async function loadAlgorandNative(read,now=Date.now()){
 const endpoint='https://mainnet-idx.4160.nodely.dev';
 const body=await read(endpoint+'/v2/accounts?limit=100&currency-greater-than=0&include-all=false');
 const round=body?.['current-round'];
 if(!Array.isArray(body?.accounts)||!Number.isSafeInteger(round)||round<=0)throw Error('invalid-algorand-accounts');
 const block=await read(endpoint+'/v2/blocks/'+round),sourceAt=Number(block?.timestamp)*1000;
 if(block?.round!==round||!fresh(sourceAt,now))throw Error('invalid-algorand-round');
 const seen=new Set(),records=[];
 for(const row of body.accounts.slice(0,MAX_SAMPLE)){
  const id=row.address,tokenBalance=amount(row.amount,6);
  if(typeof id!=='string'||!/^[A-Z2-7]{58}$/.test(id)||row.deleted===true||row.round!==round||!tokenBalance||seen.has(id))continue;
  seen.add(id);records.push({id,tokenBalance});
 }
 if(!records.length)throw Error('empty-algorand-account-sample');
 return {...sample,records,source:'Nodely Algorand account balances',scope:'public-account-balances',coverage:'ledger-account-sample',sourceAt,sourceRound:round,indexCadence:'indexed-round'};
}
