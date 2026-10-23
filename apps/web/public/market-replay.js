import {contextualizeMarket} from './market-state.js?v=208';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
export const candleEnd=(bar,interval)=>Math.min(bar.time+interval,Math.max(bar.observedThrough??bar.lastAt??bar.time+interval,bar.lastAt??bar.time));
export function replaySpeed(value){
 const speed=String(value);
 // Older shared replays used the third speed slot for skipping price changes.
 return speed==='jump'?'100':['1','50','100'].includes(speed)?speed:'1';
}

// The frozen observations are sorted when captured. Both audio and pixels
// select the same input at a candle's close, never a later price or trade.
export function replayObservationForBar(observations,bar,interval,at=candleEnd(bar,interval)){
 if(!Array.isArray(observations)||!observations.length)return null;
 const end=candleEnd(bar,interval),through=Math.min(at,end);
 let low=0,high=observations.length-1,index=-1;
 while(low<=high){const middle=(low+high)>>>1;if(observations[middle].at<=through){index=middle;low=middle+1;}else high=middle-1;}
 const observed=observations[index];
 return observed&&end-observed.at<=2000&&Math.abs(observed.price-bar.close)<=Math.max(Math.abs(bar.close)*1e-8,Number.EPSILON)?observed:null;
}

// Keep the controls actually observed during this visit, separate from OHLC history.
export function createMarketReplay(){
 const recordings=new Map(),archives=new Map(),frozenControls=new WeakMap();let key='demo';
 function archive(){if(!archives.has(key))archives.set(key,{controls:new Map(),scores:new Map()});return archives.get(key);}
 const state={active:false,cursor:null,dragging:false,clock:null,speed:'1',source:null,price:null,bar:null,controls:null,endHold:null,ended:false,handoffRequested:false,frozen:null};
 function frames(){return recordings.get(key)||[];}
 function controlsForBar(bars,market,interval,bar,observations,at=candleEnd(bar,interval),saved=archive().controls){
  if(candleEnd(bar,interval)>at)return null;
  const observed=replayObservationForBar(observations,bar,interval,at);
  if(observed)return {...structuredClone(observed.metrics),replay:{source:'observed',at:observed.at,price:observed.price}};
  const id=interval+':'+bar.time;
  if(!saved.has(id))saved.set(id,structuredClone(scoreCandle(bars,market,interval,bar)));
  while(saved.size>20000)saved.delete(saved.keys().next().value);
  return structuredClone(saved.get(id));
 }
 return {
  state,
  // Rebuild candle controls for each snapshot: the open candle and supply may
  // have changed since the previous replay. Frozen playback stays immutable.
  freeze(bars,market,interval){archive().controls.clear();state.controls=null;state.frozen={bars:structuredClone(bars),market:structuredClone(market),interval,observations:structuredClone(frames()).sort((a,b)=>a.at-b.at)};frozenControls.set(state.frozen,new Map());},
  controlsForBar(bar,at,frozen=state.frozen){
   if(!frozen)return null;
   const {bars,market,interval,observations}=frozen;
   let saved=frozenControls.get(frozen);if(!saved){saved=new Map();frozenControls.set(frozen,saved);}
   return controlsForBar(bars,market,interval,bar,observations,at,saved);
  },
  preserveScore(score,interval){
   const saved=archive().scores;
   for(const [time,frame] of score.frames){const id=interval+':'+time;if(saved.has(id))score.frames.set(time,structuredClone(saved.get(id)));else saved.set(id,structuredClone(frame));}
   while(saved.size>20000)saved.delete(saved.keys().next().value);
   return score;
  },
  setMarket(value){key=value;this.live();if(!recordings.has(key)){recordings.set(key,[]);if(recordings.size>8){const oldest=recordings.keys().next().value;recordings.delete(oldest);archives.delete(oldest);};}},
  record(metrics,price,at=Date.now()){
   const rows=frames();if(rows.length&&at-rows.at(-1).at<1000&&rows.at(-1).price===price)return;
   rows.push({at,price,metrics:structuredClone({...metrics,context:{...metrics.context,latestPrice:price,path:(metrics.context?.path||[]).slice(-1)}})});
   if(rows.length>3600)rows.shift();recordings.set(key,rows);
  },
  seek(bar,interval,dragging=false){state.active=true;state.cursor=candleEnd(bar,interval);state.dragging=dragging;state.clock=performance.now();state.bar=bar;state.endHold=null;state.ended=false;state.handoffRequested=false;state.controls=null;},
  release(){state.dragging=false;state.clock=performance.now();},
  live(){Object.assign(state,{active:false,cursor:null,dragging:false,clock:null,source:null,price:null,bar:null,controls:null,endHold:null,ended:false,handoffRequested:false,frozen:null});},
  advance(bars,interval,running,now=performance.now()){
   if(state.frozen){bars=state.frozen.bars;interval=state.frozen.interval;}
   if(!state.active||!bars.length)return false;
   const previous=state.clock??now;state.clock=now;
   const rate=Number(replaySpeed(state.speed));
   // The audio clock keeps advancing during rendering stalls. Preserve elapsed
   // time so the chart cannot force the score backwards after a late frame.
   if(running&&!state.dragging)state.cursor+=Math.max(0,now-previous)*rate;
   const end=candleEnd(bars.at(-1),interval);
   if(state.cursor>=end){state.cursor=end;if(!running||state.dragging){state.endHold=null;return false;}state.endHold??=now;if(now-state.endHold>=1000){state.ended=true;return true;}return false;}
   state.endHold=null;
   return false;
  },
  metrics(bars,market,interval){
   if(state.frozen){({bars,market,interval}=state.frozen);}
   if(!state.active||!bars.length)return null;
   const at=state.cursor,known=bars.filter(bar=>candleEnd(bar,interval)<=at),bar=known.at(-1)||bars[0];
   if(state.controls&&state.bar?.time===bar.time)return state.controls;
   state.bar=bar;
   state.controls=state.frozen?this.controlsForBar(bar,at):controlsForBar(bars,market,interval,bar,frames(),at);
   if(!state.controls)return null;
   state.source=state.controls.replay.source;state.price=state.controls.replay.price;
   return state.controls;
  },
 };
}

