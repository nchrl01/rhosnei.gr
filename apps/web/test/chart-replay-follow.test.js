import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,expect,it,vi} from 'vitest';

const source=readFileSync(new URL('../public/chart.js',import.meta.url),'utf8')
 .replace(/^import .*\n/gm,'').replace('export class MarketChart','globalThis.MarketChart=class MarketChart');
const interval=60000;
function fixture(){
 const elements=new Map(),events=new Map(),windowEvents=new Map(),frames=[],timers=new Map();let timerId=0;
 const element=id=>{
  if(!elements.has(id))elements.set(id,{style:{},hidden:false,textContent:''});
  return elements.get(id);
 };
 let visible={from:0,to:20},pending=null,width=1000;
 const scale={
  width:()=>width,height:()=>24,getVisibleLogicalRange:()=>visible,
  // Lightweight Charts queues range changes until its next paint.
  setVisibleLogicalRange:vi.fn(range=>{pending=range;}),
  // Its integer guard returns zero for fractional logical indices.
  logicalToCoordinate:vi.fn(index=>Number.isInteger(index)?(index-visible.from)/(visible.to-visible.from)*width:0),
 };
 const chartApi={
  timeScale:()=>scale,addSeries:()=>({priceScale:()=>({applyOptions(){}})}),
  subscribeCrosshairMove(){},subscribeClick(fn){this.click=fn;},
 };
 const container={addEventListener:(name,fn)=>events.set(name,fn)};
 const context=vm.createContext({
  createChart:()=>chartApi,CandlestickSeries:{},LineSeries:{},HistogramSeries:{},
  createChartTicks:()=>({update(){},live(){}}),
  candleEnd:(bar,step)=>Math.min(bar.time+step,bar.observedThrough??bar.lastAt??bar.time+step),
  document:{getElementById:element},window:{addEventListener:(name,fn)=>windowEvents.set(name,fn)},
  setInterval(){},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},
  setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
  performance:{now:()=>1500},Intl,
 });
 vm.runInContext(source,context);
 const chart=new context.MarketChart(container);
 chart.renderedBars=Array.from({length:40},(_,index)=>({time:index*interval,close:index+1}));
 const state={active:true,cursor:interval,clock:null,speed:'1',dragging:false,ended:false,frozen:{bars:chart.renderedBars}};
 chart.readReplay=()=>state;chart.replayIsPlaying=()=>true;chart.playhead=element('replay-playhead');
 chart.onReplayPanStart=()=>{state.dragging=true;};
 chart.onReplayPan=vi.fn(at=>{state.cursor=at;});
 chart.onReplayPanEnd=()=>{state.dragging=false;};
 return {
  chart,state,scale,events,windowEvents,chartApi,
  paint(){if(pending){visible=pending;pending=null;}},
  resize(value){width=value;},range(value){visible=value;},
  flushFrame(){for(const fn of frames.splice(0))fn();},
  flushTimers(){for(const fn of timers.values())fn();timers.clear();},
 };
}

