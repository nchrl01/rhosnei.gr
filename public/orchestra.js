const unit=value=>Math.max(0,Math.min(1,Number(value)||0));
export function orchestraTempo(m){
 const cap=Number(m.context?.latestCap);
 if(!Number.isFinite(cap)||cap<=0)return 120;
 if(cap<=10000)return 10;
 if(cap>=10000000)return 200;
 return Math.round(cap<=1000000
  ?10+90*Math.log10(cap/10000)/2
  :100+100*Math.log10(cap/1000000));
}
export const ORCHESTRA_LAYERS=['melody'];
// Envion is the only source. Market activity and volume control its gain.
export function createOrchestraConductor(){
 let ticks=0,lastTime=null,level=0;
 return {
  observe(name,value){if(name==='generation'&&Number.isFinite(value))ticks=Math.max(0,value);},
  update(m,connected,now=performance.now()){
   const activity=unit(m.activity)*(connected?1:unit(m.fresh));
   const target=.9*Math.sqrt(activity*unit(m.volume))*unit(m.fresh);
   const elapsed=lastTime===null?150:Math.max(0,Math.min(1000,now-lastTime));lastTime=now;
   level+=(target-level)*(1-Math.exp(-elapsed/650));
   return {levels:{melody:level},parameters:{},phrase:Math.floor(ticks/32)%4,state:unit(m.fresh)<.1?'SIGNAL FADING':unit(m.pressure)>.65?'INTENSE':activity>.35?'ACTIVE':'SPARSE'};
  },
  reset(){ticks=0;lastTime=null;level=0;},
 };
}
