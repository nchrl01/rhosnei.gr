import {captureIdentity} from './coin-captures.js';
const TTL=15*60000,MAX_AGE=60*60000,DAILY_CALLS=1000;
const ALIASES={eth:'ethereum',polygon_pos:'polygon'};
// Use the existing private index integration when Robinhood's public explorer rejects reads.
const CHAINS={robinhood:4663};
const ADDRESS=/^0x[0-9a-f]{40}$/i;
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
  if(!identity||!CHAINS[network]||!ADDRESS.test(input||''))return {state:'unsupported-network',records:[],totalHolders:null};
  const address=input.toLowerCase(),key=identity.key,now=Date.now();
  const saved=this.sql.exec('SELECT data,next_at FROM shared_holder_samples WHERE key=?',key).toArray()[0];
  const cached=saved?JSON.parse(saved.data):null;
  if(saved?.next_at>now){return cached?.fetchedAt&&now-cached.fetchedAt>=MAX_AGE?{state:'expired',records:[],totalHolders:null,nextAt:saved.next_at}:cached;}
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
  const base={network,address,source:'Blockscout shared index',records:[],totalHolders:null,complete:false,truncated:false,coverage:'top-holder-sample'};
  const save=data=>{this.sql.exec('INSERT OR REPLACE INTO shared_holder_samples(key,data,next_at) VALUES(?,?,?)',key,JSON.stringify(data),data.nextAt);return data;};
  const failed=(state,nextAt)=>save(cached?.records?.length&&Date.now()-cached.fetchedAt<MAX_AGE?{...cached,state:'delayed',nextAt}:{...base,state,nextAt});
  if(!this.env.BLOCKSCOUT_API_KEY)return failed('unavailable',now+5*60000);
  try{
   const read=async suffix=>{
    const requestedAt=Date.now();
    if(!this.reserveCalls(requestedAt)){
     const error=Error('Indexed holder budget exhausted');error.rateLimited=true;
     error.nextAt=Date.parse(new Date(requestedAt).toISOString().slice(0,10))+86400000;throw error;
    }
    const target=new URL('https://api.blockscout.com/'+CHAINS[network]+'/api/v2/tokens/'+address+suffix);target.searchParams.set('apikey',this.env.BLOCKSCOUT_API_KEY);
    const response=await fetch(target,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!response.ok){const error=Error('Indexed holders unavailable');error.rateLimited=response.status===429;throw error;}return response.json();
   };
   const token=await read('');
   const decimals=token.decimals==null?NaN:Number(token.decimals);
   if(token.address_hash?.toLowerCase()!==address||token.type!=='ERC-20'||!Number.isInteger(decimals)||decimals<0||decimals>80)throw Error('Invalid indexed token');
   const data=await read('/holders');if(!Array.isArray(data.items))throw Error('Invalid indexed holders');
   const records=new Map();let invalid=0;
   for(const item of data.items.slice(0,100)){
    const id=item.address?.hash,amount=units(item.value,decimals);
    if(!ADDRESS.test(id||'')){invalid++;continue;}
    if(amount===null){if(!/^0+$/.test(String(item.value)))invalid++;continue;}
    records.set(id.toLowerCase(),{id:id.toLowerCase(),tokenBalance:amount,balanceRaw:String(item.value),decimals,isContract:item.address.is_contract===true});
   }
   if(!records.size)throw Error('No indexed balances');
   const count=token.holders_count==null||token.holders_count===''?NaN:Number(token.holders_count);
   return save({...base,state:'snapshot',records:[...records.values()],decimals,totalHolders:Number.isSafeInteger(count)&&count>=0?count:null,fetchedAt:Date.now(),nextAt:Date.now()+TTL,complete:data.next_page_params==null&&data.items.length<=100&&invalid===0,invalid});
  }catch(error){return failed(error.rateLimited?'rate-limited':'unavailable',error.nextAt||Date.now()+(error.rateLimited?5:2)*60000);}
 }
}
