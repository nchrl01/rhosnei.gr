import {capitalStage} from './capital-field.js?v=160';
// Shared market/audio mapping for the WebGL and Canvas PixelBlast renderers.
// These controls change the field inside a fixed 4 CSS-pixel square lattice.
const unit=n=>Math.max(0,Math.min(1,Number.isFinite(Number(n))?Number(n):0));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const mix=(a,b,t)=>a+(b-a)*unit(t);

// The user's standalone React Bits reference, before market/audio modulation.
export const PIXEL_BLAST_REFERENCE=Object.freeze({
 pixelSize:2,patternScale:.25,patternDensity:1.65,speed:1.35,edgeFade:.5,
 variant:'square',color:'#ffffff',transparent:true,antialias:false,autoPauseOffscreen:true,
});

export function pixelBlastParameters({marketCap=null,level=0,formation=0,drive=0,pressure=0,activity=0,volume=0,motion=0,fresh=0,capital=.5,depth=.5,surge=0,imbalance=0,identity=0,active=false,reducedMotion=false,mobile=false,piano=0,transient=0,balance=.5,change=null,tempo=40}={}){
 const reference=PIXEL_BLAST_REFERENCE;
 const sound=unit(level),presence=unit(formation),current=active?unit(fresh):0;
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

 const pixelSize=clamp(.6+1.05*sound+.55*valuation+1.05*notes+.3*attack,.5,3.5);
 // Pattern scale changes only the noise sampled at existing square centres.
 // Cell spacing and scene framing stay fixed.
 const patternScale=reference.patternScale;
 const patternDensity=clamp(.85+.55*liquidity+.2*flow+.2*notes,.85,1.8);
 // A narrow perimeter taper keeps the ecosystem distributed across the view.
 const edgeFade=clamp(.05+.04*(liquidity-.5)-.025*movement-.015*sound-.015*notes+.025*unit(pressure)*current,.015,.09);
 const ecosystem=mix(.18,.36,unit(.45*liquidity+.35*flow+.2*movement));
 const pixelSizeJitter=.24*unit(.5*movement+.25*flow+.15*notes+.1*attack)*response;
 const rippleIntensityScale=(.35+1.1*eventEnergy+.3*sound)*response;
 const liquidStrength=.08*unit(.4*movement+.2*flow+.2*sound+.12*notes+.08*attack)*response;
 const noiseAmount=.2*unit(.35*flow+.25*movement+.2*sound+.12*notes+.08*attack)*response;

 return {
  // Shape, colour, transparency and crisp rasterization are intentional
  // structural settings, independent of changing market or audio signals.
  variant:reference.variant,color:reference.color,transparent:reference.transparent,
  antialias:reference.antialias,autoPauseOffscreen:reference.autoPauseOffscreen,
  capitalStage:capitalStage(marketCap),pixelSize,cellSize:4,dotSize:pixelSize,
  patternScale,scale:patternScale,
  patternDensity,density:patternDensity,
  speed:reference.speed*(.2+.65*motionEnergy)*(.85+.3*pace)*response,
  edgeFade,pixelSizeJitter:0,jitter:0,
  dotStrength:(mobile?.28:.2)+(mobile?.72:.8)*strength,
  // Retain the former image uniforms' API without forming a central image.
  identity:0,identityMotion:0,ecosystem:.28,
  enableRipples:false,ripples:false,waveformEnabled:active&&engagement>.002,
  rippleSpeed:.12+.45*unit(.55*movement+.2*pace*response+.15*notes+.1*attack),
  rippleThickness:.02+.055*unit(.55*flow+.2*sound+.15*notes+.1*attack),
  rippleIntensityScale,rippleIntensity:rippleIntensityScale,
  liquid:false,liquidStrength:0,
  liquidRadius:mix(.15,1.5,unit(.3*liquidity+.2*valuation+.25*flow+.15*sound+.1*notes)),
  liquidWobbleSpeed:mix(1,8,unit(.35*pace+.35*movement+.15*notes+.15*attack)),
  noiseAmount:0,
  balance:side,
  direction:clamp((.65*signedChange+.35*(2*side-1))*current,-1,1),
 };
}
