const MAX_ACCOUNTS=4,MAX_AGE=6*3600000;
const sample={totalHolders:null,complete:false,truncated:false,supply:null,referencePrice:null,referenceMarketCap:null};
const fresh=(value,now)=>Number.isSafeInteger(value)&&value<=now+300000&&now-value<MAX_AGE;
const stellarAddress=id=>typeof id==='string'&&/^G[A-Z2-7]{55}$/.test(id);
const stacksAddress=id=>typeof id==='string'&&/^S[PM][0-9A-HJKMNP-TV-Z]{20,39}$/.test(id);
const positive=(value,decimals=0)=>{
 const text=String(value??'');
 if(!(decimals?/^\d{1,30}$/:/^\d{1,20}(?:\.\d{1,7})?$/).test(text))return null;
 const amount=Number(text)/10**decimals;return Number.isFinite(amount)&&amount>0?amount:null;
};

// SDF's public Horizon API serves current accounts. Recent successful transaction
// sources select the sample; the native balance is not a transaction amount.
// Five requests maximum, shared by the relay's two-hour cache.
// https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/accounts/object
// https://developers.stellar.org/docs/data/apis/horizon/api-reference/structure/rate-limiting
export async function loadStellarNative(read,now=Date.now()){
 const base='https://horizon.stellar.org';
 const body=await read(base+'/transactions?order=desc&limit=40&include_failed=false');
 if(!Array.isArray(body?._embedded?.records))throw Error('invalid-stellar-transactions');
 const selected=new Map();
 for(const row of body._embedded.records.slice(0,40)){
  const id=row.source_account,at=Date.parse(row.created_at);
  if(row.successful!==true||!stellarAddress(id)||!Number.isSafeInteger(row.ledger)||row.ledger<=0||!fresh(at,now)||selected.has(id))continue;
  selected.set(id,{ledger:row.ledger,at});if(selected.size===MAX_ACCOUNTS)break;
 }
 if(!selected.size)throw Error('empty-stellar-recent-accounts');
 const records=[],modifiedTimes=[],modifiedLedgers=[],activityTimes=[];
 for(const [id,reference] of selected){
  let row;try{row=await read(base+'/accounts/'+id);}catch(error){if(records.length)break;throw error;}
  const modifiedAt=Date.parse(row?.last_modified_time),ledger=row?.last_modified_ledger;
  // Source-account sequence changes in its transaction. A response predating that
  // transaction is stale, even if its HTTP fetch just completed.
  if(row?.account_id!==id||!Array.isArray(row.balances)||!Number.isSafeInteger(ledger)||ledger<reference.ledger||!fresh(modifiedAt,now)||modifiedAt<reference.at)throw Error('invalid-stellar-account-state');
  const native=row.balances.filter(value=>value.asset_type==='native');
  const tokenBalance=native.length===1?positive(native[0].balance):null;
  if(!tokenBalance)continue;
  records.push({id,tokenBalance});modifiedTimes.push(modifiedAt);modifiedLedgers.push(ledger);activityTimes.push(reference.at);
 }
 if(!records.length)throw Error('empty-stellar-native-balances');
 // Horizon supplies each account's last change time, not a single shared
 // snapshot time. Preserve that distinction instead of claiming pinned balances.
 return {...sample,records,source:'Stellar Horizon current native balances',scope:'recent-transaction-source-accounts',coverage:'recent-account-sample',sourceAt:null,membershipAt:Math.min(...activityTimes),balanceModifiedAtMin:Math.min(...modifiedTimes),balanceModifiedAtMax:Math.max(...modifiedTimes),balanceLedgerMin:Math.min(...modifiedLedgers),balanceLedgerMax:Math.max(...modifiedLedgers),indexCadence:'current-ledger',balanceBasis:'current-balances-with-verified-recent-account-changes'};
}

// Hiro's v3 list contains canonical confirmed transactions only. v3 balances
// always represent the current indexed tip; locked STX is part of balance.
// Do not use available/mempool estimates, or deprecated v1 routes.
// https://docs.hiro.so/en/apis/stacks-blockchain-api/v1-to-v3-migration
export async function loadStacksNative(read,now=Date.now()){
 const base='https://api.hiro.so';
 const body=await read(base+'/extended/v3/transactions?limit=40');
 if(!Array.isArray(body?.results))throw Error('invalid-stacks-transactions');
 const selected=new Map();
 for(const row of body.results.slice(0,40)){
  const id=row.sender?.address,at=Number(row.block?.time)*1000,height=row.block?.height;
  if(row.status!=='success'||!stacksAddress(id)||!Number.isSafeInteger(height)||height<=0||!fresh(at,now)||selected.has(id))continue;
  selected.set(id,{height,at});if(selected.size===MAX_ACCOUNTS)break;
 }
 if(!selected.size)throw Error('empty-stacks-recent-accounts');
 const records=[],activityTimes=[],activityBlocks=[];
 for(const [id,reference] of selected){
  let row;try{row=await read(base+'/extended/v3/principals/'+id+'/balances/stx');}catch(error){if(records.length)break;throw error;}
  const tokenBalance=positive(row?.balance,6);
  if(!tokenBalance)continue;
  records.push({id,tokenBalance});activityTimes.push(reference.at);activityBlocks.push(reference.height);
 }
 if(!records.length)throw Error('empty-stacks-native-balances');
 // The balance payload has no timestamp/height, so membership provenance is
 // separate. Never stamp current balances with their selecting transaction time.
 return {...sample,records,source:'Hiro Stacks current native balances',scope:'recent-transaction-senders-includes-locked-stx',coverage:'recent-account-sample',sourceAt:null,membershipAt:Math.min(...activityTimes),membershipBlockMin:Math.min(...activityBlocks),membershipBlockMax:Math.max(...activityBlocks),indexCadence:'current-indexed-tip',balanceBasis:'current-tip-balances-after-recent-transaction-selection'};
}
