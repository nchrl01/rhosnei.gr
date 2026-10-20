// App integration of the agreed Earthbound engine. Only observed market inputs
// enter this path. The study's simulated liquidity/holder generator is not used.
import {createEarthboundRenderer} from './upic-earthbound-renderer.js?v=361';
import {createVisualFullscreen} from './visual-fullscreen.js?v=345';
import {normalizeIdentity} from './upic-identity.js?v=earthbound-5';
const unit=x=>Math.max(0,Math.min(1,Number(x)||0));
// Preserve UPIC's image-reveal and stale-release curves without importing
// the legacy audio/metadata-driven visual parameter path.
function marketCapIdentity(value){const cap=Number(value),t=cap>0&&Number.isFinite(cap)?unit(Math.log10(cap/1e7)/Math.log10(5)):0;return t*t*(3-2*t);}
function marketCapReleaseSeconds(value){const cap=Number(value),size=Number.isFinite(cap)&&cap>0?unit((Math.log10(cap)-4)/5):.5;return .25*Math.pow(16,size);}
const finite=x=>x==null||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const chainAliases={ethereum:'eip155:1',eth:'eip155:1',base:'eip155:8453',arbitrum:'eip155:42161',optimism:'eip155:10',polygon:'eip155:137',bsc:'eip155:56',avalanche:'eip155:43114',gnosis:'eip155:100',solana:'solana:mainnet',sui:'sui:mainnet',aptos:'aptos:mainnet',ton:'ton:mainnet',tron:'tron:mainnet',bitcoin:'bitcoin:mainnet'};
function identityKey(raw){
 const key=String(raw||'unselected'),at=key.indexOf(':'),chain=at<0?'unknown':key.slice(0,at),address=at<0?key:key.slice(at+1);
 try{return normalizeIdentity(chainAliases[chain]||chain,address).key;}
 catch{return JSON.stringify([chain,address]);}
}
function seedFor(key){let seed=2166136261;for(const c of key)seed=Math.imul(seed^c.charCodeAt(0),16777619);return seed>>>0;}
function observedHolderSnapshot(m){
 // Counts or aggregate cluster percentages cannot reconstruct individual
 // holdings. Use only actual per-wallet values from the current snapshot.
 if(m.replay&&m.replay.source!=='observed')return {balances:[],source:'unavailable',providerState:'historical-unavailable',primaryProviderState:'historical-unavailable',coverage:'unavailable',loading:false,settled:false};
 const audience=m.audience||{},relations=audience.relationships,holdings=audience.holdings,records=[];
 let selected=null,source='unavailable',coverage='unavailable';
 const supplied=Array.isArray(audience.holderBalances)&&audience.weight>0;
 if(holdings?.weight>0&&(holdings.complete||holdings.records?.length)){
  selected=holdings;source=holdings.source||'indexed-balances';records.push(...(holdings.records||[]));
  coverage=holdings.complete?'complete-indexed-list':holdings.truncated?'top-10000':holdings.coverage==='top-holder-sample'?'top-holder-sample':'partial-sample';
 }else if(supplied){
  selected=audience;source='supplied-balances';coverage='partial-sample';records.push(...audience.holderBalances);
 }else if(relations?.weight>0){
  selected=relations;source=relations.source||'relationship-wallets';coverage='partial-sample';
  for(const cluster of relations.clusters||[])for(const wallet of cluster.wallets||[])records.push({id:wallet.address,percentage:wallet.percentage});
 }
 const wallets=new Map();
 for(const record of records){
  const id=String(record.id??record.address??'').trim();
  const cap=finite(m.context?.latestCap),pct=finite(record.percentage),tokens=finite(record.tokenBalance),price=finite(m.context?.latestPrice??m.context?.path?.at(-1)?.close);
  // Explicit USD values take priority; relationship percentages are supply shares.
  const balance=finite(record.balanceUsd??record.balanceUSD??record.usdValue)
   ??(tokens!==null&&tokens>0&&price>0?tokens*price:null)
   ??(pct!==null&&cap>0?cap*pct/100:null)
   ??(audience.holderBalanceUnit==='usd'?finite(record.balance):null);
  if(!id||id.length>512||!Number.isFinite(balance)||!(balance>0))continue;
  // Repeated appearances of one address are not extra wallets or extra funds.
  const key=/^0x[0-9a-f]{40}$/i.test(id)?id.toLowerCase():id;
  wallets.set(key,Math.max(balance,wallets.get(key)||0));
 }
 const balances=[...wallets].map(([id,balance])=>({id,balance})).sort((a,b)=>b.balance-a.balance||a.id.localeCompare(b.id)).slice(0,10000);
 // Fetch completion and coverage are separate: a terminal partial/fallback
 // sample can sharpen without being presented as a complete holder list.
 const primaryProviderState=holdings?.state||'unavailable';
 const loading=primaryProviderState==='loading'||(selected!==holdings&&!supplied&&relations?.state==='loading');
 const settled=Boolean(holdings||relations||supplied)&&!loading;
 return {balances,source,coverage,fetchedAt:finite(selected?.fetchedAt),providerState:selected?.state||primaryProviderState,primaryProviderState,loading,settled};
}
export function observedHolderBalances(m={}){
 return observedHolderSnapshot(m).balances;
}
export function earthboundMarketState(m={},coinKey='unselected'){
 const marketCap=finite(m.context?.latestCap),liquidity=m.availability?.liquidity===false?null:finite(m.observation?.liquidity);
 const holders=observedHolderSnapshot(m),holderBalances=holders.balances;
 return {coinKey,chartHistory:m.replay?.source==='candles'?m.replay.chart:null,marketCap:marketCap>0?marketCap:null,liquidity:liquidity!==null&&liquidity>=0?liquidity:null,
  holderBalances,holderFetchedAt:holders.fetchedAt,marketObservedAt:finite(m.context?.path?.at(-1)?.time),holderFetchSettled:holders.settled,holderFetchLoading:holders.loading,liveHolders:!m.replay,holderSource:'observed',holderBalanceSource:holders.source,totalHolders:finite(m.audience?.holders),holderProviderState:holders.providerState,holderPrimaryProviderState:holders.primaryProviderState,holderCoverage:holders.coverage,change:0,
  tempo:Math.max(10,Math.min(240,finite(m.music?.tempo)??40)),fresh:unit(m.fresh),activity:unit(m.activity),
  hasMarket:marketCap>0||finite(m.context?.latestPrice)>0||finite(m.replay?.price)>0||finite(m.context?.path?.at(-1)?.close)>0};
}
export function createEarthboundVisual(canvas,{getState=()=>({})}={}){
 const host=canvas?.closest('.audio-visualizer');
 if(!host)return {frame(){},event(){},pulse(){},piano(){},setImage(){},snapshot(){return null;},refresh(){},reset(){},close(){}};
 // Keep the complete renderer square in the page and in fullscreen. The field
 // does not crop to changing mark bounds, which would hide its outer marks.
 const field=document.createElement('div');field.className='visual-content-frame';host.append(field);host.dataset.visualFrame='full';
 const overlay=canvas.getContext('2d'),renderer=createEarthboundRenderer(field),fullscreen=createVisualFullscreen(host,{referenceSide});
 const anchor=document.createComment('earthbound visual home');host.after(anchor);
 let initialHoldersReady=false,initialLoadShown=false,awaitingHolderRender=false,holderRevealStarted=null;
 function syncHolderLoading(rendered=false,now=performance.now()){
  if(latest?.liveHolders&&latest.holderFetchSettled&&latest.holderBalances.length>0&&!initialHoldersReady){
   initialHoldersReady=true;
   renderer.clear();identity=identityInput=marketCapIdentity(latest.marketCap);color=colorTarget=latest.marketCap>=5e7?1:0;
   // Wait for the renderer itself: loading may finish while the tab is hidden.
   awaitingHolderRender=initialLoadShown;holderRevealStarted=null;
  }
  if(rendered&&latest?.liveHolders&&awaitingHolderRender){
   const motion=renderer.snapshot();
   if(holderRevealStarted===null)holderRevealStarted=now;
   // New live ticks must not keep a settled provider outcome blurred forever.
   if((!motion.sizeTransition&&!motion.positionTransition)||now-holderRevealStarted>=650)awaitingHolderRender=false;
  }
  const waiting=latest?.liveHolders&&!initialHoldersReady&&latest.holderFetchLoading;
  const loading=Boolean(latest?.liveHolders&&(waiting||awaitingHolderRender));
  if(loading)initialLoadShown=true;
  host.dataset.holderLoading=String(loading);host.setAttribute('aria-busy',String(loading));
 }

 const mobile=matchMedia('(max-width:760px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let latest=null,settings={},key='',seed=0,clock=0,presence=0,transportPresence=0,identity=0,identityInput=0,color=0,colorTarget=0;
 let colorStart=0,colorDuration=2.4;
 let staleElapsed=0,colorElapsed=0,last=0,lastRender=0,raf=0,closed=false,visible=true,width=0,height=0,sourceCursor=null;
 let sourceValue=null,sourceAt=0,imageCoinKey='',identitySource=null;
 let renderedAt=0,renderedPlaying=false,renderedCoinKey='',sourceCoinKey='',renderedHolderReady=false;
 function reset(){clock=0;transportPresence=0;presence=latest?.fresh>0?1:0;identity=identityInput=0;color=colorStart=0;colorTarget=0;staleElapsed=colorElapsed=0;sourceCursor=null;last=lastRender=0;renderedAt=0;renderedPlaying=false;renderedCoinKey=sourceCoinKey='';renderedHolderReady=false;renderer.clear();}
 function referenceSide(box){
  // CSS owns a stable viewport-sized desktop host. Use its content box so
  // sticky scrolling cannot change the artwork scale, and retain its soft edges.
  // On collapse, box is the placeholder with the same outer dimensions.
  const style=getComputedStyle(host),pixels=name=>parseFloat(style[name])||0;
  const width=box.width-pixels('paddingLeft')-pixels('paddingRight');
  const height=box.height-pixels('paddingTop')-pixels('paddingBottom');
  return Math.max(0,Math.min(width,height));
 }
 function size(){
  const box=host.getBoundingClientRect();
  // The CSS host dimensions are independent of the marks. Fullscreen owns its
  // outer rectangle, while the renderer keeps one uncropped square inside it.
  const movingSide=parseFloat(host.style.getPropertyValue('--visual-motion-side'));
  width=height=Number.isFinite(movingSide)?movingSide:referenceSide(box);
  const pixels=width.toFixed(3)+'px';
  if(host.style.getPropertyValue('--visual-reference-side')!==pixels)host.style.setProperty('--visual-reference-side',pixels);
 }
 function arrange(){
  const title=document.querySelector('.coin-title');
  if(!host.classList.contains('is-expanded')){if(mobile.matches&&title){if(host.parentElement!==title)title.prepend(host);}else anchor.parentNode?.insertBefore(host,anchor);}
  size();
 }
 const resize=new ResizeObserver(size);resize.observe(host);const header=document.querySelector('.market-header');if(header)resize.observe(header);const footer=document.querySelector('.site-footer');if(footer)resize.observe(footer);
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries.at(-1)?.isIntersecting??true;last=0;}):null;observer?.observe(host);
 const visibility=()=>{last=0;size();};
 mobile.addEventListener('change',arrange);window.addEventListener('resize',size);document.addEventListener('visibilitychange',visibility);arrange();
 function draw(now){
  if(closed)return;raf=requestAnimationFrame(draw);
  const dt=last?Math.min(.1,Math.max(0,(now-last)/1000)):0;last=now;
  if(document.hidden||!visible||width<1||height<1||!latest?.hasMarket)return;
  syncHolderLoading();
  if(latest.liveHolders&&!initialHoldersReady)return;
  const state=getState(),playing=state.playing&&settings.playing!==false&&!settings.seeking&&!settings.ended;
  // A selection can update app state before its first market frame arrives.
  // Never attribute the old coin's pixels to the newly selected coin.
  if(identityKey(state.coinKey)!==key)return;
  // Share the market-cap readout's up/down pulse; price change is not a shape input.
  latest.change=latest.chartHistory?Math.sign(latest.chartHistory.at(-1)?.close-latest.chartHistory.at(-1)?.open):Math.sign(Number(state.markDirection)||0);
  const fresh=latest.fresh>0;
  // Original transport envelope: fast return on Play, cap-scaled release on
  // Pause, and a dim sparse field left behind. Audio amplitude is not an input.
  const transportTarget=playing?1:0;
  transportPresence+=(transportTarget-transportPresence)*(1-Math.exp(-dt/(playing?.08:marketCapReleaseSeconds(latest.marketCap))));
  if(!playing&&transportPresence<.001)transportPresence=0;
  if(playing){
   if(latest.fresh<presence){staleElapsed+=dt;const steps=Math.floor(staleElapsed);if(steps){staleElapsed-=steps;presence+=(latest.fresh-presence)*(1-Math.exp(-steps/marketCapReleaseSeconds(latest.marketCap)));}}
   else{staleElapsed=0;presence+=(latest.fresh-presence)*(1-Math.exp(-dt/.08));}
   if(presence<.0001)presence=0;
   if(fresh){
    let elapsed=dt;
    if(settings.clock!=null){
     const cursor=sourceValue+Math.min(.25,Math.max(0,(now-sourceAt)/1000))*Math.max(0,Number(settings.rate)||1);
     elapsed=sourceCursor===null?0:Math.max(0,cursor-sourceCursor);sourceCursor=Math.max(sourceCursor??cursor,cursor);
    }else sourceCursor=null;
    if(!reduced.matches)clock+=elapsed*1.35*latest.tempo/100;
    const target=marketCapIdentity(latest.marketCap);
    identityInput+=(target-identityInput)*(1-Math.exp(-dt/.16));identity+=(identityInput-identity)*(1-Math.exp(-dt/1.4));
    if(color!==colorTarget){colorElapsed+=dt;const progress=Math.min(1,Math.floor(colorElapsed/.25)*.25/colorDuration);color=colorStart+(colorTarget-colorStart)*progress*progress*(3-2*progress);if(colorElapsed>=colorDuration)color=colorTarget;}
    else colorElapsed=0;
   }
  }
  // Transport controls the original dim/sparse resting state; audio gain
  // and metering remain completely independent of the visual engine.
  if(now-lastRender<1000/(renderer.kind==='canvas'?15:60))return;lastRender=now;
  overlay?.clearRect(0,0,canvas.width,canvas.height);
  renderer.render({width,height,time:clock,seed,inputs:latest,identity,artworkColor:color,presence,pixelPresence:Math.max(.32,transportPresence),inkColor:.18+.82*transportPresence,reducedMotion:reduced.matches});
  syncHolderLoading(true,now);
  renderedAt=Date.now();renderedPlaying=Boolean(playing&&fresh);renderedCoinKey=key;sourceCoinKey=String(state.coinKey||'unselected');
  renderedHolderReady=Boolean(initialHoldersReady&&latest.liveHolders&&latest.holderBalances.length&&host.dataset.holderLoading!=='true');
  host.dataset.pixelBlast=renderer.kind==='canvas'?'canvas':'ready';
  host.dataset.visible='true';
  Object.assign(canvas.dataset,{composition:'earthbound',active:String(playing),visible:'true',moving:String(playing&&fresh&&!reduced.matches),motion:clock.toFixed(4),level:'0',holderSource:latest.holderBalances.length?'observed-wallet-sample':'unavailable',marketCapState:latest.marketCap===null?'unavailable':'observed',liquidityState:latest.liquidity===null?'unavailable':'observed'});
 }
 raf=requestAnimationFrame(draw);
 return {
  frame(m={},options={}){
   const nextKey=identityKey(getState().coinKey),changed=nextKey!==key,wasFresh=latest?.fresh;
   const backwards=options.clock!=null&&settings.clock!=null&&options.clock<settings.clock;
   if(options.clock!==sourceValue){sourceValue=options.clock==null?null:Number(options.clock);sourceAt=performance.now();}
   if(changed){initialHoldersReady=false;initialLoadShown=false;awaitingHolderRender=false;holderRevealStarted=null;}
   key=nextKey;seed=seedFor(key);settings=options;latest=earthboundMarketState(m,key);latest.change=Math.sign(Number(getState().markDirection)||0);
   syncHolderLoading();
   if(changed&&imageCoinKey!==key)renderer.setImage(null);
   if(changed||backwards||options.seeking){reset();presence=latest.fresh>0?1:0;identity=identityInput=marketCapIdentity(latest.marketCap);color=colorTarget=latest.marketCap>=5e7?1:0;}
   if((wasFresh>0)!==(latest.fresh>0))staleElapsed=0;
   const target=latest.marketCap>=5e7?1:0;if(target!==colorTarget){colorStart=color;colorTarget=target;colorElapsed=0;colorDuration=Math.max(1.5,2.4*(1.5-.75*latest.activity));}
   if(!latest.hasMarket){renderer.clear();renderedAt=0;renderedPlaying=false;renderedHolderReady=false;}
  },
  // Keep the app's audio callback interface without coupling sound to ink.
  event(){},pulse(){},piano(){},
  setImage(image){identitySource=image;renderer.setImage(image);imageCoinKey=identityKey(getState().coinKey);},
  captureStill(size=512){
   const state=getState(),age=Date.now()-renderedAt;
   if(!renderedAt||age<0||age>2000||!renderedPlaying||!state.playing||settings.playing===false||settings.seeking||settings.ended||!latest?.hasMarket||!latest.liveHolders||!latest.fresh||!renderedHolderReady||host.dataset.holderLoading==='true'||renderedCoinKey!==key||sourceCoinKey!==String(state.coinKey||'unselected')||transportPresence<.99)throw Error('A current live playing holder frame is required to capture.');
   if(latest.change!==0||(renderer.snapshot().shapeWeights?.[0]??0)<.999)throw Error('Waiting for the live dot state.');
   const output=document.createElement('canvas');output.width=output.height=size;
   const context=output.getContext('2d');if(!context)throw Error('Canvas unavailable.');
   context.fillStyle='#000';context.fillRect(0,0,size,size);context.imageSmoothingEnabled=false;
   context.drawImage(renderer.surface,0,0,size,size);return output;
  },
  createCapture(){
   if(!latest?.hasMarket)throw Error('Load a coin and choose a test milestone first.');
   if(!latest.holderBalances.length)throw Error('Individual wallet balances are required to export this holder-based visual.');
   // Use the exact player renderer, with an independent fixed-size surface.
   // The on-page layout and live canvas are never resized or screen-captured.
   const holderAllocation=renderer.allocation;
   const holder=document.createElement('div'),capture=createEarthboundRenderer(holder,{maxDimension:2048,initialAllocation:holderAllocation});
   if(imageCoinKey===key)capture.setImage(identitySource);
   const output=document.createElement('canvas'),context=output.getContext('2d');
   if(!context){capture.close();throw Error('Canvas export is unavailable in this browser.');}
   const frozen=structuredClone(latest),phase=clock,coinSeed=seed;
   // Offscreen player canvases intentionally stop their animation. A media
   // export must instead start in the selected milestone's playing state.
   const targetIdentity=marketCapIdentity(frozen.marketCap),targetColour=frozen.marketCap>=5e7?1:0;
   const manifest={renderer:'earthbound-player',backend:capture.kind,phase,seed:coinSeed,holderAllocation,
    inputs:frozen,imageAvailable:Boolean(identitySource&&imageCoinKey===key),
    identity:targetIdentity,identityInput:targetIdentity,artworkColor:targetColour,transportPresence:1,presence:1,
    renderState:'settled-milestone-playing'};
   let previous=0,imageAmount=targetIdentity,imageInput=targetIdentity,colour=targetColour,colourElapsed=0,transport=1;
   return {
    canvas:output,manifest,
    frame(seconds,size=720){
     const dt=Math.max(0,seconds-previous);previous=seconds;
     imageInput+=(marketCapIdentity(frozen.marketCap)-imageInput)*(1-Math.exp(-dt/.16));
     imageAmount+=(imageInput-imageAmount)*(1-Math.exp(-dt/1.4));
     const colourTarget=frozen.marketCap>=5e7?1:0;
     colourElapsed+=dt;const steps=Math.floor(colourElapsed);
     if(steps){colourElapsed-=steps;colour+=(colourTarget-colour)*(1-Math.exp(-steps/1.4));}
     transport+=(1-transport)*(1-Math.exp(-dt/.08));
     capture.render({width:size,height:size,transitionTime:seconds,time:phase+seconds*1.35*frozen.tempo/100,seed:coinSeed,inputs:frozen,
      identity:imageAmount,artworkColor:colour,presence:1,pixelPresence:Math.max(.32,transport),inkColor:.18+.82*transport,reducedMotion:false});
     if(output.width!==size)output.width=size;if(output.height!==size)output.height=size;
     context.fillStyle='#000';context.fillRect(0,0,size,size);context.imageSmoothingEnabled=false;
     context.globalAlpha=frozen.fresh;context.drawImage(capture.surface,0,0,size,size);context.globalAlpha=1;
    },
    close(){capture.close();output.width=output.height=1;},
   };
  },
  snapshot(){return {...renderer.snapshot(),contentFrame:{mode:'full',x:0,y:0,side:width,referenceSide:width},renderer:'earthbound',time:clock,renderedAt,renderedPlaying,renderedCoinKey,sourceCoinKey,holderSnapshotReady:renderedHolderReady,holderFetchedAt:latest?.holderFetchedAt??null,marketObservedAt:latest?.marketObservedAt??null,marketCap:latest?.marketCap??null,liquidity:latest?.liquidity??null,holderSource:renderedHolderReady?'observed-wallet-sample':'unavailable',totalHolders:latest?.totalHolders??null,holderBalanceSource:latest?.holderBalanceSource??'unavailable',holderPrimaryProviderState:latest?.holderPrimaryProviderState??'unavailable',holderProviderState:latest?.holderProviderState??'unavailable',holderLoading:host.dataset.holderLoading==='true',holderCoverage:latest?.holderCoverage??'unavailable',audioReactive:false,transportPresence};},
  refresh(){lastRender=0;size();},reset,
  close(){closed=true;cancelAnimationFrame(raf);fullscreen.close();renderer.close();field.remove();delete host.dataset.visualFrame;host.style.removeProperty('--visual-reference-side');delete host.dataset.holderLoading;host.removeAttribute('aria-busy');resize.disconnect();observer?.disconnect();mobile.removeEventListener('change',arrange);window.removeEventListener('resize',size);document.removeEventListener('visibilitychange',visibility);anchor.parentNode?.insertBefore(host,anchor);anchor.remove();}
 };
}
