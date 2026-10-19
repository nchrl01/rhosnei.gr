import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {SharedHistoryCache,historyRequest} from './history-cache.js';
const DAY=86400000;
const url=(pool='pool',limit=1000)=>new URL(`https://worker.example/history?network=eth&pool=${pool}&token=base&timeframe=day&limit=${limit}`);
const payload=()=>({data:{attributes:{ohlcv_list:[[Math.floor(Date.now()/1000)-86400,1,2,1,2,100],[Math.floor(Date.now()/1000)-172800,1,2,1,1,80]]}}});
function setup(env={}){
 const db=new DatabaseSync(':memory:');
 const sql={exec(query,...args){const statement=db.prepare(query),rows=/^\s*SELECT/i.test(query)?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}};
 const cache=new SharedHistoryCache(sql,env);
 const save=(request,fetched)=>sql.exec('INSERT OR REPLACE INTO chart_pages VALUES(?,?,?,?,?)',historyRequest(request).key,JSON.stringify(payload()),fetched,fetched+30000,100);
 const budget=(calls=0,blocked=0)=>sql.exec('INSERT OR REPLACE INTO chart_budget VALUES(?,?,?,?)',Math.floor(Date.now()/DAY),calls,0,blocked);
 return {db,sql,cache,save,budget};
}
test('provider throttling serves dated saved candles and blocks repeated upstream calls',async()=>{
 const s=setup(),priorFetch=globalThis.fetch,fetched=Date.now()-120000;let calls=0;
 s.save(url(),fetched);globalThis.fetch=async()=>{calls++;return new Response(null,{status:429,headers:{'Retry-After':'120'}});};
 try{
  const first=await s.cache.fetch(url());assert.equal(first.status,200);assert.equal(first.headers.get('X-UPIC-History-Cache'),'stale');assert.equal(Number(first.headers.get('X-UPIC-Fetched-At')),fetched);assert.ok(Number(first.headers.get('Retry-After'))>=119);assert.equal((await first.json()).data.attributes.ohlcv_list.length,2);
  const repeated=await s.cache.fetch(url());assert.equal(repeated.headers.get('X-UPIC-History-Cache'),'stale');assert.equal(calls,1);
  const missing=await s.cache.fetch(url('uncached'));assert.equal(missing.status,429);assert.equal((await missing.json()).code,'PROVIDER_HISTORY_COOLDOWN');assert.equal(calls,1);
 }finally{globalThis.fetch=priorFetch;s.db.close();}
});
test('shared request budget is distinguished from upstream throttling',async()=>{
 const s=setup({HISTORY_REQUESTS_PER_DAY:1});s.budget(1);
 try{const response=await s.cache.fetch(url());assert.equal(response.status,429);assert.equal((await response.json()).code,'SHARED_HISTORY_QUOTA');}finally{s.db.close();}
});
test('expired refresh pages survive new writes for the bounded thirty-day retention',async()=>{
 const s=setup(),priorFetch=globalThis.fetch,fetched=Date.now()-2*DAY;s.save(url('saved'),fetched);s.save(url('too-old'),Date.now()-31*DAY);
 globalThis.fetch=async()=>Response.json(payload());
 try{
  assert.equal((await s.cache.fetch(url('new'))).status,200);
  assert.equal(s.sql.exec('SELECT fetched FROM chart_pages WHERE key=?',historyRequest(url('saved')).key).toArray()[0].fetched,fetched);
  assert.equal(s.sql.exec('SELECT fetched FROM chart_pages WHERE key=?',historyRequest(url('too-old')).key).toArray().length,0);
 }finally{globalThis.fetch=priorFetch;s.db.close();}
});
test('thirty-day-old history is never returned as a usable stale page',async()=>{
 const s=setup();s.save(url(),Date.now()-31*DAY);s.budget(0,Date.now()+60000);
 try{const response=await s.cache.fetch(url());assert.equal(response.status,429);assert.equal(response.headers.get('X-UPIC-Fetched-At'),null);}finally{s.db.close();}
});
test('simultaneous callers share one canonical fetch while retaining requested row limits',async()=>{
 const s=setup(),priorFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async request=>{calls++;assert.equal(new URL(request).searchParams.get('limit'),'1000');await Promise.resolve();return Response.json(payload());};
 try{const responses=await Promise.all([s.cache.fetch(url('same',1)),s.cache.fetch(url('same',2))]);assert.equal(calls,1);assert.equal((await responses[0].json()).data.attributes.ohlcv_list.length,1);assert.equal((await responses[1].json()).data.attributes.ohlcv_list.length,2);}finally{globalThis.fetch=priorFetch;s.db.close();}
});
