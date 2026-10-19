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
 let discovery=block,accounts=[];for(let offset=0;offset<6;offset++){if(offset)discovery=await rpc('getblock',[count-1-offset,1]);if(discovery?.index!==count-1-offset||!Array.isArray(discovery.tx))throw Error('invalid-neo-block');accounts=[...new Set(discovery.tx.flatMap(tx=>[tx.sender,...(tx.signers||[]).map(s=>s.account)]).filter(a=>typeof a==='string'&&(/^(N[1-9A-HJ-NP-Za-km-z]{33})$/.test(a)||/^0x[0-9a-f]{40}$/.test(a))))];if(accounts.length)break;}
 const records=[];for(const account of accounts.slice(0,3)){const data=await rpc('getnep17balances',[account]);if(!Array.isArray(data?.balance))throw Error('invalid-neo-balance');const row=data.balance.find(r=>r.assethash===nativeHash);if(!row)continue;if(row.symbol!=='NEO'||row.decimals!=='0'||typeof row.amount!=='string'||!/^\d{1,9}$/.test(row.amount))throw Error('invalid-neo-balance');const tokenBalance=Number(row.amount);if(tokenBalance>0)records.push({id:account,tokenBalance});}
 if(!records.length)throw Error('empty-native-account-sample');return {records,source:'COZ Neo N3 public native balances',scope:'recent-transaction-signers-NEO-only-excludes-GAS',coverage:'recent-account-sample',sourceAt:null,indexTipAt,totalHolders:null,complete:false,supply:null,referencePrice:null,referenceMarketCap:null};
}
