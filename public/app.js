import {createMusicContext,unlockPlayback,stopLegacyPlayback} from './audio-unlock.js?v=55';
import {isTokenIdentifier,rankCoinMatches,showCoinMatches} from './coin-search.js?v=65';
import {rollingText} from './coin-readout.js?v=53';
import {createTakeShare,decodeScore} from './take-share.js?v=65';
import {harmonyPlan} from './music-context.js?v=53';
import {createEnvion} from './envion.js?v=53';
import {createEngineView} from './engine-view.js?v=65';
import {createCoinDither} from './coin-dither.js?v=68';
import {createUpicBrand} from './upic-brand.js?v=68';
import {createTransportIndicator} from './transport-indicator.js?v=61';
import {PIANO_MOVE_PCT} from './piano-policy.js?v=61';
import {createAudioDots} from './audio-dots.js?v=65';
import {createHolderMetadata} from './holder-metadata.js?v=60';
import {createDataSonification} from './data-sonification.js?v=65';
import {createArpeggioAI,createCoinVoice} from './ai-instruments.js?v=65';
import {createTradePiano,marketResonance,preloadPianoSamples} from './trade-piano.js?v=65';
import {createMathPatterns,mathIdentity,MATH_SLOT_COUNT} from './math-patterns.js?v=53';
import {createMathPatternView} from './math-pattern-view.js?v=53';
import {contextualizeMarket} from './market-state.js?v=53';
import {createMarketReplay,candleEnd,scoreCandle} from './market-replay.js?v=53';
import {signalFreshness} from './market-controls.js?v=18';
import {createOrchestraConductor,ORCHESTRA_LAYERS,orchestraTempo} from './orchestra.js?v=53';
import {createNativePd} from './native-pd.js?v=18';
import {createPd} from './vendor/libpd-wasm.js?v=30';
import {subscribePool} from './realtime.js?v=4';
import {subscribeEvm} from './evm.js?v=39';
import {subscribeOrca} from './orca.js?v=39';
import {subscribeRobinhoodV4} from './v4.js?v=1';
import {fetchGecko} from './gecko.js?v=39';
import {startTrending} from './trending.js?v=69';
import {MarketChart} from './chart.js?v=65';
import {loadHistory} from './history.js?v=39';
import {pollPoolTrades} from './trades.js?v=39';
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let pd,ctx,gain,outputTap,instrumentTap,instrumentSamples,playing=false,starting=false,poll,market=null,mode='loading',generation=0,loading=false;
let requestedNetwork=null,requestedAutoplay=false;
let seed=1917,state=1917,step=0,timer,next=0,bpm=120,session=null;
const controls=['master'];
let stopStream,streamConnected=false,poolEvents=[],lastSnapshot=0,streamPool='';
let streamKind='snapshot',tradeEvents=[],lastTrade=null,lastChainPrice=null,discovered=[],lastExcitation=0;
let piano=null,pianoEnabled=true,pianoHistory=[],pianoReplayCursor=null,pianoChordCount=0;
let audioEpoch=0,pianoLoading=null,pdLoading=null,pendingPianoTrade=null;
const audioErrors={piano:'',pd:'',envion:''};
let mathMarket=null,mathSeed=seed,replayPianoPrimed=false,replayPhrase=null;
let receivedTradeCount=0;
let stopMusicHistory,musicHistoryTimer,musicalCandles=[],musicalInterval=300000;
let stopHistory,stopChartHistory,historyContext=null,originDate=null,contextCandles=[],contextInterval=60000,chartRequest=0;
const chart=new MarketChart($('market-chart'));
const replay=createMarketReplay();
createUpicBrand($('upic-mark'),$('upic-mark-fallback'));
const transportIndicator=createTransportIndicator($('transport-status'));
const coinDither=createCoinDither($('coin-image'),$('coin-image-fallback'));
const arpeggioAI=createArpeggioAI({onStatus:text=>$('arp-ai-status').textContent=text,onPattern:pattern=>piano?.setArpeggioPattern(pattern)});
const coinVoice=createCoinVoice({onStatus:text=>$('voice-ai-status').textContent=text});
const dataVisual=createAudioDots($('audio-dots'),{getAudio:()=>outputTap,getState:()=>({playing})});
const dataSonification=createDataSonification({send,event});
const holderMetadata=createHolderMetadata({onInfo:(info,pair)=>{
 if(info?.image_url){tokenImages.set(imageKey(pair),info.image_url);if(market&&imageKey(market)===imageKey(pair))displayCoinImage();}
}});
$('ai-retry').onclick=()=>{arpeggioAI.retry();coinVoice.retry();};
chart.bindReplay(()=>replay.state,()=>playing);
let coinImageURL='',imageController,imageToken='';const tokenImages=new Map();
const imageKey=pair=>pair.chainId+':'+(/^0x/i.test(pair.baseToken.address)?pair.baseToken.address.toLowerCase():pair.baseToken.address);
async function loadCoinImage(pair){
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
 $('coin-image-fallback').textContent=(token?.symbol||'AV').slice(0,2).toUpperCase();
 const candidates=market?[market,...discovered.filter(p=>p.chainId===market.chainId&&sameToken(p.baseToken?.address,token.address))]:[];
 const image=candidates.find(p=>p.historyTokenSide!=='quote'&&p.info?.imageUrl)?.info?.imageUrl;
 let url='';try{const parsed=new URL(token?.imageUrl||image||(market&&tokenImages.get(imageKey(market))));if(parsed.protocol==='https:')url=parsed.href;}catch{}
 if(url===coinImageURL)return;coinImageURL=url;
 coinDither.set(url);
}
const conductor=createOrchestraConductor();
const mathView=createMathPatternView($('math-functions'),{onToggle:(slot,enabled)=>{mathPatterns.setSlot(slot,enabled);session?.controls.push({at:Date.now(),name:'math-slot',slot,enabled});}});
const mathPatterns=createMathPatterns({send,onView:view=>mathView.update(view)});
mathPatterns.setSeed(mathSeed);
const levels=Object.fromEntries(ORCHESTRA_LAYERS.map(name=>[name,0]));
let orchestraState={state:'SPARSE',phrase:0,parameters:{}};

