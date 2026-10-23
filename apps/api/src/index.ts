import {Hono} from 'hono';
import {bodyLimit} from 'hono/body-limit';
import {createPublicClient,http,hashTypedData,verifyTypedData,type Address,type Hex,isAddress} from 'viem';
import {CHAINS,canonicalToken,ENGINE_VERSION,type ChainId,type Collection,type Edition,type Job} from '@upic/domain';
import {assetKey,domain,orderTypes,nftAbi,marketAbi,DOMAINS} from '@upic/sdk';
import {DB} from './db';import {deployment,coordinator,type Env} from './env';import {challenge,login,walletFor,authorized} from './auth';
import {prepare,renderFinished,type Intent,type AssetRow,clientFor} from './services';import {upkeepStatus,runUpkeep} from './upkeep';import {drip} from './faucet';import type {PoolPolicy} from './verification';
export {MarketCoordinator} from './coordinator';
const app=new Hono<{Bindings:Env;Variables:{wallet:Address}}>();
app.use('*',bodyLimit({maxSize:250000,onError:c=>c.json({error:'request-too-large'},413)}));
app.onError((error,c)=>{const message=error.message;const exposed=/^[a-z][a-z0-9-]{0,80}$/.test(message)?message:'service-unavailable';return c.json({error:exposed},exposed.includes('authentication')||exposed.includes('session')?401:exposed.includes('budget')?429:503);});
app.use('*',async(c,next)=>{
 const origin=c.req.header('Origin');if(origin&&origin!==c.env.ALLOWED_ORIGIN)return c.json({error:'origin-forbidden'},403);
 if(origin){c.header('Access-Control-Allow-Origin',origin);c.header('Access-Control-Allow-Credentials','true');c.header('Vary','Origin');}
 c.header('Access-Control-Allow-Headers','Content-Type,Authorization');c.header('Access-Control-Allow-Methods','GET,POST,OPTIONS');c.header('X-Content-Type-Options','nosniff');c.header('Cache-Control','no-store');
 if(c.req.method==='OPTIONS')return c.body(null,204);
 if(!c.req.path.startsWith('/internal/')&&!c.req.path.startsWith('/admin/')&&c.req.path!=='/health'){
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.req.header('CF-Connecting-IP')||'local'));
  const key=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const rate=await coordinator(c.env).fetch('https://internal/rate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});if(!rate.ok)return c.json({error:'request-rate-limited'},429);
 }
 if(['POST','PUT','DELETE'].includes(c.req.method)&&Number(c.req.header('Content-Length')||0)>250000)return c.json({error:'request-too-large'},413);
 await next();
});
app.get('/health',c=>c.json({service:'upic',mode:c.env.MODE,configured:Boolean(c.env.DEPLOYMENT_JSON&&c.env.POSTGREST_TOKEN)}));
app.get('/v1/config',c=>c.json({deployment:deployment(c.env),gateway:c.env.PINATA_GATEWAY,appURL:c.env.PUBLIC_APP_URL}));
// Read-only setup information for testers. Configured credentials are not a
// health check; a renderer with no active lease has no provable heartbeat.
app.get('/v1/status',async c=>{
 const env=c.env,services={database:Boolean(env.POSTGREST_URL&&env.POSTGREST_TOKEN),storage:Boolean(env.IPFS_API||env.PINATA_JWT),rendererAuthorization:Boolean(env.RENDERER_TOKEN),verification:Boolean(env.SOURCE_RPC_JSON&&env.VERIFIER_PRIVATE_KEY),gasFaucet:Boolean(env.FAUCET_PRIVATE_KEY)};
 let renderer:{state:'unknown'|'waiting'|'working'|'failed';queued:number|null;leased:number|null;failed:number|null}={state:'unknown',queued:null,leased:null,failed:null};
 let databaseReachable:boolean|null=null;
 if(services.database){
  try{
   const db=new DB(env),[queued,leased,failed]=await Promise.all(['queued','leased','failed'].map(state=>db.count('upic_jobs',{kind:'eq.render',state:'eq.'+state,...(state==='leased'?{lease_until:'gt.'+new Date().toISOString()}:{} )})));
   databaseReachable=true;renderer={state:leased!>0?'working':queued!>0?'waiting':failed!>0?'failed':'unknown',queued:queued!,leased:leased!,failed:failed!};
  }catch{databaseReachable=false;}
 }
 return c.json({mode:env.MODE,chainId:Number(env.CHAIN_ID),engineVersion:ENGINE_VERSION,services,databaseReachable,renderer});
});
app.get('/v1/chains',c=>{const rpc=JSON.parse(c.env.SOURCE_RPC_JSON||'{}');return c.json(CHAINS.map(chain=>({...chain,adapterSupported:chain.verified,mintingEnabled:chain.verified&&Array.isArray(rpc[chain.id])&&rpc[chain.id].length===2})));});
app.get('/v1/assets',async c=>c.json(await new DB(c.env).list('upic_assets',{select:'asset_key,chain,token,name,symbol,approved,latest,verified_at,evidence_uri',enabled:'eq.true',limit:'100'})));
app.get('/v1/discover',c=>coordinator(c.env).fetch('https://internal/discover?q='+encodeURIComponent(c.req.query('q')||'')));
app.get('/v1/collections',async c=>c.json(await new DB(c.env).list<Collection>('upic_collections',{order:'created_at.desc',limit:'100'})));
app.get('/v1/collections/:address',async c=>{const address=c.req.param('address').toLowerCase();if(!isAddress(address))return c.json({error:'invalid-address'},400);const db=new DB(c.env);return c.json({collection:await db.one<Collection>('upic_collections',{address:'eq.'+address}),editions:await db.list<Edition>('upic_editions',{collection:'eq.'+address,order:'edition.asc'})});});
app.get('/v1/wallet/:address',async c=>{const a=c.req.param('address').toLowerCase();if(!isAddress(a))return c.json({error:'invalid-address'},400);return c.json(await new DB(c.env).list<Edition>('upic_editions',{owner:'eq.'+a}));});
app.get('/v1/archives/:address/:edition',async c=>{const address=c.req.param('address').toLowerCase(),edition=Number(c.req.param('edition'));if(!isAddress(address)||edition<1||edition>100)return c.json({error:'invalid-edition'},400);return c.json(await new DB(c.env).list('upic_archives',{collection:'eq.'+address,edition:'eq.'+edition,order:'stage.asc'}));});
app.get('/v1/markets/:chain/:token',async c=>{const chain=c.req.param('chain') as ChainId,token=canonicalToken(chain,c.req.param('token'));const asset=await new DB(c.env).one<AssetRow>('upic_assets',{chain:'eq.'+chain,token:'eq.'+token});return c.json({frame:asset?.latest||null,verification:asset?.evidence||null,evidenceURI:asset?.evidence_uri||null,historyComplete:false});});
app.get('/v1/history/:key',c=>coordinator(c.env).fetch('https://internal/history?key='+encodeURIComponent(c.req.param('key'))));
app.get('/v1/stream/:key',c=>{if(c.req.header('Upgrade')!=='websocket')return c.json({error:'websocket-required'},400);return coordinator(c.env).fetch(new Request('https://internal/stream?key='+encodeURIComponent(c.req.param('key')),c.req.raw));});
app.get('/v1/upkeep/:address',async c=>{const a=c.req.param('address');if(!isAddress(a))return c.json({error:'invalid-address'},400);return c.json(await upkeepStatus(c.env,a));});
app.post('/v1/faucet',async c=>{const wallet=await walletFor(c.env,c.req.header('Cookie')||'');return c.json(await drip(c.env,wallet));});
app.post('/v1/auth/challenge',async c=>{const {wallet}=await c.req.json<{wallet:Address}>();if(!isAddress(wallet))return c.json({error:'invalid-wallet'},400);return c.json({message:await challenge(c.env,wallet)});});
app.post('/v1/auth/login',async c=>{const {message,signature}=await c.req.json<{message:string;signature:Hex}>();if(message.length>4096)return c.json({error:'invalid-message'},400);const token=await login(c.env,message,signature);c.header('Set-Cookie','upic_session='+token+'; HttpOnly; Path=/; Max-Age=3600; '+(c.env.MODE==='local'?'SameSite=Lax':'SameSite=None; Secure'));return c.json({ok:true});});
app.get('/v1/auth/session',async c=>{try{return c.json({wallet:await walletFor(c.env,c.req.header('Cookie')||'')});}catch{return c.json({wallet:null});}});
app.post('/v1/auth/logout',c=>{c.header('Set-Cookie','upic_session=; HttpOnly; Path=/; Max-Age=0; '+(c.env.MODE==='local'?'SameSite=Lax':'SameSite=None; Secure'));return c.json({ok:true});});
app.use('/v1/prepare/*',async(c,next)=>{c.set('wallet',await walletFor(c.env,c.req.header('Cookie')||''));await next();});
app.post('/v1/prepare/create',async c=>{const {assetKey:key}=await c.req.json<{assetKey:Hex}>();if(!/^0x[0-9a-f]{64}$/.test(key))return c.json({error:'invalid-asset'},400);return c.json(await prepare(c.env,c.get('wallet'),key,true),202);});
app.post('/v1/prepare/mint',async c=>{const {assetKey:key}=await c.req.json<{assetKey:Hex}>();if(!/^0x[0-9a-f]{64}$/.test(key))return c.json({error:'invalid-asset'},400);return c.json(await prepare(c.env,c.get('wallet'),key,false),202);});
app.get('/v1/intents/:id',async c=>{const wallet=await walletFor(c.env,c.req.header('Cookie')||'');const intent=await new DB(c.env).one<Intent>('upic_intents',{id:'eq.'+c.req.param('id'),wallet:'eq.'+wallet});return intent?c.json(intent):c.json({error:'intent-not-found'},404);});
app.get('/v1/orders',async c=>c.json(await new DB(c.env).list('upic_orders',{active:'eq.true',expiry:'gt.'+Math.floor(Date.now()/1000),limit:'100',order:'created_at.desc'})));
app.post('/v1/orders',async c=>{
 const wallet=await walletFor(c.env,c.req.header('Cookie')||''),body=await c.req.json<{order:{seller:Address;collection:Address;tokenId:string;price:string;expiry:string;nonce:string;ownershipNonce:string};signature:Hex}>(),d=deployment(c.env),o=body.order;
 if(o.seller.toLowerCase()!==wallet||!isAddress(o.collection)||!/^\d+$/.test(o.price)||BigInt(o.price)<=0n||BigInt(o.expiry)<=BigInt(Math.floor(Date.now()/1000)))return c.json({error:'invalid-order'},400);
 const collection=o.collection.toLowerCase() as Address,db=new DB(c.env);if(!await db.one('upic_collections',{address:'eq.'+collection}))return c.json({error:'unregistered-collection'},400);
 const order={...o,tokenId:BigInt(o.tokenId),price:BigInt(o.price),expiry:BigInt(o.expiry),nonce:BigInt(o.nonce),ownershipNonce:BigInt(o.ownershipNonce)};
 const client=clientFor(c.env);const valid=await client.verifyTypedData({address:wallet,domain:domain(DOMAINS.marketplace,d.chainId,d.marketplace),types:orderTypes,primaryType:'Order',message:order,signature:body.signature});
 const owner=await client.readContract({address:collection,abi:nftAbi,functionName:'ownerOf',args:[order.tokenId]}),ownershipNonce=await client.readContract({address:collection,abi:nftAbi,functionName:'transferNonce',args:[order.tokenId]});
 if(!valid||owner.toLowerCase()!==wallet||ownershipNonce!==order.ownershipNonce)return c.json({error:'invalid-listing-signature'},400);
 const id=hashTypedData({domain:domain(DOMAINS.marketplace,d.chainId,d.marketplace),types:orderTypes,primaryType:'Order',message:order});
 await db.call('upic_orders',{id,collection,edition:Number(order.tokenId),seller:wallet,price:o.price,expiry:Number(o.expiry),nonce:o.nonce,ownership_nonce:o.ownershipNonce,signature:body.signature,order_data:o});return c.json({id},201);
});
app.use('/admin/*',async(c,next)=>{if(!await authorized(c.req.header('Authorization')||'',c.env.ADMIN_TOKEN))return c.json({error:'unauthorized'},401);await next();});
app.get('/admin/status',c=>coordinator(c.env).fetch('https://internal/status'));
app.get('/admin/jobs',async c=>c.json(await new DB(c.env).list('upic_jobs',{state:'neq.complete',order:'created_at.desc',limit:'100'})));
app.post('/admin/jobs/:id/retry',async c=>{const db=new DB(c.env),id=c.req.param('id');if(!/^[0-9a-f-]{36}$/.test(id))return c.json({error:'invalid-job'},400);await db.call('upic_jobs?id=eq.'+id+'&state=eq.failed',{state:'queued',attempts:0,last_error:null,lease_until:null,lease_token:null,not_before:new Date().toISOString()},'PATCH');return c.json({queued:true});});
app.post('/admin/assets',async c=>{
 const input=await c.req.json<{policy:PoolPolicy;name:string;symbol:string}>(),p=input.policy,chain=CHAINS.find(x=>x.id===p.chain);
 if(!chain?.verified||p.exclusions.length>16||new Set(p.exclusions.map(a=>a.toLowerCase())).size!==p.exclusions.length||p.token.toLowerCase()===p.quote.toLowerCase()||!['v2','v3'].includes(p.protocol)||![p.token,p.pool,p.factory,p.quote,p.quoteFeed,...p.exclusions].every(a=>isAddress(a))||!/^0x[0-9a-f]{64}$/i.test(p.tokenCodeHash)||!/^0x[0-9a-f]{64}$/i.test(p.poolCodeHash)||input.name.length>100||input.symbol.length>20)return c.json({error:'invalid-policy'},400);
 const key=assetKey(chain.chainId!,p.token),db=new DB(c.env);
 if(await db.one('upic_assets',{asset_key:'eq.'+key}))return c.json({error:'explicit-policy-migration-required'},409);
 if((await db.list('upic_assets',{select:'asset_key',limit:String(Number(c.env.MAX_ASSETS||100))})).length>=Number(c.env.MAX_ASSETS||100))return c.json({error:'tracked-asset-capacity'},429);
 await db.call('upic_assets',{asset_key:key,chain:p.chain,token:p.token.toLowerCase(),pool:p.pool.toLowerCase(),policy:p,name:input.name,symbol:input.symbol,approved:true});await db.enqueue('verify','onboard:'+key,{assetKey:key});return c.json({assetKey:key},201);
});
app.post('/admin/upkeep',async c=>c.json(await runUpkeep(c.env)));
app.post('/admin/tick',c=>coordinator(c.env).fetch('https://internal/tick',{method:'POST'}));
app.post('/admin/verify',async c=>{const {assetKey}=await c.req.json<{assetKey:Hex}>();if(!/^0x[0-9a-f]{64}$/.test(assetKey))return c.json({error:'invalid-asset'},400);await new DB(c.env).enqueue('verify','manual:'+assetKey+':'+Date.now(),{assetKey});return c.json({queued:true},202);});
app.post('/admin/backfill',async c=>{
 const {assetKey,blocks}=await c.req.json<{assetKey:Hex;blocks:string[]}>();
 if(!/^0x[0-9a-f]{64}$/.test(assetKey)||blocks.length<2||blocks.length>20||blocks.some(b=>!/^\d+$/.test(b)))return c.json({error:'invalid-backfill'},400);
 const db=new DB(c.env);for(const blockNumber of [...blocks].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1))await db.enqueue('verify','historical:'+assetKey+':'+blockNumber,{assetKey,blockNumber});return c.json({queued:blocks.length},202);
});
app.use('/internal/*',async(c,next)=>{if(!await authorized(c.req.header('Authorization')||'',c.env.RENDERER_TOKEN))return c.json({error:'unauthorized'},401);await next();});
app.post('/internal/render/claim',async c=>c.json((await new DB(c.env).rpc<Job[]>('upic_job_take',{p_kind:'render',p_seconds:900}))[0]||null));
app.post('/internal/storage/reserve',c=>coordinator(c.env).fetch(new Request('https://internal/storage/reserve',{method:'POST',headers:{'Content-Type':'application/json'},body:c.req.raw.body})));
app.post('/internal/render/:id/complete',async c=>{
 const body=await c.req.json<{lease:string;result:{uri:string;image:string;animation_url:string;manifest:string}}>(),job=await new DB(c.env).one<Job & {state:string;lease_until:string}>('upic_jobs',{id:'eq.'+c.req.param('id')});
 if(!job||job.kind!=='render'||job.state!=='leased'||job.lease_token!==body.lease||Date.parse(job.lease_until)<Date.now())return c.json({error:'lease-expired'},409);
 await renderFinished(c.env,job,body.result);return c.json({ok:true});
});
app.post('/internal/render/:id/fail',async c=>{const {lease}=await c.req.json<{lease:string}>();return c.json({ok:await new DB(c.env).rpc('upic_job_finish',{p_id:c.req.param('id'),p_lease:lease,p_result:null,p_error:'render-failed'})});});
export default {fetch:app.fetch,scheduled(controller:ScheduledController,env:Env,ctx:ExecutionContext){ctx.waitUntil(coordinator(env).fetch('https://internal/tick',{method:'POST'}));if(new Date(controller.scheduledTime).getUTCMinutes()===7)ctx.waitUntil(runUpkeep(env).catch(()=>undefined));}};
