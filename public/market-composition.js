import {arpRhythm,arpPosition} from './arp-rhythm.js?v=211';
import {MOTIF_MODEL} from './motif-model.js?v=209';
import {pianoHarmony} from './music-context.js?v=208';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
export const scoreTempo=music=>Math.max(20,Math.min(200,Number(music?.tempo)||100));
const hash=(seed,n)=>{let x=(seed^Math.imul(n+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);return (x^(x>>>13))>>>0;};
// One bar belongs to one context. Market changes affect the next bar, never
// reset its phase. Motif development follows A / A' / B / A'' over eight bars.
export function composeMarketBar(seed,bar,context,motif=[]){
 const music=context.music||{},cap=Number(context.cap)||0;
 const energy=unit(Math.max(music.intensity,.15+.6*unit(music.activity)));
 const rave=cap>=1e6?unit(.35+(Math.log10(cap)-6)*.3):0;
 const harmonicStep=(context.harmonyStep||0)+Math.floor(bar/2);
 const harmony=pianoHarmony(seed,{chordStep:harmonicStep-seed%4},music);
 const notes=[...harmony.notes].sort((a,b)=>a-b),events=[];
 const push=(beat,midi,duration,gain,kind)=>events.push({beat,midi,duration,gain,kind});
 if(context.active===false)return {events,harmony};
 const wet=1-unit((Math.log10(Math.max(1000,cap))-4)/3);
 const chordBeats=rave?[.5,2.5]:[0];
 for(const beat of chordBeats)for(const pitch of notes.slice(0,4))push(beat,pitch,rave?.45:1.5+1.8*wet,.038*(.65+.35*energy),'chord');
 const shape=learnedContour(seed,Math.floor(bar/8));
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
 if(context.arpeggios!==false&&pitches.length)groove.events.forEach((event,i)=>{
  const learned=motif.length?Math.round((motif[i%motif.length][1]-60)/4):shape[i%shape.length];
  const position=arpPosition(groove.gesture,i,groove.events.length,learned);
  const index=Math.round((down?1-position:position)*(pitches.length-1));
  push(event.beat,pitches[index],event.duration,.06*(.65+.35*energy)*event.accent,'arp');
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
 if(landmark&&context.landmarkBar===bar){
  const tones=[notes[0]+12,notes[1]+12,notes.at(-1)+12,notes[0]+24];
  if(landmark.direction<0)tones.reverse();
  for(let i=0;i<4;i++)push(i*.5,tones[i],.35,.08,'arp');
 }
 return {events:events.sort((a,b)=>a.beat-b.beat),harmony,groove:groove.name};
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

function learnedContour(seed,section){
 let state=hash(seed,section),a=0,b=2,position=0;const shape=[];
 for(let i=0;i<8;i++){
  const options=MOTIF_MODEL.transitions[a+','+b]||MOTIF_MODEL.fallback;
  const weights=options.map(([interval,count])=>count/(1+Math.abs(interval)*.2+(Math.abs(position+interval)>10?8:0)));
  state=hash(state,i);let draw=state/4294967296*weights.reduce((x,y)=>x+y,0),choice=options.at(-1)[0];
  for(let j=0;j<options.length;j++)if((draw-=weights[j])<=0){choice=options[j][0];break;}
  position=Math.max(-10,Math.min(10,position+choice));shape.push(Math.round(position/2));a=b;b=choice;
 }
 return shape;
}
