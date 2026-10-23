import {phraseArrangement} from './phrase-arrangement.js?v=449';

// Concept inspiration: Tero Parviainen's Stochastic Drum Machine,
// https://codepen.io/teropa/pen/PKoYXM. Original seeded patterns and synthesis;
// no reference samples or source code are included here.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const unit=(value,fallback=0)=>finite(value)?clamp(Number(value),0,1):fallback;
const hash=(seed,index)=>{
 let value=(seed^Math.imul(index+1,2654435761))>>>0;
 value=Math.imul(value^(value>>>16),2246822507);
 return (value^(value>>>13))>>>0;
};
const roll=(seed,index)=>hash(seed,index)/4294967296;
const voices=['kick','snare','hat','tom'];
const lane=drum=>drum==='snare'||drum==='hat'?'noise':'tonal';
const priority={kick:4,snare:3,tom:2,hat:1};
const baseGain={kick:.058,snare:.05,hat:.033,tom:.043};
const baseDuration={kick:.24,snare:.2,hat:.1,tom:.28};

export function gameBoyDrumControls(context={}){
 const music=context.music||{};
 const observed=['activity','intensity','volatility'].some(key=>finite(music[key]));
 const activity=unit(music.activity,observed?0:.25);
 const intensity=unit(music.intensity,observed?0:.22);
 const motion=unit(music.volatility,observed?0:.12);
 return {
  density:unit(context.drumDensity,.15+.24*activity+.18*intensity+.1*motion),
  deviation:unit(context.drumDeviation,.025+.16*motion+.07*activity),
  activity,intensity,motion,
 };
}

export function gameBoyDrumsActive(context={}){
 const music=context.music||{};
 const observedSilence=finite(music.activity)&&unit(music.activity)===0&&unit(music.intensity)===0&&unit(music.volatility)===0;
 return context.drums!==false&&context.active!==false&&!observedSilence;
}

// Density chooses occupied cells in a persistent two-bar eighth-note grid.
// Anchors enter first; lighter offbeats and toms enter as density increases.
function occupied(seed,bar,step,voice,density){
 if(density<=0)return false;
 if(voice===0&&step===0)return true;
 if(voice===0&&step===4)return density>=.18;
 if(voice===1&&step===2)return density>=.24;
 if(voice===1&&step===6)return density>=.08;
 const weight=voice===0?(step%2?.4:.58):voice===1?.14:voice===2?(step%2?1.18:.76):(step===7?.26:.08);
 return roll(seed,bar*97+step*11+voice)<density*weight;
}

// Everything is addressed by the score, including mutations. Replaying a bar
// or seeking into it reconstructs exactly the same events without RNG state.
export function composeGameBoyDrumBar(seed,bar,context={},development={}){
 const position=Math.max(0,Math.floor(Number(bar)||0));
 const variation=clamp(Math.round(Number(context.drumVariation)||0),0,65535);
 const patternSeed=hash(Number(seed)>>>0,variation+1907);
 const patternId=patternSeed.toString(16).padStart(8,'0');
 const controls=gameBoyDrumControls(context);
 const {density,deviation,activity,intensity,motion}=controls;
 const result={events:[],patternId,density,deviation};
 if(!gameBoyDrumsActive(context))return result;

 const sourceBar=finite(development.sourceBar)?Math.max(0,Math.floor(Number(development.sourceBar))):position;
 const motifBar=sourceBar%2;
 const barSeed=hash(patternSeed,position+2309);
 const support=unit(development.supportGain,1);
 const cutoffs=[4,context.cutoffBeat,development.cadenceBeat].filter(finite).map(Number);
 const cutoff=clamp(Math.min(...cutoffs),0,4);
 const candidates=[];

 function add(drum,beat,step,base,embellishment=false){
  if(beat<0||beat>=cutoff)return;
  const arrangement=phraseArrangement(Number(seed)>>>0,position*4+beat);
  if(arrangement.rest)return;
  const duration=Math.min(baseDuration[drum]*(embellishment?.68:1),cutoff-beat,arrangement.restInBeats);
  if(duration<.015)return;
  const accent=embellishment?.66:step%2?.82:1;
  const hitSeed=hash(barSeed,step*61+voices.indexOf(drum)*7+Math.round(beat*48));
  const hitGain=baseGain[drum]*(.72+.18*intensity+.1*activity)*accent*(.9+.1*roll(hitSeed,1))*support*arrangement.layers.piano;
  if(hitGain<=0)return;
  candidates.push({
   kind:'drum',drum,beat,duration,gain:hitGain,seed:hitSeed,
   drumLane:lane(drum),drumStep:motifBar*8+step,drumBase:base,
   drumEmbellishment:embellishment,drumPatternId:patternId,
  });
 }

 for(let step=0;step<8;step++){
  for(let voice=0;voice<voices.length;voice++){
   const drum=voices[voice],base=occupied(patternSeed,motifBar,step,voice,density);
   // Occupied cells can drop out; empty cells can appear. At deviation=1
   // either cell has a 50% chance, before the two hardware-style lane limits.
   if(roll(barSeed,step*53+voice*7)>=(base?1-deviation/2:deviation/2))continue;
   const anchor=base&&((drum==='kick'&&(step===0||step===4))||(drum==='snare'&&(step===2||step===6)));
   const delay=!anchor&&roll(barSeed,step*53+voice*7+1)<deviation*(.3+.3*motion)?.25:0;
   const beat=step*.5+delay;
   add(drum,beat,step,base);
   const ornamentChance=deviation*(.12+.15*motion)*(development.stage==='vary'?1.4:.8);
   // A triplet occupies this cell only. It is never an automatic end fill.
   if(delay===0&&step<7&&(drum==='hat'||drum==='tom')&&roll(barSeed,step*53+voice*7+2)<ornamentChance){
    add(drum,beat+1/6,step,base,true);
    add(drum,beat+1/3,step,base,true);
   }
  }
 }

 // A snare wins a coincident hat; a kick wins a coincident tom. Select the
 // strongest base hits first if extreme settings exceed the small hit budget.
 candidates.sort((a,b)=>a.beat-b.beat||priority[b.drum]-priority[a.drum]);
 const distinct=[];
 for(const event of candidates){
  if(distinct.some(previous=>previous.drumLane===event.drumLane&&Math.abs(previous.beat-event.beat)<1e-8))continue;
  distinct.push(event);
 }
 if(distinct.length>18){
  distinct.sort((a,b)=>Number(a.drumEmbellishment)-Number(b.drumEmbellishment)||Number(b.drumBase)-Number(a.drumBase)||priority[b.drum]-priority[a.drum]||a.beat-b.beat);
  distinct.length=18;
 }
 distinct.sort((a,b)=>a.beat-b.beat||priority[b.drum]-priority[a.drum]);
 const previousByLane={};
 for(const event of distinct){
  const previous=previousByLane[event.drumLane];
  if(previous)previous.duration=Math.min(previous.duration,event.beat-previous.beat);
  previousByLane[event.drumLane]=event;
 }
 result.events=distinct.filter(event=>event.duration>=.015);
 return result;
}
