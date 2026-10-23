import {TAU,loopPhase} from './earthbound-loop.js?v=427';

const unit=value=>Math.max(0,Math.min(1,Number(value)||0));

// Presentation changes the existing field's readability, never its population
// or liquidity-derived mark sizes. The caller owns the quiet/live clock.
export function earthboundPresentation({identity=0,image=false,activity=0,scorePulse={},reducedMotion=false}={}){
 const movement=unit(activity),attack=reducedMotion?0:unit(scorePulse.attack);
 const sustain=reducedMotion?0:unit(scorePulse.sustain),echo=reducedMotion?0:unit(scorePulse.echo);
 const texture=reducedMotion?0:unit(scorePulse.texture);
 return {
  // Keep the cap-dependent artwork progression while reserving enough of
  // the two-layer field to recognize its bands, even at the highest cap.
  identity:image?.3+.38*unit(identity):0,
  patternContrast:1.35+.3*movement+.4*attack+.12*sustain+.12*texture,
  patternWarp:reducedMotion?0:.016+.034*movement+.035*attack+.018*sustain+.014*echo,
  patternPitch:reducedMotion?0:unit(scorePulse.pitch),patternAccent:attack,
  patternArp:reducedMotion?0:unit(scorePulse.arp),patternTexture:texture,
  patternChord:reducedMotion?0:unit(scorePulse.chord),patternDirection:reducedMotion?0:Math.max(-1,Math.min(1,Number(scorePulse.direction)||0)),
  selectionNoise:.14,patternSampleSize:14,patternNoiseOctaves:2,
 };
}

// Integer harmonics of the shared 24-second phase preserve the exact loop.
// Counter-moving broad bands make the original per-layer distortions legible
// without shifting the holder lattice or applying a camera shake.
export function earthboundMotionFrame(time=0,seed=0,params={}){
 const angle=loopPhase(time),phase=((Number(seed)>>>0)%65521)/65521*TAU;
 const accent=unit(params.patternAccent),pitch=unit(params.patternPitch);
 return {a:angle*2+phase,b:-angle+phase*.5,c:angle+phase*.7,
  amplitude:Math.max(0,Math.min(.12,Number(params.patternWarp)||0)),
  overtone:accent*.3,pitch:2+2*pitch,arp:unit(params.patternArp),texture:unit(params.patternTexture),chord:unit(params.patternChord),
  direction:Math.max(-1,Math.min(1,Number(params.patternDirection)||0))};
}

export function earthboundFieldWarp(x,y,frame){
 if(!frame.amplitude)return [x,y];
 const horizontal=.7*Math.sin(y*TAU*2+frame.a)+.3*Math.sin(y*TAU*3+frame.b);
 const overtone=frame.overtone*Math.sin(y*TAU*frame.pitch+frame.a);
 const arps=.18*frame.arp*Math.sin(y*TAU*6+frame.b),grain=.1*frame.texture*Math.sin(y*TAU*12+frame.a);
 return [x+frame.amplitude*(horizontal+overtone+arps+grain),
  y+frame.amplitude*((.3+.25*frame.chord)*Math.sin(x*TAU*1.5+frame.c)-.65*frame.direction)];
}
