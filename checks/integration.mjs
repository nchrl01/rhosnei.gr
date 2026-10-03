import test from 'node:test';
import assert from 'node:assert/strict';
import {MarketChart} from '../public/chart.js';
import {signalFreshness} from '../public/market-controls.js';
import {createOrchestraConductor} from '../public/orchestra.js';
import {createNativePd} from '../public/native-pd.js';

function chartWith(history){
 const chart=Object.create(MarketChart.prototype);
 Object.assign(chart,{history,interval:60000,points:[],buckets:new Map(),dirty:new Set(),rebuild:true,needsFit:false,manual:true,range:'live',origin:null});
 const scale={getVisibleRange:()=>null,scrollPosition:()=>0};
 chart.chart={timeScale:()=>scale};
 for(const name of ['candles','line','volume'])chart[name]={setData:()=>{},update:()=>{}};
 chart.schedule=()=>{};chart.draw();return chart;
}
const complete={time:60000,open:100,high:112,low:99,close:110,volume:1000,observedThrough:120000};

test('late observations preserve completed provider OHLC and volume, including rebuilds',()=>{
 const chart=chartWith([complete]);chart.add({at:70000,price:102,volume:10,id:'late'});chart.draw();
 assert.deepEqual(Object.fromEntries(['open','high','low','close','volume'].map(k=>[k,chart.buckets.get(60000)[k]])),{open:100,high:112,low:99,close:110,volume:1000});
 chart.retime('late',80000);chart.draw();assert.equal(chart.buckets.get(60000).close,110);
 chart.remove('late');chart.draw();assert.equal(chart.buckets.get(60000).volume,1000);
});
test('current provider candle extends only after its acquisition boundary; next interval stays live',()=>{
 const chart=chartWith([{...complete,observedThrough:90000}]);
 chart.add({at:80000,price:103,volume:2});chart.add({at:100000,price:115,volume:5});chart.add({at:95000,price:113,volume:3});chart.draw();
 const bar=chart.buckets.get(60000);assert.equal(bar.open,100);assert.equal(bar.close,115);assert.equal(bar.high,115);assert.equal(bar.volume,8);assert.equal(bar.live,true);
 chart.add({at:125000,price:117,volume:4});chart.draw();assert.equal(chart.buckets.get(120000).close,117);
});
test('retimed observations move out of live candles into protected provider coverage',()=>{
 const chart=chartWith([complete]);chart.add({at:125000,price:120,volume:7,id:'timed'});chart.draw();
 chart.retime('timed',100000);chart.draw();assert.equal(chart.buckets.has(120000),false);assert.equal(chart.buckets.get(60000).close,110);
});
test('snapshot freshness and current Envion bundle follow the same state',()=>{
 const live={music:{intensity:.6},activity:.5,...signalFreshness(true,1000,62000)};
 assert.equal(live.snapshotFresh,0);assert.equal(live.fresh,1);
 const conductor=createOrchestraConductor();assert.ok(conductor.update(live,true,0).levels.melody>0);
 conductor.reset();const stale={...live,...signalFreshness(false,1000,62000)};
 assert.equal(conductor.update(stale,false,0).levels.melody,0);
 conductor.setBundle('envion',false);assert.equal(conductor.update(live,true,1000).levels.melody,0);
 assert.equal(signalFreshness(false,1000,21000).fresh,1);assert.equal(signalFreshness(false,1000,41000).fresh,.5);
});
test('replay chart stays frozen while live observations continue, then catches up',()=>{
 const chart=chartWith([complete]),frozen={bars:structuredClone([complete]),interval:60000};
 const state={active:true,frozen};chart.readReplay=()=>state;chart.followReplay=()=>{};
 chart.add({at:125000,price:140,volume:4,id:'new'});chart.draw();
 assert.equal(chart.renderedBars.length,1);assert.equal(chart.renderedBars[0].close,110);
 chart.setHistory([{...complete,close:111}],60000,null);chart.draw();
 assert.equal(chart.renderedBars[0].close,110,'Backfill cannot alter the score being heard');
 state.active=false;chart.draw();assert.equal(chart.renderedBars.length,2);assert.equal(chart.renderedBars.at(-1).close,140);
});
function nativeMocks(t,post){
 t.mock.method(globalThis,'setInterval',()=>1);t.mock.method(globalThis,'clearInterval',()=>{});
 t.mock.method(globalThis,'fetch',async(url,options)=>url==='/pd/status'?{ok:true,json:async()=>({connected:true,orchestra:true,state:{run:1}})}:post(JSON.parse(options.body).messages));
}
test('native close waits for in-flight controls AND subsequent stop delivery',async t=>{
 const requests=[],releases=[];nativeMocks(t,messages=>{requests.push(messages);return new Promise(resolve=>releases.push(resolve));});
 const pd=await createNativePd(()=>{});pd.sendFloat('run',1);const flight=pd.flush();let done=false;const closing=pd.close().then(()=>{done=true;});
 pd.sendFloat('run',1);assert.equal(requests.length,1);assert.equal(done,false);
 releases[0]({ok:true});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(requests[1],[['run',0],['master',0]]);assert.equal(done,false);
 releases[1]({ok:true});await Promise.all([flight,closing]);assert.equal(done,true);assert.equal(requests.length,2);
});
test('a failed in-flight request does not prevent the queued stop attempt',async t=>{
 const requests=[];let rejectFirst;nativeMocks(t,messages=>{requests.push(messages);return requests.length===1?new Promise((_,reject)=>rejectFirst=reject):Promise.resolve({ok:true});});
 const errors=[];const pd=await createNativePd(e=>errors.push(e));pd.sendFloat('run',1);pd.flush();const closing=pd.close();rejectFirst(Error('connection interrupted'));await closing;
 assert.equal(errors.length,1);assert.deepEqual(requests[1],[['run',0],['master',0]]);
});
