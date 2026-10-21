import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {CoinCaptures,verifyCapturePublisher,validateCapturePayload,captureIdentity,captureCapabilities} from './coin-captures.js';
const now=Math.floor(Date.now()/1000),workflow='nchrl01/rhosnei.gr/.github/workflows/captures.yml@refs/heads/main';
const pair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await webcrypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key',alg:'RS256',use:'sig'};
const claims={iss:'https://token.actions.githubusercontent.com',aud:'upic-live-captures',repository:'nchrl01/rhosnei.gr',repository_id:'981774121',ref:'refs/heads/main',workflow_ref:workflow,event_name:'schedule',iat:now-5,nbf:now-5,exp:now+300};
async function token(changes={},header={}){const a=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:jwk.kid,...header})).toString('base64url'),b=Buffer.from(JSON.stringify({...claims,...changes})).toString('base64url');const signature=await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(a+'.'+b));return a+'.'+b+'.'+Buffer.from(signature).toString('base64url');}
const identity=captureIdentity('ethereum','0x6982508145454ce325ddbe47a25d4ec3d2311933');
const image=Buffer.alloc(24);image.write('RIFF');image.writeUInt32LE(16,4);image.write('WEBPVP8 ',8);image.writeUInt32LE(4,16);
const body=(capturedAt=Date.now())=>({metadata:{...identity,captureKind:'live-player-frame-v1',capturedAt,marketCap:100,coverage:'observed sample'},imageBase64:image.toString('base64')});
function storage(){const db=new DatabaseSync(':memory:');return {storage:{sql:{exec(sql,...args){const normalized=args.map(value=>value instanceof ArrayBuffer?new Uint8Array(value):value),statement=db.prepare(sql);const rows=/^\s*SELECT/i.test(sql)?statement.all(...normalized):(statement.run(...normalized),[]);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const value=fn();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}}}};}

test('only exact catalogue identities, including alternate platforms',()=>{assert.ok(identity);assert.ok(captureCapabilities.catalogueIdentities>1001);assert.equal(captureIdentity('base',identity.address),null);assert.equal(captureIdentity('bitcoin',''),null);});
test('valid fixed GitHub issuer/audience/repo/ref/workflow signature',async()=>{assert.equal((await verifyCapturePublisher(await token(),{now,jwks:[jwk]})).repository,claims.repository);assert.ok(await verifyCapturePublisher(await token({job_workflow_ref:workflow}),{now,jwks:[jwk]}));});
test('reject forged identity, trigger, expired/future token and algorithm confusion',async()=>{
 for(const change of [{iss:'https://attacker.example'},{aud:'different'},{repository:'fork/rhosnei.gr'},{ref:'refs/heads/other'},{workflow_ref:workflow.replace('captures.yml','other.yml')},{job_workflow_ref:'attacker/reusable.yml@main'},{event_name:'pull_request_target'},{exp:now},{iat:now+40},{iat:now-1000},{exp:now+2000},{nbf:now+40}])await assert.rejects(verifyCapturePublisher(await token(change),{now,jwks:[jwk]}),{status:401});
 for(const header of [{alg:'HS256'},{alg:'none'},{typ:'different'},{jku:'https://attacker.example'},{kid:'other-key'},{crit:['x']}])await assert.rejects(verifyCapturePublisher(await token({},header),{now,jwks:[jwk]}),{status:401});
 const valid=await token(),parts=valid.split('.');parts[1]=Buffer.from(JSON.stringify({...claims,run_id:'tampered'})).toString('base64url');await assert.rejects(verifyCapturePublisher(parts.join('.'),{now,jwks:[jwk]}),{status:401});
 await assert.rejects(verifyCapturePublisher('not-a-jwt',{now,jwks:[jwk]}),{status:401});
});
test('reject synthetic flags, wrong chain, future/stale timestamp, bad WebP, malformed values',()=>{
 const value=body();assert.equal(validateCapturePayload(value).metadata.key,identity.key);
 for(const change of [{captureKind:'seed-preview'},{chain:'base'},{key:'wrong'},{capturedAt:Date.now()+5000},{capturedAt:Date.now()-86401000},{marketCap:-1},{holders:2.5},{sourceDataHash:'invalid'},{holderFetchedAt:Date.now()+5000}])assert.throws(()=>validateCapturePayload({...value,metadata:{...value.metadata,...change}}),{status:400});
 assert.throws(()=>validateCapturePayload({...value,imageBase64:Buffer.from('not a WebP').toString('base64')}),{status:400});
 const bad=Buffer.from(image);bad.writeUInt32LE(100,4);assert.throws(()=>validateCapturePayload({...value,imageBase64:bad.toString('base64')}),{status:400});
});
test('authenticated writes retain latest only; public reads return original bytes',async()=>{
 const previousFetch=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(url,'https://token.actions.githubusercontent.com/.well-known/jwks');return Response.json({keys:[jwk]});};
 try{
  const store=new CoinCaptures(storage()),authorization='Bearer '+await token();
  const post=value=>store.fetch(new Request('https://worker.example/coin-captures',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(value)}));
  const first=body();assert.equal((await post(first)).status,201);assert.equal((await post(first)).status,409);
  assert.equal((await store.fetch(new Request('https://worker.example/coin-captures',{method:'POST',body:'{}'}))).status,401);
  const list=await (await store.fetch(new Request('https://worker.example/coin-captures'))).json();assert.equal(list.captures.length,1);assert.equal(list.nextCursor,null);assert.equal(list.captures[0].chain,'ethereum');
  const response=await store.fetch(new Request('https://worker.example'+list.captures[0].imageURL));assert.equal(response.headers.get('Content-Type'),'image/webp');assert.deepEqual(Buffer.from(await response.arrayBuffer()),image);
  const second=body(first.metadata.capturedAt+1);assert.equal((await post(second)).status,201);assert.equal((await post(first)).status,409);assert.equal((await store.fetch(new Request('https://worker.example'+list.captures[0].imageURL))).status,404);
  const single=await (await store.fetch(new Request('https://worker.example/coin-captures?'+new URLSearchParams({network:'ethereum',address:identity.address})))).json();assert.equal(single.capturedAt,second.metadata.capturedAt);
 }finally{globalThis.fetch=previousFetch;}
});
