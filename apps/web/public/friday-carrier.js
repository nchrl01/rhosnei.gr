// Timing and coin circuit recovered from a84fac4 (23 October, 23:40 Athens),
// the nearest saved revision to the user's 23:38 reference. Keep the original
// incommensurate periods, phase and observation-derived occupancy; bound the
// density before handing proposals to the newer harmonic/phrase arranger.
const hash=(seed,n)=>{let x=((seed>>>0)^Math.imul((n|0)+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);return (x^(x>>>13))>>>0;};
const roll=(seed,n)=>hash(seed,n)/4294967296;
export function fridayCarrier(seed,bar,signal){
 const identity=hash(seed,113),state=hash(identity,signal.observationFingerprint??signal.fingerprint);
 const periods=[5,7,11,13,17,19,23],period=periods[hash(identity,0)%periods.length]/11;
 const phase=roll(identity,41)*period,start=bar*4,end=start+4;
 const energy=Math.min(1,Math.max(signal.activity,signal.motion,signal.volume*.7,Math.min(1,signal.tradeRate/8)));
 const events=[];let previous=-Infinity;
 for(let step=Math.max(0,Math.ceil((start-phase)/period));step*period+phase<end;step++){
  const at=step*period+phase,cell=hash(state,step);
  if(roll(cell,13)>.16+energy*.7||at-previous<.6)continue;
  events.push({beat:at-start,duty:1+hash(identity,step)%2});previous=at;
 }
 return events;
}
