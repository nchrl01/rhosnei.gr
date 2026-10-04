import {MILESTONES,CHAPTERS,createCollection,observe,identity,seedOf,random,chapterOf,simulateMint,primarySplit,score,positive,validCollection} from './collection-model.js?v=1';
const $=id=>document.getElementById(id),money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const storageKey='upic-collection-experiment-v1';
let collections={},storageOK=true;
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');for(const [key,value] of Object.entries(saved))try{if(validCollection(value)&&value.id===key)collections[key]=value;}catch{}}catch{storageOK=false;}
let market=null,current=null,preview=null,controller=null,revision=0,timer=null,cooldown=0,ctx=null,master=null,playing=false,audioBusy=false,scheduler=null,cycle=0,originTime=0,nextNote=0,currentScore=null,artTime=0,raf=null;
const voices=new Set(),canvas=$('art'),paint=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const setNotice=text=>{$('notice').textContent=text;};
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(collections));}catch{storageOK=false;setNotice('Browser storage is unavailable. Download your score to keep it.');}showSaved();}
function showSaved(){
 $('saved-list').replaceChildren();
 for(const c of Object.values(collections)){
  const button=document.createElement('button');button.textContent=c.symbol+' · '+c.chain+' · '+c.minted+'/100';
  button.onclick=()=>{cancelLookup();choose({chainId:c.chain,pairAddress:c.pool,marketCap:c.latest,baseToken:{address:c.address,name:c.name,symbol:c.symbol}},false);};$('saved-list').append(button);
 }
 if(!Object.keys(collections).length)$('saved-list').textContent=storageOK?'No collections originated yet.':'Local storage unavailable.';
}
function cancelLookup(){controller?.abort();controller=null;clearTimeout(timer);timer=null;revision++;}
async function request(url,signal){
 if(Date.now()<cooldown)throw Error('Provider is cooling down. Automatic retry will follow.');
 const response=await fetch(url,{signal,headers:{Accept:'application/json'}});
 if(response.status===429||response.status===503){const retry=response.headers.get('retry-after'),seconds=Number(retry);cooldown=Date.now()+(retry&&Number.isFinite(seconds)?Math.max(10,seconds)*1000:Math.max(30000,Date.parse(retry||'')-Date.now()||0));throw Error('Market data temporarily limited. Retrying automatically.');}
 if(!response.ok)throw Error('Market data unavailable ('+response.status+').');return response.json();
}
const same=(a,b)=>/^0x[0-9a-f]{40}$/i.test(a||'')?a.toLowerCase()===(b||'').toLowerCase():a===b;
async function lookup(address){
 cancelLookup();const rev=revision;controller=new AbortController();const abort=controller;
 $('find').disabled=true;setNotice('Finding token markets…');$('matches').replaceChildren();
 const timeout=setTimeout(()=>abort.abort(),15000);
 try{
  const data=await request('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(address),abort.signal);if(rev!==revision)return;
  const candidates=(data.pairs||[]).filter(p=>same(p.baseToken?.address,address)&&p.chainId&&p.pairAddress&&positive(p.marketCap));
  const chains=new Map();for(const p of candidates.sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0)))if(!chains.has(p.chainId))chains.set(p.chainId,p);
  if(!chains.size)throw Error('No exact token match with a reported market cap. Paste the token contract address; FDV is not used.');
  if(chains.size===1)choose([...chains.values()][0]);else{
   setNotice('This address exists on several networks. Choose the intended token.');
   for(const p of chains.values()){const button=document.createElement('button');button.textContent=p.baseToken.symbol+' / '+p.chainId+' / '+money(p.marketCap);button.onclick=()=>choose(p);$('matches').append(button);}
  }
 }catch(error){if(rev===revision)setNotice(error.name==='AbortError'?'Lookup timed out. Please try again.':error.message);}
 finally{clearTimeout(timeout);if(rev===revision){$('find').disabled=false;controller=null;}}
}
function choose(pair,fresh=true){
 cancelLookup();$('find').disabled=false;market={...pair};current=collections[identity(pair.chainId,pair.baseToken.address)]||null;preview=null;
 if(current&&fresh){current=observe(current,pair.marketCap);collections[current.id]=current;persist();}
 $('matches').replaceChildren();$('work').hidden=false;$('token').value=pair.baseToken.address;
 setNotice(current?'Your local collection is loaded.':'Token found. Preview its composition or originate a local collection.');
 render();restartScore();schedulePoll(fresh?30000:0);
}
function schedulePoll(delay=30000){clearTimeout(timer);if(market)timer=setTimeout(poll,Math.max(delay,cooldown-Date.now()));}
async function refreshMarket(){
 const rev=revision,pair=market;if(!pair)throw Error('Choose a token first.');
 const abort=new AbortController();controller?.abort();controller=abort;const timeout=setTimeout(()=>abort.abort(),15000);
 try{
  const data=await request('https://api.dexscreener.com/latest/dex/pairs/'+encodeURIComponent(pair.chainId)+'/'+encodeURIComponent(pair.pairAddress),abort.signal);
  if(rev!==revision)return false;
  const found=(data.pairs||[]).find(p=>p.chainId===pair.chainId&&same(p.pairAddress,pair.pairAddress)&&same(p.baseToken?.address,pair.baseToken.address));
  if(!found||!positive(found.marketCap))throw Error('Reported market cap unavailable. Keeping the last observation.');
  market=found;const before=current?chapterOf(current):0;
  if(current){current=observe(current,found.marketCap);collections[current.id]=current;persist();}
  render();if(preview===null&&current&&chapterOf(current)!==before)restartScore();return true;
 }finally{clearTimeout(timeout);if(controller===abort)controller=null;}
}
async function poll(){
 if(document.hidden){schedulePoll();return;}
 try{await refreshMarket();$('data-status').textContent='Provider snapshot · '+new Date().toLocaleTimeString()+' · refreshes every 30 seconds';}
 catch(error){if(error.name!=='AbortError')$('data-status').textContent=error.message;}
 finally{schedulePoll();}
}
function activeChapter(){return preview??(current?chapterOf(current):0);}
function activeSeed(){return current?.seed??seedOf(identity(market.chainId,market.baseToken.address));}
function render(){
 if(!market)return;const c=current,chapter=activeChapter();
 $('network').textContent=market.chainId.toUpperCase()+' / 100 EDITIONS';$('name').textContent=market.baseToken.name+' / '+market.baseToken.symbol;$('ca').textContent=market.baseToken.address;
 $('cap').textContent=money(market.marketCap);$('baseline').textContent=c?money(c.baseline):'Not originated';$('multiple').textContent=c?(c.latest/c.baseline).toFixed(2)+'×':'—';$('editions').textContent=(c?.minted||0)+' / 100';
 $('chapter').textContent=(preview===null?'':'PREVIEW / ')+CHAPTERS[chapter];$('seed-label').textContent='SEED '+activeSeed();
 $('milestones').replaceChildren();
 for(const [index,multiple] of MILESTONES.entries()){
  const item=document.createElement('div'),unlocked=c?.unlocks.some(u=>u.multiple===multiple);item.className='milestone'+(unlocked?' unlocked':'');
  const number=document.createElement('b');number.textContent=multiple+'×';const name=document.createElement('small');name.textContent=CHAPTERS[index];const state=document.createElement('span');state.textContent=c?(unlocked?'Unlocked':money(c.baseline*multiple)):'At '+multiple+'×';item.append(number,name,state);$('milestones').append(item);
 }
 for(const button of $('chapter-controls').children)button.setAttribute('aria-pressed',String(Number(button.dataset.chapter)===chapter));
 $('return-live').hidden=preview===null;$('preview-note').textContent=preview===null?'Only observed market-cap milestones change the saved work.':'Auditioning '+MILESTONES[chapter]+'×. This does not unlock or alter the saved collection.';
 $('originate').disabled=!!c;$('originate').textContent=c?'Originated locally':'Originate preview';$('holding').disabled=!!c;$('originator').disabled=!!c;
 $('owner-note').textContent=c?'Local originator: '+c.originator+' · '+new Date(c.createdAt).toLocaleString()+'. One collection per network + CA in this browser.':'The first local claim fixes the baseline and seed.';
 $('mint').disabled=!c||c.minted>=100;$('export').disabled=!c;
 if(c){const split=primarySplit(c.minted),eth=value=>Number(value)/1e18;$('revenue').textContent='Simulated so far: '+eth(split.total).toFixed(2)+' ETH → '+eth(split.burn).toFixed(4)+' burn / '+eth(split.originator).toFixed(4)+' originator / '+eth(split.protocol).toFixed(4)+' protocol.';}else $('revenue').textContent='No local mints yet.';
 $('data-status').textContent=c?'Last observation '+new Date(c.observedAt).toLocaleString()+' · peak observed '+(c.peak/c.baseline).toFixed(2)+'× · provider snapshots, not a tick stream.':'Provider-reported market cap. Origination refreshes the baseline before saving.';
 drawStatic();
}
for(const [index,multiple] of MILESTONES.entries()){
 const button=document.createElement('button');button.textContent=multiple+'×';button.dataset.chapter=index;button.setAttribute('aria-pressed','false');button.onclick=()=>{preview=index;render();restartScore();};$('chapter-controls').append(button);
}
$('return-live').onclick=()=>{preview=null;render();restartScore();};
$('lookup-form').onsubmit=event=>{event.preventDefault();void lookup($('token').value.trim());};
$('originate').onclick=async()=>{
 if(!market||current)return;const holding=Number($('holding').value);if(!Number.isFinite(holding)||holding<500){setNotice('Origination requires at least 500 simulated $UPIC.');return;}
 if(!$('originator').value.trim()){setNotice('Enter an originator label.');return;}
 $('originate').disabled=true;setNotice('Refreshing the creation market cap…');const rev=revision;
 try{
  if(!await refreshMarket()||rev!==revision)return;
  const id=identity(market.chainId,market.baseToken.address);if(collections[id]){current=collections[id];render();return;}
  current=createCollection(market,$('originator').value.trim());collections[id]=current;preview=null;persist();render();restartScore();setNotice('Collection originated locally. No blockchain claim or token balance was verified.');
 }catch(error){if(rev===revision)setNotice(error.message);}
 finally{if(rev===revision){render();schedulePoll();}}
};
$('mint').onclick=()=>{
 try{current=simulateMint(current);collections[current.id]=current;persist();render();$('mint-note').textContent='Preview edition #'+current.minted+' allocated locally. No ETH charged.';}catch(error){setNotice(error.message);}
};
$('export').onclick=()=>{
 if(!current)return;
 const data={format:'UPIC living collection experiment',collection:current,editionSupply:100,mintPriceETH:'0.05',milestones:MILESTONES,chapter:chapterOf(current),score:score(current.seed,chapterOf(current)),primarySplit:{buybackBurn:50,originator:25,protocol:25},secondarySplit:{originator:50,buybackBurn:40,protocol:10},simulation:true};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='upic-'+current.seed+'-score.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function clearVoices(){for(const {osc,amp} of voices){try{amp.gain.cancelScheduledValues(ctx.currentTime);amp.gain.setTargetAtTime(0,ctx.currentTime,.01);osc.stop(ctx.currentTime+.06);}catch{}}voices.clear();}
function restartScore(){
 if(!market)return;clearVoices();currentScore=score(activeSeed(),activeChapter());currentScore.notes.sort((a,b)=>a.beat-b.beat);cycle=0;nextNote=0;originTime=(ctx?.currentTime||0)+.08;artTime=0;if(playing)scheduleAudio();
}
function note(event,when){
 const osc=ctx.createOscillator(),amp=ctx.createGain(),filter=ctx.createBiquadFilter();osc.type=event.layer%2?'triangle':'sine';osc.frequency.value=440*Math.pow(2,(event.midi-69)/12);filter.type='lowpass';filter.frequency.value=event.layer?3400:1700;
 amp.gain.setValueAtTime(0,when);amp.gain.linearRampToValueAtTime(event.velocity,when+.012);amp.gain.exponentialRampToValueAtTime(.0001,when+event.duration);osc.connect(filter);filter.connect(amp);amp.connect(master);osc.start(when);osc.stop(when+event.duration+.03);
 const voice={osc,amp};voices.add(voice);osc.onended=()=>{voices.delete(voice);osc.disconnect();filter.disconnect();amp.disconnect();};
}
function scheduleAudio(){
 if(!playing||ctx.state!=='running'||!currentScore)return;
 const notes=currentScore.notes,seconds=60/currentScore.tempo,length=currentScore.beats*seconds;
 if(originTime+cycle*length<ctx.currentTime-length){cycle=Math.floor((ctx.currentTime-originTime)/length);nextNote=0;}
 let budget=0;
 while(budget++<256){const event=notes[nextNote],when=originTime+cycle*length+event.beat*seconds;if(when>ctx.currentTime+.15)break;if(when>=ctx.currentTime)note(event,when);nextNote++;if(nextNote===notes.length){nextNote=0;cycle++;}}
}
async function stop(){playing=false;cancelAnimationFrame(raf);$('listen').textContent='Listen';clearInterval(scheduler);scheduler=null;clearVoices();if(ctx?.state==='running')await ctx.suspend();drawStatic();}
$('listen').onclick=async()=>{
 if(audioBusy)return;audioBusy=true;$('listen').disabled=true;
 try{
  if(playing){await stop();return;}
  if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=Number($('volume').value);const compressor=ctx.createDynamicsCompressor();master.connect(compressor);compressor.connect(ctx.destination);}
  await ctx.resume();if(document.hidden){await stop();return;}if(ctx.state!=='running')throw Error('Audio could not start. Tap Listen again.');playing=true;$('listen').textContent='Pause';restartScore();scheduler=setInterval(scheduleAudio,50);raf=requestAnimationFrame(animate);
 }catch(error){setNotice(error.message);await stop();}
 finally{audioBusy=false;$('listen').disabled=false;}
};
$('volume').oninput=()=>{if(master)master.gain.setTargetAtTime(Number($('volume').value),ctx.currentTime,.02);};
let marks=[],markSeed=null,markChapter=-1;
function buildMarks(){
 const seed=activeSeed(),chapter=activeChapter();if(markSeed===seed&&markChapter===chapter)return;markSeed=seed;markChapter=chapter;const rng=random(seed);marks=Array.from({length:180+chapter*120},(_,i)=>({x:rng(),y:rng(),size:1+rng()*2,phase:rng()*Math.PI*2,group:i%7,rate:.25+rng()*.6}));
}
function drawArt(time){
 if(!market)return;const w=canvas.width,h=canvas.height,chapter=activeChapter(),seed=activeSeed();buildMarks();paint.fillStyle='#000';paint.fillRect(0,0,w,h);
 const grid=Math.max(3,Math.round(w/260)),root=(seed%7),beat=time*(currentScore?.tempo||72)/60;
 for(const mark of marks){
  const drift=playing&&!reduced.matches?Math.sin(time*mark.rate+mark.phase)*(.004+chapter*.003):0;
  const pulse=playing?Math.max(0,1-((beat+mark.group*.7)%4)):0;
  const x=Math.floor((mark.x+drift)*w/grid)*grid,y=Math.floor((mark.y+drift*Math.sin(mark.phase))*h/grid)*grid;
  const size=grid*(mark.size>2.4?2:1);paint.fillStyle='rgba(255,255,255,'+(.22+(mark.group===root?.35:.12)+pulse*.25)+')';paint.fillRect(x,y,size,size);
  if(chapter>=2&&mark.group===root){paint.fillRect(x+grid*3,y,grid,grid);if(chapter>=4)paint.fillRect(x,y+grid*3,grid,grid);}
 }
}
function drawStatic(){if(!market)return;drawArt(artTime);}
function animate(){if(!playing||document.hidden)return;artTime=Math.max(0,ctx.currentTime-originTime);drawArt(artTime);raf=requestAnimationFrame(animate);}
new ResizeObserver(entries=>{const rect=entries[0].contentRect;canvas.width=Math.max(1,Math.round(rect.width));canvas.height=Math.max(1,Math.round(rect.height));drawStatic();}).observe(canvas);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);void stop();clearTimeout(timer);}else{schedulePoll(0);drawStatic();}});
window.addEventListener('pagehide',()=>{cancelLookup();void stop();});
window.addEventListener('storage',event=>{if(event.key!==storageKey)return;try{const saved=JSON.parse(event.newValue||'{}');for(const [key,c] of Object.entries(saved))if(validCollection(c)&&c.id===key)collections[key]=c;if(current&&collections[current.id]){current=collections[current.id];render();restartScore();}showSaved();}catch{}});
showSaved();const initial=new URL(location.href).searchParams.get('ca');if(initial){$('token').value=initial;void lookup(initial);}
