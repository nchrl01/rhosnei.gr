// Original additive patterns: fixed pulse, displaced entries, then subtraction.
// Pitches arrive from the current harmony; no notes from the reference score.
export function pianoArticulation(cap){
 return Math.max(0,Math.min(1,(Math.log10(Math.max(1,Number(cap)||1))-5)/2));
}
export function interlockingPiano(seed,cap,intensity,harmony){
 const amount=pianoArticulation(cap);
 if(amount<=0||intensity<.04||!harmony?.length)return [];
 const cycles=4+Math.floor(amount*4),parts=1+Math.floor(amount*2);
 const motif=[0,2,3,6,8,11,13],rotation=(seed>>>0)%16,events=[];
 for(let cycle=0;cycle<cycles;cycle++){
  for(let part=0;part<parts;part++){
   const available=part===0?motif.length:Math.min(motif.length,Math.max(0,(cycle-part+1)*2));
   const count=cycle===cycles-1?Math.ceil(available/2):available;
   for(let n=0;n<count;n++){
    if(part>0&&n/motif.length>intensity)continue;
    const tick=cycle*16+(motif[n]+rotation+part*2)%16;
    const raw=harmony[(n+part+seed)%harmony.length]+(part===2?12:0);
    const midi=raw<48?raw+12:raw>81?raw-12:raw;
    events.push({tick,midi,gain:(.10+amount*.025)/(1+part*.5),part});
   }
  }
 }
 return events.sort((a,b)=>a.tick-b.tick||a.part-b.part);
}
