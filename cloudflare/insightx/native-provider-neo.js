// Mainnet N3 only. Native NeoToken is contract -5, not GAS or arbitrary NEP-17.
// https://docs.neo.org/docs/n3/reference/rpc/getnep17balances.html
// https://github.com/CityOfZion/neon-js/blob/master/packages/neon-core/src/wallet/core.ts
const nativeHash='0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5';
export async function loadNeoNative(read,now=Date.now()){
 const rpc=async(method,params=[])=>{const d=await read('https://mainnet1.neo.coz.io:443',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});if(d?.error||d?.id!==1||d.result===undefined)throw Error('invalid-neo-rpc');return d.result;};
 if((await rpc('getversion')).protocol?.network!==860833102)throw Error('native-chain-mismatch');
 const contract=await rpc('getcontractstate',[-5]);if(contract?.hash!==nativeHash||contract.manifest?.name!=='NeoToken')throw Error('native-chain-mismatch');
 const count=await rpc('getblockcount');if(!Number.isSafeInteger(count)||count<1)throw Error('invalid-native-tip');const block=await rpc('getblock',[count-1,1]),indexTipAt=block?.time;
 if(block?.index!==count-1||!Number.isSafeInteger(indexTipAt)||indexTipAt>now+300000||now-indexTipAt>=21600000)throw Error('native-index-delayed');
 // Native N3 account keys use prefix 20 followed by UInt160. Storage values
 // are discovery only; balances are read independently and filtered by contract.
 // https://github.com/neo-project/neo/blob/v3.8.2/src/Neo/SmartContract/Native/FungibleToken.cs
 const page=await rpc('findstorage',[-5,'FA==',0]);if(!Array.isArray(page?.results)||page.results.length>1000)throw Error('invalid-neo-accounts');const accounts=[];
 for(const row of page.results){if(typeof row.key!=='string'||row.key.length>40)throw Error('invalid-neo-account-key');let raw;try{raw=Uint8Array.from(atob(row.key),c=>c.charCodeAt(0));}catch{throw Error('invalid-neo-account-key');}if(raw.length!==21||raw[0]!==20)throw Error('invalid-neo-account-key');const hash=Array.from(raw.slice(1)).reverse().map(b=>b.toString(16).padStart(2,'0')).join('');if(!/^0{40}$/.test(hash)&&!accounts.includes('0x'+hash))accounts.push('0x'+hash);if(accounts.length===3)break;}
 const records=[];for(const account of accounts.slice(0,3)){const data=await rpc('getnep17balances',[account]);if(!Array.isArray(data?.balance))throw Error('invalid-neo-balance');const row=data.balance.find(r=>r.assethash===nativeHash);if(!row)continue;if(row.symbol!=='NEO'||row.decimals!=='0'||typeof row.amount!=='string'||!/^\d{1,9}$/.test(row.amount))throw Error('invalid-neo-balance');const tokenBalance=Number(row.amount);if(tokenBalance>0)records.push({id:account,tokenBalance});}
 if(!records.length)throw Error('empty-native-account-sample');return {records,source:'COZ Neo N3 public native balances',scope:'native-account-storage-members-current-NEO-only-excludes-GAS',coverage:'ledger-account-sample',sourceAt:null,indexTipAt,totalHolders:null,complete:false,supply:null,referencePrice:null,referenceMarketCap:null};
}
