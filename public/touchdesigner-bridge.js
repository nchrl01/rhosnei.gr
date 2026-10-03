// Local preview only: the public website never probes localhost or sends data
// to the desktop. Start npm start and open /?touchdesigner=1 to opt in.
const unit=x=>Math.max(0,Math.min(1,Number(x)||0));
const hash=text=>{let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const value=x=>x==null||x===''?null:Number.isFinite(Number(x))?Number(x):null;
export function createTouchDesignerBridge(){
 const enabled=false; // TouchDesigner view is hidden until explicitly re-enabled.
 let sequence=0,voice=-1,lastSend=-Infinity,inflight=false,pending=null,previous=null,activeBefore=false;
 function event(e){if(enabled&&!e?.removed&&['swap','pool-transaction','pool-state'].includes(e?.kind))sequence++;}
 async function flush(){
  if(!enabled||inflight||!pending)return;inflight=true;const frame=pending;pending=null;
  try{await fetch('/visual/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(frame),signal:AbortSignal.timeout(1200)});}catch{}finally{inflight=false;if(pending)void flush();}
 }
 return {
  enabled,event,pulse(id){if(enabled)voice=Number(id)||0;},
  reset(){sequence++;previous=null;activeBefore=false;voice=-1;},
  frame(m,{playing=false,seeking=false,ended=false,seed=0}={}){
   if(!enabled)return;const raw=m.raw||m,c=m.context||{},now=performance.now();
   const active=playing&&!seeking&&!ended&&unit(m.fresh)>0;
   const point=m.replay?{key:m.replay.at,price:m.replay.price??c.path?.at(-1)?.close,volume:m.replay.volume}: {key:0,price:c.path?.at(-1)?.close,volume:m.observation?.volume};
   if(active&&activeBefore&&previous&&(point.price!==previous.price||(!m.decoded&&point.volume>previous.volume)||(m.replay&&point.key!==previous.key&&point.volume>0)))sequence++;
   previous=point;
   const transportChanged=active!==activeBefore;activeBefore=active;
   if(now-lastSend<80&&!transportChanged)return;lastSend=now;
   pending={version:1,sequence,word:hash(`${seed}:${m.replay?.at??sequence}:${point.price}:${point.volume}`),seed:Number(seed)>>>0,running:active?1:0,replay:m.replay?1:0,voice,
    intensity:unit(m.music?.intensity),activity:unit(raw.activity),volume:unit(raw.volume),motion:unit(raw.motion),pressure:unit(c.pressure),balance:m.availability?.balance===false?.5:unit(m.balance??.5),fresh:unit(m.fresh),
    price:value(point.price),marketCap:value(c.latestCap),liquidity:m.availability?.liquidity===false?null:value(m.observation?.liquidity),tradeRate:m.decoded?value(m.tradeRate):null,change:value(m.music?.changePct),volumeRatio:value(c.volumeRatio),turnover:value(c.turnover),holders:m.replay?null:value(m.audience?.holders),
    source:m.replay?'historical candle proxy':m.decoded?'observed swaps':'market snapshots',
    trace:(c.path||[]).slice(-32).map(p=>[value(p.close),value(p.volume)])};
   void flush();
  }
 };
}
