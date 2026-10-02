// Musical interpretation of percentage movement, not a trading recommendation.
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
const median=values=>{const s=values.filter(Number.isFinite).sort((a,b)=>a-b);return s.length?s[Math.floor(s.length/2)]:0;};
export function musicContext({price,rows=[],interval=300000,changes={},cap,fresh=1,now=Date.now()}={}){
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
 const slowing=lastMove<0&&lastMove>priorMove;
 let character='serene';
 if(Math.abs(change)>.25){
  character=change>0?(intensity>.58?'confident':'hopeful'):
   slowing?'reflective':intensity>.48?'tense':'bittersweet';
 }else if(typical>2&&Math.abs(lastMove)>.3)character='restless';
 return {version:1,character,intensity,tempo:Math.round(40+100*Math.sqrt(intensity)),changePct:change,typicalPct:typical,relativeMove:relative};
}
const chord=(root,intervals)=>intervals.map(n=>root+n);
const major=root=>chord(root,[0,4,7]),minor=root=>chord(root,[0,3,7]);
export const HARMONIES={
 serene:{name:'Serene',progression:'I · IVsus2 · I · V',chords:[chord(0,[0,4,7,14]),chord(5,[0,2,7]),major(0),major(7)]},
 hopeful:{name:'Hopeful',progression:'I · V · vi · IV',chords:[major(0),major(7),minor(9),major(5)]},
 confident:{name:'Confident',progression:'I · vi · IV · V',chords:[major(0),minor(9),major(5),major(7)]},
 reflective:{name:'Reflective',progression:'I · IV · vi · V',chords:[major(0),major(5),minor(9),major(7)]},
 bittersweet:{name:'Bittersweet',progression:'IV · iv · I · I',chords:[major(5),minor(5),major(0),chord(0,[0,4,7,14])]},
 tense:{name:'Tense',progression:'i · v · ♭VI · V',chords:[minor(0),minor(7),major(8),major(7)]},
 restless:{name:'Restless',progression:'i · ii° · V · i',chords:[minor(0),chord(2,[0,3,6]),major(7),minor(0)]},
};
export function pianoHarmony(seed,event={},music={}){
 const character=HARMONIES[music.character]?music.character:'serene',h=harmonyPlan(seed,character);
 const at=Number(event.occurredAt??event.at??event.receivedAt)||0;
 const step=Number.isFinite(event.chordStep)?event.chordStep:Math.floor(at/30000);
 const index=((step+(seed>>>0)%4)%4+4)%4,root=48+(seed>>>0)%5;
 const previous=compactVoicing(h.chords[(index+3)%4],root);
 const notes=compactVoicing(h.chords[index],root,previous);
 return {character,name:h.name,progression:h.progression,index,notes};
}

// Functional harmony, extensions and modal interchange studied in ChordSeqAI's
// theory wiki. These authored progressions do not run its neural models.
const seventh=(root,quality='major')=>chord(root,quality==='minor'?[0,3,7,10]:quality==='dominant'?[0,4,7,10]:[0,4,7,11]);
const HARMONY_VARIANTS={
 serene:[{progression:'Imaj7 · IVmaj7 · ii7 · Vsus4',chords:[seventh(0),seventh(5),seventh(2,'minor'),chord(7,[0,5,7])]}],
 hopeful:[{progression:'Iadd9 · vi7 · IVmaj7 · V7',chords:[chord(0,[0,4,7,14]),seventh(9,'minor'),seventh(5),seventh(7,'dominant')]}],
 confident:[{progression:'I · IV · ii7 · V7',chords:[major(0),major(5),seventh(2,'minor'),seventh(7,'dominant')]}],
 reflective:[{progression:'Imaj7 · iii7 · vi7 · IVmaj7',chords:[seventh(0),seventh(4,'minor'),seventh(9,'minor'),seventh(5)]}],
 bittersweet:[{progression:'Imaj7 · IVmaj7 · iv6 · Iadd9',chords:[seventh(0),seventh(5),chord(5,[0,3,7,9]),chord(0,[0,4,7,14])]}],
 tense:[{progression:'i7 · iv7 · ♭VImaj7 · V7',chords:[seventh(0,'minor'),seventh(5,'minor'),seventh(8),seventh(7,'dominant')]}],
 restless:[{progression:'i · iiø7 · V7 · iadd9',chords:[minor(0),chord(2,[0,3,6,10]),seventh(7,'dominant'),chord(0,[0,3,7,14])]}],
};
export function harmonyPlan(seed,character='serene'){
 const name=HARMONIES[character]?character:'serene',variants=[HARMONIES[name],...HARMONY_VARIANTS[name]];
 const choice=((seed>>>0)^(seed>>>8))>>>0;
 return {...variants[choice%variants.length],name:HARMONIES[name].name};
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