const engineView=createEngineView($('engine-view'),{onBundle:(name,enabled)=>{if(name==='data'){dataSonification.setEnabled(enabled);}else if(name==='math'){mathPatterns.setEnabled(enabled);}else if(name==='piano'){pianoEnabled=enabled;piano?.setEnabled(enabled);}else if(name==='voice'){coinVoice.setEnabled(enabled);}else conductor.setBundle(name,enabled);if(market)syncLevels(metrics());}});
const envion=createEnvion($('envion'),{onTransport:command=>{if((command==='start'&&!playing)||(command==='stop'&&playing))$('play').click();}});
function resetEnsemble(){dataVisual.reset();coinVoice.reset();dataSonification.reset(seed);replayPianoPrimed=false;replayPhrase=null;conductor.reset();mathPatterns.reset();piano?.reset(seed);pianoReplayCursor=replay.state.active?replay.state.cursor:null;for(const name of Object.keys(levels))levels[name]=0;engineView.reset();}
function updateSignalMap(m){const view={m,levels,orchestra:orchestraState,bpm:orchestraTempo(m),pianoChordCount,resonance:marketResonance(m.context?.latestCap),root:marketRoot(m),master:Number($('master').value),playing,native:$('audio-output').value==='native'};engineView.update({...view,coin:market?.baseToken?.symbol,feed:m.replay?'History · '+m.replay.source:market?streamKind:'loading',liquidity:m.replay?m.observation?.liquidity:market?.liquidity?.usd});}
function bindSignalMap(){pd.subscribe?.('data-onset',message=>{dataVisual.pulse(Number(message.values?.[0]),ctx?.currentTime??0);engineView.receive('data-onset',Number(message.values?.[0])||0);});for(const name of ['generation','av-envion-voice','av-output-left','av-output-right'])pd.subscribe?.(name,message=>{const value=Number(message.values[0]);conductor.observe(name,value);engineView.receive(name,value);});for(let slot=0;slot<MATH_SLOT_COUNT;slot++)pd.subscribe?.(`math-${slot}-meter`,message=>mathView.receive(slot,Number(message.values[0])));}
const scale=[0,2,3,5,7,9,10];
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const rand=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
const status=s=>$('status').textContent=s;
function audioStatus(){
 if(!playing)return;
 if(ctx&&ctx.state!=='running'){status('Audio interrupted · tap Resume');return;}
 const parts=[audioErrors.piano?'Piano unavailable: '+audioErrors.piano:!piano?'Loading piano…':replay.state.active?'Piano · selective candle score':'Piano · ≥'+PIANO_MOVE_PCT+'% moves / quiet single notes'];
 if(audioErrors.pd)parts.push('Pd unavailable: '+audioErrors.pd);
 else if(!pd)parts.push('Loading Pd…');
 if(audioErrors.envion)parts.push('Envion unavailable: '+audioErrors.envion);
 status(parts.join(' · '));
}
function flushPianoTrade(){
 if(!piano||!playing||ctx?.state!=='running')return;
 const trade=pendingPianoTrade;pendingPianoTrade=null;
 // Only a real, recently received event can survive the loading boundary.
 // Do not replay a stale backlog or turn snapshots into invented trades.
 if(trade&&playing&&!replay.state.active&&Date.now()-trade.receivedAt<3000)piano?.trade(trade,liveMetrics().context?.latestCap,trade.music);
}
function currentPrice(){if(streamConnected&&['swap','trade-poll','rpc-poll'].includes(streamKind)){if((lastChainPrice?.receivedAt||0)>(lastTrade?.receivedAt||0))return Number(lastChainPrice.priceUsd);if(lastTrade?.priceUsd)return Number(lastTrade.priceUsd);}return Number(market?.priceUsd);}
function marketRoot(m){
 const historical=m?.replay;
 const current=historical?historical.price:currentPrice();
 const anchor=historical?(replay.state.frozen?.bars||chart.renderedBars).find(bar=>bar.time<=historical.at)?.open:historyContext?.first?.open;
 const offset=current>0&&anchor>0?Math.round(12*Math.tanh(Math.log(current/anchor))):0;return 45+seed%12+offset;
}
function send(name,value){if(pd){pd.sendFloat(name,value);engineView.sent(name,value);}}
function event(name){pd?.sendBang(name);}
function liveMetrics(){
 if(!market)return contextualizeMarket({motion:0,activity:0,balance:.5,texture:0,volume:0,fresh:0,snapshotFresh:0,snapshotAge:Infinity},{price:0,history:[],interval:1000});
 const tx=market.txns?.m5||{};const total=(tx.buys||0)+(tx.sells||0);
 tradeEvents=tradeEvents.filter(e=>Date.now()-e.receivedAt<30000);
 poolEvents=poolEvents.filter(e=>Date.now()-e.receivedAt<10000);
 const decoded=streamConnected&&['swap','trade-poll','rpc-poll'].includes(streamKind);
 const first=tradeEvents[0],last=tradeEvents.at(-1),movement=first&&last?Math.abs((last.priceQuote/first.priceQuote-1)*100):0;
 const buys=tradeEvents.filter(e=>e.side==='buy').length;
 const observedVolume=tradeEvents.reduce((sum,e)=>sum+(e.usdVolume||0),0);
 const rate=decoded?tradeEvents.length/30:streamConnected&&streamKind==='pool'?poolEvents.length/10:total/300;
 const volumeRate=decoded?observedVolume/30:(Number(market.volume?.m5)||0)/300;
 const raw={tradeRate:decoded?tradeEvents.length/30:0,motion:clamp((decoded?movement:Math.abs(Number(market.priceChange?.m5)||0))/8,0,1),activity:clamp(Math.log1p(rate)/Math.log(21),0,1),balance:decoded?(tradeEvents.length?buys/tradeEvents.length:.5):(total?(tx.buys||0)/total:.5),texture:clamp(Math.log10(Math.max(1,market.liquidity?.usd||1))/7,0,1),volume:clamp(Math.log1p(volumeRate)/Math.log(10001),0,1),...signalFreshness(decoded,lastSnapshot),decoded,observedVolume};
 return {...contextualizeMarket(raw,{price:currentPrice(),marketCap:Number(market.marketCap),snapshotPrice:Number(market.priceUsd),history:musicalCandles,interval:musicalInterval,changes:market.priceChange||{},liquidity:Number(market.liquidity?.usd),volumeRate,observedAt:Math.max(lastSnapshot,lastTrade?.receivedAt||0,lastChainPrice?.receivedAt||0)}),availability:{balance:decoded?tradeEvents.length>0:total>0,liquidity:market.liquidity?.usd!=null&&Number.isFinite(Number(market.liquidity.usd)),volume:decoded||market.volume?.m5!=null},audience:holderMetadata.snapshot()};
}
function metrics(){
 const live=liveMetrics();live.observation={liquidity:market?.liquidity?.usd,trades:market?.txns?.m5,change:market?.priceChange?.m5,volume:market?.volume?.m5};
 if(market)replay.record(live,currentPrice());
 const ended=replay.advance(chart.renderedBars||[],chart.interval,playing&&ctx?.state==='running');
 const historical=replay.metrics(chart.renderedBars||[],market,chart.interval);
 if(ended&&playing){$('play').onclick();status('History replay finished');}
 return historical||live;
}
function updateReplayUI(m){
 const active=replay.state.active,source=m.replay?.source;
 transportIndicator.render({playing,audioRunning:ctx?.state==='running',replay:active,seeking:replay.state.dragging,ended:replay.state.ended||replay.state.endHold!==null,streamConnected,streamKind,fresh:m.snapshotFresh??m.fresh??0});
 $('replay-live').disabled=!active;
 $('replay-play').disabled=!(chart.renderedBars?.length);
 $('replay-play').textContent=active&&playing?'Ⅱ Pause':replay.state.ended?'↻ Replay':'▶︎ Replay';
 const rate=replay.state.speed==='candle'?chart.interval/1000:Number(replay.state.speed);
 $('replay-state').textContent=active?'· '+rate+'×':'';
 $('replay-info').textContent=!active?'Piano plays a single note at ≥'+PIANO_MOVE_PCT+'% movement since its last note, or after 30 seconds without an observed trade.':'Selective candle score: ≥'+PIANO_MOVE_PCT+'% movement selects single piano notes. Zero-volume candles allow sparse quiet notes. OHLC is not a reconstruction of historical trades; historical cap uses frozen snapshot supply.';
 $('replay-state').title=$('replay-info').textContent;
 if(active&&replay.state.bar){chart.tickView?.setReplayTime(replay.state.bar.time);display();}
}
let outputGateOpen=null;
function syncLevels(m){
 const audibleTransport=playing&&!replay.state.dragging&&!replay.state.ended&&replay.state.endHold===null;
 if(gain&&outputGateOpen!==audibleTransport){outputGateOpen=audibleTransport;gain.gain.setTargetAtTime(audibleTransport?1.5:0,ctx.currentTime,.025);}
 mathMarket=m;updateCoinReadout(m);
 m.dataSignals=dataSonification.frame(m,{playing:playing&&ctx?.state==='running',seeking:replay.state.dragging,ended:replay.state.ended||replay.state.endHold!==null,clock:ctx?.currentTime??0});
 dataVisual.frame(m,{playing,seed,seeking:replay.state.dragging,ended:replay.state.ended,position:replay.state.active?(replay.state.cursor-(replay.state.frozen?.bars?.[0]?.time??chart.renderedBars?.[0]?.time??0))/Math.max(1000,replay.state.frozen?.interval??chart.interval):null});
 piano?.resonance(m.context?.latestCap);
 piano?.setTempo(m.music?.tempo);
 orchestraState=conductor.update(m,streamConnected);
 for(const name of Object.keys(levels)){levels[name]=orchestraState.levels[name];send(name,levels[name]);const meter=$(name),value=$(name+'-value');if(meter)meter.value=levels[name];if(value)value.textContent=Math.round(levels[name]*100)+'%';}
 for(const [name,value] of Object.entries(orchestraState.parameters))send(name,value);
 $('orchestra-state').textContent=orchestraState.state+' · PHRASE '+(orchestraState.phrase+1)+'/4';
 $('energy-value').textContent=Math.round(m.volume*m.fresh*100)+'%';
 $('volume').textContent=m.replay?cash(m.replay.volume):market?cash(m.decoded?m.observedVolume:market.volume?.m5):'—';
 $('volume-window').textContent=m.replay?'REPLAY USD VOLUME':m.decoded?'OBSERVED USD · LAST 30 SEC':'TRADED USD · 5 MIN';
 $('signal-source').textContent=m.decoded?'Price, activity, direction and volume: observed trades / 30 sec. '+(['swap','rpc-poll'].includes(streamKind)?'USD quote conversion and liquidity: snapshots.':'Trade USD values: provider; liquidity: snapshots.'):streamConnected&&streamKind==='pool'?'Activity: pool transactions / 10 sec. Price, volume and direction: 5-minute snapshots.':market?'Price, volume and activity: market snapshots / 5 min.':'Loading the highest-ranked trending market';
 if(market&&m.snapshotAge>20000)$('signal-source').textContent+=' Snapshot age '+Math.round(m.snapshotAge/1000)+'s · liquidity held at last value'+(m.decoded&&['swap','rpc-poll'].includes(streamKind)?'; native USD values use the last quote conversion.':'.');
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
 const signatures={rpc:new Set(),gecko:new Set()},tradeIds=new Set();
 const publish=()=>{
  const chosen=nativeState.connected&&['swap','rpc-poll'].includes(nativeState.kind)?nativeState:fallbackState.connected&&fallbackState.kind==='trade-poll'?fallbackState:nativeState.connected&&nativeState.kind==='pool'?nativeState:fallbackState.message?fallbackState:nativeState;
  streamConnected=chosen.connected;streamKind=chosen.kind;$('feed').textContent=chosen.message+(chosen!==nativeState&&nativeState.message?' · direct route: '+nativeState.message:'');display();
 };
 const startFallback=()=>{if(stopFallback)return;stopFallback=pollPoolTrades(market,receive,s=>{if(gen!==generation)return;fallbackState=s;publish();});};
 const receive=e=>{
  if(gen!==generation)return;
  if(e.kind==='market-price'){
   const quoteUsd=Number(market.priceUsd)/Number(market.priceNative),priceUsd=e.priceQuote*quoteUsd;
   if(priceUsd>0&&Number.isFinite(priceUsd)){const previous=lastChainPrice?.priceUsd??currentPrice();if(!replay.state.active&&previous>0&&Math.abs(priceUsd/previous-1)>1e-9)dataVisual.event({...e,priceUsd});lastChainPrice={...e,priceUsd};chart.add({at:e.occurredAt||e.receivedAt,price:priceUsd,source:'rpc-state'});$('chart-source').textContent='Direct Robinhood RPC pool state · refreshed during quiet periods · USD quote conversion uses snapshots';display();}
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
   if(!replay.state.active){dataSonification.frame(live,{playing:playing&&ctx?.state==='running',clock:ctx?.currentTime??0});dataSonification.event(e,{playing:playing&&ctx?.state==='running',replay:false,clock:ctx?.currentTime??0});dataVisual.event(e);}
   pianoHistory.push({...e,at:e.receivedAt});if(pianoHistory.length>20000)pianoHistory.shift();
   if((playing||starting)&&!replay.state.active){
    if(playing&&piano?.trade(e,liveMetrics().context?.latestCap,e.music)){pendingPianoTrade=null;audioStatus();}
    else if(pianoEnabled&&(!piano||starting||ctx?.state!=='running'))pendingPianoTrade=e;
   }
   if(e.priceUsd)chart.add({at:Number.isFinite(e.occurredAt)?e.occurredAt:e.receivedAt,price:e.priceUsd,volume:e.usdVolume,id:e.id,source:'swap'});
   $('chart-source').textContent=source==='rpc'?(e.protocol==='orca'?'Orca post-swap spot prices · confirmed WebSocket events · USD uses snapshot SOL/quote conversion':e.protocol==='v4'?'Direct Uniswap v4 post-swap prices · RPC polling ≥2s · USD quote conversion uses snapshots':'Streamed swap execution prices · USD estimated using latest quote conversion'):'Observed trade prices · GeckoTerminal / ≥8s polling · upstream cached · provider USD values';
   $('last-event').textContent=e.side.toUpperCase()+' · block '+e.block;display();
  }else{poolEvents.push(e);if(!replay.state.active)dataVisual.event(e);if(streamKind==='pool')$('last-event').textContent='Pool event · slot '+e.slot;}
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
function musicalFrame(m){const intensity=m.music?.intensity||0;return {...m,activity:intensity,motion:intensity,volume:intensity,pressure:intensity};}
function replayPiano(m){
 if(!playing||replay.state.dragging||!piano)return;
 const cursor=replay.state.cursor,bars=replay.state.frozen?.bars||chart.renderedBars,interval=replay.state.frozen?.interval||chart.interval;
 const due=!replayPianoPrimed?[replay.state.bar].filter(Boolean):bars.filter(bar=>candleEnd(bar,interval)>(pianoReplayCursor??cursor)&&candleEnd(bar,interval)<=cursor);
 for(const bar of due){
  // Completed candles are observations for the selection policy, not an
  // instruction to play. Large seeks reset without firing a note backlog.
  const frame=scoreCandle(bars,replay.state.frozen?.market||market,interval,bar);
  const event={id:'candle:'+interval+':'+bar.time,at:candleEnd(bar,interval),priceUsd:bar.close,referencePrice:bar.open,historical:true,volume:bar.volume,chordStep:Math.floor(bar.time/interval),music:frame.music};
  piano.trade(event,frame.context?.latestCap,frame.music);
  // Selection can legitimately be silent. Consume each candle exactly once.
  replayPianoPrimed=true;
 }
 pianoReplayCursor=cursor;
}
let instrumentWasAudible=false;
function otherInstrumentsAudible(){
 if(!instrumentTap||!instrumentSamples||!playing||ctx?.state!=='running'){instrumentWasAudible=false;return false;}
 instrumentTap.getFloatTimeDomainData(instrumentSamples);
 let power=0;for(const sample of instrumentSamples)power+=sample*sample;
 const rms=Math.sqrt(power/instrumentSamples.length);
 instrumentWasAudible=rms>(instrumentWasAudible?.0002:.0005);return instrumentWasAudible;
}
function tick(){
 const m=metrics(),music=musicalFrame(m),energy=music.volume*m.fresh;
 coinVoice.frame(m,{playing,seeking:replay.state.dragging,ended:replay.state.ended,audible:otherInstrumentsAudible()});
 if(!replay.state.active)void arpeggioAI.prepare();
 if(replay.state.active&&replay.state.bar){const phrase=Math.floor(replay.state.bar.time/(4*(replay.state.frozen?.interval||chart.interval)));if(phrase!==replayPhrase){replayPhrase=phrase;const phraseSeed=hash(seed+':'+phrase);send('seed',phraseSeed%16777216);envion.setSeed(phraseSeed);}}
 syncLevels(m);envion.market(music,orchestraTempo(m));
 bpm=orchestraTempo(m);$('tempo').textContent=bpm+' BPM · '+Math.round((m.music?.intensity||0)*100)+'% INTENSITY';
 if(replay.state.active)replayPiano(m);else{pianoReplayCursor=null;replayPianoPrimed=false;}
 const historical=replay.state.active,bar=replay.state.bar;
 piano?.frame(m,{playing,seeking:replay.state.dragging,ended:replay.state.ended,at:historical?replay.state.cursor:Date.now(),price:historical?bar?.close:currentPrice(),referencePrice:historical?bar?.open:undefined,known:historical?bar?.volume===0:m.decoded&&['swap','rpc-poll'].includes(streamKind)&&m.fresh>0,quiet:historical?bar?.volume===0:true});
 send('tempo',bpm);send('activity',music.activity);send('motion',music.motion);send('energy',energy);
 send('balance',m.balance);send('texture',m.texture);send('heartbeat',1);send('tonic',marketRoot(m));send('cutoff',900+m.texture*3100+energy*1800);
}
// Browser updates market controls; the Pd worklet schedules musical events.
function loop(){if(!playing)return;tick();if(playing)timer=setTimeout(loop,150);}
function mathLoop(){
 const active=playing&&!replay.state.dragging&&!replay.state.ended&&replay.state.endHold===null&&(!ctx||ctx.state==='running');
 const frozen=replay.state.frozen,interval=frozen?.interval||chart.interval;
 const rate=replay.state.speed==='candle'?interval/1000:Number(replay.state.speed)||1;
 const position=replay.state.active?(replay.state.cursor-candleEnd((frozen?.bars||chart.renderedBars)[0]||{time:replay.state.cursor},interval))/rate/1000:undefined;
 const event=replay.state.active?replay.state.bar?.time:lastTrade?.id??lastChainPrice?.receivedAt??null;
 mathPatterns.frame(mathMarket||{},{playing:active,seeking:replay.state.dragging,ended:replay.state.ended,ready:!!pd&&!audioErrors.pd,error:audioErrors.pd,event,position,clock:ctx?.currentTime??performance.now()/1000});
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
  gain.connect(limiter);limiter.connect(analyser);analyser.connect(ctx.destination);outputTap=analyser;
  // Piano and Pd share a music-only tap. Voice joins after it, preserving the
  // original master path while preventing voice/reverb from opening its own gate.
  instrumentTap=ctx.createAnalyser();instrumentTap.fftSize=2048;instrumentSamples=new Float32Array(instrumentTap.fftSize);instrumentTap.connect(gain);
  coinVoice.attach(ctx,gain);coinVoice.setMaster(Number($('master').value));coinVoice.setRunning(playing);
 }
 const epoch=audioEpoch,context=ctx,destination=instrumentTap;
 if(!piano&&!pianoLoading){
  audioErrors.piano='';
  pianoLoading=createTradePiano(context,destination,{onVoice:()=>{if(epoch===audioEpoch)pianoChordCount++;}}).then(instrument=>{
   if(epoch!==audioEpoch){instrument.close();throw Error('Audio loading cancelled');}
   piano=instrument;piano.setArpeggioPattern(arpeggioAI.snapshot());piano.setEnabled(pianoEnabled);piano.setMaster(Number($('master').value));piano.reset(seed);piano.resonance(liveMetrics().context?.latestCap);piano.setRunning(playing);
   if(playing){flushPianoTrade();if(replay.state.active)tick();}audioStatus();return piano;
  }).catch(error=>{if(epoch===audioEpoch){audioErrors.piano=error.message;engineView.log('Piano: '+error.message);audioStatus();}throw error;}).finally(()=>{if(epoch===audioEpoch)pianoLoading=null;});
 }
 if(!pd&&!pdLoading){
  audioErrors.pd='';audioErrors.envion='';
  pdLoading=(async()=>{
   const [orchestra,envionFiles]=await Promise.all([(async()=>{
    const response=await fetch('patches/orchestra/manifest.json?v=65');if(!response.ok)throw Error('Cannot load orchestra manifest');
    const manifest=await response.json();
    const files=Object.fromEntries(await Promise.all(manifest.files.map(async name=>{const path='orchestra/'+name,r=await fetch('patches/'+path+'?v=65');if(!r.ok)throw Error('Cannot load '+name);return [path,await r.text()];})));
    return {manifest,files};
   })(),envion.files()]);
   if(epoch!==audioEpoch)throw Error('Audio loading cancelled');
   const {manifest,files}=orchestra;Object.assign(files,envionFiles);
   const runtime=await createPd({audioContext:context,packages:['vanilla','cyclone','else'],files,entry:'orchestra/'+manifest.entry,workletUrl:'vendor/libpd-worklet-full.js?v=30',onPrint:text=>{if(epoch===audioEpoch&&!envion.printed(text)){console.log('[Pd]',text);engineView.log(text);}},onError:error=>{if(epoch===audioEpoch){audioErrors.pd=error.message;engineView.log(error.message);audioStatus();}}});
   if(epoch!==audioEpoch){await runtime.close();throw Error('Audio loading cancelled');}
   pd=runtime;replayPhrase=null;runtime.connect(destination);engineView.setFiles(files,manifest,true);bindSignalMap();
   send('seed',seed%16777216);send('master',playing?Number($('master').value):0);if(playing)tick();send('run',playing?1:0);
   // Math and beat voices can start as soon as Pd is ready. Envion's sample
   // handshake has its own outcome and cannot close the other instruments.
   envion.attach(runtime,context,files).then(attached=>{if(epoch!==audioEpoch||!attached)return;envion.setSeed(replayPhrase==null?seed:hash(seed+':'+replayPhrase));envion.setRunning(playing);if(playing)tick();audioStatus();}).catch(error=>{if(epoch===audioEpoch){send('av-envion-ready',0);envion.detach();audioErrors.envion=error.message;engineView.log('Envion: '+error.message);audioStatus();}});
   audioStatus();return runtime;
  })().catch(error=>{if(epoch===audioEpoch){audioErrors.pd=error.message;engineView.log('Pd: '+error.message);audioStatus();}throw error;}).finally(()=>{if(epoch===audioEpoch)pdLoading=null;});
 }
 // Start with whichever instrument is ready first. Promise.any observes both
 // failures, so a later Pd rejection does not become an unhandled rejection.
 try{await Promise.any([piano||pianoLoading,pd||pdLoading].filter(Boolean));}
 catch{throw Error([audioErrors.piano,audioErrors.pd].filter(Boolean).join(' · ')||'No audio instrument could load');}
}
async function closeAudio(){
 coinVoice.close();arpeggioAI.close();stopLegacyPlayback();audioEpoch++;pianoLoading=null;pdLoading=null;pendingPianoTrade=null;
 piano?.close();piano=null;envion.detach();const runtime=pd,context=ctx;pd=null;ctx=null;gain=null;outputGateOpen=null;outputTap=null;instrumentTap=null;instrumentSamples=null;
 for(const name of Object.keys(audioErrors))audioErrors[name]='';
 if(runtime)await runtime.close();await context?.close();
}
function setPlayState(active){
 const button=$('play');button.dataset.playing=String(active);button.textContent=active?'Ⅱ Pause':'▶︎ Listen';
 $('visualizer-state').textContent=active?'LISTENING':'PRESS LISTEN';
 button.setAttribute('aria-label',active?'Pause audio':'Listen to market');button.setAttribute('aria-pressed',String(active));
}
setPlayState(false);
$('play').onclick=async()=>{
 if(starting)return;
 const wasInterrupted=playing&&ctx&&ctx.state!=='running';
 let unlocked;
 if(!playing||ctx?.state!=='running'){try{unlocked=unlockPlayback(audioContext());}catch(error){status(error.message);return;}}
 if(wasInterrupted){
  starting=true;$('play').disabled=true;
  try{await unlocked;if(ctx.state!=='running')throw Error('Tap Resume again to enable audio');flushPianoTrade();setPlayState(true);audioStatus();}
  catch(error){status('Audio interrupted · '+error.message);}
  finally{starting=false;$('play').disabled=false;}
  return;
 }
 if(playing){if(replay.state.active){replay.advance(chart.renderedBars,chart.interval,true);replay.metrics(chart.renderedBars,market,chart.interval);}playing=false;dataVisual.reset();stopLegacyPlayback();mathPatterns.stop();dataSonification.reset(seed);pendingPianoTrade=null;piano?.setRunning(false);coinVoice.setRunning(false);send('run',0);envion.setRunning(false);clearTimeout(timer);if(gain)gain.gain.setTargetAtTime(0,ctx.currentTime,.025);send('master',0);pd?.flush?.();$('audio-output').disabled=false;setPlayState(false);void takeShare.finish();status(replay.state.active?'History replay paused':'Paused');updateReplayUI(replay.state.controls||{});return;}
 starting=true;$('play').disabled=true;status('Opening instrument…');
 try{await unlocked;if(!market)throw Error('Trending market is still loading.');if(!pd||!piano)await initialize();resetEnsemble();if(ctx&&ctx.state!=='running'){const error=Error('Audio is interrupted · tap Listen again');error.name='AudioUnlockError';throw error;}if(gain)gain.gain.setTargetAtTime(1.5,ctx.currentTime,.04);send('master',Number($('master').value));$('audio-output').disabled=true;playing=true;piano?.setRunning(true);coinVoice.setRunning(true);void coinVoice.prepare();void arpeggioAI.prepare();flushPianoTrade();replay.state.clock=performance.now();send('seed',seed%16777216);envion.setSeed(seed);loop();send('run',1);envion.setRunning(true);setPlayState(true);takeShare.start(ctx,outputTap);audioStatus();}
 catch(e){playing=false;clearTimeout(timer);setPlayState(false);$('audio-output').disabled=false;status('Unable to start audio: '+e.message);if(e.name!=='AudioUnlockError')await closeAudio();}
 finally{starting=false;$('play').disabled=false;}
};
$('native-option').disabled=true;
$('native-option').textContent='Native Pd · full Envion browser bridge required';
$('audio-output').onchange=async()=>{
 starting=true;$('play').disabled=true;$('audio-output').disabled=true;
 try{await closeAudio();resetEnsemble();status($('audio-output').value==='native'?'Open patches/orchestra/av-desktop.pd · then Listen':'Piano ready');}
 catch(e){status('Could not change audio output: '+e.message);}
 finally{starting=false;$('play').disabled=false;$('audio-output').disabled=false;}
};
for(const id of controls)$(id).addEventListener('input',()=>{send(id,playing?Number($(id).value):0);if(id==='master'){piano?.setMaster(Number($(id).value));coinVoice.setMaster(Number($(id).value));}session?.controls.push({at:Date.now(),name:id,value:Number($(id).value)});});
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
 $('mode').textContent=historical?(recorded?'HISTORY · RECORDED CONTROLS':'HISTORY · CANDLE ESTIMATES'):!market?'LOADING TRENDING MARKET':streamConnected&&streamKind==='rpc-poll'?'DIRECT RPC · ≥2 SEC':streamConnected&&streamKind==='swap'?'LIVE SWAPS':streamConnected&&streamKind==='trade-poll'?'CACHED TRADE POLLING':streamConnected&&streamKind==='pool'?'POOL ACTIVITY + SNAPSHOTS':'MARKET SNAPSHOTS';
 $('coin-name').textContent=market?market.baseToken.symbol+' / '+market.quoteToken.symbol:'Loading trending market';
 $('visualizer-coin').textContent=market?.baseToken.name||market?.baseToken.symbol||'$UPIC';
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
 function refreshMusicHistory(){if(gen!==generation)return;stopMusicHistory?.();stopMusicHistory=loadHistory(pair,data=>{if(gen!==generation)return;musicalCandles=data.candles;musicalInterval=data.interval;},{timeframe:'minute',aggregate:5,maxPages:1,cacheAge:60000,priority:60});musicHistoryTimer=setTimeout(refreshMusicHistory,300000);}
 if($('chart-timeframe').value!=='auto')loadChartTimeframe();
 refreshMusicHistory();
 const dates=discovered.filter(p=>p.chainId===pair.chainId).map(p=>Number(p.pairCreatedAt)).filter(n=>n>0);
 originDate=dates.length?Math.min(...dates):Number(pair.pairCreatedAt)||null;updateContext();
 stopHistory=loadHistory(pair,data=>{
  if(gen!==generation)return;
  const first=data.candles[0];historyContext=first?{first,peak:Math.max(...data.candles.map(b=>b.high)),state:data.state,interval:data.interval}:null;
  contextCandles=data.candles;contextInterval=data.interval;
  if($('chart-timeframe').value==='auto'){setHistoryLoading(data);chart.setHistory(data.candles,data.interval,originDate);$('chart-resolution').textContent='Auto context · '+data.timeframe+' candles';}
  const gap=first&&originDate&&first.time>originDate+data.interval?' · gap between first known market and available history':'';
  $('history-status').textContent=data.message+' · '+data.timeframe+' candles'+gap;
  updateContext();session?.controls.push({at:Date.now(),name:'history-context',first:first?.time,firstOpen:first?.open,state:data.state,originDate});
 });
}
function setHistoryLoading(data={}){
 const host=$('history-loading'),has=data.candles?.length>0,busy=['loading','cached'].includes(data.state),failed=data.state==='unavailable';
 host.hidden=has&&!busy;host.dataset.partial=String(has);host.classList.toggle('is-loading',busy);$('market-chart').setAttribute('aria-busy',String(busy));
 $('history-loading-label').textContent=failed?'History unavailable':has?'Refreshing history':busy?'Loading history':'No history returned';
 $('history-retry').hidden=busy;
}
$('history-retry').onclick=()=>{$('chart-timeframe').value==='auto'?startHistory(market):loadChartTimeframe();};
const chartFrames={'1m':{timeframe:'minute',aggregate:1},'5m':{timeframe:'minute',aggregate:5},'15m':{timeframe:'minute',aggregate:15},'1h':{timeframe:'hour',aggregate:1},'4h':{timeframe:'hour',aggregate:4},'1d':{timeframe:'day',aggregate:1}};
function loadChartTimeframe(){
 stopChartHistory?.();const request=++chartRequest,gen=generation,selection=$('chart-timeframe').value;
 if(selection==='auto'){setHistoryLoading({candles:contextCandles,state:historyContext?.state||'loading'});chart.setHistory(contextCandles,contextInterval,originDate);$('chart-resolution').textContent='Auto context · '+contextInterval/60000+' minute candles';return;}
 setHistoryLoading({candles:[],state:'loading'});
 const frame=chartFrames[selection],interval={minute:60000,hour:3600000,day:86400000}[frame.timeframe]*frame.aggregate;
 chart.setInterval(interval);$('chart-resolution').textContent=selection+' · '+(market?'Loading provider candles…':'Awaiting trending market');
 if(!market)return;
 stopChartHistory=loadHistory(market,data=>{
  if(gen!==generation||request!==chartRequest)return;
  setHistoryLoading(data);chart.setHistory(data.candles,data.interval,originDate);
  $('chart-resolution').textContent=selection+' · '+data.candles.length+' provider candles · '+data.message;
 },{...frame,maxPages:3,priority:100});
}
async function fetchJSON(url){const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),12000);try{const r=await fetch(url,{signal:abort.signal});if(!r.ok)throw Error('Market provider returned '+r.status);return await r.json();}finally{clearTimeout(timeout);}}
function applySnapshot(pair){
 market=pair;lastSnapshot=Date.now();
 if(!(streamConnected&&['swap','trade-poll','rpc-poll'].includes(streamKind))){chart.add({at:Date.now(),price:Number(pair.priceUsd),source:'snapshot'});$('chart-source').textContent='Observed market snapshots · 5-second polling; provider data may be cached';}
 display();$('lookup').textContent='Snapshot '+new Date().toLocaleTimeString()+' · '+pair.baseToken.name+' · '+pair.chainId+' · '+pair.dexId;
 session?.snapshots.push({at:Date.now(),market:pair});
}
function chooseMarket(pair,{shared=false}={}){
 void takeShare.finish();takeShare.reset();
 pendingPianoTrade=null;preloadPianoSamples().catch(error=>engineView.log('Piano preload: '+error.message));
 mathMarket=null;
 pianoHistory=[];pianoChordCount=0;piano?.reset();pianoReplayCursor=null;
 replay.setMarket(pair.chainId+':'+pair.pairAddress+':'+pair.baseToken.address);
 generation++;clearTimeout(poll);stopStream?.();stopHistory?.();stopChartHistory?.();stopStream=null;streamPool='';streamConnected=false;streamKind='snapshot';poolEvents=[];tradeEvents=[];lastTrade=null;lastChainPrice=null;receivedTradeCount=0;historyContext=null;originDate=null;chart.reset();
 resetEnsemble();mode='live';market=pair;seed=hash(pair.chainId+':'+pair.baseToken.address);dataSonification.reset(seed);holderMetadata.setMarket(shared?null:pair);mathSeed=hash(pair.chainId+':'+(/^0x[0-9a-f]{40}$/i.test(pair.baseToken.address)?pair.baseToken.address.toLowerCase():pair.baseToken.address));mathPatterns.setSeed(mathSeed);state=seed;step=0;send('seed',seed%16777216);envion.setSeed(seed);piano?.reset(seed);arpeggioAI.setSeed(seed);coinVoice.setCoin(pair.baseToken.name||pair.baseToken.symbol,seed);if(playing)void coinVoice.prepare();applySnapshot(pair);if(!shared){startHistory(pair);setupStream();loadCoinImage(pair);}if(playing)takeShare.start(ctx,outputTap);
 $('last-event').textContent='Waiting for pool events';
 session?.controls.push({at:Date.now(),name:'market',chain:pair.chainId,pool:pair.pairAddress});
 if(shared)return;
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
$('address').addEventListener('input',()=>{$('coin-search-results').hidden=true;});
$('address').addEventListener('input',syncAddressLabel);
$('address').addEventListener('change',syncAddressLabel);
syncAddressLabel();
$('coin-form').onsubmit=async e=>{
 e.preventDefault();
 if($('address').value.trim().toLowerCase()==='pdata'){const show=$('envion').hidden;$('envion').hidden=!show;$('engine-view').hidden=!show;document.body.classList.toggle('inspecting',show);$('address').value='';syncAddressLabel();status(show?'Pure Data view open':'Pure Data view hidden');return;}
 if(loading)return;
 const wantedNetwork=requestedNetwork,autoPlay=requestedAutoplay;requestedNetwork=null;requestedAutoplay=false;
 const address=$('address').value.trim();if(address.length<1||address.length>250){status('Enter a coin name, symbol or contract address.');return;}
 loading=true;$('load').disabled=true;status('Looking up indexed markets…');
 try{
  const data=await fetchJSON('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(address));
  if($('address').value.trim()!==address)return;
  const pairs=rankCoinMatches(data.pairs||[],address,{orientPair,network:wantedNetwork});
  if(!pairs.length)throw Error('No indexed coin matched this name or address.');
  if(!isTokenIdentifier(address)&&!pairs.some(pair=>sameToken(pair.baseToken.address,address))){showCoinMatches($('coin-search-results'),pairs,pair=>{$('address').value=pair.baseToken.address;syncAddressLabel();discovered=[pair];chooseMarket(pair);if(autoPlay&&!playing)void $('play').onclick();});status('Choose a coin from the search results');return;}
  $('coin-search-results').hidden=true;
  const selection=wantedNetwork?pairs.find(p=>p.chainId===wantedNetwork):pairs[0];if(!selection)throw Error('No DEX Screener market found on the trending coin’s network.');
  discovered=[selection];chooseMarket(selection);if(autoPlay&&!playing)await $('play').onclick();
 }catch(e){status(e.message);$('lookup').textContent=e.message;}
 finally{loading=false;$('load').disabled=false;}
};
function shareSnapshot(){
 if(!market)return null;
 const frozen=replay.state.frozen,interval=frozen?.interval||chart.interval;
 const rows=(frozen?.bars||chart.renderedBars).filter(bar=>!replay.state.active||candleEnd(bar,interval)<=replay.state.cursor).slice(-128);
 if(!rows.length)return null;
 const basis=frozen?.market||market;
 return {version:1,engine:65,arpeggio:arpeggioAI.snapshot(),interval,seed,speed:replay.state.speed,market:{chainId:basis.chainId,dexId:basis.dexId,pairAddress:basis.pairAddress,baseToken:{address:basis.baseToken.address,symbol:basis.baseToken.symbol,name:basis.baseToken.name||basis.baseToken.symbol},quoteToken:{address:basis.quoteToken.address,symbol:basis.quoteToken.symbol,name:basis.quoteToken.name||basis.quoteToken.symbol},priceUsd:basis.priceUsd,priceNative:basis.priceNative,marketCap:basis.marketCap},rows:rows.map(b=>[b.time,b.open,b.high,b.low,b.close,b.volume??null])};
}
const takeShare=createTakeShare({button:$('share'),dialog:$('share-dialog'),snapshot:shareSnapshot,onContinue:()=>{if(playing)takeShare.start(ctx,outputTap);}});
const rollDate=rollingText($('coin-date')),rollTime=rollingText($('coin-time')),rollCap=rollingText($('coin-cap'));
function updateCoinReadout(m){
 const at=replay.state.active?replay.state.cursor:Date.now(),date=new Date(at),cap=m.context?.latestCap;
 rollDate(date.toLocaleDateString(undefined,{day:'2-digit',month:'2-digit',year:'numeric'}),at);
 rollTime(date.toLocaleTimeString(undefined,{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}),at);
 rollCap(cap>0?'$'+Math.round(cap).toLocaleString('en'):'—',cap||0);
 $('coin-clock-label').textContent=replay.state.active?'REPLAY · DATE / TIME':'LIVE · DATE / TIME';
 $('coin-cap-label').textContent=replay.state.active?'MCAP · HISTORICAL ESTIMATE':m.context?.capEstimated?'MCAP · PRICE ESTIMATE':'MARKET CAP';
 const harmony=harmonyPlan(seed,m.music?.character);
 $('coin-character').textContent=harmony.name.toUpperCase();$('coin-progression').textContent=harmony.progression;
}
function restoreSharedScore(){
 try{
  const score=decodeScore(location.hash);if(!score)return false;
  chooseMarket(score.market,{shared:true});arpeggioAI.setSeed(seed,score.arpeggio||arpeggioAI.snapshot());setHistoryLoading({candles:score.rows,state:"pool-start"});const bars=score.rows.map(([time,open,high,low,close,volume])=>({time,open,high,low,close,volume,observedThrough:time+score.interval}));
  chart.setHistory(bars,score.interval,bars[0].time);chart.draw();replay.freeze(bars,score.market,score.interval);replay.state.speed=['candle','1','60'].includes(String(score.speed))?String(score.speed):'candle';$('replay-speed').value=replay.state.speed;
  replay.seek(bars[0],score.interval);chart.schedule();syncLevels(metrics());$('share').disabled=false;status('Shared candle score · press Listen');return true;
 }catch(error){status('Cannot open shared score: '+error.message);return false;}
}
display();
if(!restoreSharedScore())startTrending((item,options={})=>{
 if(loading)return;
 // Resume in the coin click itself: market discovery completes asynchronously.
 // The unlocked context stays silent until Listen opens the selected coin engine.
 if(!playing)primeAudio();
 requestedNetwork=item.chain;requestedAutoplay=options.autoplay??true;
 if(item.image)tokenImages.set(imageKey({chainId:item.chain,baseToken:{address:item.address}}),item.image);
 $('address').value=item.address;syncAddressLabel();$('coin-form').requestSubmit();
});
setInterval(()=>{if(!playing)syncLevels(metrics());},250);
const chartStatus=document.querySelector('.chart-status');
new MutationObserver(()=>{for(const item of chartStatus.children)item.title=item.textContent;}).observe(chartStatus,{childList:true,characterData:true,subtree:true});
function audioContext(){
 if(!ctx){
  const context=createMusicContext();ctx=context;
  context.onstatechange=()=>{
   if(context!==ctx||!playing)return;
   if(context.state==='running'){replay.state.clock=performance.now();flushPianoTrade();setPlayState(true);}
   else{mathPatterns.stop();$('play').dataset.playing='false';$('play').setAttribute('aria-pressed','false');$('visualizer-state').textContent='AUDIO PAUSED';$('play').textContent='▶︎ Resume';$('play').setAttribute('aria-label','Resume interrupted audio');}
   audioStatus();
  };
 }
 return ctx;
}
function primeAudio(){try{unlockPlayback(audioContext()).catch(()=>{});}catch{}}
function seekHistory(bar,dragging=false){
 pendingPianoTrade=null;
 if(!bar)return;
 if(!playing)primeAudio();
 if(!replay.state.active){arpeggioAI.setSeed(seed,arpeggioAI.snapshot());resetEnsemble();replay.freeze(chart.renderedBars,market,chart.interval);}
 replayPianoPrimed=false;replayPhrase=null;mathPatterns.reset();dataSonification.reset(seed);dataVisual.reset();
 replay.seek(bar,chart.interval,dragging);chart.schedule();
 piano?.reset(seed);coinVoice.reset();pianoReplayCursor=replay.state.cursor;
 session?.controls.push({at:Date.now(),name:'history-seek',cursor:replay.state.cursor,source:'loaded-candle',speed:replay.state.speed});
 if(playing)tick();else{const m=metrics();syncLevels(m);envion.market(musicalFrame(m),orchestraTempo(m));if(!starting)$('play').onclick();}
}
chart.onHistorySeek=seekHistory;
chart.onHistorySeekEnd=()=>replay.release();
$('replay-play').onclick=()=>{
 if(replay.state.active&&!replay.state.ended){$('play').onclick();return;}
 seekHistory((replay.state.frozen?.bars||chart.renderedBars)[0]);
};
$('replay-live').onclick=()=>{
 replay.live();arpeggioAI.setSeed(seed);resetEnsemble();chart.tickView?.live();chart.goLive();$('chart-range').value='live';display();
 session?.controls.push({at:Date.now(),name:'history-live'});
 if(playing)tick();else{const m=metrics();syncLevels(m);envion.market(musicalFrame(m),orchestraTempo(m));}
 status(playing?'Piano ready · waiting for trades':'Live market · press Listen');
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
},500);
const playerScreen=window.matchMedia('(max-width:760px)');
function syncChartTypography(){chart.chart.applyOptions({layout:{fontFamily:'Arial, sans-serif',fontSize:playerScreen.matches?11:9}});}
playerScreen.addEventListener('change',syncChartTypography);
document.fonts.ready.then(syncChartTypography);
