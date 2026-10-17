import {CHAINS,chainFor,type ChainId,type MarketFrame,type Trade,type Candle} from '@upic/domain';
import type {Env} from './env';
export type Charge=(tier:'dex'|'basic'|'premium'|'rpc',count?:number)=>Promise<void>;
export async function dexSnapshots(chain:ChainId,tokens:string[],charge:Charge):Promise<MarketFrame[]>{
 if(tokens.length>30)throw Error('batch-too-large');await charge('dex');
 const r=await fetch('https://api.dexscreener.com/tokens/v1/'+chain+'/'+tokens.map(encodeURIComponent).join(','),{signal:AbortSignal.timeout(4000)});
 if(!r.ok)throw Error('dex-unavailable');const pairs=await r.json() as Record<string,any>[];
 return tokens.map(token=>{
  const matches=(a:string,b:string)=>chainFor(chain).kind==='evm'?a.toLowerCase()===b.toLowerCase():a===b;
  const eligible=pairs.filter(p=>p.chainId===chain&&matches(String(p.baseToken?.address),token)&&p.priceUsd);
  const pair=eligible.sort((a,b)=>Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0))[0];
  return {chain,token,at:Date.now(),priceUsd:pair?String(pair.priceUsd):null,marketCapUsd:pair?.marketCap==null?null:String(pair.marketCap),liquidityUsd:pair?.liquidity?.usd==null?null:String(pair.liquidity.usd),volumeUsd:pair?.volume?.m5==null?null:String(pair.volume.m5),source:'dexscreener',stale:!pair,simulated:false};
 });
}
export interface Discovery {chain:ChainId;token:string;name:string;symbol:string;frame:MarketFrame}
export async function discover(query:string,charge:Charge):Promise<Discovery[]>{
 await charge('dex');const r=await fetch('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(query),{signal:AbortSignal.timeout(4000)});
 if(!r.ok)throw Error('discovery-unavailable');const body=await r.json() as {pairs?:Record<string,any>[]};const seen=new Set<string>();
 return (body.pairs||[]).flatMap(p=>{
  if(!CHAINS.some(c=>c.id===p.chainId)||!p.baseToken?.address||!p.priceUsd)return [];
  const key=p.chainId+':'+p.baseToken.address;if(seen.has(key))return [];seen.add(key);
  return [{chain:p.chainId as ChainId,token:String(p.baseToken.address),name:String(p.baseToken.name||'Token'),symbol:String(p.baseToken.symbol||''),frame:{chain:p.chainId as ChainId,token:String(p.baseToken.address),at:Date.now(),priceUsd:String(p.priceUsd),marketCapUsd:p.marketCap==null?null:String(p.marketCap),liquidityUsd:p.liquidity?.usd==null?null:String(p.liquidity.usd),volumeUsd:p.volume?.m5==null?null:String(p.volume.m5),source:'dexscreener-cached-preview',stale:false,simulated:false}}];
 }).slice(0,20);
}
async function okx(env:Env,path:string,charge:Charge,tier:'basic'|'premium'='basic'):Promise<any[]>{
 if(!env.OKX_API_KEY||!env.OKX_SECRET||!env.OKX_PASSPHRASE)throw Error('okx-unconfigured');
 await charge(tier);const stamp=new Date().toISOString();const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.OKX_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(stamp+'GET'+path)));
 const signature=btoa(String.fromCharCode(...bytes));
 const r=await fetch('https://web3.okx.com'+path,{headers:{'OK-ACCESS-KEY':env.OKX_API_KEY,'OK-ACCESS-SIGN':signature,'OK-ACCESS-PASSPHRASE':env.OKX_PASSPHRASE,'OK-ACCESS-TIMESTAMP':stamp},signal:AbortSignal.timeout(4000)});
 if(!r.ok)throw Error(r.status===402?'free-quota-exhausted':'okx-unavailable');
 const body=await r.json() as {code:string;data:any[]};if(body.code!=='0'||!Array.isArray(body.data))throw Error('okx-response-invalid');return body.data;
}
export async function recentTrades(env:Env,chain:ChainId,token:string,charge:Charge,after?:string):Promise<Trade[]>{
 const q=new URLSearchParams({chainIndex:chainFor(chain).okx,tokenContractAddress:token,limit:'500'});if(after)q.set('after',after);
 const data=await okx(env,'/api/v6/dex/market/trades?'+q,charge);
 return data.filter(t=>t.isFiltered!=='1'&&t.id&&Number(t.price)>0).map(t=>({id:String(t.id),at:Number(t.time),priceUsd:String(t.price),volumeUsd:String(t.volume),side:t.type==='sell'?'sell':'buy',tx:String(t.txHashUrl||'')}));
}
export async function candles(env:Env,chain:ChainId,token:string,charge:Charge):Promise<Candle[]>{
 const q=new URLSearchParams({chainIndex:chainFor(chain).okx,tokenContractAddress:token,bar:'1m',limit:'299'});
 return (await okx(env,'/api/v6/dex/market/candles?'+q,charge)).map(r=>({time:Number(r[0]),open:String(r[1]),high:String(r[2]),low:String(r[3]),close:String(r[4]),volume:String(r[6]),complete:r[7]==='1'})).sort((a,b)=>a.time-b.time);
}