describe('centered replay chart cursor',()=>{
 it('centers the first historical candle immediately, before the chart repaints',()=>{
  const f=fixture();f.chart.followReplay();
  expect(f.scale.setVisibleLogicalRange).toHaveBeenLastCalledWith({from:-10,to:10});
  expect(f.chart.playhead.style.left).toBe('500px');
  expect(f.chart.playhead.style.bottom).toBe('24px');
  expect(f.chart.playhead.hidden).toBe(false);
 });
 it('keeps fractional playback centered while scrolling history at the same zoom',()=>{
  const f=fixture();f.chart.followReplay();f.paint();
  f.state.cursor=3.25*interval;f.chart.followReplay();
  expect(f.scale.setVisibleLogicalRange).toHaveBeenLastCalledWith({from:-7.75,to:12.25});
  expect(f.chart.playhead.style.left).toBe('500px');
  expect(f.state.cursor).toBe(3.25*interval);
  f.paint();f.resize(600);f.chart.followReplay();
  expect(f.chart.playhead.style.left).toBe('300px');
 });
 it('keeps the line centered even when automatic following is suspended',()=>{
  const f=fixture();f.chart.replayFollowing=false;f.state.cursor=3.5*interval;
  f.chart.followReplay();
  expect(f.scale.logicalToCoordinate).not.toHaveBeenCalled();
  expect(f.chart.playhead.style.left).toBe('500px');
  expect(f.scale.setVisibleLogicalRange).not.toHaveBeenCalled();
 });
 it('uses the audio clock for smooth fractional playback without moving the score',()=>{
  const f=fixture();f.chart.replayFollowing=false;f.state.clock=1000;f.state.speed='50';
  f.chart.followReplay();
  expect(f.chart.playhead.style.left).toBe('500px');
  expect(f.state.cursor).toBe(interval);
 });
 it('scrubs history under the centered line while dragging and resumes from that point',()=>{
  const f=fixture();f.chart.onHistorySeek=vi.fn();
  f.events.get('pointerdown')({pointerId:7,clientX:30,clientY:20});
  f.events.get('pointermove')({pointerId:7,clientX:80,clientY:20});
  f.range({from:5,to:25});f.chart.followReplay();
  expect(f.chart.onReplayPan).toHaveBeenCalledWith(16*interval);
  expect(f.state.dragging).toBe(true);
  expect(f.state.cursor).toBe(16*interval);
  f.windowEvents.get('pointerup')({pointerId:7});
  f.chartApi.click({time:0});f.chart.followReplay();
  expect(f.chart.replayFollowing).toBe(false);
  expect(f.chart.manual).toBe(true);
  expect(f.chart.needsFit).toBe(false);
  expect(f.chart.onHistorySeek).not.toHaveBeenCalled();
  expect(f.scale.setVisibleLogicalRange).not.toHaveBeenCalled();
  f.flushFrame();
  expect(f.chart.replayFollowing).toBe(true);
  expect(f.state.dragging).toBe(false);
  expect(f.chart.playhead.style.left).toBe('500px');
  expect(f.state.cursor).toBe(16*interval);
 });
 it('still seeks on a click without dragging and allows the seek to resume following',()=>{
  const f=fixture();
  f.chart.onHistorySeek=vi.fn(()=>f.chart.resumeReplayFollow());
  f.events.get('pointerdown')({pointerId:7,clientX:30,clientY:20});
  f.events.get('pointermove')({pointerId:7,clientX:32,clientY:20});
  f.windowEvents.get('pointerup')({pointerId:7});f.chartApi.click({time:0});
  expect(f.chart.onHistorySeek).toHaveBeenCalledWith(f.chart.renderedBars[0],false);
  expect(f.chart.replayFollowing).toBe(true);
 });
 it('keeps the line centered through wheel navigation and resumes at its new center',()=>{
  const f=fixture();f.events.get('wheel')({deltaX:80,deltaY:0});f.range({from:20,to:40});f.chart.followReplay();
  expect(f.chart.replayFollowing).toBe(false);
  expect(f.scale.setVisibleLogicalRange).not.toHaveBeenCalled();
  expect(f.chart.playhead.style.left).toBe('500px');
  expect(f.state.cursor).toBe(31*interval);
  f.flushTimers();expect(f.chart.replayFollowing).toBe(true);
  expect(f.state.dragging).toBe(false);
 });
 it('zooms out without putting playback into the seeking state',()=>{
  const f=fixture(),cursor=f.state.cursor;
  f.events.get('wheel')({deltaX:0,deltaY:120});
  expect(f.state.dragging).toBe(false);
  expect(f.chart.replayPanning).toBeFalsy();
  expect(f.chart.onReplayPan).not.toHaveBeenCalled();
  expect(f.state.cursor).toBe(cursor);
  expect(f.chart.replayFollowing).toBe(true);
  f.range({from:-20,to:40});f.chart.followReplay();
  expect(f.scale.setVisibleLogicalRange).toHaveBeenLastCalledWith({from:-30,to:30});
 });
 it('treats a mostly vertical trackpad gesture as zoom, even with horizontal noise',()=>{
  const f=fixture();f.events.get('wheel')({deltaX:2,deltaY:80,ctrlKey:true});
  expect(f.state.dragging).toBe(false);
  expect(f.chart.replayFollowing).toBe(true);
 });
 it('keeps the final candle centered and hides the cursor when returning live',()=>{
  const f=fixture();f.state.cursor=40*interval;f.state.ended=true;f.chart.followReplay();
  expect(f.scale.setVisibleLogicalRange).toHaveBeenLastCalledWith({from:29,to:49});
  expect(f.chart.playhead.style.left).toBe('500px');
  f.state.active=false;f.chart.followReplay();expect(f.chart.playhead.hidden).toBe(true);
 });
 it('never loses the centered line when browsing another part of history',()=>{
  const f=fixture();f.chart.replayFollowing=false;f.range({from:10,to:30});f.chart.followReplay();
  expect(f.chart.playhead.hidden).toBe(false);
  expect(f.chart.playhead.style.left).toBe('500px');
 });
 it('renders one vertical line without top or bottom handles',()=>{
  const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
  expect(css).toContain('#replay-playhead{');
  expect(css).not.toMatch(/#replay-playhead::(?:before|after)/);
  expect(css).toMatch(/#replay-playhead\{[^}]*pointer-events:none/);
 });
});
