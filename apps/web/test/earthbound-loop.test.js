import {afterEach,describe,expect,it,vi} from 'vitest';
import {EARTHBOUND_LOOP_DURATION as period} from '../public/oct07-live/earthbound-loop.js';
import {battlePattern,battlePatternFeed} from '../public/oct07-live/earthbound-pattern.js';
import {createPixelBlastCanvas,preparePixelIdentity} from '../public/oct07-live/pixel-blast-canvas.js';
import {pixelBlastParameters} from '../public/oct07-live/pixel-blast-parameters.js';

afterEach(()=>vi.unstubAllGlobals());
function renderer(seed){
 const canvas=()=>{const node={style:{},dataset:{},setAttribute(){},remove(){}};node.context={clearRect(){},createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData(data){this.pixels=data;},drawImage(source){this.pixels=source.context.pixels;}};node.getContext=()=>node.context;return node;};
 vi.stubGlobal('document',{createElement:canvas});vi.stubGlobal('devicePixelRatio',2);
 const field=createPixelBlastCanvas({append(){}}),pixels=new Uint8ClampedArray(16*16*4);
 for(let i=0;i<pixels.length;i+=4)pixels.set([(i*3)%256,(i*7)%256,(i*13)%256,255],i);
 field.setImage(preparePixelIdentity({width:16,height:16,pixels}));
 const params={...pixelBlastParameters({active:true,fresh:1,seed}),holderCount:1000,pixelPresence:1,identity:.7,identityMotion:0,dotSize:5,inkColor:1,artworkColor:1,shapeWeights:[1,0,0],pixelBudget:480000};
 return time=>{field.render({width:128,height:160,time,seed,params});return new Uint8ClampedArray(field.canvas.context.pixels.data);};
}
describe('seamless Earthbound visual cycle',()=>{
 it.each([1,22,999,424242])('returns both procedural layers to the same state for seed %s',seed=>{
  for(const time of [0,.125,3.5,12,23.875])expect(battlePattern(seed,time+period)).toEqual(battlePattern(seed,time));
 });
 it.each([1,22,999,424242])('returns the complete rendered pixels, including noise and palette, for seed %s',seed=>{
  const render=renderer(seed);
  for(const time of [0,.125,6,23.875])expect(render(time+period)).toEqual(render(time));
  expect(render(6)).not.toEqual(render(0));
 });
 it('keeps the feed continuous on both sides of the seam',()=>{
  for(const seed of [1,22,999,424242])for(const [x,y] of [[.13,.21],[-.37,.18],[.31,-.44]]){
   const sample=time=>battlePatternFeed(x,y,time,battlePattern(seed,time),.35);
   const epsilon=.000001;
   expect(Math.abs(sample(period-epsilon)-sample(epsilon))).toBeLessThan(.0001);
  }
 });
});
