const ENDPOINT='https://mainnet.vecha.in',MAX_ACCOUNTS=4,MAX_AGE=6*3600000;
const address=value=>typeof value==='string'&&/^0x[0-9a-f]{40}$/i.test(value);
const hash=value=>typeof value==='string'&&/^0x[0-9a-f]{64}$/i.test(value);
const nativeBalance=value=>{
 if(typeof value!=='string'||!/^0x[0-9a-f]{1,64}$/i.test(value))throw Error('invalid-vechain-balance');
 const raw=BigInt(value),scale=10n**18n;
 const amount=Number(`${raw/scale}.${String(raw%scale).padStart(18,'0')}`);
 if(!Number.isFinite(amount)||amount<0)throw Error('invalid-vechain-balance');
 return amount;
};

// Public VeChain Thorest: one finalized block + at most four accounts. Every
// account is read at the same block revision. `balance` is VET; `energy` is the
// distinct VTHO currency and must never be added to or substituted for VET.
// https://docs.vechain.org/how-to-run-a-node/nodes
// https://docs.vechain.org/developer-resources/how-to-build-on-vechain/read-data/read-accounts
export async function loadVeChainNative(read,now=Date.now(),symbol='VET'){
 if(!['VET','VTHO'].includes(symbol))throw Error('unsupported-native-provider');
 const block=await read(ENDPOINT+'/blocks/finalized?expanded=true');
 const sourceAt=Number(block?.timestamp)*1000,height=block?.number;
 if(!hash(block?.id)||!Number.isSafeInteger(height)||height<1||!Number.isSafeInteger(sourceAt)||sourceAt>now+300000||now-sourceAt>=MAX_AGE||block?.isFinalized!==true||block?.isTrunk!==true||!Array.isArray(block?.transactions)||block.transactions.length>10000)throw Error('invalid-vechain-finalized-block');
 // Thor encodes the block number in the first four bytes of the block ID.
 if(Number.parseInt(block.id.slice(2,10),16)!==height)throw Error('invalid-vechain-block-identity');
 const selected=new Set();
 const add=value=>{if(selected.size<MAX_ACCOUNTS&&address(value))selected.add(value.toLowerCase());};
 // Fee-delegated senders may hold no VTHO; actual fee payers are relevant native holders.
 if(symbol==='VTHO')for(const tx of block.transactions){if(tx?.chainTag!==74)throw Error('invalid-vechain-mainnet');if(tx.reverted===false)add(tx.gasPayer);}
 for(const tx of block.transactions){
  if(tx?.chainTag!==74)throw Error('invalid-vechain-mainnet');
  if(tx.reverted!==false)continue;
  add(tx.origin);
 }
 for(const tx of block.transactions){
  if(tx.reverted!==false)continue;
  for(const output of (Array.isArray(tx.outputs)?tx.outputs:[])){
   for(const transfer of (Array.isArray(output?.transfers)?output.transfers:[])){
    add(transfer?.sender);add(transfer?.recipient);
    if(selected.size===MAX_ACCOUNTS)break;
   }
   if(selected.size===MAX_ACCOUNTS)break;
  }
  if(selected.size===MAX_ACCOUNTS)break;
 }
 if(!selected.size)throw Error('empty-vechain-finalized-accounts');
 const records=[];
 for(const id of selected){
  let body;try{body=await read(`${ENDPOINT}/accounts/${id}?revision=${block.id}`);}catch(error){if(records.length)break;throw error;}
  const tokenBalance=nativeBalance(symbol==='VTHO'?body?.energy:body?.balance);
  if(tokenBalance>0)records.push({id,tokenBalance});
 }
 if(!records.length)throw Error('empty-vechain-native-balances');
 return {records,totalHolders:null,complete:false,truncated:false,supply:null,referencePrice:null,referenceMarketCap:null,source:'VeChain public finalized '+symbol+' account balances',scope:'finalized-block-participants-'+symbol.toLowerCase()+'-only',coverage:'recent-account-sample',sourceAt,sourceHeight:height,sourceBlockHash:block.id,indexCadence:'finalized-block',balanceBasis:symbol.toLowerCase()+'-balance-at-finalized-block-revision'};
}
