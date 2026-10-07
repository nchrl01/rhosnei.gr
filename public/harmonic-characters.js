import {REFERENCE_HARMONIES} from './harmony-catalog.js?v=1';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
const key=name=>name.toLowerCase().replace(/\s+/g,'-');
// One choice per character; keep alternate progressions inside that character.
export const HARMONIES={};
const aliases={};
for(const [id,harmony] of Object.entries(REFERENCE_HARMONIES)){
 const idKey=key(harmony.name);aliases[id]=idKey;
 const entry=HARMONIES[idKey]??={...harmony,variants:[]};
 if(!entry.variants.some(v=>v.mode===harmony.mode&&v.progression===harmony.progression))entry.variants.push(harmony);
 entry.mode=[...new Set(entry.variants.map(v=>v.mode))].join(' / ');
}
export const CHARACTER_FAMILIES=Object.fromEntries(Object.entries({
 calm:'Serene Gentle Sweet Comforting Warm Smooth Dreamy Romantic Floating Velvety Atmospheric Ethereal Celestial Distant',
 rising:'Hopeful Optimistic Cheerful Playful Joyful Satisfying Confident Bold Expansive Dynamic Adventurous Regal Grand Triumphant Epic Transcendent',
 falling:'Bittersweet Melancholic Sad Somber Sorrowful Poignant Emotional Brooding Dark Foreboding Ominous Tragic Tense',
 recovering:'Reflective Contemplative Pensive Introspective Wistful Nostalgic Yearning Longing Listful Evocative Soulful Enchanting',
 turbulent:'Anticipatory Enigmatic Alluring Seductive Mystical Hypnotic Lush Rich Sophisticated Colourful Surprising Exotic Complex Passionate Dramatic Restless Anxious Intense',
}).map(([family,names])=>[family,names.split(' ').map(key)]));
export function resolveHarmonicCharacter(value){return Object.hasOwn(HARMONIES,value)?value:aliases[value]||'serene';}
export function chartCharacter({changePct=0,intensity=0,volatility=0,trendConsistency=1,lastMove=changePct,priorMove=lastMove,volumeRatio=1}={}){
 const change=Number(changePct)||0;
 const family=trendConsistency<.45&&volatility>.25?'turbulent':change<-.25&&lastMove>priorMove?'recovering':change>.25?'rising':change<-.25?'falling':'calm';
 const strength=Math.max(unit(intensity),1-Math.exp(-Math.abs(change)/20),1-Math.exp(-Math.max(0,Number(volumeRatio)-1)/4));
 const choices=CHARACTER_FAMILIES[family];
 return choices[Math.min(choices.length-1,Math.floor(strength*choices.length))];
}
export function chartHarmony(character,music={}){
 const h=HARMONIES[resolveHarmonicCharacter(character)],direction=Math.sign(Number(music.changePct)||0);
 const matching=h.variants.filter(v=>v.mode===(direction<0?'Minor':'Major'));
 const variants=matching.length?matching:h.variants;
 return {...variants[Math.min(variants.length-1,Math.floor(unit(music.volatility)*variants.length))],name:h.name};
}
