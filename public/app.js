import {createPd} from './vendor/libpd-wasm.js';
import {subscribePool} from './realtime.js?v=4';
import {subscribeEvm,EVM_RPC} from './evm.js?v=4';
import {MarketChart} from './chart.js?v=4';
import {pollPoolTrades} from './trades.js?v=4';
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let pd,ctx,gain,playing=false,starting=false,poll,market=null,mode='demo',generation=0,loading=false;
let seed=1917,state=1917,step=0,timer,next=0,bpm=120,recorder,chunks=[],session=null;
const controls=['master'];
let stopStream,streamConnected=false,poolEvents=[],lastSnapshot=0,streamPool='';
let streamKind='snapshot',tradeEvents=[],lastTrade=null,discovered=[],lastDemoPrice=100,lastExcitation=0;
const chart=new MarketChart($('market-chart'));
const levels={melody:0,pad:0,drums:0,bass:0,space:0};
const scale=[0,2,3,5,7,9,10];
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const rand=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
const status=s=>$('status').textContent=s;
function send(name,value){pd?.sendFloat(name,value);}
function event(name){pd?.sendBang(name);}
function metrics(){
 if(!market){const t=performance.now()/1000;return {motion:.3+.25*Math.sin(t/19),activity:.45+.25*Math.sin(t/31),balance:.5+.2*Math.sin(t/23),texture:.6,volume:.4+.3*Math.sin(t/27),fresh:1};}
 const tx=market.txns?.m5||{};const total=(tx.buys||0)+(tx.sells||0);
 tradeEvents=tradeEvents.filter(e=>Date.now()-e.receivedAt<30000);
 poolEvents=poolEvents.filter(e=>Date.now()-e.receivedAt<10000);
 const decoded=streamConnected&&(streamKind==='swap'||streamKind==='trade-poll');
 const first=tradeEvents[0],last=tradeEvents.at(-1),movement=first&&last?Math.abs((last.priceQuote/first.priceQuote-1)*100):0;
 const buys=tradeEvents.filter(e=>e.side==='buy').length;
 const observedVolume=tradeEvents.reduce((sum,e)=>sum+(e.usdVolume||0),0);
 const rate=decoded?tradeEvents.length/30:streamConnected&&streamKind==='pool'?poolEvents.length/10:total/300;
 const volumeRate=decoded?observedVolume/30:(Number(market.volume?.m5)||0)/300;
 return {motion:clamp((decoded?movement:Math.abs(Number(market.priceChange?.m5)||0))/8,0,1),activity:clamp(Math.log1p(rate)/Math.log(21),0,1),balance:decoded?(tradeEvents.length?buys/tradeEvents.length:.5):(total?(tx.buys||0)/total:.5),texture:clamp(Math.log10(Math.max(1,market.liquidity?.usd||1))/7,0,1),volume:clamp(Math.log1p(volumeRate)/Math.log(10001),0,1),fresh:clamp(1-(Date.now()-lastSnapshot-20000)/40000,0,1),decoded,observedVolume};
}
function syncLevels(m){
 const activity=m.activity*(streamConnected?1:m.fresh);
 const target={melody:(.12+.58*m.motion)*Math.sqrt(activity)*m.fresh,pad:.48*m.texture*Math.sqrt(activity)*m.fresh,drums:.7*activity,bass:.55*activity*(.4+.6*Math.abs(m.balance-.5)*2)*m.fresh,space:.75*m.texture*m.fresh};
 for(const name of Object.keys(levels)){if(name!=='space')target[name]*=Math.sqrt(m.volume*m.fresh);levels[name]+=(target[name]-levels[name])*.2;send(name,levels[name]);$(name).value=levels[name];$(name+'-value').textContent=Math.round(levels[name]*100)+'%';}
 $('energy-value').textContent=Math.round(m.volume*m.fresh*100)+'%';
 $('volume').textContent=market?cash(m.decoded?m.observedVolume:market.volume?.m5):'DEMO';
 $('volume-window').textContent=m.decoded?'OBSERVED USD · LAST 30 SEC':'TRADED USD · 5 MIN';
 $('signal-source').textContent=m.decoded?'Price, activity, direction and volume: observed trades / 30 sec. '+(streamKind==='swap'?'USD quote conversion and liquidity: snapshots.':'Trade USD values: provider; liquidity: snapshots.'):streamConnected&&streamKind==='pool'?'Activity: pool transactions / 10 sec. Price, volume and direction: 5-minute snapshots.':market?'Price, volume and activity: market snapshots / 5 min.':'Synthetic demo signals';
}
function setupStream(){
 const key=market?.chainId+':'+market?.pairAddress;if(key===streamPool)return;
 stopStream?.();streamPool=key;streamConnected=false;poolEvents=[];
 const gen=generation;
 let stopNative,stopFallback,nativeState={connected:false,kind:'snapshot',message:''},fallbackState={connected:false,kind:'snapshot',message:''};
 const signatures={rpc:new Set(),gecko:new Set()};
 const publish=()=>{
  const chosen=nativeState.connected&&nativeState.kind==='swap'?nativeState:fallbackState.connected&&fallbackState.kind==='trade-poll'?fallbackState:nativeState.connected&&nativeState.kind==='pool'?nativeState:fallbackState.message?fallbackState:nativeState;
  streamConnected=chosen.connected;streamKind=chosen.kind;$('feed').textContent=chosen.message;display();
 };
 const startFallback=()=>{if(stopFallback)return;stopFallback=pollPoolTrades(market,receive,s=>{if(gen!==generation)return;fallbackState=s;publish();});};
 const receive=e=>{
  if(gen!==generation)return;
  if(e.removed){tradeEvents=tradeEvents.filter(t=>t.id!==e.id);chart.remove(e.id);lastTrade=tradeEvents.at(-1)||null;session?.events?.push(e);$('last-event').textContent='Chain reorganization · removed swap';display();return;}
  if(e.kind==='swap'){
   const source=e.source||'rpc',other=source==='rpc'?'gecko':'rpc';
   if(!e.signature||signatures[other].has(e.signature))return;
   signatures[source].add(e.signature);if(signatures[source].size>4096)signatures[source].delete(signatures[source].values().next().value);
   const quoteUsd=Number(market.priceUsd)/Number(market.priceNative);
   if(source==='rpc'){e.priceUsd=quoteUsd>0&&Number.isFinite(quoteUsd)?e.priceQuote*quoteUsd:null;e.usdVolume=e.priceUsd?e.baseAmount*e.priceUsd:0;}
   tradeEvents.push(e);lastTrade=e;
   if(e.priceUsd)chart.add({at:e.receivedAt,price:e.priceUsd,id:e.id,source:'swap'});
   $('chart-source').textContent=source==='rpc'?'Streamed swap execution prices · USD estimated using latest quote conversion':'Observed trade prices · GeckoTerminal / 5s polling · provider USD values';
   $('last-event').textContent=e.side.toUpperCase()+' · block '+e.block;display();
  }else{poolEvents.push(e);if(streamKind==='pool')$('last-event').textContent='Pool event · slot '+e.slot;}
  session?.events?.push(e);
  if(playing&&performance.now()-lastExcitation>=40&&(e.kind==='swap'||streamKind==='pool')){lastExcitation=performance.now();syncLevels(metrics());const root=45+seed%12;send('note',root+12+scale[step%7]);event('pluck');}
 };
 if(market.chainId==='solana'){
  stopNative=subscribePool(market.pairAddress,receive,message=>{if(gen!==generation)return;nativeState={connected:message.startsWith('Connected'),kind:message.startsWith('Connected')?'pool':'snapshot',message};publish();});startFallback();
 }else{
  stopNative=subscribeEvm(market,receive,s=>{if(gen!==generation)return;nativeState=s;if(s.connected&&s.kind==='swap'){stopFallback?.();stopFallback=null;fallbackState={connected:false,kind:'snapshot',message:''};}else startFallback();publish();});
 }
 stopStream=()=>{stopNative?.();stopFallback?.();};
}
function tick(){
 const m=metrics(),energy=m.volume*m.fresh;syncLevels(m);bpm=Math.round(80+m.activity*70+energy*40);$('tempo').textContent=bpm+' BPM';
 const root=45+seed%12;const phrase=Math.floor(step/32)%4;const variation=phrase===1?2:0;
 const motif=[0,2,4,2,1,3,5,3];const index=(motif[Math.floor(step/2)%8]+variation+Math.round(m.motion*2))%7;
 if(step%2===0&&rand()<.25+m.activity*.55+energy*.2){send('note',root+12+scale[index]);event('pluck');}
 if(step%8===0){send('root',root+scale[phrase===3?0:phrase%3]);send('bassnote',root-12+(m.balance>.6?7:0));event('basshit');}
 if(step%8===0||(step%16===14&&rand()<m.activity)){event('kick');}
 if(step%8===4||(step%16>11&&rand()<m.motion*.55*energy)){event('snare');}
 if(rand()<.15+m.activity*.6+energy*.2){event('hat');}
 send('cutoff',900+m.texture*3100+energy*1800);step++;
}
function loop(){if(!playing)return;const now=performance.now();if(now>=next){tick();next=Math.max(next+60000/bpm/4,now+5);}timer=setTimeout(loop,12);}
async function initialize(){
 ctx=new AudioContext();await ctx.resume();
 const source=await fetch('patches/market.pd').then(r=>{if(!r.ok)throw Error('Cannot load instrument patch');return r.text();});
 pd=await createPd({audioContext:ctx,packages:['vanilla'],files:{'market.pd':source},entry:'market.pd',workletUrl:'vendor/libpd-worklet.js',onPrint:text=>console.log('[Pd]',text),onError:error=>status('Audio engine: '+error.message)});
 gain=ctx.createGain();gain.gain.value=0;pd.connect(gain);gain.connect(ctx.destination);
 for(const id of controls)send(id,Number($(id).value));
}
$('play').onclick=async()=>{
 if(starting)return;
 if(playing){playing=false;clearTimeout(timer);gain.gain.setTargetAtTime(0,ctx.currentTime,.025);$('play').textContent='▶ Listen';if(recorder?.state==='recording')recorder.stop();$('record').disabled=true;status('Paused');return;}
 starting=true;$('play').disabled=true;status('Opening instrument…');
 try{if(!pd)await initialize();await ctx.resume();gain.gain.setTargetAtTime(1,ctx.currentTime,.04);playing=true;next=performance.now();loop();$('play').textContent='Ⅱ Pause';$('record').disabled=false;status(mode==='demo'?'Playing · synthetic demo signals':'Playing · live market snapshots');}
 catch(e){status('Unable to start audio: '+e.message);if(pd)await pd.close();pd=null;await ctx?.close();ctx=null;}
 finally{starting=false;$('play').disabled=false;}
};
for(const id of controls)$(id).addEventListener('input',()=>{send(id,Number($(id).value));session?.controls.push({at:Date.now(),name:id,value:Number($(id).value)});});
const cash=n=>n!=null&&n!==''&&Number.isFinite(Number(n))?'$'+new Intl.NumberFormat('en',{maximumSignificantDigits:5}).format(n):'—';
const sameToken=(a,b)=>/^0x[0-9a-f]{40}$/i.test(b||'')?a?.toLowerCase()===b.toLowerCase():a===b;
function orientPair(pair,token){
 if(sameToken(pair.baseToken?.address,token))return pair;
 if(!sameToken(pair.quoteToken?.address,token))return null;
 const native=Number(pair.priceNative),usd=Number(pair.priceUsd),txns={};
 for(const [window,tx] of Object.entries(pair.txns||{}))txns[window]={buys:tx.sells,sells:tx.buys};
 return {...pair,baseToken:pair.quoteToken,quoteToken:pair.baseToken,priceNative:native>0?String(1/native):null,priceUsd:native>0&&usd>0?String(usd/native):null,txns,priceChange:{}};
}
function display(){
 $('mode').textContent=mode==='demo'?'DEMO SIGNAL':streamConnected&&streamKind==='swap'?'LIVE SWAPS':streamConnected&&streamKind==='trade-poll'?'TRADE POLLING · 5 SEC':streamConnected&&streamKind==='pool'?'POOL ACTIVITY + SNAPSHOTS':'MARKET SNAPSHOTS';
 $('coin-name').textContent=market?market.baseToken.symbol+' / '+market.quoteToken.symbol:'Untuned / Demo';
 $('chain').textContent=market?market.chainId.toUpperCase()+' · '+market.dexId.toUpperCase():'GENERATIVE SESSION';
 $('price').textContent=market?cash(streamConnected&&['swap','trade-poll'].includes(streamKind)&&lastTrade?.priceUsd?lastTrade.priceUsd:market.priceUsd):'—';$('change').textContent=market&&market.priceChange?.m5!=null?Number(market.priceChange.m5).toFixed(2)+'%':'—';
 const tx=market?.txns?.m5;$('trades').textContent=tx?(tx.buys||0)+(tx.sells||0):'—';$('liquidity').textContent=market?cash(market.liquidity?.usd):'—';
}
async function fetchJSON(url){const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),12000);try{const r=await fetch(url,{signal:abort.signal});if(!r.ok)throw Error('Market provider returned '+r.status);return await r.json();}finally{clearTimeout(timeout);}}
function applySnapshot(pair){
 market=pair;lastSnapshot=Date.now();
 if(!(streamConnected&&['swap','trade-poll'].includes(streamKind))){chart.add({at:Date.now(),price:Number(pair.priceUsd),source:'snapshot'});$('chart-source').textContent='Observed market snapshots · 5-second polling; provider data may be cached';}
 display();$('lookup').textContent='Snapshot '+new Date().toLocaleTimeString()+' · '+pair.baseToken.name+' · '+pair.chainId+' · '+pair.dexId;
 session?.snapshots.push({at:Date.now(),market:pair});
}
function chooseMarket(pair){
 generation++;clearTimeout(poll);stopStream?.();stopStream=null;streamPool='';streamConnected=false;streamKind='snapshot';poolEvents=[];tradeEvents=[];lastTrade=null;chart.reset();
 mode='live';market=pair;seed=hash(pair.chainId+':'+pair.baseToken.address);state=seed;step=0;applySnapshot(pair);setupStream();
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
 const address=$('address').value.trim();if(address.length<5||address.length>250||/\s/.test(address)){status('Enter a token address or chain-specific token identifier.');return;}
 loading=true;$('load').disabled=true;status('Looking up indexed markets…');
 try{
  const data=await fetchJSON('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(address));
  const pairs=(data.pairs||[]).map(p=>orientPair(p,address)).filter(Boolean);pairs.sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0));
  if(!pairs.length)throw Error('No indexed market found for this token identifier.');
  discovered=pairs;$('network').replaceChildren();for(const chain of [...new Set(pairs.map(p=>p.chainId))]){const o=document.createElement('option');o.value=chain;o.textContent=chain.toUpperCase()+' · '+(chain==='solana'?'pool stream + trade polling':EVM_RPC[chain]?'V2/V3 swap adapter':'trade polling / snapshots');$('network').append(o);}
  $('market-selectors').hidden=false;chooseMarket(pairs[0]);
 }catch(e){status(e.message);$('lookup').textContent=e.message;}
 finally{loading=false;$('load').disabled=false;}
};
$('network').onchange=()=>{const pair=discovered.find(p=>p.chainId===$('network').value);if(pair)chooseMarket(pair);};
$('pool').onchange=()=>{const pair=discovered.find(p=>p.chainId===$('network').value&&p.pairAddress===$('pool').value);if(pair)chooseMarket(pair);};
$('demo').onclick=()=>{generation++;clearTimeout(poll);stopStream?.();streamPool='';streamConnected=false;streamKind='snapshot';poolEvents=[];tradeEvents=[];lastTrade=null;chart.reset();$('market-selectors').hidden=true;market=null;mode='demo';seed=1917;state=seed;step=0;display();$('feed').textContent='Synthetic demo signals';$('last-event').textContent='No on-chain stream';$('lookup').textContent='Synthetic signals · enter a contract address for live market data';$('chart-source').textContent='Synthetic demo prices · no market feed';status(playing?'Playing · synthetic demo signals':'Demo ready');session?.controls.push({at:Date.now(),name:'demo'});};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.textContent='Download '+name;a.style.color='var(--accent)';a.style.fontSize='11px';a.style.display='block';$('downloads').append(a);}
const downloads=document.createElement('div');downloads.id='downloads';$('record').parentElement.after(downloads);
$('record').onclick=()=>{
 if(recorder?.state==='recording'){recorder.stop();return;}
 if(!window.MediaRecorder){status('Audio recording is unavailable in this browser.');return;}
 try{
 const destination=ctx.createMediaStreamDestination();gain.connect(destination);chunks=[];
 const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
 recorder=new MediaRecorder(destination.stream,mime?{mimeType:mime}:undefined);
 session={version:3,started:Date.now(),seed,randomState:state,step,mode,bpm,controls:controls.map(name=>({at:Date.now(),name,value:Number($(name).value)})),snapshots:market?[{at:Date.now(),market}]:[],events:[],patch:'market.pd / 001',mapping:'automatic-v3',source:streamKind,initialObservedSwaps:tradeEvents.slice()};
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{const name='AV-'+new Date(session.started).toISOString().replace(/[:.]/g,'-');download(new Blob(chunks,{type:recorder.mimeType}),name+(recorder.mimeType.includes('mp4')?'.m4a':'.webm'));download(new Blob([JSON.stringify(session,null,2)],{type:'application/json'}),name+'.json');gain.disconnect(destination);session=null;$('record').textContent='● Record';status('Recording ready to download · session log included');};
 recorder.start(1000);$('record').textContent='■ Finish';status('Recording audio and session changes…');
 }catch(e){status('Recording unavailable: '+e.message);}
};
display();
setInterval(()=>{if(!playing)syncLevels(metrics());},250);
setInterval(()=>{if(mode==='demo'){const t=performance.now()/1000;lastDemoPrice=100+2*Math.sin(t/19)+Math.sin(t/31);chart.add({at:Date.now(),price:lastDemoPrice,source:'demo'});$('chart-source').textContent='Synthetic demo prices · no market feed';}},1000);
