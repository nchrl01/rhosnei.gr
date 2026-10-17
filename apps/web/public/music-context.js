import {HARMONIES,chartCharacter,chartHarmony,resolveHarmonicCharacter} from './harmonic-characters.js?v=208';
export {HARMONIES,CHARACTER_GROUPS,chartCharacter,resolveHarmonicCharacter} from './harmonic-characters.js?v=208';
// Musical interpretation of percentage movement, not a trading recommendation.
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
const median=values=>{const s=values.filter(Number.isFinite).sort((a,b)=>a-b);return s.length?s[Math.floor(s.length/2)]:0;};
export function musicContext({price,rows=[],interval=300000,changes={},cap,moodMovement=null,fresh=1,now=Date.now()}={}){
 const complete=rows.filter(b=>b.time+interval<=now&&b.open>0&&b.close>0);
 const recent=complete.at(-1),previous=complete.at(-2);
 const anchor=complete.filter(b=>b.time+interval<=now-300000).at(-1);
 const supplied=changes.m5!=null&&Number.isFinite(Number(changes.m5));
 const change=anchor&&price>0?(price/anchor.close-1)*100:supplied?Number(changes.m5):recent?(recent.close/recent.open-1)*100:0;
 const typical=Math.max(.35,median(complete.slice(-72).map(b=>Math.abs((b.close/b.open-1)*100)))*Math.sqrt(300000/Math.max(1000,interval)));
 const relative=Math.abs(change)/typical;
 const absolute=1-Math.exp(-Math.abs(change)/4);
 const size=cap>0?unit((Math.log10(cap)-4)/4):.25;
 const intensity=unit((.72*absolute+.28*(1-Math.exp(-relative/2)))*(.4+.6*size))*unit(fresh);
 const lastMove=recent?(recent.close/recent.open-1)*100:change;
 const priorMove=previous?(previous.close/previous.open-1)*100:lastMove;
 const moves=complete.slice(-12).map(b=>(b.close/b.open-1)*100);
 const travel=moves.reduce((sum,n)=>sum+Math.abs(n),0);
 const trendConsistency=travel>0?Math.abs(moves.reduce((sum,n)=>sum+n,0))/travel:1;
 const observedVolatility=median(moves.map(Math.abs));
 const volatility=observedVolatility/(observedVolatility+2);
 const typicalVolume=median(complete.slice(-25,-1).map(b=>b.volume).filter(v=>v>0));
 const volumeRatio=typicalVolume>0&&recent?.volume>=0?recent.volume/typicalVolume:1;
 const features={changePct:change,intensity,volatility,trendConsistency,lastMove,priorMove,volumeRatio};
 const capChangePct=moodMovement?.available?moodMovement.changePct:change;
 const group=moodMovement?.available?moodMovement.group:capChangePct<0?'down':'up';
 const character=chartCharacter({...features,group,capChangePct});
 return {version:3,character,...features,group,capChangePct,movement:moodMovement,tempo:Math.round(40+100*Math.sqrt(intensity)),typicalPct:typical,relativeMove:relative};
}

export function pianoHarmony(seed,event={},music={}){
 const character=resolveHarmonicCharacter(music.character),h=harmonyPlan(seed,character,music);
 const at=Number(event.occurredAt??event.at??event.receivedAt)||0;
 const step=Number.isFinite(event.chordStep)?event.chordStep:Math.floor(at/30000);
 const index=((step+(seed>>>0)%4)%4+4)%4,root=Number.isFinite(music.tonic)?48+((Math.round(music.tonic)%12)+12)%12:48+(seed>>>0)%5;
 const previous=event.previousNotes?.length?event.previousNotes:compactVoicing(h.chords[(index+3)%4],root);
 const notes=compactVoicing(h.chords[index],root,previous);
 return {character,group:h.group,name:h.name,progression:h.progression,index,notes,root};
}

// Keep the call signature for existing score callers; chart data selects the
// progression. The coin seed still controls the key and instrument elsewhere.
export function harmonyPlan(_seed,character='serene',music={}){
 return chartHarmony(character,music);
}
function compactVoicing(chordNotes,root,previous=[]){
 const tones=[...new Set(chordNotes.map(n=>((root+n)%12+12)%12))];let best=null,cost=Infinity;
 for(let inversion=0;inversion<tones.length;inversion++){
  const order=[...tones.slice(inversion),...tones.slice(0,inversion)];
  for(let low=45;low<=57;low++){
   if(low%12!==order[0])continue;const notes=[low];
   for(const pitchClass of order.slice(1)){let note=notes.at(-1)+1;while(note%12!==pitchClass)note++;notes.push(note);}
   if(notes.at(-1)>69)continue;
   const movement=previous.length?notes.reduce((sum,n)=>sum+Math.min(...previous.map(p=>Math.abs(n-p))),0):0;
   const score=movement+Math.abs(notes.reduce((a,b)=>a+b,0)/notes.length-55)*.6+(notes.at(-1)-notes[0])*.1;
   if(score<cost){best=notes;cost=score;}
  }
 }
 return best||chordNotes.map(n=>root+n);
}
