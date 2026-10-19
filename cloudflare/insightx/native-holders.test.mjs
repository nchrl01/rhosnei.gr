import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {NativeHolderRelay,nativeLimits} from './native-holders.js';
import {NATIVE_COINS,catalogueNative} from '../../apps/web/public/native-coins.js';
const HOUR=3600000,DAY=24*HOUR;
const request=network=>new URL('https://worker.invalid/native-holders?network='+network);
function setup(){
 const db=new DatabaseSync(':memory:');
 const sql={exec(query,...args){const s=db.prepare(query);const rows=/^\s*SELECT/i.test(query)?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows};}};
 const relay=new NativeHolderRelay(sql,{BLOCKSCOUT_API_KEY:'fixture-private-key'});
 const save=(network,overrides={})=>{const data={network,address:'native',schema:2,state:'snapshot',records:[{id:'address',tokenBalance:3}],fetchedAt:Date.now()-HOUR,sourceAt:null,nextAt:Date.now()+HOUR,...overrides};sql.exec('INSERT OR REPLACE INTO native_samples VALUES(?,?,?)',network,JSON.stringify(data),data.nextAt);return data;};
 return {db,sql,relay,save};
}
test('unknown chains never make an upstream request and exact native identity excludes wrapped tokens',async()=>{
 const s=setup(),prior=globalThis.fetch;globalThis.fetch=()=>{throw Error('unexpected network');};
 try{assert.equal((await s.relay.get(request('arbitrary'))).state,'unsupported-network');assert.equal(catalogueNative({id:'wrapped-bitcoin',symbol:'BTC',chain:'bitcoin',address:null}),null);assert.equal(catalogueNative({id:'solana',symbol:'SOL',nativeChain:'solana'})?.address,'native');}finally{globalThis.fetch=prior;s.db.close();}
});
test('fresh existing samples survive code upgrades without more paid or free requests',async()=>{
 const s=setup(),prior=globalThis.fetch;s.save('bitcoin');globalThis.fetch=()=>{throw Error('unexpected network');};
 try{const result=await s.relay.get(request('bitcoin'));assert.equal(result.cached,true);assert.equal(result.records.length,1);}finally{globalThis.fetch=prior;s.db.close();}
});
test('one provider HTTP429 preserves its dated sample without stopping another provider',async()=>{
 const s=setup(),prior=globalThis.fetch,fetchedAt=Date.now()-2*HOUR;s.save('bitcoin',{fetchedAt,nextAt:Date.now()-1});let calls=[];
 globalThis.fetch=async input=>{const url=new URL(input);calls.push(url.hostname);return url.hostname==='sochain.com'?new Response(null,{status:429,headers:{'Retry-After':'7200'}}):Response.json({items:[{hash:'0x'+'1'.repeat(40),coin_balance:'1000000000000000000'}]});};
 s.relay.marketMetadata=async()=>({});
 try{const a=await s.relay.get(request('bitcoin'));assert.equal(a.state,'delayed');assert.equal(a.fetchedAt,fetchedAt);assert.ok(a.nextAt>=Date.now()+7100000);const b=await s.relay.get(request('ethereum'));assert.equal(b.state,'snapshot');assert.equal(b.records[0].tokenBalance,1);assert.deepEqual(calls,['sochain.com','api.blockscout.com']);}finally{globalThis.fetch=prior;s.db.close();}
});
test('one network deduplicates simultaneous callers and never promotes sample size to holder total',async()=>{
 const s=setup(),prior=globalThis.fetch;let calls=0;s.relay.marketMetadata=async()=>({});globalThis.fetch=async()=>{calls++;return Response.json({items:[{hash:'0x'+'2'.repeat(40),coin_balance:'1000000000000000000'},{hash:'0x'+'2'.repeat(40),coin_balance:'1000000000000000000'}],total_addresses:999999});};
 try{const results=await Promise.all([s.relay.get(request('ethereum')),s.relay.get(request('ethereum'))]);assert.equal(calls,1);assert.equal(results[0].records.length,1);assert.equal(results[0].totalHolders,null);assert.equal(results[0].complete,false);}finally{globalThis.fetch=prior;s.db.close();}
});
test('expired and future samples cannot supply usable balances',async()=>{
 const s=setup();
 try{for(const at of [Date.now()-7*HOUR,Date.now()+HOUR]){s.save('bitcoin',{fetchedAt:at});const result=await s.relay.get(request('bitcoin'));assert.equal(result.state,'expired');assert.deepEqual(result.records,[]);}
 s.save('bitcoin',{fetchedAt:Date.now()-1000,sourceAt:Date.now()-7*HOUR});assert.equal((await s.relay.get(request('bitcoin'))).state,'expired');}finally{s.db.close();}
});
test('shared provider budget rejects extra reads without contacting upstream',async()=>{
 const s=setup(),prior=globalThis.fetch;globalThis.fetch=()=>{throw Error('unexpected network');};const day=Math.floor(Date.now()/DAY);s.sql.exec('INSERT INTO native_provider_budget VALUES(?,?,?,0)',day,'sochain',nativeLimits.providerDailyRequests.sochain);
 try{const result=await s.relay.get(request('bitcoin'));assert.equal(result.reason,'free-budget-wait');assert.equal(result.records.length,0);}finally{globalThis.fetch=prior;s.db.close();}
});
test('one cached price batch serves all native identities without refreshing on every view',async()=>{
 const s=setup(),prior=globalThis.fetch;let calls=0;globalThis.fetch=async input=>{calls++;assert.equal(new URL(input).searchParams.get('ids').split(',').length,Object.keys(NATIVE_COINS).length);return Response.json({solana:{usd:100,usd_market_cap:60000000000,last_updated_at:Math.floor(Date.now()/1000)}});};
 try{const [a,b]=await Promise.all([s.relay.marketMetadata(),s.relay.marketMetadata()]);assert.equal(a.solana.supply,600000000);assert.deepEqual(a,b);await s.relay.marketMetadata();assert.equal(calls,1);}finally{globalThis.fetch=prior;s.db.close();}
});
test('RPC rate limits delivered as HTTP200 persist a provider-wide cooldown',async()=>{
 const s=setup(),prior=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({jsonrpc:'2.0',id:1,error:{code:-32005,message:'Too many requests'}});};
 try{await assert.rejects(s.relay.read('publicnode-sol','https://provider.invalid'),/rate-limit/);await assert.rejects(s.relay.read('publicnode-sol','https://provider.invalid'),/free-budget-wait/);assert.equal(calls,1);}finally{globalThis.fetch=prior;s.db.close();}
});
test('provider cooldown survives the daily quota rollover',async()=>{
 const s=setup(),prior=globalThis.fetch;globalThis.fetch=()=>{throw Error('unexpected network');};
 s.sql.exec('INSERT INTO native_provider_budget VALUES(?,?,?,?)',Math.floor(Date.now()/DAY)-1,'sochain',5,Date.now()+HOUR);s.relay.cooldown('sochain',Date.now()+HOUR);
 try{await assert.rejects(s.relay.read('sochain','https://provider.invalid'),/free-budget-wait/);}finally{globalThis.fetch=prior;s.db.close();}
});
