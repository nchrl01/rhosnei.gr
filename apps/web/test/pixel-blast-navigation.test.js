import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createPixelBlastCanvas} from '../public/oct07-live/pixel-blast-canvas.js';
import {pixelBlastParameters} from '../public/oct07-live/pixel-blast-parameters.js';

function fakeCanvas(){
 const canvas={width:0,height:0,style:{opacity:''},dataset:{},setAttribute(){},remove(){}};
 const context={
  createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),
  clearRect(){},putImageData(data){this.pixels=data;},
  drawImage(source){this.pixels=source.context.pixels;},
 };
 canvas.context=context;canvas.getContext=()=>context;
 return canvas;
}
let now;
beforeEach(()=>{
 now=1000;
 vi.stubGlobal('document',{createElement:()=>fakeCanvas()});
 vi.stubGlobal('devicePixelRatio',1);
 vi.spyOn(performance,'now').mockImplementation(()=>now);
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

const ordered=marks=>marks.toSorted((a,b)=>a.y-b.y||a.x-b.x);
function player(){
 const renderer=createPixelBlastCanvas({append(){}});
 const base=pixelBlastParameters({active:true,fresh:1,level:.5,seed:205});
 function render({holders=40,seed=205,width=128,height=128,inkColor=1}={}){
  renderer.render({width,height,time:3,seed,params:{
   ...base,holderCount:holders,pixelPresence:1,edgeFade:.05,dotSize:8,
   identity:0,identityMotion:0,inkColor,artworkColor:0,shapeWeights:[1,0,0],
  }});
  return renderer.captureMarks();
 }
 return {renderer,render};
}
function expectGeometry(actual,expected){
 expect(actual).toHaveLength(expected.length);
 const a=ordered(actual),b=ordered(expected);
 for(let i=0;i<a.length;i++){
  expect(a[i].x).toBeCloseTo(b[i].x,10);
  expect(a[i].y).toBeCloseTo(b[i].y,10);
  expect(a[i].diameter).toBeCloseTo(b[i].diameter,10);
 }
}

describe('one-shot particle navigation',()=>{
 it.each([[40,80],[80,40]])('morphs %s holders to exactly %s without continuing to glide',(
  oldCount,newCount,
 )=>{
  const live=player(),reference=player(),destination={holders:newCount,seed:319};
  const source=live.render({holders:oldCount,inkColor:.4});
  live.renderer.canvas.style.opacity='.6';
  const snapshot=live.renderer.captureMarks(),target=reference.render(destination);
  live.renderer.beginNavigation(snapshot);
  expect(live.renderer.navigationState()).toMatchObject({active:true,progress:0,sourceOpacity:.6});
  // Loading time does not consume the animation: its clock starts on the
  // first render for the new coin.
  now=5000;
  const first=live.render(destination);
  expectGeometry(first.marks,source.marks);
  expect(first.inkColor).toBeCloseTo(.4,10);
  expect(first.marks.every(mark=>mark.alpha===1)).toBe(true);

  now=5400;
  const middle=live.render(destination),from=ordered(source.marks),to=ordered(target.marks);
  expect(live.renderer.navigationState()).toMatchObject({active:true,progress:.5});
  expect(middle.marks).toHaveLength(Math.max(oldCount,newCount));
  expect(middle.marks.some(mark=>mark.alpha===.5)).toBe(true);
  expect(middle.inkColor).toBeCloseTo(.7,10);
  for(let i=0;i<middle.marks.length;i++){
   const a=from[Math.floor(i*oldCount/middle.marks.length)],b=to[Math.floor(i*newCount/middle.marks.length)];
   expect(middle.marks[i].x).toBeCloseTo((a.x+b.x)/2,10);
   expect(middle.marks[i].y).toBeCloseTo((a.y+b.y)/2,10);
  }

  now=5800;
  const final=live.render(destination);
  expect(live.renderer.navigationState()).toMatchObject({active:false,progress:1});
  expect(final.marks).toHaveLength(newCount);
  expect(final.marks.every(mark=>mark.alpha===1)).toBe(true);
  expectGeometry(final.marks,target.marks);
  expect(Number(live.renderer.canvas.dataset.markCount)).toBe(newCount);
  now=12000;
  const settled=live.render(destination);
  expectGeometry(settled.marks,final.marks);
  expect(live.renderer.navigationState().active).toBe(false);
 });

 it('starts from the displayed position after resizing using normalized marks',()=>{
  const live=player(),reference=player();
  const source=live.render({width:128,height:128,holders:40});
  const destination={width:256,height:256,holders:60,seed:319};
  live.renderer.beginNavigation(source);
  const first=live.render(destination);
  expectGeometry(first.marks,source.marks);
  expect(live.renderer.canvas.width).toBe(256);
  now+=800;
  expectGeometry(live.render(destination).marks,reference.render(destination).marks);
 });

 it('cancels a pending morph and renders the target directly',()=>{
  const live=player(),reference=player(),destination={holders:80,seed:319};
  live.renderer.beginNavigation(live.render());
  live.render(destination);now+=400;live.render(destination);
  live.renderer.cancelNavigation();
  expect(live.renderer.navigationState().active).toBe(false);
  expectGeometry(live.render(destination).marks,reference.render(destination).marks);
 });

 it('starts a second navigation from the currently displayed intermediate marks',()=>{
  const live=player();
  live.renderer.beginNavigation(live.render({holders:40}));
  live.render({holders:80,seed:319});
  now+=400;
  const interrupted=live.render({holders:80,seed:319});
  live.renderer.beginNavigation(interrupted);
  const restarted=live.render({holders:60,seed:511});
  expectGeometry(restarted.marks,interrupted.marks);
  expect(restarted.marks.map(mark=>mark.alpha).sort()).toEqual(interrupted.marks.map(mark=>mark.alpha).sort());
  expect(live.renderer.navigationState()).toMatchObject({active:true,progress:0});
  now+=800;
  expect(live.render({holders:60,seed:511}).marks).toHaveLength(60);
  expect(live.renderer.navigationState().active).toBe(false);
 });

 it('closes without retaining a pending morph or captured marks',()=>{
  const live=player();
  live.renderer.beginNavigation(live.render());
  live.render({holders:80,seed:319});
  live.renderer.close();
  expect(live.renderer.navigationState().active).toBe(false);
  expect(live.renderer.captureMarks()).toBeNull();
 });

 it('clears captured marks and cancels a pending morph before the next render',()=>{
  const live=player(),reference=player(),destination={holders:80,seed:319};
  live.renderer.beginNavigation(live.render());
  live.render(destination);now+=400;live.render(destination);
  live.renderer.clear();
  expect(live.renderer.captureMarks()).toBeNull();
  expect(live.renderer.navigationState().active).toBe(false);
  expectGeometry(live.render(destination).marks,reference.render(destination).marks);
 });

 it('does not animate when no prior marks are supplied',()=>{
  const live=player();
  for(const source of [null,{marks:[]}]){
   live.renderer.beginNavigation(source);
   expect(live.renderer.navigationState().active).toBe(false);
   expect(live.render({holders:25}).marks).toHaveLength(25);
  }
 });
});
