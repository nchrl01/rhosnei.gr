// Shared interpretation of observations for the audible score and visual
// motion. Rendering a frame, an unchanged snapshot, market cap and liquidity
// are never evidence that another trade happened.
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const number=(value,fallback=0)=>finite(value)?Number(value):fallback;
const unit=value=>Math.max(0,Math.min(1,number(value)));

export function marketActivityDecay(ageSeconds){
 const age=number(ageSeconds,Infinity);
 return age>=0&&age<30?Math.exp(-Math.max(0,age-2)/8):0;
}

export function marketPerformance(metrics={}, suppliedMusic=metrics.music||{}){
 const raw=metrics.raw||metrics,music=suppliedMusic||{};
 const source=metrics.replay?.source||metrics.source||(metrics.decoded?'trades':'snapshots');
 const candle=source==='candles';
 const price=number(metrics.price??metrics.context?.latestPrice??metrics.replay?.price??metrics.context?.path?.at(-1)?.close);
 const reference=number(metrics.referencePrice);
 const delta=price>0&&reference>0?100*(price/reference-1):number(metrics.delta??music.lastMove??music.changePct);
 const deltaKnown=metrics.availability?.change!==false&&(price>0&&reference>0||finite(metrics.delta??music.lastMove??music.changePct));
 const activityKnown=metrics.availability?.activity!==false&&finite(raw.activity??music.activity);
 const activity=unit(raw.activity??music.activity),motion=unit(raw.motion??music.volatility);
 const volumeKnown=metrics.availability?.volume!==false&&finite(raw.volume);
 const volume=volumeKnown?unit(raw.volume):0;
 const tradeRateKnown=!candle&&metrics.availability?.tradeRate!==false&&finite(metrics.tradeRate)
  &&(metrics.availability?.tradeRate===true||metrics.decoded===true||source==='lab'||source==='trades');
 const tradeRate=tradeRateKnown?Math.max(0,number(metrics.tradeRate)):0;
 const observed=metrics.observed??(price>0||[raw.activity,raw.motion,raw.volume,music.activity].some(finite));
 const fresh=unit(metrics.fresh??(observed?1:0));
 let tradingActivity;
 if(candle){
  const total=metrics.replay?.volume??metrics.observedVolume;
  // Candle volume is an aggregate activity proxy, never a trade count or side.
  tradingActivity=finite(total)?Number(total)>0?1:0:volumeKnown?volume>0?1:0:motion>0||Math.abs(delta)>1e-9?1:0;
 }else if(finite(metrics.tradingActivity)){
  tradingActivity=unit(metrics.tradingActivity);
 }else{
  // Lab/frozen callers without a live recency envelope supply their own
  // finite observed frame. Descriptive intensity alone cannot activate it.
  tradingActivity=activity>0||volume>0||motion>0||tradeRate>0||Math.abs(delta)>1e-9?1:0;
 }
 if(!observed)tradingActivity=0;
 const balanceKnown=!candle&&metrics.availability?.balance!==false&&finite(metrics.balance);
 const balance=balanceKnown?unit(metrics.balance):.5;
 const marketCap=number(metrics.context?.latestCap??metrics.marketCap,null);
 const liquidity=metrics.availability?.liquidity===false?null:number(metrics.observation?.liquidity??metrics.liquidity,null);
 // Candle history does not contain historical ownership. Only a recorded
 // observation can carry its own holder snapshot into replay.
 const audience=metrics.audience||{},holderCount=number(audience.holders??metrics.holders,null);
 const holdersKnown=!candle&&metrics.availability?.holders!==false&&holderCount!==null&&holderCount>=0
  &&audience.state!=='expired'&&audience.state!=='unavailable'&&audience.weight!==0;
 return {source,price,delta,deltaKnown,direction:Math.sign(delta),activity,activityKnown,volume,volumeKnown,motion,
  intensity:unit(music.intensity??metrics.intensity),pressure:unit(metrics.context?.pressure??metrics.pressure),
  balance,balanceKnown,tradeRate,tradeRateKnown,observed:!!observed,fresh,tradingActivity,
  excitation:fresh*tradingActivity,marketCap:marketCap>0?marketCap:null,liquidity:liquidity!==null&&liquidity>=0?liquidity:null,
  holders:holdersKnown?holderCount:null,holdersKnown};
}
