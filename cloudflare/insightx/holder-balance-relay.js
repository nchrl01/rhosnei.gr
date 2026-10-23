import {xdcTokenSample} from './token-rpc-sample.js';
import {captureIdentity} from './coin-captures.js';
const TTL=15*60000,MAX_AGE=60*60000,DAILY_CALLS=1000;
const ALIASES={eth:'ethereum',polygon_pos:'polygon'};
// Use the existing private index integration when Robinhood's public explorer rejects reads.
const CHAINS={robinhood:4663};
const ADDRESS=/^0x[0-9a-f]{40}$/i;
const failure=reason=>Object.assign(Error('Indexed holder request failed'),{reason});
function units(raw,decimals){
 const value=String(raw??'');if(!/^\d{1,100}$/.test(value)||!Number.isInteger(decimals)||decimals<0||decimals>80)return null;
 const padded=value.padStart(decimals+1,'0'),amount=Number(decimals?padded.slice(0,-decimals)+'.'+padded.slice(-decimals):padded);
 return Number.isFinite(amount)&&amount>0?amount:null;
}
export class HolderBalanceRelay{
 constructor(sql,env){
  this.sql=sql;this.env=env;this.pending=new Map();
  sql.exec('CREATE TABLE IF NOT EXISTS shared_holder_samples (key TEXT PRIMARY KEY, data TEXT NOT NULL, next_at INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS shared_holder_sample_budget (day TEXT PRIMARY KEY, calls INTEGER NOT NULL)');
 }
 async get(url){
  const network=ALIASES[url.searchParams.get('network')]||url.searchParams.get('network'),input=url.searchParams.get('address');
  const identity=captureIdentity(network,input);
  if(!identity||(!CHAINS[network]&&network!=='xdc')||!ADDRESS.test(input||''))return {state:'unsupported-network',records:[],totalHolders:null};
  const address=input.toLowerCase(),key=identity.key,now=Date.now();
  const saved=this.sql.exec('SELECT data,next_at FROM shared_holder_samples WHERE key=?',key).toArray()[0];
  const cached=saved?JSON.parse(saved.data):null;
  if(saved?.next_at>now&&!(network==='xdc'&&cached?.adapterVersion!==2)){return cached?.fetchedAt&&now-cached.fetchedAt>=MAX_AGE?{state:'expired',records:[],totalHolders:null,nextAt:saved.next_at}:cached;}
  if(this.pending.has(key))return this.pending.get(key);
  const task=this.load({network,address,key,cached,now}).finally(()=>this.pending.delete(key));this.pending.set(key,task);return task;
 }
 reserveCalls(now){
  const day=new Date(now).toISOString().slice(0,10);
  this.sql.exec('DELETE FROM shared_holder_sample_budget WHERE day<?',day);
  const used=this.sql.exec('SELECT calls FROM shared_holder_sample_budget WHERE day=?',day).toArray()[0]?.calls||0;
  if(used>=DAILY_CALLS)return false;
  this.sql.exec('INSERT INTO shared_holder_sample_budget(day,calls) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET calls=calls+1',day);return true;
 }
 async load({network,address,key,cached,now}){
  const base={network,address,adapterVersion:2,source:network==='xdc'?'XDC public RPC · observed token balances':'Blockscout shared index',records:[],totalHolders:null,complete:false,truncated:false,coverage:network==='xdc'?'recent-transfer-participants':'top-holder-sample'};
  const save=data=>{this.sql.exec('INSERT OR REPLACE INTO shared_holder_samples(key,data,next_at) VALUES(?,?,?)',key,JSON.stringify(data),data.nextAt);return data;};
  let checks={};
  const failed=(state,nextAt,reason)=>save(cached?.records?.length&&Date.now()-cached.fetchedAt<MAX_AGE?{...cached,state:'delayed',nextAt,reason,checks}:{...base,state,nextAt,reason,checks});
  if(network==='xdc'){
   try{return save({...await xdcTokenSample(address,{reserve:()=>this.reserveCalls(Date.now())}),adapterVersion:2,nextAt:Date.now()+TTL});}
   catch(error){checks.rpcError=String(error?.message||'').replace(/[\r\n]/g,' ').slice(0,120);return failed('unavailable',Date.now()+2*60000,/^(rpc-[a-z0-9-]+|daily-budget-exhausted)$/.test(error.reason||'')?error.reason:'rpc-provider-unavailable');}
  }
  if(!this.env.BLOCKSCOUT_API_KEY)return failed('unavailable',now+5*60000,'missing-configuration');
  try{
   const read=async suffix=>{
    const stage=suffix?'balances':'metadata';
    const requestedAt=Date.now();
    if(!this.reserveCalls(requestedAt)){
     const error=failure('daily-budget-exhausted');error.rateLimited=true;
     error.nextAt=Date.parse(new Date(requestedAt).toISOString().slice(0,10))+86400000;throw error;
    }
    const target=new URL('https://api.blockscout.com/'+CHAINS[network]+'/api/v2/tokens/'+address+suffix);target.searchParams.set('apikey',this.env.BLOCKSCOUT_API_KEY);
    let response;
    try{response=await fetch(target,{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(12000)});}
    catch(error){checks.fetchError=['AbortError','TimeoutError','TypeError'].includes(error?.name)?error.name:'other';throw failure(stage+'-fetch-failed');}
    if(response.status>=300&&response.status<400){
     checks.redirectSameHost=false;
     try{const location=response.headers.get('Location');if(location)checks.redirectSameHost=new URL(location,target).hostname===target.hostname;}catch{}
    }
    if(!response.ok){const error=failure(stage+'-http-'+response.status);error.rateLimited=response.status===429;throw error;}
    try{return await response.json();}catch{throw failure(stage+'-invalid-json');}
   };
   const token=await read('');
   const decimals=token?.decimals==null?NaN:Number(token.decimals);
   checks={metadataObject:Boolean(token&&typeof token==='object'&&!Array.isArray(token)),tokenAddressPresent:typeof token?.address_hash==='string',tokenAddressMatches:typeof token?.address_hash==='string'&&token.address_hash.toLowerCase()===address,tokenTypeERC20:token?.type==='ERC-20',tokenDecimalsValid:Number.isInteger(decimals)&&decimals>=0&&decimals<=80};
   if(!checks.tokenAddressMatches||!checks.tokenTypeERC20||!checks.tokenDecimalsValid)throw failure('invalid-token');
   const data=await read('/holders');checks.balancesItemsArray=Array.isArray(data?.items);
   if(!checks.balancesItemsArray)throw failure('invalid-balances-response');
   checks.examinedItems=Math.min(data.items.length,100);checks.invalidAddresses=0;checks.invalidAmounts=0;checks.zeroBalances=0;
   const records=new Map();let invalid=0;
   for(const item of data.items.slice(0,100)){
    const id=item?.address?.hash,amount=units(item?.value,decimals);
    if(!ADDRESS.test(id||'')){invalid++;checks.invalidAddresses++;continue;}
    if(amount===null){if(!/^0+$/.test(String(item?.value))){invalid++;checks.invalidAmounts++;}else checks.zeroBalances++;continue;}
    records.set(id.toLowerCase(),{id:id.toLowerCase(),tokenBalance:amount,balanceRaw:String(item.value),decimals,isContract:item.address.is_contract===true});
   }
   if(!records.size)throw failure('no-balances');
   const count=token.holders_count==null||token.holders_count===''?NaN:Number(token.holders_count);
   return save({...base,state:'snapshot',records:[...records.values()],decimals,totalHolders:Number.isSafeInteger(count)&&count>=0?count:null,fetchedAt:Date.now(),nextAt:Date.now()+TTL,complete:data.next_page_params==null&&data.items.length<=100&&invalid===0,invalid});
  }catch(error){
   const reason=/^(?:(?:metadata|balances)-(?:http-[1-5]\d{2}|fetch-failed|invalid-json)|daily-budget-exhausted|invalid-token|invalid-balances-response|no-balances)$/.test(error.reason||'')?error.reason:'invalid-provider-response';
   return failed(error.rateLimited?'rate-limited':'unavailable',error.nextAt||Date.now()+(error.rateLimited?5:2)*60000,reason);
  }
 }
}
