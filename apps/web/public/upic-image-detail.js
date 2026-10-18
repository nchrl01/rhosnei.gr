// Deliberate calibration for the local study, not token market estimates.
// Full detail now arrives with the field's $1M spatial opening. The independent
// artwork-colour milestone still receives the real, unclamped market cap.
const capAnchors=[[1,4],[3000,4],[20000,8],[100000,16],[500000,32],[1e6,64]];
function resolutionAt(value,anchors){
 const v=Number.isFinite(value)?Math.max(0,value):0;
 for(let i=1;i<anchors.length;i++){
  const [end,b]=anchors[i], [start,a]=anchors[i-1];
  if(v<=end){
   const t=Math.max(0,Math.min(1,(Math.log1p(v)-Math.log1p(start))/(Math.log1p(end)-Math.log1p(start))));
   return Math.round(a+(b-a)*t);
  }
 }
 return anchors[anchors.length-1][1];
}
export function imageDetailRules({marketCap=0,liquidity=0}={}){
 const unlocked=resolutionAt(marketCap,capAnchors);
 // Liquidity now controls mark spacing/size, never image resolution.
 const liquidityLimit=64;
 const cells=unlocked;
 return {unlocked,liquidityLimit,cells,pixelSize:512/cells};
}
