import {DurableObject} from 'cloudflare:workers';

const HOUR=3600000,DAY=24*HOUR,TTL=6*HOUR;
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const number=value=>value!==null&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const pct=value=>number(value)===null?null:Math.max(0,Math.min(100,Number(value)));
const ARTWORK_HOSTS=new Set(['cdn.dexscreener.com','coin-images.coingecko.com','assets.coingecko.com']);
const ARTWORK_TYPES=new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif']);
const ARTWORK_LIMIT=2*1024*1024;

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
  const upstream=await fetch(target.href,{method:'GET',redirect:'error',credentials:'omit',headers:{Accept:'image/avif,image/webp,image/png,image/jpeg,image/gif'},signal:controller.signal});
  if(!upstream.ok){controller.abort();return json({state:'artwork-unavailable'},502,headers);}
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

export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN;
  if(origin&&origin!==allowed&&!/^http:\/\/(localhost|127\.0\.0\.1):4173$/.test(origin))return json({state:'forbidden'},403);
  const headers={'Vary':'Origin','Access-Control-Allow-Origin':origin||allowed,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const url=new URL(request.url);
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
  if(url.pathname==='/artwork')return artwork(url,headers);
  if(url.pathname==='/health')return json({service:'UPIC holder snapshots',sharing:true,configured:Boolean(env.INSIGHTX_API_KEY)},200,headers);
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
  super(ctx,env);this.sql=ctx.storage.sql;this.inflight=new Map();
  this.sql.exec('CREATE TABLE IF NOT EXISTS snapshots (key TEXT PRIMARY KEY, payload TEXT, fetched INTEGER, retry INTEGER)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS budget (day INTEGER PRIMARY KEY, used INTEGER)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS cooldown (id INTEGER PRIMARY KEY, until_ms INTEGER)');
 }
 async fetch(request){
  const url=new URL(request.url),network=url.searchParams.get('network'),address=url.searchParams.get('address'),key=network+':'+address;
  if(this.inflight.has(key))return json(await this.inflight.get(key));
  const pending=this.load(key,network,address);this.inflight.set(key,pending);
  try{return json(await pending);}finally{this.inflight.delete(key);}
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
