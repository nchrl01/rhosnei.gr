// App integration of the agreed Earthbound engine. Only observed market inputs
// enter this path. The study's simulated liquidity/holder generator is not used.
import {createEarthboundRenderer} from './upic-oct07-renderer.js?v=446';
import {createVisualFullscreen} from './visual-fullscreen.js?v=421';
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
  // Snapshot totals are historical aggregates, not evidence of a new trade.
  tradingActivity:m.replay?unit(Number(m.replay.volume)>0||m.replay.volume==null&&m.raw?.motion>0?1:0):unit(m.tradingActivity),
  hasMarket:marketCap>0||finite(m.context?.latestPrice)>0||finite(m.replay?.price)>0||finite(m.context?.path?.at(-1)?.close)>0};
}
export function createEarthboundVisual(canvas,{getState=()=>({})}={}){
 const host=canvas?.closest('.audio-visualizer');
 if(!host)return {frame(){},event(){},pulse(){},piano(){},setImage(){},imageUnavailable(){},snapshot(){return null;},refresh(){},reset(){},close(){}};
 // Keep the field in the host's full rectangle, without cropping to mark bounds.
 const field=document.createElement('div');field.className='visual-content-frame';host.append(field);host.dataset.visualFrame='full';
 const loader=document.createElement('div');loader.className='visual-loader';loader.setAttribute('role','status');loader.setAttribute('aria-live','polite');
 const loaderDots=document.createElement('span');loaderDots.className='visual-loader__dots';loaderDots.setAttribute('aria-hidden','true');
 for(let i=0;i<4;i++)loaderDots.append(document.createElement('span'));
 const loaderLabel=document.createElement('span');loaderLabel.className='visual-loader__label';loaderLabel.textContent='Loading visual';loader.append(loaderDots,loaderLabel);host.append(loader);
 const overlay=canvas.getContext('2d'),renderer=createEarthboundRenderer(field),fullscreen=createVisualFullscreen(host,{referenceSide});
 const anchor=document.createComment('earthbound visual home');host.after(anchor);
 let initialHoldersReady=false,initialLoadShown=false,awaitingHolderRender=false,holderRevealStarted=null;
 function syncHolderLoading(rendered=false,now=performance.now()){
  if(latest?.liveHolders&&(latest.totalHolders>0||latest.holderFetchSettled&&latest.holderBalances.length>0)&&!initialHoldersReady){
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
  host.dataset.holderLoading=String(loading);
 }

 const mobile=matchMedia('(max-width:760px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let latest=null,settings={},key='',seed=0,clock=0,presence=0,transportPresence=0,identity=0,identityInput=0,color=0,colorTarget=0;
 let colorStart=0,colorDuration=2.4,motionActivity=0,marketFrameAt=0;
 let staleElapsed=0,colorElapsed=0,last=0,lastRender=0,raf=0,closed=false,visible=true,width=0,height=0,sourceCursor=null;
 let sourceValue=null,sourceAt=0,imageCoinKey='',identitySource=null,imageSettled=false,imageReveal=0;
 let transportTarget=0,transportFrom=0,transportElapsed=0,transportHasPlayed=false;
 let renderedAt=0,renderedPlaying=false,renderedCoinKey='',sourceCoinKey='',renderedHolderReady=false;
 let visualReady=false,loaderHasPlayed=false,loaderSignature='',loaderRevealUntil=0;
 function syncVisualLoading(){
  if(visualReady&&loaderSignature==='hidden')return;
  const state=getState(),playing=Boolean(state.playing);
  if(playing)loaderHasPlayed=true;
  const stopped=loaderHasPlayed&&!playing||settings.seeking||settings.ended;
  const current=identityKey(state.coinKey)===key;
  if(!visualReady&&current&&renderedCoinKey===key&&renderedAt&&imageSettled&&imageCoinKey===key&&imageReveal>=1&&host.dataset.holderLoading!=='true'&&renderer.snapshot().markCount>0){visualReady=true;loaderRevealUntil=reduced.matches||stopped?0:performance.now()+400;}
  const unavailable=Boolean(current&&latest?.hasMarket&&latest.liveHolders&&!initialHoldersReady&&latest.holderFetchSettled&&!latest.holderFetchLoading);
  const pending=!visualReady&&!stopped;
  const revealing=visualReady&&!stopped&&performance.now()<loaderRevealUntil;
  const signature=pending?(unavailable?'unavailable':'loading'):revealing?'revealing':'hidden';
  if(signature===loaderSignature)return;
  loaderSignature=signature;
  loader.hidden=!pending&&!revealing;
  loader.dataset.state=signature;
  const label=revealing?'Visual ready':unavailable?'Visual unavailable':'Loading visual';if(loaderLabel.textContent!==label)loaderLabel.textContent=label;
  host.dataset.visualLoading=String(pending&&!unavailable);host.setAttribute('aria-busy',String(pending&&!unavailable));
 }
 function reset(){clock=0;motionActivity=0;transportPresence=transportTarget=transportFrom=transportElapsed=0;transportHasPlayed=false;imageReveal=0;presence=latest?.fresh>0?1:0;identity=identityInput=0;color=colorStart=0;colorTarget=0;staleElapsed=colorElapsed=0;sourceCursor=null;last=lastRender=0;renderedAt=0;renderedPlaying=false;renderedCoinKey=sourceCoinKey='';renderedHolderReady=false;renderer.clear();}
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
  // Both player and expanded view use the host's full content rectangle.
  const style=getComputedStyle(host);
  width=Math.max(1,box.width-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0));
  height=Math.max(1,box.height-(parseFloat(style.paddingTop)||0)-(parseFloat(style.paddingBottom)||0));
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
  syncVisualLoading();
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
  // Ease into activity, then settle gently. A stopped input loop must also
  // decay; the animation loop itself is never evidence of a live market.
  const inputAge=Math.max(0,(now-marketFrameAt)/1000);
  const inputFreshness=inputAge<30?Math.exp(-Math.max(0,inputAge-2)/8):0;
  const motionTarget=latest.tradingActivity*latest.fresh*inputFreshness;
  motionActivity+=(motionTarget-motionActivity)*(1-Math.exp(-dt/(motionTarget>motionActivity ? .45 : 2.4)));
  if(motionActivity<.00001)motionActivity=0;
  const motionRate=.12+.88*motionActivity;
  // Pause keeps the field coasting as its light dies away. An uninterrupted
  // envelope also lets Play reverse a fade without jumping to full brightness.
  const nextTransport=playing?1:0;
  if(nextTransport!==transportTarget){transportFrom=transportPresence;transportTarget=nextTransport;transportElapsed=0;}
  if(playing)transportHasPlayed=true;
  transportElapsed+=dt;
  const transportProgress=unit(transportElapsed/(reduced.matches ? .2 : playing ? .25 : 2.4));
  const transportEase=transportProgress*transportProgress*(3-2*transportProgress);
  transportPresence=transportFrom+(transportTarget-transportFrom)*transportEase;
  const transportInk=transportHasPlayed?transportPresence:.35;
  const transportStyle=transportInk.toFixed(3);
  if(host.style.getPropertyValue('--visual-transport-ink')!==transportStyle)host.style.setProperty('--visual-transport-ink',transportStyle);
  // The holder count often arrives before the artwork. Do not paint a
  // temporary unreferenced pattern while the real image is still decoding.
  if(imageCoinKey!==key||!imageSettled){
   host.dataset.visualState='loading-artwork';return;
  }
  host.dataset.visualState='ready';
  imageReveal=Math.min(1,imageReveal+dt/.3);
  if(playing){
   if(latest.fresh<presence){staleElapsed+=dt;const steps=Math.floor(staleElapsed);if(steps){staleElapsed-=steps;presence+=(latest.fresh-presence)*(1-Math.exp(-steps/marketCapReleaseSeconds(latest.marketCap)));}}
   else{staleElapsed=0;presence+=(latest.fresh-presence)*(1-Math.exp(-dt/.08));}
   if(presence<.0001)presence=0;
   // Keep a gentle ambient drift even when fresh activity has faded away.
   // The data-driven acceleration still requires observed market activity.
   {
    let elapsed=dt;
    if(settings.clock!=null){
     const cursor=sourceValue+Math.min(.25,Math.max(0,(now-sourceAt)/1000))*Math.max(0,Number(settings.rate)||1);
     elapsed=sourceCursor===null?0:Math.max(0,cursor-sourceCursor);sourceCursor=Math.max(sourceCursor??cursor,cursor);
    }else sourceCursor=null;
    if(!reduced.matches)clock+=elapsed*1.35*latest.tempo/100*motionRate;
   }
   if(fresh){
    const target=marketCapIdentity(latest.marketCap);
    identityInput+=(target-identityInput)*(1-Math.exp(-dt/.16));identity+=(identityInput-identity)*(1-Math.exp(-dt/1.4));
    if(color!==colorTarget){colorElapsed+=dt;const progress=Math.min(1,Math.floor(colorElapsed/.25)*.25/colorDuration);color=colorStart+(colorTarget-colorStart)*progress*progress*(3-2*progress);if(colorElapsed>=colorDuration)color=colorTarget;}
    else colorElapsed=0;
   }
  }
  if(!playing&&transportPresence>0&&!reduced.matches)clock+=dt*1.35*latest.tempo/100*transportPresence*motionRate;
  // A new coin has a resting preview. Once played, Stop fades all the way out.
  // Keep population and placement stable throughout the fade.
  const frameInterval=1000/(renderer.kind==='canvas'?30:60);
  if(now-lastRender<frameInterval)return;lastRender=now-(now-lastRender)%frameInterval;
  overlay?.clearRect(0,0,canvas.width,canvas.height);
  renderer.render({width,height,time:clock,seed,inputs:latest,identity,artworkColor:color,presence:presence*imageReveal,pixelPresence:1,inkColor:transportInk,reducedMotion:reduced.matches});
  syncHolderLoading(true,now);
  renderedAt=Date.now();renderedPlaying=Boolean(playing&&fresh);renderedCoinKey=key;sourceCoinKey=String(state.coinKey||'unselected');
  renderedHolderReady=Boolean(initialHoldersReady&&latest.liveHolders&&(latest.totalHolders>0||latest.holderBalances.length)&&host.dataset.holderLoading!=='true');
  syncVisualLoading();
  host.dataset.pixelBlast=renderer.kind==='canvas'?'canvas':'ready';
  host.dataset.visible='true';
  Object.assign(canvas.dataset,{composition:'earthbound',active:String(playing),visible:'true',moving:String((playing||transportPresence>0)&&!reduced.matches),motion:clock.toFixed(4),motionRate:motionRate.toFixed(4),marketActivity:motionActivity.toFixed(4),level:'0',holderSource:latest.holderBalances.length?'observed-wallet-sample':'unavailable',marketCapState:latest.marketCap===null?'unavailable':'observed',liquidityState:latest.liquidity===null?'unavailable':'observed'});
 }
 raf=requestAnimationFrame(draw);
 return {
  frame(m={},options={}){
   const nextKey=identityKey(getState().coinKey),changed=nextKey!==key,wasFresh=latest?.fresh;
   const backwards=options.clock!=null&&settings.clock!=null&&options.clock<settings.clock;
   if(options.clock!==sourceValue){sourceValue=options.clock==null?null:Number(options.clock);sourceAt=performance.now();}
   if(changed){initialHoldersReady=false;initialLoadShown=false;awaitingHolderRender=false;holderRevealStarted=null;visualReady=false;loaderHasPlayed=false;loaderRevealUntil=0;}
   key=nextKey;seed=seedFor(key);settings=options;marketFrameAt=performance.now();latest=earthboundMarketState(m,key);latest.change=Math.sign(Number(getState().markDirection)||0);
   syncHolderLoading();
   if(changed&&imageCoinKey!==key){identitySource=null;imageSettled=false;renderer.setImage(null);}
   if(changed||backwards||options.seeking){reset();presence=latest.fresh>0?1:0;identity=identityInput=marketCapIdentity(latest.marketCap);color=colorTarget=latest.marketCap>=5e7?1:0;}
   if((wasFresh>0)!==(latest.fresh>0))staleElapsed=0;
   const target=latest.marketCap>=5e7?1:0;if(target!==colorTarget){colorStart=color;colorTarget=target;colorElapsed=0;colorDuration=Math.max(1.5,2.4*(1.5-.75*latest.activity));}
   if(!latest.hasMarket){renderer.clear();renderedAt=0;renderedPlaying=false;renderedHolderReady=false;}
   syncVisualLoading();
  },
  // Keep the app's audio callback interface without coupling sound to ink.
  event(){},pulse(){},piano(){},
  setImage(image){
   identitySource=image;imageCoinKey=identityKey(getState().coinKey);imageSettled=Boolean(image);imageReveal=0;
   renderer.clear();renderer.setImage(image);
  },
  imageUnavailable(rawKey){
   const currentKey=identityKey(rawKey);
   if(currentKey!==identityKey(getState().coinKey)||identitySource&&imageCoinKey===currentKey)return;
   imageCoinKey=currentKey;imageSettled=true;
  },
  captureStill(size=512){
   const state=getState(),age=Date.now()-renderedAt;
   if(!renderedAt||age<0||age>2000||!renderedPlaying||!state.playing||settings.playing===false||settings.seeking||settings.ended||!latest?.hasMarket||!latest.liveHolders||!latest.fresh||!renderedHolderReady||host.dataset.holderLoading==='true'||renderedCoinKey!==key||sourceCoinKey!==String(state.coinKey||'unselected')||transportPresence<.99||imageReveal<1||!imageSettled)throw Error('A current live playing holder frame is required to capture.');
   // Capture the actual live shape, including directional price movement.
   const output=document.createElement('canvas');output.width=output.height=size;
   const context=output.getContext('2d');if(!context)throw Error('Canvas unavailable.');
   context.fillStyle='#000';context.fillRect(0,0,size,size);context.imageSmoothingEnabled=false;
   context.drawImage(renderer.surface,0,0,size,size);return output;
  },
  createCapture(){
   if(!latest?.hasMarket)throw Error('Load a coin and choose a test milestone first.');
   if(!(latest.totalHolders>0)&&!latest.holderBalances.length&&!latest.chartHistory?.length)throw Error('A holder count or replay history is required to export this visual.');
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
  snapshot(){return {...renderer.snapshot(),contentFrame:{mode:'full',x:0,y:0,side:width,referenceSide:width},renderer:'earthbound',time:clock,renderedAt,renderedPlaying,renderedCoinKey,sourceCoinKey,holderSnapshotReady:renderedHolderReady,holderFetchedAt:latest?.holderFetchedAt??null,marketObservedAt:latest?.marketObservedAt??null,marketCap:latest?.marketCap??null,liquidity:latest?.liquidity??null,holderSource:renderedHolderReady?'observed-wallet-sample':'unavailable',totalHolders:latest?.totalHolders??null,holderBalanceSource:latest?.holderBalanceSource??'unavailable',holderPrimaryProviderState:latest?.holderPrimaryProviderState??'unavailable',holderProviderState:latest?.holderProviderState??'unavailable',holderLoading:host.dataset.holderLoading==='true',holderCoverage:latest?.holderCoverage??'unavailable',audioReactive:false,marketActivity:motionActivity,motionRate:.12+.88*motionActivity,transportPresence};},
  refresh(){lastRender=0;size();},reset,
  close(){closed=true;cancelAnimationFrame(raf);fullscreen.close();renderer.close();field.remove();loader.remove();delete host.dataset.visualLoading;delete host.dataset.visualFrame;host.style.removeProperty('--visual-reference-side');host.style.removeProperty('--visual-transport-ink');delete host.dataset.visualState;delete host.dataset.holderLoading;host.removeAttribute('aria-busy');resize.disconnect();observer?.disconnect();mobile.removeEventListener('change',arrange);window.removeEventListener('resize',size);document.removeEventListener('visibilitychange',visibility);anchor.parentNode?.insertBefore(host,anchor);anchor.remove();}
 };
}
