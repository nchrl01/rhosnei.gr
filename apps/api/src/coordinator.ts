import {DurableObject} from 'cloudflare:workers';
import {type MarketFrame,type Trade,type Candle,type Collection,type ChainId,type Hex,stageFor,units,decimal} from '@upic/domain';
import {DB} from './db';
import type {Env} from './env';
import {dexSnapshots,recentTrades,candles,discover,type Discovery,type Charge} from './providers';
import {processVerification,processAttestation,processPublish,indexChain} from './services';
interface Asset {asset_key:Hex;chain:ChainId;token:string;latest:MarketFrame|null;evidence?:{priceUsd18:string;capUsd8:string}}
interface Attachment {key:string;playing:boolean}
interface Counters {month:string;day:string;minute:number;basic:number;premium:number;rpc:number;dex:number}
export class MarketCoordinator extends DurableObject<Env>{
 private counters:Counters={month:'',day:'',minute:0,basic:0,premium:0,rpc:0,dex:0};
 private assets:Asset[]=[];private frames=new Map<string,MarketFrame>();private seen=new Map<string,Set<string>>();
 private activeUntil=new Map<string,number>();private bars=new Map<string,Candle[]>();private checkpoint=0;private polling=false;private servicing=false;
 private tasks=new Set<string>();
 private rates=new Map<string,{minute:number;count:number}>();
 private searches=new Map<string,{at:number;rows:Discovery[]}>();
 private searching=new Map<string,Promise<Discovery[]>>();
 private searchAllowance={minute:0,count:0};
 constructor(ctx:DurableObjectState,env:Env){super(ctx,env);ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));ctx.blockConcurrencyWhile(async()=>{this.counters=await ctx.storage.get<Counters>('budget')||this.counters;});}
 charge:Charge=async(tier,count=1)=>{
  const now=new Date(),month=now.toISOString().slice(0,7),day=now.toISOString().slice(0,10),minute=Math.floor(now.getTime()/60000);
  if(this.counters.month!==month){this.counters.month=month;this.counters.basic=0;this.counters.premium=0;}
  if(this.counters.day!==day){this.counters.day=day;this.counters.rpc=0;}
  if(this.counters.minute!==minute){this.counters.minute=minute;this.counters.dex=0;}
  const limit=tier==='dex'?Number(this.env.DEX_RPM||180):tier==='rpc'?10000:Number(tier==='basic'?this.env.OKX_BASIC_LIMIT||90000:this.env.OKX_PREMIUM_LIMIT||90000);
  if(this.counters[tier]+count>limit)throw Error('budget-exhausted-'+tier);this.counters[tier]+=count;
  // Paid-tier allowances are reserved before network I/O. DEX's minute counter
  // is checkpointed per alarm, avoiding a database write for every free request.
  if(tier!=='dex')await this.ctx.storage.put('budget',this.counters);
 };
 private active(){const keys=new Set<string>();for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment() as Attachment|null;if(a?.playing)keys.add(a.key);}for(const[k,until]of this.activeUntil)if(until>Date.now())keys.add(k);else this.activeUntil.delete(k);return keys;}
 async fetch(request:Request){
  const u=new URL(request.url);
  if(u.pathname==='/discover'){
   const query=(u.searchParams.get('q')||'').trim();if(query.length<2||query.length>80)return Response.json({error:'invalid-search'},{status:400});
   const cached=this.searches.get(query);if(cached&&Date.now()-cached.at<300000)return Response.json(cached.rows);
   let pending=this.searching.get(query);if(!pending){
    const minute=Math.floor(Date.now()/60000);if(this.searchAllowance.minute!==minute)this.searchAllowance={minute,count:0};
    if(this.searchAllowance.count>=60)return Response.json({error:'discovery-capacity'},{status:429});this.searchAllowance.count++;
    pending=discover(query,this.charge).then(rows=>{this.searches.set(query,{at:Date.now(),rows});if(this.searches.size>200)this.searches.delete(this.searches.keys().next().value!);return rows;}).finally(()=>this.searching.delete(query));this.searching.set(query,pending);
   }
   return Response.json(await pending);
  }
  if(u.pathname==='/faucet-claim'){
   // One drip per wallet per 24h, serialized by this Durable Object.
   const {wallet}=await request.json() as {wallet:string};const key='faucet:'+wallet.toLowerCase(),last=await this.ctx.storage.get<number>(key)||0;
   if(Date.now()-last<86400000)return Response.json({ok:false,retryAt:last+86400000},{status:429});
   await this.ctx.storage.put(key,Date.now());return Response.json({ok:true});
  }
  if(u.pathname==='/faucet-release'){const {wallet}=await request.json() as {wallet:string};await this.ctx.storage.delete('faucet:'+wallet.toLowerCase());return Response.json({ok:true});}
  if(u.pathname==='/rate'){
   const {key}=await request.json() as {key:string};const minute=Math.floor(Date.now()/60000),rate=this.rates.get(key);
   const next=rate?.minute===minute?{minute,count:rate.count+1}:{minute,count:1};this.rates.set(key,next);
   if(this.rates.size>2000)this.rates.delete(this.rates.keys().next().value!);
   return Response.json({ok:next.count<=60},{status:next.count<=60?200:429});
  }
  if(u.pathname.startsWith('/service/')){
   const kind=u.pathname.slice(9);if(this.tasks.has(kind))return Response.json({state:'busy'});this.tasks.add(kind);
   const task=kind==='index'?indexChain(this.env,this.ctx.storage,this.charge):kind==='verify'?processVerification(this.env,count=>this.charge('rpc',count)):kind==='attest'?processAttestation(this.env):kind==='publish'?processPublish(this.env):Promise.reject(Error('unknown-service'));
   this.ctx.waitUntil(task.catch(async()=>{await this.ctx.storage.put('service-error:'+kind,{at:Date.now(),state:'service-delayed'});}).finally(()=>this.tasks.delete(kind)));
   return Response.json({state:'scheduled'});
  }
  if(u.pathname==='/storage/reserve'){
   const {bytes,files}=await request.json() as {bytes:number;files:number};
   if(!Number.isSafeInteger(bytes)||bytes<0||!Number.isSafeInteger(files)||files<1)throw Error('invalid-storage-reservation');
   const usage=await this.ctx.storage.get<{bytes:number;files:number}>('archive-usage')||{bytes:0,files:0};
   if(usage.bytes+bytes>900000000||usage.files+files>450)throw Error('archive-budget-exhausted');
   usage.bytes+=bytes;usage.files+=files;await this.ctx.storage.put('archive-usage',usage);return Response.json(usage);
  }
  if(u.pathname==='/status')return Response.json({budget:this.counters,tracked:this.assets.length,active:this.active().size,archiveUsage:await this.ctx.storage.get('archive-usage'),indexCursor:await this.ctx.storage.get('index-cursor'),reorganization:await this.ctx.storage.get('index-reorganization'),serviceErrors:await this.ctx.storage.list({prefix:'service-error:'}).then(v=>Object.fromEntries(v)),checkpointAt:this.checkpoint||null});
  if(u.pathname==='/charge'){const {tier,count}=await request.json() as {tier:Parameters<Charge>[0];count:number};await this.charge(tier,count);return Response.json({ok:true});}
  if(u.pathname==='/history'){
   const key=u.searchParams.get('key')||'',asset=(await new DB(this.env).list<Asset>('upic_assets',{asset_key:'eq.'+key}))[0];
   if(!asset||!await new DB(this.env).one('upic_collections',{asset_key:'eq.'+key})) return new Response('minted-collection-required',{status:403});
   const cached=await this.ctx.storage.get<{at:number;bars:Candle[]}>('history:'+key);
   if(cached&&Date.now()-cached.at<300000)return Response.json(cached.bars);
   const values=await candles(this.env,asset.chain,asset.token,this.charge);await this.ctx.storage.put('history:'+key,{at:Date.now(),bars:values});return Response.json(values);
  }
  if(u.pathname==='/stream'){
   const key=u.searchParams.get('key')||'';const collection=await new DB(this.env).one<Collection>('upic_collections',{asset_key:'eq.'+key});
   if(!collection)return new Response('minted-collection-required',{status:403});
   if(this.ctx.getWebSockets().length>=500)return new Response('viewer-capacity',{status:429});
   const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);pair[1].serializeAttachment({key,playing:false});
   const frame=this.frames.get(key);if(frame)pair[1].send(JSON.stringify({type:'frame',frame}));
   await this.ctx.storage.setAlarm(Date.now()+5000);return new Response(null,{status:101,webSocket:pair[0]});
  }
  if(u.pathname==='/tick'){
   await this.ctx.storage.setAlarm(Date.now()+5000);
   if(!this.servicing){this.servicing=true;this.ctx.waitUntil(this.services().finally(()=>{this.servicing=false;}));}
   return Response.json({ok:true});
  }
  return new Response('not-found',{status:404});
 }
 async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){
  if(typeof message!=='string'||message.length>128)return ws.close(1008,'invalid-message');
  let data:{type:string};try{data=JSON.parse(message);}catch{return ws.close(1008,'invalid-message');}
  const a=ws.deserializeAttachment() as Attachment;
  if(data.type==='play'){
   if(!this.active().has(a.key)&&this.active().size>=10){ws.send(JSON.stringify({type:'status',state:'playback-capacity'}));return;}
   a.playing=true;
  }else if(data.type==='pause'){a.playing=false;this.activeUntil.set(a.key,Date.now()+30000);}else return;
  ws.serializeAttachment(a);
 }
 async webSocketClose(ws:WebSocket){const a=ws.deserializeAttachment() as Attachment|null;if(a?.playing)this.activeUntil.set(a.key,Date.now()+30000);ws.close();}
 async alarm(){
  await this.ctx.storage.setAlarm(Date.now()+5000);
  if(this.polling)return;this.polling=true;
  try{
   const db=new DB(this.env),active=this.active();
   if(Date.now()-this.checkpoint>60000){
    const collections=await db.list<Collection>('upic_collections');const keys=new Set(collections.filter(c=>c.stage<8||active.has(c.asset_key)).map(c=>c.asset_key));
    this.assets=(await db.list<Asset>('upic_assets',{enabled:'eq.true',limit:String(this.env.MAX_ASSETS||100)})).filter(a=>keys.has(a.asset_key));
    await this.ctx.storage.put('budget',this.counters);
    const frames=this.assets.flatMap(a=>{const frame=this.frames.get(a.asset_key);return frame?[{key:a.asset_key,frame}]:[];});
    // API cap and the last verified supply provide hints, never minting evidence.
    const jobs=collections.flatMap(c=>{
     const f=this.frames.get(c.asset_key),a=this.assets.find(a=>a.asset_key===c.asset_key);
     const cap=Number(f?.marketCapUsd),price=Number(f?.priceUsd);
     const inferred=a?.evidence&&Number(a.evidence.priceUsd18)>0?price*1e18*Number(a.evidence.capUsd8)/1e8/Number(a.evidence.priceUsd18):0;
     const hint=Math.max(Number.isFinite(cap)?cap:0,Number.isFinite(inferred)?inferred:0);
     return c.stage<8&&hint>0&&stageFor(BigInt(Math.floor(hint*1e8)))>c.stage?[{kind:'verify',key:'verify:'+c.asset_key+':'+Math.floor(Date.now()/120000),payload:{assetKey:c.asset_key}}]:[];
    });
    const savedBars=[...this.bars].flatMap(([key,bars])=>bars.filter(b=>b.complete&&b.time>Date.now()-120000).map(bar=>({key,time:bar.time,bar})));
    await db.rpc('upic_checkpoint',{p_frames:frames,p_jobs:jobs,p_candles:savedBars});
    this.checkpoint=Date.now();
   }
   const groups=new Map<ChainId,Asset[]>();for(const a of this.assets)groups.set(a.chain,[...(groups.get(a.chain)||[]),a]);
   for(const[chain,assets]of groups)for(let offset=0;offset<assets.length;offset+=30){const batch=assets.slice(offset,offset+30);try{
    const frames=await dexSnapshots(chain,batch.map(a=>a.token),this.charge);for(let i=0;i<batch.length;i++){const a=batch[i]!,f=frames[i]!;this.frames.set(a.asset_key,f);this.broadcast(a.asset_key,{type:'frame',frame:f});}
   }catch{for(const a of batch)this.broadcast(a.asset_key,{type:'status',state:'snapshot-delayed'});}}
   for(const key of active){const a=this.assets.find(a=>a.asset_key===key);if(a)await this.playback(a);}
  }finally{this.polling=false;}
 }
 private broadcast(key:string,data:unknown){const payload=JSON.stringify(data);for(const ws of this.ctx.getWebSockets()){if((ws.deserializeAttachment() as Attachment)?.key===key){try{ws.send(payload);}catch{}}}}
 private async playback(a:Asset){
  try{
   const seen=this.seen.get(a.asset_key)||new Set<string>();let rows=await recentTrades(this.env,a.chain,a.token,this.charge),gap=false;
   if(seen.size&&rows.length===500&&!rows.some(t=>seen.has(t.id))){const older=await recentTrades(this.env,a.chain,a.token,this.charge,rows.at(-1)?.id);gap=!older.some(t=>seen.has(t.id));rows=[...rows,...older];}
   const fresh=rows.filter(t=>!seen.has(t.id)).sort((a,b)=>a.at-b.at);
   for(const t of rows)seen.add(t.id);while(seen.size>2000)seen.delete(seen.values().next().value!);this.seen.set(a.asset_key,seen);
   const bars=this.bars.get(a.asset_key)||[];for(const t of fresh)this.addTrade(bars,t);this.bars.set(a.asset_key,bars.slice(-1440));
   this.broadcast(a.asset_key,{type:'trades',trades:fresh,candles:bars.slice(-2),incomplete:gap});
  }catch(error){this.broadcast(a.asset_key,{type:'status',state:error instanceof Error?error.message:'playback-delayed'});}
 }
 private addTrade(bars:Candle[],trade:Trade){
  const time=Math.floor(trade.at/60000)*60000;let bar=bars.find(b=>b.time===time);
  if(!bar){bar={time,open:trade.priceUsd,high:trade.priceUsd,low:trade.priceUsd,close:trade.priceUsd,volume:'0',complete:false};bars.push(bar);bars.sort((a,b)=>a.time-b.time);}
  const price=units(trade.priceUsd,18);if(price>units(bar.high,18))bar.high=trade.priceUsd;if(price<units(bar.low,18))bar.low=trade.priceUsd;bar.close=trade.priceUsd;bar.volume=decimal(units(bar.volume,18)+units(trade.volumeUsd,18),18);for(const b of bars)b.complete=b.time<time;
 }
 private async services(){
  const self=this.env.MARKET.get(this.ctx.id);
  await Promise.all(['index','verify','attest','publish'].map(kind=>self.fetch('https://internal/service/'+kind)));
  const db=new DB(this.env);
  await db.rpc('upic_retention',{});
 }
}
