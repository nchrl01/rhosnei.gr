import {seedTonic} from './seed-key.js?v=1';
import {buildReplayScore} from './replay-score.js?v=152';
import {createUIControls} from './ui-controls.js?v=133';
import {isExchangeMarket,isExchangeQuery,searchExchangeMarkets,prepareExchangeMarket,subscribeExchangeMarket} from './ccxt-market.js?v=136';
import {createMusicContext,unlockPlayback,stopLegacyPlayback} from './audio-unlock.js?v=55';
import {isTokenIdentifier,rankCoinMatches,showCoinMatches} from './coin-search.js?v=91';
import {rollingText} from './coin-readout.js?v=53';
import {createTakeShare,decodeScore} from './take-share.js?v=76';
import {harmonyPlan,pianoHarmony} from './music-context.js?v=53';
import {createEnvion} from './envion.js?v=152';
import {createEngineView} from './engine-view.js?v=186';
import {createCoinDither} from './coin-dither.js?v=119';
import {createUpicBrand} from './upic-brand.js?v=115';
import {createTransportIndicator} from './transport-indicator.js?v=112';
import {PIANO_MOVE_PCT} from './piano-policy.js?v=61';
import {createAudioDots} from './audio-dots.js?v=173';
import {createHolderMetadata} from './holder-metadata.js?v=168';
import {createTouchDesignerBridge} from './touchdesigner-bridge.js?v=97';
import {createDataSonification} from './data-sonification.js?v=187';
import {createArpeggioAI} from './ai-instruments.js?v=189';
import {createTradePiano,marketResonance,preloadPianoSamples} from './trade-piano.js?v=189';
import {createMathPatterns,MATH_SLOT_COUNT} from './math-patterns.js?v=152';
import {createMathPatternView} from './math-pattern-view.js?v=152';
import {contextualizeMarket} from './market-state.js?v=53';
import {createMarketReplay,candleEnd,scoreCandle} from './market-replay.js?v=79';
import {signalFreshness} from './market-controls.js?v=18';
import {createOrchestraConductor,ORCHESTRA_LAYERS,orchestraTempo} from './orchestra.js?v=53';
import {createNativePd} from './native-pd.js?v=18';
import {createPd} from './vendor/libpd-wasm.js?v=30';
import {subscribePool} from './realtime.js?v=4';
import {subscribeEvm} from './evm.js?v=39';
import {subscribeOrca} from './orca.js?v=39';
import {subscribeRobinhoodV4} from './v4.js?v=135';
import {fetchGecko} from './gecko.js?v=39';
import {startTrending} from './trending.js?v=99';
import {MarketChart} from './chart.js?v=136';
import {loadHistory} from './history.js?v=136';
import {pollPoolTrades} from './trades.js?v=39';
const $=id=>document.getElementById(id);
const ui=createUIControls();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let envionLoading=null;
let sharedHarmony=null;
let pd,ctx,gain,listeningGain,outputTap,outputMeters,instrumentTap,instrumentSamples,audioScopes=[],playing=false,starting=false,poll,market=null,mode='loading',generation=0,loading=false;
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
const engineMaster=()=>$('audio-output').value==='native'?Number($('master').value):1;
let stopStream,streamConnected=false,poolEvents=[],lastSnapshot=0,streamPool='',sharedMarket=false;
let streamKind='snapshot',tradeEvents=[],lastTrade=null,lastChainPrice=null,discovered=[],lastExcitation=0;
let piano=null,pianoEnabled=true,pianoHistory=[],pianoReplayCursor=null,pianoChordCount=0;
let audioEpoch=0,pianoLoading=null,pdLoading=null,pendingPianoTrade=null,idleAudioTimer;
const audioErrors={piano:'',pd:'',envion:''};
let mathMarket=null,mathSeed=seed,replayPianoPrimed=false,replayPhrase=null;
let receivedTradeCount=0;
let stopMusicHistory,musicHistoryTimer,musicalCandles=[],musicalInterval=300000;
let stopHistory,stopChartHistory,historyContext=null,originDate=null,contextCandles=[],contextInterval=60000,chartRequest=0;
let historyLoadSequence=0,contextHistoryState=null,contextHistoryOperation=null,contextHistoryKey='';
const chart=new MarketChart($('market-chart'));
const replay=createMarketReplay();
createUpicBrand($('upic-mark'),$('upic-mark-fallback'));
const transportIndicator=createTransportIndicator($('transport-status'));
const arpeggioAI=createArpeggioAI({onStatus:text=>$('arp-ai-status').textContent=text,onPattern:pattern=>piano?.setArpeggioPattern(pattern)});
const displaySettings={dither:false};
const dataVisual=createAudioDots($('audio-dots'),{getAudio:()=>outputMeters?{context:ctx,channels:outputMeters,scopes:audioScopes}:outputTap,getState:()=>({playing,master:Number($('master').value),...displaySettings})});
$('coin-image').closest('.coin-avatar').addEventListener('dragstart',event=>event.preventDefault());
const coinDither=createCoinDither($('coin-image'),$('coin-image-fallback'),{onPixels:image=>dataVisual.setImage(image)});
$('display-dither').onclick=()=>{displaySettings.dither=!displaySettings.dither;$('display-dither').setAttribute('aria-pressed',String(displaySettings.dither));$('display-dither').textContent='Dither'+(displaySettings.dither?' on':' off');dataVisual.refresh();};
const dataSonification=createDataSonification({send,event});
const touchDesigner=createTouchDesignerBridge();
const holderMetadata=createHolderMetadata({onInfo:(info,pair)=>{
 if(info?.image_url){tokenImages.set(imageKey(pair),info.image_url);if(market&&imageKey(market)===imageKey(pair))displayCoinImage();}
}});
$('ai-retry').onclick=()=>{arpeggioAI.retry();};
chart.bindReplay(()=>replay.state,()=>playing);
let coinImageURL='',imageController,imageToken='';const tokenImages=new Map();
const imageKey=pair=>pair.chainId+':'+(/^0x/i.test(pair.baseToken.address)?pair.baseToken.address.toLowerCase():pair.baseToken.address);
async function loadCoinImage(pair){
 if(isExchangeMarket(pair))return;
 const key=imageKey(pair);if(imageToken===key)return;imageToken=key;imageController?.abort();
 if(tokenImages.has(key)||pair.historyTokenSide!=='quote'&&pair.info?.imageUrl)return;
 const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro'};
 const controller=new AbortController();imageController=controller;const timeout=setTimeout(()=>controller.abort(),45000);
 try{
  const r=await fetchGecko('https://api.geckoterminal.com/api/v2/networks/'+encodeURIComponent(aliases[pair.chainId]||pair.chainId)+'/tokens/'+encodeURIComponent(pair.baseToken.address)+'/info',{signal:controller.signal,priority:0});
  if(!r.ok)throw Error('Token image unavailable');const data=await r.json();if(controller.signal.aborted)return;
  tokenImages.set(key,data.data?.attributes?.image_url||'');if(market&&imageKey(market)===key)displayCoinImage();
 }catch{if(!controller.signal.aborted)tokenImages.set(key,'');}finally{clearTimeout(timeout);}
}
function displayCoinImage(){
 const token=market?.baseToken;
 if(token)$('coin-image-fallback').textContent=token.symbol.slice(0,2).toUpperCase();
 else if(!$('coin-image-fallback').querySelector('img'))$('coin-image-fallback').innerHTML='<img src="upic-logo-transparent.svg?v=115" alt="UPIC" class="coin-placeholder-logo" draggable="false">';
 const candidates=market?[market,...discovered.filter(p=>p.chainId===market.chainId&&sameToken(p.baseToken?.address,token.address))]:[];
 const image=candidates.find(p=>p.historyTokenSide!=='quote'&&p.info?.imageUrl)?.info?.imageUrl;
 let url='';try{const parsed=new URL(token?.imageUrl||image||(market&&tokenImages.get(imageKey(market))));if(parsed.protocol==='https:')url=parsed.href;}catch{}
 if(url===coinImageURL)return;coinImageURL=url;
 coinDither.set(url);
}
const conductor=createOrchestraConductor();
const mathView=createMathPatternView($('math-functions'));
const mathPatterns=createMathPatterns({send,onView:view=>mathView.update(view)});
mathPatterns.setSeed(mathSeed);
const levels=Object.fromEntries(ORCHESTRA_LAYERS.map(name=>[name,0]));
let orchestraState={state:'SPARSE',phrase:0,parameters:{}};

