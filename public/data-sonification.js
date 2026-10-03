// Original Pd control score: real observations -> microtones/noise + holder drone.
const unit=value=>Math.max(0,Math.min(1,Number(value)||0));
export function createDataSonification({send=()=>{},event=()=>{}}={}){
 let enabled=true,seed=1917,lastTradeAt=-Infinity,signals={};
 function frame(m,{playing=false,seeking=false,ended=false,clock=0}={}){
  const active=enabled&&playing&&!seeking&&!ended;
  const fresh=unit(m.fresh),intensity=unit(m.music?.intensity),raw=m.raw||m;
  const activity=unit(raw.activity),volume=unit(raw.volume),pressure=unit(m.context?.pressure);
  const motion=unit(raw.motion),balance=m.availability?.balance===false?.5:unit(m.balance??.5);
  // Historic candle volume is a labelled activity proxy, never a trade count.
  const excitation=fresh*Math.max(intensity*unit(activity*10),.5*Math.sqrt(activity*volume));
  const density=active?unit(excitation*(.15+.85*Math.sqrt(activity||volume))):0;
  const level=active?.085*Math.sqrt(excitation):0;
  const noise=unit(.08+.46*motion+.24*pressure);
  const pitch=69+(seed%7)+Math.round(19*intensity+4*motion);
  const holder=m.replay?null:m.audience;
  const count=holder?.holders,valid=count!=null&&Number.isFinite(count)&&count>=0;
  const fullness=valid?unit(Math.log10(1+count)/7):0;
  const holderLevel=active&&valid?.048*Math.sqrt(fullness)*unit(holder.weight):0;
  const holderPitch=36+(seed%5); // Same seed key as the sampled piano, one octave lower.
  const holderBeat=valid?.04+.8*(holder.concentration??.25)+.35*fullness:0;
  const params={'data-enabled':active?1:0,'data-density':density,'data-level':level,'data-noise':noise,'data-pitch':pitch,'data-drive':1+2.5*intensity,'data-filter':1200+4700*Math.max(motion,volume),'data-pan-left':Math.sqrt(1-balance),'data-pan-right':Math.sqrt(balance),'holder-level':holderLevel,'holder-pitch':holderPitch,'holder-beat':holderBeat,'holder-brightness':180+900*fullness};
  for(const [name,value] of Object.entries(params))send(name,value);
  signals={density,drive:params['data-drive'],pitch,noise,level,holderLevel,holderPitch,holderBeat,enabled,active,clock};
  return signals;
 }
 return {
  frame,
  event(trade,{playing=false,replay=false,clock=0}={}){
   // One short event at most every 125 ms; backlog and snapshots never bang.
   if(!enabled||!playing||replay||trade.kind!=='swap'||clock-lastTradeAt<.125)return false;
   lastTradeAt=clock;event('data-trade');return true;
  },
  setEnabled(value){enabled=Boolean(value);if(!enabled){send('data-enabled',0);send('data-level',0);send('holder-level',0);}},
  reset(value=seed){seed=Number(value)>>>0;lastTradeAt=-Infinity;send('data-enabled',0);send('data-level',0);send('holder-level',0);},
  snapshot(){return signals;},
 };
}
