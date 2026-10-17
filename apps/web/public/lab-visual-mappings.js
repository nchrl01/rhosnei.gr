// Lab mappings are versioned independently of the production instrument.
export const LAB_MAPPING_VERSION=3;
export const UPDATED_TARGETS=['dotSize','cellSize','speed','edgeFade','jitter','pixelPresence','survivalRelease','scale','density','ecosystem','identity','identityMotion'];
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
export function labVisualMappings(parameters,{marketCap,activity,fresh=1,active=true}={}){
 const cap=Number(marketCap),size=cap>0?unit((Math.log10(cap)-3)/6):.5;
 return {...parameters,dotSize:Math.min(12,parameters.dotSize),pixelSize:Math.min(12,parameters.pixelSize),
  // $1K stays tightly gathered; $1B opens almost to the viewport edges.
  edgeFade:.5-.485*size,
  speed:active?2.7*unit(activity)*unit(fresh):0,
  cellSize:24-20*size,
 };
}
