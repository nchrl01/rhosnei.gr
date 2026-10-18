import {createCoinSummary} from './coin-summary.js?v=334';
import {rememberRecentCoin} from './coin-catalogue.js?v=334';
import {archivePlayerFrames} from './coin-snapshot-store.js?v=334';
import {createTestMint} from './test-mint.js?v=3';
import {createTestNftExporter} from './test-nft-export.js?v=1';
import {testEvolutionMetrics,testActivityEvent} from './test-evolution.js?v=1';
import {bindSearchField} from './search-field.js?v=265';
import {createVinylTransport} from './vinyl-transport.js?v=215';
import {createMarketLandmarks} from './market-landmarks.js?v=208';
import {seedTonic} from './seed-key.js?v=1';
import {buildReplayScore} from './replay-score.js?v=209';
import {createUIControls} from './ui-controls.js?v=281';
import {isExchangeMarket,isExchangeQuery,searchExchangeMarkets,prepareExchangeMarket,subscribeExchangeMarket} from './ccxt-market.js?v=325';
import {createMusicContext,unlockPlayback,stopLegacyPlayback} from './audio-unlock.js?v=220';
import {isTokenIdentifier,rankCoinMatches,showCoinMatches} from './coin-search.js?v=325';
import {rollingText} from './coin-readout.js?v=53';
import {createTakeShare,loadSharedScore} from './take-share.js?v=220';
import {pianoHarmony} from './music-context.js?v=208';
import {createEnvion} from './envion.js?v=258';
import {createEngineView} from './engine-view.js?v=306';
import {createCoinDither} from './coin-dither.js?v=276';
import {createUpicBrand} from './upic-brand.js?v=115';
import {createTransportIndicator} from './transport-indicator.js?v=220';
import {PIANO_MOVE_PCT} from './piano-policy.js?v=208';
import {createEarthboundVisual as createAudioDots} from './upic-earthbound-visual.js?v=334';
import {createHolderMetadata,holderCountReadout} from './holder-metadata.js?v=334';
import {createNftOwnerPreview} from './nft-owner-preview.js?v=317';
import {rememberPoolLiquidity,poolLiquiditySnapshot,loadPoolLiquidity} from './pool-liquidity.js?v=303';
import {createDataSonification} from './data-sonification.js?v=214';
import {createArpeggioAI} from './ai-instruments.js?v=209';
import {createTradePiano,marketResonance,preloadPianoSamples} from './trade-piano.js?v=220';
import {contextualizeMarket} from './market-state.js?v=208';
import {createMarketReplay,candleEnd,scoreCandle} from './market-replay.js?v=233';
import {signalFreshness} from './market-controls.js?v=18';
import {createOrchestraConductor,ORCHESTRA_LAYERS,orchestraTempo} from './orchestra.js?v=227';
import {createPd} from './vendor/libpd-wasm.js?v=220';
import {subscribePool} from './realtime.js?v=4';
import {subscribeEvm} from './evm.js?v=39';
import {subscribeOrca} from './orca.js?v=39';
import {subscribeRobinhoodV4} from './v4.js?v=135';
import {fetchGecko} from './gecko.js?v=277';
import {startTrending,geckoPoolMarket} from './trending.js?v=277';
import {MarketChart} from './chart.js?v=234';
import {loadHistory} from './history.js?v=326';
import {pollPoolTrades} from './trades.js?v=277';
const $=id=>document.getElementById(id);
// The trusted publisher captures this player silently. Normal visits do not
// capture or store artwork; the catalogue reads the shared cloud archive.
const captureQuery=new URLSearchParams(location.search),captureMode=captureQuery.get('capture')==='live';
if(captureMode){
 document.documentElement.classList.add('live-capture-session');
 const style=document.createElement('style');style.textContent='.live-capture-session body{overflow:hidden!important}.live-capture-session .site-intro{display:none!important}.live-capture-session .audio-visualizer{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;aspect-ratio:auto!important;margin:0!important;padding:24px!important;z-index:9999!important}.live-capture-session .visual-fullscreen{display:none!important}';document.head.append(style);
 document.addEventListener('upic:snapshot-saved',event=>{
  const frame=event.detail?.frame;
  if(!frame||frame.key!==event.detail.key||frame.capturedAt!==event.detail.capturedAt||!(frame.blob instanceof Blob))return;
  window.__upicLiveCapture=frame;
  if(parent!==window)parent.postMessage({type:'upic:live-capture',request:captureQuery.get('captureRequest'),frame},location.origin);
 });
}
const ui=createUIControls();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let envionLoading=null;
let testExportSession=null;
let sharedHarmony=null;
let pd,ctx,gain,listeningGain,outputTap,outputMeters,instrumentTap,audioScopes=[],playing=false,starting=false,poll,market=null,mode='loading',generation=0,loading=false;
let requestedNetwork=null,requestedAutoplay=false;
let snapshotController,searchController;
const providerCooldowns=new Map();
const shouldFetchHistory=()=>!document.hidden||playing;
let pendingHistoryReplay=false;
function historyReplayReady(){return (replay.state.frozen?.bars||chart.history||[]).length>1;}
function finishHistoryReplay(){
 if(!pendingHistoryReplay||!historyReplayReady()||!market)return;
 pendingHistoryReplay=false;chart.draw();seekHistory(chart.history[0]);
}
async function prepareReplayAudio(){
 // Optional engines must not keep a ready replay waiting indefinitely.
 let timeout;
 try{await Promise.race([
  Promise.allSettled([pianoLoading,pdLoading,envionLoading].filter(Boolean)),
  new Promise(resolve=>{timeout=setTimeout(resolve,12000);}),
 ]);}finally{clearTimeout(timeout);}
}
let seed=1917,state=1917,step=0,timer,next=0,bpm=120,session=null;
const controls=['master'];
const engineMaster=()=>1;
let stopStream,streamConnected=false,poolEvents=[],lastSnapshot=0,streamPool='',sharedMarket=false,liveConnection=null;
let streamKind='snapshot',tradePollingAt=0,tradeEvents=[],lastTrade=null,lastChainPrice=null,discovered=[],lastExcitation=0;
let piano=null,pianoEnabled=true,pianoHistory=[],pianoReplayCursor=null,pianoChordCount=0;
let vinyl=null,vinylStopping=false;
let audioEpoch=0,pianoLoading=null,pdLoading=null,pendingPianoTrade=null,idleAudioTimer;
const audioErrors={piano:'',pd:'',envion:''};
let replayPianoPrimed=false,replayPhrase=null;
let receivedTradeCount=0;
let stopMusicHistory,musicHistoryTimer,musicalCandles=[],musicalInterval=300000;
let stopHistory,stopChartHistory,historyContext=null,originDate=null,contextCandles=[],contextInterval=60000,chartRequest=0;
let historyLoadSequence=0,contextHistoryState=null,contextHistoryOperation=null,contextHistoryKey='';
const chart=new MarketChart($('market-chart'));
const replay=createMarketReplay();
createUpicBrand($('upic-mark'),$('upic-mark-fallback'));
const transportIndicator=createTransportIndicator($('transport-status'));
const arpeggioAI=createArpeggioAI({onStatus:text=>$('arp-ai-status').textContent=text,onPattern:pattern=>{if(!testExportSession)piano?.setArpeggioPattern(pattern);}});
const displaySettings={dither:false};
const dataVisual=createAudioDots($('audio-dots'),{getAudio:()=>outputMeters?{context:ctx,channels:outputMeters,scopes:audioScopes}:outputTap,getState:()=>({playing:playing||captureMode,coinKey:market?imageKey(market):null,master:Number($('master').value),...displaySettings,markDirection:({up:1,down:-1})[$('coin-cap').dataset.direction]||0})});
const coinSummary=createCoinSummary($('nft-owner-preview'));
const nftOwnerPreview=createNftOwnerPreview($('nft-owner-preview'),$('audio-dots').closest('.audio-visualizer'),{
 isEligible:pair=>!isExchangeMarket(pair),
 onTestMint:()=>{
  const toggle=document.querySelector('.test-mint-toggle');if(!toggle||toggle.disabled)return false;
  if(toggle.getAttribute('aria-checked')!=='true')toggle.click();
  const controls=document.querySelector('.test-evolution');if(controls){controls.open=true;controls.scrollIntoView({block:'nearest'});controls.querySelector('input')?.focus({preventScroll:true});}
  return true;
 },
});
$('coin-image').closest('.coin-avatar').addEventListener('dragstart',event=>event.preventDefault());
const coinDither=createCoinDither($('coin-image'),$('coin-image-fallback'),{onPixels:image=>dataVisual.setImage(image),onUnavailable:()=>{if(market)void loadCoinImage(market,{fallback:true});}});
$('display-dither').onclick=()=>{displaySettings.dither=!displaySettings.dither;$('display-dither').setAttribute('aria-pressed',String(displaySettings.dither));$('display-dither').textContent='Dither'+(displaySettings.dither?' on':' off');dataVisual.refresh();};
const dataSonification=createDataSonification({send,event});
const holderMetadata=createHolderMetadata({onChange:info=>displayHolderCount(info),onInfo:(info,pair)=>{
 if(info?.image_url){tokenImages.set(imageKey(pair),info.image_url);if(market&&imageKey(market)===imageKey(pair))displayCoinImage();}
}});
function displayHolderCount(info=holderMetadata.snapshot()){
 const node=$('holders'),label=$('holders-label');if(!node||!label)return;
 const readout=holderCountReadout(info,replay.state.active);
 label.textContent=readout.label;node.textContent=readout.value;node.title=readout.title;
}
$('ai-retry').onclick=()=>{arpeggioAI.retry();};
chart.bindReplay(()=>replay.state,()=>playing);
let coinImageURL='',imageController,imageToken='';const tokenImages=new Map();
const imageKey=pair=>pair.chainId+':'+(/^0x[\da-f]{40}$/i.test(pair.baseToken.address)?pair.baseToken.address.toLowerCase():pair.baseToken.address);
let testSimulationActive=false,testRefreshPending=false,lastTestActivityId='';
const testMint=createTestMint(document.querySelector('.coin-copy'),{
 onPreviewEnd:()=>{if(playing&&!starting)$('play').click();},
 onChange:()=>{
  if(testRefreshPending)return;testRefreshPending=true;
  queueMicrotask(()=>{
   testRefreshPending=false;testNftExport.refresh();
   const active=Boolean(testMint.simulation());
   if(active!==testSimulationActive){testSimulationActive=active;lastTestActivityId='';piano?.reset(seed);dataSonification.reset(seed);replayPianoPrimed=false;}
   if(market){if(playing&&!starting)tick();else syncLevels(metrics());}
  });
 },
});
const testNftExport=createTestNftExporter(testMint.exportHost,{
 prepare:prepareTestNftExport,
 enabled:()=>testMint.simulation()?.sampleActivity===true,
 onBusy:value=>testMint.setLocked(value),
});
function engineMetrics(observed){
 if(testExportSession){const frozen=testExportSession.metrics;return {...frozen,testMint:{...frozen.testMint,original:observed}};}
 return testEvolutionMetrics(observed,testMint.simulation());
}
async function prepareTestNftExport(signal){
 const simulation=testMint.simulation();
 if(!simulation?.sampleActivity)throw Error('Choose a test cap and enable sample trades first.');
 const wasPlaying=playing,coinGeneration=generation,id=Symbol('test-export');let visual;
 const check=()=>{if(signal.aborted)throw signal.reason||Error('Export cancelled.');if(generation!==coinGeneration)throw Error('Coin changed during export.');};
 const restore=async()=>{
  if(testExportSession?.id===id)testExportSession=null;
  if(generation===coinGeneration){
   if(!wasPlaying&&playing)await $('play').onclick();
   if(market)syncLevels(metrics());
  }
 };
 try{
  check();
  if(!playing)await $('play').onclick();
  check();await prepareReplayAudio();check();
  if(!playing||ctx?.state!=='running'||!piano)throw Error('The main instrument could not start. Press Listen and try exporting again.');
  // Allow the existing vinyl attack to settle before taking the frozen frame.
  await new Promise(resolve=>setTimeout(resolve,300));check();
  const frozen=structuredClone(metrics());
  if(!frozen.testMint)throw Error('Test simulation was reset. Choose a milestone and try again.');
  delete frozen.testMint.original;
  testExportSession={id,metrics:frozen};
  syncLevels(engineMetrics(liveMetrics()));
  visual=dataVisual.createCapture();
  const snapshot={engine:'upic-main-instrument-v294',seed,symbol:market.baseToken.symbol||market.baseToken.name||'coin',
   token:market.baseToken.address,chain:market.chainId,createdAt:new Date().toISOString(),
   simulation:structuredClone(simulation),stage:frozen.testMint.stage,
   inputs:frozen,tonic:marketRoot(frozen),arpeggio:arpeggioAI.snapshot(),instrument:piano.snapshot(),
   audioContextStart:ctx.currentTime,audioWarnings:{...audioErrors},visual:visual.manifest};
  return {context:ctx,tap:vinyl?.node||instrumentTap,visual,snapshot,restore};
 }catch(error){visual?.close();await restore();throw error;}
}

