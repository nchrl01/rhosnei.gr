import test from 'node:test';import assert from 'node:assert/strict';
import {loadPublicListNative} from '../cloudflare/insightx/native-provider-public-lists.js';
import {NATIVE_COINS,nativeCoin,catalogueNative} from '../apps/web/public/native-coins.js';
import {captureIdentity} from '../cloudflare/insightx/coin-captures.js';
const now=Date.now(),id='0x'+'1'.repeat(40),erd='erd1'+'q'.repeat(58),ark='A'+'1'.repeat(33),pi='G'+'A'.repeat(55);
test('native identities and central images isolate multiple currencies on one chain',()=>{
 assert.equal(nativeCoin('VTHO').address,'native:vethor-token');assert.equal(nativeCoin('VET').address,'native');
 assert.equal(captureIdentity('vechain','native').id,'vechain');assert.equal(captureIdentity('vechain','native:vethor-token').id,'vethor-token');
 assert.equal(captureIdentity('thorchain','native:tcy').id,'tcy');assert.equal(captureIdentity('theta','native:theta-fuel').id,'theta-fuel');
 assert.equal(nativeCoin('DATA'),null);assert.equal(nativeCoin('DATA',{id:'streamr'}),null);assert.equal(catalogueNative({id:'story-2',symbol:'DATA',nativeChain:'story'})?.id,'story-2');
 const keys=Object.values(NATIVE_COINS).map(a=>a.cacheKey||a.chain);assert.equal(new Set(keys).size,keys.length);
});
test('Theta and TFUEL use separate balance fields and never mix supply or delegated votes',async()=>{
 for(const symbol of ['THETA','TFUEL']){const read=async url=>url.includes('top_blocks')?{body:[{status:4,timestamp:String(Math.floor(now/1000))}]}:{type:'account_list',body:[{address:id,balance:{thetawei:'2000000000000000000',tfuelwei:'9000000000000000000'},votes:123456}]};const result=await loadPublicListNative(NATIVE_COINS[symbol],read,now);assert.equal(result.records[0].tokenBalance,symbol==='THETA'?2:9);assert.equal(result.totalHolders,null);assert.equal(result.sourceAt,null);}
});
test('MultiversX includes real native contract balances with exact 18-decimal conversion',async()=>{
 const result=await loadPublicListNative(NATIVE_COINS.EGLD,async url=>url.includes('/blocks?')?[{timestamp:Math.floor(now/1000)}]:[{address:erd,balance:'1234000000000000000'},{address:erd,balance:'9'},{address:'invalid',balance:'2000'}],now);assert.equal(result.records.length,1);assert.equal(result.records[0].tokenBalance,1.234);assert.equal(result.totalHolders,null);
});
test('ARK native amounts use 8 decimals and a current, synced mainnet tip',async()=>{
 const read=async url=>url.includes('/status')?{data:{synced:true,timestamp:Math.floor(now/1000)-1490101200}}:{data:[{address:ark,balance:'123456789'}]};const result=await loadPublicListNative(NATIVE_COINS.ARK,read,now);assert.equal(result.records[0].tokenBalance,1.23456789);
 await assert.rejects(loadPublicListNative(NATIVE_COINS.ARK,async()=>({data:{synced:false}}),now),/delayed/);
});
test('Hive and Steem only use their own liquid native balance, excluding stablecoins and vesting',async()=>{
 for(const symbol of ['HIVE','STEEM']){const read=async(url,opts)=>{const r=JSON.parse(opts.body);return {id:1,result:r.method.endsWith('get_dynamic_global_properties')?{time:new Date(now).toISOString().replace(/Z$/,''),current_supply:'999 '+symbol}:r.method.endsWith('lookup_accounts')?['alice']: [{name:'alice',balance:'2.500 '+symbol,sbd_balance:'999 SBD',vesting_shares:'800000 VESTS'}]};};const result=await loadPublicListNative(NATIVE_COINS[symbol],read,now);assert.deepEqual(result.records,[{id:'alice',tokenBalance:2.5}]);}
 await assert.rejects(loadPublicListNative(NATIVE_COINS.HIVE,async()=>({id:1,result:{time:new Date(now).toISOString(),current_supply:'5 STEEM'}}),now),/mismatch/);
});
test('Pi validates its mainnet passphrase and native balance, not issued credits',async()=>{
 const read=async url=>url.endsWith('/')?{network_passphrase:'Pi Network',history_latest_ledger_closed_at:new Date(now).toISOString()}:url.includes('/transactions?')?{_embedded:{records:[{successful:true,created_at:new Date(now).toISOString(),source_account:pi}]}}:{account_id:pi,balances:[{asset_type:'native',balance:'3.0000001'},{asset_type:'credit_alphanum4',balance:'9999999'}]};const result=await loadPublicListNative(NATIVE_COINS.PI,read,now);assert.deepEqual(result.records,[{id:pi,tokenBalance:3.0000001}]);
 await assert.rejects(loadPublicListNative(NATIVE_COINS.PI,async()=>({network_passphrase:'Test SDF Network'}),now),/mismatch/);
});
test('QRL uses safe native shor amounts and rejects aggregate/address placeholders',async()=>{
 const result=await loadPublicListNative(NATIVE_COINS.QRL,async()=>[{address:'Q'+'a'.repeat(78),balance:1234567890},{address:'anonymous',balance:9000},{address:'Q'+'b'.repeat(78),balance:Number.MAX_SAFE_INTEGER+1}],now);assert.deepEqual(result.records,[{id:'Q'+'a'.repeat(78),tokenBalance:1.23456789}]);
});
test('unsupported identities cannot select a public list provider',async()=>{let calls=0;await assert.rejects(loadPublicListNative({...NATIVE_COINS.PI,id:'stellar'},async()=>{calls++;}),/unsupported/);assert.equal(calls,0);});
