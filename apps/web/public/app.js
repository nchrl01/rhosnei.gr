import {nativeContractReference} from './native-contracts.js?v=448';
import {catalogueCoinArtwork,catalogueNativeArtwork} from './coin-artwork.js?v=349';
import {createReplayVisualHistory} from './replay-visual-history.js?v=351';
import {createCoinSummary} from './coin-summary.js?v=336';
import {rememberRecentCoin} from './coin-catalogue.js?v=448';
import {archivePlayerFrames} from './coin-snapshot-store.js?v=448';
import {bindSearchField,bindAddressSearch} from './search-field.js?v=456';
import {createMarketLandmarks} from './market-landmarks.js?v=208';
import {seedTonic} from './seed-key.js?v=1';
import {buildReplayScore} from './replay-score.js?v=209';
import {createUIControls} from './ui-controls.js?v=405';
import {isExchangeMarket,isExchangeQuery,searchExchangeMarkets,prepareExchangeMarket,subscribeExchangeMarket} from './ccxt-market.js?v=359';
import {createMusicContext,unlockPlayback,stopLegacyPlayback} from './audio-unlock.js?v=220';
import {bindPlaybackShortcuts} from './playback-shortcuts.js?v=397';
import {isTokenIdentifier,showCoinMatches} from './coin-search.js?v=448';
import {sameToken,orientPair,fetchJSON,findOnchainMarkets} from './market-search.js?v=448';
import {rollingText} from './coin-readout.js?v=53';
import {loadSharedScore} from './take-share.js?v=220';
import {isCoinSaved,toggleSavedCoin,savedCoinForMarket,savedCoinsState} from './saved-coins.js?v=448';
import {createEngineView} from './engine-view.js?v=470';
import {createCoinDither} from './coin-dither.js?v=390';
import {createUpicBrand} from './upic-brand.js?v=115';
import {createTransportIndicator} from './transport-indicator.js?v=391';
import {PIANO_MOVE_PCT} from './piano-policy.js?v=208';
import {createEarthboundVisual as createAudioDots} from './upic-earthbound-visual.js?v=470';
import {createHolderMetadata,holderCountReadout} from './holder-metadata.js?v=458';
import {createNftOwnerPreview} from './nft-owner-preview.js?v=448';
import {rememberPoolLiquidity,poolLiquiditySnapshot,loadPoolLiquidity} from './pool-liquidity.js?v=303';
import {createTradePiano,marketResonance,preloadPianoSamples} from './trade-piano.js?v=470';
import {contextualizeMarket} from './market-state.js?v=208';
import {createMarketReplay,candleEnd,scoreCandle,replaySpeed,replayObservationForBar} from './market-replay.js?v=470';
import {marketPerformance,marketActivityDecay} from './market-performance.js?v=470';
import {signalFreshness} from './market-controls.js?v=18';
import {orchestraTempo} from './orchestra.js?v=449';
import {subscribePool} from './realtime.js?v=4';
import {subscribeEvm} from './evm.js?v=39';
import {subscribeOrca} from './orca.js?v=39';
import {subscribeRobinhoodV4} from './v4.js?v=135';
import {fetchGecko} from './gecko.js?v=277';
import {startTrending,geckoPoolMarket} from './trending.js?v=391';
import {MarketChart} from './chart.js?v=462';
import {loadHistory} from './history.js?v=448';
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
let sharedHarmony=null;
let ctx,gain,listeningGain,outputTap,outputMeters,instrumentTap,audioScopes=[],playing=false,starting=false,poll,market=null,mode='loading',generation=0,loading=false;
let snapshotController,searchController;
const shouldFetchHistory=()=>!document.hidden||playing;
let pendingHistoryReplay=false;
function historyReplayReady(){return (replay.state.frozen?.bars||chart.history||[]).length>1;}
function finishHistoryReplay(){
 if(!pendingHistoryReplay||!historyReplayReady()||!market)return;
 pendingHistoryReplay=false;chart.draw();seekHistory(chart.history[0]);
}
async function prepareReplayAudio(){
 // Wait for the single chip before preparing a replay.
 let timeout;
 try{await Promise.race([
  Promise.allSettled([pianoLoading].filter(Boolean)),
  new Promise(resolve=>{timeout=setTimeout(resolve,12000);}),
 ]);}finally{clearTimeout(timeout);}
}
let seed=1917,state=1917,step=0,timer,next=0,bpm=120,session=null;
const controls=['master'];
let stopStream,streamConnected=false,poolEvents=[],lastSnapshot=0,streamPool='',sharedMarket=false,liveConnection=null;
let streamKind='snapshot',tradePollingAt=0,tradeEvents=[],lastTrade=null,lastChainPrice=null,discovered=[],lastExcitation=0;
let piano=null,pianoEnabled=true,pianoHistory=[],pianoReplayCursor=null,pianoChordCount=0;
let audioEpoch=0,pianoLoading=null,pendingPianoTrade=null,idleAudioTimer;
const audioErrors={piano:''};
let replayPianoPrimed=false,replayPhrase=null;
let receivedTradeCount=0;
let stopMusicHistory,musicHistoryTimer,musicalCandles=[],musicalInterval=300000;
let stopHistory,stopChartHistory,historyContext=null,originDate=null,contextCandles=[],contextInterval=60000,chartRequest=0;
let historyLoadSequence=0,contextHistoryState=null,contextHistoryOperation=null,contextHistoryKey='';
const chart=new MarketChart($('market-chart'));
$('advanced-view').addEventListener('click',()=>{
 const expanded=document.body.classList.toggle('advanced-view');
 $('advanced-view').setAttribute('aria-expanded',String(expanded));
 $('advanced-panel').inert=!expanded;
 $('advanced-panel').setAttribute('aria-hidden',String(!expanded));
 $('advanced-view').querySelector('span').textContent=expanded?'−':'+';
 display();if(expanded)requestAnimationFrame(()=>chart.draw());
});

