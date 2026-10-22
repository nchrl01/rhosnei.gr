import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';

const wallet=vi.hoisted(()=>({account:null,listener:null,get:vi.fn(),ensure:vi.fn(),sign:vi.fn()}));
vi.mock('../public/wallet-session.js?v=430',()=>({
 getWalletAccount:wallet.get,ensureWalletAccount:wallet.ensure,signWalletMessage:wallet.sign,
 subscribeWalletAccount:callback=>{wallet.listener=callback;callback(wallet.account);return ()=>{};},
}));
const account={namespace:'eip155',address:'0x1234567890123456789012345678901234567890',chainId:'eip155:1'};
const pair={chainId:'ethereum',baseToken:{address:'0xAbCd',symbol:'TEST',name:'Test coin'},info:{imageUrl:'https://example.com/coin.png'}};
let api,server,fetcher,storage;
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
const pathOf=url=>String(url).split('/profile')[1];
async function serve(url,options={}){
 const path=pathOf(url),body=options.body?JSON.parse(options.body):null;
 if(path==='/challenge')return response({challengeId:'nonce-1',message:'Sign in to AV. Nonce: nonce-1'});
 if(path==='/login')return response({token:'session-secret',expiresAt:Date.now()+60000,account:{...wallet.account}});
 if(path==='/saved'&&options.method==='GET')return response({coins:server.map(coin=>({...coin}))});
 if(path==='/saved'&&options.method==='POST'){server=[body.coin,...server.filter(coin=>coin.key!==body.coin.key)];return response({coins:server});}
 if(path==='/saved/remove'){server=server.filter(coin=>coin.key!==body.key);return response({coins:server});}
 if(path==='/logout')return response({ok:true});
 throw Error('Unexpected profile route '+path);
}
beforeEach(async()=>{
 vi.resetModules();wallet.account={...account};wallet.listener=null;server=[];
 wallet.get.mockReset().mockImplementation(()=>wallet.account);
 wallet.ensure.mockReset().mockImplementation(async()=>wallet.account);
 wallet.sign.mockReset().mockImplementation(async()=>({signature:'wallet-proof',account:{...wallet.account}}));
 storage={getItem:vi.fn(()=>null),setItem:vi.fn(),removeItem:vi.fn()};
 vi.stubGlobal('localStorage',storage);vi.stubGlobal('window',new EventTarget());
 vi.stubGlobal('location',new URL('https://example.com/rhosnei.gr/'));
 fetcher=vi.fn(serve);vi.stubGlobal('fetch',fetcher);
 api=await import('../public/saved-coins.js');
});
afterEach(()=>vi.unstubAllGlobals());

