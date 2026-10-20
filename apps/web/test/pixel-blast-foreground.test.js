import {afterEach,describe,expect,it,vi} from 'vitest';
import {artworkForeground} from '../public/oct07-live/artwork-foreground.js';
import {preparePixelIdentity,createPixelBlastCanvas} from '../public/oct07-live/pixel-blast-canvas.js';
import {pixelBlastParameters} from '../public/oct07-live/pixel-blast-parameters.js';

const W=32;
function artwork(background,foreground,{transparent=false}={}){
 const pixels=new Uint8ClampedArray(W*W*4);
 for(let y=0;y<W;y++)for(let x=0;x<W;x++){
  const subject=x>=9&&x<13&&y>=6&&y<27||x>=13&&x<23&&y>=6&&y<10||x>=19&&x<23&&y>=10&&y<18||x>=13&&x<23&&y>=15&&y<19;
  const i=(y*W+x)*4,value=subject?foreground:background;
  pixels.set([value,value,value,transparent&&!subject?0:255],i);
 }
 return {width:W,height:W,pixels,originalPixels:pixels};
}

describe('artwork subject polarity',()=>{
 it('lights a white symbol on a dark background instead of the surrounding square',()=>{
  const source=artwork(0,255),mask=preparePixelIdentity(source);
  expect(mask.polarity).toBe('light');
  expect(mask.confidence).toBeGreaterThan(.9);
  expect(mask.data[8*W+10]).toBe(255);
  expect(mask.data[1*W+1]).toBe(0);
  expect(mask.sizeData[11*W+10]).toBeGreaterThan(mask.sizeData[1*W+1]);
  expect(mask.rgba).toBe(source.originalPixels);
 });
 it('gives the same foreground to the inverse artwork',()=>{
  const light=preparePixelIdentity(artwork(0,255)),dark=preparePixelIdentity(artwork(255,0));
  expect(dark.polarity).toBe('dark');
  expect(dark.data).toEqual(light.data);
  expect(dark.sizeData).toEqual(light.sizeData);
 });
 it.each([0,255])('keeps a transparent symbol regardless of its brightness (%s)',tone=>{
  const source=artwork(0,tone,{transparent:true}),mask=preparePixelIdentity(source);
  expect(mask.polarity).toBe('alpha');
  expect(mask.data[8*W+10]).toBe(255);
  expect(mask.data[1*W+1]).toBe(0);
 });
 it('keeps the whole shaded transparent symbol and ignores hidden background RGB',()=>{
  const source=artwork(0,255,{transparent:true});
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){
   const i=(y*W+x)*4;
   if(!source.pixels[i+3])source.pixels.set([70,110,75,0],i);
   else{const shade=32+(x*37+y*59)%192;source.pixels.set([shade,shade,shade,255],i);}
  }
  const mask=preparePixelIdentity(source);
  expect(mask.polarity).toBe('alpha');
  for(let n=0;n<W*W;n++)expect(mask.data[n]).toBe(source.pixels[n*4+3]);
 });
 it('reads the visible badge edge when a dark badge has transparent corners',()=>{
  const source=artwork(0,255);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++)if(Math.hypot(x-15.5,y-15.5)>15)source.pixels[(y*W+x)*4+3]=0;
  const mask=preparePixelIdentity(source);
  expect(mask.polarity).toBe('light');
  expect(mask.data[8*W+10]).toBe(255);
  expect(mask.data[0]).toBe(0);
 });
 it('does not guess a new polarity for an opaque busy border',()=>{
  const pixels=new Uint8ClampedArray(W*W*4);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){
   const n=(y*W+x)*4;
   pixels.set([(x*67+y*29)%256,(x*37+y*53)%256,(x*13+y*97)%256,255],n);
  }
  expect(artworkForeground(pixels,W,W)).toMatchObject({polarity:'dark',confidence:0,background:null});
 });
});

