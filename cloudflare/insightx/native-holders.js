import {loadCoinLoreNative} from './native-market-meta.js';
import {NATIVE_COINS} from '../../apps/web/public/native-coins.js';
import {loadSolanaNative,loadXrpNative,loadHederaNative,loadAlgorandNative} from './native-provider-sol-xrp.js';
import {fetchExtraNativeBalances} from './native-provider-extra.js';
import {fetchEvmExtraNativeBalances} from './native-provider-evm-extra.js';
import {loadCardanoNative,loadCosmosNative,loadKaspaNative,loadTonNative} from './native-provider-next.js';
import {loadCosmosExtraNative} from './native-provider-cosmos-extra.js';
import {loadNearNative,loadAptosNative} from './native-provider-major-next.js';
import {loadStellarNative,loadStacksNative} from './native-provider-xlm-stx.js';
import {fetchFinalEvmNativeBalances,FINAL_EVM_NATIVE_ASSETS} from './native-provider-evm-final.js';
import {loadSuiNative} from './native-provider-sui.js';
const HOUR=3600000,DAY=24*HOUR,TTL=HOUR,MAX_AGE=6*HOUR,SCHEMA=3;
const assets=new Map(Object.values(NATIVE_COINS).map(asset=>[asset.chain,asset]));
const empty=(network,state)=>({network,address:'native',state,records:[],totalHolders:null,complete:false,truncated:false,coverage:'top-holder-sample',native:true});
const positive=x=>x!==null&&x!==''&&Number.isFinite(Number(x))&&Number(x)>0?Number(x):null;
export const nativeLimits={cacheSeconds:TTL/1000,maxCacheSeconds:7200,maxAgeSeconds:MAX_AGE/1000,dailyRequests:3000,providerDailyRequests:{sochain:300,blockscout:400,bitcore:300,'bnb-alchemy':180,trongrid:160,coingecko:48,coinlore:48,...Object.fromEntries(FINAL_EVM_NATIVE_ASSETS.map(asset=>[asset.provider,90])),default:120}};
const providerKey=asset=>asset.provider==='blockscout'?'blockscout':asset.provider;
const safeCache=(cached,now)=>Array.isArray(cached?.records)&&cached.records.length&&Number.isSafeInteger(cached.fetchedAt)&&cached.fetchedAt<=now+1000&&now-cached.fetchedAt<MAX_AGE&&['sourceAt','indexerAt','indexTipAt'].every(key=>cached[key]==null||(Number.isSafeInteger(cached[key])&&cached[key]<=now+300000&&now-cached[key]<MAX_AGE));
const retryAt=(response,now)=>{const value=response.headers.get('Retry-After');if(!value)return now+HOUR;const seconds=Number(value),date=Date.parse(value);return Math.max(now+HOUR,Number.isFinite(seconds)?now+seconds*1000:Number.isFinite(date)?date:now+HOUR);};
// One Cloudflare object shares samples and quotas across all visitors. Provider
// queues are separate: a slow or throttled provider cannot stall other chains.
export class NativeHolderRelay{
 constructor(sql,env){this.sql=sql;this.env=env;this.pending=new Map();this.queues=new Map();
  sql.exec('CREATE TABLE IF NOT EXISTS native_provider_cooldown (provider TEXT PRIMARY KEY,until_ms INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS native_provider_pacing (provider TEXT PRIMARY KEY,next_at INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS native_market_meta (id INTEGER PRIMARY KEY,data TEXT NOT NULL,next_at INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS native_samples (network TEXT PRIMARY KEY,data TEXT NOT NULL,next_at INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS native_provider_budget (day INTEGER NOT NULL,provider TEXT NOT NULL,calls INTEGER NOT NULL,cooldown INTEGER NOT NULL,PRIMARY KEY(day,provider))');
 }
 async get(url){
  const network=url.searchParams.get('network'),asset=assets.get(network);if(!asset)return empty(network,'unsupported-network');
  const now=Date.now(),saved=this.sql.exec('SELECT data,next_at FROM native_samples WHERE network=?',network).toArray()[0];let cached=null;
  try{cached=saved?JSON.parse(saved.data):null;}catch{}
  // Schema upgrades do not force extra requests for still-valid old samples.
  if(saved?.next_at>now&&cached){
   if(safeCache(cached,now)){const meta=(await this.marketMetadata())[asset.id];return {...cached,...(this.freshMarket(meta)?meta:{}),cached:true};}
   if(cached.records?.length)return {...empty(network,'expired'),nextAt:saved.next_at};
   // An independent provider can replace a failed feed. The old provider's
   // durable cooldown is preserved and still enforced by read().
   if(cached.provider===providerKey(asset))return cached;
  }
  if(this.pending.has(network))return this.pending.get(network);
  const provider=providerKey(asset),task=(this.queues.get(provider)||Promise.resolve()).then(()=>this.load(asset,cached)).finally(()=>this.pending.delete(network));
  this.queues.set(provider,task.catch(()=>{}));this.pending.set(network,task);return task;
 }
 async load(asset,cached){
  const network=asset.chain,now=Date.now(),provider=providerKey(asset),base={...empty(network,'unavailable'),schema:SCHEMA,provider};
  const cacheMs=Math.max(TTL,Math.min(nativeLimits.maxCacheSeconds*1000,Number(asset.cacheSeconds)*1000||TTL));
  const save=data=>{this.sql.exec('INSERT OR REPLACE INTO native_samples VALUES(?,?,?)',network,JSON.stringify(data),data.nextAt);return data;};
  const read=(target,options)=>this.read(provider,target,options);
  try{
   let result;
   if(asset.provider==='sochain')result=await this.sochain(asset,read,now);
   else if(asset.provider==='blockscout')result=await this.blockscout(asset,read);
   else if(asset.symbol==='SOL')result=await loadSolanaNative(read,now);
   else if(asset.symbol==='XRP')result=await loadXrpNative(read,now);
   else if(asset.symbol==='HBAR')result=await loadHederaNative(read,now);
   else if(asset.symbol==='ALGO')result=await loadAlgorandNative(read,now);
   else if(asset.symbol==='ADA')result=await loadCardanoNative(read,now);
   else if(asset.symbol==='ATOM')result=await loadCosmosNative(read,now);
   else if(asset.symbol==='KAS')result=await loadKaspaNative(read,now);
   else if(asset.symbol==='GRAM')result=await loadTonNative(read,now);
   else if(asset.symbol==='NEAR')result=await loadNearNative(read,now);
   else if(asset.symbol==='APT')result=await loadAptosNative(read,now);
   else if(asset.symbol==='SUI')result=await loadSuiNative(read,now);
   else if(asset.symbol==='XLM')result=await loadStellarNative(read,now);
   else if(asset.symbol==='STX')result=await loadStacksNative(read,now);
   else if(asset.provider==='cosmos-directory')result=await loadCosmosExtraNative(asset,read);
   else if(FINAL_EVM_NATIVE_ASSETS.some(row=>row.provider===asset.provider))result=await fetchFinalEvmNativeBalances(asset,read,now);
   else if(['BNB','TRX','FLR','KCS','ETN','STRAX','XPL'].includes(asset.symbol))result=await fetchEvmExtraNativeBalances(asset,read,now);
   else result=await fetchExtraNativeBalances(asset,read,now);
   const seen=new Set(),records=[];
   for(const row of result.records||[]){if(typeof row.id!=='string'||!row.id.length||row.id.length>150||!Number.isFinite(row.tokenBalance)||row.tokenBalance<=0||seen.has(row.id))continue;seen.add(row.id);records.push(row);if(records.length===100)break;}
   if(!records.length)throw Error('empty-native-sample');
   const sourceAt=result.sourceAt??null;
   if(sourceAt!==null&&(!Number.isSafeInteger(sourceAt)||sourceAt>now+300000||now-sourceAt>MAX_AGE))throw Error('native-index-delayed');
   // One public batch supplies all native market caps; it never creates balances.
   const meta=(await this.marketMetadata())[asset.id];
   if(this.freshMarket(meta))result={...result,...meta};
   // No sample size, explorer account total, or list page count is a holder count.
   return save({...base,...result,records,network,address:'native',totalHolders:null,complete:false,state:'snapshot',fetchedAt:Date.now(),sourceAt,marketCapEstimated:true,indexCadence:result.indexCadence||'provider-indexed',cacheSeconds:cacheMs/1000,nextAt:Date.now()+cacheMs});
  }catch(error){const nextAt=Number(error.retryAt)||Date.now()+(/^empty-/.test(String(error.message))?cacheMs:5*60000);return save(safeCache(cached,Date.now())?{...cached,schema:SCHEMA,state:'delayed',nextAt}:{...base,reason:String(error.message).replace(/[^a-z0-9-]/gi,'').slice(0,80),nextAt});}
 }
 async read(provider,target,options={}){
   if(['chainz','routescan','trongrid','toncenter','cosmos-directory'].includes(provider)){const next=this.sql.exec('SELECT next_at FROM native_provider_pacing WHERE provider=?',provider).toArray()[0]?.next_at||0;const wait=Math.max(0,next-Date.now());this.sql.exec('INSERT OR REPLACE INTO native_provider_pacing VALUES(?,?)',provider,Date.now()+wait+(provider==='chainz'?10100:provider==='routescan'?600:1100));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));}
   const at=Date.now(),day=Math.floor(at/DAY),limit=nativeLimits.providerDailyRequests[provider]||nativeLimits.providerDailyRequests.default;
   const budget=this.sql.exec('SELECT * FROM native_provider_budget WHERE day=? AND provider=?',day,provider).toArray()[0];
   const cooldown=Math.max(budget?.cooldown||0,this.sql.exec('SELECT until_ms FROM native_provider_cooldown WHERE provider=?',provider).toArray()[0]?.until_ms||0);
   const total=this.sql.exec('SELECT COALESCE(SUM(calls),0) AS calls FROM native_provider_budget WHERE day=?',day).toArray()[0]?.calls||0;
   if(total>=nativeLimits.dailyRequests||(budget?.calls||0)>=limit||cooldown>at)throw Object.assign(Error('free-budget-wait'),{retryAt:cooldown>at?cooldown:(day+1)*DAY});
   this.sql.exec('INSERT INTO native_provider_budget VALUES(?,?,1,0) ON CONFLICT(day,provider) DO UPDATE SET calls=calls+1',day,provider);
   this.sql.exec('DELETE FROM native_provider_budget WHERE day<?',day-1);
   const response=await fetch(target,{...options,headers:{Accept:'application/json',...(options.headers||{})},redirect:'manual',signal:AbortSignal.timeout(18000)});
   if(!response.ok){const limited=[401,402,403,429,430].includes(response.status),next=limited?retryAt(response,Date.now()):Date.now()+5*60000;
    if(limited)this.cooldown(provider,next);
    await response.body?.cancel();throw Object.assign(Error('provider-http-'+response.status),{retryAt:next});}
   const data=await response.json(),rpcError=data?.error||data?.result?.error;
   const errorText=[rpcError?.message||rpcError,...(Array.isArray(data?.errors)?data.errors.map(error=>String(error?.message||'')+' '+String(error?.extensions?.code||'')):[])].filter(Boolean).join(' ');
   if([429,-32005].includes(Number(rpcError?.code||data?.result?.error_code))||/rate.?limit|usage.?limit|daily.?limit|quota|too many requests|slow.?down|unauthorized|forbidden|access denied/i.test(errorText)){const next=/daily|for the day/i.test(errorText)?(Math.floor(Date.now()/DAY)+1)*DAY:Date.now()+HOUR;this.cooldown(provider,next);throw Object.assign(Error('provider-rpc-rate-limit'),{retryAt:next});}
   await new Promise(resolve=>setTimeout(resolve,FINAL_EVM_NATIVE_ASSETS.some(asset=>asset.provider===provider)?500:300));return data;
 }
 cooldown(provider,until){this.sql.exec('INSERT INTO native_provider_cooldown VALUES(?,?) ON CONFLICT(provider) DO UPDATE SET until_ms=MAX(until_ms,excluded.until_ms)',provider,until);}
 async coingeckoMetadata(){
  if(this.marketPending)return this.marketPending;
  const now=Date.now(),saved=this.sql.exec('SELECT data,next_at FROM native_market_meta WHERE id=1').toArray()[0];let cached={};try{cached=JSON.parse(saved?.data||'{}');}catch{}
  if(saved?.next_at>now)return cached;
  this.marketPending=(async()=>{
   let data=cached,nextAt=now+TTL;
   try{
    const target=new URL('https://api.coingecko.com/api/v3/simple/price');target.search=new URLSearchParams({ids:[...new Set(Object.values(NATIVE_COINS).map(a=>a.id))].join(','),vs_currencies:'usd',include_market_cap:'true',include_last_updated_at:'true'});
    const body=await this.read('coingecko',target);data={};
    for(const asset of Object.values(NATIVE_COINS)){const row=body[asset.id],at=Number(row?.last_updated_at)*1000;if(positive(row?.usd)&&positive(row?.usd_market_cap)&&Number.isSafeInteger(at)&&at<=Date.now()+300000&&Date.now()-at<MAX_AGE)data[asset.id]={referencePrice:Number(row.usd),referenceMarketCap:Number(row.usd_market_cap),marketAt:at,marketSource:'CoinGecko',supply:Number(row.usd_market_cap)/Number(row.usd),supplyBasis:'circulating-estimate'};}
   }catch(error){nextAt=Math.max(now+TTL,Number(error.retryAt)||0);}
   this.sql.exec('INSERT OR REPLACE INTO native_market_meta VALUES(1,?,?)',JSON.stringify(data),nextAt);return data;
  })().finally(()=>{this.marketPending=null;});return this.marketPending;
 }
 freshMarket(meta){const at=meta?.marketAt??meta?.marketFetchedAt;return Number.isSafeInteger(at)&&at<=Date.now()+300000&&Date.now()-at<MAX_AGE;}
 async marketMetadata(){
  const primary=await this.coingeckoMetadata();
  if(Object.values(NATIVE_COINS).every(asset=>this.freshMarket(primary[asset.id])))return primary;
  const secondary=await this.coinloreMetadata(),combined={...secondary};
  for(const [id,meta] of Object.entries(primary))if(this.freshMarket(meta))combined[id]=meta;
  return combined;
 }
 async coinloreMetadata(){
  if(this.coinlorePending)return this.coinlorePending;
  const now=Date.now(),saved=this.sql.exec('SELECT data,next_at FROM native_market_meta WHERE id=2').toArray()[0];let cached={};try{cached=JSON.parse(saved?.data||'{}');}catch{}
  if(saved?.next_at>now)return cached;
  this.coinlorePending=(async()=>{
   let data=cached,nextAt=now+TTL;
   try{data=await loadCoinLoreNative((url,options)=>this.read('coinlore',url,options),Object.values(NATIVE_COINS),now);}catch(error){nextAt=Math.max(now+TTL,Number(error.retryAt)||0);}
   this.sql.exec('INSERT OR REPLACE INTO native_market_meta VALUES(2,?,?)',JSON.stringify(data),nextAt);return data;
  })().finally(()=>{this.coinlorePending=null;});return this.coinlorePending;
 }
 async sochain(asset,read,now){
  const network=asset.chain,source='SoChain native balances',scope=network==='zcash'?'transparent-addresses-only':network==='litecoin'?'public-addresses-excludes-MWEB':'public-addresses';
  const body=await read('https://sochain.com/api/v3/rich_list/'+asset.symbol+'?page_size=100');
  if(body.status!=='success'||!Array.isArray(body.data?.rows))throw Error('invalid-native-sample');
  const records=body.data.rows.filter(row=>typeof row.address==='string'&&/^[A-Za-z0-9]{20,150}$/.test(row.address)&&positive(row.balance)).map(row=>({id:row.address,tokenBalance:Number(row.balance)}));
  const sourceAt=Number(body.data.time)*1000;
  // ZEC rich-list supply covers its transparent pool, never its full market cap.
  let supply=network==='zcash'?null:positive(body.data.supply),referencePrice=null;
  if(network==='zcash')try{const chart=await read('https://sochain.com/api/v3/charts/ZEC/supply/hour?from='+Math.floor((now-2*HOUR)/1000));if(chart.status==='success'&&chart.data?.series==='supply'&&Array.isArray(chart.data.points)){const latest=chart.data.points.filter(p=>Number.isSafeInteger(p.t)&&p.t*1000<=now+1000&&now-p.t*1000<3*HOUR).sort((a,b)=>b.t-a.t)[0];supply=positive(latest?.v);}}catch{}
  try{const price=await read('https://sochain.com/api/v3/price/'+asset.symbol);if(price.status==='success'&&price.data?.currency==='USD')referencePrice=positive(price.data.value);}catch{}
  return {records,source,scope,sourceAt,supply,referencePrice,referenceMarketCap:supply&&referencePrice?supply*referencePrice:null};
 }
 async blockscout(asset,read){
  if(!this.env.BLOCKSCOUT_API_KEY)throw Error('missing-blockscout-configuration');
  const target=new URL('https://api.blockscout.com/'+asset.chainId+'/api/v2/addresses');target.searchParams.set('apikey',this.env.BLOCKSCOUT_API_KEY);
  const body=await read(target);if(!Array.isArray(body.items))throw Error('invalid-native-sample');
  const records=[];for(const row of body.items){const id=String(row.hash||'').toLowerCase(),raw=String(row.coin_balance||'');if(!/^0x[0-9a-f]{40}$/.test(id)||!/^\d{1,100}$/.test(raw))continue;const tokenBalance=Number(raw)/1e18;if(Number.isFinite(tokenBalance)&&tokenBalance>0)records.push({id,tokenBalance,isContract:row.is_contract===true});}
  const supply=positive(body.total_supply),referencePrice=positive(body.exchange_rate);
  return {records,source:'Blockscout native balances',scope:asset.scope||'public-addresses',supply,referencePrice,referenceMarketCap:supply&&referencePrice?supply*referencePrice:null,sourceAt:null};
 }
}