describe('profile saved coins',()=>{
 it('starts signed out and never writes coins or bearer tokens to localStorage',async()=>{
  expect(api.savedCoinsState().status).toBe('signed-out');expect(api.savedCoins()).toEqual([]);
  expect(await api.loadSavedCoins()).toEqual([]);expect(fetcher).not.toHaveBeenCalled();
  await api.toggleSavedCoin(api.savedCoinForMarket(pair));
  expect(storage.setItem).not.toHaveBeenCalled();
 });
 it('verifies wallet sign-in before saving and sends the session bearer only to profile requests',async()=>{
  const changed=vi.fn();window.addEventListener('upic:saved-coins-changed',changed);
  const coin=api.savedCoinForMarket(pair);expect(await api.toggleSavedCoin(coin)).toBe(true);
  expect(fetcher.mock.calls.map(([url,options])=>[pathOf(url),options.method])).toEqual([
   ['/challenge','POST'],['/login','POST'],['/saved','GET'],['/saved','POST'],
  ]);
  expect(wallet.sign).toHaveBeenCalledWith('Sign in to AV. Nonce: nonce-1',account);
  for(const [url,options] of fetcher.mock.calls){
   expect(String(url).startsWith('https://upic-insightx.nchrl01.workers.dev/profile/')).toBe(true);
   expect(options.credentials).toBe('omit');
   if(pathOf(url).startsWith('/saved'))expect(options.headers.Authorization).toBe('Bearer session-secret');
   else expect(options.headers.Authorization).toBeUndefined();
  }
  expect(api.savedCoinsState()).toMatchObject({status:'ready',account});
  expect(api.isCoinSaved(coin.key)).toBe(true);expect(changed).toHaveBeenCalled();
 });
 it('toggles saved coins off without a second wallet signature',async()=>{
  const coin=api.savedCoinForMarket(pair);await api.toggleSavedCoin(coin);
  expect(await api.toggleSavedCoin(coin)).toBe(false);expect(api.savedCoins()).toEqual([]);
  expect(wallet.sign).toHaveBeenCalledTimes(1);
  expect(pathOf(fetcher.mock.calls.at(-1)[0])).toBe('/saved/remove');
 });
 it('preserves native coin identity, exchange venue, pair and safe reopening link',async()=>{
  const coin=api.savedCoinForMarket({source:'ccxt',chainId:'exchange',exchangeId:'coinbaseexchange',exchangeSymbol:'ETH/USD',nativeAsset:{id:'ethereum'},baseToken:{address:'cex:coinbaseexchange:ETH/USD',symbol:'ETH',name:'Ethereum'}});
  await api.toggleSavedCoin(coin);const saved=api.savedCoins()[0],url=new URL(saved.url,location.href);
  expect(saved).toMatchObject({source:'ccxt',address:null,query:'cex:coinbaseexchange:ETH/USD',nativeId:'ethereum'});
  expect(url.searchParams.get('coin')).toBe('cex:coinbaseexchange:ETH/USD');expect(url.searchParams.get('native')).toBe('ethereum');
  expect(url.pathname).toBe('/rhosnei.gr/');
 });
 it('distinguishes networks and case-sensitive addresses while normalizing EVM address case',()=>{
  const a=api.savedCoinForMarket(pair),b=api.savedCoinForMarket({...pair,chainId:'base'});
  expect(a.key).not.toBe(b.key);
  expect(api.savedCoinForMarket({...pair,baseToken:{...pair.baseToken,address:'0xabcd'}}).key).toBe(a.key);
  const sol=address=>api.savedCoinForMarket({chainId:'solana',baseToken:{address,symbol:'SOL'}});
  expect(sol('ABCdef').key).not.toBe(sol('abcDef').key);
 });
 it('returns independent copies of saved rows and account state',async()=>{
  await api.toggleSavedCoin(api.savedCoinForMarket(pair));api.savedCoins()[0].symbol='CHANGED';api.savedCoinsState().account.address='CHANGED';
  expect(api.savedCoins()[0].symbol).toBe('TEST');expect(api.savedCoinsState().account.address).toBe(account.address);
 });
 it('requires sign-in to remove and handles a missing saved key without a mutation',async()=>{
  await expect(api.removeSavedCoin('missing')).rejects.toThrow('Sign in');expect(fetcher).not.toHaveBeenCalled();
  await api.signInSavedCoins();fetcher.mockClear();expect(await api.removeSavedCoin('missing')).toBe(false);expect(fetcher).not.toHaveBeenCalled();
 });
 it('does not claim a failed cloud save succeeded or add an optimistic bookmark',async()=>{
  fetcher.mockImplementation((url,options)=>pathOf(url)==='/saved'&&options.method==='POST'?Promise.resolve(response({},500)):serve(url,options));
  const coin=api.savedCoinForMarket(pair);await expect(api.toggleSavedCoin(coin)).rejects.toThrow('Could not update your profile');
  expect(api.isCoinSaved(coin.key)).toBe(false);expect(api.savedCoinsState().status).toBe('error');expect(storage.setItem).not.toHaveBeenCalled();
 });
 it('resets private saved state when the server rejects an expired session',async()=>{
  await api.toggleSavedCoin(api.savedCoinForMarket(pair));
  fetcher.mockImplementation((url,options)=>pathOf(url)==='/saved'&&options.method==='GET'?Promise.resolve(response({},401)):serve(url,options));
  await expect(api.loadSavedCoins()).rejects.toThrow('Sign in');expect(api.savedCoins()).toEqual([]);expect(api.savedCoinsState().status).toBe('signed-out');
 });
 it('clears a profile immediately when the connected wallet changes',async()=>{
  await api.toggleSavedCoin(api.savedCoinForMarket(pair));wallet.account={...account,address:'0x2222222222222222222222222222222222222222'};wallet.listener(wallet.account);
  expect(api.savedCoins()).toEqual([]);expect(api.savedCoinsState()).toMatchObject({status:'signed-out',account:null});
 });
 it('shares concurrent profile refreshes instead of requesting duplicate lists',async()=>{
  await api.signInSavedCoins();let finish;fetcher.mockClear();fetcher.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const first=api.loadSavedCoins(),second=api.loadSavedCoins();await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
  expect(fetcher).toHaveBeenCalledTimes(1);finish(response({coins:[]}));await Promise.all([first,second]);
  expect(api.savedCoinsState().status).toBe('ready');
 });
 it('guards a refresh reentered by a synchronous loading-state listener',async()=>{
  await api.signInSavedCoins();fetcher.mockClear();let reentered=false,second;
  window.addEventListener('upic:saved-coins-changed',()=>{if(!reentered&&api.savedCoinsState().status==='loading'){reentered=true;second=api.loadSavedCoins();}});
  await api.loadSavedCoins();await second;expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('ignores a completed old-account request after a wallet switch',async()=>{
  await api.signInSavedCoins();let finish;fetcher.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=api.loadSavedCoins();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));wallet.account=null;wallet.listener(null);
  finish(response({coins:[api.savedCoinForMarket(pair)]}));await pending;
  expect(api.savedCoins()).toEqual([]);expect(api.savedCoinsState().status).toBe('signed-out');
 });
 it('keeps the profile signed out when wallet signature is cancelled',async()=>{
  wallet.sign.mockRejectedValueOnce(Error('Signature cancelled'));
  await expect(api.toggleSavedCoin(api.savedCoinForMarket(pair))).rejects.toThrow('Signature cancelled');
  expect(fetcher.mock.calls.map(([url])=>pathOf(url))).toEqual(['/challenge']);
  expect(api.savedCoinsState().status).toBe('signed-out');expect(api.savedCoins()).toEqual([]);
 });
 it('normalizes untrusted remote rows, rejects unsafe images, and bounds the list',async()=>{
  const coin=api.savedCoinForMarket(pair);server=[{...coin,image:'javascript:alert(1)',url:'https://attacker.invalid',key:'spoofed'},coin,null,...Array.from({length:105},(_,i)=>({...coin,address:'token'+i,symbol:'T'+i}))];
  await api.signInSavedCoins();const saved=api.savedCoins();expect(saved).toHaveLength(100);
  expect(saved[0]).toMatchObject({key:'ethereum:0xabcd',image:''});expect(saved[0].url).toContain('network=ethereum');expect(saved[0].url).not.toContain('attacker');
 });
 it('clears local session state immediately on sign-out and revokes the bearer remotely',async()=>{
  await api.toggleSavedCoin(api.savedCoinForMarket(pair));await api.signOutSavedCoins();
  expect(api.savedCoins()).toEqual([]);expect(api.savedCoinsState().status).toBe('signed-out');
  const [url,options]=fetcher.mock.calls.at(-1);expect(pathOf(url)).toBe('/logout');expect(options.headers.Authorization).toBe('Bearer session-secret');
 });
 it('serializes refresh behind an in-flight save so stale lists cannot overwrite it',async()=>{
  await api.signInSavedCoins();const coin=api.savedCoinForMarket(pair);let finish;
  fetcher.mockClear();fetcher.mockImplementation((url,options)=>pathOf(url)==='/saved'&&options.method==='POST'?new Promise(resolve=>{finish=async()=>resolve(await serve(url,options));}):serve(url,options));
  const saving=api.toggleSavedCoin(coin);await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
  const refreshing=api.loadSavedCoins();await Promise.resolve();
  expect(fetcher.mock.calls.filter(([url,options])=>pathOf(url)==='/saved'&&options.method==='GET')).toHaveLength(0);
  await finish();await Promise.all([saving,refreshing]);
  expect(api.isCoinSaved(coin.key)).toBe(true);expect(api.savedCoinsState().status).toBe('ready');
 });
 it('waits for an earlier refresh before saving and preserves the final server result',async()=>{
  await api.signInSavedCoins();const coin=api.savedCoinForMarket(pair);let finish;
  fetcher.mockClear();fetcher.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const refreshing=api.loadSavedCoins();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
  const saving=api.toggleSavedCoin(coin);await Promise.resolve();expect(fetcher).toHaveBeenCalledTimes(1);
  finish(response({coins:[]}));await Promise.all([refreshing,saving]);expect(api.isCoinSaved(coin.key)).toBe(true);
 });
 it('rejects an action waiting on refresh when the wallet changes',async()=>{
  await api.signInSavedCoins();let finish;const coin=api.savedCoinForMarket(pair);
  fetcher.mockClear();fetcher.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const refreshing=api.loadSavedCoins();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
  const saving=api.toggleSavedCoin(coin),failure=expect(saving).rejects.toThrow('Profile changed');
  wallet.account={...account,address:'0x2222222222222222222222222222222222222222'};wallet.listener(wallet.account);
  finish(response({coins:[]}));await refreshing;await failure;
  expect(fetcher.mock.calls.some(([url,options])=>pathOf(url)==='/saved'&&options.method==='POST')).toBe(false);
  expect(api.savedCoinsState().status).toBe('signed-out');
 });
 it('binds queued removal to its original session before a wallet switch',async()=>{
  const coin=api.savedCoinForMarket(pair);await api.toggleSavedCoin(coin);let finish;
  fetcher.mockClear();fetcher.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const refreshing=api.loadSavedCoins();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
  const removal=api.removeSavedCoin(coin.key),failure=expect(removal).rejects.toThrow('Profile changed');
  wallet.account={...account,address:'0x2222222222222222222222222222222222222222'};wallet.listener(wallet.account);
  finish(response({coins:server}));await refreshing;await failure;
  expect(fetcher.mock.calls.some(([url])=>pathOf(url)==='/saved/remove')).toBe(false);
 });

});
