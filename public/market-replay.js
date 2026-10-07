import {contextualizeMarket} from './market-state.js?v=206';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
export const candleEnd=(bar,interval)=>Math.min(bar.time+interval,bar.observedThrough??bar.lastAt??bar.time+interval);

// Keep the controls actually observed during this visit, separate from OHLC history.
export function createMarketReplay(){
 const recordings=new Map();let key='demo';
 const state={active:false,cursor:null,dragging:false,clock:null,speed:'1',source:null,price:null,bar:null,controls:null,endHold:null,ended:false,frozen:null};
 function frames(){return recordings.get(key)||[];}
 return {
  state,
  freeze(bars,market,interval){state.frozen={bars:structuredClone(bars),market:structuredClone(market),interval};},
  setMarket(value){key=value;this.live();if(!recordings.has(key)){recordings.set(key,[]);if(recordings.size>8)recordings.delete(recordings.keys().next().value);}},
  record(metrics,price,at=Date.now()){
   const rows=frames();if(rows.length&&at-rows.at(-1).at<1000)return;
   rows.push({at,price,metrics:{...metrics,raw:{...metrics.raw},context:{...metrics.context,path:[]}}});
   if(rows.length>3600)rows.shift();recordings.set(key,rows);
  },
  seek(bar,interval,dragging=false){state.active=true;state.cursor=candleEnd(bar,interval);state.dragging=dragging;state.clock=performance.now();state.bar=bar;state.endHold=null;state.ended=false;state.controls=null;},
  release(){state.dragging=false;state.clock=performance.now();},
  live(){Object.assign(state,{active:false,cursor:null,dragging:false,clock:null,source:null,price:null,bar:null,controls:null,endHold:null,ended:false,frozen:null});},
  advance(bars,interval,running,now=performance.now()){
   if(state.frozen){bars=state.frozen.bars;interval=state.frozen.interval;}
   if(!state.active||!bars.length)return false;
   const previous=state.clock??now;state.clock=now;
   const rate=state.speed==='candle'?interval/1000:Number(state.speed)||1;
   if(running&&!state.dragging)state.cursor+=Math.min(1000,Math.max(0,now-previous))*rate;
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
   state.source='candles';state.price=bar.close;state.controls=scoreCandle(bars,market,interval,bar);return state.controls;
  },
 };
}

export function scoreCandle(bars,market,interval,bar){
 const known=bars.filter(b=>candleEnd(b,interval)<=candleEnd(bar,interval));
 const duration=Math.max(1,(candleEnd(bar,interval)-bar.time)/1000),volumeRate=Math.max(0,Number(bar.volume)||0)/duration;
 const volume=unit(Math.log1p(volumeRate)/Math.log(10001));
 const move=Math.abs((bar.close/bar.open-1)*100),motion=unit(move/8);
 // OHLC has no trade counts, buy/sell split or historical liquidity.
 // Activity is a labelled volume proxy; unavailable controls remain neutral/dry.
 const raw={motion,activity:volume,balance:.5,texture:0,volume,fresh:1,snapshotFresh:1,snapshotAge:0,decoded:false,observedVolume:bar.volume};
 const m=contextualizeMarket(raw,{price:bar.close,marketCap:Number(market?.marketCap),snapshotPrice:Number(market?.priceUsd),history:known,interval,volumeRate,observedAt:candleEnd(bar,interval),now:candleEnd(bar,interval)});
 return {...m,availability:{balance:false,liquidity:false,volume:bar.volume!=null},replay:{source:'candles',at:candleEnd(bar,interval),price:bar.close,volume:bar.volume}};
}
