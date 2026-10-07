import {ENVION_CONTROLS} from './envion-market.js?v=61';
import {PIXEL_BLAST_REFERENCE} from './pixel-blast-parameters.js?v=214';
export const SOURCES=['activity','motion','volume','liquidity','balance','direction','pressure','shock','tempo','activity + volume','price change','market cap','audio energy','note events','seed','custom'];
export const ROUTES=[
 ['price','Price / % movement','Latest observed price + historical prices; chart viewport is not an input.','Compare 5-minute change with typical historical movement. Derive direction, pace, musical character and intensity.','Harmony / note selection. A ≥5% move from the note anchor can trigger a note. Contextual intensity controls tempo, currently 40–140 BPM.','Field speed, flow direction and pattern variation.'],
 ['activity','Trade activity','Received trades and timing; replay uses candle activity proxies.','Normalize observed activity. Do not invent trades from historical candle volume.','ENVION grain / envelope timing, event density and finite phrases on a shared beat clock.','Field flow and movement.'],
 ['volume','Trading volume','Observed trading value, provider volume and historical candle volume.','Compare current volume rate with its historical typical rate; derive surge and turnover.','Echo mix, repeats and feedback; tape / grain levels; data-tone excitation.','Flow and noise variation.'],
 ['liquidity','Liquidity','Selected pool liquidity snapshot; historical values can be unavailable.','Normalize available liquidity. Do not borrow current liquidity for historical replay.','ENVION reverb room, decay, damping and mix; echo reverb; data-tone duration.','Pixel-field density, pattern scale and spatial variation.'],
 ['cap','Market cap','Provider cap, price-scaled estimate or frozen replay basis.','Normalize valuation; weight movement intensity. Keep absolute phrase thresholds distinct from proposed NFT multiples.','Higher cap: drier EarthBound articulation and more interlocking parts. Phrase unlocks: $100K / $500K / $1M / $2M / $5M.','Square size and pattern scale, jointly modulated by actual sound energy.'],
 ['balance','Buy / sell balance','Decoded trade-side balance or available exchange book balance.','Normalize balance to 0–1. Missing balance stays neutral.','Stereo pan and left / right levels.','Directional bias, combined with price direction.'],
 ['identity','Network + token CA','Token identity, name and coin image.','Derive a seed from network + CA. Price relative to history can shift the root.','Seed chooses EarthBound instrument, phrase families and ENVION decisions. Optional voice says the coin name only alongside other sound.','Seeded pixel composition; dithered coin image in the UI. Field-to-image morphing is currently disabled.'],
 ['fresh','Freshness / transport','Observation age, feed state and live / replay playback status.','Decay stale signals. Distinguish confirmed silence from a disconnected feed.','Freshness gates excitement. Pause / seek / ended states stop performance.','Paused, muted or inaudible output clears the field.'],
];
// [key, label, default, minimum, maximum, step, unit, interpretation]
export const TIMING=[
 ['noteMove','Note-trigger price change',5,.1,1000,.1,'%', 'Absolute change from the last selected-note anchor.'],
 ['tempoLow','Lowest contextual tempo',40,10,240,1,'BPM','Movement intensity determines tempo, not cap alone.'],
 ['tempoHigh','Highest contextual tempo',140,10,400,1,'BPM','Current formula: 40 + 100 × sqrt(intensity).'],
 ['quiet','Known quiet interval',30,1,600,1,'seconds','Requires known silence, not a disconnected feed.'],
 ['quietSpacing','Minimum quiet-note spacing',45,1,600,1,'seconds','Current seed adds 0–15 seconds to this value.'],
 ['phraseLength','Market phrase length',8,1,128,1,'beats','Finite playback, then rest.'],
 ['phraseGap','Minimum gap between queued phrases',2,0,64,1,'beats','Current queue leaves two beats between phrases.'],
 ['phraseRest','Phrase re-trigger rest',24,0,256,1,'beats','Requires a new event after the rest.'],
 ['threshold1','First phrase unlock',100000,1,1e12,1000,'USD','Absolute market cap.'],
 ['threshold2','Second phrase unlock',500000,1,1e12,1000,'USD','Absolute market cap.'],
 ['threshold3','Third phrase unlock',1000000,1,1e12,1000,'USD','Absolute market cap.'],
 ['threshold4','Fourth phrase unlock',2000000,1,1e12,1000,'USD','Absolute market cap.'],
 ['threshold5','Fifth phrase unlock',5000000,1,1e12,1000,'USD','Absolute market cap.'],
];
export const PIXELS=[
 ['pixelSize','Reference pixel size',PIXEL_BLAST_REFERENCE.pixelSize,.1,20,.1,'px','Base reference; cap, sound, notes and attacks modulate it.'],
 ['scale','Reference pattern scale',PIXEL_BLAST_REFERENCE.patternScale,.01,10,.01,'','Noise sampling, not screen zoom.'],
 ['density','Reference pattern density',PIXEL_BLAST_REFERENCE.patternDensity,.1,10,.05,'','Liquidity and participation modulate it.'],
 ['speed','Reference pattern speed',PIXEL_BLAST_REFERENCE.speed,0,10,.05,'','Context and audio engagement modulate it.'],
 ['grid','Square lattice spacing',4,1,32,1,'px','Fixed scene framing.'],
 ['pixelMin','Smallest resulting square',.2,.05,20,.05,'px','Effective size clamp.'],
 ['pixelMax','Largest resulting square',3.8,.1,40,.1,'px','Effective size clamp.'],
 ['edgeMin','Minimum perimeter taper',.015,0,1,.005,'','Effective dynamic edge fade; the reference .5 is overridden.'],
 ['edgeMax','Maximum perimeter taper',.09,0,1,.005,'','Effective dynamic edge fade.'],
];
export const FEEDBACK=[
 ['bands','Notation frequency bands',16,4,64,1,'bands','Each bus is measured separately.'],
 ['minHz','Lowest analysed frequency',70,20,2000,10,'Hz','Current highest band ends at 9,100 Hz.'],
 ['maxHz','Highest analysed frequency',9100,100,22000,100,'Hz','Discrete square clusters; no continuous traces.'],
 ['floor','Spectrum floor',-65,-120,-10,1,'dB','Below this floor no frequency cluster forms.'],
 ['range','Spectrum normalization range',45,1,100,1,'dB','Energy range above the floor.'],
 ['rms','Individual input silence threshold',.0005,.00001,.1,.00001,'RMS','Bus notation threshold, separate from the master audible gate.'],
 ['marks','Maximum marks per band',8,1,32,1,'squares','Bounded work per band / sound bus.'],
];
export const COLLECTIBLE=[
 ['editions','Collection editions',100,1,10000,1,'NFTs','Proposed, not implemented.'],
 ['price','Mint price',.05,.0001,100,.0001,'ETH','Proposed, not implemented.'],
 ['holding','Originator holding requirement',500,0,1e9,1,'$UPIC','Collectors have no holding requirement.'],
 ['primaryBurn','Primary buyback / burn share',50,0,100,1,'%','Shares must sum to 100%.'],
 ['primaryOrigin','Primary originator share',25,0,100,1,'%','Shares must sum to 100%.'],
 ['primaryProtocol','Primary protocol share',25,0,100,1,'%','Shares must sum to 100%.'],
 ['secondaryOrigin','Secondary originator share',50,0,100,1,'%','Split of royalty receipts, not sale price.'],
 ['secondaryBurn','Secondary buyback / burn share',40,0,100,1,'%','Royalty rate is not specified.'],
 ['secondaryProtocol','Secondary protocol share',10,0,100,1,'%','Split of royalty receipts.'],
];
export const VISUAL_RULES=[
 ['pixelSize','Square size','market cap + audio energy','clamp(reference.pixelSize * (.25 + 1.05*strength) * (.7 + .6*valuation) * (1 + .32*notes + .18*attack), .2, 3.8)'],
 ['patternScale','Pattern scale','liquidity + market cap','clamp(reference.patternScale + .06*(valuation-.5) - .04*(liquidity-.5) + .04*movement + .025*notes + .015*attack, .18, .34)'],
 ['patternDensity','Pixel density','liquidity','clamp(reference.patternDensity + 1.2*(liquidity-.5) + .18*flow + .12*notes + .1*attack, .65, 2.6)'],
 ['speed','Movement speed','movement + audio energy','reference.speed * (.55+.85*motionEnergy) * (.85+.3*pace) * response'],
 ['edgeFade','Perimeter taper','liquidity + movement','clamp(.05 + .04*(liquidity-.5) - .025*movement - .015*sound - .015*notes + .025*pressure*current, .015, .09)'],
 ['jitter','Size variation','movement + activity',' .24 * unit(.5*movement + .25*flow + .15*notes + .1*attack) * response'],
 ['dotStrength','Pixel strength','audio energy + activity','Desktop: .2 + .8*strength. Mobile: .28 + .72*strength.'],
 ['direction','Flow direction','price change + balance','clamp((.65*signedChange + .35*(2*side-1))*current, -1, 1)'],
 ['ecosystem','Spatial variation','liquidity + activity','mix(.18,.36,unit(.45*liquidity+.35*flow+.2*movement))'],
 ['liquidStrength','Liquid distortion','movement + audio energy','.08 * unit(.4*movement+.2*flow+.2*sound+.12*notes+.08*attack) * response'],
 ['noiseAmount','Noise amount','volume + movement','.2 * unit(.35*flow+.25*movement+.2*sound+.12*notes+.08*attack) * response'],
 ['liquidRadius','Liquid radius','liquidity + market cap','mix(.15,1.5,unit(.3*liquidity+.2*valuation+.25*flow+.15*sound+.1*notes))'],
 ['liquidWobbleSpeed','Liquid motion speed','tempo + movement','mix(1,8,unit(.35*pace+.35*movement+.15*notes+.15*attack))'],
 ['strength','Combined pixel energy','audio energy + activity','unit(.3*flow+.3*presence+.25*sound+.15*attack)'],
 ['motionEnergy','Combined motion energy','movement + audio energy','unit(.45*movement+.2*flow+.15*sound+.12*notes+.08*attack)'],
 ['flow','Participation flow','activity + volume','unit(.45*activity+.35*volume+.2*surge)*current'],
 ['movement','Contextual movement','price change + pressure','unit(.5*drive+.25*motion+.15*pressure+.1*abs(signedChange))*current'],
 ['response','Audio engagement','audio energy + note events','active ? sqrt(max(presence,sound,notes,attack)) : 0; reduced motion disables animation.'],
 ['identity','Coin image morphing','seed','0 (currently disabled)'],
 ['ripples','Circular ripples','custom','false (currently disabled)'],
];
export function baseline(){
 const values=defs=>Object.fromEntries(defs.map(([key,,value])=>[key,value]));
 return {format:'UPIC mapping draft',version:1,baseline:'instrument after 41dac0b / map 2026-10-05',goal:'',routes:Object.fromEntries(ROUTES.map(([key,,,interpret,sound,visual])=>[key,{enabled:true,interpret,sound,visual,note:''}])),timing:values(TIMING),pixels:values(PIXELS),feedback:values(FEEDBACK),collectible:values(COLLECTIBLE),envion:Object.fromEntries(ENVION_CONTROLS.map(([id,,source,expression])=>[id,{enabled:true,source,expression,note:''}])),visualRules:Object.fromEntries(VISUAL_RULES.map(([id,,source,expression])=>[id,{enabled:true,source,expression,note:''}])),audioBehavior:'Keep three sound buses separate: EarthBound notes / arpeggios; Pure Data mix; optional voice. Actual loudness, note attacks and band energy shape scattered square marks. No continuous waveform lines. No audible output means no pixels.',includeCollectible:false,collectionBehavior:'One seeded artwork per token, issued as 100 editions. Coin image is dithered. Transformations unlock at 2x, 5x, 10x, 25x and 50x the creation market cap. Live performances remain a separate shareable feature. Claim rules and permanent vs reversible unlocks remain undecided.'};
}
export function validate(draft){
 const errors=[];
 for(const [group,defs] of [['timing',TIMING],['pixels',PIXELS],['feedback',FEEDBACK],...(draft.includeCollectible?[['collectible',COLLECTIBLE]]:[])])for(const [key,label,,min,max] of defs){const value=draft[group][key];if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)errors.push(label+' must be between '+min+' and '+max+'.');}
 if(draft.timing.tempoLow>draft.timing.tempoHigh)errors.push('Lowest tempo cannot exceed highest tempo.');
 if(draft.pixels.pixelMin>draft.pixels.pixelMax||draft.pixels.edgeMin>draft.pixels.edgeMax)errors.push('Visual minimums cannot exceed maximums.');
 if(draft.feedback.minHz>=draft.feedback.maxHz)errors.push('Lowest frequency must be below highest frequency.');
 const caps=[1,2,3,4,5].map(i=>draft.timing['threshold'+i]);if(caps.some((value,i)=>i>0&&value<=caps[i-1]))errors.push('Phrase thresholds must increase from first to fifth.');
 if(draft.includeCollectible){const c=draft.collectible;if(c.primaryBurn+c.primaryOrigin+c.primaryProtocol!==100)errors.push('Primary shares must sum to 100%.');if(c.secondaryOrigin+c.secondaryBurn+c.secondaryProtocol!==100)errors.push('Secondary shares must sum to 100%.');}
 return errors;
}
export function hydrate(data){
 if(data?.format!=='UPIC mapping draft'||data.version!==1)throw Error('Choose a UPIC mapping draft exported from this editor.');
 const out=baseline();
 function merge(target,source){if(!source||typeof source!=='object'||Array.isArray(source))return;for(const key of Object.keys(target)){if(key==='format'||key==='version'||key==='baseline')continue;const value=source[key];if(typeof target[key]==='object')merge(target[key],value);else if(typeof target[key]==='string'&&typeof value==='string')target[key]=value.slice(0,10000);else if(typeof target[key]==='boolean'&&typeof value==='boolean')target[key]=value;else if(typeof target[key]==='number'&&(typeof value==='number'||value===''))target[key]=value;}}
 merge(out,data);return out;
}
export function changes(draft){
 const original=baseline(),result=[];
 function walk(before,after,path=[]){for(const key of Object.keys(before)){if(['format','version','baseline'].includes(key))continue;const p=[...path,key];if(before[key]!==null&&typeof before[key]==='object'){walk(before[key],after[key],p);continue;}const proposal=p[0]==='collectible'||p[0]==='collectionBehavior';if(before[key]!==after[key]&&(!proposal||draft.includeCollectible))result.push({path:p.join('.'),before:before[key],after:after[key]});}}
 walk(original,draft);return result;
}
export function changeNote(draft){
 const list=changes(draft),names={};
 for(const [group,defs] of [['timing',TIMING],['pixels',PIXELS],['feedback',FEEDBACK],['collectible',COLLECTIBLE]])for(const [id,label,,,,,unit] of defs)names[group+'.'+id]=label+(unit?' ('+unit+')':'');
 for(const [id,label] of ROUTES)names['routes.'+id]=label;
 for(const [id,label] of ENVION_CONTROLS)names['envion.'+id]='ENVION: '+label+' [control '+id+']';
 for(const [id,label] of VISUAL_RULES)names['visualRules.'+id]='Pixel field: '+label;
 const lines=['UPIC — REQUESTED MAPPING CHANGES','Baseline: '+draft.baseline,'This is a requested draft, not changes already applied to the live site.',''];
 if(draft.goal)lines.push('OVERALL INTENT',draft.goal,'');
 for(const change of list){if(change.path==='goal')continue;const parts=change.path.split('.'),prefix=parts.slice(0,2).join('.'),title=names[change.path]||names[prefix]||change.path;lines.push(title+' ['+change.path+']','  Before: '+String(change.before),'  Requested: '+String(change.after),'');}
 if(!list.length)lines.push('No changes requested yet.');
 lines.push('SCOPE','Apply only the requested settings. Preserve the existing instrument and mappings that are not listed.','Expressions are text for implementation review; they were not executed or auditioned here.','If narrative and numeric/formula requests conflict, ask me to resolve that conflict.');
 if(draft.includeCollectible)lines.push('Collectible settings are a proposal, not authorization to deploy contracts, transact or launch a token.');
 return lines.join('\n');
}
