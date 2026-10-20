// Production adapter for the approved October 7 pattern-count lab.
import {createPixelBlastField} from './oct07-live/pixel-blast-field.js?v=376';
import {pixelBlastParameters} from './oct07-live/pixel-blast-parameters.js';
import {labVisualMappings} from './oct07-live/lab-visual-mappings.js';
const unit=x=>Math.max(0,Math.min(1,Number(x)||0));
export function createEarthboundRenderer(host,{maxDimension=1024}={}){
 const renderer=createPixelBlastField(host,{generations:false});
 const surface=()=>[...host.querySelectorAll('canvas')].find(c=>!c.hidden)||host.querySelector('canvas');
 let lastSeed=null;
 let image=null,stats={markCount:0,shapeWeights:[1,0,0],sizeTransition:false,positionTransition:false};
 return {
  get kind(){return host.dataset.pixelBlast==='canvas'?'canvas':'webgl'},get surface(){return surface()},get allocation(){return null},
  setImage(source){image=source;renderer.setImage(source)},
  render({width,height,time=0,seed=0,inputs={},presence=1,inkColor=1}={}){
   const history=inputs.chartHistory,bar=history?.at(-1),prior=history?.at(-2);
   const reported=Number.isFinite(inputs.totalHolders)&&inputs.totalHolders>0?Math.round(inputs.totalHolders):0;
   const population=history?.length?4096:reported||inputs.holderBalances?.length||0;
   if(!population){renderer.clear();stats.markCount=0;return;}
   const scale=Math.min(1,maxDimension/Math.max(width,height)),renderWidth=Math.max(1,width*scale),renderHeight=Math.max(1,height*scale);
   if(seed!==lastSeed){renderer.reset(seed);lastSeed=seed;}
   const change=bar?Math.abs(bar.close/(prior?.close||bar.open)-1):0;
   const activity=history?.length?unit(change*30+(bar.high-bar.low)/bar.open*8):unit(inputs.activity);
   const marketCap=inputs.marketCap>0?inputs.marketCap:1000;
   const artistic={marketCap,referenceCap:100000,seed,activity,level:.5,tempo:100,volume:history?.length?unit(Math.log1p(Math.max(0,bar.volume||0))/20):.5,motion:.4,change:0,depth:.5,drive:.5,pressure:.2,surge:.3,imbalance:.2,balance:.6,fresh:1,piano:.5,transient:.2,active:true};
   const mapped=labVisualMappings(pixelBlastParameters(artistic),artistic);
   const size=inputs.liquidity>0?1+11*unit((Math.log10(inputs.liquidity)-2)/6):1;
   const params={...mapped,identity:image?.7:0,identityMotion:0,dotSize:size,pixelSize:size,pixelPresence:1,cellSize:Math.max(2,Math.min(48,mapped.cellSize*Math.pow(10000/population,.22))),markDirection:0,shapeWeights:[1,0,0],inkColor};
   renderer.render({width:renderWidth,height:renderHeight,time,eventTime:time,liquidTime:time,active:true,parameters:params});
   for(const canvas of host.querySelectorAll('canvas'))Object.assign(canvas.style,{position:'absolute',width:width+'px',height:height+'px',left:'0px',top:'0px',opacity:String(unit(presence))});
   stats={...stats,markCount:null,reportedHolders:reported,representedPopulation:population,populationCapped:false,imageAvailable:Boolean(image),renderer:'october7-texture',reconstructed:Boolean(history?.length)};
  },
  snapshot(){return {...stats}},clear(){renderer.clear()},close(){renderer.close()}
 };
}
