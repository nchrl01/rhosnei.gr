import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../apps/web/public/coin-snapshot-store.js',import.meta.url),'utf8');
function pixels(bright=255){const data=new Uint8ClampedArray(512*512*4);data.set([bright,bright,bright,255],0);return {width:512,height:512,getContext:()=>({getImageData:()=>({data})}),toBlob:callback=>callback(new Blob(['fixture'],{type:'image/webp'}))};}
function fixture({markCount=37,bright=255}={}){
 let now=100000,tick,closed=false;const events=[],statuses=[];
 const frame=pixels(bright),state={sourceCoinKey:'ethereum:0x123',renderedPlaying:true,holderSnapshotReady:true,holderSource:'observed-wallet-sample',holderLoading:false,markCount,transportPresence:1,renderedAt:now,imageAvailable:true,totalHolders:markCount};
 const market={chainId:'ethereum',baseToken:{address:'0x123',symbol:'TEST'}},visual={snapshot:()=>({...state}),captureStill:()=>frame};
 const doc={hidden:false,dispatchEvent:event=>events.push(event)};
 const context=vm.createContext({Blob,Uint8ClampedArray,Number,Map,Math,Date:{now:()=>now},document:doc,CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},setInterval:callback=>{tick=callback;return 1;},clearInterval:()=>{closed=true;}});
 vm.runInContext(source.replaceAll('export function','function')+'\nthis.api={meaningfulCapture,archivePlayerFrames};',context);
 const stop=context.api.archivePlayerFrames({captureMode:true,getMarket:()=>market,getVisual:()=>visual,eligible:()=>true,onStatus:status=>statuses.push(status)});
 return {state,market,visual,frame,doc,events,statuses,api:context.api,stop,get closed(){return closed;},async settle(){for(let i=0;i<6;i++){now+=1000;state.renderedAt=now;await tick();}},async stale(){now+=6000;await tick();}};
}
for(const marks of [1,6,37,10000])test('genuine sparse pixels publish with '+marks+' observed marks',async()=>{
 const f=fixture({markCount:marks});await f.settle();assert.equal(f.events.length,1);assert.equal(f.events[0].detail.frame.key,'ethereum:0x123');assert.equal(f.events[0].detail.frame.holders,marks);assert.equal(f.events[0].detail.frame.captureKind,'live-player-frame-v1');assert(f.events[0].detail.frame.blob instanceof Blob);f.stop();assert(f.closed);
});
for(const bright of [0,31,63])test('blank or insufficiently visible frame '+bright+' stays rejected',async()=>{const f=fixture({bright});await f.settle();assert.equal(f.events.length,0);assert.equal(f.statuses.at(-1).reason,'empty-or-insufficient-live-pixels');});
for(const [label,patch] of [
 ['paused',{renderedPlaying:false}],['wrong coin',{sourceCoinKey:'base:0x123'}],['missing observed holders',{holderSnapshotReady:false}],['synthetic holders',{holderSource:'simulated'}],['loading holders',{holderLoading:true}],['zero marks',{markCount:0}],['fading transport',{transportPresence:.5}]
])test(label+' cannot publish',async()=>{const f=fixture();Object.assign(f.state,patch);await f.settle();assert.equal(f.events.length,0);});
test('stale render timestamps cannot publish',async()=>{const f=fixture();await f.stale();assert.equal(f.events.length,0);assert.equal(f.statuses.at(-1).reason,'render-timestamp-stale');});
test('hidden document cannot publish',async()=>{const f=fixture();f.doc.hidden=true;await f.settle();assert.equal(f.events.length,0);assert.equal(f.statuses.at(-1).reason,'document-hidden');});
test('render errors are recorded and never publish placeholder pixels',async()=>{const f=fixture();f.visual.captureStill=()=>{throw Error('artwork still loading');};await f.settle();assert.equal(f.events.length,0);assert.equal(f.statuses.at(-1).reason,'artwork still loading');});
test('identity changes while WebP encodes discard the frame',async()=>{const f=fixture();f.frame.toBlob=callback=>{f.state.sourceCoinKey='base:0x456';callback(new Blob(['fixture']));};await f.settle();assert.equal(f.events.length,0);});
test('sparse pixels without verified holder marks do not get the observed-frame exception',()=>{const f=fixture();assert.equal(f.api.meaningfulCapture(pixels()),false);assert.equal(f.api.meaningfulCapture(pixels(),{verifiedMarks:-1}),false);});
test('normal browsing never starts capture timers',()=>{const f=fixture();f.stop();assert.equal(typeof f.api.archivePlayerFrames({}), 'function');});

for(const [label,patch] of [['paused',{renderedPlaying:false}],['holders unready',{holderSnapshotReady:false}],['synthetic',{holderSource:'simulated'}],['stale',{renderedAt:0}],['future timestamp',{renderedAt:999999999}],['transport fading',{transportPresence:.5}]])test(label+' during encoding discards pixels',async()=>{
 const f=fixture();f.frame.toBlob=callback=>{Object.assign(f.state,patch);callback(new Blob(['fixture']));};await f.settle();assert.equal(f.events.length,0);
});
