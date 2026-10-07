// A coverage-triggered stack. New ink dissolves before the field beneath it.
export function withPixelGenerations(renderer,parametersFor){
 let layers=[],born=null,lastProbe=-Infinity,lastTime=null;
 const unit=x=>Math.max(0,Math.min(1,x));
 const reset=()=>{layers=[];born=null;lastProbe=-Infinity;lastTime=null;};
 return {...renderer,
  reset(seed){reset();renderer.reset(seed);},
  clear(){reset();renderer.clear();},
  render(args={}){
   const params=args.parameters||parametersFor(args),now=Number(args.eventTime)||0;
   if(lastTime!==null&&now<lastTime)reset();lastTime=now;
   const presence=unit(params.pixelPresence??1);
   if(!presence){reset();renderer.clear();return;}
   const ramp=born===null?1:unit((now-born)/8);
   const current={...params,dotSize:layers.length?.5+(params.dotSize-.5)*ramp:params.dotSize,inkColor:layers.length%2?0:1};
   const depth=layers.length+1;
   current.pixelPresence=unit(presence*depth-layers.length);
   // Probe only a fully audible, non-image field, at most twice per second.
   if(presence>.98&&params.identity<.05&&ramp>.98&&now-lastProbe>.5){
    lastProbe=now;
    renderer.render({...args,parameters:current,preserve:false});
    const coverage=renderer.coverage();
    const extent=Math.max(0,params.capitalStage??0)+Math.log2(1+params.dotSize);
    const previous=layers.at(-1);
    // Further generations require further market/audio expansion, not time alone.
    if(coverage>=.9&&(!previous||extent>=previous.extent+.5)){
     layers.push({extent,parameters:{...current,pixelPresence:1,identity:0,frozen:true},time:args.time,liquidTime:args.liquidTime});
     born=now;
     current.dotSize=.5;current.pixelPresence=0;current.inkColor=layers.length%2?0:1;
    }
   }
   const count=layers.length+1;
   layers.forEach((layer,index)=>renderer.render({...args,...layer,preserve:index>0,parameters:{...layer.parameters,pixelPresence:unit(presence*count-index)}}));
   current.pixelPresence=unit(presence*count-layers.length)*(born===null?1:unit((now-born)/2));
   renderer.render({...args,preserve:layers.length>0,parameters:current});
  },
 };
}
