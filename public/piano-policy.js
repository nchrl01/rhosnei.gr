// Price selection uses received market data; silence uses the playback clock.
// Compressed history must not accelerate the quiet piano into a repetitive loop.
export const PIANO_MOVE_PCT=5;
export const PIANO_QUIET_MS=30000;
const priceOf=event=>Number(event.priceUsd??event.price);
export function createPianoPolicy(seed=0){
 let anchor=null,lastTrade=null,started=null,lastNote=null;
 const quietSpacing=()=>45000+(seed>>>0)%16*1000;
 function prime(price,music={},reference){
  if(anchor>0||!(price>0))return;
  const change=Number(music.changePct)||0;
  const contextual=price/(1+change/100);
  anchor=Number(reference)>0?Number(reference):contextual>0&&Number.isFinite(contextual)?contextual:price;
 }
 function select(price,at,music,reason,quietAt){
  const changePct=(price/anchor-1)*100;
  anchor=price;lastNote=quietAt;
  return {reason,changePct,price,at,music};
 }
 function movement(price,at,music,quietAt){
  const move=(price/anchor-1)*100;
  // Trades and observed prices share one anchor and onset-spacing rule.
  const spacing=Math.max(600,60000/Math.max(40,Math.min(140,Number(music.tempo)||40)));
  return Math.abs(move)+1e-9>=PIANO_MOVE_PCT&&(lastNote===null||quietAt-lastNote>=spacing)?select(price,at,music,'movement',quietAt):null;
 }
 return {
  reset(value=seed){seed=value>>>0;anchor=null;lastTrade=null;started=null;lastNote=null;},
  observe(event,music={}){
   const price=priceOf(event),at=Number(event.receivedAt??event.occurredAt??event.at);
   if(!(price>0)||!Number.isFinite(price)||!Number.isFinite(at))return null;
   const quietAt=Number.isFinite(event.quietAt)?event.quietAt:at;
   prime(price,music,event.referencePrice);started??=quietAt;
   // A real pool/ticker price may select a meaningful movement, but it says
   // nothing about whether trades occurred. Never manufacture quiet activity.
   return movement(price,at,music,quietAt);
  },
  trade(event,music={}){
   const price=priceOf(event),at=Number(event.historical?event.at:event.receivedAt??event.occurredAt??event.at);
   if(!(price>0)||!Number.isFinite(price)||!Number.isFinite(at))return null;
   const quietAt=Number.isFinite(event.quietAt)?event.quietAt:at;
   prime(price,music,event.referencePrice);started??=quietAt;
   // Empty candles are known quiet intervals, never invented historical trades.
   if(event.historical&&event.volume===0)return null;
   const gap=quietAt-(lastTrade??started);lastTrade=Math.max(lastTrade??quietAt,quietAt);
   // A cached burst or overdue replay batch cannot strike many notes at once.
   // Suppressed observations leave the price anchor intact for the next move.
   const selected=movement(price,at,music,quietAt);if(selected)return selected;
   if(!event.historical&&gap>=PIANO_QUIET_MS&&(lastNote===null||quietAt-lastNote>=quietSpacing()))return select(price,at,music,'quiet',quietAt);
   return null;
  },
  idle({at,quietAt=at,price,music={},known=false,quiet=false,referencePrice}={}){
   if(!(price>0)||!Number.isFinite(price)||!Number.isFinite(at)||!Number.isFinite(quietAt))return null;
   prime(price,music,referencePrice);started??=quietAt;
   // Only a healthy stream or recently checked trade poll can establish observed quiet.
   if(!known){lastTrade=quietAt;return null;}
   if(!quiet){lastTrade=quietAt;return null;}
   if(quietAt-(lastTrade??started)<PIANO_QUIET_MS||lastNote!==null&&quietAt-lastNote<quietSpacing())return null;
   return select(price,at,music,'quiet',quietAt);
  },
 };
}
