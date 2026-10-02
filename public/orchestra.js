const unit=value=>Math.max(0,Math.min(1,Number(value)||0));
// Informational trade cadence; the piano is triggered by events, not this clock.
export function orchestraTempo(m){return Math.round(Math.max(0,Number(m.tradeRate)||0)*60);}
export const ORCHESTRA_LAYERS=['melody'];
export const ORCHESTRA_BUNDLES={envion:['melody']};
export function createOrchestraConductor(){
 let ticks=0,lastTime=null,level=0,enabled=false;
 return {
  observe(name,value){if(name==='generation'&&Number.isFinite(value))ticks=Math.max(0,value);},
  setBundle(name,value){if(name==='envion')enabled=Boolean(value);},
  update(m,connected,now=performance.now()){
   const activity=unit(m.activity)*(connected?1:unit(m.fresh));
   const target=enabled?.9*Math.sqrt(activity*unit(m.volume))*unit(m.fresh):0;
   const elapsed=lastTime===null?150:Math.max(0,Math.min(1000,now-lastTime));lastTime=now;
   level+=(target-level)*(1-Math.exp(-elapsed/650));
   return {levels:{melody:level},parameters:{},phrase:Math.floor(ticks/32)%4,state:unit(m.fresh)<.1?'SIGNAL FADING':unit(m.pressure)>.65?'INTENSE':activity>.35?'ACTIVE':'SPARSE'};
  },
  reset(){ticks=0;lastTime=null;level=0;},
 };
}
