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
  patternContrast:1.35+.3*movement,
  patternWarp:reducedMotion?0:.016+.034*movement,
  patternSound:reducedMotion?0:unit(.55*attack+.35*sustain+.1*echo),
  patternDrum:reducedMotion?0:unit(scorePulse.drum),
  patternBass:reducedMotion?0:unit(scorePulse.bass),
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
  sound:unit(params.patternSound),drum:unit(params.patternDrum),bass:unit(params.patternBass),
  overtone:accent*.3,pitch:2+2*pitch,arp:unit(params.patternArp),texture:unit(params.patternTexture),chord:unit(params.patternChord),
  direction:Math.max(-1,Math.min(1,Number(params.patternDirection)||0))};
}

export function earthboundFieldWarp(x,y,frame){
 if(!frame.amplitude)return [x,y];
 const horizontal=.7*Math.sin(y*TAU*2+frame.a)+.3*Math.sin(y*TAU*3+frame.b);
 const base=[x+frame.amplitude*horizontal,y+frame.amplitude*.3*Math.sin(x*TAU*1.5+frame.c)];
 return earthboundSoundWarp(base[0],base[1],frame);
}

// Shared source-coordinate deformation for BOTH procedural bands and artwork.
// Sound never changes contrast, holder count, mark size or market +/- shapes.
export function earthboundSoundWarp(x,y,frame){
 if(!frame.sound)return [x,y];
 const sign=frame.direction||1,amount=.055*frame.sound;
 const band=Math.sin(y*TAU*(2+frame.pitch*.25)+frame.a);
 const interlace=Math.sin(y*TAU*5+frame.b)*Math.sin(y*TAU*.5+frame.c);
 const compression=Math.sin(y*TAU+frame.c);
 const grain=Math.sin(y*TAU*11+frame.b)*Math.sin(x*TAU*2+frame.a);
 return [x+amount*(.65*band+.35*frame.arp*interlace+.16*frame.texture*grain)*sign,
  y+amount*(.45*frame.chord*compression+.3*frame.bass*Math.sin(x*TAU+frame.b)+.45*frame.drum*Math.sin(y*TAU*3+frame.a))];
}
