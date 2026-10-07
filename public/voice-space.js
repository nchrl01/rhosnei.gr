// A warm stereo hall, after the generated voice and before listening volume.
export function createVoiceReverb(ctx,destination){
 const input=ctx.createGain(),filter=ctx.createBiquadFilter(),dry=ctx.createGain(),predelay=ctx.createDelay(.2),room=ctx.createConvolver(),tone=ctx.createBiquadFilter(),wet=ctx.createGain();
 filter.type='lowpass';filter.frequency.value=5200;
 dry.gain.value=.9;predelay.delayTime.value=.032;
 tone.type='lowpass';tone.frequency.value=3400;wet.gain.value=.38;
 const seconds=4.8,impulse=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*seconds),ctx.sampleRate);
 for(let channel=0;channel<2;channel++){
  const data=impulse.getChannelData(channel);let random=1917+channel*731,smooth=0;
  for(let i=0;i<data.length;i++){
   random=(Math.imul(random,1664525)+1013904223)>>>0;
   smooth=.72*smooth+.28*(random/2147483648-1);
   const time=i/ctx.sampleRate,attack=Math.min(1,time/.035);
   data[i]=smooth*attack*Math.exp(-time*1.45);
  }
 }
 room.buffer=impulse;
 input.connect(filter);filter.connect(dry);dry.connect(destination);
 filter.connect(predelay);predelay.connect(room);room.connect(tone);tone.connect(wet);wet.connect(destination);
 return {input,configure(options={}){for(const [key,param,min,max] of [['dry',dry.gain,0,1.5],['wet',wet.gain,0,1.5],['predelay',predelay.delayTime,0,.2],['cutoff',filter.frequency,500,12000],['tone',tone.frequency,500,12000]]){const value=Number(options[key]);if(Number.isFinite(value))param.setTargetAtTime(Math.max(min,Math.min(max,value)),ctx.currentTime,.05);}},clear(){room.buffer=null;room.buffer=impulse;},close(){for(const node of [input,filter,dry,predelay,room,tone,wet])node.disconnect();}};
}
