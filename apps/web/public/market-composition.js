import {arpRhythm} from './arp-rhythm.js?v=211';
import {marketPhraseTone} from './market-phrase.js?v=453';
import {pianoHarmony} from './music-context.js?v=208';
import {phraseArrangement,noteExpression} from './phrase-arrangement.js?v=449';
import {learnedMarketMelody} from './learned-market-phrase.js?v=455';
import {phraseDevelopment,developPhraseEvents} from './phrase-development.js?v=464';
import {composeGameBoyDrumBar} from './gameboy-drum-pattern.js?v=470';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
export const scoreTempo=music=>Math.max(20,Math.min(200,Number(music?.tempo)||100));
const hash=(seed,n)=>{let x=(seed^Math.imul(n+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);return (x^(x>>>13))>>>0;};
// One bar belongs to one context. Market changes affect the next bar, never
// reset its phase. A remembered two-bar idea is introduced, answered,
// varied, then recalled. The shared rests delimit the answer and return.
export function composeMarketBar(seed,bar,context,motif=[]){
 const music=context.music||{},cap=Number(context.cap)||0;
 const development=phraseDevelopment(seed,bar,context);
 const energy=unit(Math.max(Number(music.intensity)||0,.15+.6*unit(music.activity)));
 const rave=cap>=1e6?unit(.35+(Math.log10(cap)-6)*.3):0;
 const harmonicStep=(context.harmonyStep||0)+Math.floor(bar/2);
 const harmony=pianoHarmony(seed,{chordStep:harmonicStep-seed%4},music);
 const notes=[...harmony.notes].sort((a,b)=>a-b),events=[];
 const rootClass=((harmony.root+chordRoot(music,harmony.index))%12+12)%12;
 const bassRoot=28+((rootClass-28%12+12)%12);
 let expressionIndex=0;
 const push=(beat,midi,duration,gain,kind,details={})=>{
  // The three voices arrive at one ending. Earlier notes release before
  // that arrival; no extra bass or lead attack fills the following breath.
  if(development.cadenceBeat!==null&&!details.cadence){
   if(beat>=development.cadenceBeat)return;
   duration=Math.min(duration,development.cadenceBeat-beat);
  }
  const expression=noteExpression(seed,bar,expressionIndex++,kind),arrangement=phraseArrangement(seed,bar*4+beat);
  // Score the breathing space, including notes held across a bar boundary.
  // The shared state lets the other layers leave this same short rest open.
  if(arrangement.rest||arrangement.restInBeats<.09)return;
  duration=Math.min(duration*expression.duration,arrangement.restInBeats);
  events.push({beat,midi,duration,gain:gain*arrangement.layers.piano*expression.gain,kind,expression,phraseStage:development.stage,motifId:development.motifId,...details});
 };
 if(context.active===false)return {events,harmony,development};
 const wet=1-unit((Math.log10(Math.max(1000,cap))-4)/3);
 const chordBeats=rave?[.5,2.5]:[0];
 if(development.cadenceBeat!==null)chordBeats.push(development.cadenceBeat);
 const chordNotes=notes.slice(0,4),reverse=hash(seed,bar+419)%2===1;
 if(reverse)chordNotes.reverse();
 // Roll the hand by 9–17 ms per tone. Convert to score beats so fast replay
 // retains a modest audible spread, without altering the arpeggio's swing.
 const audibleTempo=Number(context.audibleTempo)||scoreTempo(music);
 const spread=(.009+.008*(hash(seed,bar+420)/4294967296))*audibleTempo/60;
 for(const beat of [...new Set(chordBeats)])chordNotes.forEach((pitch,index)=>push(beat+index*spread,pitch,rave?.45:1.5+1.8*wet,.038*(.65+.35*energy)*development.supportGain*(.92+.08*index/Math.max(1,chordNotes.length-1)),'chord',{cadence:beat===development.cadenceBeat}));
 const groove=arpRhythm(seed,development.sourceBar,music,cap);
 // Build a palette inside the actual instrument register before choosing
 // contour positions. Later octave folding cannot undo the market direction.
 const low=context.pitchLow??60,high=context.pitchHigh??88;
 const classes=new Set(notes.map(n=>((n%12)+12)%12));
 const palette=Array.from({length:Math.max(1,high-low+1)},(_,i)=>low+i).filter(n=>classes.has(n%12));
 const width=Math.min(palette.length,groove.span);
 const offset=hash(seed,Math.floor(development.sourceBar/4)+97)%Math.max(1,palette.length-width+1);
 const pitches=palette.slice(offset,offset+width);
 const down=music.group==='down';
 const learnedAmount=context.phraseLearning==null?1:unit(context.phraseLearning);
 let phrase=[];
 if(context.arpeggios!==false&&pitches.length&&learnedAmount>0){
  phrase=learnedMarketMelody(seed,development.sourceBar,{...context,music,harmony,groove,phraseLearning:learnedAmount});
 }else if(context.arpeggios!==false&&pitches.length)phrase=groove.events.map((event,i)=>{
  const phrase=marketPhraseTone(seed,development.sourceBar*4+event.beat,i,groove.events.length,context);
  const motifTurn=motif.length?(motif[i%motif.length][1]-66)/48:0;
  const position=unit(phrase.position+motifTurn*Math.sin(Math.PI*i/Math.max(1,groove.events.length-1)));
  const index=Math.round((down?1-position:position)*(pitches.length-1));
  return {...event,midi:pitches[index],duration:event.duration*phrase.duration,accent:event.accent*phrase.accent,allowedPitches:palette};
 });
 for(const event of developPhraseEvents(phrase,development))push(event.beat,event.midi,event.duration,.06*(.65+.35*energy)*event.accent,'arp',{allowedPitches:event.allowedPitches,motifNote:event.motifNote,phraseAccent:event.accent});
 // Kraken is always the bass voice, never a coin's lead. Root/fifth/octave
 // movement follows this bar's chord, sharing the lead's cadences.
 const bassBeats=rave?[0,.75,1.5,2,2.75,3.5]:[0,2.5];
 if(development.cadenceBeat!==null)bassBeats.push(development.cadenceBeat);
 [...new Set(bassBeats)].sort((a,b)=>a-b).forEach((beat,i)=>{
  const cadence=beat===development.cadenceBeat;
  const octave=!cadence&&rave&&i%3===2?12:0,fifth=!cadence&&i===bassBeats.length-1&&bar%4!==3?chordFifth(music,harmony.index):0;
  push(beat,bassRoot+octave+fifth,cadence?.8:rave?.42:1.3,.085*(.7+.3*energy)*development.supportGain,'bass',{cadence});
 });
 const landmark=music.movement?.event;
 if(context.arpeggios!==false&&landmark&&context.landmarkBar===bar){
  const tones=[notes[0]+12,notes[1]+12,notes.at(-1)+12,notes[0]+24];
  if(landmark.direction<0)tones.reverse();
  for(let i=0;i<4;i++)push(i*.5,tones[i],.35,.06,'arp',{allowedPitches:palette,landmark:true,phraseAccent:1});
 }
 if(context.arpeggios!==false&&palette.length&&development.cadenceBeat!==null){
  // Resolve within the current market harmony and the instrument's actual
  // range. The sounding pitch still goes through the final source guard.
  const previous=events.filter(event=>event.kind==='arp').at(-1)?.midi??pitches[0];
  const roots=palette.filter(pitch=>pitch%12===rootClass),targets=roots.length?roots:palette;
  const pitch=targets.reduce((nearest,pitch)=>Math.abs(pitch-previous)<Math.abs(nearest-previous)?pitch:nearest,targets[0]);
  push(development.cadenceBeat,pitch,.8,.052*(.65+.35*energy),'arp',{allowedPitches:palette,cadence:true,phraseAccent:.86});
 }
 // Keep one audible lead line. Landmark accents replace coincident attacks;
 // their pitches still pass through the same final originality guard.
 const lead=new Map();
 for(const event of events.filter(e=>e.kind==='arp').sort((a,b)=>a.beat-b.beat))lead.set(event.beat,event);
 const melody=[...lead.values()];
 melody.forEach((event,i)=>{event.duration=Math.min(event.duration,(melody[i+1]?.beat??4)-event.beat);});
 const drums=composeGameBoyDrumBar(seed,bar,context,development);
 return {events:[...events.filter(e=>e.kind!=='arp'),...melody.filter(e=>e.duration>=.025),...drums.events].sort((a,b)=>a.beat-b.beat),harmony,development,drums:{patternId:drums.patternId,density:drums.density,deviation:drums.deviation,performance:drums.performance},groove:learnedAmount>0?'Learned MIDI phrasing':groove.name};
}
import {chartHarmony} from './harmonic-characters.js?v=208';
function chordFifth(music,index){const chord=chartHarmony(music.character||'serene',music).chords[index];return ((chord[2]??chord[0]+7)-chord[0]+12)%12;}
function chordRoot(music,index){return chartHarmony(music.character||'serene',music).chords[index][0];}

// Integrate beats once across the frozen observations. Seeking is an indexed
// lookup; no replaying all preceding events or rerolling a random generator.
export function createCompositionTimeline(segments,playbackRate=1){
 // Accelerated charts keep a musical subdivision instead of squeezing a
 // hundred attacks into each beat. Power-of-two folding preserves meter.
 const rate=Math.max(.1,Number(playbackRate)||1);
 let beat=0;
 const rows=segments.map((segment,i)=>{const start=segment.start,end=Math.max(start+1,segments[i+1]?.start??segment.end),sourceTempo=scoreTempo(segment.music),fold=2**Math.max(0,Math.ceil(Math.log2(sourceTempo*rate/200))),tempo=sourceTempo/fold,row={...segment,start,end,tempo,audibleTempo:tempo*rate,beat,endBeat:beat+(end-start)*tempo/60000};beat=row.endBeat;return row;});
 const find=(value,field)=>{let lo=0,hi=rows.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(rows[mid][field]<=value)lo=mid;else hi=mid-1;}return rows[lo];};
 return {rows,beatAt(at){const row=find(at,'start');return row?row.beat+(at-row.start)*row.tempo/60000:0;},atBeat(value){const row=find(value,'beat');return row?row.start+(value-row.beat)*60000/row.tempo:0;},contextAtBeat(value){return find(value,'beat');}};
}
