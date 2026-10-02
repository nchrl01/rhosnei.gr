import {createChart,CandlestickSeries,LineSeries,HistogramSeries,PriceScaleMode} from './vendor/lightweight-charts.js';
import {candleEnd} from './market-replay.js?v=52';
import {createChartTicks} from './chart-ticks.js?v=52';

// One series per view, with provider candles and explicitly partial live observations.
export class MarketChart{
 constructor(container){
  this.points=[];this.history=[];this.renderedBars=[];this.buckets=new Map();this.interval=60000;this.origin=null;
  this.scale='linear';this.mode='candles';this.range='live';this.frame=null;this.rebuild=true;this.needsFit=true;this.manual=false;this.dirty=new Set();this.received=0;this.lastReceived=null;
  this.chart=createChart(container,{
   autoSize:true,layout:{background:{color:'#ffffff'},textColor:'#666666',fontSize:11,fontFamily:'Arial, sans-serif',attributionLogo:true},
   grid:{vertLines:{visible:false},horzLines:{color:'#eeeeee'}},
   rightPriceScale:{borderColor:'#dddddd',scaleMargins:{top:.1,bottom:.25}},
   timeScale:{borderColor:'#dddddd',timeVisible:true,secondsVisible:false,rightOffset:4,lockVisibleTimeRangeOnResize:true,tickMarkFormatter:(time,type)=>{const date=new Date(time*1000);return type===0?String(date.getFullYear()):type===1?date.toLocaleDateString(undefined,{month:'short',year:'numeric'}):type===2?date.toLocaleDateString(undefined,{month:'short',day:'numeric'}):date.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',...(type===4?{second:'2-digit'}:{})});}},
   localization:{timeFormatter:time=>new Date(time*1000).toLocaleString(undefined,{timeZoneName:'short'}),priceFormatter:price=>'$'+Number(price).toLocaleString('en',{maximumSignificantDigits:9})},
   handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
   handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true},
  });
  const priceFormat={type:'custom',formatter:price=>'$'+Number(price).toLocaleString('en',{maximumSignificantDigits:9}),minMove:1e-12};
  this.candles=this.chart.addSeries(CandlestickSeries,{upColor:'#ffffff',downColor:'#111111',wickUpColor:'#111111',wickDownColor:'#111111',borderVisible:true,borderUpColor:'#111111',borderDownColor:'#111111',priceFormat});
  this.line=this.chart.addSeries(LineSeries,{color:'#111111',lineWidth:2,visible:false,priceFormat});
  this.volume=this.chart.addSeries(HistogramSeries,{priceScaleId:'volume',priceFormat:{type:'volume'},lastValueVisible:false,priceLineVisible:false});
  this.volume.priceScale().applyOptions({scaleMargins:{top:.8,bottom:0},visible:false});
  this.chart.subscribeCrosshairMove(param=>{
   const target=document.getElementById('chart-ohlc'),series=this.mode==='candles'?this.candles:this.line;
   const data=param.seriesData.get(series),bar=typeof param.time==='number'?this.buckets.get(param.time*1000):null;
   if(!data||!bar){target.textContent='Drag to pan · scroll or pinch to zoom · hover to inspect';return;}
   const price=n=>'$'+Number(n).toLocaleString('en',{maximumSignificantDigits:7});
   target.textContent=new Date(bar.time).toLocaleString()+' · O '+price(bar.open)+'  H '+price(bar.high)+'  L '+price(bar.low)+'  C '+price(bar.close)+(bar.volume!=null?' · USD volume '+price(bar.volume):' · Volume unavailable')+(bar.live?' · partial live observations':' · provider candle');
  });
  const interaction=()=>{this.manual=true;this.needsFit=false;};
  document.getElementById('chart-timezone').textContent='Chart times: '+Intl.DateTimeFormat().resolvedOptions().timeZone+' · local time';
  container.addEventListener('pointerdown',interaction);container.addEventListener('wheel',interaction,{passive:true});
  setInterval(()=>{const target=document.getElementById('chart-update');target.textContent=this.lastReceived?'Last price received '+((Date.now()-this.lastReceived.receivedAt)/1000).toFixed(1)+'s ago · '+this.received+' observations · $'+this.lastReceived.price.toPrecision(9)+(this.lastReceived.source==='demo'?' · synthetic demo':this.lastReceived.source==='snapshot'?' · polled snapshot':this.lastReceived.source==='rpc-state'?' · direct RPC pool state':' · received trade'):'Waiting for price observations';},500);
  this.tickView=createChartTicks(this);
  this.chart.subscribeClick(param=>{if(typeof param.time==='number'){const bar=this.buckets.get(param.time*1000);if(bar)this.onHistorySeek?.(bar,false);}});
 }
 // The audio clock owns the cursor; animation only interpolates its display.
 bindReplay(readState,isPlaying){
  this.readReplay=readState;this.replayIsPlaying=isPlaying;
  this.playhead=document.getElementById('replay-playhead');
  const animate=now=>{if(!document.hidden&&now-(this.lastReplayPaint||0)>=32){this.lastReplayPaint=now;this.followReplay();}this.replayFrame=requestAnimationFrame(animate);};
  this.replayFrame=requestAnimationFrame(animate);
 }
 replayLogical(at){
  const bars=this.renderedBars;if(!bars.length)return null;
  let low=0,high=bars.length;
  while(low<high){const middle=(low+high)>>1;if(candleEnd(bars[middle],this.interval)<=at)low=middle+1;else high=middle;}
  const index=Math.max(0,low-1),bar=bars[index],next=bars[index+1];
  const start=candleEnd(bar,this.interval),end=next?candleEnd(next,this.interval):start;
  const fraction=end>start?Math.max(0,Math.min(1,(at-start)/(end-start))):0;
  return index+fraction+(this.origin&&this.origin<bars[0].time?1:0);
 }
 followReplay(){
  const state=this.readReplay?.(),active=!!state?.active&&this.renderedBars.length>0;
  if(this.playhead)this.playhead.hidden=!active;
  if(!active)return;
  const scale=this.chart.timeScale(),width=scale.width();
  if(this.playhead){this.playhead.style.left=width/2+'px';this.playhead.style.bottom=scale.height()+'px';}
  let cursor=state.cursor;
  if(this.replayIsPlaying()&&!state.dragging&&!state.ended&&state.clock!=null){
   const rate=state.speed==='candle'?this.interval/1000:Number(state.speed)||1;
   cursor+=Math.min(1000,Math.max(0,performance.now()-state.clock))*rate;
  }
  cursor=Math.min(cursor,candleEnd(this.renderedBars.at(-1),this.interval));
  const logical=this.replayLogical(cursor),range=scale.getVisibleLogicalRange();
  if(logical==null||!range)return;
  const span=Math.max(2,range.to-range.from),middle=(range.from+range.to)/2;
  if(Math.abs(middle-logical)>span/Math.max(1,width)*.35){
   this.manual=true;this.needsFit=false;
   scale.setVisibleLogicalRange({from:logical-span/2,to:logical+span/2});
  }
 }
 setMode(mode){this.mode=mode;this.candles.applyOptions({visible:mode==='candles'});this.line.applyOptions({visible:mode!=='candles'});}
 setScale(mode){this.scale=mode;this.chart.priceScale('right').applyOptions({mode:mode==='log'?PriceScaleMode.Logarithmic:PriceScaleMode.Normal,autoScale:true});}
 setRange(range){this.range=range;this.manual=false;this.needsFit=true;this.schedule();}
 setHistory(candles,interval,origin){this.history=candles;this.interval=interval;this.origin=origin;this.rebuild=true;if(!this.manual&&this.range==='history')this.needsFit=true;this.schedule();}
 setInterval(interval){this.history=[];this.interval=interval;this.rebuild=true;this.manual=false;this.needsFit=true;this.schedule();}
 fit(){this.range='history';this.manual=false;this.needsFit=true;this.schedule();}
 goLive(){this.range='live';this.manual=false;this.needsFit=true;this.schedule();}
 zoom(factor){const scale=this.chart.timeScale(),range=scale.getVisibleLogicalRange();if(!range)return;const middle=(range.from+range.to)/2,half=(range.to-range.from)*factor/2;scale.setVisibleLogicalRange({from:middle-half,to:middle+half});this.manual=true;this.needsFit=false;}
 schedule(){if(this.frame!==null)return;this.frame=requestAnimationFrame(()=>{this.frame=null;this.draw();});}
 reset(){this.points=[];this.history=[];this.renderedBars=[];this.origin=null;this.received=0;this.lastReceived=null;this.buckets.clear();this.dirty.clear();this.rebuild=true;this.manual=false;this.needsFit=true;this.tickView?.live();this.tickView?.update([]);if(this.playhead)this.playhead.hidden=true;this.schedule();}
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
  const scale=this.chart.timeScale(),visible=scale.getVisibleRange(),following=scale.scrollPosition()<=5;
  if(this.rebuild){this.buckets=new Map(this.history.map(b=>[b.time,{...b,observedThrough:b.observedThrough??b.time+this.interval,lastAt:(b.observedThrough??b.time+this.interval)-1}]));this.dirty.clear();for(const p of [...this.points].sort((a,b)=>a.at-b.at))this.merge(p);}
  const bars=[...this.buckets.values()].sort((a,b)=>a.time-b.time);this.renderedBars=bars;
  if(!bars.length){this.candles.setData([]);this.line.setData([]);this.volume.setData([]);this.tickView?.update([]);this.rebuild=false;return;}
  const candle=b=>({time:b.time/1000,open:b.open,high:b.high,low:b.low,close:b.close});
  const volume=b=>b.volume!=null?{time:b.time/1000,value:b.volume,color:b.close>=b.open?'#cccccc':'#555555'}:{time:b.time/1000};
  const last=bars.at(-1).time;
  if(this.rebuild||[...this.dirty].some(time=>time<last&&!this.publishedTimes?.has(time))){
   const gap=this.origin&&this.origin<bars[0].time?[{time:Math.floor(this.origin/1000)}]:[];
   this.candles.setData([...gap,...bars.map(candle)]);this.line.setData([...gap,...bars.map(b=>({time:b.time/1000,value:b.close}))]);this.volume.setData([...gap,...bars.map(volume)]);
   this.publishedTimes=new Set(bars.map(bar=>bar.time));
   if(visible&&!this.needsFit)scale.setVisibleRange(visible);
  }else if(this.dirty.size){for(const time of [...this.dirty].sort((a,b)=>a-b)){const bar=this.buckets.get(time);if(!bar)continue;const historical=time<last;this.candles.update(candle(bar),historical);this.line.update({time:time/1000,value:bar.close},historical);this.volume.update(volume(bar),historical);this.publishedTimes?.add(time);}}
  this.rebuild=false;this.dirty.clear();
  if(this.readReplay?.().active){this.followReplay();}
  else if(this.needsFit){if(this.range==='history')scale.fitContent();else scale.setVisibleLogicalRange({from:Math.max(-2,bars.length-100),to:bars.length+4});this.needsFit=false;}
  else if(!this.manual&&this.range==='live'&&following)scale.scrollToRealTime();
  this.tickView?.update(bars);
 }
}
