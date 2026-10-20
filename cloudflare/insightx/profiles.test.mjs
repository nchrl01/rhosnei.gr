import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import {privateKeyToAccount,generatePrivateKey} from 'viem/accounts';
import {base58} from '@scure/base';
import {ProfileService,profileAccount,savedProfileCoin,verifyProfileSignature} from './profiles.js';
const origin='https://nchrl01.github.io',coin={chain:'ethereum',address:'0x'+'aB'.repeat(20),symbol:'TEST',name:'Fixture coin',image:'https://example.com/image.png'};
function fixture(){
 const db=new DatabaseSync(':memory:');
 const ctx={storage:{sql:{exec(query,...args){const statement=db.prepare(query);return {toArray:()=>statement.columns().length?statement.all(...args):(statement.run(...args),[])};}},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}}};
 // Workers exec executes immediately; expose its SQL cursor semantics faithfully.
 ctx.storage.sql.exec=(query,...args)=>{const statement=db.prepare(query),rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};};
 const service=new ProfileService(ctx,{ALLOWED_ORIGIN:origin,PROFILE_APP_URL:origin+'/rhosnei.gr/'});
 async function call(path,{body,token,method=body===undefined?'GET':'POST',requestOrigin=origin,ip='192.0.2.1'}={}){
  const headers={'Origin':requestOrigin,'CF-Connecting-IP':ip};if(token)headers.Authorization='Bearer '+token;if(body!==undefined)headers['Content-Type']='application/json';
  const result=await service.fetch(new Request('https://profiles.example/profile/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}));
  return {status:result.status,data:await result.json(),headers:result.headers};
 }
 async function login(signer=privateKeyToAccount(generatePrivateKey()),options={}){
  const challenge=await call('challenge',{body:{namespace:'eip155',address:signer.address,chainId:1},...options});assert.equal(challenge.status,200);
  const signature=await signer.signMessage({message:challenge.data.message});const result=await call('login',{body:{challengeId:challenge.data.challengeId,signature},...options});assert.equal(result.status,200);
  return {...result.data,signer,challenge:challenge.data,signature};
 }
 return {service,db,call,login};
}
test('EVM sign-in proves possession, binds domain/path, stores hashed sessions and rejects challenge replay',async()=>{
 const f=fixture(),auth=await f.login();assert.match(auth.challenge.message,/nchrl01.github.io wants you to sign in/);assert.match(auth.challenge.message,/URI: https:\/\/nchrl01.github.io\/rhosnei.gr\//);assert.match(auth.token,/^[a-f0-9]{64}$/);
 assert.ok(auth.expiresAt>Date.now());assert.equal(f.db.prepare('SELECT hash FROM profile_sessions').get().hash===auth.token,false);
 assert.equal((await f.call('session',{token:auth.token})).data.account.key,auth.account.key);
 assert.equal((await f.call('login',{body:{challengeId:auth.challenge.challengeId,signature:auth.signature}})).status,401);
});
test('Solana Ed25519 signs the exact UTF8 challenge with a canonical base64 signature',async()=>{
 const f=fixture(),key=await webcrypto.subtle.generateKey('Ed25519',true,['sign','verify']),address=base58.encode(new Uint8Array(await webcrypto.subtle.exportKey('raw',key.publicKey)));
 const challenge=await f.call('challenge',{body:{namespace:'solana',address}});assert.equal(challenge.status,200);
 const signature=Buffer.from(await webcrypto.subtle.sign('Ed25519',key.privateKey,new TextEncoder().encode(challenge.data.message))).toString('base64');
 assert.equal((await f.call('login',{body:{challengeId:challenge.data.challengeId,signature}})).status,200);
 assert.equal(await verifyProfileSignature({namespace:'solana',address},challenge.data.message+'changed',signature),false);
});
test('invalid signatures and claimed wallet addresses never authenticate',async()=>{
 const f=fixture(),owner=privateKeyToAccount(generatePrivateKey()),attacker=privateKeyToAccount(generatePrivateKey());
 const challenge=await f.call('challenge',{body:{namespace:'eip155',address:owner.address}}),signature=await attacker.signMessage({message:challenge.data.message});
 const result=await f.call('login',{body:{challengeId:challenge.data.challengeId,signature,address:attacker.address}});assert.equal(result.status,401);assert.equal(result.data.error,'invalid-signature-or-unsupported-wallet');
 assert.equal((await f.call('saved?address='+owner.address)).status,401);assert.equal((await f.call('saved',{body:{coin,address:owner.address}})).status,401);
});
test('one concurrent challenge can create only one authenticated session',async()=>{
 const f=fixture(),owner=privateKeyToAccount(generatePrivateKey()),challenge=await f.call('challenge',{body:{namespace:'eip155',address:owner.address}}),signature=await owner.signMessage({message:challenge.data.message});
 const results=await Promise.all([1,2].map(()=>f.call('login',{body:{challengeId:challenge.data.challengeId,signature}})));assert.deepEqual(results.map(row=>row.status).sort(),[200,401]);
});
test('private reads and removals are scoped to the verified session account',async()=>{
 const f=fixture(),a=await f.login(),b=await f.login();
 const saved=await f.call('saved',{token:a.token,body:{coin,account:b.account.key}});assert.equal(saved.status,200);assert.equal(saved.data.coins.length,1);
 assert.deepEqual((await f.call('saved?account='+a.account.key,{token:b.token})).data.coins,[]);
 await f.call('saved/remove',{token:b.token,body:{key:saved.data.coins[0].key,account:a.account.key}});
 assert.equal((await f.call('saved',{token:a.token})).data.coins.length,1);assert.deepEqual((await f.call('saved',{token:b.token})).data.coins,[]);
 const out=await f.call('saved',{token:a.token});assert.match(out.headers.get('Cache-Control'),/private, no-store/);assert.match(out.headers.get('Vary'),/Authorization/);
});
test('server reconstructs identity and URL, preserves case-sensitive coins, exchange venue and native identity',()=>{
 const saved=savedProfileCoin({...coin,key:'forged',url:'https://evil.example',image:'javascript:alert(1)',savedAt:1},123);assert.equal(saved.key,'ethereum:'+coin.address.toLowerCase());assert.equal(saved.image,'');assert.equal(saved.savedAt,123);assert.equal(saved.url.startsWith('./?coin='),true);
 assert.notEqual(savedProfileCoin({...coin,chain:'base'}).key,saved.key);
 assert.notEqual(savedProfileCoin({chain:'solana',address:'AbC'}).key,savedProfileCoin({chain:'solana',address:'abc'}).key);
 assert.equal(savedProfileCoin({chain:'sui',address:'0x2::Coin::TOKEN'}).address,'0x2::Coin::TOKEN');
 const exchange=savedProfileCoin({source:'ccxt',exchangeId:'kraken',exchangeSymbol:'ETH/USD',nativeId:'ethereum'});assert.equal(exchange.query,'cex:kraken:ETH/USD');assert.match(exchange.url,/native=ethereum/);
});
test('expired challenges and sessions are refused, logout revokes immediately',async()=>{
 const f=fixture(),auth=await f.login();f.db.exec('UPDATE profile_sessions SET expires=0');assert.equal((await f.call('saved',{token:auth.token})).status,401);
 const fresh=await f.login();assert.equal((await f.call('logout',{token:fresh.token,body:{}})).status,200);assert.equal((await f.call('session',{token:fresh.token})).status,401);
 const challenge=await f.call('challenge',{body:{namespace:'eip155',address:auth.signer.address}});f.db.exec('UPDATE profile_challenges SET expires=0');const signature=await auth.signer.signMessage({message:challenge.data.message});assert.equal((await f.call('login',{body:{challengeId:challenge.data.challengeId,signature}})).status,401);
});
test('untrusted origins and cross-origin session reuse are denied',async()=>{
 const f=fixture();assert.equal((await f.call('challenge',{requestOrigin:'https://attacker.example',body:{namespace:'eip155',address:coin.address}})).status,403);
 const auth=await f.login();assert.equal((await f.call('saved',{token:auth.token,requestOrigin:'http://localhost:4173'})).status,401);
});
test('challenge attempts, body size, and bookmark capacity are bounded',async()=>{
 const f=fixture(),auth=await f.login();
 assert.equal((await f.call('saved',{token:auth.token,body:{coin,oversized:'x'.repeat(13000)}})).status,413);
 for(let i=0;i<100;i++){f.db.exec('DELETE FROM profile_rate');assert.equal((await f.call('saved',{token:auth.token,body:{coin:{...coin,address:'token-'+i}}})).status,200);}
 f.db.exec('DELETE FROM profile_rate');assert.equal((await f.call('saved',{token:auth.token,body:{coin:{...coin,address:'one-too-many'}}})).status,409);
 const challenger=privateKeyToAccount(generatePrivateKey());for(let i=0;i<5;i++)assert.equal((await f.call('challenge',{body:{namespace:'eip155',address:challenger.address}})).status,200);
 assert.equal((await f.call('challenge',{body:{namespace:'eip155',address:challenger.address}})).status,429);
});
test('invalid account namespaces, zero EVM addresses and malformed Solana keys fail closed',()=>{
 for(const input of [{namespace:'other',address:coin.address},{namespace:'eip155',address:'0x'+'0'.repeat(40)},{namespace:'solana',address:'not-a-key'},{namespace:'eip155',address:coin.address,chainId:-1}])assert.throws(()=>profileAccount(input));
});
