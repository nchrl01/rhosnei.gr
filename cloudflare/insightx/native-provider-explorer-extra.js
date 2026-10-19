// Fixed public mainnet explorers and node APIs. Never treat rewards, votes,
// transaction outputs or address counts as current account balances.
// https://docs.fractalbitcoin.io/for-developers/developer-overview
// https://qtum.info/api/misc/rich-list
// https://explorer.runonflux.io/
// https://github.com/SiaFoundation/explored
// https://ardordocs.jelurida.com/Ardor_API
// https://docs.constellationnetwork.io/network-apis/
// https://www.coinset.org/ ; https://docs.chia.net/reference-client/rpc-reference/full-node-rpc/
// https://docs.nervos.org/docs/getting-started/ckb-networks
const fresh=(at,now)=>Number.isSafeInteger(at)&&at<=now+300000&&now-at<21600000;
const units=(raw,d)=>{if(typeof raw==='number'&&Number.isSafeInteger(raw)&&raw>=0)raw=String(raw);return typeof raw==='string'&&/^\d{1,78}$/.test(raw)?Number(raw)/10**d:NaN;};
const hex=value=>typeof value==='string'&&/^0x[0-9a-f]+$/i.test(value);
const base=(records,source,scope,indexTipAt)=>{if(!records.length)throw Error('empty-native-account-sample');return {records,source,scope,indexTipAt,sourceAt:null,coverage:'recent-account-sample',totalHolders:null,complete:false,supply:null,referencePrice:null,referenceMarketCap:null};};
const post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function qtum(read,now){
 const origin='https://qtum.info/api',info=await read(origin+'/info'),indexTipAt=Number(info?.blockTime)*1000;if(!fresh(indexTipAt,now))throw Error('native-index-delayed');
 const list=await read(origin+'/misc/rich-list');if(!Array.isArray(list?.list))throw Error('invalid-qtum-accounts');const seen=new Set(),records=[];
 for(const r of list.list.slice(0,100)){const id=r.address,tokenBalance=units(r.balance,8);if(typeof id!=='string'||!(/^[QM][1-9A-HJ-NP-Za-km-z]{33}$/.test(id)||/^qc1[023456789acdefghjklmnpqrstuvwxyz]{30,90}$/.test(id))||!Number.isFinite(tokenBalance)||tokenBalance<=0||seen.has(id))continue;seen.add(id);records.push({id,tokenBalance});}
 return base(records,'Qtum official indexed native balances','native-unspent-address-richlist',indexTipAt);
}
async function flux(read,now){
 const origin='https://explorer.runonflux.io/api',list=await read(origin+'/blocks'),indexTipAt=Number(list?.blocks?.[0]?.time)*1000;if(!Array.isArray(list?.blocks)||!fresh(indexTipAt,now))throw Error('native-index-delayed');
 const ids=[...new Set(list.blocks.filter(b=>b.isMainChain===true&&fresh(Number(b.time)*1000,now)).map(b=>b.minedBy).filter(id=>typeof id==='string'&&/^t[13][1-9A-HJ-NP-Za-km-z]{33}$/.test(id)))].slice(0,3),records=[];
 for(const id of ids){const r=await read(origin+'/addr/'+id+'?noTxList=1');if(r?.addrStr!==id||!Number.isSafeInteger(r.balanceSat)||r.balanceSat<0)throw Error('invalid-flux-balance');if(r.balanceSat>0)records.push({id,tokenBalance:r.balanceSat/1e8});}
 return base(records,'Flux official native address balances','recent-block-miners-confirmed-native-balances',indexTipAt);
}
async function sia(read,now){
 const origin='https://api.siascan.com',tip=await read(origin+'/consensus/tip');if(!/^[a-f0-9]{64}$/.test(tip?.id||''))throw Error('invalid-sia-tip');const block=await read(origin+'/blocks/'+tip.id),indexTipAt=Date.parse(block?.timestamp);if(block?.height!==tip.height||!fresh(indexTipAt,now)||!Array.isArray(block.minerPayouts))throw Error('native-index-delayed');
 const ids=[...new Set(block.minerPayouts.map(r=>r.siacoinOutput?.address).filter(id=>typeof id==='string'&&/^[a-f0-9]{76}$/.test(id)))].slice(0,3),records=[];
 for(const id of ids){const r=await read(origin+'/addresses/'+id+'/balance'),tokenBalance=units(r?.unspentSiacoins,24);if(!Number.isFinite(tokenBalance)||tokenBalance<0)throw Error('invalid-sia-balance');if(tokenBalance>0)records.push({id,tokenBalance});}
 return base(records,'Siascan native unspent balances','recent-miners-spendable-siacoins-excludes-immature-and-siafunds',indexTipAt);
}
async function ardor(read,now){
 const origin='https://ardor.jelurida.com/nxt?',info=await read(origin+'requestType=getBlockchainStatus');if(info?.application!=='Ardor'||info.isTestnet!==false||info.isScanning!==false)throw Error('native-chain-mismatch');
 const constants=await read(origin+'requestType=getConstants');if(!Number.isSafeInteger(constants?.epochBeginning))throw Error('invalid-ardor-epoch');
 const block=await read(origin+'requestType=getBlock&includeTransactions=true'),indexTipAt=constants.epochBeginning+Number(block?.timestamp)*1000;if(!fresh(indexTipAt,now)||!Array.isArray(block.transactions))throw Error('native-index-delayed');
 const ids=[...new Set([block.generatorRS,...block.transactions.map(t=>t.senderRS)].filter(id=>typeof id==='string'&&/^ARDOR-[A-Z0-9-]{20}$/.test(id)))].slice(0,3),records=[];
 for(const id of ids){const r=await read(origin+'requestType=getBalance&chain=1&account='+id),tokenBalance=units(r?.balanceNQT,8);if(!Number.isFinite(tokenBalance)||tokenBalance<0)throw Error('invalid-ardor-balance');if(tokenBalance>0)records.push({id,tokenBalance});}
 return base(records,'Jelurida Ardor native balances','parent-chain-ARDR-only-recent-generator-and-senders',indexTipAt);
}
async function dag(read,now){
 const origin='https://be-mainnet.constellationnetwork.io',tip=await read(origin+'/global-snapshots/latest'),indexTipAt=Date.parse(tip?.data?.timestamp);if(!fresh(indexTipAt,now))throw Error('native-index-delayed');
 const list=await read(origin+'/transactions?limit=5');if(!Array.isArray(list?.data))throw Error('invalid-dag-accounts');const ids=[...new Set(list.data.slice(0,5).flatMap(t=>[t.source,t.destination]).filter(id=>typeof id==='string'&&/^DAG[1-9A-HJ-NP-Za-km-z]{30,45}$/.test(id)))].slice(0,3),records=[];
 for(const id of ids){const r=(await read(origin+'/addresses/'+id+'/balance'))?.data,tokenBalance=units(r?.balance,8);if(r?.address!==id||!Number.isFinite(tokenBalance)||tokenBalance<0)throw Error('invalid-dag-balance');if(tokenBalance>0)records.push({id,tokenBalance});}
 return base(records,'Constellation public DAG native balances','recent-transactors-current-DAG-only',indexTipAt);
}
async function chia(read,now){
 const origin='https://api.coinset.org/',network=await read(origin+'get_network_info',post({}));if(network?.success!==true||network.network_name!=='mainnet'||network.network_prefix!=='xch')throw Error('native-chain-mismatch');
 const state=await read(origin+'get_blockchain_state',post({})),peak=state?.blockchain_state?.peak;let timestamp=peak?.timestamp,transactionHash=peak?.header_hash;if(timestamp==null&&/^0x[0-9a-f]{64}$/.test(peak?.prev_transaction_block_hash||'')){const previous=await read(origin+'get_block_record',post({header_hash:peak.prev_transaction_block_hash}));if(previous?.success!==true||previous.block_record?.header_hash!==peak.prev_transaction_block_hash)throw Error('invalid-chia-header');timestamp=previous.block_record.timestamp;transactionHash=previous.block_record.header_hash;}if(timestamp==null&&Number.isSafeInteger(peak?.prev_transaction_block_height)&&peak.prev_transaction_block_height>=0&&peak.prev_transaction_block_height<peak.height){const previous=await read(origin+'get_block_record_by_height',post({height:peak.prev_transaction_block_height}));if(previous?.success!==true||previous.block_record?.height!==peak.prev_transaction_block_height)throw Error('invalid-chia-header');timestamp=previous.block_record.timestamp;transactionHash=previous.block_record.header_hash;}const indexTipAt=Number(timestamp)*1000;if(state.success!==true||state.blockchain_state?.sync?.synced!==true||!fresh(indexTipAt,now))throw Error('native-index-delayed');
 const rewardHashes=[peak.farmer_puzzle_hash,peak.pool_puzzle_hash],outputHashes=[];
 // Recent transaction outputs avoid repeatedly scanning very large reward-pool
 // wallets. Membership comes from additions; balances still sum all unspent coins.
 if(typeof transactionHash==='string'&&/^0x[0-9a-f]{64}$/.test(transactionHash)){
  const changes=await read(origin+'get_additions_and_removals',post({header_hash:transactionHash}));if(changes?.success!==true||!Array.isArray(changes.additions))throw Error('invalid-chia-discovery');
  for(const row of changes.additions.slice(0,1000)){const id=row.coin?.puzzle_hash;if(typeof id==='string'&&/^0x[0-9a-f]{64}$/.test(id)&&!rewardHashes.includes(id))outputHashes.push(id);}
 }
 const ids=[...new Set((outputHashes.length?outputHashes:rewardHashes).filter(id=>typeof id==='string'&&/^0x[0-9a-f]{64}$/.test(id)))].slice(0,2),records=[];

 for(const id of ids){const result=await read(origin+'get_coin_records_by_puzzle_hash',post({puzzle_hash:id,include_spent_coins:false}));if(result?.success!==true||!Array.isArray(result.coin_records))throw Error('invalid-chia-coins');let balance=0n;const seen=new Set();
  for(const r of result.coin_records){const c=r.coin;if(r.spent!==false||c?.puzzle_hash!==id||!Number.isSafeInteger(c.amount)||c.amount<0||!/^0x[0-9a-f]{64}$/.test(c.parent_coin_info||''))throw Error('invalid-chia-coin');const key=c.parent_coin_info+':'+c.amount;if(seen.has(key))throw Error('duplicate-chia-coin');seen.add(key);balance+=BigInt(c.amount);}
  const tokenBalance=Number(balance)/1e12;if(!Number.isFinite(tokenBalance))throw Error('invalid-chia-balance');if(tokenBalance>0){records.push({id,tokenBalance});break;}
 }
 return base(records,'Coinset Chia mainnet native balances','recent-output-or-reward-puzzle-hashes-complete-unspent-coin-sums',indexTipAt);
}
async function fractal(read,now){
 const origin='https://mempool.fractalbitcoin.io/api',hash=(await read(origin+'/blocks/tip/hash',{nativeText:true})).trim();if(!/^[a-f0-9]{64}$/.test(hash))throw Error('invalid-fractal-tip');const block=await read(origin+'/block/'+hash),indexTipAt=Number(block?.timestamp)*1000;if(block?.id!==hash||!fresh(indexTipAt,now))throw Error('native-index-delayed');
 const txs=await read(origin+'/block/'+hash+'/txs/0');if(!Array.isArray(txs))throw Error('invalid-fractal-transactions');const ids=[...new Set(txs.slice(0,25).flatMap(tx=>tx.vout||[]).map(v=>v.scriptpubkey_address).filter(id=>typeof id==='string'&&(/^[13][1-9A-HJ-NP-Za-km-z]{25,40}$/.test(id)||/^bc1[023456789acdefghjklmnpqrstuvwxyz]{20,90}$/.test(id))))].slice(0,3),records=[];
 for(const id of ids){const row=await read(origin+'/address/'+id),s=row?.chain_stats;if(row?.address!==id||!Number.isSafeInteger(s?.funded_txo_sum)||!Number.isSafeInteger(s.spent_txo_sum)||s.funded_txo_sum<s.spent_txo_sum)throw Error('invalid-fractal-balance');const tokenBalance=(s.funded_txo_sum-s.spent_txo_sum)/1e8;if(tokenBalance>0)records.push({id,tokenBalance});}
 return base(records,'Fractal official mempool native balances','recent-confirmed-output-addresses-excludes-mempool',indexTipAt);
}
async function ckb(read,now){
 const endpoint='https://mainnet.ckb.dev',rpc=async(method,params=[])=>{const d=await read(endpoint,post({jsonrpc:'2.0',id:1,method,params}));if(d?.error||d?.id!==1||d.result===undefined)throw Error('invalid-ckb-rpc');return d.result;};
 const info=await rpc('get_blockchain_info');if(info?.chain!=='ckb'||info.is_initial_block_download!==false)throw Error('native-chain-mismatch');
 const tip=await rpc('get_tip_header'),indexTipAt=hex(tip?.timestamp)?Number(BigInt(tip.timestamp)):NaN;if(!fresh(indexTipAt,now)||!/^0x[0-9a-f]{64}$/.test(tip.hash||''))throw Error('native-index-delayed');
 const block=await rpc('get_block',[tip.hash]);if(block?.header?.hash!==tip.hash||!Array.isArray(block.transactions))throw Error('invalid-ckb-block');const scripts=new Map();
 scan:for(const t of block.transactions.slice(0,100))for(const o of (t.outputs||[])){const s=o.lock;if(!/^0x[0-9a-f]{64}$/.test(s?.code_hash||'')||!['type','data','data1','data2'].includes(s.hash_type)||!/^0x(?:[0-9a-f]{2}){1,25}$/.test(s.args||''))continue;const id='ckb:'+s.code_hash+':'+s.hash_type+':'+s.args;if(id.length<=150&&!scripts.has(id))scripts.set(id,{code_hash:s.code_hash,hash_type:s.hash_type,args:s.args});if(scripts.size===3)break scan;}
 const records=[];for(const [id,script] of [...scripts].slice(0,3)){const result=await rpc('get_cells_capacity',[{script,script_type:'lock',script_search_mode:'exact'}]);if(!hex(result?.capacity)||!hex(result.block_number)||BigInt(result.block_number)<BigInt(tip.number))throw Error('invalid-ckb-capacity');const tokenBalance=Number(BigInt(result.capacity))/1e8;if(!Number.isFinite(tokenBalance))throw Error('invalid-ckb-balance');if(tokenBalance>0)records.push({id,tokenBalance});}
 return base(records,'Nervos official native CKB capacity','current-unspent-native-capacity-by-recent-owner-lock-script',indexTipAt);
}
const IDENTITIES={QTUM:['qtum','qtum'],FLUX:['zelcash','flux'],SC:['siacoin','sia'],ARDR:['ardor','ardor'],DAG:['constellation-labs','constellation-network'],XCH:['chia','chia'],FB:['fractal-bitcoin','fractal-bitcoin'],CKB:['nervos-network','nervos-network']};
export async function loadExplorerExtraNative(asset,read,now=Date.now()){
 const id=IDENTITIES[asset.symbol];if(!id||id[0]!==asset.id||id[1]!==asset.chain||asset.provider!=='explorer-'+asset.symbol.toLowerCase())throw Error('unsupported-native-provider');
 return ({QTUM:qtum,FLUX:flux,SC:sia,ARDR:ardor,DAG:dag,XCH:chia,FB:fractal,CKB:ckb})[asset.symbol](read,now);
}