const engineView=createEngineView($('engine-view'),{onBundle:(name,enabled)=>{if(name==='data'){dataSonification.setEnabled(enabled);}else if(name==='math'){mathPatterns.setEnabled(enabled);}else if(name==='piano'){pianoEnabled=enabled;piano?.setEnabled(enabled);}else conductor.setBundle(name,enabled);if(market)syncLevels(metrics());}});
const envion=createEnvion($('envion'),{onTransport:command=>{if((command==='start'&&!playing)||(command==='stop'&&playing))$('play').click();}});
function resetEnsemble({preserveVisual=false}={}){sharedHarmony=null;touchDesigner.reset();if(!preserveVisual)dataVisual.reset();dataSonification.reset(seed);replayPianoPrimed=false;replayPhrase=null;conductor.reset();mathPatterns.reset();piano?.reset(seed);pianoReplayCursor=replay.state.active?replay.state.cursor:null;for(const name of Object.keys(levels))levels[name]=0;engineView.reset();}
function updateSignalMap(m){const view={m,levels,orchestra:orchestraState,bpm:orchestraTempo(m),pianoChordCount,instrument:piano?.snapshot(),visual:dataVisual.snapshot(),resonance:marketResonance(m.context?.latestCap),root:marketRoot(m),master:Number($('master').value),playing,native:$('audio-output').value==='native'};engineView.update({...view,coin:market?.baseToken?.symbol,feed:m.replay?'History · '+m.replay.source:market?streamKind:'loading',liquidity:m.observation?.liquidity});}
function bindSignalMap(){pd.subscribe?.('data-onset',message=>{dataVisual.pulse(Number(message.values?.[0]),ctx?.currentTime??0);touchDesigner.pulse(Number(message.values?.[0]));engineView.receive('data-onset',Number(message.values?.[0])||0);});for(const name of ['generation','av-envion-voice','av-output-left','av-output-right'])pd.subscribe?.(name,message=>{const value=Number(message.values[0]);conductor.observe(name,value);engineView.receive(name,value);});for(let slot=0;slot<MATH_SLOT_COUNT;slot++)pd.subscribe?.(`math-${slot}-meter`,message=>mathView.receive(slot,Number(message.values[0])));}
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
 if(!piano||!playing||ctx?.state!=='running')return;
 const trade=pendingPianoTrade;pendingPianoTrade=null;
 // Only a real, recently received event can survive the loading boundary.
 // Do not replay a stale backlog or turn snapshots into invented trades.
 if(trade&&playing&&!replay.state.active&&Date.now()-trade.receivedAt<3000)piano?.trade(trade,liveMetrics().context?.latestCap,{...trade.music,tonic:marketRoot(liveMetrics())});
}
function currentPrice(){if(streamConnected&&['swap','trade-poll','rpc-poll','exchange'].includes(streamKind)){if((lastChainPrice?.receivedAt||0)>(lastTrade?.receivedAt||0))return Number(lastChainPrice.priceUsd);if(lastTrade?.priceUsd)return Number(lastTrade.priceUsd);}return Number(market?.priceUsd);}
function marketRoot(m){
 // Market movement changes phrases and energy, never detunes a ringing ensemble.
 return seedTonic(seed);
}

