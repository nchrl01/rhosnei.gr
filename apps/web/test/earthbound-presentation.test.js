import {afterEach,describe,expect,it,vi} from 'vitest';
import {earthboundPresentation,earthboundMotionFrame,earthboundFieldWarp} from '../public/oct07-live/earthbound-presentation.js';
import {EARTHBOUND_LOOP_DURATION} from '../public/oct07-live/earthbound-loop.js';
import {createEarthboundRenderer} from '../public/upic-oct07-renderer.js';

afterEach(()=>vi.unstubAllGlobals());
function fixture(){
 const canvases=[];
 vi.stubGlobal('document',{createElement(){
  const canvas={style:{},dataset:{},setAttribute(){},remove(){}};
  const context={clearRect(){},createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),
   putImageData(pixels){this.pixels=pixels;},drawImage(layer){this.pixels=layer.context.pixels;}};
  canvas.context=context;canvas.getContext=()=>context;canvases.push(canvas);return canvas;
 }});
 vi.stubGlobal('devicePixelRatio',1);
 const renderer=createEarthboundRenderer({append(){},closest(){return {};}});
 const pixels=new Uint8ClampedArray(16*16*4);
 for(let y=0;y<16;y++)for(let x=0;x<16;x++)pixels.set([255,255,255,x>=4&&x<12&&y>=3&&y<13?255:0],(y*16+x)*4);
 renderer.setImage({width:16,height:16,pixels});
 const inputs={totalHolders:600,marketCap:50000000,liquidity:100000,activity:.5,tradingActivity:.5,fresh:1,change:0};
 const render=(time,extra={})=>{
  renderer.render({width:160,height:192,time,seed:1917,inputs,identity:1,...extra});
  return new Uint8ClampedArray(canvases[0].context.pixels.data);
 };
 return {renderer,render,inputs};
}

describe('readable EarthBound presentation',()=>{
 it('keeps cap progression and a visible procedural share at full artwork identity',()=>{
  const blends=[0,.25,.5,.75,1].map(identity=>earthboundPresentation({identity,image:true}).identity);
  expect(blends[0]).toBeCloseTo(.3,12);expect(blends.at(-1)).toBeCloseTo(.68,12);
  expect(blends.every((blend,index)=>index===0||blend>blends[index-1])).toBe(true);
  expect(1-blends.at(-1)).toBeGreaterThanOrEqual(.32);
  expect(earthboundPresentation({identity:1,image:false}).identity).toBe(0);
 });
 it('keeps idle motion restrained and makes actual score onsets increase bounded emphasis',()=>{
  const idle=earthboundPresentation(),active=earthboundPresentation({activity:1});
  const struck=earthboundPresentation({activity:1,scorePulse:{attack:1,sustain:1,texture:1,echo:1}});
  expect(idle.patternWarp).toBe(.016);expect(active.patternWarp).toBeGreaterThan(idle.patternWarp);
  expect(struck.patternWarp).toBeGreaterThan(active.patternWarp);expect(struck.patternWarp).toBeLessThan(.12);
  expect(struck.patternContrast).toBeGreaterThan(active.patternContrast);
  expect(earthboundPresentation({activity:1,scorePulse:{attack:1,sustain:1},reducedMotion:true}).patternWarp).toBe(0);
  expect(struck.patternNoiseOctaves).toBeLessThan(5);
 });
 it.each([1,1917,424242])('keeps presentation warping periodic and continuous for seed %s',seed=>{
  const params=earthboundPresentation({activity:.8,scorePulse:{attack:.7,pitch:.3}});
  for(const time of [0,.125,6,23.875]){
   const frame=earthboundMotionFrame(time,seed,params),repeat=earthboundMotionFrame(time+EARTHBOUND_LOOP_DURATION,seed,params);
   expect(repeat).toEqual(frame);
   expect(earthboundFieldWarp(.12,-.35,repeat)).toEqual(earthboundFieldWarp(.12,-.35,frame));
  }
  const before=earthboundFieldWarp(.12,-.35,earthboundMotionFrame(EARTHBOUND_LOOP_DURATION-1e-6,seed,params));
  const after=earthboundFieldWarp(.12,-.35,earthboundMotionFrame(1e-6,seed,params));
  expect(Math.hypot(before[0]-after[0],before[1]-after[1])).toBeLessThan(1e-6);
 });
 it('loops the production pixels exactly with fixed market and sound controls',()=>{
  const f=fixture(),extra={scorePulse:{attack:.4,sustain:.2,echo:.1,pitch:.6}};
  for(const time of [0,.125,6,23.875])expect(f.render(time+EARTHBOUND_LOOP_DURATION,extra)).toEqual(f.render(time,extra));
  expect(f.render(6,extra)).not.toEqual(f.render(0,extra));
 });
 it('renders a visible sound trigger without changing the represented holder count or mark sizes',()=>{
  const f=fixture(),quiet=f.render(3),quietSize=f.renderer.surface.dataset.dotSize;
  const struck=f.render(3,{scorePulse:{attack:1,sustain:.5,pitch:.8}});
  expect(struck).not.toEqual(quiet);
  expect(f.renderer.snapshot().markCount).toBe(600);
  expect(f.renderer.surface.dataset.dotSize).toBe(quietSize);
  expect(f.render(3)).toEqual(quiet);
 });
});
