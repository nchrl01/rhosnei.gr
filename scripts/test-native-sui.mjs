import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSuiNative} from '../cloudflare/insightx/native-provider-sui.js';
const now=Date.now(),sourceAt=now-1000;
const id='0x'+'a'.repeat(64),other='0x'+'b'.repeat(64);
const row=(address,totalBalance)=>({sender:{address,balance:{totalBalance,coinBalance:'1',addressBalance:'1234567890'}}});
const fixture=nodes=>({data:{chainIdentifier:'4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S',checkpoint:{sequenceNumber:123,timestamp:new Date(sourceAt).toISOString(),digest:'1'.repeat(43),query:{transactions:{nodes}}}}});
test('SUI reads one checkpoint-scoped query and total balance, including the address accumulator',async()=>{
 let calls=0;const value=await loadSuiNative(async(url,options)=>{calls++;assert.equal(url,'https://graphql.mainnet.sui.io/graphql');const query=JSON.parse(options.body).query;assert.match(query,/checkpoint[\s\S]*query[\s\S]*transactions\(last: 20\)/);assert.match(query,/totalBalance/);assert.doesNotMatch(query,/coinBalance/);return fixture([row(id,'1234567891'),row(id,'1234567891'),{sender:null},row(other,'0')]);},now);
 assert.equal(calls,1);assert.deepEqual(value.records,[{id,tokenBalance:1.234567891}]);assert.equal(value.sourceAt,sourceAt);assert.equal(value.sourceCheckpoint,123);assert.equal(value.totalHolders,null);assert.equal(value.complete,false);
});
test('SUI rejects stale/future checkpoints and a different network',async()=>{
 for(const stamp of [now-7*3600000,now+600000]){const body=fixture([row(id,'1')]);body.data.checkpoint.timestamp=new Date(stamp).toISOString();await assert.rejects(()=>loadSuiNative(async()=>body,now),/invalid-sui-checkpoint/);}
 const body=fixture([row(id,'1')]);body.data.chainIdentifier='testnet';await assert.rejects(()=>loadSuiNative(async()=>body,now),/invalid-sui-network/);
});
test('SUI rejects partial GraphQL errors and conflicting balances at one checkpoint',async()=>{
 const body=fixture([row(id,'1')]);body.errors=[{message:'rate limited'}];await assert.rejects(()=>loadSuiNative(async()=>body,now),/sui-graphql-error/);
 await assert.rejects(()=>loadSuiNative(async()=>fixture([row(id,'1'),row(id,'2')]),now),/inconsistent-sui-checkpoint/);
});
test('SUI excludes malformed and system accounts and bounds the sample to the requested page',async()=>{
 const many=Array.from({length:30},(_,i)=>row('0x'+(i+1).toString(16).padStart(64,'0'),'1000000000'));
 const value=await loadSuiNative(async()=>fixture(many),now);assert.equal(value.records.length,20);
 await assert.rejects(()=>loadSuiNative(async()=>fixture([{sender:null},row('malformed','123'),row(id,'NaN'),row(other,'-1')]),now),/empty-sui-native/);
});
test('SUI does not retry or change providers after access or quota failures',async()=>{
 let calls=0;await assert.rejects(()=>loadSuiNative(async()=>{calls++;throw Error('429');},now),/429/);assert.equal(calls,1);
});
