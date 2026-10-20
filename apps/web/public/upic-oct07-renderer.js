// Production adapter for the approved October 7 pattern-count lab.
import {createPixelBlastCanvas,preparePixelIdentity} from './oct07-live/pixel-blast-canvas.js?v=391';
import {pixelBlastParameters} from './oct07-live/pixel-blast-parameters.js';
import {labVisualMappings} from './oct07-live/lab-visual-mappings.js';
const unit=x=>Math.max(0,Math.min(1,Number(x)||0));
export function createEarthboundRenderer(host,{maxDimension=1024}={}){
 const renderer=createPixelBlastCanvas(host),canvas=renderer.canvas;
 Object.assign(canvas.style,{position:'absolute',width:'100%',height:'100%',inset:'0'});
 let frameMs=0,frameCount=0,lastFrameAt=0,frameInterval=0;
 let shapeDirection=null,shapeStarted=0,shapeFrom=[1,0,0],shapeWeights=[1,0,0];
 const shapeFor=d=>d>0?[0,1,0]:d<0?[0,0,1]:[1,0,0];
 let image=null,stats={markCount:0,shapeWeights:[1,0,0],sizeTransition:false,positionTransition:false};
 return {
  kind:'canvas',get surface(){return canvas},get allocation(){return null},
  setImage(source){image=preparePixelIdentity(source);renderer.setImage(image)},
  render({width,height,time=0,seed=0,inputs={},presence=1,artworkColor=0,inkColor=1}={}){
   if(presence<=0||inkColor<=.001){renderer.clear();return;}
   const history=inputs.chartHistory,bar=history?.at(-1),prior=history?.at(-2);
   const reported=Number.isFinite(inputs.totalHolders)&&inputs.totalHolders>0?Math.round(inputs.totalHolders):0;
   const population=history?.length?4096:reported||inputs.holderBalances?.length||0;
   if(!population){renderer.clear();stats.markCount=0;return;}
   const count=Math.min(10000,population),scale=Math.min(1,maxDimension/Math.max(width,height)),renderWidth=Math.max(1,width*scale),renderHeight=Math.max(1,height*scale);
   Object.assign(canvas.style,{width:width+'px',height:height+'px',left:'0px',top:'0px',opacity:String(unit(presence))});
   const change=bar?Math.abs(bar.close/(prior?.close||bar.open)-1):0;
   const activity=history?.length?unit(change*30+(bar.high-bar.low)/bar.open*8):unit(inputs.activity);
   const marketCap=inputs.marketCap>0?inputs.marketCap:1000;
   const artistic={marketCap,referenceCap:100000,seed,activity,level:.5,tempo:100,volume:history?.length?unit(Math.log1p(Math.max(0,bar.volume||0))/20):.5,motion:.4,change:0,depth:.5,drive:.5,pressure:.2,surge:.3,imbalance:.2,balance:.6,fresh:1,piano:.5,transient:.2,active:true};
   const mapped=labVisualMappings(pixelBlastParameters(artistic),artistic);
   const size=inputs.liquidity>0?1+11*unit((Math.log10(inputs.liquidity)-2)/6):1;
   const direction=Math.sign(Number(inputs.change)||0),now=performance.now()/1000;
   if(shapeDirection===null){shapeDirection=direction;shapeWeights=shapeFor(direction);}
   const progress=unit((now-shapeStarted)/.24),blend=progress*progress*(3-2*progress);
   if(shapeStarted)shapeWeights=shapeFrom.map((v,i)=>v+(shapeFor(shapeDirection)[i]-v)*blend);
   if(direction!==shapeDirection){shapeFrom=shapeWeights.slice();shapeDirection=direction;shapeStarted=now;}
   const params={...mapped,pixelBudget:480000,fullscreen:!!host.closest('.audio-visualizer'),identity:image?.7:0,identityMotion:0,dotSize:size,pixelSize:size,pixelPresence:1,holderCount:count,markDirection:direction,shapeWeights,artworkColor,inkColor};
   const frameStarted=performance.now();
   renderer.render({width:renderWidth,height:renderHeight,time,eventTime:time,liquidTime:time,seed,params});
   const duration=performance.now()-frameStarted;
   frameMs=frameCount?frameMs*.9+duration*.1:duration;
   if(lastFrameAt)frameInterval=frameInterval?frameInterval*.9+(frameStarted-lastFrameAt)*.1:frameStarted-lastFrameAt;
   lastFrameAt=frameStarted;frameCount++;
   if(frameCount%15===0)Object.assign(canvas.dataset,{renderMs:frameMs.toFixed(1),renderFps:frameInterval?(1000/frameInterval).toFixed(1):'0'});
   stats={...stats,shapeWeights:shapeWeights.slice(),markCount:Number(canvas.dataset.markCount)||0,reportedHolders:reported,representedPopulation:population,populationCapped:population>10000,imageAvailable:Boolean(image),renderer:'october7-pattern-count',reconstructed:Boolean(history?.length)};
  },
  snapshot(){return {...stats}},clear(){renderer.clear()},close(){renderer.close()}
 };
}
