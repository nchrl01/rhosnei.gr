import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCosmosExtraNative} from '../cloudflare/insightx/native-provider-cosmos-extra.js';
const cases=[['LUNC','terra-luna','terra','terra','uluna',6],['BABY','babylon','babylon-genesis','bbn','ubbn',6],['MANTRA','mantra','mantra','mantra','amantra',18],['HASH','hash-2','provenance','pb','nhash',9],['RUNE','thorchain','thorchain','thor','rune',8]];
test('Cosmos native mappings use exact denoms and decimals and never a holder census',async()=>{
 for(const [symbol,id,chain,prefix,denom,decimals] of cases){
  const asset={symbol,id,chain,provider:'cosmos-directory'},address=prefix+'1'+'q'.repeat(38);
  const row={address,balance:{denom,amount:'1'+'0'.repeat(decimals)}};
  const result=await loadCosmosExtraNative(asset,async url=>{assert.ok(url.includes('/denom_owners/'+denom));return {denom_owners:[row,row,{...row,address:prefix+'1'+'p'.repeat(38),balance:{denom:'wrong-token',amount:row.balance.amount}}],pagination:{total:'99999'}};});
  assert.equal(result.records.length,1);assert.equal(result.records[0].tokenBalance,1);assert.equal(result.totalHolders,null);assert.equal(result.sourceAt,null);assert.equal(result.coverage,'ledger-account-sample');
 }
});
test('Cosmos adapter rejects other assets/chains/providers before calling an API',async()=>{
 for(const overrides of [{id:'other'},{chain:'other'},{provider:'other'},{symbol:'TCY'}])await assert.rejects(loadCosmosExtraNative({symbol:'RUNE',id:'thorchain',chain:'thorchain',provider:'cosmos-directory',...overrides},async()=>{assert.fail('unexpected API');}),/unsupported-native-provider/);
});
test('Cosmos adapter rejects invalid and zero balances',async()=>{
 await assert.rejects(loadCosmosExtraNative({symbol:'LUNC',id:'terra-luna',chain:'terra',provider:'cosmos-directory'},async()=>({denom_owners:[{address:'terra1'+'q'.repeat(38),balance:{denom:'uluna',amount:'0'}}]})),/empty-native/);
});
