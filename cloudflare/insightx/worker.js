import {NativeHolderRelay} from './native-holders.js';
import {VisualHistory} from './visual-history.js';
import {CoinCaptures,authenticateCaptureRequest,captureCapabilities} from './coin-captures.js';
import {HolderBalanceRelay} from './holder-balance-relay.js';
import {CoinSummary,summaryIdentity} from './coin-summary.js';
import {SharedHistoryCache,historyRequest} from './history-cache.js';
import {fetchHolderCount,fetchBlockscoutCount} from './holder-count.js';
import {marketplace} from './marketplace.js';
import {DurableObject} from 'cloudflare:workers';

const HOUR=3600000,DAY=24*HOUR,TTL=6*HOUR;
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const number=value=>value!==null&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const pct=value=>number(value)===null?null:Math.max(0,Math.min(100,Number(value)));
const ARTWORK_HOSTS=new Set(['cdn.dexscreener.com','coin-images.coingecko.com','assets.coingecko.com','i2c.seadn.io','i.seadn.io']);
const ARTWORK_TYPES=new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif']);
const ARTWORK_LIMIT=2*1024*1024;
let goPlusToken=null,goPlusTokenExpires=0,goPlusTokenRequest=null;

async function goPlusAccessToken(env){
 if(env.GOPLUS_ACCESS_TOKEN)return env.GOPLUS_ACCESS_TOKEN;
 const appKey=env.GOPLUS_APP_KEY,appSecret=env.GOPLUS_APP_SECRET;
 if(!appKey||!appSecret)return null;
 if(goPlusToken&&Date.now()<goPlusTokenExpires)return goPlusToken;
 if(goPlusTokenRequest)return goPlusTokenRequest;
 goPlusTokenRequest=(async()=>{
  const time=String(Math.floor(Date.now()/1000)),message=new TextEncoder().encode(appKey+time+appSecret);
  const digest=await crypto.subtle.digest('SHA-1',message),sign=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const response=await fetch('https://api.gopluslabs.io/api/v1/token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({app_key:appKey,time,sign}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('goplus-auth-http-'+response.status);
  const body=await response.json(),token=body.access_token||body.result?.access_token,expires=Number(body.expires_in||body.result?.expires_in);
  if(typeof token!=='string'||!token||!Number.isFinite(expires)||expires<=0)throw Error('goplus-auth-response-invalid');
  goPlusToken=token;goPlusTokenExpires=Date.now()+Math.max(1000,(expires-60)*1000);return token;
 })().catch(()=>null).finally(()=>{goPlusTokenRequest=null;});
 return goPlusTokenRequest;
}

async function artwork(url,headers){
 const source=url.searchParams.get('url')||'';let target;
 try{
  if(!source||source.length>4096||source!==source.trim())throw Error('invalid-url');
  target=new URL(source);
  const authority=/^https:\/\/([^/?#]+)/i.exec(source)?.[1];
  if(target.protocol!=='https:'||!ARTWORK_HOSTS.has(target.hostname)||target.username||target.password||target.port||authority?.toLowerCase()!==target.hostname)throw Error('invalid-url');
  target.hash='';
 }catch{return json({state:'invalid-artwork-url'},400,headers);}
 // Store only public image headers; apply the caller's CORS origin after lookup.
 const cacheURL=new URL('/artwork',url.origin);cacheURL.searchParams.set('url',target.href);
 const key=new Request(cacheURL.href),cache=caches.default;
 const respond=result=>{const response=new Response(result.body,result);for(const [name,value] of Object.entries(headers))response.headers.set(name,value);return response;};
 try{const cached=await cache.match(key);if(cached)return respond(cached);}catch{}
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 let bytes,type;
 try{
  // CDN artwork can redirect between its approved hosts. Validate every hop
  // instead of treating a legitimate CDN redirect as missing artwork.
  let upstream,location=target.href;
  for(let hop=0;hop<4;hop++){
   upstream=await fetch(location,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'image/avif,image/webp,image/png,image/jpeg,image/gif','User-Agent':'Mozilla/5.0 (compatible; AVArtwork/1.0)'},signal:controller.signal});
   if(![301,302,303,307,308].includes(upstream.status))break;
   const next=new URL(upstream.headers.get('Location')||'',location);
   await upstream.body?.cancel();
   if(next.protocol!=='https:'||!ARTWORK_HOSTS.has(next.hostname)||next.username||next.password||next.port)return json({state:'invalid-artwork-redirect'},502,headers);
   location=next.href;
  }
  // CoinGecko publishes the same artwork under both of these CDN domains.
  // Some CDN edges reject Worker-origin requests to the newer domain.
  if(!upstream.ok&&target.hostname==='coin-images.coingecko.com'){
   await upstream.body?.cancel();
   const mirror=new URL(target);mirror.hostname='assets.coingecko.com';
   upstream=await fetch(mirror.href,{redirect:'manual',headers:{Accept:'image/*','User-Agent':'Mozilla/5.0 (compatible; AVArtwork/1.0)'},signal:controller.signal});
  }
  if(!upstream.ok){controller.abort();return json({state:'artwork-unavailable',upstreamStatus:upstream.status},502,headers);}
  type=(upstream.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
  if(!ARTWORK_TYPES.has(type)){controller.abort();return json({state:'unsupported-artwork'},415,headers);}
  if(Number(upstream.headers.get('Content-Length'))>ARTWORK_LIMIT){controller.abort();return json({state:'artwork-too-large'},413,headers);}
  const reader=upstream.body?.getReader();if(!reader)return json({state:'artwork-unavailable'},502,headers);
  const chunks=[];let size=0;
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>ARTWORK_LIMIT){controller.abort();return json({state:'artwork-too-large'},413,headers);}
   chunks.push(value);
  }
  if(!size)return json({state:'artwork-unavailable'},502,headers);
  bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 }catch{return json({state:controller.signal.aborted?'artwork-timeout':'artwork-unavailable'},controller.signal.aborted?504:502,headers);}
 finally{clearTimeout(timeout);}
 const response=new Response(bytes,{headers:{'Content-Type':type,'Content-Length':String(bytes.byteLength),'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
 try{await cache.put(key,response.clone());}catch{}
 return respond(response);
}

// Public token metadata only; fixed upstream and bounded inputs prevent an open proxy.
async function holderCount(url,headers,env){
 const network=url.searchParams.get('network')||'',input=url.searchParams.get('address')||'';
 const address=/^0x[0-9a-fA-F]{40}$/.test(input)?input.toLowerCase():input;
 if(!/^[a-z0-9_-]{1,40}$/.test(network)||! /^[a-zA-Z0-9:_-]{1,256}$/.test(address))return json({state:'invalid-token'},400,headers);
 try{
  const object=env.HOLDER_CACHE.get(env.HOLDER_CACHE.idFromName('shared-free-budget-v1'));
  const requestURL=new URL('/holders',url.origin);requestURL.search=new URLSearchParams({network,address}).toString();
  const result=await object.fetch(new Request(requestURL));
  const response=new Response(result.body,result);for(const [k,v] of Object.entries(headers))response.headers.set(k,v);return response;
 }catch{return json({state:'unavailable'},503,headers);}
}

export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN;
  if(origin&&origin!==allowed&&!/^http:\/\/(localhost|127\.0\.0\.1):4173$/.test(origin))return json({state:'forbidden'},403);
  const headers={'Vary':'Origin','Access-Control-Allow-Origin':origin||allowed,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const url=new URL(request.url);
  if(url.pathname==='/coin-captures'||url.pathname==='/coin-captures/image'){
   if(!['GET','POST'].includes(request.method)||request.method==='POST'&&url.pathname!=='/coin-captures')return json({error:'Method not allowed'},405,headers);
   try{if(request.method==='POST')await authenticateCaptureRequest(request);const store=env.HOLDER_CACHE.get(env.HOLDER_CACHE.idFromName('shared-live-coin-captures-v1'));const result=await store.fetch(request);const response=new Response(result.body,result);for(const [key,value] of Object.entries(headers))response.headers.set(key,value);return response;}catch(error){return json({error:error.status?error.message:'Capture service unavailable'},error.status||503,headers);}
  }
  if(url.pathname==='/visual-history'||url.pathname==='/visual-history/image'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405,headers);
   try{const store=env.HOLDER_CACHE.get(env.HOLDER_CACHE.idFromName('shared-live-coin-captures-v1'));const result=await store.fetch(new Request(url));return new Response(result.body,{status:result.status,headers:{...Object.fromEntries(result.headers),...headers}});}catch{return json({error:'Visual archive unavailable'},503,headers);}
  }
  if(url.pathname.startsWith('/marketplace/'))return marketplace(request,env,headers);
  if(url.pathname==='/takes'||/^\/takes\/[A-Za-z0-9_-]{16}$/.test(url.pathname)){
   if(!['GET','POST'].includes(request.method))return json({state:'method-not-allowed'},405,headers);
   try{
    const store=env.TAKE_STORE.get(env.TAKE_STORE.idFromName('public-takes-v1'));
    const result=await store.fetch(request),response=new Response(result.body,result);
    for(const [key,value] of Object.entries(headers))response.headers.set(key,value);
    return response;
   }catch{return json({state:'sharing-unavailable'},503,headers);}
  }
  if(request.method!=='GET')return json({state:'method-not-allowed'},405,headers);
  if(url.pathname==='/native-holders'){try{const store=env.HOLDER_CACHE.get(env.HOLDER_CACHE.idFromName('shared-native-holders-v1'));const result=await store.fetch(new Request(url));return new Response(result.body,{status:result.status,headers:{...Object.fromEntries(result.headers),...headers}});}catch{return json({state:'unavailable',records:[],totalHolders:null},503,headers);}}
  if(url.pathname==='/holder-balances'){try{const store=env.HOLDER_CACHE.get(env.HOLDER_CACHE.idFromName('shared-holder-balances-v1'));const result=await store.fetch(new Request(url));const response=new Response(result.body,result);for(const [key,value] of Object.entries(headers))response.headers.set(key,value);return response;}catch{return json({state:'unavailable'},503,headers);}}
  if(url.pathname==='/coin-summary'){const identity=summaryIdentity(url);if(!identity)return json({state:'invalid-token'},400,headers);try{const store=env.HOLDER_CACHE.get(env.HOLDER_CACHE.idFromName('shared-coin-summary-v1'));const result=await store.fetch(new Request(url));return new Response(result.body,{status:result.status,headers:{'Content-Type':'application/json',...headers}});}catch{return json({state:'unavailable'},503,headers);}}
  if(url.pathname==='/history'){
   if(!historyRequest(url))return json({error:'Invalid history request'},400,headers);
   try{const store=env.HOLDER_CACHE.get(env.HOLDER_CACHE.idFromName('shared-chart-history-v1'));const result=await store.fetch(new Request(url));const out=new Response(result.body,result);for(const [key,value] of Object.entries(headers))out.headers.set(key,value);out.headers.set('Access-Control-Expose-Headers','X-UPIC-History-Cache, X-UPIC-Fetched-At, X-UPIC-History-Retention, Retry-After');return out;}
   catch{return json({error:'Shared history unavailable'},503,headers);}
  }
  if(url.pathname==='/artwork')return artwork(url,headers);
  if(url.pathname==='/holders')return holderCount(url,headers,env);
  if(url.pathname==='/health')return json({service:'UPIC holder snapshots',sharing:true,history:{shared:true,retentionDays:30,latestRefreshSeconds:30},coinCaptures:{...captureCapabilities,configured:Boolean(env.HOLDER_CACHE)},nativeHolders:{configured:Boolean(env.HOLDER_CACHE),networks:['bitcoin','ethereum','litecoin','dogecoin','zcash'],cacheSeconds:3600,dailyRequests:300,totalHolderCount:false},holderBalances:{configured:Boolean(env.HOLDER_CACHE)},configured:Boolean(env.INSIGHTX_API_KEY)},200,headers);
  const network=url.searchParams.get('network'),input=url.searchParams.get('address')||'';
  if(url.pathname!=='/clusters')return json({state:'not-found'},404,headers);
  if(!['sol','eth','base'].includes(network))return json({state:'unsupported-network'},422,headers);
  if(!(network==='sol'?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/:/^0x[0-9a-fA-F]{40}$/).test(input))return json({state:'invalid-address'},400,headers);
  if(!env.INSIGHTX_API_KEY)return json({state:'unconfigured'},503,headers);
  url.searchParams.set('address',network==='sol'?input:input.toLowerCase());
  try{
   const object=env.HOLDER_CACHE.get(env.HOLDER_CACHE.idFromName('shared-free-budget-v1'));
   const result=await object.fetch(new Request(url));
   const response=new Response(result.body,result);
   for(const [key,value] of Object.entries(headers))response.headers.set(key,value);
   return response;
  }catch{return json({state:'unavailable'},503,headers);}
 }
};

// One shared object owns both the cache and quota: concurrent visitors cannot
// each spend a separate allowance. API credentials never leave this Worker.
export class HolderCache extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);this.sql=ctx.storage.sql;this.inflight=new Map();this.history=new SharedHistoryCache(this.sql,env);this.summaries=new CoinSummary(this.sql,env);
  this.visualHistory=new VisualHistory(this.sql);this.captures=new CoinCaptures(ctx,this.visualHistory);this.balanceRelay=new HolderBalanceRelay(this.sql,env);this.nativeHolders=new NativeHolderRelay(this.sql,env);
  this.sql.exec('CREATE TABLE IF NOT EXISTS snapshots (key TEXT PRIMARY KEY, payload TEXT, fetched INTEGER, retry INTEGER)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS budget (day INTEGER PRIMARY KEY, used INTEGER)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS holder_counts (key TEXT PRIMARY KEY, payload TEXT, fetched INTEGER, retry INTEGER)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS holder_count_budget (day INTEGER PRIMARY KEY, used INTEGER, next INTEGER)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS holder_index_budget (day INTEGER PRIMARY KEY, used INTEGER, next INTEGER)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS cooldown (id INTEGER PRIMARY KEY, until_ms INTEGER)');
 }
 async fetch(request){
  if(['/visual-history','/visual-history/image'].includes(new URL(request.url).pathname))return this.visualHistory.fetch(new URL(request.url));
  if(['/coin-captures','/coin-captures/image'].includes(new URL(request.url).pathname))return this.captures.fetch(request);
  if(new URL(request.url).pathname==='/native-holders')return json(await this.nativeHolders.get(new URL(request.url)));
  if(new URL(request.url).pathname==='/holder-balances')return json(await this.balanceRelay.get(new URL(request.url)));
  if(new URL(request.url).pathname==='/coin-summary'){const identity=summaryIdentity(new URL(request.url));return identity?json(await this.summaries.get(identity)):json({state:'invalid-token'},400);}
  if(new URL(request.url).pathname==='/history')return this.history.fetch(new URL(request.url));
  const url=new URL(request.url),network=url.searchParams.get('network'),address=url.searchParams.get('address'),key=network+':'+address;
  if(url.pathname==='/holders'){
   const countKey='count:'+key;if(this.inflight.has(countKey))return json(await this.inflight.get(countKey));
   const pending=this.count(network,address);this.inflight.set(countKey,pending);
   try{return json(await pending);}finally{this.inflight.delete(countKey);}
  }
  if(this.inflight.has(key))return json(await this.inflight.get(key));
  const pending=this.load(key,network,address);this.inflight.set(key,pending);
  try{return json(await pending);}finally{this.inflight.delete(key);}
 }
 async count(network,address){
  const now=Date.now(),day=Math.floor(now/DAY),key=(network==='robinhood'&&this.env.BLOCKSCOUT_API_KEY?'blockscout-v1:':'')+network+':'+address;
  const cached=this.sql.exec('SELECT * FROM holder_counts WHERE key=?',key).toArray()[0];
  const saved=cached?.payload?JSON.parse(cached.payload):null;
  if(saved?.holders!=null&&now-cached.fetched<30*60000)return {...saved,cached:true};
  const fallback=(reason,retryAt)=>saved?.holders!=null&&now-cached.fetched<7*DAY?{...saved,state:'delayed',reason,retryAt}:{state:reason,holders:null,retryAt};
  if(cached?.retry>now)return fallback('unavailable',cached.retry);
  // Keep a healthy Robinhood index independent of unrelated free-provider cooldowns.
  // Its 2,000 calls/day at 20 credits/call stay below the free 100,000-credit daily allowance.
  const budgetTable=network==='robinhood'&&this.env.BLOCKSCOUT_API_KEY?'holder_index_budget':'holder_count_budget';
  const quota=this.ctx.storage.transactionSync(()=>{
   const budget=this.sql.exec(`SELECT * FROM ${budgetTable} WHERE day=?`,day).toArray()[0];
   if(budget?.next>now)return budget.next;
   if((budget?.used||0)>=2000)return (day+1)*DAY;
   this.sql.exec(`INSERT INTO ${budgetTable} VALUES (?,1,?) ON CONFLICT(day) DO UPDATE SET used=used+1,next=excluded.next`,day,now+4500);
   this.sql.exec(`DELETE FROM ${budgetTable} WHERE day<?`,day-2);
   this.sql.exec('DELETE FROM holder_counts WHERE fetched<? AND retry<?',now-7*DAY,now);
   return 0;
  });
  if(quota)return fallback('budget-wait',quota);
  const indexed=await fetchBlockscoutCount(network,address,this.env.BLOCKSCOUT_API_KEY);
  const goplusAccessToken=await goPlusAccessToken(this.env);
  const result=indexed||await fetchHolderCount(network,address,{goplusAccessToken});
  if(result.holders!==null){
   this.sql.exec('INSERT OR REPLACE INTO holder_counts VALUES (?,?,?,?)',key,JSON.stringify(result),now,now+30*60000);return result;
  }
  if(result.state==='rate-limited')this.sql.exec(`UPDATE ${budgetTable} SET next=MAX(next,?) WHERE day=?`,Date.now()+60000,day);
  const retry=now+(result.state==='rate-limited'?5*60000:30*60000);
  this.sql.exec('INSERT OR REPLACE INTO holder_counts VALUES (?,?,?,?)',key,cached?.payload||null,cached?.fetched||now,retry);
  return fallback(result.state,retry);
 }
 async load(key,network,address){
  const now=Date.now(),day=Math.floor(now/DAY);
  const cached=this.sql.exec('SELECT * FROM snapshots WHERE key=?',key).toArray()[0];
  const fallback=(reason,retryAt)=>cached?.payload&&now-cached.fetched<DAY?{...JSON.parse(cached.payload),state:'delayed',reason,retryAt}:{state:reason,clusters:[],retryAt};
  if(cached?.payload&&now-cached.fetched<TTL)return {...JSON.parse(cached.payload),cached:true};
  if(cached?.retry>now)return fallback('unavailable',cached.retry);
  const reserved=this.ctx.storage.transactionSync(()=>{
   const cooldown=this.sql.exec('SELECT until_ms FROM cooldown WHERE id=1').toArray()[0]?.until_ms||0;
   if(cooldown>now)return {retry:cooldown};
   const used=this.sql.exec('SELECT used FROM budget WHERE day=?',day).toArray()[0]?.used||0;
   // 28 per UTC day means at most 868 requests in any 31 calendar days.
   if(used>=28)return {retry:(day+1)*DAY};
   this.sql.exec('INSERT INTO budget(day,used) VALUES (?,1) ON CONFLICT(day) DO UPDATE SET used=used+1',day);
   this.sql.exec('INSERT OR REPLACE INTO cooldown VALUES (1,?)',now+16000);
   this.sql.exec('DELETE FROM budget WHERE day<?',day-35);
   this.sql.exec('DELETE FROM snapshots WHERE fetched<? AND retry<?',now-DAY,now);
   return {ok:true};
  });
  if(!reserved.ok)return fallback('budget-wait',reserved.retry);
  try{
   const response=await fetch('https://api.insightx.network/dex-metrics/v1/'+network+'/'+encodeURIComponent(address)+'/clusters',{headers:{'X-API-Key':this.env.INSIGHTX_API_KEY,'Accept':'application/json'},signal:AbortSignal.timeout(15000)});
   if(!response.ok){
    const delay=response.status===429?Math.max(HOUR,(Number(response.headers.get('Retry-After'))||0)*1000):response.status===401||response.status===403?DAY:HOUR;
    if([401,403,429].includes(response.status))this.sql.exec('INSERT OR REPLACE INTO cooldown VALUES (1,?)',now+delay);
    throw new Error('upstream-unavailable');
   }
   const body=await response.json(),data=body.data||body;
   if(!Array.isArray(data.clusters))throw new Error('invalid-response');
   const clusters=data.clusters.slice(0,100).map(cluster=>({percentage:pct(cluster.pct),tags:Array.isArray(cluster.tags)?cluster.tags.filter(x=>typeof x==='string').slice(0,8):[],wallets:(Array.isArray(cluster.cluster_addresses)?cluster.cluster_addresses:[]).slice(0,100).map(wallet=>({address:String(wallet.address||'').slice(0,64),percentage:pct(wallet.percentage)}))}));
   const payload={state:'snapshot',source:'InsightX cluster snapshot',network,address,fetchedAt:now,expiresAt:now+TTL,totalClusterPercentage:pct(data.total_cluster_pct),clusters};
   this.sql.exec('INSERT OR REPLACE INTO snapshots VALUES (?,?,?,?)',key,JSON.stringify(payload),now,now+TTL);
   return payload;
  }catch{
   this.sql.exec('INSERT OR REPLACE INTO snapshots VALUES (?,?,?,?)',key,cached?.payload||null,cached?.fetched||now,now+HOUR);
   return fallback('unavailable',now+HOUR);
  }
 }
}

