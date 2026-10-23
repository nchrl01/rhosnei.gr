import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,expect,it,vi} from 'vitest';

// Exercise the actual page handlers without initializing audio, feeds or WebGL.
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const handlers=app.slice(app.indexOf("$('address').addEventListener('input'"),app.indexOf('let savingCoin=false;'));
const initialSelection=app.slice(app.indexOf('const requestedCoin=new URLSearchParams('),app.indexOf('if(captureMode)window.__upicCaptureStatus'));
const coin={chainId:'ethereum',baseToken:{address:'0x123',symbol:'TEST'}};
function fixture({playing=false}={}){
 const events=new Map(),elements=new Map(),calls=[];
 const element=id=>{
  if(!elements.has(id))elements.set(id,{
   value:'',hidden:false,dataset:{searchNetwork:'all'},attributes:{},events:new Map(),
   setAttribute(name,value){this.attributes[name]=value;},
   removeAttribute(name){delete this.attributes[name];},
   addEventListener(type,fn){this.events.set(type,fn);},
   querySelector(){return null;},
   replaceChildren(...children){this.children=children;this.textContent=children.map(child=>child.textContent||'').join('');},
  });
  return elements.get(id);
 };
 const context=vm.createContext({
  $,document:{addEventListener:(type,fn)=>events.set(type,fn),createElement:()=>({textContent:''})},AbortController,URLSearchParams,
  navigator:{clipboard:{writeText:vi.fn(async()=>{})}},
  playing,ctx:{state:playing?'running':'suspended'},
  loading:false,searchRevision:0,searchController:null,liveConnection:null,discovered:[],captureMode:false,
  syncAddressLabel:vi.fn(),status:vi.fn(),searchFeedback:vi.fn(),savedFeedback:vi.fn(),
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
 const search=context.searchForCoin;
 context.searchForCoin=(...args)=>context.pendingSearch=search(...args);
 const submit=()=>$('coin-form').onsubmit({preventDefault(){}});
 $('coin-form').requestSubmit=submit;
 const input=()=>element('address').events.get('input')();
 const escape=()=>element('address').events.get('keydown')({key:'Escape'});
 const restore=url=>{context.location={search:new URL(url,'https://example.test/').search};context.restoredScore=false;vm.runInContext(initialSelection,context);return context.pendingSearch;};
 return {context,$,events,calls,submit,input,escape,restore};
}

describe('search playback intent',()=>{
 it('primes on manual submit before lookup, then plays the selected contract',async()=>{
  const f=fixture();f.$('address').value=coin.baseToken.address;
  await f.submit();
  expect(f.calls).toEqual(['prime','lookup','prime','choose','play']);
  expect(f.context.market).toBe(coin);
  expect(f.$('play').onclick).toHaveBeenCalledTimes(1);
  expect(f.$('address').value).toBe('');
  expect(f.context.syncAddressLabel).toHaveBeenCalled();
  expect(f.$('coin-search-results').hidden).toBe(true);
 });
 it('keeps an already playing session running without toggling Play',async()=>{
  const f=fixture({playing:true});f.$('address').value=coin.baseToken.address;
  await f.submit();
  expect(f.calls).toEqual(['lookup','choose']);
  expect(f.context.playing).toBe(true);
  expect(f.$('play').onclick).not.toHaveBeenCalled();
 });
 it('keeps URL/init selection quiet without disabling the next manual search',async()=>{
  const f=fixture();
  await f.context.searchForCoin(coin.baseToken.address,{autoPlay:false});
  expect(f.calls).toEqual(['lookup','choose']);
  expect(f.$('address').value).toBe('');
  f.$('address').value=coin.baseToken.address;
  await f.submit();
  expect(f.$('play').onclick).toHaveBeenCalledTimes(1);
 });
 it('starts a coin explicitly chosen in mobile search',async()=>{
  const f=fixture();
  f.events.get('upic:search-coin')({detail:{chain:'ethereum',address:coin.baseToken.address}});
  await f.context.pendingSearch;
  expect(f.context.market).toBe(coin);
  expect(f.$('play').onclick).toHaveBeenCalledTimes(1);
  expect(f.calls.indexOf('prime')).toBeLessThan(f.calls.indexOf('lookup'));
  expect(f.context.findOnchainMarkets).toHaveBeenCalledWith(coin.baseToken.address,expect.objectContaining({network:'ethereum'}));
  expect(f.$('address').value).toBe('');
 });
 it('reopens a saved exchange market with its exact native identity and venue',async()=>{
  const f=fixture();f.context.selectSearchMarket=vi.fn();
  f.events.get('upic:search-coin')({detail:{source:'ccxt',chain:'exchange',query:'cex:coinbaseexchange:ETH/USD',exchangeId:'coinbaseexchange',exchangeSymbol:'ETH/USD',nativeId:'ethereum',symbol:'ETH',name:'Ethereum'}});
  expect(f.context.selectSearchMarket).toHaveBeenCalledWith(expect.objectContaining({exchangeId:'coinbaseexchange',exchangeSymbol:'ETH/USD',nativeId:'ethereum'}),expect.objectContaining({autoPlay:true}));
  expect(f.context.findOnchainMarkets).not.toHaveBeenCalled();
 });
 it('treats clicking a result as playback intent even after a quiet initial query',async()=>{
  const f=fixture();
  await f.context.searchForCoin('TEST',{autoPlay:false});
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
  f.$('address').value='different coin';f.input();resolve(pair);await opening;
  expect(f.context.chooseMarket).not.toHaveBeenCalled();
  expect(f.$('play').onclick).not.toHaveBeenCalled();
  expect(f.$('address').value).toBe('different coin');
 });
 it('aborts an older lookup and only selects the latest search result',async()=>{
  const f=fixture(),next={...coin,baseToken:{address:'0x456',symbol:'NEXT'}};
  let resolve;
  f.context.findOnchainMarkets=vi.fn(address=>address===coin.baseToken.address?new Promise(done=>{resolve=done;}):Promise.resolve([next]));
  const first=f.context.searchForCoin(coin.baseToken.address);
  const firstSignal=f.context.findOnchainMarkets.mock.calls[0][1].signal;
  await f.context.searchForCoin(next.baseToken.address);
  expect(firstSignal.aborted).toBe(true);
  resolve([coin]);await first;
  expect(f.context.market).toBe(next);expect(f.context.chooseMarket).toHaveBeenCalledTimes(1);
 });
 it('Escape cancels lookup without choosing a market or clearing the typed query',async()=>{
  const f=fixture();let resolve;
  f.context.findOnchainMarkets=vi.fn(()=>new Promise(done=>{resolve=done;}));
  f.$('address').value=coin.baseToken.address;const opening=f.submit();
  const signal=f.context.findOnchainMarkets.mock.calls[0][1].signal;
  f.escape();resolve([coin]);await opening;
  expect(signal.aborted).toBe(true);expect(f.context.chooseMarket).not.toHaveBeenCalled();
  expect(f.$('play').onclick).not.toHaveBeenCalled();expect(f.$('address').value).toBe(coin.baseToken.address);
  expect(f.$('coin-search-results').hidden).toBe(true);expect(f.context.loading).toBe(false);
 });
 it('honors an explicit network even when another chain appears first',async()=>{
  const f=fixture(),base={...coin,chainId:'base'};
  f.context.findOnchainMarkets.mockResolvedValue([coin,base]);
  f.$('coin-form').dataset.searchNetwork='base';f.$('address').value=coin.baseToken.address;
  await f.submit();
  expect(f.context.market).toBe(base);
  expect(f.context.findOnchainMarkets).toHaveBeenCalledWith(coin.baseToken.address,expect.objectContaining({network:'base'}));
 });
 it('does not silently fall back to a different requested network',async()=>{
  const f=fixture();await f.context.searchForCoin(coin.baseToken.address,{network:'base'});
  expect(f.context.chooseMarket).not.toHaveBeenCalled();
  expect(f.context.searchFeedback).toHaveBeenCalledWith('No indexed market found on this network.','error');
 });
 it('shows the URL contract by the coin immediately while keeping search empty',async()=>{
  const f=fixture();let resolve;
  f.context.findOnchainMarkets=vi.fn(()=>new Promise(done=>{resolve=done;}));
  const restoring=f.restore('/?coin=0x123&network=ethereum');
  expect(f.$('address').value).toBe('');
  expect(f.$('coin-address')).toMatchObject({hidden:false,textContent:'ETHEREUM · 0x123',dataset:expect.objectContaining({address:'0x123'})});
  expect(f.$('play').onclick).not.toHaveBeenCalled();
  resolve([coin]);await restoring;
  expect(f.context.market).toBe(coin);expect(f.$('address').value).toBe('');
  expect(f.context.primeAudio).not.toHaveBeenCalled();expect(f.$('play').onclick).not.toHaveBeenCalled();
 });
 it('keeps the full address available for copying behind a compact label',async()=>{
  const f=fixture(),address='0x39dbed3a2bd333467115de45665cc57f813c4571';
  f.context.showCoinAddress(address,'ethereum');
  expect(f.$('coin-address').textContent).toBe('ETHEREUM · 0x39dbed…3c4571');
  expect(f.$('coin-address').attributes['aria-label']).toBe('Copy coin address '+address);
  await f.$('coin-address').events.get('click')();
  expect(f.context.navigator.clipboard.writeText).toHaveBeenCalledWith(address);
  expect(f.context.savedFeedback).toHaveBeenCalledWith('Address copied');
 });
 it('hides the address control for exchange pair identifiers',()=>{
  const f=fixture();f.context.showCoinAddress('cex:kraken:ETH/USD','exchange');
  expect(f.$('coin-address').hidden).toBe(true);expect(f.$('coin-address').dataset.address).toBe('');
 });
 it('places the compact address after the coin name, outside the search form',()=>{
  const html=readFileSync(new URL('../public/instrument.html',import.meta.url),'utf8');
  expect(html).toMatch(/<h2 id="coin-name"><\/h2><div[^>]+id="coin-address-row"[^>]*><button[^>]+id="coin-address"/);
  const form=html.slice(html.indexOf('<form id="coin-form"'),html.indexOf('</form>',html.indexOf('<form id="coin-form"')));
  expect(form).not.toContain('id="coin-address"');
 });
});
