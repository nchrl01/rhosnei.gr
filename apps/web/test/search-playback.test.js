import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,expect,it,vi} from 'vitest';

// Exercise the actual page handlers without initializing audio, feeds or WebGL.
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const handlers=app.slice(app.indexOf('async function selectSearchMarket('),app.indexOf('function shareSnapshot('));
const coin={chainId:'ethereum',baseToken:{address:'0x123',symbol:'TEST'}};
function fixture({playing=false,requestedAutoplay=null}={}){
 const events=new Map(),elements=new Map(),calls=[];
 const element=id=>{
  if(!elements.has(id))elements.set(id,{value:'',hidden:false,dataset:{searchNetwork:'all'},setAttribute(){},querySelector(){return null;}});
  return elements.get(id);
 };
 const context=vm.createContext({
  $,document:{addEventListener:(type,fn)=>events.set(type,fn)},AbortController,
  playing,ctx:{state:playing?'running':'suspended'},requestedAutoplay,requestedNetwork:null,
  loading:false,searchRevision:0,searchController:null,liveConnection:null,discovered:[],captureMode:false,
  syncAddressLabel(){},status(){},searchFeedback(){},
  isExchangeMarket:pair=>pair.source==='ccxt',
  isTokenIdentifier:value=>value.startsWith('0x'),isExchangeQuery:value=>value.includes('/'),
  searchExchangeMarkets:vi.fn(async()=>({pairs:[],errors:[]})),
 });
 function $(id){return element(id);}
 context.searchBusy=value=>{context.loading=value;};
 context.primeAudio=vi.fn(()=>{calls.push('prime');context.ctx.state='running';});
 context.chooseMarket=vi.fn(pair=>{calls.push('choose');context.market=pair;});
 context.findOnchainMarkets=vi.fn(async()=>{calls.push('lookup');return [coin];});
 context.prepareExchangeMarket=vi.fn(async pair=>{calls.push('snapshot');return pair;});
 context.showCoinMatches=vi.fn((_,pairs,onChoose)=>{context.chooseResult=onChoose;});
 $('play').onclick=vi.fn(async()=>{calls.push('play');context.playing=true;});
 vm.runInContext(handlers,context);
 const submit=()=>context.submit=$('coin-form').onsubmit({preventDefault(){}});
 $('coin-form').requestSubmit=submit;
 return {context,$,events,calls,submit};
}

describe('search playback intent',()=>{
 it('primes on manual submit before lookup, then plays the selected contract',async()=>{
  const f=fixture();f.$('address').value=coin.baseToken.address;
  await f.submit();
  expect(f.calls).toEqual(['prime','lookup','prime','choose','play']);
  expect(f.context.market).toBe(coin);
  expect(f.$('play').onclick).toHaveBeenCalledTimes(1);
 });
 it('keeps an already playing session running without toggling Play',async()=>{
  const f=fixture({playing:true});f.$('address').value=coin.baseToken.address;
  await f.submit();
  expect(f.calls).toEqual(['lookup','choose']);
  expect(f.context.playing).toBe(true);
  expect(f.$('play').onclick).not.toHaveBeenCalled();
 });
 it('keeps URL/init selection quiet without disabling the next manual search',async()=>{
  const f=fixture({requestedAutoplay:false});f.$('address').value=coin.baseToken.address;
  await f.submit();
  expect(f.calls).toEqual(['lookup','choose']);
  expect(f.context.requestedAutoplay).toBeNull();
  await f.submit();
  expect(f.$('play').onclick).toHaveBeenCalledTimes(1);
 });
 it('starts a coin explicitly chosen in mobile search',async()=>{
  const f=fixture();
  f.events.get('upic:search-coin')({detail:{chain:'ethereum',address:coin.baseToken.address}});
  await f.context.submit;
  expect(f.context.market).toBe(coin);
  expect(f.$('play').onclick).toHaveBeenCalledTimes(1);
  expect(f.calls.indexOf('prime')).toBeLessThan(f.calls.indexOf('lookup'));
 });
 it('treats clicking a result as playback intent even after a quiet initial query',async()=>{
  const f=fixture({requestedAutoplay:false});f.$('address').value='TEST';
  await f.submit();
  f.context.selectSearchMarket=vi.fn();
  f.context.chooseResult(coin);
  expect(f.context.selectSearchMarket).toHaveBeenCalledWith(coin,expect.objectContaining({autoPlay:true}));
 });
 it('primes an exchange result before its asynchronous snapshot',async()=>{
  const f=fixture(),pair={...coin,source:'ccxt',exchangeName:'Example'};
  await f.context.selectSearchMarket(pair,{autoPlay:true});
  expect(f.calls).toEqual(['prime','snapshot','choose','play']);
 });
 it('does not play an exchange selection superseded during its snapshot',async()=>{
  const f=fixture(),pair={...coin,source:'ccxt',exchangeName:'Example'};
  let resolve;f.context.prepareExchangeMarket=vi.fn(()=>new Promise(done=>{resolve=done;}));
  const opening=f.context.selectSearchMarket(pair,{autoPlay:true});
  f.context.searchRevision++;resolve(pair);await opening;
  expect(f.context.chooseMarket).not.toHaveBeenCalled();
  expect(f.$('play').onclick).not.toHaveBeenCalled();
 });
});
