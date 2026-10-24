import {chipAdsrLevel} from './chip-envelope.js?v=480';
// Performed chip events share the output clock with the visual. This is not
// an invented beat detector: rejected, cancelled and silent voices never cue.
const unit=value=>Math.max(0,Math.min(1,Number(value)||0));
const empty=()=>({attack:0,sustain:0,echo:0,texture:0,arp:0,bass:0,chord:0,lead:0,drum:0,direction:0,pitch:.5,events:0});
const roleFor=event=>event.kind?.startsWith('chord')||event.kind==='drone'?'chord':event.kind==='note'?'lead':event.kind;

export function audioPresentationTime(context,now=globalThis.performance?.now?.()??0){
 if(!context||context.state!=='running')return null;
 const current=Number(context.currentTime);if(!Number.isFinite(current))return null;
 const stamp=context.getOutputTimestamp?.();
 if(stamp?.performanceTime>0&&stamp.contextTime>=0&&now>=stamp.performanceTime&&now-stamp.performanceTime<1000){
  return Math.min(current,stamp.contextTime+(now-stamp.performanceTime)/1000);
 }
 const latency=Math.max(0,Math.min(.5,(Number(context.outputLatency)||0)+(Number(context.baseLatency)||0)));
 return Math.max(0,current-latency);
}

export function createChipVisualEvents(){
 let events=[],last=empty();
 return {
  enqueue(event={},now){
   if(!Number.isFinite(now)||!Number.isFinite(event.time)||event.time<now-.7||event.time>now+2||!(event.gain>0)||event.isCancelled?.())return false;
   // Replanning uses the same score ID. A cancelled lookahead reservation
   // must not swallow the replacement voice before the next paint occurs.
   events=events.filter(row=>!row.isCancelled?.());
   if(event.id&&events.some(row=>row.id===event.id))return false;
   events.push({...event,role:roleFor(event),strength:unit(Math.sqrt(event.gain/.055)),duration:Math.max(.006,Math.min(8,Number(event.duration)||.06))});
   if(events.length>256)events.splice(0,events.length-256);
   return true;
  },
  sample(now,{active=true,reducedMotion=false}={}){
   if(!active||reducedMotion||!Number.isFinite(now)){this.clear();return last;}
   events=events.filter(row=>!row.isCancelled?.()&&now<Math.min(row.time+row.duration,Number(row.getEnd?.()??Infinity))+.28);
   const pulse=empty();let weightedDirection=0,weightedPitch=0,weight=0;
   for(const event of events){
    const age=now-event.time;if(age<0)continue;
    const end=Math.min(event.time+event.duration,Number(event.getEnd?.()??Infinity));
    if(end<=event.time)continue;
    // A short noise hit gets a visible after-image; held notes keep a softer
    // deformation for their real lifetime. Neither creates another onset.
    const shaped=event.adsr?chipAdsrLevel(age,event.duration,event.adsr)*(now<end?1:Math.exp(-(now-end)/.075)):null;
    const attack=event.strength*(shaped??Math.min(1,age/.02))*Math.exp(-age/.13);
    const held=shaped!==null?event.strength*.48*shaped:now<end?event.strength*.48*Math.min(1,age/.035):event.strength*.28*Math.exp(-(now-end)/.075);
    const amount=Math.max(attack,held);
    pulse.attack=Math.max(pulse.attack,attack);pulse.sustain=Math.max(pulse.sustain,held);
    if(Object.hasOwn(pulse,event.role))pulse[event.role]=Math.max(pulse[event.role],amount);
    const direction=Math.sign(Number(event.direction)||0);
    weightedDirection+=direction*amount;weightedPitch+=unit(((Number(event.midi)||60)-36)/60)*amount;weight+=amount;
    pulse.events++;
   }
   if(weight>0){pulse.direction=weightedDirection/weight;pulse.pitch=weightedPitch/weight;}
   last=pulse;return pulse;
  },
  clear(){events=[];last=empty();},
  snapshot(){return {...last,queued:events.length};},
 };
}
