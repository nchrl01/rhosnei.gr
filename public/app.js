import {createEnvion} from './envion.js?v=38';
import {createEngineView} from './engine-view.js?v=38';
import {contextualizeMarket} from './market-state.js?v=30';
import {createMarketReplay,candleEnd} from './market-replay.js?v=33';
import {signalFreshness} from './market-controls.js?v=18';
import {createOrchestraConductor,ORCHESTRA_LAYERS,orchestraTempo} from './orchestra.js?v=30';
import {createNativePd} from './native-pd.js?v=18';
import {createPd} from './vendor/libpd-wasm.js?v=30';
import {subscribePool} from './realtime.js?v=4';
import {subscribeEvm} from './evm.js?v=5';
import {subscribeOrca} from './orca.js?v=1';
import {subscribeRobinhoodV4} from './v4.js?v=1';
import {fetchGecko} from './gecko.js?v=1';
import {startTrending} from './trending.js?v=33';
import {MarketChart} from './chart.js?v=35';
import {loadHistory} from './history.js?v=30';
import {pollPoolTrades} from './trades.js?v=5';
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let pd,ctx,gain,outputTap,playing=false,starting=false,poll,market=null,mode='demo',generation=0,loading=false;
let requestedNetwork=null,requestedAutoplay=false;
let seed=1917,state=1917,step=0,timer,next=0,bpm=120,recorder,chunks=[],session=null;
const controls=['master'];
let stopStream,streamConnected=false,poolEvents=[],lastSnapshot=0,streamPool='';
let streamKind='snapshot',tradeEvents=[],lastTrade=null,lastChainPrice=null,discovered=[],lastDemoPrice=100,lastExcitation=0;
let receivedTradeCount=0;
let stopMusicHistory,musicHistoryTimer,musicalCandles=[],musicalInterval=300000;
let stopHistory,stopChartHistory,historyContext=null,originDate=null,contextCandles=[],contextInterval=60000,chartRequest=0;
const chart=new MarketChart($('market-chart'));
const replay=createMarketReplay();
chart.bindReplay(()=>replay.state,()=>playing);
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
const conductor=createOrchestraConductor();
const levels=Object.fromEntries(ORCHESTRA_LAYERS.map(name=>[name,0]));
let orchestraState={state:'SPARSE',phrase:0,parameters:{}};
const engineView=createEngineView($('engine-view'));
const envion=createEnvion($('envion'),{onTransport:command=>{if((command==='start'&&!playing)||(command==='stop'&&playing))$('play').click();}});
function resetEnsemble(){conductor.reset();for(const name of Object.keys(levels))levels[name]=0;engineView.reset();}
function updateSignalMap(m){const view={m,levels,orchestra:orchestraState,bpm:orchestraTempo(m),root:marketRoot(m),master:Number($('master').value),playing,native:$('audio-output').value==='native'};engineView.update({...view,coin:market?.baseToken?.symbol,feed:m.replay?'History · '+m.replay.source:mode==='demo'?'Synthetic demo':streamKind,liquidity:m.replay?m.observation?.liquidity:market?.liquidity?.usd});}
function bindSignalMap(){resetEnsemble();for(const name of ['generation','av-envion-voice','av-output-left','av-output-right'])pd.subscribe?.(name,message=>{const value=Number(message.values[0]);conductor.observe(name,value);engineView.receive(name,value);});}
const scale=[0,2,3,5,7,9,10];
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const rand=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
const status=s=>$('status').textContent=s;
function currentPrice(){if(streamConnected&&['swap','trade-poll','rpc-poll'].includes(streamKind)){if((lastChainPrice?.receivedAt||0)>(lastTrade?.receivedAt||0))return Number(lastChainPrice.priceUsd);if(lastTrade?.priceUsd)return Number(lastTrade.priceUsd);}return Number(market?.priceUsd);}
function marketRoot(m){
 const historical=m?.replay;
 const current=historical?historical.price:currentPrice();
 const anchor=historical?chart.renderedBars.find(bar=>bar.time<=historical.at)?.open:historyContext?.first?.open;
 const offset=current>0&&anchor>0?Math.round(12*Math.tanh(Math.log(current/anchor))):0;return 45+seed%12+offset;
}
function send(name,value){if(pd){pd.sendFloat(name,value);engineView.sent(name,value);}}
function event(name){pd?.sendBang(name);}
function liveMetrics(){
 if(!market){const t=performance.now()/1000;const raw={motion:.3+.25*Math.sin(t/19),activity:.45+.25*Math.sin(t/31),balance:.5+.2*Math.sin(t/23),texture:.6,volume:.4+.3*Math.sin(t/27),fresh:1,snapshotFresh:1,snapshotAge:0};return contextualizeMarket(raw,{price:lastDemoPrice,history:chart.points.slice(-360).map(p=>({time:p.at,open:p.price,close:p.price,volume:0})),interval:1000,observedAt:chart.lastReceived?.at});}
 const tx=market.txns?.m5||{};const total=(tx.buys||0)+(tx.sells||0);
 tradeEvents=tradeEvents.filter(e=>Date.now()-e.receivedAt<30000);
 poolEvents=poolEvents.filter(e=>Date.now()-e.receivedAt<10000);
 const decoded=streamConnected&&['swap','trade-poll','rpc-poll'].includes(streamKind);
 const first=tradeEvents[0],last=tradeEvents.at(-1),movement=first&&last?Math.abs((last.priceQuote/first.priceQuote-1)*100):0;
 const buys=tradeEvents.filter(e=>e.side==='buy').length;
 const observedVolume=tradeEvents.reduce((sum,e)=>sum+(e.usdVolume||0),0);
 const rate=decoded?tradeEvents.length/30:streamConnected&&streamKind==='pool'?poolEvents.length/10:total/300;
 const volumeRate=decoded?observedVolume/30:(Number(market.volume?.m5)||0)/300;
 const raw={motion:clamp((decoded?movement:Math.abs(Number(market.priceChange?.m5)||0))/8,0,1),activity:clamp(Math.log1p(rate)/Math.log(21),0,1),balance:decoded?(tradeEvents.length?buys/tradeEvents.length:.5):(total?(tx.buys||0)/total:.5),texture:clamp(Math.log10(Math.max(1,market.liquidity?.usd||1))/7,0,1),volume:clamp(Math.log1p(volumeRate)/Math.log(10001),0,1),...signalFreshness(decoded,lastSnapshot),decoded,observedVolume};
 return contextualizeMarket(raw,{price:currentPrice(),marketCap:Number(market.marketCap),snapshotPrice:Number(market.priceUsd),history:musicalCandles,interval:musicalInterval,changes:market.priceChange||{},liquidity:Number(market.liquidity?.usd),volumeRate,observedAt:Math.max(lastSnapshot,lastTrade?.receivedAt||0,lastChainPrice?.receivedAt||0)});
}
function metrics(){
 const live=liveMetrics();live.observation={liquidity:market?.liquidity?.usd,trades:market?.txns?.m5,change:market?.priceChange?.m5,volume:market?.volume?.m5};
 replay.record(live,market?currentPrice():lastDemoPrice);
 const ended=replay.advance(chart.renderedBars||[],chart.interval,playing);
 const historical=replay.metrics(chart.renderedBars||[],market,chart.interval);
 if(ended&&playing){$('play').onclick();status('History replay finished');}
 return historical||live;
}
function updateReplayUI(m){
 const active=replay.state.active,source=m.replay?.source;
 $('replay-live').disabled=!active;
 $('replay-play').disabled=!(chart.renderedBars?.length);
 $('replay-play').textContent=active&&playing?'Ⅱ Pause':replay.state.ended?'↻ Replay':'▶ Replay';
 const rate=replay.state.speed==='candle'?chart.interval/1000:Number(replay.state.speed);
 $('replay-state').textContent=active?(replay.state.ended?'END':playing?'REPLAY':'PAUSED')+' · '+rate+'×':'LIVE';
 $('replay-info').textContent=!active?'Click a candle or drag the ticks to replay sound.':source==='recorded'?'Recorded market controls from this visit; Envion regenerates the sound.':'Candle reconstruction: price and available volume observed; activity estimated; buy/sell and liquidity unavailable. Market cap uses latest supply, when known. Envion regenerates the sound.';
 $('replay-state').title=$('replay-info').textContent;
 if(active&&replay.state.bar){chart.tickView?.setReplayTime(replay.state.bar.time);display();}
}
function syncLevels(m){
 orchestraState=conductor.update(m,streamConnected);
 for(const name of Object.keys(levels)){levels[name]=orchestraState.levels[name];send(name,levels[name]);$(name).value=levels[name];$(name+'-value').textContent=Math.round(levels[name]*100)+'%';}
 for(const [name,value] of Object.entries(orchestraState.parameters))send(name,value);
 $('orchestra-state').textContent=orchestraState.state+' · PHRASE '+(orchestraState.phrase+1)+'/4';
 $('energy-value').textContent=Math.round(m.volume*m.fresh*100)+'%';
 $('volume').textContent=m.replay?cash(m.replay.volume):market?cash(m.decoded?m.observedVolume:market.volume?.m5):'DEMO';
 $('volume-window').textContent=m.replay?'REPLAY USD VOLUME':m.decoded?'OBSERVED USD · LAST 30 SEC':'TRADED USD · 5 MIN';
 $('signal-source').textContent=m.decoded?'Price, activity, direction and volume: observed trades / 30 sec. '+(['swap','rpc-poll'].includes(streamKind)?'USD quote conversion and liquidity: snapshots.':'Trade USD values: provider; liquidity: snapshots.'):streamConnected&&streamKind==='pool'?'Activity: pool transactions / 10 sec. Price, volume and direction: 5-minute snapshots.':market?'Price, volume and activity: market snapshots / 5 min.':'Synthetic demo signals';
 if(market&&m.snapshotAge>20000)$('signal-source').textContent+=' Snapshot age '+Math.round(m.snapshotAge/1000)+'s · liquidity held at last value'+(m.decoded&&['swap','rpc-poll'].includes(streamKind)?'; native USD values use the last quote conversion.':'.');
 const c=m.context;
 $('market-pressure').textContent=Math.round(m.pressure*100)+'%';
 $('market-baseline').textContent=c.ratio?c.ratio.toFixed(2)+'× typical loaded price':'History context pending';
 $('market-pace').textContent=c.winningWindow?c.winningWindow+' move · '+Math.round(c.pace*100)+'% pace':'No significant measured move';
 $('market-cap-context').textContent=c.latestCap?cash(c.latestCap)+(m.replay?.source==='candles'?' estimated historical cap':c.capEstimated?' estimated latest cap':' snapshot market cap')+(c.impliedBaselineCap?' · typical '+cash(c.impliedBaselineCap)+' (price-based estimate)':''):'Market cap unavailable';
 $('market-context-note').textContent=m.replay?$('replay-info').textContent:mode==='demo'?'Synthetic demo · latest frame drives Envion':c.historyAvailable?'Fixed 5-minute market history + latest received price. Typical cap is inferred from price using snapshot supply, not observed historical market cap. Recent moves cool over time; chart zoom and pan do not affect sound.':'Loading fixed historical context · latest observations and available provider changes drive the orchestra.';
 updateSignalMap(m);
 updateReplayUI(m);
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
 const m=metrics(),energy=m.volume*m.fresh;syncLevels(m);envion.market(m,orchestraTempo(m));
 bpm=orchestraTempo(m);$('tempo').textContent=bpm+' BPM'+(m.context.latestCap?' · MCAP':market?' · MCAP UNKNOWN / FALLBACK':' · DEMO CLOCK');
 send('tempo',bpm);send('activity',m.activity);send('motion',m.motion);send('energy',energy);
 send('balance',m.balance);send('texture',m.texture);send('heartbeat',1);send('tonic',marketRoot(m));send('cutoff',900+m.texture*3100+energy*1800);
}
// Browser updates market controls; the Pd worklet schedules musical events.
function loop(){if(!playing)return;tick();if(playing)timer=setTimeout(loop,150);}
async function initialize(){
 if($('audio-output').value==='native'){pd=await createNativePd(e=>{status(e.message+' · press Pause and reconnect');},state=>{engineView.setTransport(state);});for(const id of controls)send(id,Number($(id).value));bindSignalMap();return;}
 ctx??=new AudioContext({sampleRate:44100});await ctx.resume();
 const manifestResponse=await fetch('patches/orchestra/manifest.json?v=38');if(!manifestResponse.ok)throw Error('Cannot load Envion host manifest');
 const manifest=await manifestResponse.json();
 const files=Object.fromEntries(await Promise.all(manifest.files.map(async name=>{const path='orchestra/'+name,r=await fetch('patches/'+path+'?v=38');if(!r.ok)throw Error('Cannot load '+name);return [path,await r.text()];})));
 Object.assign(files,await envion.files());
 pd=await createPd({audioContext:ctx,packages:['vanilla','cyclone','else'],files,entry:'orchestra/'+manifest.entry,workletUrl:'vendor/libpd-worklet-full.js?v=30',onPrint:text=>{if(!envion.printed(text)){console.log('[Pd]',text);engineView.log(text);}},onError:error=>{engineView.log(error.message);status('Audio engine: '+error.message);}});
 engineView.setFiles(files,manifest,true);
 gain=ctx.createGain();gain.gain.value=0;pd.connect(gain);const analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.minDecibels=-85;analyser.maxDecibels=-15;analyser.smoothingTimeConstant=.65;const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=0;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.12;gain.connect(limiter);limiter.connect(analyser);analyser.connect(ctx.destination);outputTap=analyser;bindSignalMap();
 await envion.attach(pd,ctx,files);
 for(const id of controls)send(id,Number($(id).value));
}
function setPlayState(active){
 const button=$('play');button.dataset.playing=String(active);button.textContent=active?'Ⅱ Pause':'▶ Listen';
 button.setAttribute('aria-label',active?'Pause audio':'Listen to market');button.setAttribute('aria-pressed',String(active));
}
setPlayState(false);
$('play').onclick=async()=>{
 if(starting)return;
 if(playing){if(replay.state.active){replay.advance(chart.renderedBars,chart.interval,true);replay.metrics(chart.renderedBars,market,chart.interval);}playing=false;send('run',0);envion.setRunning(false);clearTimeout(timer);if(gain)gain.gain.setTargetAtTime(0,ctx.currentTime,.025);send('master',0);pd?.flush?.();$('audio-output').disabled=false;setPlayState(false);if(recorder?.state==='recording')recorder.stop();$('record').disabled=true;status(replay.state.active?'History replay paused':'Paused');updateReplayUI(replay.state.controls||{});return;}
 starting=true;$('play').disabled=true;status('Opening instrument…');
 try{if(!pd)await initialize();resetEnsemble();if(ctx)await ctx.resume();if(gain)gain.gain.setTargetAtTime(1,ctx.currentTime,.04);send('master',Number($('master').value));$('audio-output').disabled=true;playing=true;replay.state.clock=performance.now();send('seed',seed%16777216);loop();send('run',1);envion.setRunning(true);setPlayState(true);$('record').disabled=!!pd.native;status(replay.state.active?'Envion playing · history replay':mode==='demo'?'Envion playing · synthetic demo signals':'Envion playing · market signals');}
 catch(e){playing=false;setPlayState(false);envion.detach();$('audio-output').disabled=false;status('Unable to start audio: '+e.message);if(pd)await pd.close();pd=null;await ctx?.close();ctx=null;}
 finally{starting=false;$('play').disabled=false;}
};
$('native-option').disabled=true;
$('native-option').textContent='Native Pd · full Envion browser bridge required';
$('audio-output').onchange=async()=>{
 starting=true;$('play').disabled=true;$('audio-output').disabled=true;
 try{envion.detach();if(pd)await pd.close();pd=null;await ctx?.close();ctx=null;gain=null;outputTap=null;resetEnsemble();status($('audio-output').value==='native'?'Open patches/orchestra/av-desktop.pd · then Listen':'Envion ready');}
 catch(e){status('Could not change audio output: '+e.message);}
 finally{starting=false;$('play').disabled=false;$('audio-output').disabled=false;}
};
for(const id of controls)$(id).addEventListener('input',()=>{send(id,playing?Number($(id).value):0);session?.controls.push({at:Date.now(),name:id,value:Number($(id).value)});});
const volumeButton=$('volume-button'),volumePanel=$('volume-panel');
const closeVolume=()=>{volumePanel.hidden=true;volumeButton.setAttribute('aria-expanded','false');};
volumeButton.onclick=()=>{volumePanel.hidden=!volumePanel.hidden;volumeButton.setAttribute('aria-expanded',String(!volumePanel.hidden));if(!volumePanel.hidden)$('master').focus();};
$('master').addEventListener('input',()=>{$('master-value').textContent=Math.round(Number($('master').value)*100)+'%';});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.volume-widget'))closeVolume();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!volumePanel.hidden){closeVolume();volumeButton.focus();}});
const cash=n=>n!=null&&n!==''&&Number.isFinite(Number(n))?'$'+new Intl.NumberFormat('en',{maximumSignificantDigits:8}).format(n):'—';
const sameToken=(a,b)=>/^0x[0-9a-f]{40}$/i.test(b||'')?a?.toLowerCase()===b.toLowerCase():a===b;
function orientPair(pair,token){
 if(sameToken(pair.baseToken?.address,token))return {...pair,historyTokenSide:'base'};
 if(!sameToken(pair.quoteToken?.address,token))return null;
 const native=Number(pair.priceNative),usd=Number(pair.priceUsd),txns={};
 for(const [window,tx] of Object.entries(pair.txns||{}))txns[window]={buys:tx.sells,sells:tx.buys};
 return {...pair,marketCap:null,fdv:null,historyTokenSide:'quote',baseToken:pair.quoteToken,quoteToken:pair.baseToken,priceNative:native>0?String(1/native):null,priceUsd:native>0&&usd>0?String(usd/native):null,txns,priceChange:{}};
}
function display(){
 displayCoinImage();
 const historical=replay.state.active?replay.state.controls:null,recorded=historical?.replay?.source==='recorded';
 $('mode').textContent=historical?(recorded?'HISTORY · RECORDED CONTROLS':'HISTORY · CANDLE ESTIMATES'):mode==='demo'?'DEMO SIGNAL':streamConnected&&streamKind==='rpc-poll'?'DIRECT RPC · ≥2 SEC':streamConnected&&streamKind==='swap'?'LIVE SWAPS':streamConnected&&streamKind==='trade-poll'?'CACHED TRADE POLLING':streamConnected&&streamKind==='pool'?'POOL ACTIVITY + SNAPSHOTS':'MARKET SNAPSHOTS';
 $('coin-name').textContent=market?market.baseToken.symbol+' / '+market.quoteToken.symbol:'Untuned / Demo';
 $('chain').textContent=market?market.chainId.toUpperCase()+' · '+market.dexId.toUpperCase():'GENERATIVE SESSION';
 $('price').textContent=historical?cash(historical.replay.price):market?cash(currentPrice()):'—';
 const bar=replay.state.bar,change=historical?(recorded?historical.observation?.change:bar?.open>0?(bar.close/bar.open-1)*100:null):market?.priceChange?.m5;
 $('change').textContent=change!=null?Number(change).toFixed(2)+'%':'—';
 $('change-window').textContent=historical&&!recorded?'CANDLE CHANGE':'CHANGE · 5 MIN';
 const tx=historical?recorded?historical.observation?.trades:null:market?.txns?.m5;
 $('trades').textContent=tx?(tx.buys||0)+(tx.sells||0):'—';
 $('trades-window').textContent=historical?'HISTORICAL TRADES · 5 MIN':'TRADES · 5 MIN';
 const liquidity=historical?historical.observation?.liquidity:market?.liquidity?.usd;
 $('liquidity').textContent=liquidity!=null?cash(liquidity):'—';
 updateContext();
}
function updateContext(){
 const historical=replay.state.active?replay.state.controls:null,current=historical?historical.replay.price:currentPrice();
 const known=historical?chart.renderedBars.filter(bar=>candleEnd(bar,chart.interval)<=historical.replay.at):null;
 const first=historical?known[0]:historyContext?.first,peak=historical&&known.length?Math.max(...known.map(bar=>bar.high)):historical?null:historyContext?.peak;
 $('origin-date').textContent=originDate?new Date(originDate).toLocaleDateString():'Unknown';
 $('history-date').textContent=first?new Date(first.time).toLocaleDateString():'Not available';
 $('origin-multiple').textContent=current>0&&first?.open>0?(current/first.open).toFixed(2)+'×':'—';
 $('peak-drawdown').textContent=current>0&&peak>0?((current/peak-1)*100).toFixed(1)+'%':'—';
}
function startHistory(pair){
 const gen=generation;stopHistory?.();stopMusicHistory?.();clearTimeout(musicHistoryTimer);historyContext=null;contextCandles=[];musicalCandles=[];
 function refreshMusicHistory(){if(gen!==generation)return;stopMusicHistory?.();stopMusicHistory=loadHistory(pair,data=>{if(gen!==generation)return;musicalCandles=data.candles;musicalInterval=data.interval;},{timeframe:'minute',aggregate:5,maxPages:1,cacheAge:60000});musicHistoryTimer=setTimeout(refreshMusicHistory,300000);}
 refreshMusicHistory();
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
 replay.setMarket(pair.chainId+':'+pair.pairAddress+':'+pair.baseToken.address);
 generation++;clearTimeout(poll);stopStream?.();stopHistory?.();stopChartHistory?.();stopStream=null;streamPool='';streamConnected=false;streamKind='snapshot';poolEvents=[];tradeEvents=[];lastTrade=null;lastChainPrice=null;receivedTradeCount=0;historyContext=null;originDate=null;chart.reset();
 resetEnsemble();mode='live';market=pair;seed=hash(pair.chainId+':'+pair.baseToken.address);state=seed;step=0;send('seed',seed%16777216);applySnapshot(pair);setupStream();loadCoinImage(pair);startHistory(pair);
 $('last-event').textContent='Waiting for pool events';
 session?.controls.push({at:Date.now(),name:'market',chain:pair.chainId,pool:pair.pairAddress});
 const gen=generation,chain=pair.chainId,address=pair.pairAddress,token=pair.baseToken.address;
 const refresh=async()=>{
  try{const data=await fetchJSON('https://api.dexscreener.com/latest/dex/pairs/'+encodeURIComponent(chain)+'/'+encodeURIComponent(address));if(gen!==generation)return;
   const raw=(data.pairs||[]).find(p=>p.chainId===chain&&p.pairAddress===address);const updated=raw&&orientPair(raw,token);if(!updated)throw Error('Selected pool snapshot unavailable');applySnapshot(updated);
  }catch(e){if(gen===generation)$('lookup').textContent='Snapshot delayed: '+e.message;}
  if(gen===generation)poll=setTimeout(refresh,5000);
 };poll=setTimeout(refresh,5000);status(playing?'Playing · automatic market instrument':'Market loaded · press Listen');
}
const addressField=$('address').closest('.address-field');
const label=$('address-label');label.replaceChildren(...[...label.textContent].map((letter,index)=>{const span=document.createElement('span');span.textContent=letter;span.style.setProperty('--letter',index);return span;}));
function syncAddressLabel(){addressField.classList.toggle('has-value',!!$('address').value.trim());}
$('address').addEventListener('input',syncAddressLabel);
$('address').addEventListener('change',syncAddressLabel);
syncAddressLabel();
$('coin-form').onsubmit=async e=>{
 e.preventDefault();
 if($('address').value.trim().toLowerCase()==='pdata'){const show=$('envion').hidden;$('envion').hidden=!show;$('engine-view').hidden=!show;$('address').value='';syncAddressLabel();status(show?'Pure Data view open':'Pure Data view hidden');return;}
 if(loading)return;
 const wantedNetwork=requestedNetwork,autoPlay=requestedAutoplay;requestedNetwork=null;requestedAutoplay=false;
 const address=$('address').value.trim();if(address.length<5||address.length>250||/\s/.test(address)){status('Enter a token address or chain-specific token identifier.');return;}
 loading=true;$('load').disabled=true;status('Looking up indexed markets…');
 try{
  const data=await fetchJSON('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(address));
  const pairs=(data.pairs||[]).map(p=>orientPair(p,address)).filter(Boolean);pairs.sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0));
  if(!pairs.length)throw Error('No indexed market found for this token identifier.');
  const selection=wantedNetwork?pairs.find(p=>p.chainId===wantedNetwork):pairs[0];if(!selection)throw Error('No DEX Screener market found on the trending coin’s network.');
  discovered=[selection];chooseMarket(selection);if(autoPlay&&!playing)await $('play').onclick();
 }catch(e){status(e.message);$('lookup').textContent=e.message;}
 finally{loading=false;$('load').disabled=false;}
};
$('demo').onclick=()=>{replay.setMarket('demo');resetEnsemble();imageController?.abort();imageToken='';generation++;clearTimeout(poll);stopStream?.();stopHistory?.();stopChartHistory?.();stopMusicHistory?.();clearTimeout(musicHistoryTimer);musicalCandles=[];contextCandles=[];historyContext=null;originDate=null;streamPool='';streamConnected=false;streamKind='snapshot';poolEvents=[];tradeEvents=[];lastTrade=null;lastChainPrice=null;receivedTradeCount=0;chart.reset();market=null;mode='demo';seed=1917;state=seed;step=0;send('seed',seed%16777216);display();$('history-status').textContent='Demo has no launch history';loadChartTimeframe();$('feed').textContent='Synthetic demo signals';$('last-event').textContent='No on-chain stream';$('lookup').textContent='Synthetic signals · enter a contract address for live market data';$('chart-source').textContent='Synthetic demo prices · no market feed';status(playing?'Playing · synthetic demo signals':'Demo ready');session?.controls.push({at:Date.now(),name:'demo'});};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.textContent='Download '+name;a.style.color='var(--accent)';a.style.fontSize='11px';a.style.display='block';$('downloads').append(a);}
const downloads=document.createElement('div');downloads.id='downloads';$('record').parentElement.append(downloads);
$('record').onclick=()=>{
 if(recorder?.state==='recording'){recorder.stop();return;}
 if(!window.MediaRecorder){status('Audio recording is unavailable in this browser.');return;}
 try{
 const destination=ctx.createMediaStreamDestination(),recordNode=outputTap||gain;recordNode.connect(destination);chunks=[];
 const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
 recorder=new MediaRecorder(destination.stream,mime?{mimeType:mime}:undefined);
 session={version:8,started:Date.now(),seed,randomState:state,step,mode,bpm,controls:controls.map(name=>({at:Date.now(),name,value:Number($(name).value)})),snapshots:market?[{at:Date.now(),market}]:[],events:[],patch:'orchestra/market.pd / Envion only',mapping:'market-controls-envion-v4',source:streamKind,historyContext,originDate,initialObservedSwaps:tradeEvents.slice(),replay:replay.state.active?{cursor:replay.state.cursor,source:replay.state.source,speed:replay.state.speed}:null};
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{const name='AV-'+new Date(session.started).toISOString().replace(/[:.]/g,'-');download(new Blob(chunks,{type:recorder.mimeType}),name+(recorder.mimeType.includes('mp4')?'.m4a':'.webm'));download(new Blob([JSON.stringify(session,null,2)],{type:'application/json'}),name+'.json');try{recordNode.disconnect(destination);}catch{}session=null;$('record').textContent='● Record';status('Recording ready to download · session log included');};
 recorder.start(1000);$('record').textContent='■ Finish';status('Recording audio and session changes…');
 }catch(e){status('Recording unavailable: '+e.message);}
};
display();
startTrending(item=>{
 if(loading)return;
 // Resume in the coin click itself: market discovery completes asynchronously.
 // The unlocked context stays silent until Listen opens the selected coin engine.
 if(!playing)primeAudio();
 requestedNetwork=item.chain;requestedAutoplay=true;
 if(item.image)tokenImages.set(imageKey({chainId:item.chain,baseToken:{address:item.address}}),item.image);
 $('address').value=item.address;syncAddressLabel();$('coin-form').requestSubmit();
});
setInterval(()=>{if(!playing)syncLevels(metrics());},250);
const chartStatus=document.querySelector('.chart-status');
new MutationObserver(()=>{for(const item of chartStatus.children)item.title=item.textContent;}).observe(chartStatus,{childList:true,characterData:true,subtree:true});
function primeAudio(){try{ctx??=new AudioContext({sampleRate:44100});ctx.resume().catch(()=>{});}catch{}}
function seekHistory(bar,dragging=false){
 if(!bar)return;
 if(!playing)primeAudio();
 if(!replay.state.active)resetEnsemble();
 replay.seek(bar,chart.interval,dragging);
 session?.controls.push({at:Date.now(),name:'history-seek',cursor:replay.state.cursor,source:'loaded-candle',speed:replay.state.speed});
 if(playing)tick();else{const m=metrics();syncLevels(m);envion.market(m,orchestraTempo(m));if(!starting)$('play').onclick();}
}
chart.onHistorySeek=seekHistory;
chart.onHistorySeekEnd=()=>replay.release();
$('replay-play').onclick=()=>{
 if(replay.state.active&&!replay.state.ended){$('play').onclick();return;}
 seekHistory(chart.renderedBars[0]);
};
$('replay-live').onclick=()=>{
 replay.live();resetEnsemble();chart.tickView?.live();chart.goLive();$('chart-range').value='live';display();
 session?.controls.push({at:Date.now(),name:'history-live'});
 if(playing)tick();else{const m=metrics();syncLevels(m);envion.market(m,orchestraTempo(m));}
 status(playing?'Envion playing · live market signals':'Live market · press Listen');
};
$('replay-speed').onchange=()=>{replay.state.speed=$('replay-speed').value;replay.release();session?.controls.push({at:Date.now(),name:'history-speed',value:replay.state.speed});};
$('chart-view').onchange=()=>chart.setMode($('chart-view').value);
$('chart-range').onchange=()=>chart.setRange($('chart-range').value);
$('chart-timeframe').onchange=()=>{if(replay.state.active)$('replay-live').onclick();loadChartTimeframe();};
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
const playerScreen=window.matchMedia('(max-width:760px)');
function syncChartTypography(){chart.chart.applyOptions({layout:{fontFamily:'Arial, sans-serif',fontSize:playerScreen.matches?11:9}});}
playerScreen.addEventListener('change',syncChartTypography);
document.fonts.ready.then(syncChartTypography);
