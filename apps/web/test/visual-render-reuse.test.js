import {afterEach,describe,expect,it,vi} from 'vitest';
import {createEarthboundRenderer} from '../public/upic-oct07-renderer.js';

afterEach(()=>vi.unstubAllGlobals());
function fixture(){
 const paint=vi.fn(),context={clearRect(){},drawImage(){},putImageData:paint,createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)})};
 vi.stubGlobal('document',{createElement:()=>({style:{},dataset:{},setAttribute(){},getContext:()=>context,remove(){}})});
 vi.stubGlobal('devicePixelRatio',2);
 const renderer=createEarthboundRenderer({append(){},closest(){return {}}});
 const inputs={totalHolders:1000,marketCap:1000000,liquidity:100000,activity:.4,change:0};
 const render=(overrides={})=>renderer.render({width:128,height:128,time:1,seed:123,inputs,...overrides});
 return {renderer,paint,render,inputs};
}
describe('resting visual frame reuse',()=>{
 it('keeps a still preview without rebuilding its pixel buffer',()=>{
  const f=fixture();f.render();const marks=f.renderer.snapshot().markCount;
  for(let n=0;n<60;n++)f.render();
  expect(f.paint).toHaveBeenCalledTimes(1);expect(f.renderer.snapshot().markCount).toBe(marks);
 });
 it('renders moving clocks and changed market inputs immediately',()=>{
  const f=fixture();f.render();f.render({time:1.033});
  f.render({inputs:{...f.inputs,liquidity:250000}});
  f.render({inputs:{...f.inputs,totalHolders:500}});
  expect(f.paint).toHaveBeenCalledTimes(4);expect(f.renderer.snapshot().markCount).toBe(500);
 });
 it('invalidates the retained frame after resize, new artwork, and clear',()=>{
  const f=fixture();f.render();f.render({width:160});
  f.renderer.setImage(null);f.render({width:160});
  f.renderer.clear();f.render({width:160});
  expect(f.paint).toHaveBeenCalledTimes(4);
 });
 it('restores the same frame after the transport fades fully out',()=>{
  const f=fixture();f.render();f.render({inkColor:0});
  expect(f.renderer.snapshot().markCount).toBe(0);
  f.render();expect(f.paint).toHaveBeenCalledTimes(2);
  expect(f.renderer.snapshot().markCount).toBe(1000);
 });
});
