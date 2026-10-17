export async function createVinylTransport(context){
 let node,serial=0,finish=null,timer;
 try{
  await context.audioWorklet.addModule(new URL('./vinyl-worklet.js?v=215',import.meta.url));
  node=new AudioWorkletNode(context,'upic-vinyl',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
  node.port.onmessage=({data})=>{if(data.type==='stopped'&&data.serial===serial){const callback=finish;finish=null;callback?.();}};
 }catch(error){
  // Audio remains usable on browsers without worklet support.
  console.warn('Vinyl transport unavailable; using a short volume ramp.',error);
  node=context.createGain();node.gain.value=0;
 }
 function move(type,callback){
  serial++;clearTimeout(timer);finish=callback||null;
  if(node.port)node.port.postMessage({type,serial});
  else{
   const now=context.currentTime,param=node.gain;
   if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);
   else{const value=param.value;param.cancelScheduledValues(now);param.setValueAtTime(value,now);}
   param.linearRampToValueAtTime(type==='play'?1:0,now+.2);
   if(callback)timer=setTimeout(()=>{finish=null;callback();},220);
  }
 }
 return {node,play(){move('play');},pause(callback){move('pause',callback);},close(){serial++;finish=null;clearTimeout(timer);if(node.port){node.port.onmessage=null;node.port.close();}node.disconnect();}};
}
