const unit=value=>Math.max(0,Math.min(1,Number(value)||0));

// Phrase-addressed envelopes, in seconds. The chip compiler and EarthBound
// compress these same phases to fit the actual voice gate and shared rests.
export function chipVoiceEnvelope(role,{variation=.5,liquidity=.5,activity=0,tension=0,phrase=0}={}){
 const v=unit(variation),depth=unit(liquidity),drive=unit(activity),strain=unit(tension);
 const swell=(phrase%4===2||phrase%4===3)&&v>.48;
 if(role==='chord')return {
  attack:swell?.065+.15*v:.012+.045*v,
  decay:.07+.25*(1-drive)*v,
  sustain:unit(.45+.36*depth+.1*v-.12*strain),
  release:.14+.32*depth*(.45+.55*v),
 };
 if(role==='bass')return {
  attack:.004+.028*v,decay:.045+.17*(1-v),
  sustain:.42+.38*depth,release:.065+.17*depth+.05*v,
 };
 if(role==='drone')return {
  attack:.09+.19*v,decay:.14+.31*(1-v),
  sustain:.52+.35*depth,release:.26+.38*depth,
 };
 if(role==='echo'||role==='texture')return {
  attack:.004+.026*v,decay:.025+.09*(1-v),
  sustain:.18+.26*depth*v,release:.035+.14*v,
 };
 return {
  attack:swell?.028+.055*v:.003+.024*v,
  decay:.025+.14*(1-v),
  sustain:.26+.42*depth+.12*v,
  release:.045+.18*v*(1-.45*drive),
 };
}

// Resonance is a harmonic peak written into 32-sample GB wave RAM, not a
// broadband filter/reverb added after the chip. Every table is DC-centred,
// peak bounded and quantized to legal four-bit samples before playback.
export function resonantChipWave({resonance=0,harmonic=3,phase=0,grit=0}={}){
 const r=unit(resonance),h=Math.max(2,Math.min(7,Math.round(harmonic))),g=unit(grit);
 const raw=Array.from({length:32},(_,i)=>{
  const p=i*Math.PI/16;
  return Math.sin(p)+r*(.65*Math.sin(h*p+phase)+.15*Math.sin((h-1)*p-phase))+
   .12*g*Math.sin((h+2)*p+phase*.5);
 });
 const mean=raw.reduce((sum,x)=>sum+x,0)/32;
 const peak=Math.max(...raw.map(x=>Math.abs(x-mean)))||1;
 const levels=g>.65?4:g>.3?8:16;
 return raw.map(x=>Math.round(Math.round(unit(.5+.47*(x-mean)/peak)*(levels-1))*15/(levels-1)));
}
