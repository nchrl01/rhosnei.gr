import {NATIVE_COINS} from '../../apps/web/public/native-coins.js';
const HOUR=3600000,DAY=24*HOUR,TTL=HOUR,MAX_AGE=6*HOUR;
const assets=new Map(Object.values(NATIVE_COINS).map(asset=>[asset.chain,asset]));
const empty=(network,state)=>({network,address:'native',state,records:[],totalHolders:null,complete:false,truncated:false,coverage:'top-holder-sample',native:true});
const positive=x=>x!==null&&x!==''&&Number.isFinite(Number(x))&&Number(x)>0?Number(x):null;
// A single shared object bounds total upstream traffic, independent of visitors.
export class NativeHolderRelay{
 constructor(sql,env){this.sql=sql;this.env=env;this.pending=new Map();this.queue=Promise.resolve();
  sql.exec('CREATE TABLE IF NOT EXISTS native_samples (network TEXT PRIMARY KEY,data TEXT NOT NULL,next_at INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS native_budget (day INTEGER PRIMARY KEY,calls INTEGER NOT NULL,cooldown INTEGER NOT NULL)');
 }
 async get(url){
  const network=url.searchParams.get('network'),asset=assets.get(network);if(!asset)return empty(network,'unsupported-network');
  const now=Date.now(),saved=this.sql.exec('SELECT data,next_at FROM native_samples WHERE network=?',network).toArray()[0],cached=saved?JSON.parse(saved.data):null;
  if(saved?.next_at>now&&cached?.schema===2)return cached?.records.length&&now-cached.fetchedAt<MAX_AGE?{...cached,cached:true}:cached?.records.length?{...empty(network,'expired'),nextAt:saved.next_at}:cached;
  if(this.pending.has(network))return this.pending.get(network);
  // Serial requests also avoid bursts on the free provider plans.
  const task=this.queue.then(()=>this.load(asset,cached)).finally(()=>this.pending.delete(network));this.queue=task.catch(()=>{});this.pending.set(network,task);return task;
 }
 async load(asset,cached){
  const network=asset.chain,now=Date.now(),day=Math.floor(now/DAY),base={...empty(network,'unavailable'),schema:2};
  const save=data=>{this.sql.exec('INSERT OR REPLACE INTO native_samples VALUES(?,?,?)',network,JSON.stringify(data),data.nextAt);return data;};
  const read=async target=>{
   const budget=this.sql.exec('SELECT * FROM native_budget WHERE day=?',day).toArray()[0];
   if((budget?.calls||0)>=300||budget?.cooldown>Date.now())throw Object.assign(Error('free-budget-wait'),{retryAt:budget?.cooldown>Date.now()?budget.cooldown:(day+1)*DAY});
   this.sql.exec('INSERT INTO native_budget VALUES(?,1,0) ON CONFLICT(day) DO UPDATE SET calls=calls+1',day);this.sql.exec('DELETE FROM native_budget WHERE day<?',day-1);
   const response=await fetch(target,{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(18000)});
   if(!response.ok){const limited=[401,402,403,429,430].includes(response.status),retryAt=Date.now()+(limited?HOUR:5*60000);if(limited)this.sql.exec('UPDATE native_budget SET cooldown=? WHERE day=?',retryAt,day);throw Object.assign(Error('provider-http-'+response.status),{retryAt});}
   const data=await response.json();await new Promise(resolve=>setTimeout(resolve,300));return data;
  };
  try{
   let records=[],supply=null,referencePrice=null,referenceMarketCap=null,sourceAt=null,source,scope='public-addresses';
   if(asset.provider==='sochain'){
    source='SoChain native balances';scope=network==='zcash'?'transparent-addresses-only':network==='litecoin'?'public-addresses-excludes-MWEB':'public-addresses';
    const body=await read('https://sochain.com/api/v3/rich_list/'+asset.symbol+'?page_size=100');
    if(body.status!=='success'||!Array.isArray(body.data?.rows))throw Error('invalid-native-sample');
    sourceAt=Number(body.data.time)*1000;
    const seen=new Set();for(const row of body.data.rows){const id=row.address,tokenBalance=positive(row.balance);if(typeof id!=='string'||!/^[A-Za-z0-9]{20,150}$/.test(id)||!tokenBalance||seen.has(id))continue;seen.add(id);records.push({id,tokenBalance});}
    // ZEC rich-list supply covers its transparent pool, never its full market cap.
    supply=network==='zcash'?null:positive(body.data.supply);
    if(network==='zcash')try{const chart=await read('https://sochain.com/api/v3/charts/ZEC/supply/hour?from='+Math.floor((now-2*HOUR)/1000));if(chart.status==='success'&&chart.data?.series==='supply'&&Array.isArray(chart.data.points)){const latest=chart.data.points.filter(p=>Number.isSafeInteger(p.t)&&p.t*1000<=now+1000&&now-p.t*1000<3*HOUR).sort((a,b)=>b.t-a.t)[0];supply=positive(latest?.v);}}catch{}
    try{const price=await read('https://sochain.com/api/v3/price/'+asset.symbol);if(price.status==='success'&&price.data?.currency==='USD')referencePrice=positive(price.data.value);}catch{}
    if(supply&&referencePrice)referenceMarketCap=supply*referencePrice;
   }else{
    source='Blockscout native balances';if(!this.env.BLOCKSCOUT_API_KEY)throw Error('missing-blockscout-configuration');
    const target=new URL('https://api.blockscout.com/1/api/v2/addresses');target.searchParams.set('apikey',this.env.BLOCKSCOUT_API_KEY);
    const body=await read(target);if(!Array.isArray(body.items))throw Error('invalid-native-sample');
    const seen=new Set();for(const row of body.items){const id=String(row.hash||'').toLowerCase(),raw=String(row.coin_balance||'');if(!/^0x[0-9a-f]{40}$/.test(id)||!/^\d{1,100}$/.test(raw)||seen.has(id))continue;const tokenBalance=Number(raw)/1e18;if(!Number.isFinite(tokenBalance)||tokenBalance<=0)continue;seen.add(id);records.push({id,tokenBalance,isContract:row.is_contract===true});}
    // Blockscout total_addresses includes zero balances, so it is NOT a holder count.
    supply=positive(body.total_supply);referencePrice=positive(body.exchange_rate);if(supply&&referencePrice)referenceMarketCap=supply*referencePrice;
   }
   if(!records.length)throw Error('empty-native-sample');
   if(sourceAt!==null&&(!Number.isSafeInteger(sourceAt)||sourceAt>now+300000||now-sourceAt>MAX_AGE))throw Error('native-index-delayed');
   return save({...base,state:'snapshot',source,scope,records,fetchedAt:Date.now(),sourceAt,supply,referencePrice,referenceMarketCap,marketCapEstimated:true,indexCadence:'provider-indexed',nextAt:Date.now()+TTL});
  }catch(error){const nextAt=Number(error.retryAt)||Date.now()+5*60000;return save(cached?.records.length&&Date.now()-cached.fetchedAt<MAX_AGE?{...cached,schema:2,state:'delayed',nextAt}:{...base,reason:String(error.message).replace(/[^a-z0-9-]/gi,'').slice(0,80),nextAt});}
 }
}
