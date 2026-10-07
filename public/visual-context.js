import {earthboundVisualSeed} from './earthbound-visual-seed.js?v=214';
export function coinVisualPreset(seed=0){
 const profile=earthboundVisualSeed(seed),layers=profile.layers.map(layer=>layer.id);
 return {index:profile.layers[0].kind,name:'Address composition '+layers.join(' / '),layers,patternStage:profile.patternStage};
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
