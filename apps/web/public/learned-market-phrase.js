import {MIDI_PHRASE_MODEL} from './midi-phrase-model.js?v=469';
import {marketPhraseTone} from './market-phrase.js?v=453';
import {loadOriginalityIndex,originalityIndexStatus,sourceMelodyMatch,MIDI_ORIGINALITY_INFO} from './midi-originality.js?v=455';

const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,Number(n)||0));
const unit=n=>clamp(n,0,1);
const mix=(a,b,t)=>a+(b-a)*t;
const hash=(seed,n)=>{let x=(seed^Math.imul(n+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);return (x^(x>>>13))>>>0;};
function random(seed){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
const distributions=MIDI_PHRASE_MODEL.distributions;
export const LEARNED_PHRASE_INFO=Object.freeze({
 label:'Learned MIDI phrasing',sourceCount:MIDI_PHRASE_MODEL.sourceCount,
 noteCount:MIDI_PHRASE_MODEL.noteCount,modelSha:MIDI_PHRASE_MODEL.modelSha,
});
const sameCorpus=MIDI_ORIGINALITY_INFO.datasetFingerprint===MIDI_PHRASE_MODEL.datasetFingerprint&&MIDI_ORIGINALITY_INFO.sourceFiles===MIDI_PHRASE_MODEL.sourceCount;
export const learnedPhraseStatus=()=>sameCorpus?originalityIndexStatus():{ready:false,state:'error',error:'Source checks do not match the learned model'};
export const prepareLearnedPhrases=()=>sameCorpus?loadOriginalityIndex():Promise.resolve(learnedPhraseStatus());
const screenedMatch=notes=>sameCorpus?sourceMelodyMatch(notes):{ready:false,match:null};

// Only aggregate distributions are shipped. Key, harmony, market response,
// register limits and phrase form remain explicit UPIC composition rules.
function sample(key,rng,fallback,weight=()=>1){
 const table=distributions['lead.'+key];
 if(!Array.isArray(table))return fallback;
 let sum=0;
 for(const [value,p] of table)sum+=p*Math.max(0,weight(value));
 if(!(sum>0))return fallback;
 let roll=rng()*sum;
 for(const [value,p] of table){roll-=p*Math.max(0,weight(value));if(roll<=0)return value;}
 return fallback;
}
function nearest(value,palette){
 return palette.reduce((best,pitch)=>Math.abs(pitch-value)<Math.abs(best-value)?pitch:best,palette[0]);
}
function reflect(pitch,low,high){
 if(low===high)return low;
 for(let i=0;i<8&&(pitch<low||pitch>high);i++)pitch=pitch<low?low+(low-pitch):high-(pitch-high);
 return clamp(pitch,low,high);
}
const activity=(key,fallback=.75)=>{
 const row=distributions['lead.'+key];return row?unit(row.active):fallback;
};

export function learnedMarketMelody(seed,bar,{music={},harmony,groove,phraseLearning=1,phraseVariation=0,...options}={}){
 const amount=unit(phraseLearning),energy=unit(Math.max(Number(music.intensity)||0,Number(music.activity)||0));
 const low=Math.round(clamp(options.pitchLow??60,36,96)),high=Math.max(low,Math.round(clamp(options.pitchHigh??88,36,108)));
 const root=harmony.root%12,down=music.group==='down';
 const chordClasses=new Set(harmony.notes.map(n=>(n%12+12)%12));
 const scaleClasses=new Set((down?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11]).map(n=>(root+n)%12));
 for(const pitch of chordClasses)scaleClasses.add(pitch);
 const range=Array.from({length:high-low+1},(_,i)=>low+i);
 const scale=range.filter(n=>scaleClasses.has(n%12));
 const chord=range.filter(n=>chordClasses.has(n%12));
 if(!scale.length||!chord.length)return [];
 const variation=Math.round(clamp(phraseVariation,0,65535));
 const phraseBars=Math.max(1,Math.round(clamp(options.phraseLength??8,4,16)/4));
 const phrase=Math.floor(bar/phraseBars),voiceSeed=hash(seed,variation+813);
 const rng=random(hash(voiceSeed,bar+101));
 const pitchRng=random(hash(voiceSeed,phrase+733));
 const density=sample('bar_onsets',rng,4,n=>n>12?0:n===0?mix(1,.3,energy):1+.06*energy*Math.min(n,8));
 const count=Math.min(12,Math.round(mix(groove.events.length,density*(.65+.55*energy),amount)));
 if(!count)return [];
 const onsets=[];
 let beat=rng()<activity('phrase_32_activity:'+((bar*4)%32))?0:.25+.25*Math.floor(rng()*3);
 for(let i=0;i<count&&beat<3.96;i++){
  onsets.push(beat);
  const gap=sample('inter_onset_beats',rng,.5,n=>n>=.125&&n<=4?1:0);
  beat+=gap;
 }
 // A low-energy bar has fewer attacks. Timing remains on the score clock;
 // no independent timer or source tempo enters the live/replay transport.
 const baseline=groove.events;
 const beats=onsets.map((value,i)=>{
  const at=onsets.length>1?i*(baseline.length-1)/(onsets.length-1):0;
  const a=baseline[Math.floor(at)]?.beat??value,b=baseline[Math.ceil(at)]?.beat??a;
  return mix(mix(a,b,at-Math.floor(at)),value,amount);
 });
 const register=sample('register',pitchRng,5,n=>n>=3&&n<=8?1:0)*12+root;
 let pitch=nearest(clamp(register,low,high),scale),interval=0;
 const nextInterval=()=>{
  const value=sample('interval_next:'+interval,pitchRng,null,n=>Math.abs(n)<=12?(Math.sign(n)===(down?-1:1)?1.15:1):0);
  interval=value??sample('interval',pitchRng,2,n=>Math.abs(n)<=12?1:0);
  return interval;
 };
 // Walk to this bar's place in the seeded phrase, independent of seek order.
 // This latent material is generated afresh; no source note sequence is read.
 for(let i=0;i<(bar%phraseBars)*12;i++)pitch=reflect(pitch+nextInterval(),low,high);
 return beats.map((at,i)=>{
  const phase=((bar*4+at)%32+32)%32;
  const heardActivity=activity('phrase_32_activity:'+Math.floor(phase))*activity('quarter_beat_activity:'+Math.min(15,Math.floor(at*4)));
  const rest=rng()>(.7+.3*heardActivity+energy*.08);
  pitch=reflect(pitch+nextInterval(),low,high);
  const contour=marketPhraseTone(seed,bar*4+at,i,beats.length,options);
  const bend=(contour.value-.5)*6*unit(options.phraseDepth??1);
  const target=mix(low+(high-low)*(down?1-contour.position:contour.position),reflect(pitch+bend,low,high),amount);
  const strong=i===0||Math.abs(at-Math.round(at))<.04;
  const midi=nearest(target,strong?chord:scale);
  const gap=(beats[i+1]??4)-at;
  const duration=sample('duration_beats',rng,.5,n=>n>=.0625&&n<=4?1:0);
  const gate=sample('gate',rng,.8,n=>n>=.2&&n<=1?1:0)*clamp(options.phraseGate??.8,.2,1);
  const learnedDuration=Math.min(duration,gap*gate,1.6);
  const learnedAccent=sample('accent',rng,1,n=>n>=.4&&n<=1.5?1:0);
  return {beat:at,midi,duration:Math.max(.06,mix(baseline[Math.min(i,baseline.length-1)]?.duration??.4,learnedDuration,amount)),accent:mix(contour.accent,clamp(learnedAccent,.4,1.3)*(strong?1:.84),amount),rest:rest&&amount>.5,allowedPitches:strong?chord:scale};
 }).filter(event=>!event.rest);
}

// Guard the pitches that will actually sound, after chord fitting, register
// folding and all other melody edits. Keep the previous eight accepted notes
// so a copied interval run cannot escape merely by crossing a bar boundary.
export function createMelodyOriginalityGuard(match=screenedMatch){
 let history=[],blocked=0,revoiced=0;
 const guard={
  choose(midi,allowedPitches){
   const options=[midi,...[...new Set(allowedPitches||[])].filter(n=>n!==midi).sort((a,b)=>Math.abs(a-midi)-Math.abs(b-midi)||a-b)];
   for(const candidate of options){
    const result=match([...history.slice(-8).map(row=>row.midi),candidate]);
    if(!result.ready){blocked++;return null;}
    if(result.match)continue;
    if(candidate!==midi)revoiced++;
    return candidate;
   }
   blocked++;return null;
  },
  remember(midi,at=0,id=null){history.push({midi,at,id});history=history.slice(-32);},
  accept(midi,allowedPitches,at=0){const result=guard.choose(midi,allowedPitches);if(result!==null)guard.remember(result,at);return result;},
  cancelAfter(at){history=history.filter(row=>row.at<at);},
  cancel(id){history=history.filter(row=>row.id!==id);},
  reset(){history=[];blocked=0;revoiced=0;},
  snapshot(){return {...learnedPhraseStatus(),blocked,revoiced};},
 };
 return guard;
}
