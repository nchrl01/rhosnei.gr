import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createMarketReplay,replaySpeed} from '../public/market-replay.js';

const interval=60000;
const bars=Array.from({length:60},(_,index)=>({time:index*interval,open:10,high:10,low:10,close:10}));
function fixture(speed='100'){
 const replay=createMarketReplay();replay.seek(bars[0],interval);
 replay.state.speed=speed;replay.state.clock=1000;
 return replay;
}
afterEach(()=>vi.restoreAllMocks());

describe('continuous replay speeds',()=>{
 it.each([['1',1000],['50',50000],['100',100000]])('advances %s× by its real elapsed-time multiplier',(speed,elapsed)=>{
  const replay=fixture(speed);replay.advance(bars,interval,true,2000);
  expect(replay.state.cursor).toBe(interval+elapsed);
 });
 it('plays unchanged market periods at 100× without jumping to a price change or the end',()=>{
  const replay=fixture();replay.advance(bars,interval,true,2000);
  expect(replay.state.cursor).toBe(160000);
  replay.advance(bars,interval,true,2250);
  expect(replay.state.cursor).toBe(185000);
  expect(replay.state.ended).toBe(false);
 });
 it('does not advance while paused or dragging the history timeline',()=>{
  const replay=fixture();replay.advance(bars,interval,false,2000);
  expect(replay.state.cursor).toBe(interval);
  replay.state.dragging=true;replay.advance(bars,interval,true,3000);
  expect(replay.state.cursor).toBe(interval);
  replay.state.dragging=false;replay.advance(bars,interval,true,3250);
  expect(replay.state.cursor).toBe(interval+25000);
 });
 it('keeps delayed animation frames in sync with elapsed replay time',()=>{
  const replay=fixture();replay.advance(bars,interval,true,11000);
  expect(replay.state.cursor).toBe(interval+1000000);
 });
 it('clamps at the last candle and preserves the final hold before finishing',()=>{
  const replay=fixture();replay.state.cursor=bars.length*interval-500;
  expect(replay.advance(bars,interval,true,1010)).toBe(false);
  expect(replay.state.cursor).toBe(bars.length*interval);
  expect(replay.advance(bars,interval,true,2010)).toBe(true);
  expect(replay.state.ended).toBe(true);
  expect(replay.state.cursor).toBe(bars.length*interval);
 });
 it('accepts saved 100× playback and migrates the replaced legacy option to 100×',()=>{
  expect(replaySpeed(100)).toBe('100');
  expect(replaySpeed('100')).toBe('100');
  expect(replaySpeed('50')).toBe('50');
  expect(replaySpeed('1')).toBe('1');
  expect(replaySpeed('jump')).toBe('100');
  expect(replaySpeed('invalid')).toBe('1');
  expect(replaySpeed(Infinity)).toBe('1');
 });
 it('changes speed without replaying elapsed time and updates the pressed button',()=>{
  let now=1250;vi.spyOn(performance,'now').mockImplementation(()=>now);
  const replay=fixture('50'),session={controls:[]};
  const buttons=['1','50','100'].map(rate=>({dataset:{rate},attributes:{},setAttribute(name,value){this.attributes[name]=value;}}));
  const group={querySelectorAll:()=>buttons};
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const handler=app.slice(app.indexOf('function updateSpeedButtons(){'),app.indexOf("$('chart-view').onchange"));
  vm.runInNewContext(handler,{$:()=>group,replay,replaySpeed,chart:{renderedBars:bars,interval},playing:true,ctx:{state:'running'},session,Date});
  group.onclick({target:{closest:()=>buttons[2]}});
  expect(replay.state.cursor).toBe(interval+12500);
  expect(replay.state.speed).toBe('100');
  expect(buttons.map(button=>button.attributes['aria-pressed'])).toEqual(['false','false','true']);
  expect(session.controls.at(-1)).toMatchObject({name:'history-speed',value:'100'});
  now=1500;replay.advance(bars,interval,true,now);
  expect(replay.state.cursor).toBe(interval+12500+25000);
 });
 it('offers 1×, 50× and 100× in the player and documents the same controls',()=>{
  const html=readFileSync(new URL('../public/instrument.html',import.meta.url),'utf8');
  const help=readFileSync(new URL('../public/help.html',import.meta.url),'utf8');
  expect([...html.matchAll(/data-rate="([^"]+)"/g)].map(match=>match[1])).toEqual(['1','50','100']);
  expect(html).toContain('title="Replay 100 times faster">100×</button>');
  expect(html).not.toContain('Skip to changes');
  expect(help).toContain('Use 1×, 50× or 100×');
 });
});
