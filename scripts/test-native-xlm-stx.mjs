import test from 'node:test';
import assert from 'node:assert/strict';
import {loadStellarNative,loadStacksNative} from '../cloudflare/insightx/native-provider-xlm-stx.js';
const now=Date.now(),at=now-60000,iso=new Date(at).toISOString();
const xlmId=letter=>'G'+letter.repeat(55),stxId=letter=>'SP'+letter.repeat(38);
const xlmTx=(id,extra={})=>({source_account:id,successful:true,created_at:iso,ledger:100,...extra});
const xlmAccount=(id,extra={})=>({account_id:id,last_modified_ledger:100,last_modified_time:iso,balances:[{asset_type:'credit_alphanum4',balance:'999999'},{asset_type:'native',balance:'1.2345678'}],...extra});
const stxTx=(id,extra={})=>({sender:{address:id},status:'success',block:{time:Math.floor(at/1000),height:100},...extra});

test('XLM uses four current native balances with ledger provenance and a five-call ceiling',async()=>{
 const ids=['A','B','C','D','E'].map(xlmId);let calls=0;
 const data=await loadStellarNative(async url=>{calls++;if(url.includes('/transactions?'))return{_embedded:{records:[xlmTx(ids[0]),...ids.map(id=>xlmTx(id))]}};return xlmAccount(url.split('/').at(-1));},now);
 assert.equal(calls,5);assert.equal(data.records.length,4);assert.equal(data.records[0].tokenBalance,1.2345678);assert.equal(data.sourceAt,null);assert.equal(data.membershipAt,at);assert.equal(data.balanceLedgerMin,100);assert.equal(data.totalHolders,null);assert.equal(data.complete,false);
});
test('XLM rejects balances older than the selecting transaction and wrong account identities',async()=>{
 const id=xlmId('A');
 for(const bad of [{last_modified_ledger:99},{account_id:xlmId('B')},{last_modified_time:new Date(at-1000).toISOString()}]){
  await assert.rejects(()=>loadStellarNative(async url=>url.includes('/transactions?')?{_embedded:{records:[xlmTx(id)]}}:xlmAccount(id,bad),now),/invalid-stellar-account-state/);
 }
 await assert.rejects(()=>loadStellarNative(async()=>({_embedded:{records:[xlmTx(id,{created_at:new Date(now-7*3600000).toISOString()})]}}),now),/empty-stellar-recent/);
});
test('XLM stops on provider quota and preserves already verified partial balances',async()=>{
 const ids=['A','B','C','D'].map(xlmId);let calls=0;
 const value=await loadStellarNative(async url=>{calls++;if(url.includes('/transactions?'))return{_embedded:{records:ids.map(id=>xlmTx(id))}};if(calls===3)throw Error('rate-limited');return xlmAccount(ids[0]);},now);
 assert.equal(calls,3);assert.deepEqual(value.records,[{id:ids[0],tokenBalance:1.2345678}]);
});
test('STX uses supported v3 current total balance including locked funds, never pending estimates',async()=>{
 const ids=['A','B','C','D','E'].map(stxId);let calls=0;
 const data=await loadStacksNative(async url=>{calls++;assert.match(url,/\/extended\/v3\//);if(url.includes('/transactions?'))return{results:ids.map(id=>stxTx(id))};return{balance:'123456789',available:'23456789',locked:{amount:'100000000'},mempool:{estimated_balance:'999999999'}};},now);
 assert.equal(calls,5);assert.equal(data.records.length,4);assert.equal(data.records[0].tokenBalance,123.456789);assert.equal(data.totalHolders,null);assert.equal(data.sourceAt,null);assert.equal(data.membershipAt,Math.floor(at/1000)*1000);assert.match(data.scope,/includes-locked/);
});
test('STX refuses old/unconfirmed/testnet activity and zero balances',async()=>{
 const id=stxId('A');let calls=0;
 await assert.rejects(()=>loadStacksNative(async()=>{calls++;return{results:[stxTx(id,{block:{time:(now-7*3600000)/1000,height:90}}),stxTx(id,{status:'pending'}),stxTx('ST'+'A'.repeat(38))]};},now),/empty-stacks-recent/);assert.equal(calls,1);
 await assert.rejects(()=>loadStacksNative(async url=>url.includes('/transactions?')?{results:[stxTx(id)]}:{balance:'0',available:'0'},now),/empty-stacks-native/);
});
test('STX stops at the first quota failure without retrying or rotating providers',async()=>{
 const ids=['A','B','C'].map(stxId);let calls=0;
 const data=await loadStacksNative(async url=>{calls++;if(url.includes('/transactions?'))return{results:ids.map(id=>stxTx(id))};if(calls===3)throw Error('429');return{balance:'1234567'};},now);
 assert.equal(calls,3);assert.deepEqual(data.records,[{id:ids[0],tokenBalance:1.234567}]);
});
