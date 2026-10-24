const hash=(seed,index)=>{let x=((seed>>>0)^Math.imul(index+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);return (x^(x>>>13))>>>0;};
const mod=(n,d)=>((n%d)+d)%d;
// Register is a phrase-level choice. It changes neither packet timing nor
// intervals inside a motif. The original four-channel allocator still owns
// every interruption. Noise packets and pitched percussion never enter here.
export function fridayOctavePitch(midi,{seed=0,bar=0,kind='arp',deep=false}={}){
 if(!Number.isFinite(midi)||!['arp','chord','bass'].includes(kind))return midi;
 if(deep){
  // Pulse floors at ~64 Hz; wave floors at ~32 Hz. Fold by octaves
  // inside those limits instead of letting frequency-register clamping
  // flatten several low notes into the same tone.
  const low=kind==='bass'?24:36,high=kind==='bass'?35:47;
  let pitch=midi-(kind==='bass'?24:36);
  while(pitch<low)pitch+=12;
  while(pitch>high)pitch-=12;
  return pitch;
 }
 const curves={arp:[0,12,0,-12,0,12,0,-12],chord:[0,-12,0,12,0,0,12,-12],bass:[0,0,-12,0,0,0,-12,0]};
 const curve=curves[kind],offset=hash(seed,kind==='arp'?801:kind==='chord'?802:803)%curve.length;
 const requested=curve[mod(bar+offset,curve.length)];
 const low=kind==='bass'?28:kind==='chord'?36:40,high=kind==='bass'?60:kind==='chord'?84:88;
 // Select a legal octave instead of clamping the pitch to a new note class.
 for(const shift of [...new Set([requested,0,requested-12,requested+12,-12,12])]){
  if(midi+shift>=low&&midi+shift<=high)return midi+shift;
 }
 return midi;
}
