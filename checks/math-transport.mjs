import assert from 'node:assert/strict';
import {createMathPatterns,mathIdentity,MATH_THRESHOLDS} from '../public/math-patterns.js';
import {rankCoinMatches} from '../public/coin-search.js';
for(let seed=0;seed<1000;seed++){const chosen=mathIdentity(seed);assert.equal(chosen.length,5);assert.equal(new Set(chosen.map(p=>p.id)).size,5);assert.deepEqual(chosen.map(p=>p.threshold),MATH_THRESHOLDS);}
const market=cap=>({context:{latestCap:cap},fresh:1,music:{intensity:.8,tempo:120},replay:{}});
let sent=new Map();const patterns=createMathPatterns({send:(key,value)=>sent.set(key,value)});patterns.setSeed(91);
for(const cap of [99999,...MATH_THRESHOLDS]){const view=patterns.frame(market(cap),{playing:false,event:'a',clock:0});assert.equal(view.slots.filter(s=>s.unlocked).length,MATH_THRESHOLDS.filter(t=>cap>=t).length);assert.ok(view.slots.every(s=>s.gate===0));}
patterns.reset();for(let i=1;i<5;i++)patterns.setSlot(i,false);
let view;for(let frame=0;frame<=300;frame++)view=patterns.frame(market(5000000),{playing:true,event:'one',clock:frame/30});
assert.ok(view.slots.every(s=>s.gate===0),'A finished phrase must rest without new events');
for(let frame=301;frame<=1300;frame++)view=patterns.frame(market(5000000),{playing:true,event:'one',clock:frame/30});
assert.ok(view.slots.every(s=>s.gate===0),'A stale chart must not restart phrases');
view=patterns.frame(market(5000000),{playing:true,event:'two',clock:1301/30});assert.ok(view.slots[0].performing||view.slots[0].status==='Queued');
patterns.stop();assert.equal(sent.get('math-0-gate'),0);assert.equal(sent.get('math-0-level'),0);
view=patterns.frame(market(5000000),{playing:true,seeking:true,event:'three',clock:50});assert.ok(view.slots.every(s=>s.gate===0));
view=patterns.frame(market(5000000),{playing:true,ended:true,event:'three',clock:51});assert.ok(view.slots.every(s=>s.gate===0));
function phraseDuration(tempo){const p=createMathPatterns();for(let i=1;i<5;i++)p.setSlot(i,false);let started=false;for(let frame=0;frame<1000;frame++){const v=p.frame({...market(100000),music:{intensity:.8,tempo}},{playing:true,event:'once',clock:frame/60});if(v.slots[0].performing)started=true;else if(started)return frame/60;}throw Error('Never finished');}
assert.ok(Math.abs(phraseDuration(60)-8)<.1);assert.ok(Math.abs(phraseDuration(120)-4)<.1);
const pair=(name,symbol,address,liquidity)=>({chainId:'solana',baseToken:{name,symbol,address},quoteToken:{name:'Solana',symbol:'SOL',address:'quote'},liquidity:{usd:liquidity}});
const results=rankCoinMatches([pair('Cat Coin','CAT','first',1),pair('Cat Coin','CAT','first',20),pair('Other Cat','OC','second',30)],'Cat Coin',{orientPair:(p,address)=>p.baseToken.address===address?p:null});
assert.equal(results.length,1);assert.equal(results[0].liquidity.usd,20);
console.log('PASS: five unique tiers, finite phrases, stale data rest, pause/seek/end silence, tempo duration, name search/main-pool selection');
