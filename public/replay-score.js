// Versioned score decisions are indexed by frozen candles, never listening time.
const hash=text=>{let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
export function buildReplayScore(bars,seed,interval=60000){
 const frames=new Map();let anchor=Number(bars[0]?.open),lastNote=-Infinity,lastActivity=Number(bars[0]?.time)||0;
 const quietSpacing=45000+(seed>>>0)%16*1000;
 for(let index=0;index<bars.length;index++){
  const bar=bars[index],at=bar.observedThrough??bar.lastAt??bar.time+interval;
  let selection=null;
  const change=anchor>0?(bar.close/anchor-1)*100:0;
  if(Number(bar.volume)>0){lastActivity=at;if(Math.abs(change)+1e-9>=5&&at-lastNote>=1500)selection={reason:'movement',changePct:change,price:bar.close,at};}
  else if(bar.volume===0&&at-lastActivity>=30000&&at-lastNote>=quietSpacing)selection={reason:'quiet',changePct:change,price:bar.close,at};
  if(selection){anchor=bar.close;lastNote=at;}
  frames.set(bar.time,{index,sceneSeed:hash(seed+':score-v1:'+bar.time),selection});
 }
 return {version:1,seed,frames};
}
