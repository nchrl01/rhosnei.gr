import {createMarketLandmarks} from './market-landmarks.js?v=208';
// Versioned score decisions are indexed by frozen candles, never listening time.
import {PIANO_MOVE_PCT,phraseSpacingMs} from './piano-policy.js?v=208';
import {musicContext} from './music-context.js?v=208';
const hash=text=>{let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
export function buildReplayScore(bars,seed,interval=60000,market={}){
 const frames=new Map();let anchor=Number(bars[0]?.open),lastNote=-Infinity,lastPhrase=-Infinity,lastActivity=Number(bars[0]?.time)||0,harmonyStep=0,harmonyCharacter='serene',hasSounded=false,contextScan=0,contextAnchor=-1;
 const snapshotCap=Number(market?.marketCap),snapshotPrice=Number(market?.priceUsd);
 const landmarks=createMarketLandmarks();
 landmarks.observe(snapshotCap>0&&snapshotPrice>0?snapshotCap*Number(bars[0]?.open)/snapshotPrice:null,Number(bars[0]?.time)||0,'replay');
 const quietSpacing=45000+(seed>>>0)%16*1000;
 for(let index=0;index<bars.length;index++){
  const bar=bars[index],at=bar.observedThrough??bar.lastAt??bar.time+interval;
  let selection=null;
  const price=Number(bar.close),knownPrice=price>0&&Number.isFinite(price);
  if(!(anchor>0&&Number.isFinite(anchor))&&knownPrice){const open=Number(bar.open);anchor=open>0&&Number.isFinite(open)?open:price;}
  const cap=snapshotCap>0&&snapshotPrice>0&&knownPrice?snapshotCap*price/snapshotPrice:null;
  // Keep the 72 recent completed bars plus the five-minute anchor, even when
  // short candles put that anchor outside the bounded recent-history window.
  while(contextScan<=index&&bars[contextScan].time+interval<=at-300000){
   if(bars[contextScan].open>0&&bars[contextScan].close>0)contextAnchor=contextScan;
   contextScan++;
  }
  const recentStart=Math.max(0,index-72),rows=bars.slice(recentStart,index+1);
  if(contextAnchor>=0&&contextAnchor<recentStart)rows.unshift(bars[contextAnchor]);
  const moodMovement=landmarks.observe(cap,at,'replay');
  const music=musicContext({price,rows,interval,cap,moodMovement,fresh:1,now:at});
  const change=anchor>0&&knownPrice?(price/anchor-1)*100:0;
  if(Number(bar.volume)>0)lastActivity=at;
  // Snapshot/RPC candles have known prices but no observed trade volume.
  // Their meaningful price movements still belong in the frozen score.
  if(knownPrice&&(moodMovement.event?.at===at||Math.abs(change)+1e-9>=PIANO_MOVE_PCT&&at-lastNote>=1500))selection={reason:'movement',changePct:change,price,at};
  else if(knownPrice&&Number(bar.volume)>0&&at-lastPhrase>=phraseSpacingMs(music.tempo))selection={reason:'activity',changePct:change,price,at};
  else if(knownPrice&&bar.volume===0&&at-lastActivity>=30000&&at-lastNote>=quietSpacing)selection={reason:'quiet',changePct:change,price,at};
  if(selection){
   if(!hasSounded||selection.reason!=='quiet')harmonyCharacter=music.character||'serene';
   if(selection.reason==='movement'){anchor=price;if(hasSounded)harmonyStep++;}
   if(selection.reason!=='quiet')lastPhrase=at;
   lastNote=at;hasSounded=true;Object.assign(selection,{harmonyStep,harmonyCharacter});
  }
  frames.set(bar.time,{music,index,harmonyStep,harmonyCharacter,tempo:music.tempo,sceneSeed:hash(seed+':score-v1:'+bar.time),selection});
 }
 return {version:2,seed,frames};
}
