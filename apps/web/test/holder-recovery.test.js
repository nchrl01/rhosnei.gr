import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {fetchHolderCount} from '../public/holder-count-providers.js';
import {earthboundMarketState,observedHolderBalances} from '../public/upic-earthbound-visual.js';
import {createEarthboundRenderer} from '../public/upic-oct07-renderer.js';

vi.mock('../public/native-holders.js?v=359',()=>({createNativeHolders:()=>({setMarket(){},snapshot:()=>({state:'unavailable',weight:0,records:[]}),close(){}})}));
vi.mock('../public/holder-balances.js?v=458',()=>({createHolderBalances:()=>({setMarket(){},snapshot:()=>({state:'unavailable',weight:0,records:[]}),close(){}})}));
vi.mock('../public/holder-clusters.js?v=168',()=>({createHolderClusters:()=>({setMarket(){},snapshot:()=>({state:'unavailable',weight:0,clusters:[]}),close(){}})}));
import {createHolderMetadata} from '../public/holder-metadata.js';

const mint='6G2ETAjPYnkUJ24B6Tz9bWj7jk78L6V76sy9XMbNpump';
const pair={chainId:'solana',baseToken:{address:mint}};
const instances=[];
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-23T18:00:00Z'));});
afterEach(()=>{for(const instance of instances.splice(0))instance.close();vi.unstubAllGlobals();vi.useRealTimers();});
function metadata(){const value=createHolderMetadata();instances.push(value);return value;}
const response=data=>({ok:true,json:async()=>data});

describe('holder lookup recovery',()=>{
 it('recovers a cached relay miss through GeckoTerminal and enables the actual holder population',async()=>{
  const fetch=vi.fn(async url=>String(url).includes('/holders?')
   ?response({state:'unavailable',holders:null,retryAt:Date.now()+30*60000})
   :response({data:{attributes:{holders:{count:76,last_updated:'2026-10-23T17:56:31Z'}}}}));
  vi.stubGlobal('fetch',fetch);vi.stubGlobal('document',{hidden:false});
  const data=metadata();data.setMarket(pair);await vi.advanceTimersByTimeAsync(0);
  expect(fetch.mock.calls.map(([url])=>String(url))).toEqual([
   expect.stringContaining('/holders?network=solana&address='+mint),
   'https://api.geckoterminal.com/api/v2/networks/solana/tokens/'+mint+'/info',
  ]);
  expect(data.snapshot()).toMatchObject({holders:76,source:'GeckoTerminal'});
  expect(earthboundMarketState({context:{latestPrice:.00002},audience:data.snapshot()})).toMatchObject({hasMarket:true,totalHolders:76,holderFetchLoading:false});
 });
 it('retains a fresh authenticated wallet sample when the total holder count is absent',async()=>{
  const sample=[{id:mint,tokenBalance:500}];
  const fetch=vi.fn(async()=>response({holders:null,holderBalances:sample,source:'GoPlus',state:'snapshot',fetchedAt:Date.now()}));
  vi.stubGlobal('fetch',fetch);vi.stubGlobal('document',{hidden:false});
  const data=metadata();data.setMarket({...pair,baseToken:{address:'7'.repeat(44)}});await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(data.snapshot()).toMatchObject({holders:null,weight:1,holderBalances:sample});
  expect(observedHolderBalances({context:{latestPrice:2},audience:data.snapshot()})).toEqual([{id:mint,balance:1000}]);
  expect(data.snapshot(Date.now()+3600001)).toMatchObject({weight:0,holderBalances:[]});
 });
 it('keeps the visual loading while the aggregate count request is still pending',()=>{
  const base={context:{latestPrice:1},audience:{state:'loading',holders:null,holdings:{state:'unavailable',weight:0,records:[]},relationships:{state:'unavailable',weight:0,clusters:[]}}};
  expect(earthboundMarketState(base)).toMatchObject({holderFetchLoading:true,holderFetchSettled:false});
  expect(earthboundMarketState({...base,audience:{...base.audience,state:'unavailable'}})).toMatchObject({holderFetchLoading:false,holderFetchSettled:true});
 });
 it('renders the recovered 76-holder population through the production visual adapter',()=>{
  const canvas=()=>{
   const node={style:{},dataset:{},setAttribute(){},remove(){}};
   const context={clearRect(){},createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData(){},drawImage(){}};
   node.getContext=()=>context;return node;
  };
  vi.stubGlobal('document',{createElement:canvas});vi.stubGlobal('devicePixelRatio',1);
  const renderer=createEarthboundRenderer({append(){},closest:()=>null});
  renderer.render({width:128,height:128,time:0,seed:42,inputs:earthboundMarketState({context:{latestPrice:.00002},audience:{holders:76}})});
  expect(renderer.snapshot()).toMatchObject({reportedHolders:76,representedPopulation:76,markCount:76});
  renderer.close();
 });
 it('cancels the provider fallback when the selected coin changes',async()=>{
  const abort=new AbortController();
  vi.stubGlobal('fetch',vi.fn(async()=>{abort.abort();throw abort.signal.reason;}));
  await expect(fetchHolderCount('solana',mint,{signal:abort.signal})).rejects.toBe(abort.signal.reason);
  expect(fetch).toHaveBeenCalledTimes(1);
 });
});

