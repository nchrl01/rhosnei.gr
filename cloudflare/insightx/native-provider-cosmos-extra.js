// Exact native denoms, decimal units and CoinGecko identities from:
// https://github.com/cosmos/chain-registry (mainnet assetlist.json files).
// Public application API: https://github.com/eco-stake/cosmos-directory#api-documentation
const CHAINS=Object.freeze({
 LUNC:{id:'terra-luna',chain:'terra',route:'terra',denom:'uluna',decimals:6,prefix:'terra'},
 BABY:{id:'babylon',chain:'babylon-genesis',route:'babylon',denom:'ubbn',decimals:6,prefix:'bbn'},
 MANTRA:{id:'mantra',chain:'mantra',route:'mantrachain',denom:'amantra',decimals:18,prefix:'mantra'},
 HASH:{id:'hash-2',chain:'provenance',route:'provenance',denom:'nhash',decimals:9,prefix:'pb'},
 RUNE:{id:'thorchain',chain:'thorchain',route:'thorchain',denom:'rune',decimals:8,prefix:'thor'},
});
export async function loadCosmosExtraNative(asset,read){
 const config=CHAINS[asset.symbol];
 if(!config||config.id!==asset.id||config.chain!==asset.chain||asset.provider!=='cosmos-directory')throw Error('unsupported-native-provider');
 const body=await read('https://rest.cosmos.directory/'+config.route+'/cosmos/bank/v1beta1/denom_owners/'+config.denom+'?pagination.limit=100');
 if(!Array.isArray(body?.denom_owners))throw Error('invalid-cosmos-native-balances');
 const seen=new Set(),records=[],address=new RegExp('^'+config.prefix+'1[023456789acdefghjklmnpqrstuvwxyz]{38,80}$');
 for(const row of body.denom_owners.slice(0,100)){
  const id=row.address,raw=row.balance?.amount;
  if(typeof id!=='string'||!address.test(id)||row.balance?.denom!==config.denom||typeof raw!=='string'||!/^\d{1,78}$/.test(raw)||seen.has(id))continue;
  const tokenBalance=Number(raw)/10**config.decimals;
  if(!Number.isFinite(tokenBalance)||tokenBalance<=0)continue;
  seen.add(id);records.push({id,tokenBalance});
 }
 if(!records.length)throw Error('empty-native-account-sample');
 // Bank ownership pages are not ranked by wealth and exclude bonded/delegated
 // funds. The API has no balance timestamp or total holder census.
 return {records,source:'Cosmos Directory '+asset.symbol+' bank balances',scope:'native-bank-balances-excludes-bonded-stake',coverage:'ledger-account-sample',totalHolders:null,complete:false,sourceAt:null,supply:null,referencePrice:null,referenceMarketCap:null,indexCadence:'provider-indexed'};
}
