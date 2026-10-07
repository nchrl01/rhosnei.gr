// A coverage-triggered stack. New ink dissolves before the field beneath it.
export function withPixelGenerations(renderer,parametersFor){
 let layers=[],born=null,lastProbe=-Infinity,lastTime=null,referencePresence=1;
 const unit=x=>Math.max(0,Math.min(1,x));
 const reset=()=>{layers=[];born=null;lastProbe=-Infinity;lastTime=null;referencePresence=1;};
 return {...renderer,
  reset(seed){reset();renderer.reset(seed);},
  clear(){reset();renderer.clear();},
  render(args={}){
   const params=args.parameters||parametersFor(args),now=Number(args.eventTime)||0;
   if(lastTime!==null&&now<lastTime)reset();lastTime=now;
   const presence=unit(params.pixelPresence??1),whiteInk=unit(params.inkColor??1);
   if(!presence){reset();renderer.clear();return;}
   const ramp=born===null?1:unit((now-born)/8);
   const current={...params,capitalStage:layers.length?Math.max(0,params.capitalStage??0)*ramp:params.capitalStage,dotSize:layers.length?.5+(params.dotSize-.5)*ramp:params.dotSize,inkColor:layers.length%2?0:whiteInk};
   const fade=layers.length?unit(presence/referencePresence):1;
   const depth=layers.length+1;
   current.pixelPresence=presence*unit(fade*depth-layers.length);
   // Coverage itself is the threshold, regardless of the audio meter level.
   if(presence>.001&&(params.identity??0)<.05&&ramp>.98&&now-lastProbe>.5){
    lastProbe=now;
    renderer.render({...args,parameters:current,preserve:false});
    const coverage=renderer.coverage();
    const extent=Math.max(0,params.capitalStage??0)+Math.log2(1+params.dotSize);
    if(coverage>=.9){
     if(!layers.length)referencePresence=presence;
     layers.push({extent,parameters:{...current,pixelPresence:current.pixelPresence,identity:0,frozen:true},time:args.time,liquidTime:args.liquidTime});
     born=now;
     current.dotSize=.5;current.pixelPresence=0;current.inkColor=layers.length%2?0:whiteInk;
    }
   }
   const count=layers.length+1,identity=unit(params.identity??0);
   layers.forEach((layer,index)=>renderer.render({...args,...layer,preserve:index>0,parameters:{...layer.parameters,inkColor:index%2?0:whiteInk,pixelPresence:layer.parameters.pixelPresence*unit(unit(presence/referencePresence)*count-index)*(1-identity)}}));
   current.pixelPresence=presence*unit(unit(presence/referencePresence)*count-layers.length)*(born===null?1:unit((now-born)/2));
   // Old saturation layers shrink away as the coin forms; its ink remains
   // readable even when the previous generation used black marks.
   current.pixelPresence=current.pixelPresence*(1-identity)+presence*identity;
   current.inkColor=current.inkColor*(1-identity)+whiteInk*identity;
   renderer.render({...args,preserve:layers.length>0,parameters:current});
  },
 };
}