const replay=createMarketReplay();
createUpicBrand($('upic-mark'),$('upic-mark-fallback'));
const transportIndicator=createTransportIndicator($('transport-status'));
const displaySettings={dither:false};
const dataVisual=createAudioDots($('audio-dots'),{getClock:()=>ctx?.state==='running'?ctx.currentTime:null,getAudio:()=>outputMeters?{context:ctx,channels:outputMeters,scopes:audioScopes}:outputTap,getState:()=>({playing:playing||captureMode,coinKey:market?imageKey(market):null,master:Number($('master').value),...displaySettings,markDirection:({up:1,down:-1})[$('coin-cap').dataset.direction]||0})});
const replayVisualHistory=createReplayVisualHistory($('audio-dots').closest('.audio-visualizer'));
const coinSummary=createCoinSummary($('nft-owner-preview'));
const nftOwnerPreview=createNftOwnerPreview($('nft-owner-preview'));
$('coin-image').closest('.coin-avatar').addEventListener('dragstart',event=>event.preventDefault());
const coinDither=createCoinDither($('coin-image'),$('coin-image-fallback'),{onPixels:image=>dataVisual.setImage(image),onUnavailable:url=>{if(market){rejectCoinImage(imageKey(market),url);void loadCoinImage(market,{fallback:true});}}});
$('display-dither').onclick=()=>{displaySettings.dither=!displaySettings.dither;$('display-dither').setAttribute('aria-pressed',String(displaySettings.dither));$('display-dither').textContent='Dither'+(displaySettings.dither?' on':' off');dataVisual.refresh();};
const holderMetadata=createHolderMetadata({onChange:info=>{displayHolderCount(info);if(market?.nativeAsset){market=withNativeCap(market,info.holdings);updateContext();}},onInfo:(info,pair)=>{
 if(info?.image_url&&!rejectedCoinImage(imageKey(pair),info.image_url)){tokenImages.set(imageKey(pair),info.image_url);if(market&&imageKey(market)===imageKey(pair))displayCoinImage();}
}});
function displayHolderCount(info=holderMetadata.snapshot()){
 const node=$('holders'),label=$('holders-label');if(!node||!label)return;
 const readout=holderCountReadout(info,replay.state.active);
 label.textContent=readout.label;node.textContent=readout.value;node.title=readout.title;
}
chart.bindReplay(()=>replay.state,()=>playing);
let coinImageURL='',coinImageKey='',imageController,imageToken='';const tokenImages=new Map(),failedCoinImages=new Map();
function rejectedCoinImage(key,url){return Date.now()-(failedCoinImages.get(key+'|'+url)||0)<300000;}
function rejectCoinImage(key,url){failedCoinImages.set(key+'|'+url,Date.now());while(failedCoinImages.size>128)failedCoinImages.delete(failedCoinImages.keys().next().value);}
const imageKey=pair=>pair.nativeAsset?pair.nativeAsset.chain+':'+pair.nativeAsset.address:pair.chainId+':'+(/^0x[\da-f]{40}$/i.test(pair.baseToken.address)?pair.baseToken.address.toLowerCase():pair.baseToken.address);
function safeCoinImage(value){
 try{const url=new URL(value);return url.protocol==='https:'&&url.href.length<=2048&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
async function loadCoinImage(pair,{fallback=false}={}){
 const key=imageKey(pair),requestKey=key+(fallback?':pixels':'');if(imageToken===requestKey)return;imageToken=requestKey;imageController?.abort();
 const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
 const controller=new AbortController();imageController=controller;const timeout=setTimeout(()=>controller.abort(),45000);
 let accepted=false;
 const accept=value=>{
  const url=safeCoinImage(value);if(!url||controller.signal.aborted||rejectedCoinImage(key,url))return false;
  accepted=true;tokenImages.set(key,url);if(market&&imageKey(market)===key)displayCoinImage();return true;
 };
 try{
  if(!fallback&&[tokenImages.get(key),pair.baseToken?.imageUrl,pair.historyTokenSide!=='quote'?pair.info?.imageUrl:null].some(accept))return;
  // The shared catalogue fetch has its own lifetime. A stalled lookup must
  // still release this coin's artwork loading state when its deadline expires.
  const listed=await Promise.race([
   isExchangeMarket(pair)?catalogueNativeArtwork(pair.baseToken.symbol):catalogueCoinArtwork(pair.chainId,pair.baseToken.address),
   new Promise((_,reject)=>{if(controller.signal.aborted)reject(controller.signal.reason);else controller.signal.addEventListener('abort',()=>reject(controller.signal.reason),{once:true});}),
  ]);
  if(accept(listed)||isExchangeMarket(pair))return;
  // Old shared scores contain no image. Fetch artwork metadata only: their
  // saved prices, market cap and candles must remain exactly as shared.
  try{
   const data=await fetchJSON('https://api.dexscreener.com/latest/dex/pairs/'+encodeURIComponent(pair.chainId)+'/'+encodeURIComponent(pair.pairAddress),{signal:controller.signal});
   const match=data.pairs?.find(item=>item.chainId===pair.chainId&&sameToken(item.baseToken?.address,pair.baseToken.address));
   if(accept(match?.info?.imageUrl))return;
  }catch{if(controller.signal.aborted)return;}
  const r=await fetchGecko('https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(aliases[pair.chainId]||pair.chainId)+'/tokens/'+encodeURIComponent(pair.baseToken.address)+'/info',{signal:controller.signal,priority:85});
  if(!r.ok)throw Error('Token image unavailable');const data=await r.json();const info=data.data?.attributes;
  for(const value of [info?.image_url,info?.image?.large,info?.image?.small,info?.image?.thumb])if(accept(value))break;
 }catch{}finally{
  clearTimeout(timeout);
  if(imageController===controller&&imageToken===requestKey){
   imageToken='';
   if(!accepted&&!coinDither.loading&&market&&imageKey(market)===key)dataVisual.imageUnavailable(key);
  }
 }
}
function displayCoinImage(){
 const token=market?.baseToken;
 if(token)$('coin-image-fallback').textContent=token.symbol.slice(0,2).toUpperCase();
 else if(!$('coin-image-fallback').querySelector('img'))$('coin-image-fallback').innerHTML='<img src="upic-logo-transparent.svg?v=115" alt="UPIC" class="coin-placeholder-logo" draggable="false">';
 const candidates=market?[market,...discovered.filter(p=>p.chainId===market.chainId&&sameToken(p.baseToken?.address,token.address))]:[];
 const image=candidates.find(p=>p.historyTokenSide!=='quote'&&p.info?.imageUrl)?.info?.imageUrl;
 const key=market?imageKey(market):'';
 const url=[market&&tokenImages.get(key),token?.imageUrl,image].map(safeCoinImage).find(url=>url&&!rejectedCoinImage(key,url))||'';
 if(url===coinImageURL&&key===coinImageKey)return;coinImageURL=url;coinImageKey=key;
 coinDither.set(url,key);
}
const levels={melody:0};
const chipLayers={piano:true,envion:true,data:true};
function configureChipLayers(){piano?.configure({noteGain:chipLayers.piano?1:0,chordGain:chipLayers.piano?1:0,arpGain:1,drums:chipLayers.piano,textureGain:chipLayers.envion?1:0,dataGain:chipLayers.data?1:0});pianoEnabled=Object.values(chipLayers).some(Boolean);piano?.setEnabled(pianoEnabled);}
let orchestraState={state:'SPARSE',phrase:0,parameters:{}};

const engineView=createEngineView($('engine-view'),{onBundle:(name,enabled)=>{if(Object.hasOwn(chipLayers,name)){chipLayers[name]=enabled;configureChipLayers();}if(market)syncLevels(metrics());}});
function resetEnsemble({preserveVisual=false}={}){sharedHarmony=null;if(!preserveVisual)dataVisual.reset();replayPianoPrimed=false;replayPhrase=null;piano?.reset(seed);configureChipLayers();pianoReplayCursor=replay.state.active?replay.state.cursor:null;levels.melody=0;engineView.reset();}
function updateSignalMap(m){const view={m,levels,orchestra:orchestraState,bpm:orchestraTempo(m),pianoChordCount,instrument:piano?.snapshot(),visual:dataVisual.snapshot(),resonance:marketResonance(m.context?.latestCap),root:marketRoot(m),master:Number($('master').value),playing,native:false};engineView.update({...view,coin:market?.baseToken?.symbol,feed:m.replay?'History · '+m.replay.source:market?streamKind:'loading',liquidity:m.observation?.liquidity});}
const scale=[0,2,3,5,7,9,10];
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const rand=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
const status=s=>{if($('status').textContent!==s)$('status').textContent=s;};
function audioStatus(){
 if(!playing)return;
 if(ctx&&ctx.state!=='running'){status('Audio interrupted · tap Resume');return;}
 const parts=[audioErrors.piano?'Instrument unavailable: '+audioErrors.piano:!piano?'Loading instrument…':(replay.state.active?'Listening to history':'Listening to '+(market?.baseToken?.symbol||'market'))+' · '+piano.snapshot().name];
 status(parts.join(' · '));
}
function flushPianoTrade(){
 if(!piano||!playing||ctx?.state!=='running')return;
 const trade=pendingPianoTrade;pendingPianoTrade=null;
 // Keep only a fresh observation across loading, preserving its source type.
 if(trade&&playing&&!replay.state.active&&Date.now()-trade.receivedAt<3000){const m=liveMetrics();piano[trade.kind==='price-observation'?'observePrice':'trade'](trade,m.context?.latestCap,{...trade.music,tonic:marketRoot(m)});}
}
function observePianoPrice(priceUsd,referencePrice,receivedAt=Date.now(),id='price:'+receivedAt){
 if((!playing&&!starting)||replay.state.active||!(priceUsd>0)||!Number.isFinite(priceUsd))return;
 const m=liveMetrics(),event={id,kind:'price-observation',priceUsd,referencePrice,receivedAt,music:pianoMusic(m),metrics:m};
 if(playing&&piano?.observePrice(event,m.context?.latestCap,event.music)){pendingPianoTrade=null;audioStatus();}
 else if(pianoEnabled&&(!piano||starting||ctx?.state!=='running'))pendingPianoTrade=event;
}
function currentPrice(){if(streamConnected&&['swap','trade-poll','rpc-poll','exchange'].includes(streamKind)){if((lastChainPrice?.receivedAt||0)>(lastTrade?.receivedAt||0))return Number(lastChainPrice.priceUsd);if(lastTrade?.priceUsd)return Number(lastTrade.priceUsd);}return Number(market?.priceUsd);}
function marketRoot(m){
 // Market movement changes phrases and energy, never detunes a ringing ensemble.
 return seedTonic(seed);
}
function pianoMusic(m,music=m.music){return {...music,activity:m.activity,tonic:marketRoot(m)};}

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
 const activityAt=Math.max(lastMarketActivityAt,...tradeEvents.map(e=>Number(e.occurredAt)||Number(e.receivedAt)||0),...poolEvents.map(e=>Number(e.occurredAt)||Number(e.receivedAt)||0));
 const tradingActivity=marketActivityDecay((Date.now()-activityAt)/1000);
 const raw={tradingActivity,activityObservedAt:activityAt,tradeRate:decoded?tradeEvents.length/30:0,motion:clamp((decoded?movement:Math.abs(Number(market.priceChange?.m5)||0))/8,0,1),activity:clamp(Math.log1p(rate)/Math.log(21),0,1),balance:book?.balance!=null?book.balance:decoded?(knownSides?buys/knownSides:.5):(total?(tx.buys||0)/total:.5),texture:clamp(Math.log10(Math.max(1,liquidity||1))/7,0,1),volume:clamp(Math.log1p(volumeRate)/Math.log(10001),0,1),...signalFreshness(decoded,lastSnapshot),decoded,observedVolume};
 return {...contextualizeMarket(raw,{price:livePrice,moodMovement,marketCap:Number(market.marketCap),snapshotPrice:Number(market.priceUsd),history:musicalCandles,interval:musicalInterval,changes:market.priceChange||{},liquidity:Number(liquidity),volumeRate,observedAt:Math.max(lastSnapshot,lastTrade?.receivedAt||0,lastChainPrice?.receivedAt||0)}),availability:{balance:book?.balance!=null||(decoded?knownSides>0:total>0),liquidity:liquidity!=null&&Number.isFinite(Number(liquidity)),volume:decoded||market.volume?.m5!=null},audience:holderMetadata.snapshot()};
}
function metrics(){
 const live=liveMetrics();live.observation={liquidity:currentLiquidity(),trades:market?.txns?.m5,change:market?.priceChange?.m5,volume:market?.volume?.m5};
 if(market)replay.record(live,currentPrice());
 const ended=replay.advance(chart.renderedBars||[],chart.interval,playing&&ctx?.state==='running');
 const historical=replay.metrics(chart.renderedBars||[],market,chart.interval);
 const scored=historical&&replay.state.score?.frames.get(replay.state.bar?.time);
 if(scored?.music&&historical.replay?.source==='candles')historical.music={...historical.music,...scored.music};
 if(ended&&playing&&!replay.state.handoffRequested){
  replay.state.handoffRequested=true;
  // Use the same connection and reset path as the Live control. Schedule after
  // this frame so its audio/visual updates cannot overwrite the live handoff.
  const frozen=replay.state.frozen;
  queueMicrotask(()=>{
   if(!playing||!replay.state.active||replay.state.frozen!==frozen||!replay.state.ended){replay.state.handoffRequested=false;return;}
   void $('replay-live').onclick();
  });
 }
 return historical||live;
}
function updateReplayUI(m){
 const active=replay.state.active,source=m.replay?.source;
 if($('holders-label')?.textContent!==(active?'HOLDERS · LATEST':'HOLDERS'))displayHolderCount();
 $('replay-speed').hidden=false;
 $('replay-speed').classList.toggle('is-live',!active);
 $('replay-speed').inert=!active;
 $('replay-speed').setAttribute('aria-hidden',String(!active));
 transportIndicator.render({marketReady:!!market,playing,audioRunning:ctx?.state==='running',replay:active,seeking:replay.state.dragging,ended:replay.state.ended||replay.state.endHold!==null,streamConnected,streamKind,fresh:m.snapshotFresh??m.fresh??0});
 $('replay-live').disabled=!active||!!liveConnection;
 $('replay-play').disabled=!market||pendingHistoryReplay;
 $('replay-restart').hidden=!active;
 $('replay-restart').disabled=pendingHistoryReplay;
 $('replay-play').textContent='Replay';
 $('replay-play').setAttribute('aria-label','Switch to replay');
 $('replay-live').textContent=liveConnection?'Connecting…':'Live';
 $('replay-live').setAttribute('aria-pressed',String(!active));
 $('replay-play').setAttribute('aria-pressed',String(active));
 const hint=$('replay-hint');
 if(hint){hint.hidden=true;hint.textContent='';}

 const rate=Number(replay.state.speed)||1;
 $('replay-state').textContent=active?'· '+rate+'×':'';

 $('replay-info').textContent=active?'Replay is a frozen snapshot ending '+new Date(candleEnd(replay.state.frozen.bars.at(-1),replay.state.frozen.interval)).toLocaleString()+'. Playback continues live when replay reaches the end.':'Choose a point to replay. Market changes shape the sound.';
 if(isExchangeMarket(market))$('replay-info').textContent+=' Historical market cap is unavailable.';
 $('replay-state').title=$('replay-info').textContent;
 if(active&&replay.state.bar){chart.tickView?.setReplayTime(replay.state.bar.time);display();}
}
let outputGateOpen=null;
function syncLevels(m){

 m={...m,arrangement:m.arrangement??piano?.arrangement?.(),music:{...m.music,tonic:marketRoot(m),harmony:sharedHarmony}};
 // The final candle gets its existing one-second hold to sound before pause.
 const audibleTransport=playing&&!replay.state.dragging&&!replay.state.ended;
 if(gain&&outputGateOpen!==audibleTransport){outputGateOpen=audibleTransport;gain.gain.setTargetAtTime(audibleTransport?1:0,ctx.currentTime,.025);}
 updateCoinReadout(m);
 replayVisualHistory.frame(m,replay.state.active?replay.state.cursor:null);
 dataVisual.frame(m,{playing:playing||captureMode,seed,clock:replay.state.active?(replay.state.cursor-(replay.state.frozen?.bars?.[0]?.time??0))/1000:null,rate:replay.state.active?(replay.state.speed==='candle'?(replay.state.frozen?.interval??chart.interval)/1000:Number(replay.state.speed)||1):1,seeking:replay.state.dragging,ended:(replay.state.ended||replay.state.endHold!==null),position:replay.state.active?(replay.state.cursor-(replay.state.frozen?.bars?.[0]?.time??chart.renderedBars?.[0]?.time??0))/Math.max(1000,replay.state.frozen?.interval??chart.interval):null});
 piano?.resonance(m.context?.latestCap);
 piano?.setTempo(m.music?.tempo);
 const activity=clamp(Number(m.tradingActivity??m.raw?.activity??m.activity)||0,0,1),fresh=clamp(Number(m.fresh)||0,0,1);
 levels.melody=chipLayers.envion?activity*fresh:0;
 orchestraState={state:fresh<.1?'Signal fading':activity>.65?'Intense':activity>.1?'Active':'Sparse',phrase:Math.floor((piano?.arrangement?.()?.beat||0)/32)%4,parameters:{},levels};
 const textureMeter=$('melody'),textureValue=$('melody-value');if(textureMeter)textureMeter.value=levels.melody;if(textureValue)textureValue.textContent=Math.round(levels.melody*100)+'%';
 $('orchestra-state').textContent=orchestraState.state+' · Two Game Boy chips';
 $('energy-value').textContent=Math.round(m.volume*m.fresh*100)+'%';
 $('volume').textContent=m.replay?cash(m.replay.volume):market?cash(m.decoded?m.observedVolume:market.volume?.m5):'—';
 $('volume-window').textContent=m.replay?'REPLAY USD VOLUME':m.decoded?'OBSERVED USD · LAST 30 SEC':'TRADED USD · 5 MIN';
 $('signal-source').textContent=isExchangeMarket(market)?'Public exchange trades / observed 30 sec; depth is top 25 book levels within 1% of midpoint, not pool liquidity. '+(market.nativeAsset?' Market cap estimates use the current price and the latest indexed circulating supply.':' Market cap is unavailable.')+(market.dexId==='coinbaseexchange'?' Coinbase depth uses public 5-second snapshots.':'')+(market.quoteApproximate?' '+market.quoteToken.symbol+' is used as a USD proxy.':''):m.decoded?'Price, activity, direction and volume: observed trades / 30 sec. '+(['swap','rpc-poll','exchange'].includes(streamKind)?'USD quote conversion and liquidity: snapshots.':'Trade USD values: provider; liquidity: snapshots.'):streamConnected&&streamKind==='pool'?'Activity: pool transactions / 10 sec. Price, volume and direction: 5-minute snapshots.':market?'Price, volume and activity: market snapshots / 5 min.':'Loading the highest-ranked trending market';
 if(market&&m.snapshotAge>liquiditySnapshotMaxAge())$('signal-source').textContent+=' Snapshot age '+Math.round(m.snapshotAge/1000)+'s · liquidity unavailable until a fresh snapshot arrives'+(m.decoded&&['swap','rpc-poll','exchange'].includes(streamKind)?'; native USD values use the last quote conversion.':'.');
 const c=m.context;
 $('market-pressure').textContent=Math.round(m.pressure*100)+'%';
 $('market-baseline').textContent=c.ratio?c.ratio.toFixed(2)+'× typical loaded price':'History context pending';
 $('market-pace').textContent=c.winningWindow?c.winningWindow+' move · '+Math.round(c.pace*100)+'% pace':'No significant measured move';
 $('market-cap-context').textContent=c.latestCap?cash(c.latestCap)+(m.replay?.source==='candles'?' estimated historical cap':c.capEstimated?' estimated latest cap':' snapshot market cap')+(c.impliedBaselineCap?' · typical '+cash(c.impliedBaselineCap)+' (price-based estimate)':''):'Market cap unavailable';
 $('market-context-note').textContent=m.replay?$('replay-info').textContent:!market?'Loading the highest-ranked trending market':c.historyAvailable?'Fixed 5-minute market history + latest received price. Typical cap is inferred from price using snapshot supply, not observed historical market cap. Recent moves cool over time; chart zoom and pan do not affect sound.':'Loading fixed historical context · latest observations and available provider changes drive the orchestra.';
 updateSignalMap(m);
 document.querySelectorAll('.footer-networks [data-network]').forEach(node=>{const selected=node.dataset.network===market?.chainId;node.dataset.state=selected?(streamConnected?'active':'connecting'):'available';node.querySelector('small').textContent=selected?(streamConnected?'Active':'Connecting'):'Available';});
 updateReplayUI(m);
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
   if(priceUsd>0&&Number.isFinite(priceUsd)){const previous=lastChainPrice?.priceUsd??currentPrice();const changed=previous>0&&Math.abs(priceUsd/previous-1)>1e-9;if(changed){lastMarketActivityAt=Math.max(lastMarketActivityAt,Number(e.occurredAt)||Number(e.receivedAt)||Date.now());if(!replay.state.active)dataVisual.event({...e,priceUsd});}lastChainPrice={...e,priceUsd};observePianoPrice(priceUsd,previous,e.receivedAt);chart.add({at:e.occurredAt||e.receivedAt,price:priceUsd,source:'rpc-state'});$('chart-source').textContent='Direct Robinhood RPC pool state · refreshed during quiet periods · USD quote conversion uses snapshots';display();}
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
   const performed=live,soundEvent={...e,music:pianoMusic(performed),metrics:performed};
   pianoHistory.push({...e,at:e.receivedAt});if(pianoHistory.length>20000)pianoHistory.shift();
   if((playing||starting)&&!replay.state.active){
    if(playing&&piano?.trade(soundEvent,performed.context?.latestCap,{...soundEvent.music,tonic:marketRoot(performed)})){pendingPianoTrade=null;audioStatus();}
    else if(pianoEnabled&&(!piano||starting||ctx?.state!=='running'))pendingPianoTrade=soundEvent;
   }
   // The same observation reaches the shared chip score and visual field.
   if(!replay.state.active)dataVisual.event(soundEvent);
   if(e.priceUsd)chart.add({at:Number.isFinite(e.occurredAt)?e.occurredAt:e.receivedAt,price:e.priceUsd,volume:e.usdVolume,id:e.id,source:'swap'});
   $('chart-source').textContent=source==='ccxt'?market.exchangeName+' · public WebSocket trades · '+(market.quoteApproximate?market.quoteToken.symbol+' prices used as a USD proxy':'USD trade prices')+' · history volume estimated from base volume':source==='rpc'?(e.protocol==='orca'?'Orca post-swap spot prices · confirmed WebSocket events · USD uses snapshot SOL/quote conversion':e.protocol==='v4'?'Direct Uniswap v4 post-swap prices · RPC polling ≥2s · USD quote conversion uses snapshots':'Streamed swap execution prices · USD estimated using latest quote conversion'):'Observed trade prices · GeckoTerminal / ≥8s polling · upstream cached · provider USD values';
   $('last-event').textContent=e.side.toUpperCase()+(source==='ccxt'?' · '+market.exchangeName:' · block '+e.block);display();
  }else{poolEvents.push(e);lastMarketActivityAt=Math.max(lastMarketActivityAt,Number(e.occurredAt)||Number(e.receivedAt)||0);if(!replay.state.active){dataVisual.event(e);}if(streamKind==='pool')$('last-event').textContent='Pool event · slot '+e.slot;}
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
function replayPiano(m){
 if(!playing||replay.state.dragging||!piano||!pianoEnabled||ctx?.state!=='running')return;
 const frozen=replay.state.frozen,cursor=replay.state.cursor,bars=frozen?.bars||chart.renderedBars,interval=frozen?.interval||chart.interval;
 const rate=replay.state.speed==='candle'?interval/1000:Number(replay.state.speed)||1;
 if(!replayPianoPrimed){
  const segments=bars.map(bar=>{
   const score=replay.state.score?.frames.get(bar.time);
   const observed=replayObservationForBar(frozen?.observations,bar,interval);
   const music=observed?pianoMusic(observed.metrics):pianoMusic({music:score?.music||{},activity:score?.activity||0});
   let resolved;
   // Resolve only candles the transport visits. Audio and pixels share the
   // frozen control cache, including recorded observations when available.
   const resolve=()=>{
    if(resolved)return resolved;
    const controls=frozen?replay.controlsForBar(bar,undefined,frozen):scoreCandle(bars,market,interval,bar);
    if(!controls)return resolved={metrics:{observed:false,fresh:0},active:false};
    if(controls.replay?.source==='candles'&&score?.music)controls.music={...controls.music,...score.music};
    const music=pianoMusic(controls),performance=marketPerformance(controls,music);
    return resolved={music,metrics:controls,cap:controls.context?.latestCap,active:performance.excitation>0};
   };
   return {start:candleEnd(bar,interval),end:candleEnd(bar,interval)+interval,music,resolve,harmonyStep:score?.harmonyStep||0};
  });
  piano.setTimeline(segments);piano.seekTimeline(cursor,rate);replayPianoPrimed=true;
 }else piano.syncTimeline(cursor,rate);
 pianoReplayCursor=cursor;
}
function tick(){
 const m=metrics();
 if(replay.state.active)replayPiano(m);else{pianoReplayCursor=null;replayPianoPrimed=false;}
 const historical=replay.state.active,bar=replay.state.bar;
 piano?.frame({...m,music:pianoMusic(m)},{playing,seeking:replay.state.dragging,ended:replay.state.ended,at:historical?replay.state.cursor:Date.now(),price:historical?bar?.close:currentPrice(),referencePrice:historical?bar?.open:undefined,known:historical?bar?.volume===0:(m.decoded&&streamKind!=='trade-poll'&&m.fresh>0)||(tradePollingAt>0&&Date.now()-tradePollingAt<25000),quiet:historical?bar?.volume===0:true});
 // Sync replay/transport before sharing the phrase with the other voices.
 m.arrangement=piano?.arrangement?.();
 syncLevels(m);
 bpm=orchestraTempo(m);$('tempo').textContent=bpm+' BPM · '+Math.round((m.music?.intensity||0)*100)+'% INTENSITY';
}
// The chip rack owns every voice; market frames update its shared score.
function loop(){if(!playing)return;tick();if(playing)timer=setTimeout(loop,150);}
async function initialize(){
 if(audioContext().state!=='running'){const error=Error('Audio is interrupted · tap Listen again');error.name='AudioUnlockError';throw error;}
 if(!gain){
  gain=ctx.createGain();gain.gain.value=0;
  const analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.minDecibels=-85;analyser.maxDecibels=-15;analyser.smoothingTimeConstant=.65;
  const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=0;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.12;
  gain.connect(limiter);limiter.connect(analyser);
  listeningGain=ctx.createGain();listeningGain.gain.value=Number($('master').value);
  const recordTap=ctx.createAnalyser();recordTap.fftSize=2048;
  analyser.connect(listeningGain);listeningGain.connect(recordTap);recordTap.connect(ctx.destination);outputTap=recordTap;
  // Stereo metering reads chip output before listening volume.
  const splitter=ctx.createChannelSplitter(2);limiter.connect(splitter);
  outputMeters=[0,1].map(channel=>{const meter=ctx.createAnalyser();meter.fftSize=2048;splitter.connect(meter,channel);return meter;});
  // Every generated sound passes through the single chip-analysis tap.
  instrumentTap=ctx.createGain();instrumentTap.connect(gain);
  function scope(name,out){const input=ctx.createGain();input.connect(out);const split=ctx.createChannelSplitter(2);input.connect(split);const channels=[0,1].map(channel=>{const meter=ctx.createAnalyser();meter.fftSize=2048;split.connect(meter,channel);return meter;});audioScopes.push({name,input,channels});return input;}
  scope('GB transmission',instrumentTap);

 }
 const epoch=audioEpoch,context=ctx,destination=instrumentTap;
 if(!piano&&!pianoLoading){
  audioErrors.piano='';
  pianoLoading=createTradePiano(context,audioScopes[0]?.input||destination,{initialSeed:seed,onScoreEvent:event=>{if(epoch===audioEpoch&&playing)dataVisual.scoreEvent(event);},onVoice:event=>{if(epoch===audioEpoch){sharedHarmony=event.harmony;if(event.audible!==false)pianoChordCount++;if(event.audible!==false&&event.time!=null)dataVisual.piano(event.time,1);}},onArpeggio:event=>{if(epoch===audioEpoch&&event.time!=null)dataVisual.piano(event.time,.65);}}).then(instrument=>{
   if(epoch!==audioEpoch){instrument.close();throw Error('Audio loading cancelled');}
   piano=instrument;configureChipLayers();piano.setMaster(1);piano.reset(seed);piano.resonance(liveMetrics().context?.latestCap);piano.setRunning(playing);
   if(playing){flushPianoTrade();if(replay.state.active)tick();}audioStatus();return piano;
  }).catch(error=>{if(epoch===audioEpoch){audioErrors.piano=error.message;engineView.log('GB chip: '+error.message);audioStatus();}throw error;}).finally(()=>{if(epoch===audioEpoch)pianoLoading=null;});
 }
 try{await (piano||pianoLoading);}
 catch{throw Error(audioErrors.piano||'GB chip could not load');}
}
async function closeAudio(){
 clearTimeout(idleAudioTimer);
 stopLegacyPlayback();audioEpoch++;pianoLoading=null;pendingPianoTrade=null;
 piano?.close();piano=null;const context=ctx;ctx=null;gain=null;listeningGain=null;outputGateOpen=null;outputTap=null;outputMeters=null;instrumentTap=null;audioScopes=[];
 for(const name of Object.keys(audioErrors))audioErrors[name]='';
 await context?.close();
}
function updatePlayAvailability(active=playing){
 const button=$('play'),waiting=!market,interrupted=active&&ctx?.state!=='running';
 button.disabled=starting||waiting;
 button.title=waiting?'Loading coin':interrupted?'Resume':active?'Pause':'Play';
 button.setAttribute('aria-label',waiting?'Loading coin':interrupted?'Resume interrupted audio':active?'Pause experience':'Play audiovisual experience');
 button.setAttribute('aria-busy',String(starting||waiting));
}
const playbackShortcuts=bindPlaybackShortcuts({button:$('play'),getState:()=>({ready:!!market,starting,playing:playing&&ctx?.state==='running'}),getMetadata:()=>market?{title:market.baseToken.symbol+(market.baseToken.name&&market.baseToken.name!==market.baseToken.symbol?' · '+market.baseToken.name:''),artist:'UPIC',album:'Live market artwork'}:null});
function setPlayState(active){
 const button=$('play'),interrupted=active&&ctx?.state!=='running';
 button.dataset.playing=String(active&&!interrupted);
 button.innerHTML='<svg class="transport-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(active&&!interrupted?'<path d="M7 5h4v14H7zM14 5h4v14h-4z" fill="currentColor"/>':'<path d="M8 4l12 8-12 8z" fill="currentColor"/>')+'</svg>';
 button.setAttribute('aria-pressed',String(active&&!interrupted));
 updatePlayAvailability(active);
 playbackShortcuts.update();
}
let audioLoadFailed=false;
function audioBusy(value){
 starting=value;setPlayState(playing);
 if(value)audioLoadFailed=false;
 ui.loading('audio',null,'');
}
setPlayState(false);
$('play').onclick=async()=>{
 if(starting||!market)return;
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
  playing=false;pendingPianoTrade=null;clearTimeout(timer);setPlayState(false);
  // Pause the chip and chart together; the master gain closes smoothly.
  const stopped=()=>{
   if(playing||starting)return;
   stopLegacyPlayback();piano?.setRunning(false);
   if(gain)gain.gain.setTargetAtTime(0,ctx.currentTime,.025);outputGateOpen=false;
   idleAudioTimer=setTimeout(()=>{if(!playing&&!starting&&ctx?.state==='running')void ctx.suspend().catch(()=>{});},100);
  };
  stopped();
  status(replay.state.active?'History replay paused':'Paused');updateReplayUI(replay.state.controls||{});return;
 }
 audioBusy(true);status('Loading sounds…');
 try{await unlocked;if(!market)throw Error('Trending market is still loading.');if(!piano)await initialize();if(replay.state.active)await prepareReplayAudio();resetEnsemble({preserveVisual:true});if(ctx&&ctx.state!=='running'){const error=Error('Audio is interrupted · tap Listen again');error.name='AudioUnlockError';throw error;}if(gain)gain.gain.setTargetAtTime(1,ctx.currentTime,.04);playing=true;piano?.setRunning(true);flushPianoTrade();replay.state.clock=performance.now();loop();setPlayState(true);audioStatus();}
 catch(e){audioLoadFailed=true;playing=false;clearTimeout(timer);setPlayState(false);status('Unable to start audio: '+e.message);if(e.name!=='AudioUnlockError')await closeAudio();}
 finally{audioBusy(false);}
};
for(const id of controls)$(id).addEventListener('input',()=>{if(listeningGain)listeningGain.gain.setTargetAtTime(Number($(id).value),ctx.currentTime,.025);session?.controls.push({at:Date.now(),name:id,value:Number($(id).value)});});
const cash=n=>n!=null&&n!==''&&Number.isFinite(Number(n))?'$'+new Intl.NumberFormat('en',{maximumSignificantDigits:8}).format(n):'—';
function display(){
 updatePlayAvailability();
 chart.setMarketCapBasis(replay.state.active?(replay.state.frozen?.market||market):market);
 document.querySelector('.audio-visualizer').dataset.marketLoaded=String(!!market);
 displayCoinImage();syncSavedCoin();showCoinAddress(market?.baseToken?.address,market?.chainId,market?.nativeAsset);playbackShortcuts.update();
 const historical=replay.state.active?replay.state.controls:null,recorded=historical?.replay?.source==='recorded';
 $('mode').hidden=!!historical||!market;
 $('mode').textContent=historical||!market?'':streamConnected&&streamKind==='rpc-poll'?'DIRECT RPC · ≥2 SEC':streamConnected&&streamKind==='exchange'?'LIVE EXCHANGE'+(market.quoteApproximate?' · '+market.quoteToken.symbol+' ≈ USD':''):streamConnected&&streamKind==='swap'?'LIVE SWAPS':streamConnected&&streamKind==='trade-poll'?'CACHED TRADE POLLING':streamConnected&&streamKind==='pool'?'POOL ACTIVITY + SNAPSHOTS':'MARKET SNAPSHOTS';
 $('coin-name').textContent=market?market.baseToken.symbol:'';
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
 $('liquidity-label').textContent=(exchangeMarket?'ORDER BOOK · ±1%':'LIQUIDITY')+(latestLiquidity?' · LATEST':'');
 $('liquidity').textContent=liquidityAvailable?cash(liquidity):'Unavailable';
 $('liquidity').title=historical&&hasRecordedLiquidity?'Liquidity recorded at this replay point':exchangeMarket?'Current exchange buy/sell orders within 1% of price; up to 25 levels. This is not total on-chain liquidity or historical liquidity.':liquidityAvailable?'Selected pool liquidity · snapshot received '+new Date(poolSnapshot?.at||lastSnapshot).toLocaleTimeString()+(Date.now()-(poolSnapshot?.at||lastSnapshot)>liquiditySnapshotMaxAge()?' · updates delayed':'')+(latestLiquidity?' · latest available, not historical liquidity':''): 'Selected pool liquidity is unavailable';
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
 const host=$('history-loading'),has=data.candles?.length>0,waiting=data.state==='waiting',failed=Boolean(data.error)||data.state==='unavailable',busy=!failed&&['loading','cached'].includes(data.state);
 const message=$('player-history-message');message.hidden=true;message.inert=true;message.querySelector('span').textContent='';
 $('player-history-retry').hidden=true;

 if(pendingHistoryReplay&&(failed||!busy&&!waiting)&&(data.candles?.length||0)<2&&!data.retrying&&!historyReplayReady()){
  pendingHistoryReplay=false;status(failed?'History unavailable · retry history to replay':has?'Not enough historical candles to replay · retry history':'No historical candles returned · retry history');updateReplayUI({});
 }
 host.hidden=has&&!busy&&!failed&&!waiting;host.dataset.partial=String(has);host.classList.toggle('is-loading',busy);$('market-chart').setAttribute('aria-busy',String(busy));
 $('history-loading-label').textContent=waiting?data.message:failed?(has?'History refresh delayed · showing loaded candles':'History delayed')+(data.retrying?' · retrying automatically':' · retry available'):has?'Updating earlier prices…':busy?'Loading earlier prices…':'No earlier prices available';
 $('history-retry').hidden=busy||waiting;
 ui.loading('history',waiting?null:busy?'working':failed||!has?'error':'done',data.retrying&&busy?'Retrying history':has?'Updating history':'Loading history',{operation:data.operation??null,startedAt:data.startedAt,endedAt:data.endedAt});
}
$('player-history-retry').onclick=()=>$('history-retry').click();
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
function withNativeCap(pair,snapshot){
 if(pair.nativeAsset&&snapshot?.network===pair.nativeAsset.chain&&snapshot.assetId===pair.nativeAsset.id&&snapshot.weight>0&&((snapshot.marketAt??snapshot.marketFetchedAt)==null||(Number.isSafeInteger(snapshot.marketAt??snapshot.marketFetchedAt)&&Date.now()-(snapshot.marketAt??snapshot.marketFetchedAt)<6*3600000&&(snapshot.marketAt??snapshot.marketFetchedAt)<=Date.now()+300000))&&Number(pair.priceUsd)>0){
  const supply=Number(snapshot.supply)||Number(snapshot.referenceMarketCap)/Number(snapshot.referencePrice);
  if(Number.isFinite(supply)&&supply>0)return {...pair,marketCap:supply*Number(pair.priceUsd),marketCapSource:snapshot.marketSource||snapshot.source,marketCapEstimated:true};
 }
 return pair.nativeAsset?{...pair,marketCap:null,marketCapSource:null}:pair;
}
function applySnapshot(pair){
 if(pair.nativeAsset)pair=withNativeCap(pair,holderMetadata.snapshot().holdings);
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
 liveConnection?.abort();liveConnection=null;pendingHistoryReplay=false;
 pendingPianoTrade=null;tradePollingAt=0;if(!captureMode)preloadPianoSamples(hash(pair.chainId+':'+pair.baseToken.address)).catch(error=>engineView.log('GB chip preload: '+error.message));
 pianoHistory=[];pianoChordCount=0;piano?.reset();pianoReplayCursor=null;
 replay.setMarket(pair.chainId+':'+pair.pairAddress+':'+pair.baseToken.address);
 lastMarketActivityAt=0;generation++;snapshotController?.abort();clearTimeout(poll);clearTimeout(musicHistoryTimer);stopMusicHistory?.();stopMusicHistory=null;imageController?.abort();imageToken='';stopStream?.();stopHistory?.();stopChartHistory?.();stopStream=null;streamPool='';streamConnected=false;streamKind='snapshot';poolEvents=[];tradeEvents=[];lastTrade=null;lastChainPrice=null;receivedTradeCount=0;historyContext=null;originDate=null;chart.reset();
 contextHistoryState=null;contextHistoryOperation=null;contextHistoryKey='';contextCandles=[];
 resetEnsemble();mode='live';market=pair;void replayVisualHistory.setMarket(pair);nftOwnerPreview.setMarket(pair);if(!captureMode)void coinSummary.setMarket(pair);seed=hash(pair.chainId+':'+pair.baseToken.address);holderMetadata.setMarket(isExchangeMarket(pair)&&!pair.nativeAsset?null:pair);state=seed;step=0;piano?.reset(seed);applySnapshot(pair);if(!shared){startHistory(pair);setupStream();}void loadCoinImage(pair);
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
function searchBusy(value,suggestions=false){
 loading=value;$('load').disabled=value&&!suggestions;$('load').textContent=value?'Searching…':'Search';
 $('load').setAttribute('aria-busy',String(value));$('coin-form').setAttribute('aria-busy',String(value));
}
$('address').addEventListener('input',()=>{
 cancelSearch();
});
function cancelSearch(){
 liveConnection?.abort();liveConnection=null;searchController?.abort();
 searchRevision++;searchBusy(false);searchFeedback('');
 $('coin-search-results').hidden=true;$('address').setAttribute('aria-expanded','false');
}
$('coin-search-results').addEventListener('keydown',event=>{if(event.key==='Escape'){searchController?.abort();searchRevision++;searchBusy(false);searchFeedback('');}},true);
$('address').addEventListener('keydown',event=>{
 const results=$('coin-search-results');
 if(event.key==='ArrowDown'&&!results.hidden){const first=results.querySelector('button');if(first){event.preventDefault();first.focus();}}
 if(event.key==='Escape'){searchController?.abort();searchRevision++;searchBusy(false);results.hidden=true;$('address').setAttribute('aria-expanded','false');searchFeedback('');}
});
async function selectSearchMarket(pair,{autoPlay=false,revision=searchRevision}={}){
 try{
  if(autoPlay&&(!playing||ctx?.state!=='running'))primeAudio();
  searchController?.abort();
  searchFeedback('Opening '+pair.baseToken.symbol+'…','loading');
  if(isExchangeMarket(pair)){status('Loading '+pair.exchangeName+' market…');pair=await prepareExchangeMarket(pair);}
  if(revision!==searchRevision)return;
  $('address').value='';syncAddressLabel();discovered=[pair];
  $('coin-search-results').hidden=true;$('address').setAttribute('aria-expanded','false');chooseMarket(pair);
  searchFeedback('');
  if(autoPlay&&(!playing||ctx?.state!=='running'))await $('play').onclick();
 }catch(error){if(revision===searchRevision){status(error.message);searchFeedback(error.message,'error');}}
}
document.addEventListener('upic:search-coin',event=>{
 const coin=event.detail;if(!coin||typeof(coin.address||coin.query)!=='string')return;
 liveConnection?.abort();liveConnection=null;searchController?.abort();searchRevision++;searchBusy(false);searchFeedback('');
 if(coin.source==='ccxt'&&['kraken','coinbaseexchange','binance'].includes(coin.exchangeId)&&/^[A-Z0-9.]+\/(USD|USDT|USDC)$/.test(coin.exchangeSymbol||'')){
  void selectSearchMarket({source:'ccxt',chainId:'exchange',exchangeId:coin.exchangeId,exchangeSymbol:coin.exchangeSymbol,exchangeName:coin.exchangeId,nativeId:coin.nativeId||undefined,pairAddress:coin.exchangeId+':'+coin.exchangeSymbol,baseToken:{address:coin.query,symbol:coin.symbol,name:coin.name}},{autoPlay:true,revision:searchRevision});
  return;
 }
 void searchForCoin(coin.address||coin.query,{network:coin.address?coin.chain:null,autoPlay:true});
});
$('coin-form').onsubmit=async e=>{
 e.preventDefault();
 const selectedNetwork=$('coin-form').dataset.searchNetwork;
 return searchForCoin($('address').value,{network:selectedNetwork&&selectedNetwork!=='all'?selectedNetwork:null,autoPlay:true});
};
async function searchForCoin(query,{network:wantedNetwork=null,autoPlay=true,suggestions=false}={}){
 const address=String(query||'').trim();if(address.length<1||address.length>250){searchFeedback('Enter a coin name, contract address or exchange pair.','error');return;}
 if(autoPlay&&(!playing||ctx?.state!=='running'))primeAudio();
 const revision=++searchRevision,tokenAddress=isTokenIdentifier(address),exchangeOnly=isExchangeQuery(address);
 searchController?.abort();const searchAbort=new AbortController();searchController=searchAbort;
 const current=()=>revision===searchRevision;
 searchBusy(true,suggestions);$('coin-search-results').hidden=true;$('address').setAttribute('aria-expanded','false');
 searchFeedback(tokenAddress?'Finding this coin…':exchangeOnly?'Finding exchange markets…':'Finding markets…','loading');
 let dexPairs=[],exchangePairs=[],errors=[],remaining=2;
 function publish(){
  if(!current()||tokenAddress||exchangeOnly)return;
  const pairs=[...exchangePairs,...dexPairs];
  if(pairs.length){
   showCoinMatches($('coin-search-results'),pairs,pair=>{const selectedRevision=++searchRevision;searchBusy(false);void selectSearchMarket(pair,{autoPlay:true,revision:selectedRevision});});
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
   if(suggestions){
    const matches=wantedNetwork?dexPairs.filter(pair=>pair.chainId===wantedNetwork):dexPairs;
    if(!matches.length)throw Error('No indexed market found on this network.');
    showCoinMatches($('coin-search-results'),matches,pair=>{const selectedRevision=++searchRevision;searchBusy(false);void selectSearchMarket(pair,{autoPlay:true,revision:selectedRevision});});
    searchFeedback('');return;
   }
   const selection=wantedNetwork?dexPairs.find(p=>p.chainId===wantedNetwork):dexPairs[0];
   if(!selection)throw Error('No indexed market found on this network.');
   await selectSearchMarket(selection,{autoPlay,revision});return;
  }
  if(exchangeOnly&&(pairs.length===1||captureMode)){await selectSearchMarket(pairs[0],{autoPlay,revision});return;}
  if(exchangeOnly){
   showCoinMatches($('coin-search-results'),pairs,pair=>{const selectedRevision=++searchRevision;searchBusy(false);void selectSearchMarket(pair,{autoPlay:true,revision:selectedRevision});});
   searchFeedback('Choose an exchange market');
  }
 }catch(error){if(revision===searchRevision){if(!suggestions)status(error.message);searchFeedback(error.message,'error');}}
 finally{if(revision===searchRevision)searchBusy(false);}
}
function showCoinAddress(address,network='',nativeAsset=null){
 const button=$('coin-address'),row=$('coin-address-row'),link=$('coin-contract-link'),reference=nativeAsset?nativeContractReference(nativeAsset):null;
 if(reference){address=reference.address;network=reference.chain;}
 const valid=Boolean(reference)||typeof address==='string'&&isTokenIdentifier(address);
 button.hidden=!valid;button.dataset.address=valid?address:'';if(row)row.hidden=!valid;
 if(link){
  link.hidden=!valid||!reference?.explorerURL;
  if(!link.hidden){link.href=reference.explorerURL;link.title='View '+reference.symbol+' reference on '+network.toUpperCase();link.setAttribute('aria-label',link.title+' (opens in a new tab)');}
  else link.removeAttribute('href');
 }
 if(!valid)return;
 const short=address.length>24?address.slice(0,8)+'…'+address.slice(-6):address;
 const chainLabel=network.toLowerCase()==='solana'?'SOL':network.toUpperCase();
 const kind=reference?.kind==='bridged'?'BINANCE-PEG':reference?.kind==='native'?'NATIVE':reference?.kind==='type'?'TYPE':'WRAPPED';
 const chain=document.createElement('span');chain.className='coin-address-network';chain.textContent=(chainLabel?chainLabel+' · ':'')+(reference?reference.symbol+' ('+kind+') · ':'');
 const ca=document.createElement('span');ca.className='coin-address-value';ca.textContent=short;button.replaceChildren(chain,ca);
 button.title=reference?reference.symbol+' '+kind.toLowerCase()+' reference on '+chainLabel+' · '+address+' · Click to copy':address+' · Copy address';
 button.setAttribute('aria-label',reference?'Copy '+reference.symbol+' '+kind.toLowerCase()+' identifier on '+chainLabel+': '+address:'Copy coin address '+address);
}
$('coin-address').addEventListener('click',async()=>{
 const address=$('coin-address').dataset.address;if(!address)return;
 try{await navigator.clipboard.writeText(address);savedFeedback('Address copied');}
 catch{savedFeedback('Could not copy the address.');}
});
let savingCoin=false;
bindAddressSearch($('address'),{
 current:()=>searchRevision,cancel:cancelSearch,
 lookup:query=>{const network=$('coin-form').dataset.searchNetwork;void searchForCoin(query,{network:network&&network!=='all'?network:null,autoPlay:false,suggestions:true});},
});
function syncSavedCoin(){
 const button=$('save-coin'),coin=savedCoinForMarket(market,market&&coinImageKey===imageKey(market)?coinImageURL:'');
 const saved=Boolean(coin&&isCoinSaved(coin.key));
 button.disabled=!coin||savingCoin||savedCoinsState().status==='loading';button.setAttribute('aria-pressed',String(saved));
 button.setAttribute('aria-busy',String(savingCoin));
 button.setAttribute('aria-label',saved?'Remove coin from saved':'Save coin for later');
 button.title=saved?'Saved · click to remove':'Save for later';
}
let savedFeedbackTimer;
function savedFeedback(message){
 const node=$('save-coin-status');clearTimeout(savedFeedbackTimer);
 node.textContent=message;node.hidden=false;
 savedFeedbackTimer=setTimeout(()=>{node.hidden=true;node.textContent='';},3500);
}
$('save-coin').addEventListener('click',async()=>{
 const coin=savedCoinForMarket(market,market&&coinImageKey===imageKey(market)?coinImageURL:'');if(!coin)return;
 savingCoin=true;syncSavedCoin();
 try{const saved=await toggleSavedCoin(coin);savedFeedback(saved?'Saved to your profile':'Removed from saved');}
 catch(error){savedFeedback(error.message);}
 finally{savingCoin=false;syncSavedCoin();}
});
window.addEventListener('upic:saved-coins-changed',syncSavedCoin);
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
 document.body.dataset.playback=replay.state.active?'replay':'live';
 const advanced=false;
 $('advanced-cap').textContent=cap>0?'$'+Math.round(cap).toLocaleString('en'):'—';
 rollCap(cap>0?'$'+(advanced?Math.round(cap).toLocaleString('en'):new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(cap)):'—',cap||0);
 $('coin-cap').title=cap>0?'Estimated market cap · $'+Math.round(cap).toLocaleString('en'):'';
 $('coin-clock-label').textContent=replay.state.active?'REPLAY · DATE / TIME':'LIVE · DATE / TIME';
 $('coin-cap-label').textContent=!advanced?'MARKET CAP':replay.state.active?'MCAP · HISTORICAL ESTIMATE':m.context?.capEstimated||market?.marketCapEstimated?'MCAP · PRICE ESTIMATE':'MARKET CAP';

}
async function restoreSharedScore(){
 try{
  const score=await loadSharedScore(location.hash);if(!score)return false;
  chooseMarket(score.market,{shared:true});setHistoryLoading({candles:score.rows,state:"pool-start"});const bars=score.rows.map(([time,open,high,low,close,volume])=>({time,open,high,low,close,volume,volumeEstimated:isExchangeMarket(score.market),observedThrough:time+score.interval}));
  chart.setHistory(bars,score.interval,bars[0].time);chart.draw();replay.freeze(bars,score.market,score.interval);replay.state.score=replay.preserveScore(buildReplayScore(bars,seed,score.interval,score.market),score.interval);replay.state.speed=replaySpeed(score.speed);updateSpeedButtons();
  replay.seek(bars[0],score.interval);chart.schedule();syncLevels(metrics());syncSavedCoin();status('Replay ready · press Play');return true;
 }catch(error){status('Cannot open shared score: '+error.message);return false;}
}
display();
const restoredScore=await restoreSharedScore();
const requestedCoin=new URLSearchParams(location.search);
if(!restoredScore&&requestedCoin.get('coin')?.length<=250&&requestedCoin.get('coin')){
 showCoinAddress(requestedCoin.get('coin'),requestedCoin.get('network')||'');
 void searchForCoin(requestedCoin.get('coin'),{network:requestedCoin.get('network')||null,autoPlay:false});
}
let captureArchiveStatus=null;
if(captureMode)window.__upicCaptureStatus=()=>({market:market?{chain:market.chainId,address:market.baseToken.address,symbol:market.baseToken.symbol}:null,visual:dataVisual.snapshot(),capture:captureArchiveStatus,holders:holderMetadata.snapshot().holdings?.state,lookup:$('lookup').textContent});
if(captureMode)archivePlayerFrames({captureMode,getMarket:()=>market,getVisual:()=>dataVisual,eligible:()=>!replay.state.active,onStatus:status=>{captureArchiveStatus=status;}});
if(!captureMode)startTrending((item,options={})=>{
 if(options.initial&&(loading||searchRevision>0||market))return;
 searchController?.abort();searchRevision++;searchBusy(false);searchFeedback('');
 // Resume in the coin click itself: market discovery completes asynchronously.
 // The unlocked context stays silent until Listen opens the selected coin engine.
 if(!playing)primeAudio();
 if(item.image)tokenImages.set(imageKey({chainId:item.chain,baseToken:{address:item.address}}),item.image);
 if(item.market){
  void selectSearchMarket(item.market,{autoPlay:options.autoplay??!options.initial,revision:searchRevision});
 }else void searchForCoin(item.address,{network:item.chain,autoPlay:options.autoplay??!options.initial});
},state=>ui.loading('trending',state.status,state.label,{host:state.host,operation:state.operation}));
function reconcileIdleFeed(){
 if(document.hidden&&!playing){stopStream?.();stopStream=null;streamPool='';streamConnected=false;return;}
 if(market&&!stopStream&&mode==='live'&&!sharedMarket)setupStream();
}
document.addEventListener('visibilitychange',reconcileIdleFeed);
setInterval(()=>{reconcileIdleFeed();if(!playing&&!document.hidden)syncLevels(metrics());else if(playing&&!document.hidden)audioStatus();},1000);
const chartStatus=document.querySelector('.chart-status');
new MutationObserver(()=>{for(const item of chartStatus.children)item.title=item.textContent;}).observe(chartStatus,{childList:true,characterData:true,subtree:true});
function audioContext(){
 if(!ctx){
  const context=createMusicContext();ctx=context;
  context.onstatechange=()=>{
   if(context!==ctx||!playing)return;
   if(context.state==='running'){replay.state.clock=performance.now();flushPianoTrade();setPlayState(true);}
   else{$('play').dataset.playing='false';$('play').setAttribute('aria-pressed','false');$('play').textContent='Resume';$('play').setAttribute('aria-label','Resume interrupted audio');}
   audioStatus();playbackShortcuts.update();
  };
 }
 return ctx;
}
function primeAudio(){try{unlockPlayback(audioContext()).catch(()=>{});}catch{}}
function seekHistory(bar,dragging=false){
 pendingPianoTrade=null;
 if(!bar)return;
 if(!replay.state.active&&!historyReplayReady()){
  pendingHistoryReplay=true;primeAudio();status('Loading history for replay');return;
 }
 if(!playing)primeAudio();
 if(!replay.state.active){resetEnsemble();replay.freeze(chart.renderedBars,market,chart.interval);replay.state.score=replay.preserveScore(buildReplayScore(replay.state.frozen.bars,seed,chart.interval,replay.state.frozen.market),chart.interval);}
 replayPianoPrimed=false;replayPhrase=null;
 chart.resumeReplayFollow();replay.seek(bar,chart.interval,dragging);chart.schedule();
 sharedHarmony=null;pianoReplayCursor=replay.state.cursor;
 session?.controls.push({at:Date.now(),name:'history-seek',cursor:replay.state.cursor,source:'loaded-candle',speed:replay.state.speed});
 if(playing)tick();else{const m=metrics();
 syncLevels(m);if(!starting)$('play').onclick();}
}
chart.onHistorySeek=seekHistory;
chart.onHistorySeekEnd=()=>replay.release();
chart.onReplayPanStart=()=>{
 replay.advance(chart.renderedBars,chart.interval,playing&&ctx?.state==='running');
 replay.state.dragging=true;pendingPianoTrade=null;replayPianoPrimed=false;replayPhrase=null;
};
chart.onReplayPan=at=>{
 if(!replay.state.active)return;
 Object.assign(replay.state,{cursor:at,clock:performance.now(),controls:null,endHold:null,ended:false,handoffRequested:false});
 pianoReplayCursor=at;
 if(!playing)syncLevels(metrics());
};
chart.onReplayPanEnd=()=>{replay.release();};
function restartHistory(){
 if(!historyReplayReady()){
  pendingHistoryReplay=true;primeAudio();status('Loading history for replay');
  if(!contextHistoryState||contextHistoryState.error||!['loading','cached','waiting'].includes(contextHistoryState.state))startHistory(market);
  updateReplayUI({});return;
 }
 chart.draw();seekHistory((replay.state.frozen?.bars||chart.history)[0]);
}
$('replay-play').onclick=()=>{if(!replay.state.active)restartHistory();};
$('replay-restart').onclick=restartHistory;
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
  replay.live();resetEnsemble();chart.tickView?.live();chart.goLive();$('chart-range').value='live';display();
 }
 chart.tickView?.live();chart.goLive();$('chart-range').value='live';
 session?.controls.push({at:Date.now(),name:'history-live'});
 if(playing)tick();else{const m=metrics();syncLevels(m);}
 status(playing?'Listening live · waiting for trades':'Live market · press Play');return true;
};
function updateSpeedButtons(){
 for(const button of $('replay-speed').querySelectorAll('[data-rate]'))button.setAttribute('aria-pressed',String(button.dataset.rate===replay.state.speed));
 $('replay-speed-select').value=replay.state.speed;
}
function setReplaySpeed(value){
 replay.advance(chart.renderedBars,chart.interval,playing&&ctx?.state==='running');
 replay.state.speed=replaySpeed(value);replay.release();updateSpeedButtons();
 session?.controls.push({at:Date.now(),name:'history-speed',value:replay.state.speed});
}
$('replay-speed').onclick=event=>{
 const button=event.target.closest('button[data-rate]');if(button)setReplaySpeed(button.dataset.rate);
};
$('replay-speed-select').onchange=()=>setReplaySpeed($('replay-speed-select').value);
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
function syncChartTypography(){chart.chart.applyOptions({layout:{fontFamily:getComputedStyle(document.documentElement).getPropertyValue('--font-family').trim(),fontSize:12}});}
playerScreen.addEventListener('change',syncChartTypography);
document.fonts.ready.then(syncChartTypography);

// Release 225: retain coin contexts across navigation.
