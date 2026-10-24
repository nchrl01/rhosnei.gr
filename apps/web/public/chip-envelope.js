const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const value=(x,f)=>Number.isFinite(x)?x:f;
// Shared by register compilation and the EarthBound sound envelope. Seconds
// are compressed together when the complete scored gate is shorter than ADR.
export function chipAdsr(adsr,duration){
 let attack=clamp(value(adsr.attack,.015),.002,.3),decay=clamp(value(adsr.decay,.08),.004,.6),release=clamp(value(adsr.release,.12),.008,.8);
 const scale=Math.min(1,duration*.85/(attack+decay+release));attack*=scale;decay*=scale;release*=scale;
 return {attack,decay,release,sustain:clamp(value(adsr.sustain,.7),.15,1),releaseAt:duration-release};
}
export function chipAdsrLevel(age,duration,adsr){
 if(age<0||age>=duration)return 0;
 const p=chipAdsr(adsr,duration);
 if(age<p.attack)return age/p.attack;
 if(age<p.attack+p.decay)return 1-(1-p.sustain)*(age-p.attack)/p.decay;
 if(age<p.releaseAt)return p.sustain;
 return p.sustain*Math.max(0,1-(age-p.releaseAt)/p.release);
}
