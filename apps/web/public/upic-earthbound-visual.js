// App integration of the agreed Earthbound engine. Only observed market inputs
// enter this path. The study's simulated liquidity/holder generator is not used.
import {createEarthboundRenderer} from './upic-earthbound-renderer.js?v=earthbound-5';
import {createVisualFullscreen} from './visual-fullscreen.js?v=141';
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
export function observedHolderBalances(m){
 // Counts or aggregate cluster percentages cannot reconstruct individual
 // holdings. Use only actual per-wallet values from the current snapshot.
 if(m.replay)return [];
 const audience=m.audience||{},relations=audience.relationships,records=[];
 if(Array.isArray(audience.holderBalances)&&audience.weight>0)records.push(...audience.holderBalances);
 else if(relations?.weight>0)for(const cluster of relations.clusters||[])for(const wallet of cluster.wallets||[]){
  records.push({id:wallet.address,balance:wallet.percentage});
 }
 const wallets=new Map();
 for(const record of records){
  const id=String(record.id??record.address??'').trim(),balance=finite(record.balance);
  if(!id||id.length>512||!(balance>0))continue;
  // Repeated appearances of one address are not extra wallets or extra funds.
  const key=/^0x[0-9a-f]{40}$/i.test(id)?id.toLowerCase():id;
  wallets.set(key,Math.max(balance,wallets.get(key)||0));
 }
 return [...wallets].map(([id,balance])=>({id,balance})).sort((a,b)=>b.balance-a.balance||a.id.localeCompare(b.id)).slice(0,128);
}
export function earthboundMarketState(m={},coinKey='unselected'){
 const marketCap=finite(m.context?.latestCap),liquidity=m.availability?.liquidity===false?null:finite(m.observation?.liquidity);
 return {coinKey,marketCap:marketCap>0?marketCap:null,liquidity:liquidity!==null&&liquidity>=0?liquidity:null,
  holderBalances:observedHolderBalances(m),holderSource:'observed',change:finite(m.music?.changePct)??0,
  tempo:Math.max(10,Math.min(240,finite(m.music?.tempo)??40)),fresh:unit(m.fresh),
  hasMarket:marketCap>0||finite(m.context?.latestPrice)>0||finite(m.replay?.price)>0||finite(m.context?.path?.at(-1)?.close)>0};
}
export function createEarthboundVisual(canvas,{getState=()=>({})}={}){
 const host=canvas?.closest('.audio-visualizer');
 if(!host)return {frame(){},event(){},pulse(){},piano(){},setImage(){},snapshot(){return null;},refresh(){},reset(){},close(){}};
 const overlay=canvas.getContext('2d'),renderer=createEarthboundRenderer(host),fullscreen=createVisualFullscreen(host);
 const anchor=document.createComment('earthbound visual home');host.after(anchor);
 const mobile=matchMedia('(max-width:760px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let latest=null,settings={},key='',seed=0,clock=0,presence=0,transportPresence=0,identity=0,identityInput=0,color=0,colorTarget=0;
 let staleElapsed=0,colorElapsed=0,last=0,lastRender=0,raf=0,closed=false,visible=true,width=0,height=0,sourceCursor=null;
 let sourceValue=null,sourceAt=0,imageCoinKey='';
 function reset(){clock=0;transportPresence=0;presence=latest?.fresh>0?1:0;identity=identityInput=0;color=0;staleElapsed=colorElapsed=0;sourceCursor=null;last=lastRender=0;renderer.clear();}
 function size(){
  const form=document.getElementById('coin-form');
  const top=mobile.matches?0:Math.max(0,Math.round((form?.getBoundingClientRect().top??0)+scrollY-(parseFloat(getComputedStyle(form||host).marginTop)||0)+(parseFloat(getComputedStyle(host).marginTop)||0)));
  host.style.setProperty('--visual-top',top+'px');
  host.style.setProperty('--visual-height',Math.max(180,Math.round(mobile.matches?innerHeight*.56:innerHeight-top))+'px');
  const box=canvas.getBoundingClientRect();width=Math.max(0,Math.round(box.width));height=Math.max(0,Math.round(box.height));}
 function arrange(){
  const title=document.querySelector('.coin-title');
  if(!host.classList.contains('is-expanded')){if(mobile.matches&&title){if(host.parentElement!==title)title.prepend(host);}else anchor.parentNode?.insertBefore(host,anchor);}
  size();
 }
 const resize=new ResizeObserver(size);resize.observe(host);const header=document.querySelector('.market-header');if(header)resize.observe(header);
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;last=0;}):null;observer?.observe(host);
 const visibility=()=>{last=0;size();};
 mobile.addEventListener('change',arrange);window.addEventListener('resize',size);document.addEventListener('visibilitychange',visibility);arrange();
 function draw(now){
  if(closed)return;raf=requestAnimationFrame(draw);
  const dt=last?Math.min(.1,Math.max(0,(now-last)/1000)):0;last=now;
  if(document.hidden||!visible||width<1||height<1||!latest?.hasMarket)return;
  const state=getState(),playing=state.playing&&settings.playing!==false&&!settings.seeking&&!settings.ended;
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
    if(color!==colorTarget){colorElapsed+=dt;const steps=Math.floor(colorElapsed);if(steps){colorElapsed-=steps;color+=(colorTarget-color)*(1-Math.exp(-steps/1.4));if(Math.abs(color-colorTarget)<.00001)color=colorTarget;}}
    else colorElapsed=0;
   }
  }
  // Transport controls the original dim/sparse resting state; audio gain
  // and metering remain completely independent of the visual engine.
  if(now-lastRender<1000/(renderer.kind==='canvas'?15:60))return;lastRender=now;
  overlay?.clearRect(0,0,canvas.width,canvas.height);
  renderer.render({width,height,time:clock,seed,inputs:latest,identity,artworkColor:color,presence,pixelPresence:Math.max(.32,transportPresence),inkColor:.18+.82*transportPresence,reducedMotion:reduced.matches});
  host.dataset.visible='true';
  Object.assign(canvas.dataset,{composition:'earthbound',active:String(playing),visible:'true',moving:String(playing&&fresh&&!reduced.matches),motion:clock.toFixed(4),level:'0',holderSource:latest.holderBalances.length?'observed-wallet-sample':'unavailable-equal-sizes',marketCapState:latest.marketCap===null?'unavailable':'observed',liquidityState:latest.liquidity===null?'unavailable':'observed'});
 }
 raf=requestAnimationFrame(draw);
 return {
  frame(m={},options={}){
   const nextKey=identityKey(getState().coinKey),changed=nextKey!==key,wasFresh=latest?.fresh;
   const backwards=options.clock!=null&&settings.clock!=null&&options.clock<settings.clock;
   if(options.clock!==sourceValue){sourceValue=options.clock==null?null:Number(options.clock);sourceAt=performance.now();}
   key=nextKey;seed=seedFor(key);settings=options;latest=earthboundMarketState(m,key);
   if(changed&&imageCoinKey!==key)renderer.setImage(null);
   if(changed||backwards||options.seeking){reset();presence=latest.fresh>0?1:0;identity=identityInput=marketCapIdentity(latest.marketCap);}
   if((wasFresh>0)!==(latest.fresh>0))staleElapsed=0;
   const target=latest.marketCap>=1e8?1:0;if(target!==colorTarget){colorTarget=target;colorElapsed=0;}
   if(!latest.hasMarket)renderer.clear();
  },
  // Keep the app's audio callback interface without coupling sound to ink.
  event(){},pulse(){},piano(){},
  setImage(image){renderer.setImage(image);imageCoinKey=identityKey(getState().coinKey);},
  snapshot(){return {...renderer.snapshot(),renderer:'earthbound',time:clock,marketCap:latest?.marketCap??null,liquidity:latest?.liquidity??null,holderSource:latest?.holderBalances.length?'observed-wallet-sample':'unavailable',audioReactive:false,transportPresence};},
  refresh(){lastRender=0;size();},reset,
  close(){closed=true;cancelAnimationFrame(raf);fullscreen.close();renderer.close();resize.disconnect();observer?.disconnect();mobile.removeEventListener('change',arrange);window.removeEventListener('resize',size);document.removeEventListener('visibilitychange',visibility);anchor.parentNode?.insertBefore(host,anchor);anchor.remove();}
 };
}
