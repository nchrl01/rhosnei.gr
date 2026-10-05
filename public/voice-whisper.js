// A deterministic noise vocoder removes most periodic excitation while keeping
// the speech's changing spectral envelope. A small consonant path aids clarity.
function bandpass(rate,frequency,q){
 const omega=2*Math.PI*frequency/rate,alpha=Math.sin(omega)/(2*q),a0=1+alpha;
 const b0=alpha/a0,a1=-2*Math.cos(omega)/a0,a2=(1-alpha)/a0;
 let x1=0,x2=0,y1=0,y2=0;
 return x=>{const y=b0*(x-x2)-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
export function whisperVoice(samples,rate){
 const length=samples.length,air=new Float32Array(length),result=new Float32Array(length);
 let random=7193;
 for(let i=0;i<length;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;air[i]=random/2147483648-1;}
 const attack=1-Math.exp(-1/(rate*.003)),release=1-Math.exp(-1/(rate*.016)),rmsRate=1-Math.exp(-1/(rate*.03));
 for(let frequency=180;frequency<Math.min(7500,rate*.44);frequency*=1.24){
  const speech=bandpass(rate,frequency,3.4),carrier=bandpass(rate,frequency,3.4);
  let envelope=0,power=.01;
  for(let i=0;i<length;i++){
   const signal=speech(Number.isFinite(samples[i])?samples[i]:0),noise=carrier(air[i]);
   const target=Math.abs(signal);envelope+=(target-envelope)*(target>envelope?attack:release);
   power+=(noise*noise-power)*rmsRate;
   result[i]+=envelope*noise/Math.sqrt(Math.max(.0001,power))*.8;
  }
 }
 // Retain a little original articulation above 300 Hz, without a bassy voice.
 const highpass=Math.exp(-2*Math.PI*300/rate);let previous=0,last=0,peak=0;
 for(let i=0;i<length;i++){
  const value=Number.isFinite(samples[i])?samples[i]:0;
  last=highpass*(last+value-previous);previous=value;
  const edge=Math.min(1,i/(rate*.015),(length-1-i)/(rate*.025));
  result[i]=(result[i]*.6+last*.4)*Math.max(0,edge);
  peak=Math.max(peak,Math.abs(result[i]));
 }
 const trim=peak>0?.16/peak:1;
 for(let i=0;i<length;i++)result[i]*=trim;
 return result;
}
