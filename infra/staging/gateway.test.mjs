import test from 'node:test';
import assert from 'node:assert/strict';
import gateway,{verifyAccess} from './gateway.js';

const b64url=bytes=>Buffer.from(bytes).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const team='example.cloudflareaccess.com',aud='aud-123';

async function signer(){
 const {publicKey,privateKey}=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',publicKey),kid:'k1'};
 const sign=async(payload,kid='k1')=>{const h=b64url(JSON.stringify({alg:'RS256',kid})),p=b64url(JSON.stringify(payload));const s=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,new TextEncoder().encode(h+'.'+p)));return h+'.'+p+'.'+b64url(s);};
 return {jwk,sign};
}

test('Access JWT verification fails closed',async()=>{
 const {jwk,sign}=await signer(),realFetch=globalThis.fetch;
 globalThis.fetch=async url=>{assert.equal(String(url),`https://${team}/cdn-cgi/access/certs`);return Response.json({keys:[jwk]});};
 try{
  const env={ACCESS_TEAM_DOMAIN:team,ACCESS_AUD:aud,REQUIRE_ACCESS:'true'},now=Math.floor(Date.now()/1000);
  const good=await sign({aud:[aud],iss:`https://${team}`,exp:now+60});
  const req=t=>new Request('https://s.example/',{headers:t?{'Cf-Access-Jwt-Assertion':t}:{}});
  assert.equal(await verifyAccess(req(good),env),true);
  assert.equal(await verifyAccess(req(),env),false);
  assert.equal(await verifyAccess(req(await sign({aud:['other'],iss:`https://${team}`,exp:now+60})),env),false);
  assert.equal(await verifyAccess(req(await sign({aud:[aud],iss:`https://${team}`,exp:now-1})),env),false);
  assert.equal(await verifyAccess(req(await sign({aud:[aud],iss:`https://${team}`,exp:now+60},'unknown')),env),false);
  assert.equal(await verifyAccess(req(good.slice(0,-4)+'AAAA'),env),false);
  assert.equal(await verifyAccess(req(),{REQUIRE_ACCESS:'true'}),false,'missing Access config must not open the gateway');
 }finally{globalThis.fetch=realFetch;}
});

test('routes, prefixes and noindex headers',async()=>{
 const seen=[];
 const binding=name=>({fetch:async r=>{seen.push(name+' '+new URL(r.url).pathname);return new Response('ok');}});
 const env={REQUIRE_ACCESS:'false',DATA:binding('data'),API:binding('api'),ASSETS:binding('assets'),DEPLOYMENT_JSON:'{"chainId":46630}'};
 const get=p=>gateway.fetch(new Request('https://s.example'+p),env);
 assert.equal(await (await get('/robots.txt')).text(),'User-agent: *\nDisallow: /\n');
 assert.equal((await get('/config/deployment.json')).status,200);
 const r=await get('/x/holders');assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow, noarchive');
 await get('/api/v1/config');await get('/instrument.html');
 assert.deepEqual(seen,['data /holders','api /v1/config','assets /instrument.html']);
 assert.equal((await gateway.fetch(new Request('https://s.example/api/x'),{...env,API:undefined})).status,503);
});
