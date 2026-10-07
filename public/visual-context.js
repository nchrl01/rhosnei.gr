import {suggestedLayers} from './earthbound-motion-presets.js?v=167';
export function coinVisualPreset(seed=0){
 const index=(Number(seed)>>>0)%suggestedLayers.length,preset=suggestedLayers[index];
 // EarthBound layer selection and graphic family both belong to the coin.
 const [a,b]=preset.layers;
 return {index,name:preset.name,layers:preset.layers,patternStage:((a*31+b*17)>>>0)%7};
}
export function walletSizeVariation(groups=[]){
 const shares=groups.flatMap(g=>g.wallets||[]).map(w=>Number(w.percentage)).filter(n=>Number.isFinite(n)&&n>0);
 if(shares.length<2)return 0;
 const mean=shares.reduce((a,b)=>a+b,0)/shares.length;
 const cv=Math.sqrt(shares.reduce((s,n)=>s+(n-mean)**2,0)/shares.length)/mean;
 return Math.min(1,cv/2);
}
export function contextualEdgeShrink(cap,reference){
 if(!(cap>0&&reference>0))return .12;
 // 1/4 of the fixed reference: wide shrink; 100x: almost edge-to-edge.
 const t=Math.max(0,Math.min(1,Math.log(cap/reference/.25)/Math.log(400)));
 return .32+(.015-.32)*t;
}
