import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSolanaNative,loadXrpNative,loadHederaNative,loadAlgorandNative} from '../cloudflare/insightx/native-provider-sol-xrp.js';

const now=1792424400000;
const solAddress='Dd2nB2vD1XvDsdKqhtmCuh1q6tzWckkqLq3JubznKanL';
const xrpAddress='r3g2Fn1gfKsY9b1BeTHS49RX8XKhU2bvMM';
const ledgerHash='A'.repeat(64),marker='B'.repeat(64);
function xrpPage(state,extra={}){
 return {validated:true,ledger_hash:ledgerHash,ledger_index:100,ledger:{closed:true,ledger_hash:ledgerHash,close_time:now/1000-946684800,total_coins:'99985589214297339'},state,...extra};
}

test('SOL uses the last balance even when a selected signer is only a later recipient',async()=>{
 let calls=0;
 const read=async(_,options)=>{
  calls++;const request=JSON.parse(options.body);
  if(calls===1){assert.equal(request.method,'getSlot');return {result:200};}
  assert.equal(request.method,'getBlock');assert.equal(request.params[1].commitment,'finalized');
  return {result:{blockTime:now/1000,transactions:[
   {transaction:{accountKeys:[{pubkey:solAddress,signer:true}]},meta:{postBalances:[1000000000]}},
   {transaction:{accountKeys:[{pubkey:solAddress,signer:false}]},meta:{postBalances:[2500000000]}},
  ]}};
 };
 const result=await loadSolanaNative(read,now);
 assert.equal(calls,2);assert.equal(result.records[0].tokenBalance,2.5);
 assert.equal(result.coverage,'recent-account-sample');assert.equal(result.totalHolders,null);
});

test('SOL rejects old blocks and removes accounts spent to zero later in the block',async()=>{
 const run=async(blockTime,lastBalance)=>{let calls=0;return loadSolanaNative(async()=>({result:++calls===1?200:{blockTime,transactions:[
  {transaction:{accountKeys:[{pubkey:solAddress,signer:true}]},meta:{postBalances:[1000000000]}},
  {transaction:{accountKeys:[{pubkey:solAddress,signer:false}]},meta:{postBalances:[lastBalance]}},
 ]}}),now);};
 await assert.rejects(()=>run(now/1000-7*3600,500),/invalid-solana-block/);
 await assert.rejects(()=>run(now/1000,0),/empty-solana-block-sample/);
});

test('XRP pins later pages to the same validated ledger and never uses total supply as circulation',async()=>{
 let calls=0;
 const read=async(_,options)=>{
  const request=JSON.parse(options.body).params[0];calls++;
  if(calls===1){assert.equal(request.ledger_index,'validated');return {result:xrpPage([{LedgerEntryType:'AccountRoot',Account:xrpAddress,Balance:'17229982'}],{marker})};}
  assert.equal(request.ledger_hash,ledgerHash);assert.equal(request.marker,marker);
  return {result:xrpPage([])};
 };
 const result=await loadXrpNative(read,now);
 assert.equal(calls,2);assert.equal(result.records[0].tokenBalance,17.229982);
 assert.equal(result.supply,null);assert.ok(result.totalSupply>99000000000);assert.equal(result.totalHolders,null);
});

test('XRP rejects unvalidated responses and a pagination ledger change',async()=>{
 await assert.rejects(()=>loadXrpNative(async()=>({result:xrpPage([],{validated:false})}),now),/invalid-xrp-ledger/);
 let calls=0;
 await assert.rejects(()=>loadXrpNative(async()=>({result:++calls===1?xrpPage([],{marker}):xrpPage([],{ledger_hash:'C'.repeat(64),ledger_index:101})}),now),/changed-xrp-ledger/);
});

test('HBAR converts tinybars and excludes zero balances without claiming a total',async()=>{
 const result=await loadHederaNative(async()=>({timestamp:String(now/1000),balances:[{account:'0.0.1',balance:123456789},{account:'0.0.2',balance:0}]}),now);
 assert.deepEqual(result.records,[{id:'0.0.1',tokenBalance:1.23456789}]);assert.equal(result.totalHolders,null);
});

test('ALGO samples real recent senders and validates current balance rounds',async()=>{
 let calls=0;const id='A'.repeat(58);
 const result=await loadAlgorandNative(async()=>{calls++;return calls===1?{'last-round':126}:calls===2?{block:{rnd:123,ts:now/1000,gen:'mainnet-v1.0',txns:[{txn:{snd:id}},{txn:{snd:'B'.repeat(58)}}]}}:calls===3?{address:id,amount:1200000,round:126}:{address:'B'.repeat(58),amount:0,round:127};},now);
 assert.deepEqual(result.records,[{id,tokenBalance:1.2}]);assert.equal(result.sourceRound,123);assert.equal(calls,4);assert.equal(result.coverage,'recent-account-sample');assert.equal(result.balanceRoundMin,126);assert.equal(result.totalHolders,null);
 let wrongCalls=0;
 await assert.rejects(()=>loadAlgorandNative(async()=>++wrongCalls===1?{'last-round':126}:{block:{rnd:124,ts:now/1000}},now),/invalid-algorand-round/);
 let oldCalls=0;
 await assert.rejects(()=>loadAlgorandNative(async()=>++oldCalls===1?{'last-round':126}:oldCalls===2?{block:{rnd:123,ts:now/1000,gen:'mainnet-v1.0',txns:[{txn:{snd:id}}]}}:{address:id,amount:1200000,round:120},now),/invalid-algorand-account-round/);
});

test('ALGO stops immediately at quota failure and keeps only earlier verified balances',async()=>{
 const ids=['A','B','C'].map(x=>x.repeat(58));let calls=0;
 const value=await loadAlgorandNative(async()=>{
  calls++;
  if(calls===1)return {'last-round':126};
  if(calls===2)return {block:{rnd:123,ts:now/1000,gen:'mainnet-v1.0',txns:ids.map(snd=>({txn:{snd}}))}};
  if(calls===3)return {address:ids[0],amount:2000000,round:127};
  throw Error('provider-quota-429');
 },now);
 assert.equal(calls,4);assert.deepEqual(value.records,[{id:ids[0],tokenBalance:2}]);assert.equal(value.balanceRoundMin,127);assert.equal(value.balanceRoundMax,127);
 assert.equal(value.sourceAt,now);assert.equal(value.balanceBasis,'current-balances-after-reference-block');
 let staleCalls=0;
 await assert.rejects(()=>loadAlgorandNative(async()=>++staleCalls===1?{'last-round':126}:{block:{rnd:123,ts:(now-7*3600000)/1000,gen:'mainnet-v1.0',txns:[]}},now),/invalid-algorand-round/);
 assert.equal(staleCalls,2);
});