function fakeCanvas(){
 const canvas={width:0,height:0,style:{},dataset:{},setAttribute(){},remove(){}};
 const context={
  createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),
  clearRect(){},putImageData(data){this.pixels=data;},
  drawImage(source){this.pixels=source.context.pixels;},
 };
 canvas.context=context;canvas.getContext=()=>context;
 return canvas;
}
afterEach(()=>vi.unstubAllGlobals());
function accentRenderer(){
 vi.stubGlobal('document',{createElement:()=>fakeCanvas()});
 vi.stubGlobal('devicePixelRatio',1);
 const renderer=createPixelBlastCanvas({append(){}}),base=pixelBlastParameters({active:true,fresh:1,level:.5,seed:205});
 const params={...base,holderCount:100,pixelPresence:1,edgeFade:.05,dotSize:8,identity:0,identityMotion:0,inkColor:1,artworkColor:0};
 const render=(weights,overrides={})=>{
  renderer.render({width:128,height:128,time:3,seed:205,params:{...params,...overrides,shapeWeights:weights}});
  return new Uint8ClampedArray(renderer.canvas.context.pixels.data);
 };
 return {renderer,render};
}
function colours(pixels){
 const result=[];
 for(let n=0;n<pixels.length;n+=4)if(pixels[n+3])result.push([...pixels.slice(n,n+3)]);
 return result;
}
function expectNeutral(pixels){
 const visible=colours(pixels);
 expect(visible.length).toBeGreaterThan(0);
 expect(visible.every(rgb=>rgb.every(channel=>channel===255))).toBe(true);
}
describe('stable directional accents',()=>{
 it('colours the same minority of resolved pluses green and crosses red',()=>{
  const {renderer,render}=accentRenderer();
  const up=render([0,1,0]),accentCount=Number(renderer.canvas.dataset.accentMarkCount);
  expect(Number(renderer.canvas.dataset.markCount)).toBe(100);
  expect(accentCount).toBeGreaterThan(8);expect(accentCount).toBeLessThan(32);
  expect(colours(up)).toContainEqual([81,215,123]);
  expect(colours(up)).toContainEqual([255,255,255]);
  expect(render([0,1,0])).toEqual(up);
  expect(colours(render([0,0,1]))).toContainEqual([255,102,114]);
  expect(Number(renderer.canvas.dataset.accentMarkCount)).toBe(accentCount);
  expect(render([0,1,0])).toEqual(up);
  expect(Number(renderer.canvas.dataset.markCount)).toBe(100);
 });
 it.each([-1,0,1])('keeps resolved dots neutral even with direction %s',direction=>{
  const {renderer,render}=accentRenderer();
  render([0,1,0]);
  expectNeutral(render([1,0,0],{markDirection:direction}));
  expect(Number(renderer.canvas.dataset.accentMarkCount)).toBe(0);
  expect(Number(renderer.canvas.dataset.markCount)).toBe(100);
 });
 it.each([[.5,.5,0],[.5,0,.5],[.001,.999,0],[.001,0,.999],[0,.5,.5],[.2,.4,.4]])('keeps morph weights %j in the neutral palette',(...weights)=>{
  const {renderer,render}=accentRenderer();
  render([0,1,0]);
  expectNeutral(render(weights));
  expect(Number(renderer.canvas.dataset.accentMarkCount)).toBe(0);
  expect(Number(renderer.canvas.dataset.markCount)).toBe(100);
 });
 it.each([1,2])('does not colour the tiny circle fallback at size %s',dotSize=>{
  const {renderer,render}=accentRenderer();
  for(const weights of [[0,1,0],[0,0,1]]){
   expectNeutral(render(weights,{dotSize}));
   expect(Number(renderer.canvas.dataset.accentMarkCount)).toBe(0);
   expect(Number(renderer.canvas.dataset.markCount)).toBe(100);
  }
 });
 it('preserves milestone artwork colours on dots and transitional shapes',()=>{
  const {renderer,render}=accentRenderer(),mask=preparePixelIdentity(artwork(0,255));
  for(let n=0;n<mask.colors.length;n+=3)mask.colors.set([.2,.4,.8],n);
  renderer.setImage(mask);
  for(const weights of [[1,0,0],[.5,.5,0],[.5,0,.5],[0,.5,.5]]){
   const visible=colours(render(weights,{artworkColor:1}));
   expect(visible).toContainEqual([51,102,204]);
   expect(visible.every(rgb=>rgb.join(',')==='51,102,204'||rgb.join(',')==='255,255,255')).toBe(true);
   expect(Number(renderer.canvas.dataset.accentMarkCount)).toBe(0);
  }
 });
});
