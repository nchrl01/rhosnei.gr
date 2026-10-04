// Original additive patterns: fixed pulse, displaced entries, then subtraction.
// Pitches arrive from the current harmony; no notes from the reference score.
export function pianoArticulation(cap){
 return Math.max(0,Math.min(1,(Math.log10(Math.max(1,Number(cap)||1))-5)/2));
}
export function interlockPitch(event,harmony){
 const root=harmony.root??48,minor=['tense','restless'].includes(harmony.character);
 const scale=(minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11]).map(n=>(n+root)%12);
 const chord=[...new Set(harmony.notes.map(n=>n%12))];
 for(const pc of chord)if(!scale.includes(pc)){
  const distance=n=>Math.min((n-pc+12)%12,(pc-n+12)%12);
  let i=0;for(let j=1;j<scale.length;j++)if(distance(scale[j])<distance(scale[i]))i=j;
  scale[i]=pc;
 }
 const pcs=event.chordTone?chord:scale;
 const pool=Array.from({length:37},(_,i)=>45+i).filter(n=>pcs.includes(n%12));
 const target=event.target+(root%12-6)*.35;
 const centre=pool.reduce((best,n,i)=>Math.abs(n-target)<Math.abs(pool[best]-target)?i:best,0);
 return pool[Math.max(0,Math.min(pool.length-1,centre+event.degree))];
}
export function interlockingPiano(seed,cap,intensity,harmony){
 const amount=pianoArticulation(cap);
 if(amount<=0||intensity<.04||!harmony?.notes?.length)return [];
 const cycles=4+Math.floor(amount*2),parts=amount>=.7?3:amount>=.3?2:1;
 const motif=[0,1,2,4,5,7],rotation=(seed>>>0)%8,events=[];
 for(let cycle=0;cycle<cycles;cycle++){
  for(let part=0;part<parts;part++){
   const available=part===0?motif.length:Math.min(motif.length,Math.max(0,(cycle-part+1)*2));
   const count=cycle===cycles-1?Math.ceil(available/2):available;
   for(let n=0;n<count;n++){
    if(part>0&&n/motif.length>Math.max(.25,intensity))continue;
    const tick=cycle*8+(motif[n]+rotation+part*2)%8;
    const hash=(Math.imul((seed^tick^part)>>>0,2654435761)>>>0)/4294967296;
    const foreground=cycle%parts===part;
    const event={tick,part,degree:((n*2+part+seed)%5)-2,
     target:53+part*5+Math.round(amount*4),chordTone:n%3!==1,
     duration:.22+hash*.16,gain:(foreground?.082:.059)*(.9+hash*.2)/Math.sqrt(parts)};
    event.midi=interlockPitch(event,harmony);events.push(event);
    if(part===0&&amount>=.3&&n%3===0){
     const upper={...event,degree:event.degree+2,chordTone:true,gain:event.gain*.72};
     upper.midi=interlockPitch(upper,harmony);if(upper.midi!==event.midi)events.push(upper);
    }
   }
  }
 }
 return events.sort((a,b)=>a.tick-b.tick||a.part-b.part);
}
