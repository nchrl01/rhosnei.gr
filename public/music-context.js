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
 const character=HARMONIES[music.character]?music.character:'serene',h=HARMONIES[character];
 const at=Number(event.occurredAt??event.at??event.receivedAt)||0;
 const step=Number.isFinite(event.chordStep)?event.chordStep:Math.floor(at/30000);
 const index=((step+(seed>>>0)%4)%4+4)%4,root=48+(seed>>>0)%5;
 const notes=h.chords[index].map(n=>{const note=root+n;return note>67?note-12:note;}).sort((a,b)=>a-b);
 return {character,name:h.name,progression:h.progression,index,notes};
}
