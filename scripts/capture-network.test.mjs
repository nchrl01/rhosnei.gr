import test from 'node:test';
import assert from 'node:assert/strict';
import {captureFetch} from './capture-network.mjs';
function fixture(responses){const calls=[],delays=[];return {calls,delays,options:{wait:async ms=>delays.push(ms),fetcher:async(url,init)=>{calls.push({url,init});const response=responses.shift();if(response instanceof Error)throw response;return response;}}};}
test('transient responses retry with bounded backoff and identical payload',async()=>{
 const f=fixture([new Response('',{status:503}),new Response('',{status:429,headers:{'retry-after':'999'}}),new Response('',{status:201})]);
 const result=await captureFetch('https://capture.invalid',{method:'POST',body:'same timestamp and bytes'},f.options);
 assert.equal(result.status,201);assert.deepEqual(f.delays,[1000,10000]);assert.equal(f.calls.length,3);assert(f.calls.every(c=>c.init.body==='same timestamp and bytes'));assert.notEqual(f.calls[0].init.signal,f.calls[1].init.signal);
});
test('transport failures retry but exhaust the budget',async()=>{
 const f=fixture([new TypeError('offline'),new TypeError('offline'),new TypeError('offline')]);
 await assert.rejects(captureFetch('https://capture.invalid',{},f.options),/offline/);assert.equal(f.calls.length,3);assert.deepEqual(f.delays,[1000,2000]);
});
for(const status of [200,201,400,401,403,404,409,422])test('HTTP '+status+' is returned without hiding or retrying it',async()=>{
 const f=fixture([new Response('',{status})]);assert.equal((await captureFetch('https://capture.invalid',{},f.options)).status,status);assert.equal(f.calls.length,1);assert.deepEqual(f.delays,[]);
});
test('persistent server failure remains a failure response',async()=>{const f=fixture(Array.from({length:3},()=>new Response('',{status:503})));assert.equal((await captureFetch('https://capture.invalid',{},f.options)).status,503);assert.equal(f.calls.length,3);});
