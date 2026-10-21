import {allowedAppOrigin} from './app-origins.js';
import {verifyMessage,getAddress} from 'viem';
import {createSiweMessage} from 'viem/siwe';
import {base58} from '@scure/base';

const MINUTE=60000,DAY=86400000,SESSION_TTL=8*3600000,CHALLENGE_TTL=5*MINUTE;
const MAX_SAVED=100,MAX_TOTAL_SAVED=50000,MAX_CHALLENGES=1000,MAX_SESSIONS=20000;
const bytes=value=>new TextEncoder().encode(value),hex=value=>[...value].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const random=(length=32)=>hex(crypto.getRandomValues(new Uint8Array(length)));
const digest=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(value))));
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Vary':'Origin, Authorization','X-Content-Type-Options':'nosniff'}});
const clean=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';
const venues=new Set(['kraken','coinbaseexchange','binance']);
export function profileAccount(input){
 const namespace=input?.namespace,address=input?.address;
 if(typeof address!=='string')fail('invalid-wallet');
 if(namespace==='eip155'){
  if(!/^0x[0-9a-fA-F]{40}$/.test(address)||/^0x0{40}$/i.test(address))fail('invalid-wallet');
  const chainId=input.chainId??1;if(!Number.isSafeInteger(chainId)||chainId<1||chainId>4294967295)fail('invalid-chain');
  return {namespace,address:address.toLowerCase(),key:'eip155:'+address.toLowerCase(),chainId};
 }
 if(namespace==='solana'){
  try{if(base58.decode(address).length!==32||base58.encode(base58.decode(address))!==address)throw Error();}catch{fail('invalid-wallet');}
  return {namespace,address,key:'solana:'+address};
 }
 fail('unsupported-wallet');
}
export function savedProfileCoin(input,now=Date.now()){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('invalid-coin');
 if(typeof input.address==='string'&&input.address.length>250||typeof (input.chain||input.network)==='string'&&(input.chain||input.network).length>80)fail('invalid-coin');
 const source=input.source==='ccxt'?'ccxt':'dex',nativeId=clean(input.nativeId,100).toLowerCase();
 if(nativeId&&!/^[a-z0-9-]+$/.test(nativeId))fail('invalid-coin');
 let chain=clean(input.chain||input.network,80).toLowerCase(),address=clean(input.address,250),query,key,exchangeId='',exchangeSymbol='';
 if(source==='ccxt'){
  exchangeId=clean(input.exchangeId,40).toLowerCase();exchangeSymbol=clean(input.exchangeSymbol,80).toUpperCase();
  if(!venues.has(exchangeId)||!/^[A-Z0-9.]+\/(?:USD|USDT|USDC)$/.test(exchangeSymbol))fail('invalid-coin');
  chain='exchange';address=null;query='cex:'+exchangeId+':'+exchangeSymbol;key=query+(nativeId?':native:'+nativeId:'');
 }else{
  if(!/^[a-z0-9_-]{1,80}$/.test(chain)||!address||/[\s?&#]/.test(address))fail('invalid-coin');
  // Preserve Move type identifiers and case-sensitive non-EVM addresses.
  query=address;key=chain+':'+(/^0x[0-9a-f]+$/i.test(address)?address.toLowerCase():address);
 }
 let image='';if(input.image){try{const url=new URL(clean(input.image,2048));if(url.protocol==='https:'&&!url.username&&!url.password)image=url.href;}catch{}}
 const params=new URLSearchParams({coin:query});if(source==='dex')params.set('network',chain);if(nativeId)params.set('native',nativeId);
 const symbol=clean(input.symbol,40)||exchangeSymbol.split('/')[0]||address;
 return {key,source,chain,network:chain,address,query,exchangeId,exchangeSymbol,nativeId,symbol,name:clean(input.name,120)||symbol,image,url:'./?'+params,savedAt:now};
}
export async function verifyProfileSignature(account,message,signature){
 try{
  if(account.namespace==='eip155'){
   if(typeof signature!=='string'||!/^0x(?:[0-9a-f]{128}|[0-9a-f]{130})$/i.test(signature))return false;
   // EOA EIP-191 only. No ERC-1271 RPC or undeployed smart-account fallback.
   return await verifyMessage({address:account.address,message,signature});
  }
  if(typeof signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(signature))return false;
  const raw=Uint8Array.from(atob(signature),character=>character.charCodeAt(0));if(raw.length!==64)return false;
  const key=await crypto.subtle.importKey('raw',base58.decode(account.address),{name:'Ed25519'},false,['verify']);
  return await crypto.subtle.verify('Ed25519',key,raw,bytes(message));
 }catch{return false;}
}
async function bodyJSON(request){
 if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))fail('json-required',415);
 if(Number(request.headers.get('Content-Length'))>12000)fail('request-too-large',413);
 const reader=request.body?.getReader();if(!reader)fail('invalid-request');
 let total=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>12000){await reader.cancel();fail('request-too-large',413);}chunks.push(value);}
 const content=new Uint8Array(total);let offset=0;for(const chunk of chunks){content.set(chunk,offset);offset+=chunk.length;}
 try{const value=JSON.parse(new TextDecoder().decode(content));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{fail('invalid-json');}
}
export class ProfileService{
 constructor(ctx,env){
  this.ctx=ctx;this.sql=ctx.storage.sql;this.env=env;
  this.sql.exec('CREATE TABLE IF NOT EXISTS profile_challenges (id TEXT PRIMARY KEY, account TEXT NOT NULL, account_json TEXT NOT NULL, origin TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)');
  this.sql.exec('CREATE INDEX IF NOT EXISTS profile_challenges_account ON profile_challenges(account)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS profile_sessions (hash TEXT PRIMARY KEY, account TEXT NOT NULL, account_json TEXT NOT NULL, origin TEXT NOT NULL, expires INTEGER NOT NULL, created INTEGER NOT NULL)');
  this.sql.exec('CREATE INDEX IF NOT EXISTS profile_sessions_account ON profile_sessions(account)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS profile_saved (account TEXT NOT NULL, coin_key TEXT NOT NULL, payload TEXT NOT NULL, saved INTEGER NOT NULL, PRIMARY KEY(account,coin_key))');
  this.sql.exec('CREATE TABLE IF NOT EXISTS profile_rate (key TEXT PRIMARY KEY, used INTEGER NOT NULL, expires INTEGER NOT NULL)');
 }
 one(query,...args){return this.sql.exec(query,...args).toArray()[0];}
 rate(key,limit,period,now){
  const bucket=key+':'+Math.floor(now/period),row=this.one('SELECT used FROM profile_rate WHERE key=?',bucket);
  if((row?.used||0)>=limit)fail('profile-rate-limited',429);
  this.sql.exec('INSERT INTO profile_rate (key,used,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET used=used+1',bucket,(Math.floor(now/period)+1)*period);
 }
 sweep(now){this.sql.exec('DELETE FROM profile_challenges WHERE expires<=?',now);this.sql.exec('DELETE FROM profile_sessions WHERE expires<=?',now);this.sql.exec('DELETE FROM profile_rate WHERE expires<=?',now);}
 coins(account){return this.sql.exec('SELECT payload FROM profile_saved WHERE account=? ORDER BY saved DESC,coin_key ASC',account).toArray().map(row=>JSON.parse(row.payload));}
 async authenticate(request,origin,now){
  const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization')||'')?.[1];if(!token)fail('authentication-required',401);
  const hash=await digest(token),session=this.one('SELECT * FROM profile_sessions WHERE hash=?',hash);
  if(!session||session.expires<=now||session.origin!==origin)fail('session-expired',401);
  return {...session,accountData:JSON.parse(session.account_json)};
 }
 async fetch(request){
  try{return await this.handle(request);}catch(error){return response({error:error.status?error.message:'profile-unavailable'},error.status||503);}
 }
 async handle(request){
  const origin=request.headers.get('Origin')||'',allowed=this.env.ALLOWED_ORIGIN;
  if(!origin||!allowedAppOrigin(origin,this.env)&&!/^http:\/\/(localhost|127\.0\.0\.1):(4173|4180)$/.test(origin))fail('origin-forbidden',403);
  const path=new URL(request.url).pathname,now=Date.now();
  const methods={'/profile/challenge':'POST','/profile/login':'POST','/profile/session':'GET','/profile/saved':request.method==='GET'?'GET':'POST','/profile/saved/remove':'POST','/profile/logout':'POST'};
  if(!methods[path])fail('not-found',404);if(request.method!==methods[path])fail('method-not-allowed',405);
  this.sweep(now);
  if(path==='/profile/challenge'||path==='/profile/login'){
   const ip=await digest(request.headers.get('CF-Connecting-IP')||'unknown');
   this.rate('auth-global',10000,DAY,now);this.rate('auth-ip:'+ip,30,5*MINUTE,now);this.rate('auth-ip-day:'+ip,300,DAY,now);
   const body=await bodyJSON(request);
   if(path==='/profile/challenge'){
    const account=profileAccount(body);this.rate('challenge-account:'+account.key,5,5*MINUTE,now);
    if(this.one('SELECT COUNT(*) AS count FROM profile_challenges').count>=MAX_CHALLENGES)fail('profile-capacity',429);
    const challengeId=random(16),nonce=random(16),expiresAt=now+CHALLENGE_TTL;
    const domain=new URL(origin).host,uri=allowedAppOrigin(origin,this.env)?new URL(new URL(this.env.PROFILE_APP_URL||allowed+'/').pathname,origin).href:origin+'/';
    const statement='Sign in to your UPIC profile to access your private saved coins. This does not authorize a transaction.';
    const message=account.namespace==='eip155'?createSiweMessage({domain,address:getAddress(account.address),statement,uri,version:'1',chainId:account.chainId,nonce,issuedAt:new Date(now),expirationTime:new Date(expiresAt)}):domain+' wants you to sign in with your Solana account:\n'+account.address+'\n\n'+statement+'\n\nURI: '+uri+'\nVersion: 1\nNonce: '+nonce+'\nIssued At: '+new Date(now).toISOString()+'\nExpiration Time: '+new Date(expiresAt).toISOString();
    this.sql.exec('DELETE FROM profile_challenges WHERE account=? AND origin=?',account.key,origin);
    this.sql.exec('INSERT INTO profile_challenges (id,account,account_json,origin,message,expires) VALUES (?,?,?,?,?,?)',challengeId,account.key,JSON.stringify(account),origin,message,expiresAt);
    return response({challengeId,message,expiresAt});
   }
   if(typeof body.challengeId!=='string'||!/^[a-f0-9]{32}$/.test(body.challengeId))fail('invalid-challenge',401);
   const challenge=this.one('SELECT * FROM profile_challenges WHERE id=?',body.challengeId);
   if(!challenge||challenge.expires<=now||challenge.origin!==origin||challenge.attempts>=5)fail('challenge-expired',401);
   this.sql.exec('UPDATE profile_challenges SET attempts=attempts+1 WHERE id=?',challenge.id);
   const account=JSON.parse(challenge.account_json);
   if(!await verifyProfileSignature(account,challenge.message,body.signature))fail('invalid-signature-or-unsupported-wallet',401);
   const token=random(),hash=await digest(token),expiresAt=Date.now()+SESSION_TTL;
   this.ctx.storage.transactionSync(()=>{
    const current=this.one('SELECT expires FROM profile_challenges WHERE id=?',challenge.id);
    if(!current||current.expires<=Date.now())fail('challenge-expired',401);
    if(this.one('SELECT COUNT(*) AS count FROM profile_sessions').count>=MAX_SESSIONS)fail('profile-capacity',429);
    this.sql.exec('DELETE FROM profile_challenges WHERE id=?',challenge.id);
    this.sql.exec('DELETE FROM profile_sessions WHERE hash IN (SELECT hash FROM profile_sessions WHERE account=? ORDER BY created DESC LIMIT -1 OFFSET 7)',account.key);
    this.sql.exec('INSERT INTO profile_sessions (hash,account,account_json,origin,expires,created) VALUES (?,?,?,?,?,?)',hash,account.key,challenge.account_json,origin,expiresAt,Date.now());
   });
   return response({token,expiresAt,account});
  }
  const session=await this.authenticate(request,origin,now);this.rate('account:'+session.account,120,MINUTE,now);
  if(path==='/profile/session')return response({account:session.accountData,expiresAt:session.expires});
  if(path==='/profile/logout'){this.sql.exec('DELETE FROM profile_sessions WHERE hash=?',session.hash);return response({ok:true});}
  if(request.method==='GET')return response({coins:this.coins(session.account)});
  this.rate('writes:'+session.account,30,MINUTE,now);const body=await bodyJSON(request);
  if(path==='/profile/saved/remove'){
   if(typeof body.key!=='string'||body.key.length>400)fail('invalid-coin');
   this.sql.exec('DELETE FROM profile_saved WHERE account=? AND coin_key=?',session.account,body.key);
  }else{
   const coin=savedProfileCoin(body.coin,now);
   this.ctx.storage.transactionSync(()=>{
    const exists=this.one('SELECT coin_key FROM profile_saved WHERE account=? AND coin_key=?',session.account,coin.key);
    if(!exists&&this.one('SELECT COUNT(*) AS count FROM profile_saved WHERE account=?',session.account).count>=MAX_SAVED)fail('saved-limit-reached',409);
    if(!exists&&this.one('SELECT COUNT(*) AS count FROM profile_saved').count>=MAX_TOTAL_SAVED)fail('profile-capacity',429);
    this.sql.exec('INSERT INTO profile_saved (account,coin_key,payload,saved) VALUES (?,?,?,?) ON CONFLICT(account,coin_key) DO UPDATE SET payload=excluded.payload,saved=excluded.saved',session.account,coin.key,JSON.stringify(coin),now);
   });
  }
  return response({coins:this.coins(session.account)});
 }
}
