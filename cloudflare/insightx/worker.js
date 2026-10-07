import {DurableObject} from 'cloudflare:workers';

const HOUR=3600000,DAY=24*HOUR,TTL=6*HOUR;
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const number=value=>value!==null&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const pct=value=>number(value)===null?null:Math.max(0,Math.min(100,Number(value)));

export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN;
  if(origin&&origin!==allowed&&!/^http:\/\/(localhost|127\.0\.0\.1):4173$/.test(origin))return json({state:'forbidden'},403);
  const headers={'Vary':'Origin','Access-Control-Allow-Origin':origin||allowed,'Access-Control-Allow-Methods':'GET, OPTIONS'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET')return json({state:'method-not-allowed'},405,headers);
  const url=new URL(request.url);
  if(url.pathname==='/health')return json({service:'UPIC holder snapshots',configured:Boolean(env.INSIGHTX_API_KEY)},200,headers);
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