function safeCoinImage(value){
 try{const url=new URL(value);return url.protocol==='https:'&&url.href.length<=2048&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
async function loadCoinImage(pair,{fallback=false}={}){
 if(isExchangeMarket(pair))return;
 const key=imageKey(pair),requestKey=key+(fallback?':pixels':'');if(imageToken===requestKey)return;imageToken=requestKey;imageController?.abort();
 if(!fallback&&(safeCoinImage(pair.baseToken?.imageUrl)||safeCoinImage(tokenImages.get(key))||pair.historyTokenSide!=='quote'&&safeCoinImage(pair.info?.imageUrl)))return;
 const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
 const controller=new AbortController();imageController=controller;const timeout=setTimeout(()=>controller.abort(),45000);
 const accept=value=>{
  const url=safeCoinImage(value);if(!url||controller.signal.aborted)return false;
  tokenImages.set(key,url);if(market&&imageKey(market)===key)displayCoinImage();return true;
 };
 try{
  // Old shared scores contain no image. Fetch artwork metadata only: their
  // saved prices, market cap and candles must remain exactly as shared.
  if(!fallback)try{
   const data=await fetchJSON('https://api.dexscreener.com/latest/dex/pairs/'+encodeURIComponent(pair.chainId)+'/'+encodeURIComponent(pair.pairAddress),{signal:controller.signal});
   const match=data.pairs?.find(item=>item.chainId===pair.chainId&&sameToken(item.baseToken?.address,pair.baseToken.address));
   if(accept(match?.info?.imageUrl))return;
  }catch{if(controller.signal.aborted)return;}
  const r=await fetchGecko('https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(aliases[pair.chainId]||pair.chainId)+'/tokens/'+encodeURIComponent(pair.baseToken.address)+'/info',{signal:controller.signal,priority:0});
  if(!r.ok)throw Error('Token image unavailable');const data=await r.json();accept(data.data?.attributes?.image_url);
 }catch{if(!controller.signal.aborted)imageToken='';}finally{clearTimeout(timeout);}
}
function displayCoinImage(){
 const token=market?.baseToken;
 if(token)$('coin-image-fallback').textContent=token.symbol.slice(0,2).toUpperCase();
 else if(!$('coin-image-fallback').querySelector('img'))$('coin-image-fallback').innerHTML='<img src="upic-logo-transparent.svg?v=115" alt="UPIC" class="coin-placeholder-logo" draggable="false">';
 const candidates=market?[market,...discovered.filter(p=>p.chainId===market.chainId&&sameToken(p.baseToken?.address,token.address))]:[];
 const image=candidates.find(p=>p.historyTokenSide!=='quote'&&p.info?.imageUrl)?.info?.imageUrl;
 const url=safeCoinImage(market&&tokenImages.get(imageKey(market)))||safeCoinImage(token?.imageUrl)||safeCoinImage(image);
 if(url===coinImageURL)return;coinImageURL=url;
 coinDither.set(url);
}
const conductor=createOrchestraConductor();
const levels=Object.fromEntries(ORCHESTRA_LAYERS.map(name=>[name,0]));
let orchestraState={state:'SPARSE',phrase:0,parameters:{}};

const engineView=createEngineView($('engine-view'),{onBundle:(name,enabled)=>{if(name==='data'){dataSonification.setEnabled(enabled);}else if(name==='piano'){pianoEnabled=enabled;piano?.setEnabled(enabled);}else conductor.setBundle(name,enabled);if(market)syncLevels(metrics());}});
const envion=createEnvion($('envion'),{onTransport:command=>{if((command==='start'&&!playing)||(command==='stop'&&playing))$('play').click();}});
function resetEnsemble({preserveVisual=false}={}){sharedHarmony=null;if(!preserveVisual)dataVisual.reset();dataSonification.reset(seed);replayPianoPrimed=false;replayPhrase=null;conductor.reset();for(let slot=0;slot<5;slot++){send(`math-${slot}-gate`,0);send(`math-${slot}-aux-gate`,0);send(`math-${slot}-level`,0);}piano?.reset(seed);pianoReplayCursor=replay.state.active?replay.state.cursor:null;for(const name of Object.keys(levels))levels[name]=0;engineView.reset();}
function updateSignalMap(m){const view={m,levels,orchestra:orchestraState,bpm:orchestraTempo(m),pianoChordCount,instrument:piano?.snapshot(),visual:dataVisual.snapshot(),resonance:marketResonance(m.context?.latestCap),root:marketRoot(m),master:Number($('master').value),playing,native:false};engineView.update({...view,coin:market?.baseToken?.symbol,feed:m.replay?'History · '+m.replay.source:market?streamKind:'loading',liquidity:m.observation?.liquidity});}
function bindSignalMap(){pd.subscribe?.('data-onset',message=>{dataVisual.pulse(Number(message.values?.[0]),ctx?.currentTime??0);engineView.receive('data-onset',Number(message.values?.[0])||0);});for(const name of ['generation','av-envion-voice','av-output-left','av-output-right'])pd.subscribe?.(name,message=>{const value=Number(message.values[0]);conductor.observe(name,value);engineView.receive(name,value);});}
const scale=[0,2,3,5,7,9,10];
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const rand=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
const status=s=>{if($('status').textContent!==s)$('status').textContent=s;};
function audioStatus(){
 if(!playing)return;
 if(ctx&&ctx.state!=='running'){status('Audio interrupted · tap Resume');return;}
 const parts=[audioErrors.piano?'Instrument unavailable: '+audioErrors.piano:!piano?'Loading instrument…':(replay.state.active?'Listening to history':'Listening to '+(market?.baseToken?.symbol||'market'))+' · '+piano.snapshot().name];
 if(audioErrors.pd)parts.push('Pd unavailable: '+audioErrors.pd);
 else if(!pd)parts.push('More instruments are loading…');
 if(audioErrors.envion)parts.push('Envion unavailable: '+audioErrors.envion);
 status(parts.join(' · '));
}
function flushPianoTrade(){
 if(testMint.simulation()?.sampleActivity)return;
 if(!piano||!playing||ctx?.state!=='running')return;
 const trade=pendingPianoTrade;pendingPianoTrade=null;
 // Keep only a fresh observation across loading, preserving its source type.
 if(trade&&playing&&!replay.state.active&&Date.now()-trade.receivedAt<3000){const m=engineMetrics(liveMetrics());piano[trade.kind==='price-observation'?'observePrice':'trade'](trade,m.context?.latestCap,{...trade.music,tonic:marketRoot(m)});}
}
function observePianoPrice(priceUsd,referencePrice,receivedAt=Date.now(),id='price:'+receivedAt){
 if(testMint.simulation()?.sampleActivity)return;
 if((!playing&&!starting)||replay.state.active||!(priceUsd>0)||!Number.isFinite(priceUsd))return;
 const m=engineMetrics(liveMetrics()),event={id,kind:'price-observation',priceUsd,referencePrice,receivedAt,music:pianoMusic(m)};
 dataSonification.observePrice(priceUsd,{playing:playing&&ctx?.state==='running',clock:ctx?.currentTime??0});
 if(playing&&piano?.observePrice(event,m.context?.latestCap,event.music)){pendingPianoTrade=null;audioStatus();}
 else if(pianoEnabled&&(!piano||starting||ctx?.state!=='running'))pendingPianoTrade=event;
}
function currentPrice(){if(streamConnected&&['swap','trade-poll','rpc-poll','exchange'].includes(streamKind)){if((lastChainPrice?.receivedAt||0)>(lastTrade?.receivedAt||0))return Number(lastChainPrice.priceUsd);if(lastTrade?.priceUsd)return Number(lastTrade.priceUsd);}return Number(market?.priceUsd);}
function marketRoot(m){
 // Market movement changes phrases and energy, never detunes a ringing ensemble.
 return seedTonic(seed);
}
function pianoMusic(m,music=m.music){return {...music,activity:m.activity,tonic:marketRoot(m)};}

const sentControls=new Map(),repeatedSignals=new Set(['seed','heartbeat','data-enabled']);
function send(name,value){
 if(!pd||!Number.isFinite(value))return;
 // Parameter values can be held on the audio thread. Keep actual triggers
 // and watchdog refreshes repeatable, without resending every static control.
 if(!repeatedSignals.has(name)&&!/^math-.*-gate$/.test(name)&&sentControls.get(name)===value)return;
 sentControls.set(name,value);pd.sendFloat(name,value);engineView.sent(name,value);
}
function event(name){pd?.sendBang(name);}
let lastMarketActivityAt=0;
const liveLandmarks=new Map();
function coinLandmarks(key){
 if(!liveLandmarks.has(key)){liveLandmarks.set(key,createMarketLandmarks());if(liveLandmarks.size>8)liveLandmarks.delete(liveLandmarks.keys().next().value);}
 return liveLandmarks.get(key);
}
const liquiditySnapshotMaxAge=()=>market?.snapshotProvider==='gecko'?90000:45000;
function currentLiquidity(now=Date.now()){
 if(!market)return null;
 if(isExchangeMarket(market))return now-(market.exchangeBook?.at||0)<15000?market.exchangeBook?.depth:null;
 // Pool liquidity comes from the market snapshot. Once that snapshot is older
 // than the normal freshness grace, do not let its old depth keep shaping the
 // visual lattice or reverb.
 const snapshot=poolLiquiditySnapshot(market,now);
 return snapshot&&now-snapshot.at<liquiditySnapshotMaxAge()?snapshot.usd:null;
}
function liveMetrics(){
 if(!market)return contextualizeMarket({motion:0,activity:0,balance:.5,texture:0,volume:0,fresh:0,snapshotFresh:0,snapshotAge:Infinity},{price:0,history:[],interval:1000});
 const livePrice=currentPrice(),liveCap=Number(market.marketCap)>0&&Number(market.priceUsd)>0?Number(market.marketCap)*livePrice/Number(market.priceUsd):null;
 const moodMovement=coinLandmarks(imageKey(market)).observe(liveCap,Date.now(),imageKey(market));
 const tx=market.txns?.m5||{};const total=(tx.buys||0)+(tx.sells||0);
 tradeEvents=tradeEvents.filter(e=>Date.now()-e.receivedAt<30000);
 poolEvents=poolEvents.filter(e=>Date.now()-e.receivedAt<10000);
 const decoded=streamConnected&&['swap','trade-poll','rpc-poll','exchange'].includes(streamKind);
 const first=tradeEvents[0],last=tradeEvents.at(-1),movement=first&&last?Math.abs((last.priceQuote/first.priceQuote-1)*100):0;
 const buys=tradeEvents.filter(e=>e.side==='buy').length,knownSides=tradeEvents.filter(e=>['buy','sell'].includes(e.side)).length;
 const book=isExchangeMarket(market)&&Date.now()-(market.exchangeBook?.at||0)<15000?market.exchangeBook:null;
 const liquidity=currentLiquidity();
 const observedVolume=tradeEvents.reduce((sum,e)=>sum+(e.usdVolume||0),0);
 const rate=decoded?tradeEvents.length/30:streamConnected&&streamKind==='pool'?poolEvents.length/10:total/300;
 const volumeRate=decoded?observedVolume/30:(Number(market.volume?.m5)||0)/300;
 const activityAt=Math.max(lastMarketActivityAt,...tradeEvents.map(e=>Number(e.occurredAt)||Number(e.receivedAt)||0));
 const activityAge=Date.now()-activityAt;
 const tradingActivity=activityAt>0&&activityAge>=0&&activityAge<30000?Math.exp(-Math.max(0,activityAge-2000)/8000):0;
 const raw={tradingActivity,tradeRate:decoded?tradeEvents.length/30:0,motion:clamp((decoded?movement:Math.abs(Number(market.priceChange?.m5)||0))/8,0,1),activity:clamp(Math.log1p(rate)/Math.log(21),0,1),balance:book?.balance!=null?book.balance:decoded?(knownSides?buys/knownSides:.5):(total?(tx.buys||0)/total:.5),texture:clamp(Math.log10(Math.max(1,liquidity||1))/7,0,1),volume:clamp(Math.log1p(volumeRate)/Math.log(10001),0,1),...signalFreshness(decoded,lastSnapshot),decoded,observedVolume};
 return {...contextualizeMarket(raw,{price:livePrice,moodMovement,marketCap:Number(market.marketCap),snapshotPrice:Number(market.priceUsd),history:musicalCandles,interval:musicalInterval,changes:market.priceChange||{},liquidity:Number(liquidity),volumeRate,observedAt:Math.max(lastSnapshot,lastTrade?.receivedAt||0,lastChainPrice?.receivedAt||0)}),availability:{balance:book?.balance!=null||(decoded?knownSides>0:total>0),liquidity:liquidity!=null&&Number.isFinite(Number(liquidity)),volume:decoded||market.volume?.m5!=null},audience:holderMetadata.snapshot()};
}
function metrics(){
 const live=liveMetrics();live.observation={liquidity:currentLiquidity(),trades:market?.txns?.m5,change:market?.priceChange?.m5,volume:market?.volume?.m5};
 if(market)replay.record(live,currentPrice());
 const ended=replay.advance(chart.renderedBars||[],chart.interval,playing&&ctx?.state==='running');
 const historical=replay.metrics(chart.renderedBars||[],market,chart.interval);
 const scored=historical&&replay.state.score?.frames.get(replay.state.bar?.time);
 if(scored?.music&&historical.replay?.source==='candles')historical.music={...historical.music,...scored.music};
 if(ended&&playing&&!testMint.simulation()){$('play').onclick();status('History replay finished');}
 return engineMetrics(historical||live);
}
function updateReplayUI(m){
 const active=replay.state.active,source=m.replay?.source;
 if($('holders-label')?.textContent!==(active?'HOLDERS · LATEST':'HOLDERS'))displayHolderCount();
 $('replay-speed').hidden=false;
 $('replay-speed').classList.toggle('is-live',!active);
 $('replay-speed').inert=!active;
 $('replay-speed').setAttribute('aria-hidden',String(!active));
 transportIndicator.render({playing,audioRunning:ctx?.state==='running',replay:active,seeking:replay.state.dragging,ended:replay.state.ended||replay.state.endHold!==null,streamConnected,streamKind,fresh:m.snapshotFresh??m.fresh??0});
 $('replay-live').disabled=!active||!!liveConnection;
 $('replay-play').disabled=!market||pendingHistoryReplay;
 $('replay-play').textContent=active?'Restart':'Replay';
 $('replay-play').setAttribute('aria-label',active?'Restart loaded history':'Play loaded history');
 $('replay-live').textContent=liveConnection?'Connecting…':active?'Back to live':'Live';
 $('replay-live').setAttribute('aria-pressed',String(!active));
 $('replay-play').setAttribute('aria-pressed',String(active));
 const hint=$('replay-hint');
 if(hint){const text=!(chart.renderedBars?.length)?'Loading history · live playback is available.':active?(replay.state.ended?'Replay finished. Restart or return to live.':'Drag the strip to move through the replay.'):'Choose a point on the strip to replay.';if(hint.textContent!==text)hint.textContent=text;}

 const rate=Number(replay.state.speed)||1;
 $('replay-state').textContent=active?(replay.state.speed==='jump'?'· Jump':'· '+rate+'×'):'';

 $('replay-info').textContent='Choose a point to replay. Market changes shape the sound.';
 if(isExchangeMarket(market))$('replay-info').textContent+=' Historical market cap is unavailable.';
 $('replay-state').title=$('replay-info').textContent;
 if(active&&replay.state.bar){chart.tickView?.setReplayTime(replay.state.bar.time);display();}
}
let outputGateOpen=null;
function syncLevels(m){

 m={...m,music:{...m.music,tonic:marketRoot(m),harmony:sharedHarmony}};
 // The final candle gets its existing one-second hold to sound before pause.
 const audibleTransport=vinylStopping||(playing&&(m.testMint||!replay.state.dragging&&!replay.state.ended));
 if(gain&&outputGateOpen!==audibleTransport){outputGateOpen=audibleTransport;gain.gain.setTargetAtTime(audibleTransport?1.5:0,ctx.currentTime,.025);}
 updateCoinReadout(m.testMint?.original||m);
 m.dataSignals=dataSonification.frame(m,{playing:playing&&ctx?.state==='running',seeking:!m.testMint&&replay.state.dragging,ended:!m.testMint&&(replay.state.ended||replay.state.endHold!==null),clock:ctx?.currentTime??0});
 dataVisual.frame(m,{playing:playing||captureMode,seed,clock:!m.testMint&&replay.state.active?(replay.state.cursor-(replay.state.frozen?.bars?.[0]?.time??0))/1000:null,rate:!m.testMint&&replay.state.active?(replay.state.speed==='candle'?(replay.state.frozen?.interval??chart.interval)/1000:Number(replay.state.speed)||1):1,seeking:!m.testMint&&replay.state.dragging,ended:!m.testMint&&(replay.state.ended||replay.state.endHold!==null),position:!m.testMint&&replay.state.active?(replay.state.cursor-(replay.state.frozen?.bars?.[0]?.time??chart.renderedBars?.[0]?.time??0))/Math.max(1000,replay.state.frozen?.interval??chart.interval):null});
 piano?.resonance(m.context?.latestCap);
 piano?.setTempo(m.music?.tempo);
 orchestraState=conductor.update(m,streamConnected);
 for(const name of Object.keys(levels)){levels[name]=orchestraState.levels[name];send(name,levels[name]);const meter=$(name),value=$(name+'-value');if(meter)meter.value=levels[name];if(value)value.textContent=Math.round(levels[name]*100)+'%';}
 for(const [name,value] of Object.entries(orchestraState.parameters))send(name,value);
 $('orchestra-state').textContent=orchestraState.state+' · PHRASE '+(orchestraState.phrase+1)+'/4';
 $('energy-value').textContent=Math.round(m.volume*m.fresh*100)+'%';
 $('volume').textContent=m.replay?cash(m.replay.volume):market?cash(m.decoded?m.observedVolume:market.volume?.m5):'—';
 $('volume-window').textContent=m.replay?'REPLAY USD VOLUME':m.decoded?'OBSERVED USD · LAST 30 SEC':'TRADED USD · 5 MIN';
 $('signal-source').textContent=isExchangeMarket(market)?'Public exchange trades / observed 30 sec; depth is top 25 book levels within 1% of midpoint, not pool liquidity. Market cap is unavailable.'+(market.dexId==='coinbaseexchange'?' Coinbase depth uses public 5-second snapshots.':'')+(market.quoteApproximate?' '+market.quoteToken.symbol+' is used as a USD proxy.':''):m.decoded?'Price, activity, direction and volume: observed trades / 30 sec. '+(['swap','rpc-poll','exchange'].includes(streamKind)?'USD quote conversion and liquidity: snapshots.':'Trade USD values: provider; liquidity: snapshots.'):streamConnected&&streamKind==='pool'?'Activity: pool transactions / 10 sec. Price, volume and direction: 5-minute snapshots.':market?'Price, volume and activity: market snapshots / 5 min.':'Loading the highest-ranked trending market';
 if(market&&m.snapshotAge>liquiditySnapshotMaxAge())$('signal-source').textContent+=' Snapshot age '+Math.round(m.snapshotAge/1000)+'s · liquidity unavailable until a fresh snapshot arrives'+(m.decoded&&['swap','rpc-poll','exchange'].includes(streamKind)?'; native USD values use the last quote conversion.':'.');
 const c=m.context;
 $('market-pressure').textContent=Math.round(m.pressure*100)+'%';
 $('market-baseline').textContent=c.ratio?c.ratio.toFixed(2)+'× typical loaded price':'History context pending';
 $('market-pace').textContent=c.winningWindow?c.winningWindow+' move · '+Math.round(c.pace*100)+'% pace':'No significant measured move';
 $('market-cap-context').textContent=c.latestCap?cash(c.latestCap)+(m.replay?.source==='candles'?' estimated historical cap':c.capEstimated?' estimated latest cap':' snapshot market cap')+(c.impliedBaselineCap?' · typical '+cash(c.impliedBaselineCap)+' (price-based estimate)':''):'Market cap unavailable';
 $('market-context-note').textContent=m.replay?$('replay-info').textContent:!market?'Loading the highest-ranked trending market':c.historyAvailable?'Fixed 5-minute market history + latest received price. Typical cap is inferred from price using snapshot supply, not observed historical market cap. Recent moves cool over time; chart zoom and pan do not affect sound.':'Loading fixed historical context · latest observations and available provider changes drive the orchestra.';
 updateSignalMap(m);
 document.querySelectorAll('.footer-networks [data-network]').forEach(node=>{const selected=node.dataset.network===market?.chainId;node.dataset.state=selected?(streamConnected?'active':'connecting'):'available';node.querySelector('small').textContent=selected?(streamConnected?'Active':'Connecting'):'Available';});
 updateReplayUI(m.testMint?.original||m);
}
function setupStream(){
 const key=market?.chainId+':'+market?.pairAddress;if(key===streamPool)return;
 stopStream?.();streamPool=key;streamConnected=false;tradePollingAt=0;poolEvents=[];
 const gen=generation;
 let stopNative,stopFallback,nativeState={connected:false,kind:'snapshot',message:''},fallbackState={connected:false,kind:'snapshot',message:''};
 const signatures={rpc:new Set(),gecko:new Set(),ccxt:new Set()},tradeIds=new Set();
 const publish=()=>{
  const chosen=nativeState.connected&&['swap','rpc-poll','exchange'].includes(nativeState.kind)?nativeState:fallbackState.connected&&fallbackState.kind==='trade-poll'?fallbackState:nativeState.connected&&nativeState.kind==='pool'?nativeState:fallbackState.message?fallbackState:nativeState;
  streamConnected=chosen.connected;streamKind=chosen.kind;$('feed').textContent=chosen.message+(chosen!==nativeState&&nativeState.message?' · direct route: '+nativeState.message:'');display();
 };
 const startFallback=()=>{if(stopFallback)return;stopFallback=pollPoolTrades(market,receive,s=>{if(gen!==generation)return;fallbackState=s;tradePollingAt=s.connected?s.checkedAt||0:0;publish();});};
 const receive=e=>{
  if(gen!==generation)return;
  if(e.kind==='market-price'){
   const quoteUsd=Number(market.priceUsd)/Number(market.priceNative),priceUsd=e.priceQuote*quoteUsd;
   if(priceUsd>0&&Number.isFinite(priceUsd)){const previous=lastChainPrice?.priceUsd??currentPrice();if(!replay.state.active&&previous>0&&Math.abs(priceUsd/previous-1)>1e-9){dataVisual.event({...e,priceUsd});}lastChainPrice={...e,priceUsd};observePianoPrice(priceUsd,previous,e.receivedAt);chart.add({at:e.occurredAt||e.receivedAt,price:priceUsd,source:'rpc-state'});$('chart-source').textContent='Direct Robinhood RPC pool state · refreshed during quiet periods · USD quote conversion uses snapshots';display();}
   session?.events?.push(e);return;
  }
  if(e.kind==='timing'){const trade=tradeEvents.find(t=>t.id===e.id)||(lastTrade?.id===e.id?lastTrade:null);if(trade){trade.occurredAt=e.occurredAt;trade.precision=e.precision;}chart.retime(e.id,e.occurredAt);session?.events?.push(e);return;}
  if(e.removed){tradeEvents=tradeEvents.filter(t=>t.id!==e.id);pianoHistory=pianoHistory.filter(t=>t.id!==e.id);chart.remove(e.id);lastTrade=tradeEvents.at(-1)||null;session?.events?.push(e);$('last-event').textContent='Chain reorganization · removed swap';display();return;}
  if(e.kind==='swap'){
   const source=e.source||'rpc',other=source==='rpc'?'gecko':'rpc';
   if(!e.signature||!e.id||tradeIds.has(e.id)||signatures[other].has(e.signature))return;
   tradeIds.add(e.id);if(tradeIds.size>20000)tradeIds.delete(tradeIds.values().next().value);
   signatures[source].add(e.signature);if(signatures[source].size>4096)signatures[source].delete(signatures[source].values().next().value);
   const quoteUsd=Number(market.priceUsd)/Number(market.priceNative);
   if(source==='rpc'){e.priceUsd=quoteUsd>0&&Number.isFinite(quoteUsd)?(e.spotQuote||e.priceQuote)*quoteUsd:null;e.usdVolume=e.priceUsd?e.quoteAmount*quoteUsd:0;}
   tradeEvents.push(e);lastTrade=e;receivedTradeCount++;const live=liveMetrics();e.music=pianoMusic(live);
   const performed=engineMetrics(live),soundEvent={...e,music:pianoMusic(performed)},sampleActivity=performed.testMint?.sampleActivity;
   if(!replay.state.active&&!sampleActivity){dataSonification.frame(performed,{playing:playing&&ctx?.state==='running',clock:ctx?.currentTime??0});dataSonification.event(soundEvent,{playing:playing&&ctx?.state==='running',replay:false,clock:ctx?.currentTime??0});dataVisual.event(soundEvent);}
   pianoHistory.push({...e,at:e.receivedAt});if(pianoHistory.length>20000)pianoHistory.shift();
   if((playing||starting)&&!replay.state.active&&!sampleActivity){
    if(playing&&piano?.trade(soundEvent,performed.context?.latestCap,{...soundEvent.music,tonic:marketRoot(performed)})){pendingPianoTrade=null;audioStatus();}
    else if(pianoEnabled&&(!piano||starting||ctx?.state!=='running'))pendingPianoTrade=soundEvent;
   }
   if(e.priceUsd)chart.add({at:Number.isFinite(e.occurredAt)?e.occurredAt:e.receivedAt,price:e.priceUsd,volume:e.usdVolume,id:e.id,source:'swap'});
   $('chart-source').textContent=source==='ccxt'?market.exchangeName+' · public WebSocket trades · '+(market.quoteApproximate?market.quoteToken.symbol+' prices used as a USD proxy':'USD trade prices')+' · history volume estimated from base volume':source==='rpc'?(e.protocol==='orca'?'Orca post-swap spot prices · confirmed WebSocket events · USD uses snapshot SOL/quote conversion':e.protocol==='v4'?'Direct Uniswap v4 post-swap prices · RPC polling ≥2s · USD quote conversion uses snapshots':'Streamed swap execution prices · USD estimated using latest quote conversion'):'Observed trade prices · GeckoTerminal / ≥8s polling · upstream cached · provider USD values';
   $('last-event').textContent=e.side.toUpperCase()+(source==='ccxt'?' · '+market.exchangeName:' · block '+e.block);display();
  }else{poolEvents.push(e);if(!replay.state.active){dataVisual.event(e);}if(streamKind==='pool')$('last-event').textContent='Pool event · slot '+e.slot;}
  session?.events?.push(e);
  if(playing&&performance.now()-lastExcitation>=40){lastExcitation=performance.now();tick();}
 };
 if(isExchangeMarket(market)){
  stopNative=subscribeExchangeMarket(market,receive,s=>{if(gen!==generation)return;nativeState=s;publish();},book=>{if(gen!==generation)return;market.exchangeBook=book;display();});
 }else if(market.chainId==='solana'){
  if(market.dexId==='orca'){
   stopNative=subscribeOrca(market,receive,s=>{if(gen!==generation)return;nativeState=s;if(s.connected&&s.kind==='swap'){stopFallback?.();stopFallback=null;fallbackState={connected:false,kind:'snapshot',message:''};}else startFallback();publish();});
  }else{stopNative=subscribePool(market.pairAddress,receive,message=>{if(gen!==generation)return;nativeState={connected:message.startsWith('Connected'),kind:message.startsWith('Connected')?'pool':'snapshot',message};publish();});startFallback();}
 }else{
  const subscribe=market.chainId==='robinhood'&&/^0x[0-9a-f]{64}$/i.test(market.pairAddress)?subscribeRobinhoodV4:subscribeEvm;
  stopNative=subscribe(market,receive,s=>{if(gen!==generation)return;nativeState=s;if(s.connected&&['swap','rpc-poll','exchange'].includes(s.kind)){stopFallback?.();stopFallback=null;fallbackState={connected:false,kind:'snapshot',message:''};}else startFallback();publish();});
 }
 stopStream=()=>{stopNative?.();stopFallback?.();};
}
function musicalFrame(m){const intensity=m.music?.intensity||0,tradingActivity=m.tradingActivity??(m.replay?(Number(m.replay.volume)>0?1:m.replay.volume==null&&m.raw?.motion>0?1:0):m.raw?.activity??0),score=m.replay?replay.state.score?.frames.get(replay.state.bar?.time):null;return {...m,replay:m.replay?{...m.replay,scoreIndex:score?.index,sceneSeed:score?.sceneSeed}:undefined,tradingActivity,activity:(m.raw?.activity??m.activity)*tradingActivity,motion:intensity,volume:(m.raw?.volume??m.volume)*tradingActivity,pressure:intensity};}
function replayPiano(m){
 if(!playing||replay.state.dragging||!piano||!pianoEnabled||ctx?.state!=='running')return;
 const cursor=replay.state.cursor,bars=replay.state.frozen?.bars||chart.renderedBars,interval=replay.state.frozen?.interval||chart.interval;
 const rate=replay.state.speed==='candle'?interval/1000:Number(replay.state.speed)||1;
 if(!replayPianoPrimed){
  const segments=bars.map(bar=>{
   const score=replay.state.score?.frames.get(bar.time),music=pianoMusic({music:score?.music||{},activity:score?.activity||0});
   return {start:candleEnd(bar,interval),end:candleEnd(bar,interval)+interval,music,cap:score?.cap,harmonyStep:score?.harmonyStep||0,active:Number(bar.volume)>0||(bar.volume==null&&score?.selection?.reason==='movement')};
  });
  piano.setTimeline(segments);piano.seekTimeline(cursor,rate);replayPianoPrimed=true;
 }else piano.syncTimeline(cursor,rate);
 pianoReplayCursor=cursor;
}
function tick(){
 const m=metrics(),music=musicalFrame(m),energy=music.volume*m.fresh;
 if(!replay.state.active)arpeggioAI.setContext(m.music);
 syncLevels(m);envion.market(music,orchestraTempo(m));
 bpm=orchestraTempo(m);$('tempo').textContent=bpm+' BPM · '+Math.round((m.music?.intensity||0)*100)+'% INTENSITY';
 if(m.testMint?.sampleActivity&&playing&&ctx?.state==='running'){
  const sampleClock=Math.floor(ctx.currentTime),id=imageKey(market)+':'+sampleClock;
  if(id!==lastTestActivityId){
   lastTestActivityId=id;
   const e=testActivityEvent(imageKey(market),m.testMint.cap,sampleClock,Date.now(),m.music.group);e.music=pianoMusic(m);
   piano?.trade(e,m.context.latestCap,e.music);
   dataSonification.event(e,{playing:true,replay:false,clock:ctx.currentTime});dataVisual.event(e);
  }
 }
 if(replay.state.active&&!m.testMint)replayPiano(m);else{pianoReplayCursor=null;replayPianoPrimed=false;}
 const historical=replay.state.active&&!m.testMint,bar=replay.state.bar;
 piano?.frame({...m,music:pianoMusic(m)},{playing,seeking:!m.testMint&&replay.state.dragging,ended:!m.testMint&&replay.state.ended,at:historical?replay.state.cursor:Date.now(),price:historical?bar?.close:currentPrice(),referencePrice:historical?bar?.open:undefined,known:historical?bar?.volume===0:(m.decoded&&streamKind!=='trade-poll'&&m.fresh>0)||(tradePollingAt>0&&Date.now()-tradePollingAt<25000),quiet:historical?bar?.volume===0:true});
 send('tempo',bpm);send('activity',music.activity);send('motion',music.motion);send('energy',energy);
 send('balance',m.balance);send('texture',m.texture);send('heartbeat',1);send('tonic',marketRoot(m));send('cutoff',900+m.texture*3100+energy*1800);
}
// Browser updates market controls; the Pd worklet schedules musical events.
function loop(){if(!playing)return;tick();if(playing)timer=setTimeout(loop,150);}
async function initialize(){
 if(audioContext().state!=='running'){const error=Error('Audio is interrupted · tap Listen again');error.name='AudioUnlockError';throw error;}
 if(!gain){
  vinyl=await createVinylTransport(ctx);
  gain=ctx.createGain();gain.gain.value=0;
  const analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.minDecibels=-85;analyser.maxDecibels=-15;analyser.smoothingTimeConstant=.65;
  const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=0;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.12;
  gain.connect(limiter);limiter.connect(vinyl.node);vinyl.node.connect(analyser);
  listeningGain=ctx.createGain();listeningGain.gain.value=Number($('master').value);
  const recordTap=ctx.createAnalyser();recordTap.fftSize=2048;
  analyser.connect(listeningGain);listeningGain.connect(recordTap);recordTap.connect(ctx.destination);outputTap=recordTap;
  // Measure engine output BEFORE listening volume: a mono downmix can cancel a wide
  // piano/reverb signal. This sidechain does not change listening or recording.
  const splitter=ctx.createChannelSplitter(2);vinyl.node.connect(splitter);
  outputMeters=[0,1].map(channel=>{const meter=ctx.createAnalyser();meter.fftSize=2048;splitter.connect(meter,channel);return meter;});
  // Piano and Pd share the instrument-analysis tap.
  instrumentTap=ctx.createGain();instrumentTap.connect(gain);
  function scope(name,out){const input=ctx.createGain();input.connect(out);const split=ctx.createChannelSplitter(2);input.connect(split);const channels=[0,1].map(channel=>{const meter=ctx.createAnalyser();meter.fftSize=2048;split.connect(meter,channel);return meter;});audioScopes.push({name,input,channels});return input;}
  scope('EarthBound',instrumentTap).gain.value=2;scope('Pure Data',instrumentTap);

 }
 const epoch=audioEpoch,context=ctx,destination=instrumentTap;
 if(!piano&&!pianoLoading){
  audioErrors.piano='';
  pianoLoading=createTradePiano(context,audioScopes[0]?.input||destination,{initialSeed:seed,onVoice:event=>{if(epoch===audioEpoch){sharedHarmony=event.harmony;if(event.audible!==false)pianoChordCount++;if(event.audible!==false&&event.time!=null)dataVisual.piano(event.time,1);}},onArpeggio:event=>{if(epoch===audioEpoch&&event.time!=null)dataVisual.piano(event.time,.65);}}).then(instrument=>{
   if(epoch!==audioEpoch){instrument.close();throw Error('Audio loading cancelled');}
   piano=instrument;piano.setArpeggioPattern(arpeggioAI.snapshot());piano.setEnabled(pianoEnabled);piano.setMaster(1);piano.reset(seed);piano.resonance(engineMetrics(liveMetrics()).context?.latestCap);piano.setRunning(playing);
   if(playing){flushPianoTrade();if(replay.state.active)tick();}audioStatus();return piano;
  }).catch(error=>{if(epoch===audioEpoch){audioErrors.piano=error.message;engineView.log('Piano: '+error.message);audioStatus();}throw error;}).finally(()=>{if(epoch===audioEpoch)pianoLoading=null;});
 }
 if(!pd&&!pdLoading){
  audioErrors.pd='';audioErrors.envion='';
  pdLoading=(async()=>{
   const [orchestra,envionFiles]=await Promise.all([(async()=>{
    const response=await fetch('patches/orchestra/manifest.json?v=214');if(!response.ok)throw Error('Cannot load orchestra manifest');
    const manifest=await response.json();
    const files=Object.fromEntries(await Promise.all(manifest.files.map(async name=>{const path='orchestra/'+name,r=await fetch('patches/'+path+'?v=214');if(!r.ok)throw Error('Cannot load '+name);return [path,await r.text()];})));
    return {manifest,files};
   })(),envion.files()]);
   if(epoch!==audioEpoch)throw Error('Audio loading cancelled');
   const {manifest,files}=orchestra;Object.assign(files,envionFiles);
   const runtime=await createPd({audioContext:context,packages:['vanilla','cyclone','else'],files,entry:'orchestra/'+manifest.entry,workletUrl:'vendor/libpd-worklet-full.js?v=220',onPrint:text=>{if(epoch===audioEpoch&&!envion.printed(text)){console.log('[Pd]',text);engineView.log(text);}},onError:error=>{if(epoch===audioEpoch){audioErrors.pd=error.message;engineView.log(error.message);audioStatus();}}});
   if(epoch!==audioEpoch){await runtime.close();throw Error('Audio loading cancelled');}
   pd=runtime;sentControls.clear();replayPhrase=null;runtime.connect(audioScopes[1]?.input||destination);engineView.setFiles(files,manifest,true);bindSignalMap();dataSonification.reset(seed);
   send('seed',seed%16777216);send('master',playing?engineMaster():0);if(playing)tick();send('run',playing?1:0);
   // Math and beat voices can start as soon as Pd is ready. Envion's sample
   // handshake has its own outcome and cannot close the other instruments.
   envionLoading=envion.attach(runtime,context,files).then(attached=>{if(epoch!==audioEpoch||!attached)return;envion.setSeed(seed);envion.setRunning(playing);if(playing)tick();audioStatus();}).catch(error=>{if(epoch===audioEpoch){send('av-envion-ready',0);envion.detach();audioErrors.envion=error.message;engineView.log('Envion: '+error.message);audioStatus();}});
   audioStatus();return runtime;
  })().catch(error=>{if(epoch===audioEpoch){audioErrors.pd=error.message;engineView.log('Pd: '+error.message);audioStatus();}throw error;}).finally(()=>{if(epoch===audioEpoch)pdLoading=null;});
 }
 // Start with whichever instrument is ready first. Promise.any observes both
 // failures, so a later Pd rejection does not become an unhandled rejection.
 try{await Promise.any([piano||pianoLoading,pd||pdLoading].filter(Boolean));}
 catch{throw Error([audioErrors.piano,audioErrors.pd].filter(Boolean).join(' · ')||'No audio instrument could load');}
}
async function closeAudio(){
 clearTimeout(idleAudioTimer);vinylStopping=false;vinyl?.close();vinyl=null;
 arpeggioAI.close();stopLegacyPlayback();audioEpoch++;pianoLoading=null;pdLoading=null;pendingPianoTrade=null;
 piano?.close();piano=null;envion.detach();const runtime=pd,context=ctx;pd=null;sentControls.clear();ctx=null;gain=null;listeningGain=null;outputGateOpen=null;outputTap=null;outputMeters=null;instrumentTap=null;audioScopes=[];
 for(const name of Object.keys(audioErrors))audioErrors[name]='';
 if(runtime)await runtime.close();await context?.close();
}
function setPlayState(active){
 if(!active&&testExportSession)testNftExport.cancel('Export cancelled because playback stopped.');
 testMint.setPlaying(active&&ctx?.state==='running');
 const button=$('play'),interrupted=active&&ctx?.state!=='running';
 button.dataset.playing=String(active&&!interrupted);
 button.innerHTML='<svg class="transport-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(active&&!interrupted?'<path d="M7 5h4v14H7zM14 5h4v14h-4z" fill="currentColor"/>':'<path d="M8 4l12 8-12 8z" fill="currentColor"/>')+'</svg>';
 button.title=interrupted?'Resume':active?'Pause':'Listen';
 button.setAttribute('aria-label',interrupted?'Resume interrupted audio':active?'Pause audio':'Listen to market');
 button.setAttribute('aria-pressed',String(active&&!interrupted));
 button.setAttribute('aria-busy',String(starting));
}
let audioLoadFailed=false;
function audioBusy(value){
 starting=value;$('play').disabled=value;setPlayState(playing);
 if(value)audioLoadFailed=false;
 ui.loading('audio',null,'');
}
setPlayState(false);
$('play').onclick=async()=>{
 if(starting)return;
 clearTimeout(idleAudioTimer);
 const wasInterrupted=playing&&ctx&&ctx.state!=='running';
 let unlocked;
 if(!playing||ctx?.state!=='running'){try{unlocked=unlockPlayback(audioContext());}catch(error){status(error.message);return;}}
 if(wasInterrupted){
  audioBusy(true);
  try{await unlocked;if(ctx.state!=='running')throw Error('Tap Resume again to enable audio');flushPianoTrade();setPlayState(true);audioStatus();}
  catch(error){audioLoadFailed=true;status('Audio interrupted · '+error.message);}
  finally{audioBusy(false);}
  return;
 }
 if(playing){
  if(replay.state.active){replay.advance(chart.renderedBars,chart.interval,true);replay.metrics(chart.renderedBars,market,chart.interval);}
  playing=false;vinylStopping=true;arpeggioAI.suspend();pendingPianoTrade=null;clearTimeout(timer);setPlayState(false);
  // Freeze the chart immediately, but let the complete sounding mix coast down.
  const stopped=()=>{
   if(playing||starting)return;
   vinylStopping=false;stopLegacyPlayback();dataSonification.reset(seed);piano?.setRunning(false);send('run',0);envion.setRunning(false);
   if(gain)gain.gain.setTargetAtTime(0,ctx.currentTime,.025);outputGateOpen=false;send('master',0);pd?.flush?.();void takeShare.finish();
   idleAudioTimer=setTimeout(()=>{if(!playing&&!starting&&ctx?.state==='running')void ctx.suspend().catch(()=>{});},100);
  };
  if(vinyl)vinyl.pause(stopped);else stopped();
  status(replay.state.active?'History replay paused':'Paused');updateReplayUI(replay.state.controls||{});return;
 }
 vinylStopping=false;audioBusy(true);status('Loading sounds…');
 try{await unlocked;if(!market)throw Error('Trending market is still loading.');if(!pd||!piano)await initialize();if(replay.state.active)await prepareReplayAudio();resetEnsemble({preserveVisual:!replay.state.active});if(ctx&&ctx.state!=='running'){const error=Error('Audio is interrupted · tap Listen again');error.name='AudioUnlockError';throw error;}if(gain)gain.gain.setTargetAtTime(1.5,ctx.currentTime,.04);send('master',engineMaster());playing=true;piano?.setRunning(true);flushPianoTrade();replay.state.clock=performance.now();send('seed',seed%16777216);envion.setSeed(seed);loop();send('run',1);envion.setRunning(true);vinyl?.play();setPlayState(true);takeShare.start(ctx,outputTap);audioStatus();}
 catch(e){audioLoadFailed=true;playing=false;clearTimeout(timer);setPlayState(false);status('Unable to start audio: '+e.message);if(e.name!=='AudioUnlockError')await closeAudio();}
 finally{audioBusy(false);}
};
for(const id of controls)$(id).addEventListener('input',()=>{if(listeningGain)listeningGain.gain.setTargetAtTime(Number($(id).value),ctx.currentTime,.025);session?.controls.push({at:Date.now(),name:id,value:Number($(id).value)});});
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
 document.querySelector('.audio-visualizer').dataset.marketLoaded=String(!!market);
 displayCoinImage();
 const historical=replay.state.active?replay.state.controls:null,recorded=historical?.replay?.source==='recorded';
 $('mode').hidden=!!historical||!market;
 $('mode').textContent=historical||!market?'':streamConnected&&streamKind==='rpc-poll'?'DIRECT RPC · ≥2 SEC':streamConnected&&streamKind==='exchange'?'LIVE EXCHANGE'+(market.quoteApproximate?' · '+market.quoteToken.symbol+' ≈ USD':''):streamConnected&&streamKind==='swap'?'LIVE SWAPS':streamConnected&&streamKind==='trade-poll'?'CACHED TRADE POLLING':streamConnected&&streamKind==='pool'?'POOL ACTIVITY + SNAPSHOTS':'MARKET SNAPSHOTS';
 $('coin-name').textContent=market?market.baseToken.symbol+' / '+market.quoteToken.symbol:'';
 $('chain').textContent=market?market.chainId.toUpperCase()+' · '+market.dexId.toUpperCase():'GENERATIVE SESSION';

 $('price').textContent=historical?cash(historical.replay.price):market?cash(currentPrice()):'—';
 const exchangeMarket=isExchangeMarket(market),firstTrade=tradeEvents[0];
 const exchangeChange=firstTrade?.priceUsd>0?(currentPrice()/firstTrade.priceUsd-1)*100:null;
 const bar=replay.state.bar,change=historical?(recorded?historical.observation?.change:bar?.open>0?(bar.close/bar.open-1)*100:null):exchangeMarket?exchangeChange:market?.priceChange?.m5;
 $('change').textContent=change!=null?Number(change).toFixed(2)+'%':'—';
 $('change-window').textContent=historical&&!recorded?'CANDLE CHANGE':exchangeMarket?'CHANGE · OBSERVED 30 SEC':'CHANGE · 5 MIN';
 const tx=historical?recorded?historical.observation?.trades:null:market?.txns?.m5;
 $('trades').textContent=!historical&&exchangeMarket?tradeEvents.length:tx?(tx.buys||0)+(tx.sells||0):'—';
 $('trades-window').textContent=historical?'HISTORICAL TRADES · 5 MIN':exchangeMarket?'TRADES · OBSERVED 30 SEC':'TRADES · 5 MIN';
 const poolSnapshot=!exchangeMarket?poolLiquiditySnapshot(market):null;
 const snapshotLiquidity=poolSnapshot?.usd;
 const recordedLiquidity=historical?.observation?.liquidity;
 const hasRecordedLiquidity=recordedLiquidity!=null&&Number.isFinite(Number(recordedLiquidity));
 const latestLiquidity=Boolean(historical)&&!hasRecordedLiquidity;
 const liquidity=historical&&hasRecordedLiquidity?recordedLiquidity:exchangeMarket?currentLiquidity():snapshotLiquidity;
 const liquidityAvailable=liquidity!=null&&Number.isFinite(Number(liquidity));
 $('liquidity-label').textContent=(exchangeMarket?'BOOK DEPTH · ±1%'+(market.dexId==='coinbaseexchange'?' / 5S':' / ≤25 LEVELS'):'LIQUIDITY')+(latestLiquidity?' · LATEST':'');
 $('liquidity').textContent=liquidityAvailable?cash(liquidity):'Unavailable';
 $('liquidity').title=historical&&hasRecordedLiquidity?'Liquidity recorded at this replay point':exchangeMarket?'Current exchange order-book depth':liquidityAvailable?'Selected pool liquidity · snapshot received '+new Date(poolSnapshot?.at||lastSnapshot).toLocaleTimeString()+(Date.now()-(poolSnapshot?.at||lastSnapshot)>liquiditySnapshotMaxAge()?' · updates delayed':'')+(latestLiquidity?' · latest available, not historical liquidity':''): 'Selected pool liquidity is unavailable';
 displayHolderCount();
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
function beginHistoryLoad(){return {id:'history-'+(++historyLoadSequence),startedAt:performance.now(),endedAt:null};}
function historyLoadState(data,operation){
 const busy=['loading','cached'].includes(data.state)&&!data.error;
 operation.endedAt=busy?null:operation.endedAt??performance.now();
 return {...data,operation:operation.id,startedAt:operation.startedAt,endedAt:operation.endedAt};
}
function startHistory(pair){
 if(!pair)return;
 const gen=generation,key=pair.chainId+':'+pair.pairAddress+':'+pair.baseToken.address;
 stopHistory?.();stopMusicHistory?.();clearTimeout(musicHistoryTimer);
 if(contextHistoryKey!==key){historyContext=null;contextCandles=[];musicalCandles=[];}
 contextHistoryKey=key;const operation=beginHistoryLoad();contextHistoryOperation=operation;
 contextHistoryState=historyLoadState({candles:contextCandles,interval:contextInterval,state:'loading',error:null},operation);
 function refreshMusicHistory(){if(gen!==generation)return;if(document.hidden&&!playing){musicHistoryTimer=setTimeout(refreshMusicHistory,10000);return;}stopMusicHistory?.();stopMusicHistory=loadHistory(pair,data=>{if(gen!==generation)return;musicalCandles=data.candles;musicalInterval=data.interval;},{timeframe:'minute',aggregate:5,maxPages:1,cacheAge:60000,priority:60,shouldFetch:shouldFetchHistory});musicHistoryTimer=setTimeout(refreshMusicHistory,300000);}
 if($('chart-timeframe').value!=='auto')loadChartTimeframe();else setHistoryLoading(contextHistoryState);
 const dates=discovered.filter(p=>p.chainId===pair.chainId).map(p=>Number(p.pairCreatedAt)).filter(n=>n>0);
 originDate=dates.length?Math.min(...dates):Number(pair.pairCreatedAt)||null;updateContext();
 stopHistory=loadHistory(pair,data=>{
  if(gen!==generation||contextHistoryOperation!==operation)return;
  // A failed refresh keeps the already displayed provider candles available.
  if(!data.candles.length&&contextCandles.length&&data.interval===contextInterval&&(data.error||['loading','cached'].includes(data.state)))data={...data,candles:contextCandles};
  contextHistoryState=historyLoadState(data,operation);
  const first=data.candles[0];historyContext=first?{first,peak:Math.max(...data.candles.map(b=>b.high)),state:data.state,interval:data.interval}:null;
  contextCandles=data.candles;contextInterval=data.interval;
  if($('chart-timeframe').value==='auto'){setHistoryLoading(contextHistoryState);chart.setHistory(data.candles,data.interval,originDate);chart.draw();finishHistoryReplay();$('chart-resolution').textContent='Auto context · '+data.timeframe+' candles';}
  const gap=first&&originDate&&first.time>originDate+data.interval?' · gap between first known market and available history':'';
  $('history-status').textContent=data.message+' · '+data.timeframe+' candles'+gap;
  updateContext();session?.controls.push({at:Date.now(),name:'history-context',first:first?.time,firstOpen:first?.open,state:data.state,originDate});
 },{priority:100,shouldFetch:shouldFetchHistory});
 // Enqueue the visible chart before the supporting five-minute score.
 refreshMusicHistory();
}
function setHistoryLoading(data={}){
 const host=$('history-loading'),has=data.candles?.length>0,failed=Boolean(data.error)||data.state==='unavailable',busy=!failed&&['loading','cached'].includes(data.state);
 if(pendingHistoryReplay&&failed&&!data.retrying&&!historyReplayReady()){
  pendingHistoryReplay=false;status('History unavailable · retry history to replay');updateReplayUI({});
 }
 host.hidden=has&&!busy&&!failed;host.dataset.partial=String(has);host.classList.toggle('is-loading',busy);$('market-chart').setAttribute('aria-busy',String(busy));
 $('history-loading-label').textContent=failed?(has?'History refresh delayed · showing loaded candles':'History delayed')+(data.retrying?' · retrying automatically':' · retry available'):has?'Updating earlier prices…':busy?'Loading earlier prices…':'No earlier prices available';
 $('history-retry').hidden=busy;
 ui.loading('history',busy?'working':failed||!has?'error':'done',data.retrying&&busy?'Retrying history':has?'Updating history':'Loading history',{operation:data.operation??null,startedAt:data.startedAt,endedAt:data.endedAt});
}
$('history-retry').onclick=()=>{$('chart-timeframe').value==='auto'?startHistory(market):loadChartTimeframe();};
const chartFrames={'1m':{timeframe:'minute',aggregate:1},'5m':{timeframe:'minute',aggregate:5},'15m':{timeframe:'minute',aggregate:15},'1h':{timeframe:'hour',aggregate:1},'4h':{timeframe:'hour',aggregate:4},'1d':{timeframe:'day',aggregate:1}};
function loadChartTimeframe(){
 stopChartHistory?.();const request=++chartRequest,gen=generation,selection=$('chart-timeframe').value;
 if(selection==='auto'){
  if(!contextHistoryState){if(market)startHistory(market);return;}
  setHistoryLoading(contextHistoryState);chart.setHistory(contextCandles,contextInterval,originDate);$('chart-resolution').textContent='Auto context · '+contextInterval/60000+' minute candles';return;
 }
 const operation=beginHistoryLoad();setHistoryLoading(historyLoadState({candles:[],state:'loading'},operation));
 const frame=chartFrames[selection],interval={minute:60000,hour:3600000,day:86400000}[frame.timeframe]*frame.aggregate;
 chart.setInterval(interval);$('chart-resolution').textContent=selection+' · '+(market?'Loading provider candles…':'Awaiting trending market');
 if(!market)return;
 stopChartHistory=loadHistory(market,data=>{
  if(gen!==generation||request!==chartRequest)return;
  setHistoryLoading(historyLoadState(data,operation));chart.setHistory(data.candles,data.interval,originDate);chart.draw();finishHistoryReplay();
  $('chart-resolution').textContent=selection+' · '+data.candles.length+' provider candles · '+data.message;
 },{...frame,maxPages:3,priority:100,shouldFetch:shouldFetchHistory});
}
async function fetchJSON(url,{signal}={}){
 const origin=new URL(url).origin,until=providerCooldowns.get(origin)||0;
 if(until>Date.now())throw Error('Market provider cooling down · '+Math.ceil((until-Date.now())/1000)+'s');
 const abort=new AbortController(),cancel=()=>abort.abort(),timeout=setTimeout(cancel,12000);
 signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 try{
  const r=await fetch(url,{signal:abort.signal});
  if(r.status===429||r.status===503){
   const value=r.headers.get('Retry-After'),seconds=Number(value);
   const delay=value&&Number.isFinite(seconds)?seconds*1000:value&&Number.isFinite(Date.parse(value))?Date.parse(value)-Date.now():30000;
   providerCooldowns.set(origin,Date.now()+Math.max(1000,delay));
  }
  if(!r.ok)throw Error('Market provider returned '+r.status);return await r.json();
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}
const capLookups=new Map();
async function completeMarketCap(pair,{signal}={}){
 if(isExchangeMarket(pair)||Number(pair.marketCap)>0)return pair;
 const key=imageKey(pair),now=Date.now();let cached=capLookups.get(key);
 if(!cached||cached.until<=now){
  cached={until:now+300000,pending:null};capLookups.set(key,cached);
  cached.pending=fetchJSON('https://api.dexscreener.com/token-pairs/v1/'+encodeURIComponent(pair.chainId)+'/'+encodeURIComponent(pair.baseToken.address),{signal}).then(rows=>{
   const candidates=(Array.isArray(rows)?rows:[]).filter(row=>row.chainId===pair.chainId&&sameToken(row.baseToken?.address,pair.baseToken.address)&&Number(row.marketCap)>0&&Number(row.priceUsd)>0);
   candidates.sort((a,b)=>(Number(b.liquidity?.usd)||0)-(Number(a.liquidity?.usd)||0));
   return candidates[0]||null;
  }).catch(()=>null);
  if(capLookups.size>64)capLookups.delete(capLookups.keys().next().value);
 }
 const source=await cached.pending;if(signal?.aborted||!source)return pair;
 const price=Number(pair.priceUsd),sourcePrice=Number(source.priceUsd);
 return {...pair,marketCap:Number(source.marketCap)*(price>0?price/sourcePrice:1),marketCapSource:'dexscreener-token',marketCapEstimated:true};
}
async function freshMarketSnapshot(pair,{signal}={}){
 if(isExchangeMarket(pair))return prepareExchangeMarket(pair);
 const chain=pair.chainId,address=pair.pairAddress,token=pair.baseToken.address;
 if(pair.snapshotProvider!=='gecko'||pair.chainId==='robinhood'){
  try{
   const data=await fetchJSON('https://api.dexscreener.com/latest/dex/pairs/'+encodeURIComponent(chain)+'/'+encodeURIComponent(address),{signal});
   const raw=(data.pairs||[]).find(p=>p.chainId===chain&&(/^0x/i.test(address)?p.pairAddress?.toLowerCase()===address.toLowerCase():p.pairAddress===address));
   const updated=raw&&orientPair(raw,token);if(updated&&Number(updated.priceUsd)>0&&Number.isFinite(Number(updated.priceUsd)))return completeMarketCap(updated,{signal});
  }catch(error){if(signal?.aborted)throw error;}
 }
 // A pool can be indexed by GeckoTerminal even when DEX search has no result.
 const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
 const network=pair.geckoNetwork||aliases[chain]||chain;
 const response=await fetchGecko('https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(network)+'/pools/'+encodeURIComponent(address)+'?include=base_token,quote_token,dex',{signal,priority:95});
 if(!response.ok)throw Error('Live market provider returned '+response.status);
 const data=await response.json(),included=new Map((data.included||[]).map(item=>[item.id,item]));
 const raw=geckoPoolMarket(data.data,included,network),updated=raw&&orientPair(raw,token);
 if(!updated||!(Number(updated.priceUsd)>0))throw Error('Selected live pool is unavailable');
 return completeMarketCap(updated,{signal});
}
async function findOnchainMarkets(query,{network,signal}={}){
 const priced=pair=>Number(pair?.priceUsd)>0&&Number.isFinite(Number(pair.priceUsd));
 const rank=pairs=>rankCoinMatches(pairs.filter(priced),query,{orientPair,network}).filter(priced);
 // Keep the fast search path, but an empty index or provider cooldown does
 // not mean the contract has no market. The second source must match it too.
 try{
  const data=await fetchJSON('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(query),{signal});
  const pairs=rank(data.pairs||[]);if(pairs.length)return pairs;
 }catch(error){if(signal?.aborted)throw error;}
 const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
 const geckoNetwork=network&&(aliases[network]||network),specific=geckoNetwork&&isTokenIdentifier(query);
 const params=new URLSearchParams({include:'base_token,quote_token,dex,network',page:'1'});
 if(!specific){params.set('query',query);if(geckoNetwork)params.set('network',geckoNetwork);}
 const path=specific?'/networks/'+encodeURIComponent(geckoNetwork)+'/tokens/'+encodeURIComponent(query)+'/pools':'/search/pools';
 const controller=new AbortController(),cancel=()=>controller.abort();
 signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 // Allow one provider-requested cooldown; still cancel promptly when the
 // user edits the address, selects another coin, or dismisses the search.
 const timeout=setTimeout(cancel,75000);
 try{
  for(let attempt=0;attempt<2;attempt++){
   const response=await fetchGecko('https://api.geckoterminal.com/api/v2'+path+'?'+params,{signal:controller.signal,priority:200});
   if(response.status===429&&attempt===0)continue;
   if(!response.ok)throw Error('Market search provider returned '+response.status);
   const data=await response.json();if(!Array.isArray(data.data))throw Error('Unexpected market search response');
   const included=new Map((data.included||[]).map(item=>[item.id,item]));
   return rank(data.data.map(pool=>geckoPoolMarket(pool,included,geckoNetwork||undefined)).filter(Boolean));
  }
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}
function applySnapshot(pair){
 if(!isExchangeMarket(pair))rememberPoolLiquidity(pair);
 const previous=currentPrice();
 if(market&&imageKey(pair)===imageKey(market)){
  const oldTx=market.txns?.m5||{},newTx=pair.txns?.m5||{};
  const oldPrice=Number(market.priceNative)||Number(market.priceUsd),newPrice=Number(pair.priceNative)||Number(pair.priceUsd);
  if(newPrice>0&&oldPrice>0&&Math.abs(newPrice/oldPrice-1)>1e-7||(Number(newTx.buys)||0)>(Number(oldTx.buys)||0)||(Number(newTx.sells)||0)>(Number(oldTx.sells)||0))lastMarketActivityAt=Date.now();
 }
 // A provider's empty cap must not erase known supply for this same token.
 if(!isExchangeMarket(pair)&&!(Number(pair.marketCap)>0)&&market&&imageKey(pair)===imageKey(market)&&Number(market.marketCap)>0&&Number(market.priceUsd)>0&&Number(pair.priceUsd)>0){
  pair={...pair,marketCap:Number(market.marketCap)*Number(pair.priceUsd)/Number(market.priceUsd),marketCapSource:market.marketCapSource||'previous-snapshot',marketCapEstimated:true};
 }
 market=isExchangeMarket(pair)?{...pair,exchangeBook:market?.pairAddress===pair.pairAddress?market.exchangeBook:null}:pair;lastSnapshot=Date.now();
 if(!(streamConnected&&['swap','trade-poll','rpc-poll','exchange'].includes(streamKind))){observePianoPrice(Number(pair.priceUsd),previous,lastSnapshot);chart.add({at:Date.now(),price:Number(pair.priceUsd),source:'snapshot'});$('chart-source').textContent=isExchangeMarket(pair)?pair.exchangeName+' · exchange ticker snapshot; waiting for live trades':pair.snapshotProvider==='gecko'?'GeckoTerminal market snapshots · 30-second refresh; provider data may be cached':'Observed market snapshots · 5-second polling; provider data may be cached';}
 display();
 session?.snapshots.push({at:Date.now(),market:pair});
}
function chooseMarket(pair,{shared=false}={}){
 if(!captureMode)rememberRecentCoin({key:imageKey(pair),chain:pair.chainId,address:pair.source==='ccxt'?null:pair.baseToken.address,query:pair.source==='ccxt'?pair.exchangeSymbol:undefined,symbol:pair.baseToken.symbol,name:pair.baseToken.name,image:pair.info?.imageUrl||pair.baseToken.imageUrl});
 document.dispatchEvent(new CustomEvent('upic:market-selected'));
 testNftExport.cancel('Export cancelled because the selected coin changed.');
 liveConnection?.abort();liveConnection=null;pendingHistoryReplay=false;
 void takeShare.finish();takeShare.reset();
 pendingPianoTrade=null;tradePollingAt=0;if(!captureMode)preloadPianoSamples(hash(pair.chainId+':'+pair.baseToken.address)).catch(error=>engineView.log('Piano preload: '+error.message));
 pianoHistory=[];pianoChordCount=0;piano?.reset();pianoReplayCursor=null;
 replay.setMarket(pair.chainId+':'+pair.pairAddress+':'+pair.baseToken.address);
 lastMarketActivityAt=0;generation++;snapshotController?.abort();clearTimeout(poll);clearTimeout(musicHistoryTimer);stopMusicHistory?.();stopMusicHistory=null;imageController?.abort();imageToken='';stopStream?.();stopHistory?.();stopChartHistory?.();stopStream=null;streamPool='';streamConnected=false;streamKind='snapshot';poolEvents=[];tradeEvents=[];lastTrade=null;lastChainPrice=null;receivedTradeCount=0;historyContext=null;originDate=null;chart.reset();
 contextHistoryState=null;contextHistoryOperation=null;contextHistoryKey='';contextCandles=[];
 resetEnsemble();mode='live';market=pair;nftOwnerPreview.setMarket(pair);if(!captureMode)void coinSummary.setMarket(pair);testMint.setMarket({key:imageKey(pair),name:pair.baseToken.symbol||pair.baseToken.name||pair.baseToken.address});seed=hash(pair.chainId+':'+pair.baseToken.address);dataSonification.reset(seed);holderMetadata.setMarket(isExchangeMarket(pair)?null:pair);state=seed;step=0;send('seed',seed%16777216);envion.setSeed(seed);piano?.reset(seed);arpeggioAI.setSeed(seed);applySnapshot(pair);if(!shared){startHistory(pair);setupStream();}void loadCoinImage(pair);if(playing)takeShare.start(ctx,outputTap);
 if(!isExchangeMarket(pair)){const version=generation;void loadPoolLiquidity(pair).then(()=>{if(version===generation)display();});}
 $('last-event').textContent=isExchangeMarket(pair)?'Waiting for exchange trades':'Waiting for pool events';
 session?.controls.push({at:Date.now(),name:'market',chain:pair.chainId,pool:pair.pairAddress});
 sharedMarket=shared;
 if(shared)return;
 const gen=generation;
 if(!isExchangeMarket(pair)&&!(Number(pair.marketCap)>0))void completeMarketCap(pair).then(enriched=>{
  if(gen!==generation||!(Number(enriched.marketCap)>0)||Number(market?.marketCap)>0)return;
  const price=Number(market.priceUsd),basis=Number(enriched.priceUsd);
  market={...market,marketCap:Number(enriched.marketCap)*(price>0&&basis>0?price/basis:1),marketCapSource:enriched.marketCapSource,marketCapEstimated:true};display();
 });
 if(isExchangeMarket(pair)){
  const refresh=async()=>{if(document.hidden&&!playing){if(gen===generation)poll=setTimeout(refresh,30000);return;}try{const updated=await prepareExchangeMarket(pair);if(gen!==generation)return;applySnapshot(updated);}catch(error){if(gen===generation)$('chart-source').textContent='Exchange snapshot delayed: '+error.message;}if(gen===generation)poll=setTimeout(refresh,30000);};
  poll=setTimeout(refresh,30000);status(playing?'Playing · exchange market':'Exchange market loaded · press Play');return;
 }
 const refresh=async()=>{
  if(document.hidden&&!playing){if(gen===generation)poll=setTimeout(refresh,10000);return;}
  const request=snapshotController=new AbortController(),timeout=setTimeout(()=>request.abort(),45000);
  try{const updated=await freshMarketSnapshot(market,{signal:request.signal});if(gen!==generation)return;applySnapshot(updated);
  }catch(e){if(gen===generation)$('chart-source').textContent='Snapshot delayed: '+e.message;}finally{clearTimeout(timeout);}
  if(gen===generation)poll=setTimeout(refresh,market.snapshotProvider==='gecko'?30000:streamConnected&&['swap','rpc-poll'].includes(streamKind)?15000:5000);
 };poll=setTimeout(refresh,pair.snapshotProvider==='gecko'?30000:5000);status(playing?'Playing · automatic market instrument':'Market loaded · press Play');
}
const syncAddressLabel=bindSearchField($('address'),$('address-label'));
let searchRevision=0;
function searchFeedback(message,state='ready'){
 const node=$('lookup');node.hidden=!message;node.dataset.state=state;
 node.classList.toggle('is-loading',state==='loading');
 if(node.textContent!==message)node.textContent=message;
 ui.loading('search',!message?null:state==='loading'?'working':state==='error'?'error':'done',message,{operation:searchRevision});
}
function searchBusy(value){
 loading=value;$('load').disabled=value;$('load').textContent=value?'Searching…':'Search';
 $('load').setAttribute('aria-busy',String(value));$('coin-form').setAttribute('aria-busy',String(value));
}
$('address').addEventListener('input',()=>{
 liveConnection?.abort();liveConnection=null;searchController?.abort();
 searchRevision++;searchBusy(false);searchFeedback('');
 $('coin-search-results').hidden=true;$('address').setAttribute('aria-expanded','false');
});
$('coin-search-results').addEventListener('keydown',event=>{if(event.key==='Escape'){searchController?.abort();searchRevision++;searchBusy(false);searchFeedback('');}},true);
$('address').addEventListener('keydown',event=>{
 const results=$('coin-search-results');
 if(event.key==='ArrowDown'&&!results.hidden){const first=results.querySelector('button');if(first){event.preventDefault();first.focus();}}
 if(event.key==='Escape'){searchController?.abort();searchRevision++;searchBusy(false);results.hidden=true;$('address').setAttribute('aria-expanded','false');searchFeedback('');}
});
async function selectSearchMarket(pair,{autoPlay=false,revision=searchRevision}={}){
 try{
  searchController?.abort();
  searchFeedback('Opening '+pair.baseToken.symbol+'…','loading');
  if(isExchangeMarket(pair)){status('Loading '+pair.exchangeName+' market…');pair=await prepareExchangeMarket(pair);}
  if(revision!==searchRevision)return;
  $('address').value=pair.baseToken.address;syncAddressLabel();discovered=[pair];
  $('coin-search-results').hidden=true;$('address').setAttribute('aria-expanded','false');chooseMarket(pair);
  searchFeedback('');
  if(autoPlay&&!playing)await $('play').onclick();
 }catch(error){if(revision===searchRevision){status(error.message);searchFeedback(error.message,'error');}}
}
document.addEventListener('upic:search-coin',event=>{
 const coin=event.detail;if(!coin||typeof(coin.address||coin.query)!=='string')return;
 liveConnection?.abort();liveConnection=null;searchController?.abort();searchRevision++;searchBusy(false);searchFeedback('');
 requestedNetwork=coin.address?coin.chain:null;requestedAutoplay=false;
 $('address').value=coin.address||coin.query;syncAddressLabel();$('coin-form').requestSubmit();
});
$('coin-form').onsubmit=async e=>{
 e.preventDefault();
 if($('address').value.trim().toLowerCase()==='pdata'){const show=$('envion').hidden;$('envion').hidden=!show;$('engine-view').hidden=!show;document.querySelector('.inspector-display').hidden=!show;document.body.classList.toggle('inspecting',show);$('address').value='';syncAddressLabel();status(show?'Pure Data view open':'Pure Data view hidden');return;}
 if(loading)return;
 const selectedNetwork=$('coin-form').dataset.searchNetwork;
 const wantedNetwork=requestedNetwork||(selectedNetwork&&selectedNetwork!=='all'?selectedNetwork:null),autoPlay=requestedAutoplay;requestedNetwork=null;requestedAutoplay=false;
 const address=$('address').value.trim();if(address.length<1||address.length>250){searchFeedback('Enter a coin name, contract address or exchange pair.','error');return;}
 const revision=++searchRevision,tokenAddress=isTokenIdentifier(address),exchangeOnly=isExchangeQuery(address);
 searchController?.abort();const searchAbort=new AbortController();searchController=searchAbort;
 const current=()=>revision===searchRevision&&$('address').value.trim()===address;
 searchBusy(true);$('coin-search-results').hidden=true;$('address').setAttribute('aria-expanded','false');
 searchFeedback(tokenAddress?'Finding this coin…':exchangeOnly?'Finding exchange markets…':'Finding markets…','loading');
 let dexPairs=[],exchangePairs=[],errors=[],remaining=2;
 function publish(){
  if(!current()||tokenAddress||exchangeOnly)return;
  const pairs=[...exchangePairs,...dexPairs];
  if(pairs.length){
   showCoinMatches($('coin-search-results'),pairs,pair=>{const selectedRevision=++searchRevision;searchBusy(false);void selectSearchMarket(pair,{autoPlay,revision:selectedRevision});});
   searchFeedback(remaining?'Choose a result now · checking more markets…':'Choose a market'+(errors.length?' · some sources are unavailable':''),remaining?'loading':'ready');
  }
 }
 try{
  await Promise.allSettled([
   (async()=>{try{
    if(!exchangeOnly)dexPairs=await findOnchainMarkets(address,{network:wantedNetwork,signal:searchAbort.signal});
   }catch(error){errors.push(error.message);}finally{remaining--;publish();}})(),
   (async()=>{try{
    if(!tokenAddress&&!wantedNetwork){const data=await searchExchangeMarkets(address);exchangePairs=data.pairs;errors.push(...data.errors);}
   }catch(error){errors.push(error.message);}finally{remaining--;publish();}})(),
  ]);
  if(!current())return;
  const pairs=[...exchangePairs,...dexPairs];
  if(!pairs.length)throw Error(errors.length?'Market search is unavailable. Please try again.':'No matching market. Try its contract address or a pair such as BTC/USD.');
  if(tokenAddress){
   const selection=wantedNetwork?dexPairs.find(p=>p.chainId===wantedNetwork):dexPairs[0];
   if(!selection)throw Error('No indexed market found on this network.');
   await selectSearchMarket(selection,{autoPlay,revision});return;
  }
  if(exchangeOnly&&pairs.length===1){await selectSearchMarket(pairs[0],{autoPlay,revision});return;}
  if(exchangeOnly){
   showCoinMatches($('coin-search-results'),pairs,pair=>{const selectedRevision=++searchRevision;searchBusy(false);void selectSearchMarket(pair,{autoPlay,revision:selectedRevision});});
   searchFeedback('Choose an exchange market');
  }
 }catch(error){if(revision===searchRevision){status(error.message);searchFeedback(error.message,'error');}}
 finally{if(revision===searchRevision)searchBusy(false);}
};
function shareSnapshot(){
 if(!market)return null;
 const frozen=replay.state.frozen,interval=frozen?.interval||chart.interval;
 const rows=(frozen?.bars||chart.renderedBars).filter(bar=>!replay.state.active||candleEnd(bar,interval)<=replay.state.cursor).slice(-128);
 if(!rows.length)return null;
 const basis=frozen?.market||market;
 return {version:1,engine:214,arpeggio:arpeggioAI.snapshot(),interval,seed,speed:replay.state.speed,market:{source:basis.source,exchangeId:basis.exchangeId,exchangeSymbol:basis.exchangeSymbol,exchangeName:basis.exchangeName,quoteApproximate:basis.quoteApproximate,snapshotProvider:basis.snapshotProvider,geckoNetwork:basis.geckoNetwork,chainId:basis.chainId,dexId:basis.dexId,pairAddress:basis.pairAddress,baseToken:{address:basis.baseToken.address,symbol:basis.baseToken.symbol,name:basis.baseToken.name||basis.baseToken.symbol,imageUrl:safeCoinImage(coinImageURL)||undefined},quoteToken:{address:basis.quoteToken.address,symbol:basis.quoteToken.symbol,name:basis.quoteToken.name||basis.quoteToken.symbol},priceUsd:basis.priceUsd,priceNative:basis.priceNative,marketCap:basis.marketCap},rows:rows.map(b=>[b.time,b.open,b.high,b.low,b.close,b.volume??null])};
}
const takeShare=createTakeShare({button:$('share'),dialog:$('share-dialog'),snapshot:shareSnapshot,onContinue:()=>{if(playing)takeShare.start(ctx,outputTap);}});
const rollCap=rollingText($('coin-cap'));
let marketMovement={key:null,cap:null,at:0,until:0,direction:''};
function updateCoinReadout(m){
 const capReadout=$('coin-cap'),key=(market?.chainId||'')+':'+(market?.baseToken?.address||'')+':'+replay.state.active;
 const cap=Number(m.context?.latestCap);
 const position=replay.state.active?replay.state.cursor:Date.now(),now=performance.now();
 if(key!==marketMovement.key||position<marketMovement.at){marketMovement={key,cap:null,at:position,until:0,direction:''};}
 if(cap>0&&Number.isFinite(cap)){
  if(marketMovement.cap>0&&cap!==marketMovement.cap){marketMovement.direction=cap>marketMovement.cap?'up':'down';marketMovement.until=now+1200;}
  marketMovement.cap=cap;
 }else{marketMovement.cap=null;marketMovement.until=0;marketMovement.direction='';}
 marketMovement.at=position;capReadout.dataset.direction=now<marketMovement.until?marketMovement.direction:'';

 const at=replay.state.active?replay.state.cursor:Date.now(),date=new Date(at);
 ui.clock({timestamp:at,rate:replay.state.active?Number(replay.state.speed)||1:1,replay:replay.state.active,seeking:replay.state.dragging,label:replay.state.active?'Playback time':'Local time'});
 rollCap(cap>0?'$'+Math.round(cap).toLocaleString('en'):'—',cap||0);
 $('coin-clock-label').textContent=replay.state.active?'REPLAY · DATE / TIME':'LIVE · DATE / TIME';
 $('coin-cap-label').textContent=replay.state.active?'MCAP · HISTORICAL ESTIMATE':m.context?.capEstimated||market?.marketCapEstimated?'MCAP · PRICE ESTIMATE':'MARKET CAP';

}
async function restoreSharedScore(){
 try{
  const score=await loadSharedScore(location.hash);if(!score)return false;
  chooseMarket(score.market,{shared:true});arpeggioAI.setSeed(seed,score.arpeggio||arpeggioAI.snapshot());setHistoryLoading({candles:score.rows,state:"pool-start"});const bars=score.rows.map(([time,open,high,low,close,volume])=>({time,open,high,low,close,volume,volumeEstimated:isExchangeMarket(score.market),observedThrough:time+score.interval}));
  chart.setHistory(bars,score.interval,bars[0].time);chart.draw();replay.freeze(bars,score.market,score.interval);replay.state.score=replay.preserveScore(buildReplayScore(bars,seed,score.interval,score.market),score.interval);replay.state.speed=['1','50','jump'].includes(String(score.speed))?String(score.speed):'1';updateSpeedButtons();
  replay.seek(bars[0],score.interval);chart.schedule();syncLevels(metrics());$('share').disabled=false;status('Replay ready · press Play');return true;
 }catch(error){status('Cannot open shared score: '+error.message);return false;}
}
display();
const restoredScore=await restoreSharedScore();
const requestedCoin=new URLSearchParams(location.search);
if(!restoredScore&&requestedCoin.get('coin')?.length<=250&&requestedCoin.get('coin')){
 requestedNetwork=requestedCoin.get('network')||null;requestedAutoplay=false;$('address').value=requestedCoin.get('coin');syncAddressLabel();$('coin-form').requestSubmit();
}
if(captureMode)window.__upicCaptureStatus=()=>({market:market?{chain:market.chainId,address:market.baseToken.address,symbol:market.baseToken.symbol}:null,visual:dataVisual.snapshot(),holders:holderMetadata.snapshot().holdings?.state,lookup:$('lookup').textContent});
if(captureMode)archivePlayerFrames({captureMode,getMarket:()=>market,getVisual:()=>dataVisual,eligible:()=>!replay.state.active&&!testMint.simulation()});
if(!captureMode)startTrending((item,options={})=>{
 if(options.initial&&(loading||searchRevision>0||market))return;
 searchController?.abort();searchRevision++;searchBusy(false);searchFeedback('');
 // Resume in the coin click itself: market discovery completes asynchronously.
 // The unlocked context stays silent until Listen opens the selected coin engine.
 if(!playing)primeAudio();
 requestedNetwork=item.chain;requestedAutoplay=options.autoplay??true;
 if(item.image)tokenImages.set(imageKey({chainId:item.chain,baseToken:{address:item.address}}),item.image);
 $('address').value=item.address;syncAddressLabel();
 if(item.market){
  requestedNetwork=null;requestedAutoplay=false;
  void selectSearchMarket(item.market,{autoPlay:options.autoplay??!options.initial,revision:searchRevision});
 }else $('coin-form').requestSubmit();
},state=>ui.loading('trending',state.status,state.label,{host:state.host,operation:state.operation}));
function reconcileIdleFeed(){
 if(document.hidden&&!playing){stopStream?.();stopStream=null;streamPool='';streamConnected=false;return;}
 if(market&&!stopStream&&mode==='live'&&!sharedMarket)setupStream();
}
document.addEventListener('visibilitychange',reconcileIdleFeed);
setInterval(()=>{reconcileIdleFeed();if(!playing&&!document.hidden)syncLevels(metrics());},1000);
const chartStatus=document.querySelector('.chart-status');
new MutationObserver(()=>{for(const item of chartStatus.children)item.title=item.textContent;}).observe(chartStatus,{childList:true,characterData:true,subtree:true});
function audioContext(){
 if(!ctx){
  const context=createMusicContext();ctx=context;
  context.onstatechange=()=>{
   if(context!==ctx||!playing)return;
   if(context.state==='running'){replay.state.clock=performance.now();flushPianoTrade();setPlayState(true);}
   else{$('play').dataset.playing='false';$('play').setAttribute('aria-pressed','false');$('play').textContent='Resume';$('play').setAttribute('aria-label','Resume interrupted audio');}
   audioStatus();
  };
 }
 return ctx;
}
function primeAudio(){try{unlockPlayback(audioContext()).catch(()=>{});}catch{}}
function seekHistory(bar,dragging=false){
 if(testNftExport.busy)testNftExport.cancel('Export cancelled because the replay position changed.');
 pendingPianoTrade=null;
 if(!bar)return;
 if(!replay.state.active&&!historyReplayReady()){
  pendingHistoryReplay=true;primeAudio();status('Loading history for replay');return;
 }
 if(!playing)primeAudio();
 if(!replay.state.active){arpeggioAI.freezeScore();resetEnsemble();replay.freeze(chart.renderedBars,market,chart.interval);replay.state.score=replay.preserveScore(buildReplayScore(replay.state.frozen.bars,seed,chart.interval,replay.state.frozen.market),chart.interval);}
 replayPianoPrimed=false;replayPhrase=null;dataSonification.reset(seed);
 replay.seek(bar,chart.interval,dragging);chart.schedule();
 sharedHarmony=null;pianoReplayCursor=replay.state.cursor;
 session?.controls.push({at:Date.now(),name:'history-seek',cursor:replay.state.cursor,source:'loaded-candle',speed:replay.state.speed});
 if(playing)tick();else{const m=metrics();
 syncLevels(m);envion.market(musicalFrame(m),orchestraTempo(m));if(!starting)$('play').onclick();}
}
chart.onHistorySeek=seekHistory;
chart.onHistorySeekEnd=()=>replay.release();
$('replay-play').onclick=()=>{
 if(!historyReplayReady()){
  pendingHistoryReplay=true;primeAudio();status('Loading history for replay');
  if(!contextHistoryState||contextHistoryState.error)startHistory(market);
  updateReplayUI({});return;
 }
 chart.draw();seekHistory((replay.state.frozen?.bars||chart.history)[0]);
};
$('replay-live').onclick=async()=>{
 if(liveConnection)return false;
 pendingHistoryReplay=false;
 if(sharedMarket&&market){
  // Keep the saved replay intact until its real market is connected.
  const controller=new AbortController(),gen=generation,revision=searchRevision,pair=market;liveConnection=controller;
  const timeout=setTimeout(()=>controller.abort(),45000);updateReplayUI(replay.state.controls||{});status('Connecting to live market…');
  try{
   const updated=await freshMarketSnapshot(pair,{signal:controller.signal});
   if(controller.signal.aborted||gen!==generation||revision!==searchRevision||liveConnection!==controller)return false;
   liveConnection=null;chooseMarket(updated);
   history.replaceState(null,'',location.pathname+location.search);
  }catch(error){
   if(gen===generation&&revision===searchRevision)status('Live connection delayed · saved replay is still available. Try Back to live again.');
   return false;
  }finally{
   clearTimeout(timeout);if(liveConnection===controller)liveConnection=null;updateReplayUI(replay.state.controls||{});
  }
 }else{
  replay.live();arpeggioAI.setSeed(seed);resetEnsemble();chart.tickView?.live();chart.goLive();$('chart-range').value='live';display();
 }
 chart.tickView?.live();chart.goLive();$('chart-range').value='live';
 session?.controls.push({at:Date.now(),name:'history-live'});
 if(playing)tick();else{const m=metrics();syncLevels(m);envion.market(musicalFrame(m),orchestraTempo(m));}
 status(playing?'Listening live · waiting for trades':'Live market · press Play');return true;
};
function updateSpeedButtons(){
 for(const button of $('replay-speed').querySelectorAll('[data-rate]'))button.setAttribute('aria-pressed',String(button.dataset.rate===replay.state.speed));
}
$('replay-speed').onclick=event=>{
 const button=event.target.closest('button[data-rate]');if(!button)return;
 replay.advance(chart.renderedBars,chart.interval,playing&&ctx?.state==='running');
 replay.state.speed=button.dataset.rate;replay.release();updateSpeedButtons();
 session?.controls.push({at:Date.now(),name:'history-speed',value:replay.state.speed});
};
$('chart-view').onchange=()=>chart.setMode($('chart-view').value);
$('chart-range').onchange=()=>chart.setRange($('chart-range').value);
$('chart-timeframe').onchange=async()=>{if(replay.state.active&&!await $('replay-live').onclick())return;loadChartTimeframe();};
$('chart-scale').onchange=()=>chart.setScale($('chart-scale').value);
$('chart-fit').onclick=()=>{$('chart-range').value='history';chart.fit();};
$('chart-live').onclick=()=>{$('chart-range').value='live';chart.goLive();};
$('chart-zoom-in').onclick=()=>chart.zoom(.7);
$('chart-zoom-out').onclick=()=>chart.zoom(1.4);
setInterval(()=>{
 if(document.hidden||!document.body.classList.contains('inspecting'))return;
 $('event-age').textContent=lastTrade?'Last trade received '+((Date.now()-lastTrade.receivedAt)/1000).toFixed(1)+'s ago':'Last trade: none received';
 $('data-delay').textContent=lastTrade?.occurredAt?(lastTrade.precision==='block-timestamp'?'Block → receipt (approx.): ':'Trade timestamp → receipt: ')+Math.max(0,(lastTrade.receivedAt-lastTrade.occurredAt)/1000).toFixed(1)+'s':'Source delay: unknown (no trade timestamp)';
 $('event-count').textContent=receivedTradeCount+' trades received';
},500);
const playerScreen=window.matchMedia('(max-width:760px)');
function syncChartTypography(){chart.chart.applyOptions({layout:{fontFamily:'NDS12, sans-serif',fontSize:12}});}
playerScreen.addEventListener('change',syncChartTypography);
document.fonts.ready.then(syncChartTypography);

// Release 225: retain coin contexts across navigation.
