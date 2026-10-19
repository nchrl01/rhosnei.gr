// https://docs.blockberry.one/reference/mina-graphqlarchive-nodes
// https://docs.minaprotocol.com/node-operators/validator-node/querying-data
// https://github.com/qubic/integration
const integer=value=>typeof value==='string'&&/^\d{1,78}$/.test(value);
const base=(records,source,scope,extra={})=>{if(!records.length)throw Error('empty-native-account-sample');return {records,source,scope,sourceAt:null,coverage:'recent-account-sample',totalHolders:null,complete:false,supply:null,referencePrice:null,referenceMarketCap:null,...extra};};
export async function loadMinaNative(read,now=Date.now()){
 const query='{networkID bestChain(maxLength:10){stateHash protocolState{blockchainState{date}} creatorAccount{publicKey balance{total blockHeight stateHash}}}}';
 const body=await read('https://api.minascan.io/node/mainnet/v1/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});
 if(body?.errors||body?.data?.networkID!=='mina:mainnet'||!Array.isArray(body.data.bestChain)||!body.data.bestChain.length||body.data.bestChain.length>10)throw Error('invalid-mina-mainnet');
 const blocks=body.data.bestChain,indexTipAt=Math.max(...blocks.map(b=>Number(b.protocolState?.blockchainState?.date)));
 if(!Number.isSafeInteger(indexTipAt)||indexTipAt>now+300000||now-indexTipAt>=6*3600000)throw Error('native-index-delayed');
 const selected=new Map();let balanceState;
 for(const block of blocks){const a=block.creatorAccount,id=a?.publicKey,balance=a?.balance;if(typeof id!=='string'||!/^B62[1-9A-HJ-NP-Za-km-z]{52}$/.test(id)||!integer(balance?.total)||typeof balance.stateHash!=='string'||!/^3N[1-9A-HJ-NP-Za-km-z]{48,55}$/.test(balance.stateHash))throw Error('invalid-mina-balance');
  if(balanceState&&balance.stateHash!==balanceState)throw Error('mixed-mina-state');balanceState=balance.stateHash;
  const tokenBalance=Number(balance.total)/1e9;if(!Number.isFinite(tokenBalance))throw Error('invalid-mina-balance');if(selected.has(id)&&selected.get(id)!==tokenBalance)throw Error('mixed-mina-state');if(tokenBalance>0)selected.set(id,tokenBalance);
 }
 const matching=blocks.find(b=>b.stateHash===balanceState),sourceAt=matching?Number(matching.protocolState.blockchainState.date):null;
 return base([...selected].map(([id,tokenBalance])=>({id,tokenBalance})),'Minascan public Mina native balances','recent-block-producer-account-balances',{indexTipAt,sourceAt,sourceBlockHash:balanceState});
}
export async function loadQubicNative(read){
 const origin='https://rpc.qubic.org',status=await read(origin+'/v1/status'),tick=status?.lastProcessedTick?.tickNumber;
 if(!Number.isSafeInteger(tick)||tick<=0)throw Error('invalid-qubic-tip');
 const list=await read(origin+'/v1/rich-list');if(!Array.isArray(list?.richList?.entities))throw Error('invalid-qubic-accounts');
 const ids=[...new Set(list.richList.entities.slice(0,100).map(r=>r.identity).filter(id=>typeof id==='string'&&/^[A-Z]{60}$/.test(id)))].slice(0,3),records=[];
 for(const id of ids){const row=(await read(origin+'/v1/balances/'+id))?.balance;if(row?.id!==id||!integer(row.balance)||!Number.isSafeInteger(row.validForTick)||row.validForTick<tick-2000)throw Error('invalid-qubic-balance');const tokenBalance=Number(row.balance);if(!Number.isSafeInteger(tokenBalance)||tokenBalance<0)throw Error('invalid-qubic-balance');if(tokenBalance>0)records.push({id,tokenBalance});}
 return base(records,'Qubic official current native balances','current-balances-of-indexed-richlist-members',{membershipEpoch:list.epoch,indexTip:tick});
}
// Official mainnet endpoint and schema:
// https://github.com/Concordium/concordium-scan/blob/main/frontend/.env.mainnet
// https://github.com/Concordium/concordium-scan/blob/main/backend/schema.graphql
export async function loadConcordiumNative(read,now=Date.now()){
 const query='{blocks(first:1){nodes{blockHeight blockSlotTime}} accounts(first:100,sort:AMOUNT_DESC){nodes{address{asString} amount}}}',body=await read('https://api-ccdscan-fungy.mainnet.concordium.software/api/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});
 const block=body?.data?.blocks?.nodes?.[0],rows=body?.data?.accounts?.nodes,indexTipAt=Date.parse(block?.blockSlotTime);
 if(body?.errors||!Number.isSafeInteger(block?.blockHeight)||!Array.isArray(rows)||rows.length>100)throw Error('invalid-concordium-mainnet');
 if(!Number.isSafeInteger(indexTipAt)||indexTipAt>now+300000||now-indexTipAt>=21600000)throw Error('native-index-delayed');
 const seen=new Set(),records=[];for(const row of rows){const id=row.address?.asString;let raw=row.amount;if(typeof raw==='number'&&Number.isSafeInteger(raw)&&raw>=0)raw=String(raw);if(typeof id!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{48,52}$/.test(id)||!integer(raw)||seen.has(id))throw Error('invalid-concordium-balance');seen.add(id);const tokenBalance=Number(raw)/1e6;if(!Number.isFinite(tokenBalance))throw Error('invalid-native-balance');if(tokenBalance>0)records.push({id,tokenBalance});}
 return base(records,'Official CCDScan mainnet native balances','indexed-native-account-total-balances-including-locked-CCD-excludes-PLT',{indexTipAt});
}