export function scoreCandle(bars,market,interval,bar){
 const known=bars.filter(b=>candleEnd(b,interval)<=candleEnd(bar,interval));
 const duration=Math.max(1,(candleEnd(bar,interval)-bar.time)/1000),volumeRate=Math.max(0,Number(bar.volume)||0)/duration;
 const volume=unit(Math.log1p(volumeRate)/Math.log(10001));
 const delta=Number(bar.open)>0?(Number(bar.close)/Number(bar.open)-1)*100:0,motion=unit(Math.abs(delta)/8);
 // OHLC has no trade counts, buy/sell split or historical liquidity.
 // Activity is a labelled volume proxy; unavailable controls remain neutral/dry.
 const raw={price:Number(bar.close),referencePrice:Number(bar.open),delta,motion,activity:volume,balance:.5,texture:0,volume,fresh:1,snapshotFresh:1,snapshotAge:0,decoded:false,observedVolume:bar.volume};
 const m=contextualizeMarket(raw,{price:bar.close,marketCap:Number(market?.marketCap),snapshotPrice:Number(market?.priceUsd),history:known,interval,volumeRate,observedAt:candleEnd(bar,interval),now:candleEnd(bar,interval)});
 return {...m,availability:{balance:false,liquidity:false,holders:false,activity:bar.volume!=null,volume:bar.volume!=null},replay:{source:'candles',at:candleEnd(bar,interval),price:bar.close,volume:bar.volume,chart:known.slice(-64).map(({time,open,high,low,close,volume})=>({time,open,high,low,close,volume}))}};
}
