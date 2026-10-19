const ENDPOINT='https://graphql.mainnet.sui.io/graphql';
const MAINNET='4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S';
const MAX_TRANSACTIONS=20,MAX_AGE=6*3600000;
const QUERY=`query UpicNativeBalances {
 chainIdentifier
 checkpoint {
  sequenceNumber timestamp digest
  query {
   transactions(last: 20) {
    nodes { sender { address balance(coinType: "0x2::sui::SUI") { totalBalance } } }
   }
  }
 }
}`;

// One modest read per shared two-hour cache refresh, with no retries/provider
// rotation. The public endpoint is best effort, not a production SLA.
// Checkpoint.query pins its descendant reads to the selected finalized checkpoint.
// totalBalance includes BOTH coin objects and the newer address accumulator.
// https://docs.sui.io/references/sui-api/sui-graphql/beta/reference/types/objects/checkpoint
// https://docs.sui.io/references/sui-api/sui-graphql/beta/reference/types/objects/balance
export async function loadSuiNative(read,now=Date.now()){
 const body=await read(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:QUERY})});
 if((Array.isArray(body?.errors)&&body.errors.length)||!body?.data)throw Error('sui-graphql-error');
 if(body.data.chainIdentifier!==MAINNET)throw Error('invalid-sui-network');
 const checkpoint=body.data.checkpoint,sourceAt=Date.parse(checkpoint?.timestamp),sequence=checkpoint?.sequenceNumber;
 const nodes=checkpoint?.query?.transactions?.nodes;
 if(!Number.isSafeInteger(sequence)||sequence<1||!Number.isSafeInteger(sourceAt)||sourceAt>now+300000||now-sourceAt>=MAX_AGE||typeof checkpoint.digest!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(checkpoint.digest)||!Array.isArray(nodes))throw Error('invalid-sui-checkpoint');
 const balances=new Map();
 for(const row of nodes.slice(0,MAX_TRANSACTIONS)){
  const sender=row?.sender,id=typeof sender?.address==='string'?sender.address.toLowerCase():'';
  const raw=String(sender?.balance?.totalBalance??'');
  if(!/^0x[0-9a-f]{64}$/.test(id)||!/^\d{1,30}$/.test(raw))continue;
  const value=Number(raw)/1e9;
  if(!Number.isFinite(value)||value<=0)continue;
  // A repeated sender must have one balance at this checkpoint. Conflicting
  // duplicates would imply mixed snapshots, so reject instead of picking one.
  if(balances.has(id)&&balances.get(id)!==value)throw Error('inconsistent-sui-checkpoint-balances');
  balances.set(id,value);
 }
 const records=[...balances].map(([id,tokenBalance])=>({id,tokenBalance}));
 if(!records.length)throw Error('empty-sui-native-balances');
 return {records,totalHolders:null,complete:false,truncated:false,supply:null,referencePrice:null,referenceMarketCap:null,source:'Sui public GraphQL checkpoint balances',scope:'recent-transaction-senders-excludes-staked-sui',coverage:'recent-account-sample',sourceAt,sourceCheckpoint:sequence,sourceCheckpointDigest:checkpoint.digest,indexCadence:'finalized-checkpoint',balanceBasis:'coin-objects-and-address-accumulator-at-checkpoint'};
}