// Exercise the deployed cache method against a minimal SQL store, without
// booting unrelated Worker services or making external provider calls.
const worker=readFileSync(new URL('../../../cloudflare/insightx/worker.js',import.meta.url),'utf8');
const method=worker.slice(worker.indexOf(' async count(network,address){'),worker.indexOf(' async load(key,network,address){'));
function relayFixture(saved,result){
 const provider=vi.fn(async()=>result),writes=[];
 const Fixture=vm.runInNewContext('class Fixture {'+method+'}; Fixture',{
  Date,HOUR:3600000,DAY:86400000,fetchBlockscoutCount:async()=>null,goPlusAccessToken:async()=>null,fetchHolderCount:provider,
 });
 const relay=new Fixture();relay.env={};relay.ctx={storage:{transactionSync:fn=>fn()}};
 relay.sql={exec(sql,...args){
  if(sql.startsWith('INSERT OR REPLACE INTO holder_counts'))writes.push(args);
  return {toArray:()=>sql.startsWith('SELECT * FROM holder_counts')?(saved?[saved]:[]):[]};
 }};
 return {relay,provider,writes};
}
describe('shared holder failure cache',()=>{
 it('releases an old 30-minute negative cache entry and obtains fresh data',async()=>{
  const f=relayFixture({payload:null,fetched:Date.now()-10*60000,retry:Date.now()+20*60000},{holders:76,state:'snapshot'});
  expect(await f.relay.count('solana',mint)).toMatchObject({holders:76});
  expect(f.provider).toHaveBeenCalledTimes(1);
 });
 it('retries ordinary failures after one minute while retaining rate-limit backoff',async()=>{
  const f=relayFixture(null,{holders:null,state:'unavailable'});
  await f.relay.count('solana',mint);
  expect(f.writes[0][3]).toBe(Date.now()+60000);
  const limited=relayFixture({payload:JSON.stringify({holders:null,state:'rate-limited'}),fetched:Date.now()-2*60000,retry:Date.now()+3*60000},{holders:76});
  expect(await limited.relay.count('solana',mint)).toMatchObject({holders:null,retryAt:Date.now()+3*60000});
  expect(limited.provider).not.toHaveBeenCalled();
 });
 it('caches a usable wallet sample even when its aggregate count is absent',async()=>{
  const result={holders:null,holderBalances:[{id:mint,tokenBalance:1}],fetchedAt:Date.now(),state:'snapshot'};
  const f=relayFixture(null,result);
  expect(await f.relay.count('solana',mint)).toEqual(result);
  expect(JSON.parse(f.writes[0][1])).toEqual(result);
 });
});
