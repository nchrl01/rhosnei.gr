import {harmoniousPitch} from './harmonic-network.js?v=206';
// Original Pd control score: real observations -> finite microtones and noise.
const unit=value=>Math.max(0,Math.min(1,Number(value)||0));
export function createDataSonification({send=()=>{},event=()=>{}}={}){
 let enabled=true,seed=1917,lastTradeAt=-Infinity,signals={};
 function frame(m,{playing=false,seeking=false,ended=false,clock=0}={}){
  const active=enabled&&playing&&!seeking&&!ended;
  const fresh=unit(m.fresh),intensity=unit(m.music?.intensity),raw=m.raw||m;
  const activity=unit(raw.activity),volume=unit(raw.volume),pressure=unit(m.context?.pressure);
  const motion=unit(raw.motion),balance=m.availability?.balance===false?.5:unit(m.balance??.5);
  const liquidity=m.availability?.liquidity===false?0:unit(m.texture);
  // Historic candle volume is a labelled activity proxy, never a trade count.
  const excitation=fresh*Math.max(intensity*unit(activity*10),.5*Math.sqrt(activity*volume));
  const density=active?unit(excitation*(.15+.85*Math.sqrt(activity||volume))):0;
  const level=active?.14*Math.sqrt(excitation):0;
  const reverb=active?.2+.32*liquidity:0;
  const noise=unit(.08+.46*motion+.24*pressure);
  const tonic=m.music?.tonic??48+seed%12;
  const pitch=harmoniousPitch(tonic+21+Math.round(14*intensity+3*motion),tonic,m.music?.character,m.music?.harmony?.notes||[]);
  const params={'data-reverb':reverb,'data-enabled':active?1:0,'data-density':density,'data-level':level,'data-noise':noise,'data-pitch':pitch,'data-root':tonic-12,'data-duration':.7+.8*liquidity,'data-drive':1+2.5*intensity,'data-filter':1200+6500*Math.max(motion,volume),'data-pan-left':Math.sqrt(1-balance),'data-pan-right':Math.sqrt(balance)};
  for(const [name,value] of Object.entries(params))send(name,value);
  signals={density,drive:params['data-drive'],pitch,noise,level,reverb,liquidity,duration:params['data-duration'],enabled,active,clock};
  return signals;
 }
 return {
  frame,
  event(trade,{playing=false,replay=false,clock=0}={}){
   // One short event at most every 125 ms; backlog and snapshots never bang.
   if(!enabled||!playing||replay||trade.kind!=='swap'||clock-lastTradeAt<.125)return false;
   lastTradeAt=clock;event('data-trade');return true;
  },
  setEnabled(value){enabled=Boolean(value);if(!enabled){send('data-enabled',0);send('data-level',0);}},
  reset(value=seed){seed=Number(value)>>>0;lastTradeAt=-Infinity;send('data-enabled',0);send('data-level',0);},
  snapshot(){return signals;},
 };
}
