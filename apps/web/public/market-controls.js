const clamp=n=>Math.max(0,Math.min(1,n));

// A healthy decoded feed uses its own rolling trade window. Liquidity and
// native USD conversion retain their last snapshot, with a separate age label.
export function signalFreshness(decoded,lastSnapshot,now=Date.now()){
 const snapshotAge=Math.max(0,now-lastSnapshot);
 const snapshotFresh=clamp(1-(snapshotAge-20000)/40000);
 return {fresh:decoded?1:snapshotFresh,snapshotFresh,snapshotAge};
}

export function mixTargets(m,streamConnected){
 const activity=m.activity*(streamConnected?1:m.fresh);
 const volume=Math.sqrt(m.volume*m.fresh);
 return {
  melody:(.12+.58*m.motion)*Math.sqrt(activity)*m.fresh*volume,
  pad:.48*m.texture*Math.sqrt(activity)*m.fresh*volume,
  space:.75*m.texture*m.fresh,
 };
}
