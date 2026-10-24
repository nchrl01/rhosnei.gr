import {createPixelBlastCanvas,preparePixelIdentity} from '../public/oct07-live/pixel-blast-canvas.js';
import {pixelBlastParameters} from '../public/oct07-live/pixel-blast-parameters.js';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {earthboundPresentation,earthboundMotionFrame,earthboundFieldWarp,earthboundSoundWarp} from '../public/oct07-live/earthbound-presentation.js';
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
  expect(struck.patternWarp).toBe(active.patternWarp);expect(struck.patternSound).toBeGreaterThan(0);
  expect(struck.patternContrast).toBe(active.patternContrast);
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

describe('EarthBound sound deformation',()=>{
 it('gives bass and arps restrained articulation within procedural bands',()=>{
  const coords=[.17,-.26],points=['drum','bass','arp'].map(role=>{
   const params=earthboundPresentation({scorePulse:{attack:.8,sustain:.5,[role]:1}});
   return earthboundSoundWarp(...coords,earthboundMotionFrame(3,1917,params));
  });
  expect(new Set(points.map(p=>p.join(','))).size).toBe(3);
  for(const p of points)expect(Math.hypot(p[0]-coords[0],p[1]-coords[1])).toBeLessThan(.013);
 });
 it('leaves image coordinates untouched without a performed sound and under reduced motion',()=>{
  for(const options of [{},{scorePulse:{attack:1,drum:1},reducedMotion:true}]){
   const params=earthboundPresentation(options);
   expect(earthboundSoundWarp(.2,.3,earthboundMotionFrame(3,1917,params))).toEqual([.2,.3]);
  }
 });
});

it('keeps artwork stable when the procedural pattern is completely hidden',()=>{
 fixture(); // install the headless canvas/document adapter
 const renderer=createPixelBlastCanvas({append(){}}),pixels=new Uint8ClampedArray(16*16*4);
 for(let y=0;y<16;y++)for(let x=0;x<16;x++)pixels.set([255,255,255,x>=4&&x<12&&y>=3&&y<13?255:0],(y*16+x)*4);
 renderer.setImage(preparePixelIdentity({width:16,height:16,pixels}));
 const base={...pixelBlastParameters({marketCap:5e7,referenceCap:1e5,seed:1917,activity:.5,active:true}),
  ...earthboundPresentation({image:true,activity:.5}),identity:1,identityMotion:0,patternWarp:0,holderCount:600,
  dotSize:1,pixelPresence:1,inkColor:1,artworkColor:0,fullscreen:true};
 const render=params=>{renderer.render({width:160,height:192,time:3,seed:1917,params});return new Uint8ClampedArray(renderer.canvas.getContext().pixels.data);};
 const quiet=render(base),struck=render({...base,patternSound:1,patternChord:1,patternDrum:1});
 expect(struck).toEqual(quiet);
 expect(renderer.canvas.dataset.markCount).toBe('600');
 expect(render(base)).toEqual(quiet);
});
