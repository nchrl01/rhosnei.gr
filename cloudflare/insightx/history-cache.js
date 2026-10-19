// Shared, quota-bounded GeckoTerminal history. No user credentials or arbitrary URLs.
const DAY=86400000,RETENTION=30*DAY,MAX_BYTES=64*1024*1024,MAX_PAGES=1000;
const response=(body,status=200,headers={})=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
export function historyRequest(url){
 const p=url.searchParams,network=p.get('network')||'',pool=p.get('pool')||'',token=p.get('token')||'',frame=p.get('timeframe')||'minute',aggregate=Number(p.get('aggregate')||1),limit=Number(p.get('limit')||1000),before=p.has('before_timestamp')?Number(p.get('before_timestamp')):null;
 // Identifiers include Move type tags, TON and native pool IDs. Each is encoded
 // into a fixed provider URL; punctuation cannot add query fields or hosts.
 const validID=v=>typeof v==='string'&&v.length<=256&&/^[A-Za-z0-9][A-Za-z0-9:_.\/-]*$/.test(v)&&!v.includes('..');
 const allowed={minute:[1,5,15],hour:[1,4,12],day:[1]};
 if(!/^[a-z0-9_-]{1,40}$/.test(network)||!validID(pool)||!validID(token)||!allowed[frame]?.includes(aggregate)||!Number.isInteger(limit)||limit<1||limit>1000||(before!==null&&(!Number.isInteger(before)||before<1||before>Math.floor(Date.now()/1000)+60)))return null;
 const normalize=v=>/^0x[0-9a-fA-F]{40,64}$/.test(v)?v.toLowerCase():v,interval=({minute:60,hour:3600,day:86400}[frame])*aggregate;
 return {network,pool:normalize(pool),token:normalize(token),frame,aggregate,limit,before,interval,key:JSON.stringify([network,normalize(pool),normalize(token),frame,aggregate,before??'latest'])};
}
export class SharedHistoryCache{
 constructor(sql,env){this.sql=sql;this.env=env;this.pending=new Map();
  sql.exec('CREATE TABLE IF NOT EXISTS chart_pages (key TEXT PRIMARY KEY,payload TEXT NOT NULL,fetched INTEGER NOT NULL,expires INTEGER NOT NULL,bytes INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS chart_budget (day INTEGER PRIMARY KEY,used INTEGER NOT NULL,next INTEGER NOT NULL,blocked INTEGER NOT NULL)');
 }
 async fetch(url){
  const spec=historyRequest(url);if(!spec)return response({error:'Invalid history request'},400);
  let task=this.pending.get(spec.key);
  if(!task){task=this.read(spec);this.pending.set(spec.key,task);task.finally(()=>{if(this.pending.get(spec.key)===task)this.pending.delete(spec.key);}).catch(()=>{});}
  const result=await task;if(result.status!==200)return response(result.body,result.status,{'Retry-After':String(result.retry||30)});
  const body=JSON.parse(result.payload),list=body.data?.attributes?.ohlcv_list;
  // Fetch/cache a canonical 1,000-row page once; callers can request a smaller tail.
  if(Array.isArray(list)&&list.length>spec.limit)body.data.attributes.ohlcv_list=list.slice(0,spec.limit);
  return response(body,200,{'X-UPIC-History-Cache':result.cache,'X-UPIC-Fetched-At':String(result.fetched),'X-UPIC-History-Retention':'2592000',...(result.retry?{'Retry-After':String(result.retry)}:{})});
 }
 async read(spec){
  const now=Date.now(),saved=this.sql.exec('SELECT payload,fetched,expires FROM chart_pages WHERE key=?',spec.key).toArray()[0];
  if(saved?.expires>now)return {...saved,status:200,cache:'hit'};
  // Refresh expiry is not deletion: a dated saved page is still useful while
  // the upstream provider is unavailable. Never label it as newly fetched.
  const unavailable=result=>saved&&saved.fetched>now-RETENTION?{...saved,status:200,cache:'stale',retry:result.retry||60}:result;
  const day=Math.floor(now/DAY),budget=this.sql.exec('SELECT * FROM chart_budget WHERE day=?',day).toArray()[0]||{used:0,next:0,blocked:0};
  const dailyLimit=Math.max(1,Math.min(10000,Number(this.env.HISTORY_REQUESTS_PER_DAY)||10000));
  const wait=Math.max(0,budget.next-now,budget.blocked-now);
  if(budget.blocked>now)return unavailable({status:429,body:{code:'PROVIDER_HISTORY_COOLDOWN',error:'History provider cooldown'},retry:Math.ceil((budget.blocked-now)/1000)});
  if(budget.used>=dailyLimit||wait>24000)return unavailable({status:429,body:{code:'SHARED_HISTORY_QUOTA',error:'Shared history quota is cooling down; saved history remains available.'},retry:budget.used>=dailyLimit?Math.ceil(((day+1)*DAY-now)/1000):Math.ceil(wait/1000)});
  this.sql.exec('INSERT OR REPLACE INTO chart_budget(day,used,next,blocked) VALUES(?,?,?,?)',day,budget.used+1,now+wait+6000,budget.blocked);
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  const cooldown=this.sql.exec('SELECT blocked FROM chart_budget WHERE day=?',day).toArray()[0]?.blocked||0;if(cooldown>Date.now())return unavailable({status:429,body:{code:'PROVIDER_HISTORY_COOLDOWN',error:'History provider cooldown'},retry:Math.ceil((cooldown-Date.now())/1000)});
  const upstream=new URL('https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(spec.network)+'/pools/'+encodeURIComponent(spec.pool)+'/ohlcv/'+spec.frame);
  upstream.search=new URLSearchParams({aggregate:String(spec.aggregate),limit:'1000',currency:'usd',token:spec.token,include_empty_intervals:'false'}).toString();if(spec.before!==null)upstream.searchParams.set('before_timestamp',String(spec.before));
  try{
   const r=await fetch(upstream,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
   if(!r.ok){if(r.status===429){const retry=Math.min(3600000,Math.max(60000,(Number(r.headers.get('Retry-After'))||60)*1000));this.sql.exec('UPDATE chart_budget SET blocked=MAX(blocked,?) WHERE day=?',Date.now()+retry,day);}
    return unavailable({status:r.status===429?429:502,body:{code:r.status===429?'PROVIDER_HISTORY_COOLDOWN':'HISTORY_PROVIDER_UNAVAILABLE',error:'History provider temporarily unavailable'},retry:r.status===429?Math.ceil(((this.sql.exec('SELECT blocked FROM chart_budget WHERE day=?',day).toArray()[0]?.blocked||Date.now()+60000)-Date.now())/1000):60});}
   if(Number(r.headers.get('Content-Length'))>1024*1024)return {status:502,body:{error:'History response too large'}};
   const payload=await r.text();if(payload.length>1024*1024)return {status:502,body:{error:'History response too large'}};
   const body=JSON.parse(payload),rows=body.data?.attributes?.ohlcv_list;
   if(!Array.isArray(rows)||rows.length>1000||rows.some(row=>!Array.isArray(row)||row.length!==6||!row.every(Number.isFinite)||row[0]<=0||row[1]<=0||row[3]<=0||row[4]<=0||row[2]<Math.max(row[1],row[4])||row[3]>Math.min(row[1],row[4])||row[5]<0))return {status:502,body:{error:'Invalid history response'}};
   const fetched=Date.now(),historical=spec.before!==null&&spec.before<Math.floor(fetched/1000)-2*spec.interval,ttl=historical?RETENTION:30000;
   // Do not freeze an empty page for a month: provider indexing can catch up.
   this.sql.exec('INSERT OR REPLACE INTO chart_pages(key,payload,fetched,expires,bytes) VALUES(?,?,?,?,?)',spec.key,payload,fetched,fetched+(rows.length?ttl:30000),payload.length*2);
   this.sql.exec('DELETE FROM chart_pages WHERE fetched<=? AND key<>?',fetched-RETENTION,spec.key);
   const meta=this.sql.exec('SELECT key,bytes FROM chart_pages ORDER BY fetched DESC').toArray();let total=0;
   for(let i=0;i<meta.length;i++){total+=meta[i].bytes;if(i>=MAX_PAGES||total>MAX_BYTES)this.sql.exec('DELETE FROM chart_pages WHERE key=?',meta[i].key);}
   this.sql.exec('DELETE FROM chart_budget WHERE day<?',day-2);
   return {status:200,payload,fetched,cache:'miss'};
  }catch{return unavailable({status:503,body:{error:'Shared history temporarily unavailable'},retry:30});}
 }
}
