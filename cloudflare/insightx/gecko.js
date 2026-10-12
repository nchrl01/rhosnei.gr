// One fixed public provider, one shared quota, and no browser CORS dependency.
// The dedicated Durable Object instance persists this budget across visitors.
const ORIGIN='https://api.geckoterminal.com',SPACING=6000,MAX_BODY=1024*1024;
const response=(body,status=200,headers={})=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const error=(state,status=400,headers={})=>({body:JSON.stringify({state}),status,headers});
const segment=value=>/^[A-Za-z0-9_.:-]{1,256}$/.test(value)&&!['.','..'].includes(value);
const network=value=>/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
const integer=(value,min,max)=>/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;

export function geckoTarget(request){
 if(request.method!=='GET')throw Error('method-not-allowed');
 const input=new URL(request.url),path=input.searchParams.get('path')||'';
 if(input.pathname!=='/gecko'||path.length>700||!path.startsWith('/')||/[?#%\\]/.test(path))throw Error('invalid-gecko-path');
 let kind,keys;
 if(path==='/networks/trending_pools'){kind='trending';keys=['include','duration','page'];}
 else if(path==='/search/pools'){kind='search';keys=['include','query','network','page'];}
 else{
  const parts=path.split('/');
  if(parts[1]!=='networks'||!network(parts[2])||!segment(parts[4]||''))throw Error('invalid-gecko-path');
  if(parts[3]==='tokens'&&parts.length===6&&['info','pools'].includes(parts[5])){
   kind=parts[5]==='info'?'token':'token-pools';keys=kind==='token'?[]:['include','page'];
  }else if(parts[3]==='pools'&&parts.length===5){kind='pool';keys=['include'];}
  else if(parts[3]==='pools'&&parts.length===6&&parts[5]==='trades'){kind='trades';keys=[];}
  else if(parts[3]==='pools'&&parts.length===7&&parts[5]==='ohlcv'&&['minute','hour','day'].includes(parts[6])){
   kind='history';keys=['aggregate','limit','currency','token','include_empty_intervals','before_timestamp'];
  }else throw Error('invalid-gecko-path');
 }
 const target=new URL('/api/v2'+path,ORIGIN),seen=new Set();
 for(const [key,value] of input.searchParams){
  if(seen.has(key))throw Error('duplicate-gecko-parameter');seen.add(key);
  if(key==='path')continue;
  if(!keys.includes(key))throw Error('invalid-gecko-parameter');
  let valid=false,canonical=value;
  if(key==='include'){
   const items=value.split(',');valid=items.length>0&&items.length<=4&&items.every(item=>['base_token','quote_token','dex','network'].includes(item));
   canonical=[...new Set(items)].sort().join(',');
  }else if(key==='duration')valid=['5m','1h','24h'].includes(value);
  else if(key==='page')valid=integer(value,1,10);
  else if(key==='query')valid=value.trim().length>0&&value.length<=250&&!/[\x00-\x1f\x7f]/.test(value);
  else if(key==='network')valid=network(value);
  else if(key==='aggregate'){
   const timeframe=path.split('/').at(-1);valid=(timeframe==='minute'?['1','5','15']:timeframe==='hour'?['1','4','12']:['1']).includes(value);
  }else if(key==='limit')valid=integer(value,1,1000);
  else if(key==='currency')valid=['usd','token'].includes(value);
  else if(key==='token')valid=segment(value);
  else if(key==='include_empty_intervals')valid=['true','false'].includes(value);
  else if(key==='before_timestamp')valid=integer(value,1,Math.floor(Date.now()/1000)+86400);
  if(!valid)throw Error('invalid-gecko-parameter');
  target.searchParams.set(key,canonical);
 }
 if(kind==='search'&&!target.searchParams.has('query'))throw Error('missing-gecko-query');
 target.searchParams.sort();
 const ttl=kind==='token'?21600000:kind==='history'&&target.searchParams.has('before_timestamp')?300000:kind==='pool'?30000:kind==='trades'?10000:60000;
 return {target,key:target.pathname+target.search,ttl};
}

export async function relayGecko(request,env,headers){
 try{geckoTarget(request);}catch{return response({state:'invalid-gecko-request'},400,headers);}
 try{
  const object=env.HOLDER_CACHE.get(env.HOLDER_CACHE.idFromName('global-gecko-provider'));
  const result=await object.fetch(request),reply=new Response(result.body,result);
  for(const [name,value] of Object.entries(headers))reply.headers.set(name,value);
  reply.headers.set('Access-Control-Expose-Headers','Retry-After, X-AV-Cache, X-AV-Fetched-At');
  return reply;
 }catch{return response({state:'gecko-unavailable'},503,headers);}
}

function retryAt(header,now,fallback=60000){
 const seconds=header&&Number(header),date=header&&Date.parse(header);
 return now+Math.max(SPACING,Number.isFinite(seconds)&&seconds!==null?seconds*1000:Number.isFinite(date)&&date!==null?date-now:fallback);
}

export class GeckoProvider {
 constructor(ctx){
  this.ctx=ctx;this.sql=ctx.storage.sql;this.inflight=new Map();
  this.sql.exec('CREATE TABLE IF NOT EXISTS gecko_cache (key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched INTEGER NOT NULL, expires INTEGER NOT NULL)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS gecko_budget (id INTEGER PRIMARY KEY, next_request INTEGER NOT NULL, cooldown INTEGER NOT NULL)');
 }
 async fetch(request){
  let route;try{route=geckoTarget(request);}catch{return response({state:'invalid-gecko-request'},400);}
  let pending=this.inflight.get(route.key);
  if(!pending){pending=this.load(route);this.inflight.set(route.key,pending);}
  try{const result=await pending;return response(result.body,result.status,result.headers);}
  catch{return response({state:'gecko-unavailable'},503);}
  finally{if(this.inflight.get(route.key)===pending)this.inflight.delete(route.key);}
 }
 async load({target,key,ttl}){
  const now=Date.now(),cached=this.sql.exec('SELECT payload,fetched,expires FROM gecko_cache WHERE key=?',key).toArray()[0];
  if(cached&&cached.expires>now)return {body:cached.payload,status:200,headers:{'X-AV-Cache':'hit','X-AV-Fetched-At':String(cached.fetched)}};
  const allowed=this.ctx.storage.transactionSync(()=>{
   const row=this.sql.exec('SELECT next_request,cooldown FROM gecko_budget WHERE id=1').toArray()[0];
   const next=Math.max(row?.next_request||0,row?.cooldown||0);
   if(next>now)return next;
   this.sql.exec('INSERT OR REPLACE INTO gecko_budget VALUES (1,?,?)',now+SPACING,row?.cooldown||0);
   this.sql.exec('DELETE FROM gecko_cache WHERE expires<=?',now);
   return 0;
  });
  if(allowed)return error('gecko-budget-wait',429,{'Retry-After':String(Math.max(1,Math.ceil((allowed-now)/1000)))});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  try{
   const upstream=await fetch(target.href,{method:'GET',redirect:'error',credentials:'omit',headers:{Accept:'application/json'},signal:controller.signal});
   if(!upstream.ok){
    const header=upstream.headers.get('Retry-After');let until=0;
    if(upstream.status===429||header||upstream.status===403)until=retryAt(header,Date.now());
    if(until)this.cooldown(until);
    await upstream.body?.cancel();
    const status=upstream.status===429?429:upstream.status===404?404:upstream.status===403?503:502;
    return error('gecko-provider-unavailable',status,until?{'Retry-After':String(Math.max(1,Math.ceil((until-Date.now())/1000)))}:{});
   }
   if(!upstream.headers.get('Content-Type')?.toLowerCase().includes('application/json'))throw Error('invalid-gecko-format');
   if(Number(upstream.headers.get('Content-Length'))>MAX_BODY)throw Error('gecko-response-too-large');
   const reader=upstream.body?.getReader();if(!reader)throw Error('empty-gecko-response');
   const chunks=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY)throw Error('gecko-response-too-large');chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const body=new TextDecoder().decode(bytes),data=JSON.parse(body);
   if(!data||typeof data!=='object'||!('data' in data))throw Error('invalid-gecko-data');
   const fetched=Date.now();
   this.ctx.storage.transactionSync(()=>{
    this.sql.exec('INSERT OR REPLACE INTO gecko_cache VALUES (?,?,?,?)',key,body,fetched,fetched+ttl);
    this.sql.exec('DELETE FROM gecko_cache WHERE key IN (SELECT key FROM gecko_cache ORDER BY fetched DESC LIMIT -1 OFFSET 128)');
   });
   return {body,status:200,headers:{'X-AV-Cache':'miss','X-AV-Fetched-At':String(fetched)}};
  }catch{
   this.cooldown(Date.now()+SPACING);
   return error(controller.signal.aborted?'gecko-timeout':'gecko-unavailable',controller.signal.aborted?504:502,{'Retry-After':'6'});
  }finally{clearTimeout(timeout);controller.abort();}
 }
 cooldown(until){
  this.sql.exec('INSERT INTO gecko_budget VALUES (1,0,?) ON CONFLICT(id) DO UPDATE SET cooldown=MAX(cooldown,excluded.cooldown)',until);
 }
}
