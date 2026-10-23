// The arrangement is a pure function of the score clock. Live playback and
// historical seeks therefore arrive at the same phrase without timer state.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const random=(seed,index)=>{
 let value=(seed^Math.imul(index+1,2654435761))>>>0;
 value=Math.imul(value^(value>>>16),2246822507);
 return ((value^(value>>>13))>>>0)/4294967296;
};
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const contour=[[0,.72],[6,.94],[11,.86],[15,.62],[16,.74],[22,.98],[27,.87],[31,.58],[32,.72]];

export function phraseArrangement(seed,scoreBeat){
 const beat=Math.max(0,Number(scoreBeat)||0),phrase=Math.floor(beat/32),start=phrase*32,offset=beat-start;
 const character=random(seed,phrase*7+51);
 // At the maximum 200 BPM even the shorter breath lasts over 195 ms,
 // spanning the host's 150 ms market/control tick without another timer.
 const breaths=[[15.14+.2*character,16],[30.76+.22*random(seed,phrase*7+52),32]];
 const current=breaths.find(([from,to])=>offset>=from&&offset<to);
 const next=current||breaths.find(([from])=>from>offset)||breaths[1];
 let gain=contour[0][1];
 for(let i=1;i<contour.length;i++){
  const [to,endGain]=contour[i],[from,startGain]=contour[i-1];
  if(offset<=to){gain=startGain+(endGain-startGain)*smooth((offset-from)/(to-from));break;}
 }
 // Leave a little room for a phrase's answer rather than making all layers
 // crest at once. None of these multipliers raises the existing mix peak.
 const bar=Math.floor(offset/4),answer=(bar+Math.floor(character*2))%4===2||bar===4;
 const role=answer?'texture':'melody';
 const phraseGain=current?0:gain*(.94+.06*character);
 return {
  beat,phrase,phase:offset/32,role,phraseGain,rest:Boolean(current),
  restStartBeat:start+next[0],restEndBeat:start+next[1],
  restInBeats:current?0:Math.max(0,next[0]-offset),
  layers:{piano:phraseGain*(answer?.78:1),envion:phraseGain*(answer?.94:.66),data:phraseGain*(answer?.78:.9)},
 };
}

// Small, repeatable variations around each instrument's envelope retain its
// identity. Shorter gates make articulation; the room can finish naturally.
export function noteExpression(seed,bar,index,kind){
 const key=bar*257+index*7+(kind==='chord'?1:kind==='bass'?2:3);
 const a=random(seed,key),b=random(seed,key+1),c=random(seed,key+2);
 return {
  gain:.84+.16*a,
  duration:kind==='chord'?.88+.12*b:kind==='bass'?.76+.22*b:.72+.28*b,
  attack:.8+.6*c,
  decay:.82+.3*a,
  sustain:.82+.18*b,
  release:.8+.35*c,
 };
}
