import {signalFreshness,mixTargets} from './market-controls.js?v=17';
import {createSignalMap} from './signal-map.js?v=17';
import {createNativePd} from './native-pd.js?v=17';
import {createPd} from './vendor/libpd-wasm.js';
import {subscribePool} from './realtime.js?v=4';
import {subscribeEvm,EVM_RPC} from './evm.js?v=5';
import {subscribeOrca} from './orca.js?v=1';
import {subscribeRobinhoodV4} from './v4.js?v=1';
import {fetchGecko} from './gecko.js?v=1';
import {startTrending} from './trending.js?v=1';
import {MarketChart} from './chart.js?v=17';
import {loadHistory} from './history.js?v=17';
import {pollPoolTrades} from './trades.js?v=5';
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let pd,ctx,gain,playing=false,starting=false,poll,market=null,mode='demo',generation=0,loading=false;
let requestedNetwork=null;
let seed=1917,state=1917,step=0,timer,next=0,bpm=120,recorder,chunks=[],session=null;
const controls=['master'];
let stopStream,streamConnected=false,poolEvents=[],lastSnapshot=0,streamPool='';
let streamKind='snapshot',tradeEvents=[],lastTrade=null,lastChainPrice=null,discovered=[],lastDemoPrice=100,lastExcitation=0;
let receivedTradeCount=0;
let stopHistory,stopChartHistory,historyContext=null,originDate=null,contextCandles=[],contextInterval=60000,chartRequest=0;
const chart=new MarketChart($('market-chart'));
let coinImageURL='',imageController,imageToken='';const tokenImages=new Map();
const imageKey=pair=>pair.chainId+':'+(/^0x/i.test(pair.baseToken.address)?pair.baseToken.address.toLowerCase():pair.baseToken.address);
async function loadCoinImage(pair){
 const key=imageKey(pair);if(imageToken===key)return;imageToken=key;imageController?.abort();
 if(tokenImages.has(key)||pair.historyTokenSide!=='quote'&&pair.info?.imageUrl)return;
 const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
 const controller=new AbortController();imageController=controller;const timeout=setTimeout(()=>controller.abort(),45000);
 try{
  const r=await fetchGecko('https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(aliases[pair.chainId]||pair.chainId)+'/tokens/'+encodeURIComponent(pair.baseToken.address)+'/info',{signal:controller.signal});
  if(!r.ok)throw Error('Token image unavailable');const data=await r.json();if(controller.signal.aborted)return;
  tokenImages.set(key,data.data?.attributes?.image_url||'');if(market&&imageKey(market)===key)displayCoinImage();
 }catch{if(!controller.signal.aborted)tokenImages.set(key,'');}finally{clearTimeout(timeout);}
}
function displayCoinImage(){
 const token=market?.baseToken;
 $('coin-image-fallback').textContent=(token?.symbol||'AV').slice(0,2).toUpperCase();
 const candidates=market?[market,...discovered.filter(p=>p.chainId===market.chainId&&sameToken(p.baseToken?.address,token.address))]:[];
 const image=candidates.find(p=>p.historyTokenSide!=='quote'&&p.info?.imageUrl)?.info?.imageUrl;
 let url='';try{const parsed=new URL(token?.imageUrl||image||(market&&tokenImages.get(imageKey(market))));if(parsed.protocol==='https:')url=parsed.href;}catch{}
 if(url===coinImageURL)return;coinImageURL=url;
 const img=$('coin-image'),fallback=$('coin-image-fallback');img.hidden=true;fallback.hidden=false;
 if(!url){img.removeAttribute('src');return;}
 img.onload=()=>{if(coinImageURL===url){img.hidden=false;fallback.hidden=true;}};
 img.onerror=()=>{if(coinImageURL===url){img.hidden=true;fallback.hidden=false;}};
 img.src=url;
}
const levels={melody:0,pad:0,space:0};
const signalMap=createSignalMap($('signal-map'));
function updateSignalMap(m){signalMap.update({m,levels,bpm:Math.round(80+m.activity*70+m.volume*m.fresh*40),root:marketRoot(),master:Number($('master').value),playing,native:$('audio-output').value==='native'});}
function bindSignalMap(){signalMap.reset();for(const name of ['av-dna','av-codon','av-phenotype','generation','note','pad-note','av-string-voice','av-pad-voice'])pd.subscribe?.(name,message=>signalMap.receive(name,Number(message.values[0])));}
const scale=[0,2,3,5,7,9,10];
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const rand=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
const status=s=>$('status').textContent=s;
function currentPrice(){if(streamConnected&&['swap','trade-poll','rpc-poll'].includes(streamKind)){if((lastChainPrice?.receivedAt||0)>(lastTrade?.receivedAt||0))return Number(lastChainPrice.priceUsd);if(lastTrade?.priceUsd)return Number(lastTrade.priceUsd);}return Number(market?.priceUsd);}
function marketRoot(){const current=currentPrice(),anchor=historyContext?.first?.open;const offset=current>0&&anchor>0?Math.round(12*Math.tanh(Math.log(current/anchor))):0;return 45+seed%12+offset;}
function send(name,value){pd?.sendFloat(name,value);}
function event(name){pd?.sendBang(name);}
function metrics(){
 if(!market){const t=performance.now()/1000;return {motion:.3+.25*Math.sin(t/19),activity:.45+.25*Math.sin(t/31),balance:.5+.2*Math.sin(t/23),texture:.6,volume:.4+.3*Math.sin(t/27),fresh:1,snapshotFresh:1,snapshotAge:0};}
 const tx=market.txns?.m5||{};const total=(tx.buys||0)+(tx.sells||0);
 tradeEvents=tradeEvents.filter(e=>Date.now()-e.receivedAt<30000);
 poolEvents=poolEvents.filter(e=>Date.now()-e.receivedAt<10000);
 const decoded=streamConnected&&['swap','trade-poll','rpc-poll'].includes(streamKind);
 const first=tradeEvents[0],last=tradeEvents.at(-1),movement=first&&last?Math.abs((last.priceQuote/first.priceQuote-1)*100):0;
 const buys=tradeEvents.filter(e=>e.side==='buy').length;
 const observedVolume=tradeEvents.reduce((sum,e)=>sum+(e.usdVolume||0),0);
 const rate=decoded?tradeEvents.length/30:streamConnected&&streamKind==='pool'?poolEvents.length/10:total/300;
 const volumeRate=decoded?observedVolume/30:(Number(market.volume?.m5)||0)/300;
 return {motion:clamp((decoded?movement:Math.abs(Number(market.priceChange?.m5)||0))/8,0,1),activity:clamp(Math.log1p(rate)/Math.log(21),0,1),balance:decoded?(tradeEvents.length?buys/tradeEvents.length:.5):(total?(tx.buys||0)/total:.5),texture:clamp(Math.log10(Math.max(1,market.liquidity?.usd||1))/7,0,1),volume:clamp(Math.log1p(volumeRate)/Math.log(10001),0,1),...signalFreshness(decoded,lastSnapshot),decoded,observedVolume};
}
function syncLevels(m){
 const target=mixTargets(m,streamConnected);
 for(const name of Object.keys(levels)){levels[name]+=(target[name]-levels[name])*.2;send(name,levels[name]);$(name).value=levels[name];$(name+'-value').textContent=Math.round(levels[name]*100)+'%';}
 $('energy-value').textContent=Math.round(m.volume*m.fresh*100)+'%';
 $('volume').textContent=market?cash(m.decoded?m.observedVolume:market.volume?.m5):'DEMO';
 $('volume-window').textContent=m.decoded?'OBSERVED USD · LAST 30 SEC':'TRADED USD · 5 MIN';
 $('signal-source').textContent=m.decoded?'Price, activity, direction and volume: observed trades / 30 sec. '+(['swap','rpc-poll'].includes(streamKind)?'USD quote conversion and liquidity: snapshots.':'Trade USD values: provider; liquidity: snapshots.'):streamConnected&&streamKind==='pool'?'Activity: pool transactions / 10 sec. Price, volume and direction: 5-minute snapshots.':market?'Price, volume and activity: market snapshots / 5 min.':'Synthetic demo signals';
 if(market&&m.snapshotAge>20000)$('signal-source').textContent+=' Snapshot age '+Math.round(m.snapshotAge/1000)+'s · liquidity held at last value'+(m.decoded&&['swap','rpc-poll'].includes(streamKind)?'; native USD values use the last quote conversion.':'.');
 updateSignalMap(m);
}
function setupStream(){
 const key=market?.chainId+':'+market?.pairAddress;if(key===streamPool)return;
 stopStream?.();streamPool=key;streamConnected=false;poolEvents=[];
 const gen=generation;
 let stopNative,stopFallback,nativeState={connected:false,kind:'snapshot',message:''},fallbackState={connected:false,kind:'snapshot',message:''};
 const signatures={rpc:new Set(),gecko:new Set()};
 const publish=()=>{
  const chosen=nativeState.connected&&['swap','rpc-poll'].includes(nativeState.kind)?nativeState:fallbackState.connected&&fallbackState.kind==='trade-poll'?fallbackState:nativeState.connected&&nativeState.kind==='pool'?nativeState:fallbackState.message?fallbackState:nativeState;
  streamConnected=chosen.connected;streamKind=chosen.kind;$('feed').textContent=chosen.message+(chosen!==nativeState&&nativeState.message?' · direct route: '+nativeState.message:'');display();
 };
 const startFallback=()=>{if(stopFallback)return;stopFallback=pollPoolTrades(market,receive,s=>{if(gen!==generation)return;fallbackState=s;publish();});};
 const receive=e=>{
  if(gen!==generation)return;
  if(e.kind==='market-price'){
   const quoteUsd=Number(market.priceUsd)/Number(market.priceNative),priceUsd=e.priceQuote*quoteUsd;
   if(priceUsd>0&&Number.isFinite(priceUsd)){lastChainPrice={...e,priceUsd};chart.add({at:e.occurredAt||e.receivedAt,price:priceUsd,source:'rpc-state'});$('chart-source').textContent='Direct Robinhood RPC pool state · refreshed during quiet periods · USD quote conversion uses snapshots';display();}
   session?.events?.push(e);return;
  }
  if(e.kind==='timing'){const trade=tradeEvents.find(t=>t.id===e.id)||(lastTrade?.id===e.id?lastTrade:null);if(trade){trade.occurredAt=e.occurredAt;trade.precision=e.precision;}chart.retime(e.id,e.occurredAt);session?.events?.push(e);return;}
  if(e.removed){tradeEvents=tradeEvents.filter(t=>t.id!==e.id);chart.remove(e.id);lastTrade=tradeEvents.at(-1)||null;session?.events?.push(e);$('last-event').textContent='Chain reorganization · removed swap';display();return;}
  if(e.kind==='swap'){
   const source=e.source||'rpc',other=source==='rpc'?'gecko':'rpc';
   if(!e.signature||signatures[other].has(e.signature))return;
   signatures[source].add(e.signature);if(signatures[source].size>4096)signatures[source].delete(signatures[source].values().next().value);
   const quoteUsd=Number(market.priceUsd)/Number(market.priceNative);
   if(source==='rpc'){e.priceUsd=quoteUsd>0&&Number.isFinite(quoteUsd)?(e.spotQuote||e.priceQuote)*quoteUsd:null;e.usdVolume=e.priceUsd?e.quoteAmount*quoteUsd:0;}
   tradeEvents.push(e);lastTrade=e;receivedTradeCount++;
   if(e.priceUsd)chart.add({at:Number.isFinite(e.occurredAt)?e.occurredAt:e.receivedAt,price:e.priceUsd,volume:e.usdVolume,id:e.id,source:'swap'});
   $('chart-source').textContent=source==='rpc'?(e.protocol==='orca'?'Orca post-swap spot prices · confirmed WebSocket events · USD uses snapshot SOL/quote conversion':e.protocol==='v4'?'Direct Uniswap v4 post-swap prices · RPC polling ≥2s · USD quote conversion uses snapshots':'Streamed swap execution prices · USD estimated using latest quote conversion'):'Observed trade prices · GeckoTerminal / ≥8s polling · upstream cached · provider USD values';
   $('last-event').textContent=e.side.toUpperCase()+' · block '+e.block;display();
  }else{poolEvents.push(e);if(streamKind==='pool')$('last-event').textContent='Pool event · slot '+e.slot;}
  session?.events?.push(e);
  if(playing&&performance.now()-lastExcitation>=40){lastExcitation=performance.now();tick();}
 };
 if(market.chainId==='solana'){
  if(market.dexId==='orca'){
   stopNative=subscribeOrca(market,receive,s=>{if(gen!==generation)return;nativeState=s;if(s.connected&&s.kind==='swap'){stopFallback?.();stopFallback=null;fallbackState={connected:false,kind:'snapshot',message:''};}else startFallback();publish();});
  }else{stopNative=subscribePool(market.pairAddress,receive,message=>{if(gen!==generation)return;nativeState={connected:message.startsWith('Connected'),kind:message.startsWith('Connected')?'pool':'snapshot',message};publish();});startFallback();}
 }else{
  const subscribe=market.chainId==='robinhood'&&/^0x[0-9a-f]{64}$/i.test(market.pairAddress)?subscribeRobinhoodV4:subscribeEvm;
  stopNative=subscribe(market,receive,s=>{if(gen!==generation)return;nativeState=s;if(s.connected&&['swap','rpc-poll'].includes(s.kind)){stopFallback?.();stopFallback=null;fallbackState={connected:false,kind:'snapshot',message:''};}else startFallback();publish();});
 }
 stopStream=()=>{stopNative?.();stopFallback?.();};
}
function tick(){
 const m=metrics(),energy=m.volume*m.fresh;syncLevels(m);
 bpm=Math.round(80+m.activity*70+energy*40);$('tempo').textContent=bpm+' BPM';
 send('tempo',bpm);send('activity',m.activity);send('motion',m.motion);send('energy',energy);
 send('balance',m.balance);send('texture',m.texture);send('heartbeat',1);send('tonic',marketRoot());send('cutoff',900+m.texture*3100+energy*1800);
}
// Browser updates market controls; the Pd worklet schedules musical events.
function loop(){if(!playing)return;tick();timer=setTimeout(loop,150);}
async function initialize(){
 if($('audio-output').value==='native'){pd=await createNativePd(e=>{status(e.message+' · press Pause and reconnect');},state=>signalMap.setTransport(state));for(const id of controls)send(id,Number($(id).value));bindSignalMap();return;}
 ctx=new AudioContext();await ctx.resume();
 const names=['market.pd','av-sequencer.pd','av-genome.pd','av-pluck.pd','av-pad.pd'];
 const files=Object.fromEntries(await Promise.all(names.map(async name=>{const r=await fetch('patches/'+name+'?v=16');if(!r.ok)throw Error('Cannot load '+name);return [name,await r.text()];})));
 pd=await createPd({audioContext:ctx,packages:['vanilla'],files,entry:'market.pd',workletUrl:'vendor/libpd-worklet.js',onPrint:text=>console.log('[Pd]',text),onError:error=>status('Audio engine: '+error.message)});
 gain=ctx.createGain();gain.gain.value=0;pd.connect(gain);gain.connect(ctx.destination);bindSignalMap();
 for(const id of controls)send(id,Number($(id).value));
}
$('play').onclick=async()=>{
 if(starting)return;
 if(playing){playing=false;send('run',0);clearTimeout(timer);if(gain)gain.gain.setTargetAtTime(0,ctx.currentTime,.025);send('master',0);pd?.flush?.();$('audio-output').disabled=false;$('play').textContent='▶ Listen';if(recorder?.state==='recording')recorder.stop();$('record').disabled=true;status('Paused');return;}
 starting=true;$('play').disabled=true;status('Opening instrument…');
 try{if(!pd)await initialize();signalMap.reset();if(ctx)await ctx.resume();if(gain)gain.gain.setTargetAtTime(1,ctx.currentTime,.04);send('master',Number($('master').value));$('audio-output').disabled=true;playing=true;send('seed',seed%16777216);loop();send('run',1);$('play').textContent='Ⅱ Pause';$('record').disabled=!!pd.native;status(mode==='demo'?'Playing · synthetic demo signals':'Playing · live market snapshots');}
 catch(e){$('audio-output').disabled=false;status('Unable to start audio: '+e.message);if(pd)await pd.close();pd=null;await ctx?.close();ctx=null;}
 finally{starting=false;$('play').disabled=false;}
};
if(!['localhost','127.0.0.1'].includes(location.hostname))$('native-option').disabled=true;
$('audio-output').onchange=async()=>{
 starting=true;$('play').disabled=true;$('audio-output').disabled=true;
 try{if(pd)await pd.close();pd=null;await ctx?.close();ctx=null;gain=null;signalMap.reset();status($('audio-output').value==='native'?'Open av-desktop.pd · then Listen':'Browser instrument ready');}
 catch(e){status('Could not change audio output: '+e.message);}
 finally{starting=false;$('play').disabled=false;$('audio-output').disabled=false;}
};
for(const id of controls)$(id).addEventListener('input',()=>{send(id,playing?Number($(id).value):0);session?.controls.push({at:Date.now(),name:id,value:Number($(id).value)});});
const cash=n=>n!=null&&n!==''&&Number.isFinite(Number(n))?'$'+new Intl.NumberFormat('en',{maximumSignificantDigits:8}).format(n):'—';
const sameToken=(a,b)=>/^0x[0-9a-f]{40}$/i.test(b||'')?a?.toLowerCase()===b.toLowerCase():a===b;
function orientPair(pair,token){
 if(sameToken(pair.baseToken?.address,token))return {...pair,historyTokenSide:'base'};
 if(!sameToken(pair.quoteToken?.address,token))return null;
 const native=Number(pair.priceNative),usd=Number(pair.priceUsd),txns={};
 for(const [window,tx] of Object.entries(pair.txns||{}))txns[window]={buys:tx.sells,sells:tx.buys};
 return {...pair,historyTokenSide:'quote',baseToken:pair.quoteToken,quoteToken:pair.baseToken,priceNative:native>0?String(1/native):null,priceUsd:native>0&&usd>0?String(usd/native):null,txns,priceChange:{}};
}
function display(){
 displayCoinImage();
 $('mode').textContent=mode==='demo'?'DEMO SIGNAL':streamConnected&&streamKind==='rpc-poll'?'DIRECT RPC · ≥2 SEC':streamConnected&&streamKind==='swap'?'LIVE SWAPS':streamConnected&&streamKind==='trade-poll'?'CACHED TRADE POLLING':streamConnected&&streamKind==='pool'?'POOL ACTIVITY + SNAPSHOTS':'MARKET SNAPSHOTS';
 $('coin-name').textContent=market?market.baseToken.symbol+' / '+market.quoteToken.symbol:'Untuned / Demo';
 $('chain').textContent=market?market.chainId.toUpperCase()+' · '+market.dexId.toUpperCase():'GENERATIVE SESSION';
 $('price').textContent=market?cash(currentPrice()):'—';$('change').textContent=market&&market.priceChange?.m5!=null?Number(market.priceChange.m5).toFixed(2)+'%':'—';
 const tx=market?.txns?.m5;$('trades').textContent=tx?(tx.buys||0)+(tx.sells||0):'—';$('liquidity').textContent=market?cash(market.liquidity?.usd):'—';
 updateContext();
}
function updateContext(){
 const current=currentPrice();
 $('origin-date').textContent=originDate?new Date(originDate).toLocaleDateString():'Unknown';
 $('history-date').textContent=historyContext?.first?new Date(historyContext.first.time).toLocaleDateString():'Not available';
 $('origin-multiple').textContent=current>0&&historyContext?.first?.open>0?(current/historyContext.first.open).toFixed(2)+'×':'—';
 $('peak-drawdown').textContent=current>0&&historyContext?.peak>0?((current/historyContext.peak-1)*100).toFixed(1)+'%':'—';
}
function startHistory(pair){
 const gen=generation;stopHistory?.();historyContext=null;contextCandles=[];
 const dates=discovered.filter(p=>p.chainId===pair.chainId).map(p=>Number(p.pairCreatedAt)).filter(n=>n>0);
 originDate=dates.length?Math.min(...dates):Number(pair.pairCreatedAt)||null;updateContext();
 stopHistory=loadHistory(pair,data=>{
  if(gen!==generation)return;
  const first=data.candles[0];historyContext=first?{first,peak:Math.max(...data.candles.map(b=>b.high)),state:data.state,interval:data.interval}:null;
  contextCandles=data.candles;contextInterval=data.interval;
  if($('chart-timeframe').value==='auto'){chart.setHistory(data.candles,data.interval,originDate);$('chart-resolution').textContent='Auto context · '+data.timeframe+' candles';}
  const gap=first&&originDate&&first.time>originDate+data.interval?' · gap between first known market and available history':'';
  $('history-status').textContent=data.message+' · '+data.timeframe+' candles'+gap;
  updateContext();session?.controls.push({at:Date.now(),name:'history-context',first:first?.time,firstOpen:first?.open,state:data.state,originDate});
 });
 if($('chart-timeframe').value!=='auto')loadChartTimeframe();
}
const chartFrames={'1m':{timeframe:'minute',aggregate:1},'5m':{timeframe:'minute',aggregate:5},'15m':{timeframe:'minute',aggregate:15},'1h':{timeframe:'hour',aggregate:1},'4h':{timeframe:'hour',aggregate:4},'1d':{timeframe:'day',aggregate:1}};
function loadChartTimeframe(){
 stopChartHistory?.();const request=++chartRequest,gen=generation,selection=$('chart-timeframe').value;
 if(selection==='auto'){chart.setHistory(contextCandles,contextInterval,originDate);$('chart-resolution').textContent='Auto context · '+contextInterval/60000+' minute candles';return;}
 const frame=chartFrames[selection],interval={minute:60000,hour:3600000,day:86400000}[frame.timeframe]*frame.aggregate;
 chart.setInterval(interval);$('chart-resolution').textContent=selection+' · '+(market?'Loading provider candles…':'Synthetic demo candles');
 if(!market)return;
 stopChartHistory=loadHistory(market,data=>{
  if(gen!==generation||request!==chartRequest)return;
  chart.setHistory(data.candles,data.interval,originDate);
  $('chart-resolution').textContent=selection+' · '+data.candles.length+' provider candles · '+data.message;
 },{...frame,maxPages:3});
}
async function fetchJSON(url){const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),12000);try{const r=await fetch(url,{signal:abort.signal});if(!r.ok)throw Error('Market provider returned '+r.status);return await r.json();}finally{clearTimeout(timeout);}}
function applySnapshot(pair){
 market=pair;lastSnapshot=Date.now();
 if(!(streamConnected&&['swap','trade-poll','rpc-poll'].includes(streamKind))){chart.add({at:Date.now(),price:Number(pair.priceUsd),source:'snapshot'});$('chart-source').textContent='Observed market snapshots · 5-second polling; provider data may be cached';}
 display();$('lookup').textContent='Snapshot '+new Date().toLocaleTimeString()+' · '+pair.baseToken.name+' · '+pair.chainId+' · '+pair.dexId;
 session?.snapshots.push({at:Date.now(),market:pair});
}
function chooseMarket(pair){
 signalMap.reset();generation++;clearTimeout(poll);stopStream?.();stopHistory?.();stopChartHistory?.();stopStream=null;streamPool='';streamConnected=false;streamKind='snapshot';poolEvents=[];tradeEvents=[];lastTrade=null;lastChainPrice=null;receivedTradeCount=0;historyContext=null;originDate=null;chart.reset();
 mode='live';market=pair;seed=hash(pair.chainId+':'+pair.baseToken.address);state=seed;step=0;send('seed',seed%16777216);applySnapshot(pair);setupStream();loadCoinImage(pair);startHistory(pair);
 $('network').value=pair.chainId;renderPools(pair);$('last-event').textContent='Waiting for pool events';
 session?.controls.push({at:Date.now(),name:'market',chain:pair.chainId,pool:pair.pairAddress});
 const gen=generation,chain=pair.chainId,address=pair.pairAddress,token=pair.baseToken.address;
 const refresh=async()=>{
  try{const data=await fetchJSON('https://api.dexscreener.com/latest/dex/pairs/'+encodeURIComponent(chain)+'/'+encodeURIComponent(address));if(gen!==generation)return;
   const raw=(data.pairs||[]).find(p=>p.chainId===chain&&p.pairAddress===address);const updated=raw&&orientPair(raw,token);if(!updated)throw Error('Selected pool snapshot unavailable');applySnapshot(updated);
  }catch(e){if(gen===generation)$('lookup').textContent='Snapshot delayed: '+e.message;}
  if(gen===generation)poll=setTimeout(refresh,5000);
 };poll=setTimeout(refresh,5000);status(playing?'Playing · automatic market instrument':'Market loaded · press Listen');
}
function renderPools(pair){
 $('pool').replaceChildren();for(const p of discovered.filter(p=>p.chainId===pair.chainId)){
  const option=document.createElement('option');option.value=p.pairAddress;option.textContent=p.dexId+' · '+p.baseToken.symbol+'/'+p.quoteToken.symbol+' · liquidity '+cash(p.liquidity?.usd);$('pool').append(option);
 }$('pool').value=pair.pairAddress;
}
$('coin-form').onsubmit=async e=>{
 e.preventDefault();if(loading)return;
 const wantedNetwork=requestedNetwork;requestedNetwork=null;
 const address=$('address').value.trim();if(address.length<5||address.length>250||/\s/.test(address)){status('Enter a token address or chain-specific token identifier.');return;}
 loading=true;$('load').disabled=true;status('Looking up indexed markets…');
 try{
  const data=await fetchJSON('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(address));
  const pairs=(data.pairs||[]).map(p=>orientPair(p,address)).filter(Boolean);pairs.sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0));
  if(!pairs.length)throw Error('No indexed market found for this token identifier.');
  discovered=pairs;$('network').replaceChildren();for(const chain of [...new Set(pairs.map(p=>p.chainId))]){const o=document.createElement('option');o.value=chain;o.textContent=chain.toUpperCase()+' · '+(chain==='solana'?'Orca swaps / pool activity + cached trade polling':chain==='robinhood'?'v4 direct RPC polling':EVM_RPC[chain]?'V2/V3 swap adapter':'trade polling / snapshots');$('network').append(o);}
  const selection=wantedNetwork?pairs.find(p=>p.chainId===wantedNetwork):pairs[0];if(!selection)throw Error('No DEX Screener market found on the trending coin’s network.');
  $('market-selectors').hidden=false;chooseMarket(selection);
 }catch(e){status(e.message);$('lookup').textContent=e.message;}
 finally{loading=false;$('load').disabled=false;}
};
$('network').onchange=()=>{const pair=discovered.find(p=>p.chainId===$('network').value);if(pair)chooseMarket(pair);};
$('pool').onchange=()=>{const pair=discovered.find(p=>p.chainId===$('network').value&&p.pairAddress===$('pool').value);if(pair)chooseMarket(pair);};
$('demo').onclick=()=>{signalMap.reset();imageController?.abort();imageToken='';generation++;clearTimeout(poll);stopStream?.();stopHistory?.();stopChartHistory?.();contextCandles=[];historyContext=null;originDate=null;streamPool='';streamConnected=false;streamKind='snapshot';poolEvents=[];tradeEvents=[];lastTrade=null;lastChainPrice=null;receivedTradeCount=0;chart.reset();$('market-selectors').hidden=true;market=null;mode='demo';seed=1917;state=seed;step=0;send('seed',seed%16777216);display();$('history-status').textContent='Demo has no launch history';loadChartTimeframe();$('feed').textContent='Synthetic demo signals';$('last-event').textContent='No on-chain stream';$('lookup').textContent='Synthetic signals · enter a contract address for live market data';$('chart-source').textContent='Synthetic demo prices · no market feed';status(playing?'Playing · synthetic demo signals':'Demo ready');session?.controls.push({at:Date.now(),name:'demo'});};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.textContent='Download '+name;a.style.color='var(--accent)';a.style.fontSize='11px';a.style.display='block';$('downloads').append(a);}
const downloads=document.createElement('div');downloads.id='downloads';$('record').parentElement.after(downloads);
$('record').onclick=()=>{
 if(recorder?.state==='recording'){recorder.stop();return;}
 if(!window.MediaRecorder){status('Audio recording is unavailable in this browser.');return;}
 try{
 const destination=ctx.createMediaStreamDestination();gain.connect(destination);chunks=[];
 const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
 recorder=new MediaRecorder(destination.stream,mime?{mimeType:mime}:undefined);
 session={version:4,started:Date.now(),seed,randomState:state,step,mode,bpm,controls:controls.map(name=>({at:Date.now(),name,value:Number($(name).value)})),snapshots:market?[{at:Date.now(),market}]:[],events:[],patch:'market.pd / 003 gameta',mapping:'automatic-v6-genotype-phenotype',source:streamKind,historyContext,originDate,initialObservedSwaps:tradeEvents.slice()};
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{const name='AV-'+new Date(session.started).toISOString().replace(/[:.]/g,'-');download(new Blob(chunks,{type:recorder.mimeType}),name+(recorder.mimeType.includes('mp4')?'.m4a':'.webm'));download(new Blob([JSON.stringify(session,null,2)],{type:'application/json'}),name+'.json');gain.disconnect(destination);session=null;$('record').textContent='● Record';status('Recording ready to download · session log included');};
 recorder.start(1000);$('record').textContent='■ Finish';status('Recording audio and session changes…');
 }catch(e){status('Recording unavailable: '+e.message);}
};
display();
startTrending(item=>{if(loading)return;requestedNetwork=item.chain;if(item.image)tokenImages.set(imageKey({chainId:item.chain,baseToken:{address:item.address}}),item.image);$('address').value=item.address;$('coin-form').requestSubmit();});
setInterval(()=>{if(!playing)syncLevels(metrics());},250);
$('chart-view').onchange=()=>chart.setMode($('chart-view').value);
$('chart-range').onchange=()=>chart.setRange($('chart-range').value);
$('chart-timeframe').onchange=loadChartTimeframe;
$('chart-scale').onchange=()=>chart.setScale($('chart-scale').value);
$('chart-fit').onclick=()=>{$('chart-range').value='history';chart.fit();};
$('chart-live').onclick=()=>{$('chart-range').value='live';chart.goLive();};
$('chart-zoom-in').onclick=()=>chart.zoom(.7);
$('chart-zoom-out').onclick=()=>chart.zoom(1.4);
setInterval(()=>{
 $('event-age').textContent=lastTrade?'Last trade received '+((Date.now()-lastTrade.receivedAt)/1000).toFixed(1)+'s ago':'Last trade: none received';
 $('data-delay').textContent=lastTrade?.occurredAt?(lastTrade.precision==='block-timestamp'?'Block → receipt (approx.): ':'Trade timestamp → receipt: ')+Math.max(0,(lastTrade.receivedAt-lastTrade.occurredAt)/1000).toFixed(1)+'s':'Source delay: unknown (no trade timestamp)';
 $('event-count').textContent=receivedTradeCount+' trades received';
},100);
setInterval(()=>{if(mode==='demo'){const t=performance.now()/1000;lastDemoPrice=100+2*Math.sin(t/19)+Math.sin(t/31);chart.add({at:Date.now(),price:lastDemoPrice,source:'demo'});$('chart-source').textContent='Synthetic demo prices · no market feed';}},1000);
