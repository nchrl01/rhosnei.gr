import {encodeFunctionData,decodeFunctionResult,parseAbi,keccak256,type Address,type Hex} from 'viem';
import {USD_SCALE,type Evidence,type RpcWitness,chainFor} from '@upic/domain';
import type {Env} from './env';
const abi=parseAbi([
 'function token0() view returns(address)','function token1() view returns(address)','function factory() view returns(address)',
 'function getPair(address,address) view returns(address)','function getPool(address,address,uint24) view returns(address)','function fee() view returns(uint24)',
 'function getReserves() view returns(uint112,uint112,uint32)','function price0CumulativeLast() view returns(uint256)','function price1CumulativeLast() view returns(uint256)',
 'function decimals() view returns(uint8)','function totalSupply() view returns(uint256)','function balanceOf(address) view returns(uint256)',
 'function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)',
 'function observe(uint32[] secondsAgos) view returns(int56[],uint160[])','function liquidity() view returns(uint128)',
 'function slot0() view returns(uint160,int24,uint16,uint16,uint16,uint8,bool)',
 'function tickSpacing() view returns(int24)','function tickBitmap(int16) view returns(uint256)',
 'function ticks(int24) view returns(uint128,int128,uint256,uint256,int56,uint160,uint32,bool)'
]);
export interface PoolPolicy {
 chain:'ethereum'|'bsc'|'base'|'arbitrum';token:Address;pool:Address;protocol:'v2'|'v3';factory:Address;
 tokenCodeHash:Hex;poolCodeHash:Hex;quote:Address;quoteDecimals:number;quoteFeed:Address;feedHeartbeat:number;
 exclusions:Address[];uptimeFeed?:Address;
}
const same=(a:unknown,b:unknown):boolean=>JSON.stringify(a)===JSON.stringify(b);
const h=(n:bigint)=>('0x'+n.toString(16)) as Hex;
interface Block {number:Hex;hash:Hex;timestamp:Hex}
type Call={to:Address;fn:string;args?:readonly unknown[]};
export class WitnessRPC {
 readonly reads:RpcWitness[]=[];
 private requests=0;
 constructor(private urls:[string,string],private charge:(count:number)=>Promise<void>){
  if(new URL(urls[0]).hostname===new URL(urls[1]).hostname)throw Error('independent-rpc-required');
 }
 async query(method:string,params:unknown[]):Promise<unknown>{return (await this.many([{method,params}]))[0];}
 async many(calls:{method:string;params:unknown[]}[]):Promise<unknown[]>{
  // Reserve headroom for job persistence within the Workers free subrequest limit.
  if(this.requests+2>36)throw Error('verification-request-budget');this.requests+=2;
  await this.charge(calls.length*2);
  const packets=calls.map((c,i)=>({jsonrpc:'2.0',id:i+1,...c}));
  const results=await Promise.all(this.urls.map(async url=>{
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(packets),signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error('verification-rpc-unavailable');const data=await r.json() as {id:number;result:unknown;error?:unknown}[];
   if(!Array.isArray(data))throw Error('rpc-batch-unsupported');
   return calls.map((_,i)=>{const v=data.find(x=>x.id===i+1);if(!v||v.error||v.result==null)throw Error('missing-chain-state');return v.result;});
  }));
  const left=results[0]!,right=results[1]!;
  for(let i=0;i<calls.length;i++){
   const c=calls[i]!,a=left[i],b=right[i];
   if(c.method==='eth_getBlockByNumber'){
    const x=a as Block,y=b as Block;if(x.hash!==y.hash||x.number!==y.number||x.timestamp!==y.timestamp)throw Error('rpc-block-disagreement');
   }else if(!same(a,b))throw Error('rpc-state-disagreement');
   this.reads.push({...c,result:a});
  }
  return left;
 }
 async block(tag:string):Promise<Block>{return await this.query('eth_getBlockByNumber',[tag,false]) as Block;}
 async calls(calls:Call[],block:Block):Promise<unknown[]>{
  const values=await this.many(calls.map(c=>({method:'eth_call',params:[{to:c.to,data:encodeFunctionData({abi,functionName:c.fn as never,args:c.args as never})},{blockHash:block.hash,requireCanonical:true}]})));
  return values.map((v,i)=>decodeFunctionResult({abi,functionName:calls[i]!.fn as never,data:v as Hex}));
 }
}
const Q=2n**192n,Q96=2n**96n;
export function ratioAtTick(tick:number):bigint {
 if(!Number.isInteger(tick)||Math.abs(tick)>887272)throw Error('invalid-tick');
 let n=Math.abs(tick),base=Q*10001n/10000n,out=Q;
 while(n){if(n%2)out=out*base/Q;base=base*base/Q;n=Math.floor(n/2);}
 return tick<0?Q*Q/out:out;
}
function sqrt(n:bigint):bigint {if(n<0n)throw Error('negative-root');if(n<2n)return n;let a=n,b=(a+1n)/2n;while(b<a){a=b;b=(a+n/a)/2n;}return a;}
const sqrtTick=(t:number)=>sqrt(ratioAtTick(t)*Q96*Q96/Q);
const tuple=(v:unknown)=>v as readonly bigint[];
const address=(v:unknown)=>(v as Address).toLowerCase() as Address;
async function oldBlock(rpc:WitnessRPC,end:Block):Promise<Block>{
 const target=BigInt(end.timestamp)-600n,last=BigInt(end.number);let span=1024n,lo=last>span?last-span:0n;
 let first=await rpc.block(h(lo));
 while(BigInt(first.timestamp)>target&&lo>0n){span*=2n;lo=last>span?last-span:0n;first=await rpc.block(h(lo));}
 if(BigInt(first.timestamp)>target)throw Error('insufficient-pool-history');
 let hi=last,hiTime=BigInt(end.timestamp);
 while(hi-lo>1n&&target-BigInt(first.timestamp)>60n){
  // Timestamp interpolation avoids ten separate binary-search packets on normal chains.
  const guess=lo+(target-BigInt(first.timestamp))*(hi-lo)/(hiTime-BigInt(first.timestamp));
  const mid=guess<=lo?lo+1n:guess>=hi?hi-1n:guess,b=await rpc.block(h(mid));
  if(BigInt(b.timestamp)<=target){lo=mid;first=b;}else {hi=mid;hiTime=BigInt(b.timestamp);}
 }
 return first;
}
async function v2Price(rpc:WitnessRPC,p:PoolPolicy,first:Block,end:Block,quote0:boolean):Promise<{ratio:bigint;liquidity:bigint;spot:bigint}>{
 const fn=quote0?'price1CumulativeLast':'price0CumulativeLast';
 const sample=async(b:Block)=>{
  const [c,rs]=await rpc.calls([{to:p.pool,fn},{to:p.pool,fn:'getReserves'}],b);
  const [r0,r1,last]=tuple(rs);if(!r0||!r1||last==null)throw Error('empty-pool');
  const delta=(BigInt(b.timestamp)-BigInt(last)+2n**32n)%2n**32n;
  const cumulative=(c as bigint)+((quote0?r0:r1)<<112n)/(quote0?r1:r0)*delta;
  return {c:cumulative%(2n**256n),r0,r1};
 };
 const [a,b]=await Promise.all([sample(first),sample(end)]);
 const elapsed=BigInt(end.timestamp)-BigInt(first.timestamp);
 const raw=(b.c-a.c+2n**256n)%(2n**256n)/elapsed;
 return {ratio:raw*Q/2n**112n,liquidity:(quote0?b.r0:b.r1)*2n,spot:(quote0?b.r0:b.r1)*Q/(quote0?b.r1:b.r0)};
}
async function v3Price(rpc:WitnessRPC,p:PoolPolicy,end:Block,quote0:boolean):Promise<{ratio:bigint;liquidity:bigint;spot:bigint}>{
 const [obs,slot,liq,spacing]=await rpc.calls([{to:p.pool,fn:'observe',args:[[600,0]]},{to:p.pool,fn:'slot0'},{to:p.pool,fn:'liquidity'},{to:p.pool,fn:'tickSpacing'}],end);
 const cumulative=(obs as readonly [readonly bigint[],readonly bigint[]])[0];const change=cumulative[1]!-cumulative[0]!;
 let mean=change/600n;if(change<0n&&change%600n)mean--;
 const raw=ratioAtTick(Number(mean));const [s,t]=tuple(slot);const tick=Number(t),step=Number(spacing);
 if(!s||!liq||step<=0)throw Error('inactive-v3-pool');
 const low=Math.max(-887272,tick-100),high=Math.min(887272,tick+100);
 const w0=Math.floor(Math.floor(low/step)/256),w1=Math.floor(Math.floor(high/step)/256);
 const words=await rpc.calls(Array.from({length:w1-w0+1},(_,i)=>({to:p.pool,fn:'tickBitmap',args:[w0+i]})),end);
 const ticks:number[]=[];
 words.forEach((word,i)=>{const bits=word as bigint;for(let b=0;b<256;b++)if(bits&(1n<<BigInt(b))){const at=((w0+i)*256+b)*step;if(at>low&&at<high)ticks.push(at);}});
 if(ticks.length>16)throw Error('v3-depth-budget-exceeded');
 const states=await rpc.calls(ticks.map(t=>({to:p.pool,fn:'ticks',args:[t]})),end);
 const nets=new Map(ticks.map((t,i)=>[t,tuple(states[i])[1]!]));
 const depth=(up:boolean)=>{
  let l=liq as bigint,current=s,total=0n;
  const path=ticks.filter(t=>up?t>tick:t<=tick).sort((a,b)=>up?a-b:b-a);path.push(up?high:low);
  for(const at of path){const next=sqrtTick(at),a=current>next?current:next,b=current>next?next:current;
   if(l<=0n||b<=0n)break;const amount0=l*(a-b)*Q96/(a*b),amount1=l*(a-b)/Q96;total+=quote0?amount0:amount1;
   l+=up?(nets.get(at)||0n):-(nets.get(at)||0n);current=next;
  }return total;
 };
 const up=depth(true),down=depth(false),spotRaw=s*s*Q/(Q96*Q96);
 return {ratio:quote0?Q*Q/raw:raw,liquidity:up<down?up:down,spot:quote0?Q*Q/spotRaw:spotRaw};
}
export async function verifyPool(env:Env,p:PoolPolicy,key:Hex,charge:(count:number)=>Promise<void>,target?:bigint):Promise<Evidence>{
 const chain=chainFor(p.chain);if(!chain.verified)throw Error('preview-only-chain');
 if(p.exclusions.length>16||p.feedHeartbeat<=0||p.quoteDecimals<0||p.quoteDecimals>18)throw Error('invalid-policy');
 const urls=(JSON.parse(env.SOURCE_RPC_JSON||'{}') as Record<string,[string,string]>)[p.chain];if(!urls||urls.length!==2)throw Error('rpc-pair-unconfigured');
 if(urls.some(u=>{const url=new URL(u);return url.protocol!=='https:'&&!(env.MODE==='local'&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));}))throw Error('https-source-rpc-required');
 const rpc=new WitnessRPC(urls,charge);
 const id=await rpc.query('eth_chainId',[]);if(BigInt(id as string)!==BigInt(chain.chainId!))throw Error('wrong-source-chain');
 const finalized=await rpc.block('finalized');if(target!==undefined&&target>BigInt(finalized.number))throw Error('unfinalized-historical-block');
 const end=target===undefined?finalized:await rpc.block(h(target)),first=await oldBlock(rpc,end);
 const [tokenCode,poolCode]=await rpc.many([{method:'eth_getCode',params:[p.token,{blockHash:end.hash,requireCanonical:true}]},{method:'eth_getCode',params:[p.pool,{blockHash:end.hash,requireCanonical:true}]}]);
 if(keccak256(tokenCode as Hex)!==p.tokenCodeHash||keccak256(poolCode as Hex)!==p.poolCodeHash)throw Error('unapproved-bytecode');
 const [t0,t1,factory,decimals,supply,quoteDecimals,feedDecimals,feed,...excluded]=await rpc.calls([
  {to:p.pool,fn:'token0'},{to:p.pool,fn:'token1'},{to:p.pool,fn:'factory'},
  {to:p.token,fn:'decimals'},{to:p.token,fn:'totalSupply'},{to:p.quote,fn:'decimals'},
  {to:p.quoteFeed,fn:'decimals'},{to:p.quoteFeed,fn:'latestRoundData'},...p.exclusions.map(a=>({to:p.token,fn:'balanceOf',args:[a]}))
 ],end);
 const quote0=address(t0)===p.quote.toLowerCase();
 if(address(factory)!==p.factory.toLowerCase()||address(quote0?t1:t0)!==p.token.toLowerCase()||address(quote0?t0:t1)!==p.quote.toLowerCase()||Number(decimals)>18||Number(quoteDecimals)!==p.quoteDecimals)throw Error('pool-identity-mismatch');
 const fee=p.protocol==='v3'?(await rpc.calls([{to:p.pool,fn:'fee'}],end))[0]:undefined;
 const [registered]=await rpc.calls([{to:p.factory,fn:p.protocol==='v2'?'getPair':'getPool',args:p.protocol==='v2'?[p.token,p.quote]:[p.token,p.quote,fee]}],end);
 if(address(registered)!==p.pool.toLowerCase())throw Error('factory-pool-mismatch');
 const [round,answer,,updated,answered]=tuple(feed),ts=BigInt(end.timestamp);
 if(answer==null||answer<=0n||!updated||updated>ts||ts-updated>BigInt(Math.ceil(p.feedHeartbeat*1.5))||answered!<round!)throw Error('unhealthy-usd-feed');
 if(p.chain==='base'||p.chain==='arbitrum'){
  if(!p.uptimeFeed)throw Error('sequencer-feed-required');const [u]=await rpc.calls([{to:p.uptimeFeed,fn:'latestRoundData'}],end);const v=tuple(u);
  if(v[1]!==0n||!v[2]||ts-v[2]<3600n)throw Error('sequencer-unhealthy');
 }
 const price=p.protocol==='v2'?await v2Price(rpc,p,first,end,quote0):await v3Price(rpc,p,end,quote0);
 const difference=price.spot>price.ratio?price.spot-price.ratio:price.ratio-price.spot;
 if(price.ratio<=0n||difference*100n>price.ratio*10n)throw Error('spot-twap-divergence');
 const quoteUsd8=answer*USD_SCALE/10n**BigInt(Number(feedDecimals));
 const priceUsd8=price.ratio*10n**BigInt(Number(decimals))*quoteUsd8/(Q*10n**BigInt(p.quoteDecimals));
 const priceUsd18=price.ratio*10n**BigInt(Number(decimals))*quoteUsd8*10n**10n/(Q*10n**BigInt(p.quoteDecimals));
 const circulating=(supply as bigint)-excluded.reduce<bigint>((a,v)=>a+(v as bigint),0n);if(circulating<=0n)throw Error('unreliable-supply');
 const liquidityUsd8=price.liquidity*quoteUsd8/10n**BigInt(p.quoteDecimals);
 if(liquidityUsd8<(p.protocol==='v2'?25000n:5000n)*USD_SCALE)throw Error('insufficient-liquidity');
 // Confirm the exact evidence block is still canonical after all state reads.
 if((await rpc.block(end.number)).hash!==end.hash)throw Error('source-reorganized');
 return {version:1,policy:'evm-twap-v1',assetKey:key,chain:p.chain,token:p.token,pool:p.pool,protocol:p.protocol,
  block:{number:BigInt(end.number).toString(),hash:end.hash,timestamp:Number(ts)},firstBlock:{number:BigInt(first.number).toString(),hash:first.hash,timestamp:Number(BigInt(first.timestamp))},
  // Round after multiplying supply, so sub-cent memecoins do not lose their cap.
  priceUsd8:priceUsd8.toString(),priceUsd18:priceUsd18.toString(),supply:circulating.toString(),supplyDecimals:Number(decimals),capUsd8:(price.ratio*quoteUsd8*circulating/(Q*10n**BigInt(p.quoteDecimals))).toString(),liquidityUsd8:liquidityUsd8.toString(),reads:rpc.reads,
  coverage:{from:Number(BigInt(first.timestamp)),to:Number(ts),completeLifetime:false},rpcAgreement:true};
}
