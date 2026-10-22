import {getWalletAccount,subscribeWalletAccount,ensureWalletAccount,signWalletMessage} from './wallet-session.js?v=419';
const ENDPOINT='https://upic-insightx.nchrl01.workers.dev/profile',LIMIT=100;
const venues=new Set(['kraken','coinbaseexchange','binance']);
let cache=[],session=null,epoch=0,loading=null,signingIn=null,mutation=Promise.resolve();
let state={status:'signed-out',error:'',account:null};
// Bookmarks now belong to a verified profile. Never upload old device data silently.
try{globalThis.localStorage?.removeItem('saved-coins-v1');}catch{}
const text=(value,max=250)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';
const tokenKey=value=>/^0x[0-9a-f]+$/i.test(value)?value.toLowerCase():value;
function imageURL(value){
 const input=text(value,2048);if(!input)return '';
 try{
  const base=globalThis.location?.href||'https://upic.invalid/';
  const url=new URL(input,base);
  return !url.username&&!url.password&&(url.protocol==='https:'||url.protocol==='http:'&&url.origin===new URL(base).origin)?url.href:'';
 }catch{return '';}
}
function normalized(coin){
 if(!coin||typeof coin!=='object')return null;
 const source=coin.source==='ccxt'?'ccxt':'dex';
 const chain=text(coin.chain||coin.network,80).toLowerCase();
 const nativeId=text(coin.nativeId,100).toLowerCase();
 if(nativeId&&!/^[a-z0-9-]+$/.test(nativeId))return null;
 let address=text(coin.address),query='',exchangeId='',exchangeSymbol='',key='';
 if(source==='ccxt'){
  exchangeId=text(coin.exchangeId,40).toLowerCase();
  exchangeSymbol=text(coin.exchangeSymbol,80).toUpperCase();
  if(!venues.has(exchangeId)||!/^[A-Z0-9.]+\/(?:USD|USDT|USDC)$/.test(exchangeSymbol))return null;
  address=null;query='cex:'+exchangeId+':'+exchangeSymbol;
  key=query+(nativeId?':native:'+nativeId:'');
 }else{
  if(!/^[a-z0-9_-]+$/.test(chain)||!address||/[\s?&#]/.test(address))return null;
  query=address;key=chain+':'+tokenKey(address);
 }
 const params=new URLSearchParams({coin:query});
 if(source==='dex')params.set('network',chain);
 if(nativeId)params.set('native',nativeId);
 return {
  key,source,chain:source==='ccxt'?'exchange':chain,network:source==='ccxt'?'exchange':chain,address,query,
  exchangeId,exchangeSymbol,nativeId,
  symbol:text(coin.symbol,40)||exchangeSymbol.split('/')[0]||address,
  name:text(coin.name,120)||text(coin.symbol,40)||exchangeSymbol.split('/')[0]||address,
  image:imageURL(coin.image),url:'./?'+params,
  savedAt:Number.isFinite(coin.savedAt)&&coin.savedAt>0?coin.savedAt:Date.now(),
 };
}
const accountKey=account=>account?.address&&account?.namespace?account.namespace+':'+(account.namespace==='eip155'?account.address.toLowerCase():account.address):'';
function changed(){globalThis.window?.dispatchEvent(new CustomEvent('upic:saved-coins-changed',{detail:{coins:savedCoins(),state:savedCoinsState()}}));}
function update(status,error=''){state={status,error,account:session?.account||null};changed();}
const sessionKey='upic-profile-session';
function rememberSession(){try{if(session)sessionStorage.setItem(sessionKey,JSON.stringify(session));else sessionStorage.removeItem(sessionKey);}catch{}}
function reset(){epoch++;session=null;rememberSession();cache=[];loading=null;update('signed-out');}
async function request(path,{token,body}={}){
 const response=await fetch(ENDPOINT+path,{method:body===undefined?'GET':'POST',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 let data;try{data=await response.json();}catch{throw Error('Profile is unavailable. Please try again.');}
 if(!response.ok){const error=Error(response.status===401?'Sign in to your profile again.':response.status===409?'Your Saved list is full. Remove a coin before saving another.':response.status===429?'Too many requests. Please try again shortly.':'Could not update your profile. Please try again.');error.status=response.status;throw error;}
 return data;
}
function acceptRows(data){
 if(!Array.isArray(data?.coins))throw Error('Saved coins could not be loaded.');
 const seen=new Set();cache=data.coins.map(normalized).filter(coin=>coin&&!seen.has(coin.key)&&seen.add(coin.key)).slice(0,LIMIT);
}
function requireSession(){
 if(!session||session.expiresAt<=Date.now()){if(session)reset();return null;}
 return session;
}
export function savedCoins(){return cache.map(coin=>({...coin}));}
export function savedCoinsState(){return {...state,account:state.account?{...state.account}:null};}
export function isCoinSaved(key){return typeof key==='string'&&cache.some(coin=>coin.key===key);}
export async function loadSavedCoins(){
 const auth=requireSession();if(!auth)return [];
 if(loading)return loading;
 const revision=epoch;
 const task=enqueue(async()=>{
  if(revision!==epoch)return [];
  update('loading');
  try{const data=await request('/saved',{token:auth.token});if(revision!==epoch)return [];acceptRows(data);update('ready');return savedCoins();}
  catch(error){if(revision===epoch){if(error.status===401)reset();else update('error',error.message);}throw error;}
 });loading=task;
 try{return await task;}finally{if(loading===task)loading=null;}
}
export async function signInSavedCoins(){
 if(requireSession()){if(state.status!=='ready')await loadSavedCoins();return savedCoins();}
 if(signingIn)return signingIn;
 const task=Promise.resolve().then(async()=>{
  update('loading');
  try{
   const wallet=await ensureWalletAccount(),key=accountKey(wallet),revision=epoch;
   if(!key)throw Error('Choose an Ethereum or Solana wallet to sign in.');
   const challenge=await request('/challenge',{body:{namespace:wallet.namespace,address:wallet.address,...(wallet.namespace==='eip155'?{chainId:Number(wallet.chainId)||1}:{})}});
   if(typeof challenge.message!=='string'||typeof challenge.challengeId!=='string')throw Error('Could not start profile sign-in.');
   if(revision!==epoch||accountKey(getWalletAccount())!==key)throw Error('Wallet changed. Please sign in again.');
   const proof=await signWalletMessage(challenge.message,wallet);
   if(revision!==epoch||accountKey(proof.account)!==key)throw Error('Wallet changed. Please sign in again.');
   const result=await request('/login',{body:{challengeId:challenge.challengeId,signature:proof.signature}});
   if(revision!==epoch||accountKey(getWalletAccount())!==key)throw Error('Wallet changed. Please sign in again.');
   if(typeof result.token!=='string'||!Number.isFinite(result.expiresAt)||result.expiresAt<=Date.now()||accountKey(result.account)!==key)throw Error('Profile sign-in could not be verified.');
   session={token:result.token,expiresAt:result.expiresAt,account:result.account};rememberSession();cache=[];
   return await loadSavedCoins();
  }catch(error){if(!session)update('signed-out',error.message);throw error;}
 });signingIn=task;
 try{return await task;}finally{if(signingIn===task)signingIn=null;}
}
export async function signOutSavedCoins(){
 const auth=session;reset();
 if(auth)try{await request('/logout',{token:auth.token,body:{}});}catch{}
}
function enqueue(action){
 const task=mutation.catch(()=>{}).then(action);mutation=task;return task;
}
export async function toggleSavedCoin(coin){
 const item=normalized(coin);if(!item)throw Error('This coin could not be saved.');
 const revision=epoch;await signInSavedCoins();
 if(revision!==epoch)throw Error('Profile changed. Please try again.');
 const auth=requireSession();if(!auth)throw Error('Sign in to save this coin.');
 return enqueue(async()=>{
  if(revision!==epoch||session!==auth)throw Error('Profile changed. Please try again.');
  const remove=isCoinSaved(item.key);update('loading');
  try{
   const data=await request(remove?'/saved/remove':'/saved',{token:auth.token,body:remove?{key:item.key}:{coin:item}});
   if(revision!==epoch)throw Error('Profile changed. Please try again.');
   acceptRows(data);update('ready');return !remove;
  }catch(error){if(revision===epoch){if(error.status===401)reset();else update('error',error.message);}throw error;}
 });
}
export async function removeSavedCoin(key){
 const auth=requireSession();if(!auth)throw Error('Sign in to manage your saved coins.');
 const revision=epoch;
 return enqueue(async()=>{
  if(revision!==epoch||session!==auth)throw Error('Profile changed. Please try again.');
  if(!isCoinSaved(key))return false;
  update('loading');
  try{const data=await request('/saved/remove',{token:auth.token,body:{key}});if(revision!==epoch)throw Error('Profile changed. Please try again.');acceptRows(data);update('ready');return true;}
  catch(error){if(revision===epoch){if(error.status===401)reset();else update('error',error.message);}throw error;}
 });
}
export function savedCoinForMarket(pair,image=''){
 if(!pair?.baseToken)return null;
 const exchange=pair.source==='ccxt'||pair.chainId==='exchange';
 return normalized({
  source:exchange?'ccxt':'dex',chain:pair.chainId,address:exchange?null:pair.baseToken.address,
  exchangeId:pair.exchangeId||pair.dexId,exchangeSymbol:pair.exchangeSymbol||pair.pairAddress?.split(':').slice(1).join(':'),
  nativeId:pair.nativeAsset?.id||pair.nativeId,
  symbol:pair.baseToken.symbol,name:pair.baseToken.name,
  image:image||pair.info?.imageUrl||pair.baseToken.imageUrl,
 });
}
try{const stored=JSON.parse(sessionStorage.getItem(sessionKey)||'null');if(stored&&typeof stored.token==='string'&&stored.expiresAt>Date.now()&&accountKey(stored.account)){session=stored;state={status:'loading',error:'',account:stored.account};void loadSavedCoins().catch(()=>{});}}catch{}
let walletObserved=false;
subscribeWalletAccount(account=>{
 if(!walletObserved&&!account)return;walletObserved=true;
 if(session&&accountKey(account)!==accountKey(session.account))reset();
});
