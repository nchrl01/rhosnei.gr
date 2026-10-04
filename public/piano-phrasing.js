import {pianoHarmony,HARMONIES} from './music-context.js?v=123';
// Small timing/velocity differences are stable for a coin and phrase, so replay
// has a human contour without drawing fresh random notes on each listen.
export function pianoNuance(seed,step){
 let value=(seed^Math.imul(step+1,2654435761))>>>0;
 const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
 return {delay:.012+random()*.016,velocity:.94+random()*.12,attack:.014+random()*.012,duration:.9+random()*.2};
}
export function createPianoPhrasing(seed=0){
 let step=0,previous=null,repeats=0,character='serene';
 return {
  reset(value=seed){seed=value>>>0;step=0;previous=null;repeats=0;character='serene';},
  next(event,music,{quiet=false,changePct=0}={}){
   // Complete a four-note harmonic arc before choosing its next character.
   // Clock buckets no longer skip unheard stages of the progression.
   if(step%4===0)character=HARMONIES[music.character]?music.character:'serene';
   const harmony=pianoHarmony(seed,{...event,chordStep:step-(seed%4)},{...music,character});
   const candidates=[...new Set(harmony.notes.flatMap(note=>[note-12,note,note+12]).filter(note=>note>=45&&note<=67))];
   const target=previous??(52+seed%5),direction=quiet?0:Math.sign(changePct);
   const cost=note=>Math.abs(note-target)*1.2+Math.abs(note-54)*.12
    +(previous!==null&&Math.abs(note-previous)>7?5:0)
    +(previous===note&&repeats>=2?9:0)
    +(previous!==null&&direction&&Math.sign(note-previous)===-direction?.5:0);
   const midi=candidates.reduce((a,b)=>cost(a)<=cost(b)?a:b);
   repeats=midi===previous?repeats+1:0;previous=midi;
   const nuance=pianoNuance(seed,step);
   return {midi,harmony,...nuance,step:step++};
  },
 };
}
