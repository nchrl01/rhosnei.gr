// Session observations only: no historical candles or interpolated prices.
export class MarketChart{
 constructor(canvas){this.canvas=canvas;this.points=[];this.frame=null;this.observer=new ResizeObserver(()=>this.schedule());this.observer.observe(canvas);}
 schedule(){if(this.frame!==null)return;this.frame=requestAnimationFrame(()=>{this.frame=null;this.draw();});}
 reset(){this.points=[];this.schedule();}
 add(point){if(!(point.price>0)||!Number.isFinite(point.price))return;this.points.push(point);if(this.points.length>3600)this.points.shift();this.schedule();}
 remove(id){this.points=this.points.filter(p=>p.id!==id);this.schedule();}
 draw(){
  const canvas=this.canvas,rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(rect.width===0)return;
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  const c=canvas.getContext('2d');c.scale(dpr,dpr);const w=rect.width,h=rect.height,L=8,R=100,T=20,B=32;
  c.clearRect(0,0,w,h);c.font='10px monospace';c.fillStyle='#929987';
  if(!this.points.length){c.fillText('Prices appear here after a market is loaded.',L,40);return;}
  const points=this.points.slice(-1200),candles=new Map();
  for(const p of points){const time=Math.floor(p.at/10000)*10000;let bar=candles.get(time);if(!bar){bar={time,open:p.price,high:p.price,low:p.price,close:p.price,source:p.source};candles.set(time,bar);}bar.high=Math.max(bar.high,p.price);bar.low=Math.min(bar.low,p.price);bar.close=p.price;}
  const bars=[...candles.values()].sort((a,b)=>a.time-b.time).slice(-100),values=bars.flatMap(b=>[b.low,b.high]);
  let lo=Math.min(...values),hi=Math.max(...values);const margin=(hi-lo)*.15||hi*.002||.01;lo-=margin;hi+=margin;
  const minTime=bars[0].time,maxTime=Math.max(minTime+100000,bars.at(-1).time+10000);
  const y=value=>T+(hi-value)/(hi-lo)*(h-T-B),x=time=>L+(time-minTime)/(maxTime-minTime)*(w-L-R);
  c.strokeStyle='#343a30';c.lineWidth=1;
  for(let i=0;i<4;i++){const value=lo+(hi-lo)*i/3,py=y(value);c.beginPath();c.moveTo(L,py);c.lineTo(w-R,py);c.stroke();c.fillStyle='#929987';c.fillText('$'+value.toPrecision(5),w-R+10,py+4);}
  const width=Math.max(2,Math.min(9,(w-L-R)*10000/(maxTime-minTime)*.65));
  for(const bar of bars){const px=x(bar.time)+width/2;c.strokeStyle=c.fillStyle=bar.close>=bar.open?'#d4ed98':'#c79b94';c.beginPath();c.moveTo(px,y(bar.high));c.lineTo(px,y(bar.low));c.stroke();c.fillRect(px-width/2,Math.min(y(bar.open),y(bar.close)),width,Math.max(1,Math.abs(y(bar.open)-y(bar.close))));}
  const last=points.at(-1);c.setLineDash([3,4]);c.strokeStyle='#697d50';c.beginPath();c.moveTo(L,y(last.price));c.lineTo(w-R,y(last.price));c.stroke();c.setLineDash([]);
  c.fillStyle='#929987';c.fillText(new Date(minTime).toLocaleTimeString(),L,h-8);c.fillText(new Date(bars.at(-1).time).toLocaleTimeString(),Math.max(L,w-R-80),h-8);
 }
}
