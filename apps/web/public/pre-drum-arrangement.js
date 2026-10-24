// Recovered pre-GB-drum arrangement from e516f11, 23 October 21:30 Athens.
// Shared production score: original rolled harmony, learned phrasing and bass timing.
import {arpRhythm} from './arp-rhythm.js?v=211';
import {marketPhraseTone} from './market-phrase.js?v=453';
import {pianoHarmony} from './music-context.js?v=208';
import {phraseArrangement,noteExpression} from './phrase-arrangement.js?v=449';
import {learnedMarketMelody} from './learned-market-phrase.js?v=469';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
export const scoreTempo=music=>Math.max(20,Math.min(200,Number(music?.tempo)||100));
const hash=(seed,n)=>{let x=(seed^Math.imul(n+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);return (x^(x>>>13))>>>0;};
// One bar belongs to one context. Market changes affect the next bar, never
// reset its phase. Motif development follows A / A' / B / A'' over eight bars.
export function composePreDrumBar(seed,bar,context,motif=[]){
 const music=context.music||{},cap=Number(context.cap)||0;
 const energy=unit(Math.max(Number(music.intensity)||0,.15+.6*unit(music.activity)));
 const rave=cap>=1e6?unit(.35+(Math.log10(cap)-6)*.3):0;
 const harmonicStep=(context.harmonyStep||0)+Math.floor(bar/2);
 const harmony=pianoHarmony(seed,{chordStep:harmonicStep-seed%4},music);
 const notes=[...harmony.notes].sort((a,b)=>a-b),events=[];
 let expressionIndex=0;
 const push=(beat,midi,duration,gain,kind,details={})=>{
  const expression=noteExpression(seed,bar,expressionIndex++,kind),arrangement=phraseArrangement(seed,bar*4+beat);
  // Score the breathing space, including notes held across a bar boundary.
  // The shared state lets the other layers leave this same short rest open.
  if(arrangement.rest||arrangement.restInBeats<.09)return;
  duration=Math.min(duration*expression.duration,arrangement.restInBeats);
  events.push({beat,midi,duration,gain:gain*arrangement.layers.piano*expression.gain,kind,expression,...details});
 };
 if(context.active===false)return {events,harmony};
 const wet=1-unit((Math.log10(Math.max(1000,cap))-4)/3);
 const chordBeats=rave?[.5,2.5]:[0];
 const chordNotes=notes.slice(0,4),reverse=hash(seed,bar+419)%2===1;
 if(reverse)chordNotes.reverse();
 // Roll the hand by 9–17 ms per tone. Convert to score beats so fast replay
 // retains a modest audible spread, without altering the arpeggio's swing.
 const audibleTempo=Number(context.audibleTempo)||scoreTempo(music);
 const spread=(.009+.008*(hash(seed,bar+420)/4294967296))*audibleTempo/60;
 for(const beat of chordBeats)chordNotes.forEach((pitch,index)=>push(beat+index*spread,pitch,rave?.45:1.5+1.8*wet,.038*(.65+.35*energy)*(.92+.08*index/Math.max(1,chordNotes.length-1)),'chord'));
 const groove=arpRhythm(seed,bar,music,cap);
 // Build a palette inside the actual instrument register before choosing
 // contour positions. Later octave folding cannot undo the market direction.
 const low=context.pitchLow??60,high=context.pitchHigh??88;
 const classes=new Set(notes.map(n=>((n%12)+12)%12));
 const palette=Array.from({length:Math.max(1,high-low+1)},(_,i)=>low+i).filter(n=>classes.has(n%12));
 const width=Math.min(palette.length,groove.span);
 const offset=hash(seed,Math.floor(bar/4)+97)%Math.max(1,palette.length-width+1);
 const pitches=palette.slice(offset,offset+width);
 const down=music.group==='down';
 const learnedAmount=context.phraseLearning==null?1:unit(context.phraseLearning);
 if(context.arpeggios!==false&&pitches.length&&learnedAmount>0){
  const melody=learnedMarketMelody(seed,bar,{...context,music,harmony,groove,phraseLearning:learnedAmount});
  for(const event of melody)push(event.beat,event.midi,event.duration,.06*(.65+.35*energy)*event.accent,'arp',{allowedPitches:event.allowedPitches});
 }else if(context.arpeggios!==false&&pitches.length)groove.events.forEach((event,i)=>{
  const phrase=marketPhraseTone(seed,bar*4+event.beat,i,groove.events.length,context);
  const motifTurn=motif.length?(motif[i%motif.length][1]-66)/48:0;
  const position=unit(phrase.position+motifTurn*Math.sin(Math.PI*i/Math.max(1,groove.events.length-1)));
  const index=Math.round((down?1-position:position)*(pitches.length-1));
  push(event.beat,pitches[index],event.duration*phrase.duration,.06*(.65+.35*energy)*event.accent*phrase.accent,'arp',{allowedPitches:palette});
 });
 // Kraken is always the bass voice, never a coin's lead. Root/fifth/octave
// movement follows this bar's chord, with a cadence every fourth bar.
 const rootClass=((harmony.root+chordRoot(music,harmony.index))%12+12)%12;
 const bassRoot=28+((rootClass-28%12+12)%12);
 const bassBeats=rave?[0,.75,1.5,2,2.75,3.5]:[0,2.5];
 bassBeats.forEach((beat,i)=>{
  const octave=rave&&i%3===2?12:0,fifth=i===bassBeats.length-1&&bar%4!==3?chordFifth(music,harmony.index):0;
  push(beat,bassRoot+octave+fifth,rave?.42:1.3,.085*(.7+.3*energy),'bass');
 });
 const landmark=music.movement?.event;
 if(context.arpeggios!==false&&landmark&&context.landmarkBar===bar){
  const tones=[notes[0]+12,notes[1]+12,notes.at(-1)+12,notes[0]+24];
  if(landmark.direction<0)tones.reverse();
  for(let i=0;i<4;i++)push(i*.5,tones[i],.35,.08,'arp',{allowedPitches:palette,landmark:true});
 }
 // Keep one audible lead line. Landmark accents replace coincident attacks;
 // their pitches still pass through the same final originality guard.
 const lead=new Map();
 for(const event of events.filter(e=>e.kind==='arp').sort((a,b)=>a.beat-b.beat))lead.set(event.beat,event);
 const melody=[...lead.values()];
 melody.forEach((event,i)=>{event.duration=Math.min(event.duration,(melody[i+1]?.beat??4)-event.beat);});
 return {events:[...events.filter(e=>e.kind!=='arp'),...melody.filter(e=>e.duration>=.025)].sort((a,b)=>a.beat-b.beat),harmony,groove:learnedAmount>0?'Learned MIDI phrasing':groove.name};
}
import {chartHarmony} from './harmonic-characters.js?v=208';
function chordFifth(music,index){const chord=chartHarmony(music.character||'serene',music).chords[index];return ((chord[2]??chord[0]+7)-chord[0]+12)%12;}
function chordRoot(music,index){return chartHarmony(music.character||'serene',music).chords[index][0];}