function send(name,value){if(pd){pd.sendFloat(name,value);engineView.sent(name,value);}}
function event(name){pd?.sendBang(name);}
function liveMetrics(){
 if(!market)return contextualizeMarket({motion:0,activity:0,balance:.5,texture:0,volume:0,fresh:0,snapshotFresh:0,snapshotAge:Infinity},{price:0,history:[],interval:1000});
 const tx=market.txns?.m5||{};const total=(tx.buys||0)+(tx.sells||0);
 tradeEvents=tradeEvents.filter(e=>Date.now()-e.receivedAt<30000);
 poolEvents=poolEvents.filter(e=>Date.now()-e.receivedAt<10000);
 const decoded=streamConnected&&['swap','trade-poll','rpc-poll','exchange'].includes(streamKind);
 const first=tradeEvents[0],last=tradeEvents.at(-1),movement=first&&last?Math.abs((last.priceQuote/first.priceQuote-1)*100):0;
 const buys=tradeEvents.filter(e=>e.side==='buy').length,knownSides=tradeEvents.filter(e=>['buy','sell'].includes(e.side)).length;
 const book=isExchangeMarket(market)&&Date.now()-(market.exchangeBook?.at||0)<15000?market.exchangeBook:null;
 const liquidity=isExchangeMarket(market)?book?.depth:market.liquidity?.usd;
 const observedVolume=tradeEvents.reduce((sum,e)=>sum+(e.usdVolume||0),0);
 const rate=decoded?tradeEvents.length/30:streamConnected&&streamKind==='pool'?poolEvents.length/10:total/300;
 const volumeRate=decoded?observedVolume/30:(Number(market.volume?.m5)||0)/300;
 const raw={tradeRate:decoded?tradeEvents.length/30:0,motion:clamp((decoded?movement:Math.abs(Number(market.priceChange?.m5)||0))/8,0,1),activity:clamp(Math.log1p(rate)/Math.log(21),0,1),balance:book?.balance!=null?book.balance:decoded?(knownSides?buys/knownSides:.5):(total?(tx.buys||0)/total:.5),texture:clamp(Math.log10(Math.max(1,liquidity||1))/7,0,1),volume:clamp(Math.log1p(volumeRate)/Math.log(10001),0,1),...signalFreshness(decoded,lastSnapshot),decoded,observedVolume};
 return {...contextualizeMarket(raw,{price:currentPrice(),marketCap:Number(market.marketCap),snapshotPrice:Number(market.priceUsd),history:musicalCandles,interval:musicalInterval,changes:market.priceChange||{},liquidity:Number(liquidity),volumeRate,observedAt:Math.max(lastSnapshot,lastTrade?.receivedAt||0,lastChainPrice?.receivedAt||0)}),availability:{balance:book?.balance!=null||(decoded?knownSides>0:total>0),liquidity:liquidity!=null&&Number.isFinite(Number(liquidity)),volume:decoded||market.volume?.m5!=null},audience:holderMetadata.snapshot()};
}
function metrics(){
 const live=liveMetrics();live.observation={liquidity:isExchangeMarket(market)?(Date.now()-(market.exchangeBook?.at||0)<15000?market.exchangeBook?.depth:null):market?.liquidity?.usd,trades:market?.txns?.m5,change:market?.priceChange?.m5,volume:market?.volume?.m5};
 if(market)replay.record(live,currentPrice());
 const ended=replay.advance(chart.renderedBars||[],chart.interval,playing&&ctx?.state==='running');
 const historical=replay.metrics(chart.renderedBars||[],market,chart.interval);
 if(ended&&playing){$('play').onclick();status('History replay finished');}
 return historical||live;
}
function updateReplayUI(m){
 const active=replay.state.active,source=m.replay?.source;
 $('replay-speed').hidden=false;
 $('replay-speed').classList.toggle('is-live',!active);
 $('replay-speed').inert=!active;
 $('replay-speed').setAttribute('aria-hidden',String(!active));
 transportIndicator.render({playing,audioRunning:ctx?.state==='running',replay:active,seeking:replay.state.dragging,ended:replay.state.ended||replay.state.endHold!==null,streamConnected,streamKind,fresh:m.snapshotFresh??m.fresh??0});
 $('replay-live').disabled=!active;
 $('replay-play').disabled=!market||pendingHistoryReplay;
 $('replay-play').textContent=active?'Restart':'Replay';
 $('replay-play').setAttribute('aria-label',active?'Restart loaded history':'Play loaded history');
 $('replay-live').textContent=active?'Back to live':'Live';
 $('replay-live').setAttribute('aria-pressed',String(!active));
 $('replay-play').setAttribute('aria-pressed',String(active));
 const hint=$('replay-hint');
 if(hint){const text=!(chart.renderedBars?.length)?'History is loading. You can listen live while it arrives.':active?(replay.state.ended?'Replay finished. Restart or return to live.':'Drag the history strip to move through the recording. '+(replay.state.speed==='1'?'Real time: one recorded second per second.':replay.state.speed+'× playback.')):'Listen live, or choose a point on the history strip to replay.';if(hint.textContent!==text)hint.textContent=text;}

 const rate=replay.state.speed==='candle'?chart.interval/1000:Number(replay.state.speed);
 $('replay-state').textContent=active?'· '+rate+'×':'';
 $('replay-info').textContent=!active?'Each coin has an EarthBound instrument. A ≥'+PIANO_MOVE_PCT+'% move selects a note and can start a finite pattern; market cap and activity shape its layers. Known quiet intervals allow sparse notes.':'Selective candle score: ≥'+PIANO_MOVE_PCT+'% movement selects notes and finite patterns. Zero-volume candles allow sparse quiet notes. OHLC is not a reconstruction of historical trades; historical cap uses frozen snapshot supply.';
 if(isExchangeMarket(market))$('replay-info').textContent+=' Exchange history volume is estimated from base volume × close. Historical market cap is unavailable.';
 $('replay-state').title=$('replay-info').textContent;
 if(active&&replay.state.bar){chart.tickView?.setReplayTime(replay.state.bar.time);display();}
}
let outputGateOpen=null;
function syncLevels(m){
 if(m.replay&&replay.state.score){const score=replay.state.score.frames.get(replay.state.bar?.time);if(score){m={...m,replay:{...m.replay,scoreIndex:score.index,sceneSeed:score.sceneSeed}};sharedHarmony=pianoHarmony(seed,{chordStep:score.index},{...m.music,tonic:marketRoot(m)});}}
 m={...m,music:{...m.music,tonic:marketRoot(m),harmony:sharedHarmony}};
 const audibleTransport=playing&&!replay.state.dragging&&!replay.state.ended&&replay.state.endHold===null;
 if(gain&&outputGateOpen!==audibleTransport){outputGateOpen=audibleTransport;gain.gain.setTargetAtTime(audibleTransport?1.5:0,ctx.currentTime,.025);}
 mathMarket=m;updateCoinReadout(m);
 touchDesigner.frame(m,{playing:playing&&ctx?.state==='running',seeking:replay.state.dragging,ended:replay.state.ended||replay.state.endHold!==null,seed});
 m.dataSignals=dataSonification.frame(m,{playing:playing&&ctx?.state==='running',seeking:replay.state.dragging,ended:replay.state.ended||replay.state.endHold!==null,clock:ctx?.currentTime??0});
 dataVisual.frame(m,{playing,seed,clock:replay.state.active?(replay.state.cursor-(replay.state.frozen?.bars?.[0]?.time??0))/1000:null,rate:replay.state.active?(replay.state.speed==='candle'?(replay.state.frozen?.interval??chart.interval)/1000:Number(replay.state.speed)||1):1,seeking:replay.state.dragging,ended:replay.state.ended||replay.state.endHold!==null,position:replay.state.active?(replay.state.cursor-(replay.state.frozen?.bars?.[0]?.time??chart.renderedBars?.[0]?.time??0))/Math.max(1000,replay.state.frozen?.interval??chart.interval):null});
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
 if(market&&m.snapshotAge>20000)$('signal-source').textContent+=' Snapshot age '+Math.round(m.snapshotAge/1000)+'s · liquidity held at last value'+(m.decoded&&['swap','rpc-poll','exchange'].includes(streamKind)?'; native USD values use the last quote conversion.':'.');
 const c=m.context;
 $('market-pressure').textContent=Math.round(m.pressure*100)+'%';
 $('market-baseline').textContent=c.ratio?c.ratio.toFixed(2)+'× typical loaded price':'History context pending';
 $('market-pace').textContent=c.winningWindow?c.winningWindow+' move · '+Math.round(c.pace*100)+'% pace':'No significant measured move';
 $('market-cap-context').textContent=c.latestCap?cash(c.latestCap)+(m.replay?.source==='candles'?' estimated historical cap':c.capEstimated?' estimated latest cap':' snapshot market cap')+(c.impliedBaselineCap?' · typical '+cash(c.impliedBaselineCap)+' (price-based estimate)':''):'Market cap unavailable';
 $('market-context-note').textContent=m.replay?$('replay-info').textContent:!market?'Loading the highest-ranked trending market':c.historyAvailable?'Fixed 5-minute market history + latest received price. Typical cap is inferred from price using snapshot supply, not observed historical market cap. Recent moves cool over time; chart zoom and pan do not affect sound.':'Loading fixed historical context · latest observations and available provider changes drive the orchestra.';
 updateSignalMap(m);
 updateReplayUI(m);
}
function setupStream(){
 const key=market?.chainId+':'+market?.pairAddress;if(key===streamPool)return;
 stopStream?.();streamPool=key;streamConnected=false;poolEvents=[];
 const gen=generation;
 let stopNative,stopFallback,nativeState={connected:false,kind:'snapshot',message:''},fallbackState={connected:false,kind:'snapshot',message:''};
 const signatures={rpc:new Set(),gecko:new Set(),ccxt:new Set()},tradeIds=new Set();
 const publish=()=>{
  const chosen=nativeState.connected&&['swap','rpc-poll','exchange'].includes(nativeState.kind)?nativeState:fallbackState.connected&&fallbackState.kind==='trade-poll'?fallbackState:nativeState.connected&&nativeState.kind==='pool'?nativeState:fallbackState.message?fallbackState:nativeState;
  streamConnected=chosen.connected;streamKind=chosen.kind;$('feed').textContent=chosen.message+(chosen!==nativeState&&nativeState.message?' · direct route: '+nativeState.message:'');display();
 };
 const startFallback=()=>{if(stopFallback)return;stopFallback=pollPoolTrades(market,receive,s=>{if(gen!==generation)return;fallbackState=s;publish();});};
 const receive=e=>{
  if(gen!==generation)return;
  if(e.kind==='market-price'){
   const quoteUsd=Number(market.priceUsd)/Number(market.priceNative),priceUsd=e.priceQuote*quoteUsd;
   if(priceUsd>0&&Number.isFinite(priceUsd)){const previous=lastChainPrice?.priceUsd??currentPrice();if(!replay.state.active&&previous>0&&Math.abs(priceUsd/previous-1)>1e-9){dataVisual.event({...e,priceUsd});touchDesigner.event({kind:'pool-state'});}lastChainPrice={...e,priceUsd};chart.add({at:e.occurredAt||e.receivedAt,price:priceUsd,source:'rpc-state'});$('chart-source').textContent='Direct Robinhood RPC pool state · refreshed during quiet periods · USD quote conversion uses snapshots';display();}
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
   tradeEvents.push(e);lastTrade=e;receivedTradeCount++;const live=liveMetrics();e.music=live.music;
   if(!replay.state.active){dataSonification.frame(live,{playing:playing&&ctx?.state==='running',clock:ctx?.currentTime??0});dataSonification.event(e,{playing:playing&&ctx?.state==='running',replay:false,clock:ctx?.currentTime??0});dataVisual.event(e);touchDesigner.event(e);}
   pianoHistory.push({...e,at:e.receivedAt});if(pianoHistory.length>20000)pianoHistory.shift();
   if((playing||starting)&&!replay.state.active){
    if(playing&&piano?.trade(e,live.context?.latestCap,{...e.music,tonic:marketRoot(live)})){pendingPianoTrade=null;audioStatus();}
    else if(pianoEnabled&&(!piano||starting||ctx?.state!=='running'))pendingPianoTrade=e;
   }
   if(e.priceUsd)chart.add({at:Number.isFinite(e.occurredAt)?e.occurredAt:e.receivedAt,price:e.priceUsd,volume:e.usdVolume,id:e.id,source:'swap'});
   $('chart-source').textContent=source==='ccxt'?market.exchangeName+' · public WebSocket trades · '+(market.quoteApproximate?market.quoteToken.symbol+' prices used as a USD proxy':'USD trade prices')+' · history volume estimated from base volume':source==='rpc'?(e.protocol==='orca'?'Orca post-swap spot prices · confirmed WebSocket events · USD uses snapshot SOL/quote conversion':e.protocol==='v4'?'Direct Uniswap v4 post-swap prices · RPC polling ≥2s · USD quote conversion uses snapshots':'Streamed swap execution prices · USD estimated using latest quote conversion'):'Observed trade prices · GeckoTerminal / ≥8s polling · upstream cached · provider USD values';
   $('last-event').textContent=e.side.toUpperCase()+(source==='ccxt'?' · '+market.exchangeName:' · block '+e.block);display();
  }else{poolEvents.push(e);if(!replay.state.active){dataVisual.event(e);touchDesigner.event(e);}if(streamKind==='pool')$('last-event').textContent='Pool event · slot '+e.slot;}
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
function musicalFrame(m){const intensity=m.music?.intensity||0,score=m.replay?replay.state.score?.frames.get(replay.state.bar?.time):null;return {...m,replay:m.replay?{...m.replay,scoreIndex:score?.index,sceneSeed:score?.sceneSeed}:undefined,activity:intensity,motion:intensity,volume:intensity,pressure:intensity};}
function replayPiano(m){
 if(!playing||replay.state.dragging||!piano)return;
 const cursor=replay.state.cursor,bars=replay.state.frozen?.bars||chart.renderedBars,interval=replay.state.frozen?.interval||chart.interval;
 const due=!replayPianoPrimed?[replay.state.bar].filter(Boolean):bars.filter(bar=>candleEnd(bar,interval)>(pianoReplayCursor??cursor)&&candleEnd(bar,interval)<=cursor);
 for(const bar of due){
  // Completed candles are observations for the selection policy, not an
  // instruction to play. Large seeks reset without firing a note backlog.
  const frame=scoreCandle(bars,replay.state.frozen?.market||market,interval,bar);
  const score=replay.state.score?.frames.get(bar.time);
  const event={id:'candle:'+interval+':'+bar.time,at:candleEnd(bar,interval),priceUsd:bar.close,referencePrice:bar.open,historical:true,volume:bar.volume,chordStep:score?.index??Math.floor(bar.time/interval),music:frame.music};
  piano.replay(event,score?.selection,frame.context?.latestCap,{...frame.music,tonic:marketRoot({...frame,replay:{price:bar.close,at:bar.time}})});
  // Selection can legitimately be silent. Consume each candle exactly once.
  replayPianoPrimed=true;
 }
 pianoReplayCursor=cursor;
}
let instrumentWasAudible=false;
function otherInstrumentsAudible(){
 if(!playing||ctx?.state!=='running'){instrumentWasAudible=false;return false;}
 let power=0,count=0;
 for(const bus of audioScopes)for(const meter of bus.channels){
  meter.musicSamples??=new Float32Array(meter.fftSize);
  meter.getFloatTimeDomainData(meter.musicSamples);
  for(const sample of meter.musicSamples){power+=sample*sample;count++;}
 }
 const rms=count?Math.sqrt(power/count):0;
 instrumentWasAudible=rms>(instrumentWasAudible?.0002:.0005);return instrumentWasAudible;
}

function tick(){
 const m=metrics(),music=musicalFrame(m),energy=music.volume*m.fresh;
 const audible=otherInstrumentsAudible();

 if(audible&&!replay.state.active)void arpeggioAI.prepare();


 syncLevels(m);envion.market(music,orchestraTempo(m));
 bpm=orchestraTempo(m);$('tempo').textContent=bpm+' BPM · '+Math.round((m.music?.intensity||0)*100)+'% INTENSITY';
 if(replay.state.active)replayPiano(m);else{pianoReplayCursor=null;replayPianoPrimed=false;}
 const historical=replay.state.active,bar=replay.state.bar;
 piano?.frame({...m,music:{...m.music,tonic:marketRoot(m)}},{playing,seeking:replay.state.dragging,ended:replay.state.ended,at:historical?replay.state.cursor:Date.now(),price:historical?bar?.close:currentPrice(),referencePrice:historical?bar?.open:undefined,known:historical?bar?.volume===0:m.decoded&&['swap','rpc-poll','exchange'].includes(streamKind)&&m.fresh>0,quiet:historical?bar?.volume===0:true});
 send('tempo',bpm);send('activity',music.activity);send('motion',music.motion);send('energy',energy);
 send('balance',m.balance);send('texture',m.texture);send('heartbeat',1);send('tonic',marketRoot(m));send('cutoff',900+m.texture*3100+energy*1800);
}
// Browser updates market controls; the Pd worklet schedules musical events.
function loop(){if(!playing)return;tick();if(playing)timer=setTimeout(loop,150);}
function mathLoop(){
 if(document.hidden&&!playing){setTimeout(mathLoop,1000);return;}
 const active=playing&&!replay.state.dragging&&!replay.state.ended&&replay.state.endHold===null&&(!ctx||ctx.state==='running');
 const frozen=replay.state.frozen,interval=frozen?.interval||chart.interval;
 const rate=replay.state.speed==='candle'?interval/1000:Number(replay.state.speed)||1;
 const position=replay.state.active?(replay.state.cursor-candleEnd((frozen?.bars||chart.renderedBars)[0]||{time:replay.state.cursor},interval))/rate/1000:undefined;
 const event=replay.state.active?replay.state.bar?.time:lastTrade?.id??lastChainPrice?.receivedAt??null;
 mathPatterns.frame(mathMarket||{},{playing:active,seeking:replay.state.dragging,ended:replay.state.ended,ready:!!pd&&!audioErrors.pd,error:audioErrors.pd,event,position,scoreIndex:replay.state.active?replay.state.score?.frames.get(replay.state.bar?.time)?.index:null,frameSeconds:replay.state.active?Math.max(0,(replay.state.cursor-candleEnd(replay.state.bar||{time:replay.state.cursor},interval))/rate/1000):null,clock:ctx?.currentTime??performance.now()/1000});
 setTimeout(mathLoop,playing?33:250);
}
mathLoop();
async function initialize(){
 if($('audio-output').value==='native'){pd=await createNativePd(e=>{status(e.message+' · press Pause and reconnect');},state=>{engineView.setTransport(state);});for(const id of controls)send(id,Number($(id).value));bindSignalMap();return;}
 if(audioContext().state!=='running'){const error=Error('Audio is interrupted · tap Listen again');error.name='AudioUnlockError';throw error;}
 if(!gain){
  gain=ctx.createGain();gain.gain.value=0;
  const analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.minDecibels=-85;analyser.maxDecibels=-15;analyser.smoothingTimeConstant=.65;
  const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=0;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.12;
  gain.connect(limiter);limiter.connect(analyser);
  listeningGain=ctx.createGain();listeningGain.gain.value=Number($('master').value);
  const recordTap=ctx.createAnalyser();recordTap.fftSize=2048;
  analyser.connect(listeningGain);listeningGain.connect(recordTap);recordTap.connect(ctx.destination);outputTap=recordTap;
  // Measure engine output BEFORE listening volume: a mono downmix can cancel a wide
  // piano/reverb signal. This sidechain does not change listening or recording.
  const splitter=ctx.createChannelSplitter(2);limiter.connect(splitter);
  outputMeters=[0,1].map(channel=>{const meter=ctx.createAnalyser();meter.fftSize=2048;splitter.connect(meter,channel);return meter;});
  // Piano and Pd share the instrument-analysis tap.
  instrumentTap=ctx.createAnalyser();instrumentTap.fftSize=2048;instrumentSamples=new Float32Array(instrumentTap.fftSize);instrumentTap.connect(gain);
  function scope(name,out){const input=ctx.createGain();input.connect(out);const split=ctx.createChannelSplitter(2);input.connect(split);const channels=[0,1].map(channel=>{const meter=ctx.createAnalyser();meter.fftSize=2048;split.connect(meter,channel);return meter;});audioScopes.push({name,input,channels});return input;}
  scope('EarthBound',instrumentTap);scope('Pure Data',instrumentTap);

 }
 const epoch=audioEpoch,context=ctx,destination=instrumentTap;
 if(!piano&&!pianoLoading){
  audioErrors.piano='';
  pianoLoading=createTradePiano(context,audioScopes[0]?.input||destination,{onVoice:event=>{if(epoch===audioEpoch){sharedHarmony=event.harmony;pianoChordCount++;if(event.time!=null)dataVisual.piano(event.time,1);}},onArpeggio:event=>{if(epoch===audioEpoch&&event.time!=null)dataVisual.piano(event.time,.65);}}).then(instrument=>{
   if(epoch!==audioEpoch){instrument.close();throw Error('Audio loading cancelled');}
   piano=instrument;piano.setArpeggioPattern(arpeggioAI.snapshot());piano.setEnabled(pianoEnabled);piano.setMaster(1);piano.reset(seed);piano.resonance(liveMetrics().context?.latestCap);piano.setRunning(playing);
   if(playing){flushPianoTrade();if(replay.state.active)tick();}audioStatus();return piano;
  }).catch(error=>{if(epoch===audioEpoch){audioErrors.piano=error.message;engineView.log('Piano: '+error.message);audioStatus();}throw error;}).finally(()=>{if(epoch===audioEpoch)pianoLoading=null;});
 }
 if(!pd&&!pdLoading){
  audioErrors.pd='';audioErrors.envion='';
  pdLoading=(async()=>{
   const [orchestra,envionFiles]=await Promise.all([(async()=>{
    const response=await fetch('patches/orchestra/manifest.json?v=187');if(!response.ok)throw Error('Cannot load orchestra manifest');
    const manifest=await response.json();
    const files=Object.fromEntries(await Promise.all(manifest.files.map(async name=>{const path='orchestra/'+name,r=await fetch('patches/'+path+'?v=187');if(!r.ok)throw Error('Cannot load '+name);return [path,await r.text()];})));
    return {manifest,files};
   })(),envion.files()]);
   if(epoch!==audioEpoch)throw Error('Audio loading cancelled');
   const {manifest,files}=orchestra;Object.assign(files,envionFiles);
   const runtime=await createPd({audioContext:context,packages:['vanilla','cyclone','else'],files,entry:'orchestra/'+manifest.entry,workletUrl:'vendor/libpd-worklet-full.js?v=114',onPrint:text=>{if(epoch===audioEpoch&&!envion.printed(text)){console.log('[Pd]',text);engineView.log(text);}},onError:error=>{if(epoch===audioEpoch){audioErrors.pd=error.message;engineView.log(error.message);audioStatus();}}});
   if(epoch!==audioEpoch){await runtime.close();throw Error('Audio loading cancelled');}
   pd=runtime;replayPhrase=null;runtime.connect(audioScopes[1]?.input||destination);engineView.setFiles(files,manifest,true);bindSignalMap();
   send('seed',seed%16777216);send('master',playing?engineMaster():0);if(playing)tick();send('run',playing?1:0);
   // Math and beat voices can start as soon as Pd is ready. Envion's sample
   // handshake has its own outcome and cannot close the other instruments.
   envionLoading=envion.attach(runtime,context,files).then(attached=>{if(epoch!==audioEpoch||!attached)return;envion.setSeed(replayPhrase==null?seed:hash(seed+':'+replayPhrase));envion.setRunning(playing);if(playing)tick();audioStatus();}).catch(error=>{if(epoch===audioEpoch){send('av-envion-ready',0);envion.detach();audioErrors.envion=error.message;engineView.log('Envion: '+error.message);audioStatus();}});
   audioStatus();return runtime;
  })().catch(error=>{if(epoch===audioEpoch){audioErrors.pd=error.message;engineView.log('Pd: '+error.message);audioStatus();}throw error;}).finally(()=>{if(epoch===audioEpoch)pdLoading=null;});
 }
 // Start with whichever instrument is ready first. Promise.any observes both
 // failures, so a later Pd rejection does not become an unhandled rejection.
 try{await Promise.any([piano||pianoLoading,pd||pdLoading].filter(Boolean));}
 catch{throw Error([audioErrors.piano,audioErrors.pd].filter(Boolean).join(' · ')||'No audio instrument could load');}
}
async function closeAudio(){
 clearTimeout(idleAudioTimer);
 arpeggioAI.close();stopLegacyPlayback();audioEpoch++;pianoLoading=null;pdLoading=null;pendingPianoTrade=null;
 piano?.close();piano=null;envion.detach();const runtime=pd,context=ctx;pd=null;ctx=null;gain=null;listeningGain=null;outputGateOpen=null;outputTap=null;outputMeters=null;instrumentTap=null;instrumentSamples=null;audioScopes=[];
 for(const name of Object.keys(audioErrors))audioErrors[name]='';
 if(runtime)await runtime.close();await context?.close();
}
function setPlayState(active){
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
 if(playing){if(replay.state.active){replay.advance(chart.renderedBars,chart.interval,true);replay.metrics(chart.renderedBars,market,chart.interval);}playing=false;stopLegacyPlayback();arpeggioAI.suspend();mathPatterns.stop();dataSonification.reset(seed);pendingPianoTrade=null;piano?.setRunning(false);send('run',0);envion.setRunning(false);clearTimeout(timer);if(gain)gain.gain.setTargetAtTime(0,ctx.currentTime,.025);send('master',0);pd?.flush?.();$('audio-output').disabled=false;setPlayState(false);void takeShare.finish();idleAudioTimer=setTimeout(()=>{if(!playing&&!starting&&ctx?.state==='running')void ctx.suspend().catch(()=>{});},250);status(replay.state.active?'History replay paused':'Paused');updateReplayUI(replay.state.controls||{});return;}
 audioBusy(true);status('Loading sounds · playback starts as soon as an instrument is ready');
 try{await unlocked;if(!market)throw Error('Trending market is still loading.');if(!pd||!piano)await initialize();if(replay.state.active)await prepareReplayAudio();resetEnsemble({preserveVisual:!replay.state.active});if(ctx&&ctx.state!=='running'){const error=Error('Audio is interrupted · tap Listen again');error.name='AudioUnlockError';throw error;}if(gain)gain.gain.setTargetAtTime(1.5,ctx.currentTime,.04);send('master',engineMaster());$('audio-output').disabled=true;playing=true;piano?.setRunning(true);flushPianoTrade();replay.state.clock=performance.now();send('seed',seed%16777216);envion.setSeed(seed);loop();send('run',1);envion.setRunning(true);setPlayState(true);takeShare.start(ctx,outputTap);audioStatus();}
 catch(e){audioLoadFailed=true;playing=false;clearTimeout(timer);setPlayState(false);$('audio-output').disabled=false;status('Unable to start audio: '+e.message);if(e.name!=='AudioUnlockError')await closeAudio();}
 finally{audioBusy(false);}
};
$('native-option').disabled=true;
$('native-option').textContent='Native Pd · full Envion browser bridge required';
$('audio-output').onchange=async()=>{
 audioBusy(true);$('audio-output').disabled=true;
 try{await closeAudio();resetEnsemble();status($('audio-output').value==='native'?'Open patches/orchestra/av-desktop.pd · then Listen':'Piano ready');}
 catch(e){audioLoadFailed=true;status('Could not change audio output: '+e.message);}
 finally{audioBusy(false);$('audio-output').disabled=false;}
};
for(const id of controls)$(id).addEventListener('input',()=>{if($('audio-output').value==='native')send(id,playing?Number($(id).value):0);else if(listeningGain)listeningGain.gain.setTargetAtTime(Number($(id).value),ctx.currentTime,.025);session?.controls.push({at:Date.now(),name:id,value:Number($(id).value)});});
$('master').addEventListener('input',()=>{$('master-value').textContent=Math.round(Number($('master').value)*100)+'%';});
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
 $('mode').textContent=historical?(recorded?'HISTORY · RECORDED CONTROLS':'HISTORY · CANDLE ESTIMATES'):!market?'':streamConnected&&streamKind==='rpc-poll'?'DIRECT RPC · ≥2 SEC':streamConnected&&streamKind==='exchange'?'LIVE EXCHANGE'+(market.quoteApproximate?' · '+market.quoteToken.symbol+' ≈ USD':''):streamConnected&&streamKind==='swap'?'LIVE SWAPS':streamConnected&&streamKind==='trade-poll'?'CACHED TRADE POLLING':streamConnected&&streamKind==='pool'?'POOL ACTIVITY + SNAPSHOTS':'MARKET SNAPSHOTS';
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
 const liquidity=historical?historical.observation?.liquidity:exchangeMarket?(Date.now()-(market.exchangeBook?.at||0)<15000?market.exchangeBook?.depth:null):market?.liquidity?.usd;
 $('liquidity-label').textContent=exchangeMarket?'BOOK DEPTH · ±1%'+(market.dexId==='coinbaseexchange'?' / 5S':' / ≤25 LEVELS'):'LIQUIDITY';
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
 refreshMusicHistory();
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
 },{shouldFetch:shouldFetchHistory});
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
function applySnapshot(pair){
 market=isExchangeMarket(pair)?{...pair,exchangeBook:market?.pairAddress===pair.pairAddress?market.exchangeBook:null}:pair;lastSnapshot=Date.now();
 if(!(streamConnected&&['swap','trade-poll','rpc-poll','exchange'].includes(streamKind))){chart.add({at:Date.now(),price:Number(pair.priceUsd),source:'snapshot'});$('chart-source').textContent=isExchangeMarket(pair)?pair.exchangeName+' · exchange ticker snapshot; waiting for live trades':'Observed market snapshots · 5-second polling; provider data may be cached';}
 display();
 session?.snapshots.push({at:Date.now(),market:pair});
}
function chooseMarket(pair,{shared=false}={}){
 pendingHistoryReplay=false;
 void takeShare.finish();takeShare.reset();
 pendingPianoTrade=null;preloadPianoSamples().catch(error=>engineView.log('Piano preload: '+error.message));
 mathMarket=null;
 pianoHistory=[];pianoChordCount=0;piano?.reset();pianoReplayCursor=null;
 replay.setMarket(pair.chainId+':'+pair.pairAddress+':'+pair.baseToken.address);
 generation++;snapshotController?.abort();clearTimeout(poll);clearTimeout(musicHistoryTimer);stopMusicHistory?.();stopMusicHistory=null;imageController?.abort();imageToken='';stopStream?.();stopHistory?.();stopChartHistory?.();stopStream=null;streamPool='';streamConnected=false;streamKind='snapshot';poolEvents=[];tradeEvents=[];lastTrade=null;lastChainPrice=null;receivedTradeCount=0;historyContext=null;originDate=null;chart.reset();
 contextHistoryState=null;contextHistoryOperation=null;contextHistoryKey='';contextCandles=[];
 resetEnsemble();mode='live';market=pair;seed=hash(pair.chainId+':'+pair.baseToken.address);dataSonification.reset(seed);holderMetadata.setMarket(shared||isExchangeMarket(pair)?null:pair);mathSeed=hash(pair.chainId+':'+(/^0x[0-9a-f]{40}$/i.test(pair.baseToken.address)?pair.baseToken.address.toLowerCase():pair.baseToken.address));mathPatterns.setSeed(mathSeed);state=seed;step=0;send('seed',seed%16777216);envion.setSeed(seed);piano?.reset(seed);arpeggioAI.setSeed(seed);applySnapshot(pair);if(!shared){startHistory(pair);setupStream();loadCoinImage(pair);}if(playing)takeShare.start(ctx,outputTap);
 $('last-event').textContent=isExchangeMarket(pair)?'Waiting for exchange trades':'Waiting for pool events';
 session?.controls.push({at:Date.now(),name:'market',chain:pair.chainId,pool:pair.pairAddress});
 sharedMarket=shared;
 if(shared)return;
 const gen=generation,chain=pair.chainId,address=pair.pairAddress,token=pair.baseToken.address;
 if(isExchangeMarket(pair)){
  const refresh=async()=>{if(document.hidden&&!playing){if(gen===generation)poll=setTimeout(refresh,30000);return;}try{const updated=await prepareExchangeMarket(pair);if(gen!==generation)return;applySnapshot(updated);}catch(error){if(gen===generation)$('chart-source').textContent='Exchange snapshot delayed: '+error.message;}if(gen===generation)poll=setTimeout(refresh,30000);};
  poll=setTimeout(refresh,30000);status(playing?'Playing · exchange market':'Exchange market loaded · press Listen');return;
 }
 const refresh=async()=>{
  if(document.hidden&&!playing){if(gen===generation)poll=setTimeout(refresh,10000);return;}
  snapshotController=new AbortController();
  try{const data=await fetchJSON('https://api.dexscreener.com/latest/dex/pairs/'+encodeURIComponent(chain)+'/'+encodeURIComponent(address),{signal:snapshotController.signal});if(gen!==generation)return;
   const raw=(data.pairs||[]).find(p=>p.chainId===chain&&p.pairAddress===address);const updated=raw&&orientPair(raw,token);if(!updated)throw Error('Selected pool snapshot unavailable');applySnapshot(updated);
  }catch(e){if(gen===generation)$('chart-source').textContent='Snapshot delayed: '+e.message;}
  if(gen===generation)poll=setTimeout(refresh,streamConnected&&['swap','rpc-poll'].includes(streamKind)?15000:5000);
 };poll=setTimeout(refresh,5000);status(playing?'Playing · automatic market instrument':'Market loaded · press Listen');
}
const addressField=$('address').closest('.address-field');
const label=$('address-label');label.replaceChildren(...[...label.textContent].map((letter,index)=>{const span=document.createElement('span');span.textContent=letter;span.style.setProperty('--letter',index);return span;}));
function syncAddressLabel(){addressField.classList.toggle('has-value',!!$('address').value.trim());}
$('address').addEventListener('input',syncAddressLabel);
$('address').addEventListener('change',syncAddressLabel);
syncAddressLabel();
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
 searchController?.abort();
 searchRevision++;searchBusy(false);searchFeedback('');
 $('coin-search-results').hidden=true;$('address').setAttribute('aria-expanded','false');
});
$('coin-search-results').addEventListener('keydown',event=>{if(event.key==='Escape'){searchRevision++;searchBusy(false);searchFeedback('');}},true);
$('address').addEventListener('keydown',event=>{
 const results=$('coin-search-results');
 if(event.key==='ArrowDown'&&!results.hidden){const first=results.querySelector('button');if(first){event.preventDefault();first.focus();}}
 if(event.key==='Escape'){searchRevision++;searchBusy(false);results.hidden=true;$('address').setAttribute('aria-expanded','false');searchFeedback('');}
});
async function selectSearchMarket(pair,{autoPlay=false,revision=searchRevision}={}){
 try{
  searchFeedback('Opening '+pair.baseToken.symbol+'…','loading');
  if(isExchangeMarket(pair)){status('Loading '+pair.exchangeName+' market…');pair=await prepareExchangeMarket(pair);}
  if(revision!==searchRevision)return;
  $('address').value=pair.baseToken.address;syncAddressLabel();discovered=[pair];
  $('coin-search-results').hidden=true;$('address').setAttribute('aria-expanded','false');chooseMarket(pair);
  searchFeedback('');
  if(autoPlay&&!playing)await $('play').onclick();
 }catch(error){if(revision===searchRevision){status(error.message);searchFeedback(error.message,'error');}}
}
$('coin-form').onsubmit=async e=>{
 e.preventDefault();
 if($('address').value.trim().toLowerCase()==='pdata'){const show=$('envion').hidden;$('envion').hidden=!show;$('engine-view').hidden=!show;document.querySelector('.inspector-display').hidden=!show;document.body.classList.toggle('inspecting',show);$('address').value='';syncAddressLabel();status(show?'Pure Data view open':'Pure Data view hidden');return;}
 if(loading)return;
 const wantedNetwork=requestedNetwork,autoPlay=requestedAutoplay;requestedNetwork=null;requestedAutoplay=false;
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
    if(!exchangeOnly){const data=await fetchJSON('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(address),{signal:searchAbort.signal});dexPairs=rankCoinMatches(data.pairs||[],address,{orientPair,network:wantedNetwork});}
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
 return {version:1,engine:76,arpeggio:arpeggioAI.snapshot(),interval,seed,speed:replay.state.speed,market:{source:basis.source,exchangeId:basis.exchangeId,exchangeSymbol:basis.exchangeSymbol,exchangeName:basis.exchangeName,quoteApproximate:basis.quoteApproximate,chainId:basis.chainId,dexId:basis.dexId,pairAddress:basis.pairAddress,baseToken:{address:basis.baseToken.address,symbol:basis.baseToken.symbol,name:basis.baseToken.name||basis.baseToken.symbol},quoteToken:{address:basis.quoteToken.address,symbol:basis.quoteToken.symbol,name:basis.quoteToken.name||basis.quoteToken.symbol},priceUsd:basis.priceUsd,priceNative:basis.priceNative,marketCap:basis.marketCap},rows:rows.map(b=>[b.time,b.open,b.high,b.low,b.close,b.volume??null])};
}
const takeShare=createTakeShare({button:$('share'),dialog:$('share-dialog'),snapshot:shareSnapshot,onContinue:()=>{if(playing)takeShare.start(ctx,outputTap);}});
const rollDate=rollingText($('coin-date')),rollCap=rollingText($('coin-cap'));
let titleMovement={key:null,price:null,at:0,until:0,direction:''};
function updateCoinReadout(m){
 const title=$('coin-name'),key=(market?.baseToken?.address||'')+':'+replay.state.active;
 const price=Number(replay.state.active?m.replay?.price:currentPrice());
 const position=replay.state.active?replay.state.cursor:Date.now(),now=performance.now();
 if(key!==titleMovement.key||position<titleMovement.at){titleMovement={key,price:null,at:position,until:0,direction:''};}
 if(price>0&&Number.isFinite(price)){
  if(titleMovement.price>0&&price!==titleMovement.price){titleMovement.direction=price>titleMovement.price?'up':'down';titleMovement.until=now+1200;}
  titleMovement.price=price;
 }
 titleMovement.at=position;title.dataset.direction=now<titleMovement.until?titleMovement.direction:'';

 const at=replay.state.active?replay.state.cursor:Date.now(),date=new Date(at),cap=m.context?.latestCap;
 rollDate(date.toLocaleDateString(undefined,{day:'2-digit',month:'2-digit',year:'numeric'}),at);
 ui.clock({timestamp:at,rate:replay.state.active?Number(replay.state.speed)||1:1,replay:replay.state.active,seeking:replay.state.dragging,label:replay.state.active?'Playback time':'Local time'});
 rollCap(cap>0?'$'+Math.round(cap).toLocaleString('en'):'—',cap||0);
 $('coin-clock-label').textContent=replay.state.active?'REPLAY · DATE / TIME':'LIVE · DATE / TIME';
 $('coin-cap-label').textContent=replay.state.active?'MCAP · HISTORICAL ESTIMATE':m.context?.capEstimated?'MCAP · PRICE ESTIMATE':'MARKET CAP';
 const harmony=harmonyPlan(seed,m.music?.character);
 $('coin-character').textContent=harmony.name.toUpperCase();$('coin-progression').textContent=harmony.progression;
}
function restoreSharedScore(){
 try{
  const score=decodeScore(location.hash);if(!score)return false;
  chooseMarket(score.market,{shared:true});arpeggioAI.setSeed(seed,score.arpeggio||arpeggioAI.snapshot());setHistoryLoading({candles:score.rows,state:"pool-start"});const bars=score.rows.map(([time,open,high,low,close,volume])=>({time,open,high,low,close,volume,volumeEstimated:isExchangeMarket(score.market),observedThrough:time+score.interval}));
  chart.setHistory(bars,score.interval,bars[0].time);chart.draw();replay.freeze(bars,score.market,score.interval);replay.state.score=buildReplayScore(bars,seed,score.interval);replay.state.speed=['1','10','20','100'].includes(String(score.speed))?String(score.speed):'1';updateSpeedButtons();
  replay.seek(bars[0],score.interval);chart.schedule();syncLevels(metrics());$('share').disabled=false;status('Shared candle score · press Listen');return true;
 }catch(error){status('Cannot open shared score: '+error.message);return false;}
}
display();
if(!restoreSharedScore())startTrending((item,options={})=>{
 if(options.initial&&(loading||searchRevision>0||market))return;
 searchRevision++;searchBusy(false);searchFeedback('');
 // Resume in the coin click itself: market discovery completes asynchronously.
 // The unlocked context stays silent until Listen opens the selected coin engine.
 if(!playing)primeAudio();
 requestedNetwork=item.chain;requestedAutoplay=options.autoplay??true;
 if(item.image)tokenImages.set(imageKey({chainId:item.chain,baseToken:{address:item.address}}),item.image);
 $('address').value=item.address;syncAddressLabel();$('coin-form').requestSubmit();
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
   else{mathPatterns.stop();$('play').dataset.playing='false';$('play').setAttribute('aria-pressed','false');$('play').textContent='Resume';$('play').setAttribute('aria-label','Resume interrupted audio');}
   audioStatus();
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
 if(!replay.state.active){arpeggioAI.freezeScore();resetEnsemble();replay.freeze(chart.renderedBars,market,chart.interval);replay.state.score=buildReplayScore(replay.state.frozen.bars,seed,chart.interval);}
 replayPianoPrimed=false;replayPhrase=null;mathPatterns.reset();dataSonification.reset(seed);dataVisual.reset();
 replay.seek(bar,chart.interval,dragging);chart.schedule();
 piano?.reset(seed);sharedHarmony=null;pianoReplayCursor=replay.state.cursor;
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
$('replay-live').onclick=()=>{
 pendingHistoryReplay=false;
 replay.live();arpeggioAI.setSeed(seed);resetEnsemble();chart.tickView?.live();chart.goLive();$('chart-range').value='live';display();
 session?.controls.push({at:Date.now(),name:'history-live'});
 if(playing)tick();else{const m=metrics();
 syncLevels(m);envion.market(musicalFrame(m),orchestraTempo(m));}
 status(playing?'Piano ready · waiting for trades':'Live market · press Listen');
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
$('chart-timeframe').onchange=()=>{if(replay.state.active)$('replay-live').onclick();loadChartTimeframe();};
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
