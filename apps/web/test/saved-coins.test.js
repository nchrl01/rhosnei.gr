import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
let api,storage;
const pair={chainId:'ethereum',baseToken:{address:'0xAbCd',symbol:'TEST',name:'Test coin'},info:{imageUrl:'https://example.com/coin.png'}};
beforeEach(async()=>{
 vi.resetModules();storage=new Map();
 vi.stubGlobal('localStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)});
 vi.stubGlobal('window',new EventTarget());
 vi.stubGlobal('location',new URL('https://example.com/rhosnei.gr/'));
 api=await import('../public/saved-coins.js');
});
afterEach(()=>vi.unstubAllGlobals());
describe('saved coins',()=>{
 it('saves a coin locally, announces changes, and toggles it off',()=>{
  const changed=vi.fn();window.addEventListener('upic:saved-coins-changed',changed);
  const coin=api.savedCoinForMarket(pair);
  expect(api.toggleSavedCoin(coin)).toBe(true);
  expect(api.isCoinSaved(coin.key)).toBe(true);
  expect(JSON.parse(storage.get('saved-coins-v1'))[0]).toMatchObject({chain:'ethereum',address:'0xAbCd',symbol:'TEST',name:'Test coin',image:'https://example.com/coin.png'});
  expect(api.toggleSavedCoin(coin)).toBe(false);
  expect(api.savedCoins()).toEqual([]);expect(changed).toHaveBeenCalledTimes(2);
 });
 it('preserves exchange venue, pair and native identity in the record and link',()=>{
  const coin=api.savedCoinForMarket({source:'ccxt',chainId:'exchange',exchangeId:'coinbaseexchange',exchangeSymbol:'ETH/USD',nativeAsset:{id:'ethereum'},baseToken:{address:'cex:coinbaseexchange:ETH/USD',symbol:'ETH',name:'Ethereum'}});
  expect(coin).toMatchObject({source:'ccxt',address:null,query:'cex:coinbaseexchange:ETH/USD',nativeId:'ethereum'});
  const url=new URL(coin.url,location.href);
  expect(url.searchParams.get('coin')).toBe('cex:coinbaseexchange:ETH/USD');
  expect(url.searchParams.get('native')).toBe('ethereum');
  expect(url.pathname).toBe('/rhosnei.gr/');
 });
 it('distinguishes networks and case-sensitive addresses, normalizing EVM address case',()=>{
  const a=api.savedCoinForMarket(pair),b=api.savedCoinForMarket({...pair,chainId:'base'});
  expect(a.key).not.toBe(b.key);
  expect(api.savedCoinForMarket({...pair,baseToken:{...pair.baseToken,address:'0xabcd'}}).key).toBe(a.key);
  const sol=address=>api.savedCoinForMarket({chainId:'solana',baseToken:{address,symbol:'SOL'}});
  expect(sol('ABCdef').key).not.toBe(sol('abcDef').key);
 });
 it('removes saved records and returns independent copies',()=>{
  const coin=api.savedCoinForMarket(pair);api.toggleSavedCoin(coin);
  api.savedCoins()[0].symbol='CHANGED';
  expect(api.savedCoins()[0].symbol).toBe('TEST');
  expect(api.removeSavedCoin('missing')).toBe(false);
  expect(api.removeSavedCoin(coin.key)).toBe(true);
  expect(api.isCoinSaved(coin.key)).toBe(false);
 });
 it('rejects unsafe image URLs and rebuilds links from coin identity',()=>{
  api.toggleSavedCoin({...api.savedCoinForMarket(pair),image:'javascript:alert(1)',url:'https://attacker.invalid/',key:'spoofed'});
  const coin=api.savedCoins()[0];
  expect(coin.image).toBe('');expect(coin.url).toContain('network=ethereum');expect(coin.url).not.toContain('attacker');
  expect(coin.key).toBe('ethereum:0xabcd');
 });
 it('bounds saved coins at 100 and keeps newest first',()=>{
  for(let i=0;i<105;i++)api.toggleSavedCoin(api.savedCoinForMarket({...pair,baseToken:{address:'token'+i,symbol:'T'+i}}));
  const rows=api.savedCoins();expect(rows).toHaveLength(100);
  expect(rows[0].address).toBe('token104');expect(rows.at(-1).address).toBe('token5');
 });
 it('does not claim success when browser storage refuses the write',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw Error('Quota exceeded');}});
  expect(()=>api.toggleSavedCoin(api.savedCoinForMarket(pair))).toThrow('Could not save');
  expect(api.savedCoins()).toEqual([]);
 });
 it('refreshes saved state for changes from another tab',()=>{
  expect(api.savedCoins()).toEqual([]);
  storage.set('saved-coins-v1',JSON.stringify([api.savedCoinForMarket(pair)]));
  const event=new Event('storage');Object.defineProperty(event,'key',{value:'saved-coins-v1'});window.dispatchEvent(event);
  expect(api.savedCoins()).toHaveLength(1);
 });
});