// Separate storage from the InsightX budget. Scores are public by link and
// immutable; no audio files, API credentials or account data are stored here.
export class TakeStore extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);this.sql=ctx.storage.sql;
  this.sql.exec('CREATE TABLE IF NOT EXISTS takes (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created INTEGER NOT NULL)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS share_budget (day INTEGER PRIMARY KEY, used INTEGER NOT NULL)');
 }
 async fetch(request){
  const url=new URL(request.url),id=url.pathname.split('/')[2];
  if(request.method==='GET'&&/^[A-Za-z0-9_-]{16}$/.test(id||'')){
   const row=this.sql.exec('SELECT payload FROM takes WHERE id=?',id).toArray()[0];
   return row?new Response(row.payload,{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=300'}}):json({state:'take-not-found'},404);
  }
  if(request.method!=='POST'||url.pathname!=='/takes')return json({state:'not-found'},404);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({state:'invalid-format'},415);
  if(Number(request.headers.get('Content-Length'))>65536)return json({state:'score-too-large'},413);
  const reader=request.body?.getReader();if(!reader)return json({state:'empty-score'},400);
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();return json({state:'score-too-large'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let score;try{score=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({state:'invalid-score'},400);}
  if(score?.version!==1||!Array.isArray(score.rows)||!score.rows.length||score.rows.length>256||!score.market?.baseToken||!Number.isFinite(score.interval))return json({state:'invalid-score'},400);
  const payload=JSON.stringify(score),digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)));
  const key=btoa(String.fromCharCode(...digest.slice(0,12))).replace(/\+/g,'-').replace(/\//g,'_');
  const existing=this.sql.exec('SELECT id FROM takes WHERE id=?',key).toArray()[0];
  if(existing)return json({id:key},200);
  const day=Math.floor(Date.now()/DAY);
  const result=this.ctx.storage.transactionSync(()=>{
   const used=this.sql.exec('SELECT used FROM share_budget WHERE day=?',day).toArray()[0]?.used||0;
   const total=this.sql.exec('SELECT COUNT(*) AS count FROM takes').toArray()[0].count;
   if(used>=500||total>=10000)return false;
   this.sql.exec('INSERT INTO takes VALUES (?,?,?)',key,payload,Date.now());
   this.sql.exec('INSERT INTO share_budget VALUES (?,1) ON CONFLICT(day) DO UPDATE SET used=used+1',day);
   this.sql.exec('DELETE FROM share_budget WHERE day<?',day-2);return true;
  });
  return result?json({id:key},201):json({state:'share-capacity-reached'},429,{'Retry-After':'3600'});
 }
}
