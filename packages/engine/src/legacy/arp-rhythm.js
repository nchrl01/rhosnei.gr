// Original phrase vocabulary using swing, syncopation and Euclidean spacing.
// References: https://strudel.cc/learn/time-modifiers/
// https://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
const hash=(seed,n)=>{let x=(seed^Math.imul(n+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);return (x^(x>>>13))>>>0;};
const euclid=(pulses,steps,rotation=0)=>Array.from({length:steps},(_,i)=>i).filter(i=>((i+rotation)%steps*pulses)%steps<pulses).map(i=>i*4/steps);
const STYLES={
 tresillo:{steps:[[0,6,12],[0,6,10,12]],swing:0,gate:.76,gesture:0},
 shuffle:{steps:[[0,2,4,6,8,10,12,14],[0,2,6,8,10,14]],swing:.28,gate:.66,gesture:1},
 funk:{steps:[[0,3,6,7,10,14],[1,4,6,9,11,14]],swing:.12,gate:.42,gesture:3},
 broken:{steps:[[0,3,6,10,13,15],[2,5,7,10,12,15]],swing:.20,gate:.48,gesture:2},
 house:{steps:[[2,6,10,14],[2,5,6,10,13,14]],swing:.06,gate:.62,gesture:4},
 cross:{steps:null,swing:0,gate:.72,gesture:5},
 acid:{steps:null,swing:.08,gate:.38,gesture:3},
};
export function arpRhythm(seed,bar,music,cap){
 const activity=unit(music.activity),energy=unit(Math.max(music.intensity,activity));
 const section=Math.floor(bar/8),phrase=((bar%8)+8)%8,answer=phrase%2===1;
 const pool=cap>=1e6?['house','acid','broken','funk']:energy>.4?['funk','broken','cross','shuffle']:['tresillo','shuffle','cross'];
 // Advance through the repertoire at eight-bar boundaries. The seed chooses
 // a starting vocabulary; chart activity changes density and articulation.
 const name=pool[(hash(seed,11)+section)%pool.length],style=STYLES[name];
 const variation=(Math.floor(phrase/2)+hash(seed,section)%2)%2;
 let beats=style.steps?style.steps[variation].map(step=>step/4):name==='cross'?euclid(variation?7:5,12,Math.floor(phrase/2)):euclid(7+Math.round(energy*4),16,phrase%4);
 if(energy<.18&&beats.length>4)beats=beats.filter((_,i)=>i%2===0);
 // Answers leave a gap, and the final bar breathes before the next section.
 if(answer&&beats.length>3)beats=beats.slice(1);
 if(phrase===7)beats=beats.filter(beat=>beat<2.75);
 if(phrase===3&&energy>.5)beats.push(3.5,3.75);
 beats=[...new Set(beats)].sort((a,b)=>a-b).slice(0,12);
 const swing=style.swing*(.65+.35*activity);
 const shifted=beats.map(beat=>{
  const step=Math.round(beat*4);
  // Shuffle eighths; broken/funk/acid displace the second sixteenth.
  const late=name==='shuffle'?step%4===2:step%2===1;
  return Math.min(3.92,beat+(late?swing*(name==='shuffle'?.5:.25):0));
 });
 return {name,gesture:(style.gesture+Math.floor(phrase/4))%6,span:3+(hash(seed,section+51)%3),events:shifted.map((beat,i)=>{
  const gap=(shifted[i+1]??4)-beat;
  const accent=i===0||Math.abs(beat-Math.round(beat))<.04?1:((i+phrase)%3===0?.9:.63);
  return {beat,duration:Math.max(.10,Math.min(1.05,gap*style.gate)),accent:accent*(answer?.91:1)};
 })};
}
// Six contours with a shared directional destination, rather than sorting
// every note into the same staircase. Internal turns give a phrase its shape.
export function arpPosition(gesture,index,count,learned=0){
 const t=count<2?.5:index/(count-1),r=index%3;
 let p=t;
 if(gesture===1)p=t+(index%2?.16:-.04); // paired skips
 if(gesture===2)p=index%2===0?t*.38:t+.12; // moving pedal and answer
 if(gesture===3)p=t+[0,.22,-.12][r]; // broken chord
 if(gesture===4)p=t+Math.sin(t*Math.PI*4)*.19; // two small arches
 if(gesture===5)p=t+Math.max(-.18,Math.min(.18,learned*.045)); // learned turns
 if(index===0)p=0;
 if(index===count-1)p=1;
 return unit(p);
}
