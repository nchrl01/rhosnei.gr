// Fixed mainnet public sources; no arbitrary endpoint or address supplied by users.
// https://docs.ont.io/developer-tools/api/http-api/remote-process-call-rpc
// https://api.ergoplatform.com/api/v1/docs/openapi
// https://docs.antelope.io/reference/client-libraries/chain-api/
// https://www.vaulta.com/resources/vaulta-token-swap-a-begins-may-14
// https://docs.arweave.org/developers/arweave-node-server/http-api
// https://github.com/decred/dcrdata/blob/master/docs/API.md
// https://docs.whatsonchain.com/
const HOUR=3600000,hex=/^[0-9a-f]{64}$/i,b58=/^[1-9A-HJ-NP-Za-km-z]{25,120}$/;
const fresh=(at,now)=>Number.isSafeInteger(at)&&at<=now+300000&&now-at<6*HOUR;
const units=(s,d)=>typeof s==='string'&&/^\d{1,78}$/.test(s)?Number(s)/10**d:NaN;
const base=(records,source,scope,indexTipAt)=>{if(!records.length)throw Error('empty-native-account-sample');return {records,source,scope,indexTipAt,sourceAt:null,coverage:'recent-account-sample',totalHolders:null,complete:false,supply:null,referencePrice:null,referenceMarketCap:null};};
const jsonPost=(body)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function ont(asset,read,now){
 const endpoint='https://dappnode1.ont.io:10336';
 const rpc=async(method,params=[])=>{const d=await read(endpoint,jsonPost({jsonrpc:'2.0',id:1,method,params}));if(d?.error!==0||d?.id!==1||d?.desc!=='SUCCESS')throw Error('invalid-ontology-rpc');return d.result;};
 if(await rpc('getnetworkid')!==1)throw Error('native-chain-mismatch');const count=await rpc('getblockcount');if(!Number.isSafeInteger(count)||count<2)throw Error('invalid-native-tip');
 const block=await rpc('getblock',[count-1,1]),indexTipAt=Number(block?.Header?.Timestamp)*1000;
 if(!fresh(indexTipAt,now)||block?.Header?.Height!==count-1||!Array.isArray(block.Transactions))throw Error('native-index-delayed');
 let remaining=3,discovery=block;if(!block.Transactions.some(t=>t.Payer)&&count>2){discovery=await rpc('getblock',[count-2,1]);remaining=2;if(discovery?.Header?.Height!==count-2||!fresh(Number(discovery?.Header?.Timestamp)*1000,now)||!Array.isArray(discovery.Transactions))throw Error('invalid-ontology-block');}
 const ids=[...new Set([...discovery.Transactions.map(t=>t.Payer),discovery.Header?.NextBookkeeper].filter(id=>typeof id==='string'&&/^A[1-9A-HJ-NP-Za-km-z]{33}$/.test(id)))].slice(0,remaining),records=[];
 for(const id of ids){const row=await rpc('getbalancev2',[id]);if(!/^\d+$/.test(String(row?.height))||Number(row.height)<count-1)throw Error('native-index-delayed');const tokenBalance=units(row?.[asset.symbol.toLowerCase()],asset.symbol==='ONT'?9:18);if(!Number.isFinite(tokenBalance)||tokenBalance<0)throw Error('invalid-native-balance');if(tokenBalance>0)records.push({id,tokenBalance});}
 return base(records,'Ontology official '+asset.symbol+' native balances','recent-payers-and-consensus-account-'+asset.symbol.toLowerCase()+'-only',indexTipAt);
}
async function ergo(read,now){
 const origin='https://api.ergoplatform.com',list=await read(origin+'/api/v1/blocks?limit=4&sortBy=height&sortDirection=desc');if(!Array.isArray(list?.items))throw Error('invalid-ergo-tip');const indexTipAt=list.items[0]?.timestamp;if(!fresh(indexTipAt,now))throw Error('native-index-delayed');
 const ids=[...new Set(list.items.filter(b=>fresh(b.timestamp,now)).map(b=>b.miner?.address).filter(id=>typeof id==='string'&&b58.test(id)))].slice(0,4),records=[];
 for(const id of ids){let row;try{row=await read(origin+'/api/v1/addresses/'+id+'/balance/confirmed');}catch(error){if(records.length)break;throw error;}if(!Number.isSafeInteger(row?.nanoErgs)||row.nanoErgs<0)throw Error('invalid-ergo-balance');if(row.nanoErgs>0)records.push({id,tokenBalance:row.nanoErgs/1e9});}
 return base(records,'Ergo official confirmed native balances','recent-miners-confirmed-erg-only-excludes-tokens',indexTipAt);
}
async function vaulta(read,now){
 const origin='https://eos.greymass.com/v1/chain/',info=await read(origin+'get_info',jsonPost({})),indexTipAt=Date.parse(info?.head_block_time+'Z');
 if(info?.chain_id!=='aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'||!fresh(indexTipAt,now))throw Error('native-chain-mismatch');
 const list=await read(origin+'get_producers',jsonPost({json:true,limit:4}));if(!Array.isArray(list?.rows))throw Error('invalid-vaulta-producers');const records=[];
 for(const row of list.rows.slice(0,4)){const id=row.owner;if(typeof id!=='string'||!/^[a-z1-5.]{1,12}$/.test(id))continue;const balances=await read(origin+'get_currency_balance',jsonPost({code:'core.vaulta',account:id,symbol:'A'}));if(!Array.isArray(balances)||balances.length>1)throw Error('invalid-vaulta-balance');if(!balances.length)continue;const m=/^(\d{1,30}\.\d{4}) A$/.exec(balances[0]);if(!m)throw Error('invalid-vaulta-balance');const tokenBalance=Number(m[1]);if(tokenBalance>0)records.push({id,tokenBalance});}
 return base(records,'Greymass Vaulta native A balances','active-producer-accounts-core.vaulta-A-only-excludes-EOS',indexTipAt);
}
async function arweave(read,now){
 const origin='https://arweave.net',info=await read(origin+'/info');if(info?.network!=='arweave.N.1')throw Error('native-chain-mismatch');
 const block=await read(origin+'/block/current'),indexTipAt=Number(block?.timestamp)*1000;if(!fresh(indexTipAt,now)||!Number.isSafeInteger(block.height)||Math.abs(block.height-info.height)>4)throw Error('native-index-delayed');
 const ids=[block.reward_addr].filter(id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{43}$/.test(id)),records=[];
 for(const id of ids){const raw=(await read(origin+'/wallet/'+id+'/balance',{nativeText:true})).trim();const tokenBalance=units(raw,12);if(!Number.isFinite(tokenBalance)||tokenBalance<0)throw Error('invalid-arweave-balance');if(tokenBalance>0)records.push({id,tokenBalance});}
 return base(records,'Arweave public native balances','current-miner-wallet-balance-only',indexTipAt);
}
async function decred(read,now){
 const origin='https://dcrdata.decred.org/api',tip=await read(origin+'/block/best'),indexTipAt=Number(tip?.time)*1000;
 if(!fresh(indexTipAt,now)||!hex.test(tip?.hash||'')||!Number.isSafeInteger(tip.height))throw Error('native-index-delayed');
 const hashes=await read(origin+'/block/'+tip.height+'/tx');if(!Array.isArray(hashes?.tx)||!hex.test(hashes.tx[0]||''))throw Error('empty-native-account-sample');const tx=await read(origin+'/tx/'+hashes.tx[0]);if(tx?.txid!==hashes.tx[0]||!Array.isArray(tx.vout))throw Error('invalid-decred-transaction');
 const ids=[...new Set(tx.vout.flatMap(v=>v.scriptPubKey?.addresses||[]).filter(id=>typeof id==='string'&&/^D[1-9A-HJ-NP-Za-km-z]{25,45}$/.test(id)))].slice(0,3),records=[];
 for(const id of ids){const row=await read(origin+'/address/'+id+'/totals');const tokenBalance=row?.dcr_unspent;if(row?.address!==id||!Number.isFinite(tokenBalance)||tokenBalance<0)throw Error('invalid-decred-balance');if(tokenBalance>0)records.push({id,tokenBalance});}
 return base(records,'Decred official dcrdata balances','recent-confirmed-output-addresses',indexTipAt);
}
async function bsv(read,now){
 const origin='https://api.whatsonchain.com/v1/bsv/main',info=await read(origin+'/chain/info');if(info?.chain!=='main'||!hex.test(info.bestblockhash||''))throw Error('native-chain-mismatch');const block=await read(origin+'/block/hash/'+info.bestblockhash),indexTipAt=Number(block?.time)*1000;
 if(block?.hash!==info.bestblockhash||!fresh(indexTipAt,now)||!Array.isArray(block.tx)||!hex.test(block.tx[0]||''))throw Error('native-index-delayed');
 const tx=await read(origin+'/tx/hash/'+block.tx[0]);if(tx?.txid!==block.tx[0]||!Array.isArray(tx.vout))throw Error('invalid-bsv-transaction');
 const ids=[...new Set(tx.vout.flatMap(v=>v.scriptPubKey?.addresses||[]).filter(id=>typeof id==='string'&&b58.test(id)))].slice(0,3),records=[];
 for(const id of ids){const row=await read(origin+'/address/'+id+'/balance');if(!Number.isSafeInteger(row?.confirmed)||row.confirmed<0)throw Error('invalid-bsv-balance');if(row.confirmed>0)records.push({id,tokenBalance:row.confirmed/1e8});}
 return base(records,'WhatsOnChain BSV confirmed balances','recent-confirmed-coinbase-output-addresses',indexTipAt);
}
async function casper(read,now){
 const endpoint='https://node.mainnet.casper.network/rpc';
 const rpc=async(method,params={})=>{const d=await read(endpoint,jsonPost({jsonrpc:'2.0',id:1,method,params}));if(d?.error)throw Object.assign(Error('casper-rpc-unavailable'),{code:d.error.code});if(d?.id!==1||!d.result)throw Error('invalid-casper-rpc');return d.result;};
 const info=await rpc('info_get_status'),block=info.last_added_block_info,sourceAt=Date.parse(block?.timestamp);
 if(info.chainspec_name!=='casper'||!fresh(sourceAt,now)||!hex.test(block?.state_root_hash||''))throw Error('native-chain-mismatch');
 const ids=[...new Set([block.creator,info.our_public_signing_key].filter(id=>typeof id==='string'&&/^(?:01[0-9a-f]{64}|02[0-9a-f]{66})$/i.test(id)))],records=[];
 for(const id of ids){let value;try{value=await rpc('query_balance',{state_identifier:{StateRootHash:block.state_root_hash},purse_identifier:{main_purse_under_public_key:id}});}catch(error){if(error.code===-32026)continue;throw error;}const tokenBalance=units(value.balance,9);if(!Number.isFinite(tokenBalance)||tokenBalance<0)throw Error('invalid-casper-balance');if(tokenBalance>0)records.push({id,tokenBalance});}
 return {...base(records,'Casper official state-pinned native balances','recent-block-creator-and-node-main-purses-excludes-staked-purses',sourceAt),sourceAt,sourceBlockHash:block.hash};
}
const IDS={CSPR:['casper-network','casper-network'],ONT:['ontology','ontology'],ONG:['ong','ontology'],ERG:['ergo','ergo'],A:['vaulta','eos'],AR:['arweave','arweave'],DCR:['decred','decred'],BSV:['bitcoin-cash-sv','bitcoin-sv']};
export async function loadLedgerExtraNative(asset,read,now=Date.now()){
 const id=IDS[asset.symbol];if(!id||id[0]!==asset.id||id[1]!==asset.chain||asset.provider!=='ledger-'+asset.symbol.toLowerCase())throw Error('unsupported-native-provider');
 if(asset.symbol==='CSPR')return casper(read,now);if(['ONT','ONG'].includes(asset.symbol))return ont(asset,read,now);if(asset.symbol==='ERG')return ergo(read,now);if(asset.symbol==='A')return vaulta(read,now);if(asset.symbol==='AR')return arweave(read,now);if(asset.symbol==='DCR')return decred(read,now);return bsv(read,now);
}
