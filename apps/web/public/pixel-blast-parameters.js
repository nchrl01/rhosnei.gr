import {coinVisualPreset,contextualEdgeShrink} from './visual-context.js?v=214';
import {capitalStage} from './capital-field.js?v=167';
// Shared market/audio mapping for the WebGL and Canvas PixelBlast renderers.
// Coin seed fixes the pattern; liquidity spaces the mark lattice.
const unit=n=>Math.max(0,Math.min(1,Number.isFinite(Number(n))?Number(n):0));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const mix=(a,b,t)=>a+(b-a)*unit(t);

// Higher-cap marks retain sound history longer; no energy is created at rest.
// Token artwork increasingly attracts the living field from $10M to $50M.
// This strength saturates, not the animation: there is no high-cap handover.
export function marketCapIdentity(marketCap){
 const cap=Number(marketCap);
 const t=cap>0&&Number.isFinite(cap)?unit(Math.log10(cap/1e7)/Math.log10(5)):0;
 return t*t*(3-2*t);
}
export function marketCapReleaseSeconds(marketCap){
 const cap=Number(marketCap);
 const size=Number.isFinite(cap)&&cap>0?unit((Math.log10(cap)-4)/5):.5;
 return .25*Math.pow(16,size);
}
export function advancePixelSurvival(previous,target,dt,marketCap,releaseOverride){
 const before=unit(previous),goal=unit(target);
 const release=Number.isFinite(releaseOverride)?clamp(releaseOverride,.1,12):marketCapReleaseSeconds(marketCap);
 const next=goal+(before-goal)*Math.exp(-Math.max(0,Number(dt)||0)/(goal>before?.08:release));
 return goal===0&&next<.001?0:unit(next);
}

// The user's standalone React Bits reference, before market/audio modulation.
export const PIXEL_BLAST_REFERENCE=Object.freeze({
 pixelSize:2,patternScale:.25,patternDensity:1.65,speed:1.35,edgeFade:.5,
 variant:'circle',color:'#ffffff',transparent:true,antialias:false,autoPauseOffscreen:true,
});

export function pixelBlastParameters({seed=0,coinKey=null,referenceCap=null,walletVariation=0,marketCap=null,level=0,formation=0,drive=0,pressure=0,activity=0,volume=0,motion=0,fresh=0,capital=.5,depth=.5,surge=0,imbalance=0,identity=0,active=false,reducedMotion=false,mobile=false,piano=0,transient=0,balance=.5,change=null,tempo=40}={}){
 const reference=PIXEL_BLAST_REFERENCE;
 const sound=unit(level),presence=unit(level),current=active?unit(fresh):0;
 const animated=active&&!reducedMotion;
 const attack=animated?unit(transient):0,notes=animated?unit(piano):0;
 const valuation=unit(capital),liquidity=unit(depth);
 const side=balance!==null&&balance!==''&&Number.isFinite(Number(balance))?unit(balance):.5;
 const changePct=Number.isFinite(Number(change))?Number(change):0;
 // Five percent contextual movement gives half the signed response; small
 // changes stay proportional and extreme moves approach the bound smoothly.
 const signedChange=changePct/(Math.abs(changePct)+5);
 const pace=unit((clamp(Number(tempo)||40,10,240)-10)/230);
 const movement=unit(.5*unit(drive)+.25*unit(motion)+.15*unit(pressure)+.1*Math.abs(signedChange))*current;
 const flow=unit(.45*unit(activity)+.35*unit(volume)+.2*unit(surge))*current;
 const engagement=active?unit(Math.max(presence,sound,notes,attack)):0;
 const response=animated&&engagement>=.002?Math.sqrt(engagement):0;
 const strength=unit(.3*flow+.3*presence+.25*sound+.15*attack);
 const motionEnergy=unit(.45*movement+.2*flow+.15*sound+.12*notes+.08*attack);
 const eventEnergy=unit(.35*unit(surge)*current+.2*unit(imbalance)*current+.25*notes+.2*attack);

 const capFill=unit((capitalStage(marketCap)-6));
 // Both renderers rasterize the minimum to exactly one physical pixel.
 const audibleGrowth=unit(sound/.35);
 const pixelSize=mix(clamp(.5+(2.8*sound+1.6*valuation+3.2*notes+1.5*attack)*audibleGrowth,.5,10),.5+6.5*audibleGrowth,capFill);
 // Pattern scale changes only the noise sampled at existing square centres.
 // Pattern identity stays independent of market cap.
 const patternScale=reference.patternScale;
 const patternDensity=clamp(1.125+.2*flow+.2*notes,.85,1.8);
 // A narrow perimeter taper keeps the ecosystem distributed across the view.
 const edgeFade=contextualEdgeShrink(marketCap,referenceCap);
 const ecosystem=mix(.18,.36,unit(.45*liquidity+.35*flow+.2*movement));
 const pixelSizeJitter=.24*unit(.5*movement+.25*flow+.15*notes+.1*attack)*response;
 const rippleIntensityScale=(.35+1.1*eventEnergy+.3*sound)*response;
 const liquidStrength=.08*unit(.4*movement+.2*flow+.2*sound+.12*notes+.08*attack)*response;
 const noiseAmount=.2*unit(.35*flow+.25*movement+.2*sound+.12*notes+.08*attack)*response;

 return {
  // Shape, transparency and crisp rasterization stay fixed. Artwork colours
  // are introduced only after their market-cap milestone.
  variant:reference.variant,color:reference.color,transparent:reference.transparent,
  antialias:reference.antialias,autoPauseOffscreen:reference.autoPauseOffscreen,
  patternKey:coinKey??seed,capitalStage:coinVisualPreset(coinKey??seed).patternStage,patternStage:coinVisualPreset(coinKey??seed).patternStage,pixelSize,cellSize:mix(16,4,liquidity),dotSize:pixelSize,
  pixelPresence:active?unit(level/.02):0,survivalRelease:marketCapReleaseSeconds(marketCap),
  patternScale,scale:patternScale,
  patternDensity,density:patternDensity,
  // One tempo ratio drives flow: 100 BPM = reference speed, 200 = twice it.
  speed:animated?reference.speed*clamp(Number(tempo)||40,10,240)/100:0,
  edgeFade,pixelSizeJitter:unit(walletVariation),jitter:unit(walletVariation),
  dotStrength:mix((mobile?.28:.2)+(mobile?.72:.8)*strength,1,capFill),
  // Artwork attracts the moving field towards $50M; its colours arrive at $100M.
  identity:marketCapIdentity(marketCap),artworkColor:Number.isFinite(Number(marketCap))&&Number(marketCap)>=1e8?1:0,identityMotion:reducedMotion?0:.3,ecosystem:.28,
  enableRipples:false,ripples:false,waveformEnabled:active&&engagement>.002,
  rippleSpeed:.12+.45*unit(.55*movement+.2*pace*response+.15*notes+.1*attack),
  rippleThickness:.02+.055*unit(.55*flow+.2*sound+.15*notes+.1*attack),
  rippleIntensityScale,rippleIntensity:rippleIntensityScale,
  liquid:false,liquidStrength:0,
  liquidRadius:mix(.15,1.5,unit(.3*.5+.2*valuation+.25*flow+.15*sound+.1*notes)),
  liquidWobbleSpeed:mix(1,8,unit(.35*pace+.35*movement+.15*notes+.15*attack)),
  noiseAmount:0,
  balance:side,
  // Price sign controls notation independently of buy/sell balance or flow.
  markDirection:current>0?Math.sign(changePct):0,
  direction:clamp((.65*signedChange+.35*(2*side-1))*current,-1,1),
 };
}
