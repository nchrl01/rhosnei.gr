import {createChart,CandlestickSeries,LineSeries,HistogramSeries,PriceScaleMode} from './vendor/lightweight-charts.js?v=232';
import {candleEnd} from './market-replay.js?v=459';
import {createChartTicks} from './chart-ticks.js?v=373';

// One series per view, with provider candles and explicitly partial live observations.
export class MarketChart{
 constructor(container){
  this.capSupply=null;this.container=container;
  this.points=[];this.history=[];this.renderedBars=[];this.buckets=new Map();this.interval=60000;this.origin=null;
  this.scale='linear';this.mode='candles';this.range='live';this.frame=null;this.rebuild=true;this.needsFit=true;this.manual=false;this.replayFollowing=true;this.publishedGap=0;this.dirty=new Set();this.received=0;this.lastReceived=null;
  this.chart=createChart(container,{
   autoSize:true,layout:{background:{color:'#000000'},textColor:'#b5b5b5',fontSize:12,fontFamily:'Unifont, sans-serif',attributionLogo:true},
   grid:{vertLines:{visible:false},horzLines:{color:'#222222'}},
   rightPriceScale:{borderColor:'#3a3a3a',scaleMargins:{top:.1,bottom:.25}},
   timeScale:{borderColor:'#3a3a3a',timeVisible:true,secondsVisible:false,rightOffset:4,lockVisibleTimeRangeOnResize:true,shiftVisibleRangeOnNewBar:false,tickMarkFormatter:(time,type)=>{const date=new Date(time*1000);return type===0?String(date.getFullYear()):type===1?date.toLocaleDateString(undefined,{month:'short',year:'numeric'}):type===2?date.toLocaleDateString(undefined,{month:'short',day:'numeric'}):date.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',...(type===4?{second:'2-digit'}:{})});}},
   crosshair:{vertLine:{color:'#888888',labelBackgroundColor:'#333333'},horzLine:{color:'#888888',labelBackgroundColor:'#333333'}},
   localization:{timeFormatter:time=>new Date(time*1000).toLocaleString(undefined,{timeZoneName:'short'}),priceFormatter:price=>this.formatMarketCap(price)},
   handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
   handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true},
  });
  // Canvas axes must invalidate their measurements after the webfont loads.
  if(document.fonts)document.fonts.load('400 12px Unifont','0123456789.,$').then(()=>{
   this.chart.applyOptions({layout:{fontFamily:'"Unifont", "Noto Sans", sans-serif',fontSize:12}});
  }).catch(()=>{});
  const priceFormat={type:'custom',formatter:price=>this.formatMarketCap(price),minMove:1e-12};
  this.candles=this.chart.addSeries(CandlestickSeries,{upColor:'#000000',downColor:'#f2f2f2',wickUpColor:'#f2f2f2',wickDownColor:'#f2f2f2',borderVisible:true,borderUpColor:'#f2f2f2',borderDownColor:'#f2f2f2',priceLineColor:'#b5b5b5',priceFormat});
  this.line=this.chart.addSeries(LineSeries,{color:'#f2f2f2',lineWidth:2,visible:false,priceFormat});
  this.volume=this.chart.addSeries(HistogramSeries,{priceScaleId:'volume',priceFormat:{type:'volume'},lastValueVisible:false,priceLineVisible:false});
  this.volume.priceScale().applyOptions({scaleMargins:{top:.8,bottom:0},visible:false});
  this.chart.subscribeCrosshairMove(param=>{
   const target=document.getElementById('chart-ohlc'),series=this.mode==='candles'?this.candles:this.line;
   const data=param.seriesData.get(series),bar=typeof param.time==='number'?this.buckets.get(param.time*1000):null;
   if(!data||!bar){target.textContent='Drag to pan · scroll or pinch to zoom · hover to inspect';return;}
   const price=n=>'$'+Number(n).toLocaleString('en',{maximumSignificantDigits:7});
   target.textContent=new Date(bar.time).toLocaleString()+' · Estimated market cap · O '+this.formatMarketCap(bar.open)+'  H '+this.formatMarketCap(bar.high)+'  L '+this.formatMarketCap(bar.low)+'  C '+this.formatMarketCap(bar.close)+(bar.volume!=null?(bar.volumeEstimated?' · Estimated quote volume ':' · USD volume ')+price(bar.volume):' · Volume unavailable')+(bar.live?' · partial live observations':' · provider candle');
  });
  const interaction=()=>{
   this.manual=true;this.needsFit=false;this.replayFollowing=false;
   if(this.readReplay?.().active&&!this.replayPanning){
    this.replayPanning=true;this.replayPanRange=this.chart.timeScale().getVisibleLogicalRange();
    this.onReplayPanStart?.();
   }
  };
  let gesture=null,dragged=false;
  document.getElementById('chart-timezone').textContent='Chart times: '+Intl.DateTimeFormat().resolvedOptions().timeZone+' · local time';
  container.addEventListener('pointerdown',event=>{
   interaction();dragged=false;gesture={id:event.pointerId,x:event.clientX,y:event.clientY};
  },true);
  container.addEventListener('pointermove',event=>{
   if(gesture?.id===event.pointerId&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>5)dragged=true;
  },true);
  const endGesture=event=>{if(gesture?.id===event.pointerId){gesture=null;requestAnimationFrame(()=>this.finishReplayPan());}};
  window.addEventListener('pointerup',endGesture,true);window.addEventListener('pointercancel',endGesture,true);
  container.addEventListener('wheel',event=>{
   // Vertical wheel/pinch changes scale, not playback position. Only a
   // horizontal pan enters the seeking state used by the sound and visual.
   if(Math.abs(event.deltaX||0)<=Math.abs(event.deltaY||0)){
    this.manual=true;this.needsFit=false;
    if(this.readReplay?.().active&&!this.replayPanning)this.replayFollowing=true;
    return;
   }
   interaction();clearTimeout(this.replayWheelTimer);this.replayWheelTimer=setTimeout(()=>this.finishReplayPan(),180);
  },{passive:true});
  setInterval(()=>{if(document.hidden||!document.body.classList.contains('inspecting'))return;const target=document.getElementById('chart-update');target.textContent=this.lastReceived?'Last price received '+((Date.now()-this.lastReceived.receivedAt)/1000).toFixed(1)+'s ago · '+this.received+' observations · $'+this.lastReceived.price.toPrecision(9)+(this.lastReceived.source==='demo'?' · synthetic demo':this.lastReceived.source==='snapshot'?' · polled snapshot':this.lastReceived.source==='rpc-state'?' · direct RPC pool state':' · received trade'):'Waiting for price observations';},1000);
  this.tickView=createChartTicks(this);
  this.chart.subscribeClick(param=>{if(!dragged&&typeof param.time==='number'){const bars=this.readReplay?.().frozen?.bars,bar=bars?bars.find(item=>item.time===param.time*1000):this.buckets.get(param.time*1000);if(bar)this.onHistorySeek?.(bar,false);}});
 }
 formatMarketCap(price){
  if(!(this.capSupply>0)||!Number.isFinite(price)||price<0)return '—';
  return '$'+new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(price*this.capSupply);
 }
 setMarketCapBasis(market){
  const cap=Number(market?.marketCap),price=Number(market?.priceUsd),supply=cap>0&&price>0&&Number.isFinite(cap/price)?cap/price:null;
  if(supply===this.capSupply||(supply&&this.capSupply&&Math.abs(supply/this.capSupply-1)<1e-8))return;
  this.capSupply=supply;
  const priceFormat={type:'custom',formatter:value=>this.formatMarketCap(value),minMove:1e-12};
  this.candles.applyOptions({priceFormat});this.line.applyOptions({priceFormat});
  this.chart.applyOptions({localization:{priceFormatter:value=>this.formatMarketCap(value)}});
  this.container.setAttribute('aria-label',supply?'Market cap chart, estimated using current circulating supply':'Market cap unavailable');
 }
 // The audio clock owns the cursor; animation only interpolates its display.
 bindReplay(readState,isPlaying){
  this.readReplay=readState;this.replayIsPlaying=isPlaying;
  this.playhead=document.getElementById('replay-playhead');
  const animate=now=>{if(!document.hidden&&now-(this.lastReplayPaint||0)>=32){this.lastReplayPaint=now;this.followReplay();}this.replayFrame=requestAnimationFrame(animate);};
  this.replayFrame=requestAnimationFrame(animate);
 }
 resumeReplayFollow(){this.replayFollowing=true;this.manual=true;this.needsFit=false;}
 syncReplayPan(){
  if(!this.replayPanning||!this.readReplay?.().active||!this.renderedBars.length)return;
  const range=this.chart.timeScale().getVisibleLogicalRange();if(!range)return;
  if(range.from===this.replayPanRange?.from&&range.to===this.replayPanRange?.to)return;
  this.replayPanRange={...range};
  const logical=Math.max(0,Math.min(this.renderedBars.length-1,(range.from+range.to)/2-this.publishedGap));
  const index=Math.floor(logical),bar=this.renderedBars[index],next=this.renderedBars[index+1];
  const start=candleEnd(bar,this.interval),end=next?candleEnd(next,this.interval):start;
  this.onReplayPan?.(start+(end-start)*(logical-index));
 }
 finishReplayPan(){
  if(!this.replayPanning)return;
  this.syncReplayPan();this.replayPanning=false;this.replayPanRange=null;
  this.onReplayPanEnd?.();
  if(this.readReplay?.().active){this.resumeReplayFollow();this.followReplay();}
 }
 replayLogical(at){
  const bars=this.renderedBars;if(!bars.length)return null;
  let low=0,high=bars.length;
  while(low<high){const middle=(low+high)>>1;if(candleEnd(bars[middle],this.interval)<=at)low=middle+1;else high=middle;}
  const index=Math.max(0,low-1),bar=bars[index],next=bars[index+1];
  const start=candleEnd(bar,this.interval),end=next?candleEnd(next,this.interval):start;
  const fraction=end>start?Math.max(0,Math.min(1,(at-start)/(end-start))):0;
  return index+fraction+this.publishedGap;
 }
 followReplay(){
  const state=this.readReplay?.(),active=!!state?.active&&this.renderedBars.length>0;
  if(this.playhead)this.playhead.hidden=!active;
  if(!active)return;
  this.syncReplayPan();
  const scale=this.chart.timeScale(),width=scale.width();
  if(this.playhead)this.playhead.style.bottom=scale.height()+'px';
  let cursor=state.cursor;
  if(this.replayIsPlaying()&&!state.dragging&&!state.ended&&state.clock!=null){
   const rate=state.speed==='candle'?this.interval/1000:Number(state.speed)||1;
   cursor+=Math.min(1000,Math.max(0,performance.now()-state.clock))*rate;
  }
  cursor=Math.min(cursor,candleEnd(this.renderedBars.at(-1),this.interval));
  const logical=this.replayLogical(cursor),range=scale.getVisibleLogicalRange();
  if(logical==null||!range)return;
  const span=Math.max(2,range.to-range.from),middle=(range.from+range.to)/2;
  if(this.replayFollowing&&Math.abs(middle-logical)>span/Math.max(1,width)*.35){
   this.manual=true;this.needsFit=false;
   scale.setVisibleLogicalRange({from:logical-span/2,to:logical+span/2});
  }
  if(this.playhead){
   // The chart applies range changes on its next paint, so following must not
   // briefly position the cursor using the previous viewport.
   this.playhead.hidden=false;
   this.playhead.style.left=width/2+'px';
  }
 }
 setMode(mode){this.mode=mode;this.candles.applyOptions({visible:mode==='candles'});this.line.applyOptions({visible:mode!=='candles'});}
 setScale(mode){this.scale=mode;this.chart.priceScale('right').applyOptions({mode:mode==='log'?PriceScaleMode.Logarithmic:PriceScaleMode.Normal,autoScale:true});}
 setRange(range){this.range=range;this.manual=false;this.replayFollowing=false;this.needsFit=true;this.schedule();}
 setHistory(candles,interval,origin){this.history=candles;this.interval=interval;this.origin=origin;this.rebuild=true;if(!this.manual&&this.range==='history')this.needsFit=true;this.schedule();}
 setInterval(interval){this.history=[];this.interval=interval;this.rebuild=true;this.manual=false;this.needsFit=true;this.schedule();}
 fit(){this.range='history';this.manual=false;this.replayFollowing=false;this.needsFit=true;this.schedule();}
 goLive(){this.range='live';this.manual=false;this.replayFollowing=true;this.needsFit=true;this.schedule();}
 zoom(factor){const scale=this.chart.timeScale(),range=scale.getVisibleLogicalRange();if(!range)return;const middle=(range.from+range.to)/2,half=(range.to-range.from)*factor/2;scale.setVisibleLogicalRange({from:middle-half,to:middle+half});this.manual=true;this.needsFit=false;this.replayFollowing=!!this.readReplay?.().active;}
 schedule(){if(this.frame!==null)return;this.frame=requestAnimationFrame(()=>{this.frame=null;this.draw();});}
 reset(){clearTimeout(this.replayWheelTimer);this.replayPanning=false;this.replayPanRange=null;this.points=[];this.history=[];this.renderedBars=[];this.origin=null;this.received=0;this.lastReceived=null;this.buckets.clear();this.dirty.clear();this.rebuild=true;this.manual=false;this.replayFollowing=true;this.publishedGap=0;this.needsFit=true;this.tickView?.live();this.tickView?.update([]);if(this.playhead)this.playhead.hidden=true;this.schedule();}
 merge(point){
  const time=Math.floor(point.at/this.interval)*this.interval;let bar=this.buckets.get(time);
  // Provider coverage takes precedence over observations already included in
  // that interval. Only observations after its acquisition boundary extend it.
  if(bar?.observedThrough!=null&&point.at<bar.observedThrough)return;
  if(!bar){bar={time,open:point.price,high:point.price,low:point.price,close:point.price,volume:null,firstAt:point.at,lastAt:point.at};this.buckets.set(time,bar);}
  bar.high=Math.max(bar.high,point.price);bar.low=Math.min(bar.low,point.price);
  if(bar.firstAt!=null&&point.at<bar.firstAt){bar.open=point.price;bar.firstAt=point.at;}
  if(bar.lastAt==null||point.at>=bar.lastAt){bar.close=point.price;bar.lastAt=point.at;}
  if(!bar.live){bar.volume=null;bar.live=true;}
  if(Number.isFinite(point.volume)&&point.volume>=0)bar.volume=(bar.volume||0)+point.volume;
  this.dirty.add(time);
 }
 add(point){
  if(!(point.price>0)||!Number.isFinite(point.price))return;this.points.push(point);this.received++;this.lastReceived={...point,receivedAt:Date.now()};
  if(this.points.length>3600){this.points.splice(0,this.points.length-3000);this.rebuild=true;}
  if(!this.rebuild)this.merge(point);this.schedule();
 }
 remove(id){this.points=this.points.filter(p=>p.id!==id);this.rebuild=true;this.schedule();}
 retime(id,at){
  if(!Number.isFinite(at))return;const point=this.points.find(p=>p.id===id);if(!point||point.at===at)return;
  const oldTime=Math.floor(point.at/this.interval)*this.interval,newTime=Math.floor(at/this.interval)*this.interval;point.at=at;
  if(oldTime!==newTime||this.rebuild){this.rebuild=true;this.schedule();return;}
  const base=this.history.find(bar=>bar.time===oldTime);
  if(base)this.buckets.set(oldTime,{...base,observedThrough:base.observedThrough??base.time+this.interval,lastAt:(base.observedThrough??base.time+this.interval)-1});else this.buckets.delete(oldTime);
  for(const observation of this.points.filter(p=>Math.floor(p.at/this.interval)*this.interval===oldTime).sort((a,b)=>a.at-b.at))this.merge(observation);
  this.dirty.add(oldTime);this.schedule();
 }
 draw(){
  this.revision=(this.revision||0)+1;
  const scale=this.chart.timeScale(),visible=scale.getVisibleLogicalRange(),previousBars=this.renderedBars,previousGap=this.publishedGap;
  // Preserve fractional bar positions and zoom, even when older history is added.
  const restoreViewport=(bars,gap)=>{
   if(!visible||this.needsFit)return;
   const index=Math.max(0,Math.min(previousBars.length-1,Math.floor(visible.from-previousGap))),anchor=previousBars[index];
   const nextIndex=anchor?bars.findIndex(bar=>bar.time===anchor.time):-1,offset=nextIndex<0?0:nextIndex+gap-index-previousGap;
   scale.setVisibleLogicalRange({from:visible.from+offset,to:visible.to+offset});
  };
  const frozen=this.readReplay?.().active?this.readReplay().frozen:null;
  if(this.replayDataset&&!frozen){this.replayDataset=null;this.rebuild=true;}
  if(this.rebuild){this.buckets=new Map(this.history.map(b=>[b.time,{...b,observedThrough:b.observedThrough??b.time+this.interval,lastAt:(b.observedThrough??b.time+this.interval)-1}]));this.dirty.clear();for(const p of [...this.points].sort((a,b)=>a.at-b.at))this.merge(p);}
  if(frozen){
   // Incoming observations keep updating the live store, but the chart and
   // audio both read the exact frozen score until the listener returns live.
   this.renderedBars=frozen.bars;
   if(this.replayDataset!==frozen){
    const bars=frozen.bars,gap=this.origin&&this.origin<bars[0]?.time?[{time:Math.floor(this.origin/1000)}]:[];
    this.candles.setData([...gap,...bars.map(b=>({time:b.time/1000,open:b.open,high:b.high,low:b.low,close:b.close}))]);
    this.line.setData([...gap,...bars.map(b=>({time:b.time/1000,value:b.close}))]);
    this.volume.setData([...gap,...bars.map(b=>b.volume!=null?{time:b.time/1000,value:b.volume,color:b.close>=b.open?'#cccccc':'#555555'}:{time:b.time/1000})]);
    restoreViewport(bars,gap.length);this.publishedGap=gap.length;
    this.replayDataset=frozen;
   }
   this.rebuild=false;this.dirty.clear();
   if(this.needsFit){if(this.range==='history')scale.fitContent();else scale.setVisibleLogicalRange({from:Math.max(-2,frozen.bars.length-100),to:frozen.bars.length+4});this.needsFit=false;}
   this.followReplay();this.tickView?.update(frozen.bars);return;
  }
  const bars=[...this.buckets.values()].sort((a,b)=>a.time-b.time);this.renderedBars=bars;
  if(!bars.length){this.candles.setData([]);this.line.setData([]);this.volume.setData([]);this.tickView?.update([]);this.rebuild=false;return;}
  const candle=b=>({time:b.time/1000,open:b.open,high:b.high,low:b.low,close:b.close});
  const volume=b=>b.volume!=null?{time:b.time/1000,value:b.volume,color:b.close>=b.open?'#cccccc':'#555555'}:{time:b.time/1000};
  const last=bars.at(-1).time;
  if(this.rebuild||[...this.dirty].some(time=>time<last&&!this.publishedTimes?.has(time))){
   const gap=this.origin&&this.origin<bars[0].time?[{time:Math.floor(this.origin/1000)}]:[];
   this.candles.setData([...gap,...bars.map(candle)]);this.line.setData([...gap,...bars.map(b=>({time:b.time/1000,value:b.close}))]);this.volume.setData([...gap,...bars.map(volume)]);
   this.publishedTimes=new Set(bars.map(bar=>bar.time));
   restoreViewport(bars,gap.length);this.publishedGap=gap.length;
  }else if(this.dirty.size){for(const time of [...this.dirty].sort((a,b)=>a-b)){const bar=this.buckets.get(time);if(!bar)continue;const historical=time<last;this.candles.update(candle(bar),historical);this.line.update({time:time/1000,value:bar.close},historical);this.volume.update(volume(bar),historical);this.publishedTimes?.add(time);}}
  this.rebuild=false;this.dirty.clear();
  if(this.readReplay?.().active){this.followReplay();}
  else if(this.needsFit){if(this.range==='history')scale.fitContent();else scale.setVisibleLogicalRange({from:Math.max(-2,bars.length-100),to:bars.length+4});this.needsFit=false;}
  else if(this.range==='live'&&!this.manual)scale.scrollToRealTime();
  this.tickView?.update(bars);
 }
}
