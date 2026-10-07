import {HARMONIES,resolveHarmonicCharacter} from './harmonic-characters.js?v=208';
// Authored probability network inspired by GrundTon's knot/event architecture.
// No upstream patch code is embedded. One step is consumed per audible note.
export function createHarmonicNetwork(initialSeed=0){
 let seed=initialSeed>>>0,index=0,step=0;
 return {
  reset(value=seed){seed=value>>>0;index=0;step=0;},
  next(music={},quiet=false){
   if(step++===0||quiet)return index;
   const intensity=Math.max(0,Math.min(1,Number(music.intensity)||0));
   const next=(index+1)%4;
   // Keep the functional progression; active markets vary the dwell time.
   const weights=[.65-intensity*.35,1.35+intensity*.7];
   let state=(seed^Math.imul(step,2654435761))>>>0;
   state=(Math.imul(state,1664525)+1013904223)>>>0;
   if(state/4294967296*(weights[0]+weights[1])>=weights[0])index=next;
   return index;
  },
 };
}
export function harmoniousPitch(value,tonic=48,character='serene',chordNotes=[]){
 const intervals=HARMONIES[resolveHarmonicCharacter(character)].mode==='Minor'?[0,3,5,7,10]:[0,2,4,7,9];
 const pcs=chordNotes.length?[...new Set(chordNotes.map(n=>((Math.round(n)%12)+12)%12))]:intervals.map(n=>((Math.round(tonic)+n)%12+12)%12);
 let best=Math.round(value),distance=Infinity;
 for(let note=Math.max(24,Math.floor(value)-12);note<=Math.min(96,Math.ceil(value)+12);note++){
  if(pcs.includes(note%12)&&Math.abs(note-value)<distance){best=note;distance=Math.abs(note-value);}
 }
 return best;
}
