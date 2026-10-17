import {REFERENCE_HARMONIES} from './harmony-catalog.js?v=1';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
const key=name=>name.toLowerCase().replace(/\s+/g,'-');
export const HARMONIES={};
const aliases={};
for(const [id,harmony] of Object.entries(REFERENCE_HARMONIES)){
 const idKey=key(harmony.name);aliases[id]=idKey;
 const entry=HARMONIES[idKey]??={...harmony,variants:[]};
 if(!entry.variants.some(v=>v.mode===harmony.mode&&v.progression===harmony.progression))entry.variants.push(harmony);
}
// Each character belongs to exactly one direction; no seed-based mood choice.
export const CHARACTER_GROUPS={
 up:'Serene Gentle Sweet Comforting Warm Smooth Dreamy Romantic Floating Velvety Atmospheric Ethereal Celestial Hopeful Optimistic Cheerful Playful Joyful Satisfying Confident Bold Expansive Dynamic Adventurous Regal Grand Triumphant Epic Transcendent Enchanting Lush Rich Soulful Passionate Sophisticated Colourful'.split(' ').map(key),
 down:'Reflective Contemplative Pensive Introspective Distant Wistful Nostalgic Yearning Longing Listful Evocative Bittersweet Melancholic Sad Somber Sorrowful Poignant Emotional Brooding Enigmatic Alluring Seductive Mystical Hypnotic Anticipatory Surprising Exotic Complex Dramatic Dark Foreboding Ominous Tragic Tense Restless Anxious Intense'.split(' ').map(key),
};
for(const [group,names] of Object.entries(CHARACTER_GROUPS))for(const name of names){HARMONIES[name].group=group;HARMONIES[name].mode=group==='up'?'Major':'Minor';}
// Functional four-chord loops: tonic / predominant / dominant / resolution,
// plus common cyclic schemas. Major/minor keep the same tonic pitch class.
const chords={I:[0,4,7],ii:[2,5,9],iii:[4,7,11],IV:[5,9,12],V:[7,11,14],vi:[9,12,16],i:[0,3,7],iv:[5,8,12],v:[7,10,14],'♭III':[3,7,10],'♭VI':[8,12,15],'♭VII':[10,14,17],'iiø7':[2,5,8,12]};
const loops={up:['I V vi IV','I vi ii V','I IV ii V','I iii vi V','IV V I I','I IV I V','vi IV I V','I ii V I'],down:['i ♭VI ♭III ♭VII','i iv V i','i ♭VII ♭VI V','i ♭VI iv V','i iiø7 V i','i v iv i','♭VI ♭VII i i','i ♭III iv V']};
export function resolveHarmonicCharacter(value){return Object.hasOwn(HARMONIES,value)?value:aliases[value]||'serene';}
export function chartCharacter({group,changePct=0,capChangePct=changePct,intensity=0,volatility=0,volumeRatio=1}={}){
 const direction=group==='down'||group!=='up'&&capChangePct<0?'down':'up';
 const strength=unit(.65*unit(Math.abs(capChangePct)/20)+.2*unit(intensity)+.1*unit(volatility)+.05*unit(Math.log2(Math.max(1,volumeRatio))/3));
 const choices=CHARACTER_GROUPS[direction];
 return choices[Math.min(choices.length-1,Math.floor(strength*choices.length))];
}
export function chartHarmony(character,music={}){
 const id=resolveHarmonicCharacter(character),h=HARMONIES[id],group=h.group;
 const rank=CHARACTER_GROUPS[group].indexOf(id),sequence=loops[group][rank%loops[group].length].split(' ');
 const colour=Math.floor(rank/loops[group].length)%3;
 const labels=[],notes=sequence.map(roman=>{
  const base=[...chords[roman]],root=base[0];let label=roman;
  if(base.length===3&&colour===1){base.push(root+14);label+='add9';}
  if(base.length===3&&colour===2){const majorSeventh=['I','IV','♭III','♭VI'].includes(roman);base.push(root+(majorSeventh?11:10));label+=majorSeventh?'maj7':'7';}
  labels.push(label);return base;
 });
 return {name:h.name,group,mode:h.mode,progression:labels.join(' · '),chords:notes};
}
