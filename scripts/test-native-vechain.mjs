import test from 'node:test';
import assert from 'node:assert/strict';
import {loadVeChainNative} from '../cloudflare/insightx/native-provider-vechain.js';

const now=1792421640000,height=26188920,blockID='0x018f9c7835d7c2812c05bf3eb8c1d7a2e09336d462b94a848f4fc21c851175a8';
const id=n=>'0x'+String(n).padStart(40,'0');
const block=()=>({id:blockID,number:height,timestamp:now/1000,isFinalized:true,isTrunk:true,transactions:[{chainTag:74,origin:id(1),reverted:false,outputs:[{transfers:[{sender:id(1),recipient:id(2)}]}]}]});
const balance=(n=2n)=>({balance:'0x'+(n*10n**18n).toString(16),energy:'0x'+(999999n*10n**18n).toString(16),hasCode:false});

test('VET pins actual balances to one finalized mainnet revision and never substitutes VTHO',async()=>{
 const calls=[];const result=await loadVeChainNative(async url=>{calls.push(url);return calls.length===1?block():balance();},now);
 assert.equal(calls.length,3);assert.equal(result.sourceAt,now);assert.equal(result.sourceHeight,height);assert.equal(result.sourceBlockHash,blockID);
 assert.deepEqual(result.records,[{id:id(1),tokenBalance:2},{id:id(2),tokenBalance:2}]);assert.equal(result.totalHolders,null);assert.equal(result.complete,false);
 for(const url of calls.slice(1))assert.equal(new URL(url).searchParams.get('revision'),blockID);
 assert.equal(result.scope,'finalized-block-participants-vet-only');
});

test('VET rejects stale, unfinalized, foreign-network and inconsistent block identity without reading accounts',async()=>{
 for(const change of [{timestamp:now/1000-21600},{timestamp:now/1000+301},{isFinalized:false},{isTrunk:false},{number:height+1},{transactions:[{chainTag:39,origin:id(1),reverted:false}]}]){
  let calls=0;await assert.rejects(loadVeChainNative(async()=>{calls++;return {...block(),...change};},now),/invalid-vechain/);assert.equal(calls,1);
 }
});

test('VET bounds and deduplicates selection to four actual participants',async()=>{
 const b=block();b.transactions=Array.from({length:20},(_,i)=>({chainTag:74,origin:id(i+1),reverted:false,outputs:[]}));
 b.transactions.unshift({...b.transactions[0]});let calls=0;
 const result=await loadVeChainNative(async()=>++calls===1?b:balance(),now);
 assert.equal(calls,5);assert.deepEqual(result.records.map(row=>row.id),[1,2,3,4].map(id));
});

test('VET stops immediately at quota denial and only retains already verified balances',async()=>{
 let calls=0;const result=await loadVeChainNative(async()=>{calls++;if(calls===1)return block();if(calls===2)return balance();throw Error('native-rate-limit');},now);
 assert.equal(calls,3);assert.equal(result.records.length,1);
 calls=0;await assert.rejects(loadVeChainNative(async()=>{if(++calls===1)return block();throw Error('native-rate-limit');},now),/native-rate-limit/);assert.equal(calls,2);
});

test('VET rejects missing native balance rather than using energy and skips zero balances',async()=>{
 let calls=0;await assert.rejects(loadVeChainNative(async()=>++calls===1?block():{energy:'0xffff'},now),/invalid-vechain-balance/);
 calls=0;const result=await loadVeChainNative(async()=>++calls===1?block():balance(calls===2?0n:3n),now);assert.deepEqual(result.records,[{id:id(2),tokenBalance:3}]);
});
test('VTHO includes actual fee payers when delegated senders have no native gas balance',async()=>{const b=block();b.transactions[0].gasPayer=id(9);const r=await loadVeChainNative(async url=>url.includes('/blocks/')?b:{balance:'0xffff',energy:url.includes(id(9))?'0xde0b6b3a7640000':'0x0'},now,'VTHO');assert.deepEqual(r.records,[{id:id(9),tokenBalance:1}]);assert.equal(r.sourceBlockHash,blockID);});
