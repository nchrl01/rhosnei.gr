import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTonNative,loadCardanoNative,loadCosmosNative,loadKaspaNative} from '../cloudflare/insightx/native-provider-next.js';
import {catalogueNative,nativeCoin} from '../apps/web/public/native-coins.js';
const now=Date.now();
test('TON native balances use nanotons without inventing source age or holder count',async()=>{
 const id='0:'+ 'a'.repeat(64);const value=await loadTonNative(async()=>[{account:id.toUpperCase(),balance:'1234567890'},{account:id,balance:'999'},{account:'invalid',balance:'1'}]);
 assert.deepEqual(value.records,[{id,tokenBalance:1.23456789}]);assert.equal(value.totalHolders,null);assert.equal(value.sourceAt,null);
 assert.equal(catalogueNative({id:'tokamak-network',symbol:'TON',chain:'ethereum',address:'0x2be5e8c109e2197d077d13a82daead6a9b3433c5'}),null);
 assert.equal(nativeCoin('TON'),null);
});
test('Cardano uses bounded stake credential UTXOs, excluding rewards and unrequested identities',async()=>{
 const id='stake1'+'q'.repeat(53);let calls=0;
 const data=await loadCardanoNative(async(url,options)=>{calls++;if(!options)return [{stake_address:id}];assert.deepEqual(JSON.parse(options.body),{_stake_addresses:[id]});return [{stake_address:id,utxo:'1234567',total_balance:'9999999',rewards_available:'8765432'},{stake_address:'stake1'+'p'.repeat(53),utxo:'12345'}];});
 assert.equal(calls,2);assert.deepEqual(data.records,[{id,tokenBalance:1.234567}]);assert.match(data.scope,/excludes-rewards/);assert.equal(data.totalHolders,null);
});
test('ATOM sample accepts only the native bank denom and keeps delegation outside coverage',async()=>{
 const id='cosmos1'+'q'.repeat(38);const data=await loadCosmosNative(async()=>({denom_owners:[{address:id,balance:{denom:'uatom',amount:'1234567'}},{address:'cosmos1'+'p'.repeat(38),balance:{denom:'ibc/foreign',amount:'999999999'}}]}));
 assert.deepEqual(data.records,[{id,tokenBalance:1.234567}]);assert.match(data.scope,/excludes-delegated/);assert.equal(data.sourceAt,null);
});
test('Kaspa selects from ranking but uses actual sompi balances, not rounded rich-list amounts',async()=>{
 const id='kaspa:'+'q'.repeat(61);let calls=0;const data=await loadKaspaNative(async(url,options)=>{calls++;if(!options)return[{timestamp:now,ranking:[{address:id,amount:99999}]}];assert.deepEqual(JSON.parse(options.body),{addresses:[id]});return[{address:id,balance:123456789},{address:'kaspa:'+'p'.repeat(61),balance:999999999}];},now);
 assert.equal(calls,2);assert.deepEqual(data.records,[{id,tokenBalance:1.23456789}]);assert.equal(data.sourceAt,null);assert.equal(data.membershipAt,now);
 await assert.rejects(()=>loadKaspaNative(async()=>[{timestamp:now-7*3600000,ranking:[]}],now),/invalid-kaspa/);
});
