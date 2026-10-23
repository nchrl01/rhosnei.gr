// Pure artistic controls from the availability-labelled market signal.
// The logarithmic ranges below are declared musical design ranges in USD or
// holder accounts, not claims that financial size measures musical quality.
// No mapping is allowed to establish activity or bypass the shared live gate.
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const number=(value,fallback=0)=>finite(value)?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const unit=value=>clamp(number(value),0,1);
const logPosition=(value,lowPower,highPower)=>clamp((Math.log10(Math.max(1,value))-lowPower)/(highPower-lowPower),0,1);

/**
 * Interpret a normalized marketPerformance/marketChipSignal observation.
 *
 * `known` flags describe input evidence. Midpoint controls for absent cap,
 * liquidity or holders are neutral defaults, never invented observations.
 * Delta/activity require explicit availability because upstream normalized
 * zero alone cannot distinguish a missing measurement from a measured zero.
 *
 * rhythm.size/regularity: 0..1; rate: candidate-event frequency multiplier.
 * harmony.musicality/stability/gate: 0..1; harmonic adherence/articulation,
 *   not permission for compulsory chords or an independent loudness boost.
 * arpeggio.population: 0..1; notes: 2..4; span: 12..24 semitones.
 * change.magnitude: 0..1; direction: -1/0/1; signed: -1..1.
 * tempo.activity: 0..1 after live recency; bpm: 40..140 when measured,
 *   otherwise neutral 100. Callers must still obey active/excitation.
 */
export function marketMusicalMapping(signal={}){
 const cap=number(signal.marketCap,null),liquidity=number(signal.liquidity,null),holders=number(signal.holders,null);
 const known={
  marketCap:signal.marketCapKnown!==false&&cap!==null&&cap>0,
  liquidity:signal.liquidityKnown!==false&&liquidity!==null&&liquidity>=0,
  holders:signal.holdersKnown===true&&holders!==null&&holders>=0&&Number.isInteger(holders),
  change:signal.deltaKnown===true&&finite(signal.delta),
  activity:signal.activityKnown===true&&finite(signal.activity),
 };
 const tradeRateKnown=signal.tradeRateKnown===true&&finite(signal.tradeRate)&&Number(signal.tradeRate)>=0;
 known.activity=known.activity||tradeRateKnown;
 const fresh=unit(signal.fresh),recency=unit(signal.tradingActivity);
 const active=signal.observed===true&&fresh>0&&recency>0;

 // Orders of magnitude give cap, depth and population useful resolution
 // across small and large coins without hard categories or changing seeds.
 const size=known.marketCap?logPosition(cap,5,10):.5;
 const musicality=known.liquidity?logPosition(liquidity,3,8):.5;
 const population=known.holders?logPosition(holders,1,6):.5;
 const delta=known.change?Number(signal.delta):0;
 const direction=Math.sign(delta),magnitude=Math.tanh(Math.abs(delta)/8);

 // Activity and decoded trades/second are two views of pace. Taking their
 // maximum avoids counting the same observation twice. Candle activity is
 // already its labelled volume-rate proxy; it never becomes a trade count.
 const normalizedActivity=signal.activityKnown===true?unit(signal.activity):0;
 const rateActivity=tradeRateKnown?unit(Math.log1p(Number(signal.tradeRate))/Math.log(9)):0;
 const activity=known.activity&&active?Math.max(normalizedActivity,rateActivity)*recency:0;
 return {
  active,excitation:active?fresh*recency:0,known,
  rhythm:{size,rate:2**(.5-size),regularity:size},
  harmony:{musicality,stability:.45+.5*musicality,gate:.55+.45*musicality},
  arpeggio:{population,notes:2+Math.round(2*population),span:12+Math.round(12*population)},
  change:{direction,magnitude,signed:direction*magnitude},
  tempo:{activity,bpm:known.activity?40+100*Math.sqrt(activity):100},
 };
}
