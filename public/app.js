import {createPd} from './vendor/libpd-wasm.js';
import {subscribePool} from './realtime.js?v=3';
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let pd,ctx,gain,playing=false,starting=false,poll,market=null,mode='demo',generation=0,loading=false;
let seed=1917,state=1917,step=0,timer,next=0,bpm=120,recorder,chunks=[],session=null;
const controls=['master'];
let stopStream,streamConnected=false,poolEvents=[],lastSnapshot=0,streamPool='';
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
 poolEvents=poolEvents.filter(e=>Date.now()-e.receivedAt<10000);
 return {motion:clamp(Math.abs(Number(market.priceChange?.m5)||0)/8,0,1),activity:streamConnected?clamp(Math.log1p(poolEvents.length)/Math.log(51),0,1):clamp(Math.log1p(total)/Math.log(1001),0,1),balance:total?(tx.buys||0)/total:.5,texture:clamp(Math.log10(Math.max(1,market.liquidity?.usd||1))/7,0,1),volume:clamp(Math.log1p(Number(market.volume?.m5)||0)/Math.log(100001),0,1),fresh:clamp(1-(Date.now()-lastSnapshot-20000)/40000,0,1)};
}
function syncLevels(m){
 const activity=m.activity*(streamConnected?1:m.fresh);
 const target={melody:(.12+.58*m.motion)*Math.sqrt(activity)*m.fresh,pad:.48*m.texture*Math.sqrt(activity)*m.fresh,drums:.7*activity,bass:.55*activity*(.4+.6*Math.abs(m.balance-.5)*2)*m.fresh,space:.75*m.texture*m.fresh};
 for(const name of Object.keys(levels)){if(name!=='space')target[name]*=Math.sqrt(m.volume*m.fresh);levels[name]+=(target[name]-levels[name])*.2;send(name,levels[name]);$(name).value=levels[name];$(name+'-value').textContent=Math.round(levels[name]*100)+'%';}
 $('energy-value').textContent=Math.round(m.volume*m.fresh*100)+'%';
 $('volume').textContent=market?cash(market.volume?.m5):'DEMO';
}
function setupStream(){
 const key=market?.chainId+':'+market?.pairAddress;if(key===streamPool)return;
 stopStream?.();streamPool=key;streamConnected=false;poolEvents=[];
 if(market?.chainId!=='solana'){$('feed').textContent='5-second snapshots · streaming currently Solana only';return;}
 stopStream=subscribePool(market.pairAddress,e=>{poolEvents.push(e);$('last-event').textContent='Pool event · slot '+e.slot;session?.events?.push(e);if(playing){const root=45+seed%12;send('note',root+12+scale[step%7]);event('pluck');}},message=>{streamConnected=message.startsWith('Connected');$('feed').textContent=message;});
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
const cash=n=>Number.isFinite(Number(n))?'$'+new Intl.NumberFormat('en',{maximumSignificantDigits:5}).format(n):'—';
function display(){
 $('mode').textContent=mode==='demo'?'DEMO SIGNAL':'LIVE SNAPSHOTS';
 $('coin-name').textContent=market?market.baseToken.symbol+' / '+market.quoteToken.symbol:'Untuned / Demo';
 $('chain').textContent=market?market.chainId.toUpperCase()+' · '+market.dexId.toUpperCase():'GENERATIVE SESSION';
 $('price').textContent=market?cash(market.priceUsd):'—';$('change').textContent=market&&market.priceChange?.m5!=null?Number(market.priceChange.m5).toFixed(2)+'%':'—';
 const tx=market?.txns?.m5;$('trades').textContent=tx?(tx.buys||0)+(tx.sells||0):'—';$('liquidity').textContent=market?cash(market.liquidity?.usd):'—';
}
async function lookup(address,gen,initial=false){
 const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),12000);
 try{
  const response=await fetch('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(address),{signal:abort.signal});
  if(!response.ok)throw Error('Market provider returned '+response.status);
  const data=await response.json();if(gen!==generation)return;
  const evm=address.startsWith('0x');
  const exact=(data.pairs||[]).filter(p=>evm?p.baseToken?.address.toLowerCase()===address.toLowerCase():p.baseToken?.address===address);
  exact.sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0));
  if(!exact.length)throw Error('No supported market found for this token contract. Enter a token address, rather than a pool address.');
  market=exact[0];mode='live';lastSnapshot=Date.now();setupStream();
  if(initial){seed=hash(market.chainId+':'+address);state=seed;step=0;session?.controls.push({at:Date.now(),name:'coin',address,chain:market.chainId});}
  display();$('lookup').textContent='Updated '+new Date().toLocaleTimeString()+' · '+market.baseToken.name+' · '+market.chainId+' · '+market.dexId;
  status(playing?'Playing · live market snapshots':'Market loaded · press Listen');session?.snapshots.push({at:Date.now(),market});return true;
 }catch(e){if(gen!==generation)return;if(initial){status(e.message);$('lookup').textContent=e.message;}else{status('Market update unavailable · holding last snapshot');$('lookup').textContent='Feed delayed: '+e.message;}}
 finally{clearTimeout(timeout);}
}
$('coin-form').onsubmit=async e=>{
 e.preventDefault();if(loading)return;
 const address=$('address').value.trim();if(!/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(address)){status('Enter a valid EVM or Solana token contract address.');return;}
 loading=true;$('load').disabled=true;clearTimeout(poll);const gen=++generation;status('Looking up market…');
 const loaded=await lookup(address,gen,true);
 const refresh=async()=>{await lookup(address,gen);if(gen===generation)poll=setTimeout(refresh,5000);};
 if(gen===generation&&loaded)poll=setTimeout(refresh,5000);
 loading=false;$('load').disabled=false;
};
$('demo').onclick=()=>{generation++;clearTimeout(poll);stopStream?.();streamPool='';streamConnected=false;poolEvents=[];market=null;mode='demo';seed=1917;state=seed;step=0;display();$('feed').textContent='Synthetic demo signals';$('last-event').textContent='No on-chain stream';$('lookup').textContent='Synthetic signals · enter a contract address for live market data';status(playing?'Playing · synthetic demo signals':'Demo ready');session?.controls.push({at:Date.now(),name:'demo'});};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.textContent='Download '+name;a.style.color='var(--accent)';a.style.fontSize='11px';a.style.display='block';$('downloads').append(a);}
const downloads=document.createElement('div');downloads.id='downloads';$('record').parentElement.after(downloads);
$('record').onclick=()=>{
 if(recorder?.state==='recording'){recorder.stop();return;}
 if(!window.MediaRecorder){status('Audio recording is unavailable in this browser.');return;}
 try{
 const destination=ctx.createMediaStreamDestination();gain.connect(destination);chunks=[];
 const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
 recorder=new MediaRecorder(destination.stream,mime?{mimeType:mime}:undefined);
 session={version:2,started:Date.now(),seed,randomState:state,step,mode,bpm,controls:controls.map(name=>({at:Date.now(),name,value:Number($(name).value)})),snapshots:market?[{at:Date.now(),market}]:[],events:[],patch:'market.pd / 001',mapping:'automatic-v2'};
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{const name='AV-'+new Date(session.started).toISOString().replace(/[:.]/g,'-');download(new Blob(chunks,{type:recorder.mimeType}),name+(recorder.mimeType.includes('mp4')?'.m4a':'.webm'));download(new Blob([JSON.stringify(session,null,2)],{type:'application/json'}),name+'.json');gain.disconnect(destination);session=null;$('record').textContent='● Record';status('Recording ready to download · session log included');};
 recorder.start(1000);$('record').textContent='■ Finish';status('Recording audio and session changes…');
 }catch(e){status('Recording unavailable: '+e.message);}
};
display();
setInterval(()=>{if(!playing)syncLevels(metrics());},250);
