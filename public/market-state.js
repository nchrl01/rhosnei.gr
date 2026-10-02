// Musical context uses fixed historical data and the latest observation.
// Chart viewport, drawing geometry and zoom never enter this calculation.
const unit=x=>Math.max(0,Math.min(1,Number(x)||0));
const median=values=>{const s=values.filter(Number.isFinite).sort((a,b)=>a-b);return s.length?s[Math.floor(s.length/2)]:null;};
export function contextualizeMarket(raw,{price,marketCap,snapshotPrice,history=[],interval=300000,changes={},liquidity=0,volumeRate=0,observedAt,now=Date.now()}={}){
 const rows=history.filter(b=>b.close>0&&b.open>0&&b.time<=now).sort((a,b)=>a.time-b.time);
 const points=rows.map(b=>({...b,through:Math.min(now,b.observedThrough??b.time+interval)}));
 const baselineRows=points.filter(b=>b.through<=now-1800000&&b.through>=now-86400000);
 const baseline=median((baselineRows.length?baselineRows:points.slice(0,-1)).map(b=>b.close));
 const ratio=price>0&&baseline>0?price/baseline:null;
 let pace=0,direction=0,winningWindow=null;
 const windows=[['m5',300000,1],['h1',3600000,.95],['h6',21600000,.75],['h24',86400000,.45]];
 for(const [name,duration,weight] of windows){
  const anchor=points.filter(b=>b.through<=now-duration).at(-1);
  const usable=anchor&&now-anchor.through<=duration+Math.max(interval*2,duration*.25);
  const supplied=changes[name]!=null&&Number.isFinite(Number(changes[name]))&&Number(changes[name])>-100;
  const logReturn=usable&&price>0?Math.log(price/anchor.close):supplied?Math.log1p(Number(changes[name])/100):null;
  if(logReturn===null)continue;
  const hours=(usable?now-anchor.through:duration)/3600000;
  const speed=Math.abs(logReturn)/Math.max(1/12,hours);
  const score=Math.tanh(Math.abs(logReturn)/Math.log(2))*Math.tanh(speed/.35)*weight;
  if(score>pace){pace=score;direction=Math.sign(logReturn);winningWindow=name;}
 }
 // A recent move retains its character after a brief pause in trades, then
 // cools with elapsed time. Old high valuations alone cannot sustain energy.
 let shock=0;
 for(const b of points){const age=now-b.through;if(age>21600000)continue;const move=Math.abs(Math.log(b.close/b.open));const score=Math.tanh(Math.max(0,move-Math.log(1.05))/Math.log(1.5))*Math.exp(-age/7200000);shock=Math.max(shock,score);}
 const typicalVolumeRate=median(points.filter(b=>b.through>=now-86400000&&b.through<now-300000&&b.volume>0).map(b=>b.volume/(interval/1000)));
 const volumeRatio=typicalVolumeRate>0?volumeRate/typicalVolumeRate:null;
 const volumeSurge=volumeRatio>1?unit(Math.log(volumeRatio)/Math.log(10)):0;
 const turnover=liquidity>0?unit(volumeRate*300/liquidity):0;
 const pressure=unit(Math.max(pace,.85*shock,.6*volumeSurge+.4*turnover));
 const latestCap=marketCap>0&&snapshotPrice>0&&price>0?marketCap*price/snapshotPrice:null;
 const impliedBaselineCap=latestCap>0&&ratio>0?latestCap/ratio:null;
 const path=points.filter(b=>b.through>=now-21600000).slice(-180).map(b=>({time:b.through,close:b.close,volume:b.volume}));
 if(price>0){const time=Math.min(now,Math.max(observedAt||now,(path.at(-1)?.time||0)+1));path.push({time,close:price,volume:0});}
 const context={pressure,pace,shock,direction,winningWindow,ratio,baseline,latestCap,impliedBaselineCap,capEstimated:latestCap!==marketCap,volumeRatio,turnover,path,historyAvailable:!!points.length,historyInterval:interval};
 return {...raw,raw:{motion:raw.motion,activity:raw.activity,volume:raw.volume},pressure,context,
  motion:Math.max(raw.motion,pressure),activity:Math.max(raw.activity,.85*pressure),volume:Math.max(raw.volume,.8*pressure)};
}
