import {pianoHarmony,HARMONIES} from './music-context.js?v=177';
// Small timing/velocity differences are stable for a coin and phrase, so replay
// has a human contour without drawing fresh random notes on each listen.
export function pianoNuance(seed,step){
 let value=(seed^Math.imul(step+1,2654435761))>>>0;
 const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
 return {delay:.012+random()*.016,velocity:.94+random()*.12,attack:.014+random()*.012,duration:.9+random()*.2};
}
export function createPianoPhrasing(seed=0){
 seed=Number(seed)>>>0;
 let step=0,previous=null,repeats=0,character='serene',harmonyStep=null,heldHarmony=null;
 return {
  reset(value=seed){seed=Number(value)>>>0;step=0;previous=null;repeats=0;character='serene';harmonyStep=null;heldHarmony=null;},
  next(event={},music={},{quiet=false,changePct=0,advanceHarmony=!quiet}={}){
   // Price selection owns the harmonic clock. Activity can articulate the
   // current chord repeatedly without changing its character or voicing.
   // Direct lab auditions have no selection step: each movement advances it.
   const selectedStep=Number.isFinite(event.harmonyStep)?Math.max(0,Math.floor(event.harmonyStep)):
    harmonyStep===null?0:harmonyStep+(advanceHarmony&&!quiet?1:0);
   const root=Number.isFinite(music.tonic)?48+((Math.round(music.tonic)%12)+12)%12:48+(seed>>>0)%5;
   if(!heldHarmony||selectedStep!==harmonyStep){
    harmonyStep=selectedStep;
    const requested=Object.hasOwn(HARMONIES,event.harmonyCharacter)?event.harmonyCharacter:music.character;
    character=Object.hasOwn(HARMONIES,requested)?requested:'serene';
    // harmonyStep zero is the first chord for both live playback and seeks.
    heldHarmony=pianoHarmony(seed,{...event,chordStep:harmonyStep-seed%4},{...music,character});
   }else if(heldHarmony.root!==root){
    // A deliberate lab key change retunes the same chord without advancing it.
    heldHarmony=pianoHarmony(seed,{...event,chordStep:harmonyStep-seed%4},{...music,character});
    previous=null;repeats=0;
   }
   const harmony=heldHarmony;
   // Frozen candles use their score position for repeatable melodic nuance,
   // independently of how many activity notes were played before a seek.
   if(event.historical){step=Number.isFinite(event.chordStep)?Math.max(0,Math.floor(event.chordStep)):0;previous=null;repeats=0;}
   const candidates=[...new Set(harmony.notes.flatMap(note=>[note-12,note,note+12]).filter(note=>note>=45&&note<=67))];
   const target=previous??(52+seed%5),direction=quiet?0:Math.sign(changePct);
   const cost=note=>Math.abs(note-target)*1.2+Math.abs(note-54)*.12
    +(previous!==null&&Math.abs(note-previous)>7?5:0)
    +(previous===note&&repeats>=2?9:0)
    +(previous!==null&&direction&&Math.sign(note-previous)===-direction?.5:0);
   const midi=candidates.reduce((a,b)=>cost(a)<=cost(b)?a:b);
   repeats=midi===previous?repeats+1:0;previous=midi;
   const nuance=pianoNuance(seed,step);
   return {midi,harmony,...nuance,harmonyStep,step:step++};
  },
 };
}
