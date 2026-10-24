// A deterministic 32-bar form, reconstructed from score position on seek.
// This conducts existing APU voices; it never creates an oscillator or activity.
export function chipOrchestration(bar,signal,mapping){
 const cycle=Math.floor(bar/32),position=((bar%32)+32)%32,section=Math.floor(position/8);
 const phase=(position%8)/8,breath=.5-.5*Math.cos(Math.PI*phase);
 const roles=[
  {lead:.75,arp:1,chord:.95,bass:.85,drone:1.25,texture:.8,drum:.45},
  {lead:1,arp:1,chord:.75,bass:1,drone:.8,texture:.6,drum:.65},
  {lead:.55,arp:1,chord:.85,bass:.85,drone:1.3,texture:1.2,drum:.8},
  {lead:.65,arp:1,chord:1,bass:.7,drone:1.1,texture:.65,drum:.35},
 ][section];
 const direction=mapping.change.direction;
 const strength=mapping.change.magnitude;
 return {cycle,section,names:['emerge','speak','transform','settle'],phase,breath,
  roles,variation:cycle%16,
  // Sign is audible even for modest measured movement. Magnitude controls
  // interval width; absent/zero movement stays level, never invented upward.
  contour:direction*(3+7*strength),
  colour:(.5+.5*Math.sin((position/32+cycle*.137)*Math.PI*2))*(.3+.7*strength),
  release:1+.6*(1-mapping.tempo.activity),
 };
}
