// Fixed official public APIs. Units and scopes are asset-specific; list lengths
// and network account totals are never reported as holder counts.
// https://docs.multiversx.com/sdk-and-tools/rest-api/multiversx-api/
// https://api.ark.io/api/ (ARK Core v3)
// https://developers.hive.io/apidefinitions/condenser-api.html
// https://developers.steem.io/apidefinitions/condenser-api
// https://github.com/thetatoken/theta-infrastructure-ledger-explorer/blob/master/docs/api.md
// https://pi-apps.github.io/community-developer-guide/
const MAX_AGE=6*3600000;
const fresh=(at,now)=>Number.isSafeInteger(at)&&at<=now+300000&&now-at<MAX_AGE;
const time=value=>Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value||'')?value:value+'Z');
const decimal=(raw,scale)=>typeof raw==='string'&&/^\d{1,78}$/.test(raw)?Number(raw)/10**scale:NaN;
const unique=(rows,idOf,balanceOf,valid)=>{const seen=new Set(),records=[];for(const row of rows.slice(0,100)){const id=idOf(row),tokenBalance=balanceOf(row);if(!valid(id)||seen.has(id)||!Number.isFinite(tokenBalance)||tokenBalance<=0)continue;seen.add(id);records.push({id,tokenBalance});}if(!records.length)throw Error('empty-native-account-sample');return records;};
const base=(records,source,scope,extra={})=>({records,source,scope,coverage:'ledger-account-sample',sourceAt:null,totalHolders:null,complete:false,supply:null,referencePrice:null,referenceMarketCap:null,...extra});
async function rpc(read,url,method,params){const data=await read(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});if(data?.error||data?.id!==1||!Object.hasOwn(data||{},'result'))throw Error('invalid-native-rpc');return data.result;}
async function egld(read,now){
 const tip=await read('https://api.multiversx.com/blocks?size=1&sort=timestamp&order=desc&fields=timestamp');
 const indexTipAt=Number(tip?.[0]?.timestamp)*1000;if(!fresh(indexTipAt,now))throw Error('native-index-delayed');
 const rows=await read('https://api.multiversx.com/accounts?size=100&sort=balance&order=desc');if(!Array.isArray(rows))throw Error('invalid-multiversx-accounts');
 return base(unique(rows,r=>r.address,r=>decimal(r.balance,18),id=>typeof id==='string'&&/^erd1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(id)),'MultiversX public native balances','indexed-accounts-including-contracts-and-staking-module',{indexTipAt});
}
async function ark(read,now){
 const state=await read('https://api.ark.io/api/node/status'),indexTipAt=(1490101200+Number(state?.data?.timestamp))*1000;
 if(state?.data?.synced!==true||!fresh(indexTipAt,now))throw Error('native-index-delayed');
 const list=await read('https://api.ark.io/api/wallets?limit=100&orderBy=balance:desc');if(!Array.isArray(list?.data))throw Error('invalid-ark-accounts');
 return base(unique(list.data,r=>r.address,r=>decimal(r.balance,8),id=>typeof id==='string'&&/^A[1-9A-HJ-NP-Za-km-z]{33}$/.test(id)),'ARK public native balances','indexed-native-wallet-balances',{indexTipAt});
}
async function social(asset,read,now){
 const endpoint=asset.symbol==='HIVE'?'https://api.hive.blog':'https://api.steemit.com';
 const props=await rpc(read,endpoint,'condenser_api.get_dynamic_global_properties',[]),indexTipAt=time(props?.time);
 if(!fresh(indexTipAt,now)||!String(props?.current_supply||'').endsWith(' '+asset.symbol))throw Error('native-chain-mismatch');
 const names=await rpc(read,endpoint,'condenser_api.lookup_accounts',['',100]);if(!Array.isArray(names)||names.length>100||names.some(n=>typeof n!=='string'||!/^[a-z0-9.-]{3,16}$/.test(n)))throw Error('invalid-social-accounts');
 const rows=await rpc(read,endpoint,'condenser_api.get_accounts',[names]);if(!Array.isArray(rows))throw Error('invalid-social-balances');
 const allowed=new Set(names),pattern=new RegExp('^(\\d{1,30}(?:\\.\\d{1,3})?) '+asset.symbol+'$');
 return base(unique(rows,r=>r.name,r=>{const m=pattern.exec(r.balance||'');return m?Number(m[1]):NaN;},id=>allowed.has(id)),asset.symbol+' official public account balances','liquid-native-balance-excludes-savings-vesting-and-stablecoins',{indexTipAt});
}
async function theta(asset,read,now){
 const tip=await read('https://explorer-api.thetatoken.org/api/blocks/top_blocks?pageNumber=1&limit=3');
 const block=tip?.body?.find(b=>[4,5,6].includes(b.status)),indexTipAt=Number(block?.timestamp)*1000;if(!fresh(indexTipAt,now))throw Error('native-index-delayed');
 const token=asset.symbol==='THETA'?'theta':'tfuel',list=await read('https://explorer-api.thetatoken.org/api/account/top/'+token+'/100');
 if(list?.type!=='account_list'||!Array.isArray(list.body))throw Error('invalid-theta-accounts');
 return base(unique(list.body,r=>r.address?.toLowerCase(),r=>decimal(r.balance?.[token+'wei'],18),id=>typeof id==='string'&&/^0x[0-9a-f]{40}$/.test(id)),'Theta official '+asset.symbol+' account balances','liquid-'+token+'-balances-excludes-staked-theta',{indexTipAt});
}
async function pi(read,now){
 const endpoint='https://api.mainnet.minepi.com',info=await read(endpoint+'/'),indexTipAt=Date.parse(info?.history_latest_ledger_closed_at);
 if(info?.network_passphrase!=='Pi Network'||!fresh(indexTipAt,now))throw Error('native-chain-mismatch');
 const list=await read(endpoint+'/transactions?order=desc&limit=20');if(!Array.isArray(list?._embedded?.records))throw Error('invalid-pi-transactions');
 const ids=[...new Set(list._embedded.records.filter(t=>t.successful===true&&fresh(Date.parse(t.created_at),now)).map(t=>t.source_account).filter(id=>typeof id==='string'&&/^G[A-Z2-7]{55}$/.test(id)))].slice(0,4),records=[];
 for(const id of ids){let row;try{row=await read(endpoint+'/accounts/'+id);}catch(error){if(records.length)break;throw error;}if(row?.account_id!==id||!Array.isArray(row.balances))throw Error('invalid-pi-account');const values=row.balances.filter(b=>b.asset_type==='native');if(values.length!==1||!/^\d{1,30}\.\d{7}$/.test(values[0].balance))throw Error('invalid-pi-balance');const tokenBalance=Number(values[0].balance);if(tokenBalance>0)records.push({id,tokenBalance});}
 if(!records.length)throw Error('empty-native-account-sample');
 return base(records,'Pi official Horizon native balances','recent-senders-liquid-native-balances-excludes-unclaimed-lockups',{indexTipAt});
}
async function qrl(read){const rows=await read('https://richlist-api.theqrl.org/richlist?page=0');if(!Array.isArray(rows))throw Error('invalid-qrl-richlist');return base(unique(rows,r=>r.address,r=>Number.isSafeInteger(r.balance)?r.balance/1e9:NaN,id=>typeof id==='string'&&/^Q[0-9a-f]{78}$/i.test(id)),'QRL official native balances','indexed-public-native-richlist');}
const IDENTITIES={QRL:['quantum-resistant-ledger','qrl'],EGLD:['elrond-erd-2','elrond'],ARK:['ark','ark'],HIVE:['hive','hive'],STEEM:['steem','steem'],THETA:['theta-token','theta'],TFUEL:['theta-fuel','theta'],PI:['pi-network','pi-network']};
export async function loadPublicListNative(asset,read,now=Date.now()){
 const identity=IDENTITIES[asset.symbol];if(!identity||identity[0]!==asset.id||identity[1]!==asset.chain||asset.provider!=='public-list-'+asset.symbol.toLowerCase())throw Error('unsupported-native-provider');
 if(asset.symbol==='QRL')return qrl(read);if(asset.symbol==='EGLD')return egld(read,now);if(asset.symbol==='ARK')return ark(read,now);if(asset.symbol==='PI')return pi(read,now);if(['HIVE','STEEM'].includes(asset.symbol))return social(asset,read,now);return theta(asset,read,now);
}
