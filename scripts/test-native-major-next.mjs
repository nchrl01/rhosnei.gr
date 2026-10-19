import test from 'node:test';
import assert from 'node:assert/strict';
import {loadNearNative,loadAptosNative} from '../cloudflare/insightx/native-provider-major-next.js';
const now=1792425414000,blockHash='1'.repeat(44),otherHash='2'.repeat(44);
const block={header:{hash:blockHash,height:100,timestamp_nanosec:String(BigInt(now)*1000000n)}};
const effects={block_hash:blockHash,changes:[{account_id:'alice.near',type:'account_touched'},{account_id:'bob.near',type:'account_touched'},{account_id:'ignored.near',type:'data_touched'}]};
const update=(id,amount,locked='0')=>({type:'account_update',change:{account_id:id,amount,locked}});
test('NEAR pins all state calls to one finalized block and takes the final actual balance',async()=>{
 const calls=[];const data=await loadNearNative(async(url,options)=>{
  const req=JSON.parse(options.body);calls.push(req);assert.equal(url,'https://free.rpc.fastnear.com');
  if(req.method==='block'){assert.equal(req.params.finality,'final');return{result:block};}
  assert.equal(req.params.block_id,blockHash);
  if(req.method==='block_effects')return{result:effects};
  assert.deepEqual(req.params.account_ids,['alice.near','bob.near']);
  return{result:{block_hash:blockHash,changes:[update('alice.near','1000000000000000000000000'),update('alice.near','2000000000000000000000000','3000000000000000000000000'),update('bob.near','1000000000000000000000000'),{type:'account_deletion',change:{account_id:'bob.near'}},update('unrequested.near','9999999999999999999999999')]}};
 },now);
 assert.equal(calls.length,3);assert.deepEqual(data.records,[{id:'alice.near',tokenBalance:5}]);assert.equal(data.sourceAt,now);assert.equal(data.totalHolders,null);assert.equal(data.coverage,'recent-account-sample');assert.equal(data.supply,null);
});
test('NEAR rejects stale finality, changed ledger, and quota errors without extra requests',async()=>{
 let count=0;await assert.rejects(()=>loadNearNative(async()=>{count++;return{result:{header:{...block.header,timestamp_nanosec:String(BigInt(now-7*3600000)*1000000n)}}};},now),/invalid-near-finalized-block/);assert.equal(count,1);
 count=0;await assert.rejects(()=>loadNearNative(async()=>({result:++count===1?block:{...effects,block_hash:otherHash}}),now),/invalid-near-block-effects/);assert.equal(count,2);
 count=0;await assert.rejects(()=>loadNearNative(async()=>{count++;if(count===1)return{result:block};throw Error('provider-429');},now),/provider-429/);assert.equal(count,2);
});
test('NEAR bounds selected accounts to100 and removes a malformed final balance',async()=>{
 let calls=0;const many=Array.from({length:120},(_,i)=>({account_id:'a'+i+'.near',type:'account_touched'}));
 const data=await loadNearNative(async(url,options)=>{
  const req=JSON.parse(options.body);calls++;
  if(calls===1)return{result:block};if(calls===2)return{result:{block_hash:blockHash,changes:many}};
  assert.equal(req.params.account_ids.length,100);
  return{result:{block_hash:blockHash,changes:[update('a0.near','1000000000000000000000000'),update('a0.near','invalid'),update('a99.near','1000000000000000000000000'),update('a100.near','9999999999999999999999999')]}};
 },now);
 assert.deepEqual(data.records,[{id:'a99.near',tokenBalance:1}]);
});

const aptType='0x1::aptos_coin::AptosCoin',aptFa='0x'+'0'.repeat(63)+'a',aptId='0x'+'1'.repeat(64),aptStore='0x'+'2'.repeat(64);
const aptData=rows=>({data:{ledger_infos:[{chain_id:1}],processor_status:[{processor:'fungible_asset_processor',last_success_version:100,last_transaction_timestamp:new Date(now).toISOString().replace('Z','')}],fungible_asset_metadata:[{asset_type:aptType,decimals:8}],current_fungible_asset_balances:rows}});
const aptRow={owner_address:aptId,storage_id:aptStore,asset_type:aptType,asset_type_v2:aptFa,amount:'123456789',is_primary:true,last_transaction_version:90};
test('APT uses the unified native primary balance once and preserves indexer-time provenance',async()=>{
 let calls=0;const value=await loadAptosNative(async(url,options)=>{calls++;assert.equal(url,'https://api.mainnet.aptoslabs.com/v1/graphql');assert.match(JSON.parse(options.body).query,/limit:100/);return aptData([aptRow,{...aptRow,owner_address:'0x'+'3'.repeat(64),asset_type_v2:'0x'+'4'.repeat(64)},{...aptRow,is_primary:false},{...aptRow,asset_type:'fake::APT'}]);},now);
 assert.equal(calls,1);assert.deepEqual(value.records,[{id:aptId,tokenBalance:1.23456789}]);assert.equal(value.sourceAt,null);assert.equal(value.indexerAt,now);assert.equal(value.totalHolders,null);
});
test('APT rejects stale or wrong processor status, testnet, and duplicate primary owners',async()=>{
 const stale=aptData([aptRow]);stale.data.processor_status[0].last_transaction_timestamp=new Date(now-7*3600000).toISOString();await assert.rejects(()=>loadAptosNative(async()=>stale,now),/invalid-aptos/);
 const wrong=aptData([aptRow]);wrong.data.processor_status[0].processor='parquet_fungible_asset_processor';await assert.rejects(()=>loadAptosNative(async()=>wrong,now),/invalid-aptos/);
 const testnet=aptData([aptRow]);testnet.data.ledger_infos[0].chain_id=2;await assert.rejects(()=>loadAptosNative(async()=>testnet,now),/invalid-aptos/);
 await assert.rejects(()=>loadAptosNative(async()=>aptData([aptRow,{...aptRow,storage_id:'0x'+'3'.repeat(64)}]),now),/duplicate-aptos/);
});
test('APT fails closed on GraphQL errors and unsupported native metadata',async()=>{
 let calls=0;await assert.rejects(()=>loadAptosNative(async()=>{calls++;return{errors:[{message:'Rate limit exceeded'}]};},now),/aptos-graphql-error/);assert.equal(calls,1);
 const wrong=aptData([aptRow]);wrong.data.fungible_asset_metadata[0].decimals=18;await assert.rejects(()=>loadAptosNative(async()=>wrong,now),/invalid-aptos/);
 await assert.rejects(()=>loadAptosNative(async()=>aptData([{...aptRow,last_transaction_version:101}]),now),/empty-aptos/);
});
