// Temporary whole-mix resampling. Normal playback has no added delay or processing.
class VinylTransport extends AudioWorkletProcessor {
 constructor(){
  super();this.length=Math.ceil(sampleRate*3);this.buffers=[new Float32Array(this.length),new Float32Array(this.length)];
  this.write=0;this.read=0;this.mode='off';this.frame=0;this.speed=0;this.level=0;this.serial=0;
  this.port.onmessage=({data})=>{
   if(data.type!=='play'&&data.type!=='pause')return;
   if(this.mode==='off'||this.mode==='on')this.read=this.write;
   this.fromSpeed=this.speed;this.fromLevel=this.level;this.frame=0;this.serial=data.serial;
   this.mode=data.type;this.duration=Math.round(sampleRate*(data.type==='play'?.48:.82));
  };
 }
 process(inputs,outputs){
  const input=inputs[0],output=outputs[0];
  for(let i=0;i<output[0].length;i++){
   for(let c=0;c<2;c++)this.buffers[c][this.write]=input[c]?.[i]??input[0]?.[i]??0;
   let blend=0;
   if(this.mode==='play'||this.mode==='pause'){
    const t=Math.min(1,this.frame/this.duration);
    if(this.mode==='play'){
     this.speed=this.fromSpeed+(1-this.fromSpeed)*(1-(1-t)**3);
     this.level=this.fromLevel+(1-this.fromLevel)*Math.min(1,t/.15);
    }else{
     this.speed=this.fromSpeed*(1-t)**2;
     this.level=this.fromLevel*(1-Math.max(0,(t-.72)/.28))**2;
    }
   }else if(this.mode==='catchup')blend=Math.min(1,this.frame/(sampleRate*.09));
   const index=Math.floor(this.read),fraction=this.read-index;
   for(let c=0;c<output.length;c++){
    const buffer=this.buffers[Math.min(c,1)],direct=input[c]?.[i]??input[0]?.[i]??0;
    const shifted=buffer[index]*(1-fraction)+buffer[(index+1)%this.length]*fraction;
    output[c][i]=this.mode==='on'?direct:this.mode==='off'?0:(shifted*(1-blend)+direct*blend)*this.level;
   }
   this.read=(this.read+this.speed)%this.length;this.write=(this.write+1)%this.length;this.frame++;
   if(this.mode==='pause'&&this.frame>=this.duration){this.mode='off';this.level=0;this.speed=0;this.port.postMessage({type:'stopped',serial:this.serial});}
   else if(this.mode==='play'&&this.frame>=this.duration){this.mode='catchup';this.speed=1;this.level=1;this.frame=0;}
   else if(this.mode==='catchup'&&blend>=1){this.mode='on';this.read=this.write;}
  }
  return true;
 }
}
registerProcessor('upic-vinyl',VinylTransport);
