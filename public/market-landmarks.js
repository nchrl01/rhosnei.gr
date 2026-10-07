// Relative market-cap landmarks. The reference advances by exact 20% steps,
// preserving overshoot; a jump across several steps produces one bounded cue.
export function createMarketLandmarks(){
 let key=null,anchor=null,previous=null,group='up',serial=0,event=null,movement=0;
 return {
  observe(value,at=Date.now(),identity='market'){
   if(identity!==key){key=identity;anchor=null;previous=null;group='up';serial=0;event=null;movement=0;}
   const cap=Number(value);
   if(!(cap>0&&Number.isFinite(cap)))return {group,changePct:0,progress:0,available:false,event:null};
   anchor??=cap;
   if(previous!=null&&cap!==previous)group=cap>previous?'up':'down';
   previous=cap;movement=(cap/anchor-1)*100;
   let direction=movement>=20-1e-8?1:movement<=-20+1e-8?-1:0;
   if(direction){
    const count=Math.max(1,Math.floor(Math.log(cap/anchor)/Math.log(direction>0?1.2:.8)+1e-8));
    const from=anchor;anchor*=Math.pow(direction>0?1.2:.8,count);group=direction>0?'up':'down';
    event={id:identity+':'+(++serial),at,direction,count,from,to:cap,changePct:movement};
   }
   return {group,changePct:movement,progress:Math.min(1,Math.abs(movement)/20),referenceCap:anchor,available:true,event};
  }
 };
}
