import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createChipVisualEvents} from '../public/chip-visual-events.js';

describe('visual cues survive audio lookahead replanning',()=>{
 it('admits the first sounded packet while the synchronous Play frame is still catching up',()=>{
  const source=readFileSync(new URL('../public/upic-earthbound-visual.js',import.meta.url),'utf8');
  const start=source.indexOf('  scoreEvent(event={}){'),stop=source.indexOf('  // Raw market',start);
  const cues=createChipVisualEvents(),sandbox={scoreClock:()=>.9,closed:false,key:'coin',
   getState:()=>({playing:true,master:1,coinKey:'coin'}),identityKey:value=>value,
   scoreEvents:cues,settings:{playing:false},event:{id:'first',time:1,kind:'texture',gain:.02,duration:.06}};
  runInNewContext('const receiver={'+source.slice(start,stop)+'}; receiver.scoreEvent(event);',sandbox);
  expect(cues.sample(1.02).texture).toBeGreaterThan(0);
 });
 it('replaces a cancelled onset with the same score ID before the next visual frame',()=>{
  const cues=createChipVisualEvents();let cancelled=false;
  const note={id:'bar:arp:seed',time:1,kind:'arp',gain:.025,duration:.25,midi:72,direction:1};
  expect(cues.enqueue({...note,isCancelled:()=>cancelled},.9)).toBe(true);
  // The 25 ms score timer can replace an onset before the 30 fps renderer
  // samples its previous cancellation. Only the replacement will be heard.
  cancelled=true;
  expect(cues.enqueue({...note,isCancelled:()=>false},.925)).toBe(true);
  expect(cues.enqueue({...note,isCancelled:()=>false},.926)).toBe(false);
  const pulse=cues.sample(1.02);
  expect(pulse.events).toBe(1);
  expect(pulse.arp).toBeGreaterThan(.4);
  expect(pulse.direction).toBe(1);
 });
 it.each([false,true])('shares the final replay hold/end flag with the audible transport (ended=%s)',ended=>{
  // Execute the production transport-to-visual bridge before its unrelated
  // DOM readouts. A final candle is audible during endHold, until ended.
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const start=source.indexOf('function syncLevels(m){');
  const stop=source.indexOf(' piano?.resonance(',start);
  expect(start).toBeGreaterThanOrEqual(0);expect(stop).toBeGreaterThan(start);
  const result={},sandbox={
   piano:null,pianoMusic:()=>({}),sharedHarmony:null,playing:true,captureMode:false,seed:1,
   replay:{state:{active:true,dragging:false,ended,endHold:123,cursor:60000,speed:'1'}},
   chart:{interval:60000,renderedBars:[]},ctx:{currentTime:1},outputGateOpen:null,
   gain:{gain:{setTargetAtTime(value){result.audible=value;}}},
   updateCoinReadout(){},replayVisualHistory:{frame(){}},
   dataVisual:{frame(_metrics,options){result.visual=options;}}
  };
  runInNewContext(source.slice(start,stop)+'\n}\nsyncLevels({});',sandbox);
  expect(result.audible).toBe(ended?0:1);
  expect(result.visual.ended).toBe(ended);
  expect(result.visual.playing&&!result.visual.seeking&&!result.visual.ended).toBe(result.audible===1);
 });
});
