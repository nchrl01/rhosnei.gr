const THRESHOLDS=[100000,500000,1000000,2000000];
const DB_NAME='upic-envion-samples-v1',STORE='samples',UNLOCK_KEY='upic-envion-unlocks-v1';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const money=value=>value>=1e6?'$'+(value/1e6).toFixed(value%1e6?1:0)+'M':value>0?'$'+Math.round(value/1000)+'K':'—';
const placeholderWave=[1,2,4,7,10,13,11,7,4,2,3,6,9,12,8,4,3,5,9,12,8,4,2,4,7,10,13,9,5,2,1,2];
function waveSvg(values=placeholderWave){const safe=Array.isArray(values)&&values.length?values:placeholderWave;const bars=Array.from({length:32},(_,i)=>{const magnitude=Math.max(0,Math.min(1,Number(safe[Math.floor(i*safe.length/32)])||0));const height=Math.max(2,Math.round(magnitude*14)*2),y=16-height/2;return `<rect x="${i*2}" y="${y}" width="1" height="${height}"/>`;}).join('');return `<svg class="milestone-wave" viewBox="0 0 64 32" role="img" aria-label="Pixelated audio waveform" focusable="false" shape-rendering="crispEdges"><g fill="currentColor">${bars}</g></svg>`;}
const lockIcon='<svg class="milestone-lock" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 1h6v2h2v4h1v8H2V7h1V3h2zm1 2v4h4V3zm-2 6v4h8V9z"/></svg>';

function openStore(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Could not open local sound storage'));
 });
}
async function storeRequest(mode,callback){
 const db=await openStore();
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),request=callback(tx.objectStore(STORE));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tx.onabort=()=>reject(tx.error);});}
 finally{db.close();}
}
function unlockMap(){try{return JSON.parse(localStorage.getItem(UNLOCK_KEY)||'{}');}catch{return {};}}
function safeKey(value){return String(value||'market').replace(/[^a-z0-9:_-]/gi,'_').slice(0,180);}

async function compactAudio(file,getContext){
 if(file.size>25*1024*1024)throw Error('Choose a file under 25 MB.');
 const raw=await file.arrayBuffer();
 let ctx=getContext();let ownsContext=false;
 if(!ctx){const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)throw Error('Audio decoding is unavailable in this browser.');ctx=new AudioContextClass();ownsContext=true;}
 let decoded;
 try{decoded=await ctx.decodeAudioData(raw.slice(0));}catch{throw Error('This audio format is not supported by the browser. Try WAV, MP3, or M4A.');}
 try{
  const frames=Math.max(1,Math.min(decoded.length,Math.floor(Math.min(decoded.duration,8)*decoded.sampleRate)));
  const rate=Math.min(decoded.sampleRate,48000),channels=decoded.numberOfChannels>1?2:1;
  let audio=decoded;
  if(rate!==decoded.sampleRate&&window.OfflineAudioContext){
   const offline=new OfflineAudioContext(channels,Math.ceil(frames*rate/decoded.sampleRate),rate),source=offline.createBufferSource();
   const clipped=ctx.createBuffer(decoded.numberOfChannels,frames,decoded.sampleRate);
   for(let c=0;c<decoded.numberOfChannels;c++)clipped.copyToChannel(decoded.getChannelData(c).subarray(0,frames),c);
   source.buffer=clipped;source.connect(offline.destination);source.start();audio=await offline.startRendering();
  }
  const count=Math.min(audio.length,Math.floor(8*audio.sampleRate)),outChannels=audio.numberOfChannels>1?2:1;
  const pcm=Array.from({length:outChannels},(_,c)=>{
   const result=new Float32Array(count);
   if(outChannels===1){for(let i=0;i<count;i++){let sum=0;for(let ch=0;ch<audio.numberOfChannels;ch++)sum+=audio.getChannelData(ch)[i]||0;result[i]=clamp(sum/audio.numberOfChannels,-1,1);}}
   else{const source=audio.getChannelData(Math.min(c,audio.numberOfChannels-1));for(let i=0;i<count;i++)result[i]=clamp(source[i]||0,-1,1);}
   return result;
  });
  const waveform=Array.from({length:32},(_,bin)=>{const start=Math.floor(bin*count/32),end=Math.max(start+1,Math.floor((bin+1)*count/32));let peak=0;for(let i=start;i<end;i++)for(let c=0;c<outChannels;c++)peak=Math.max(peak,Math.abs(pcm[c][i]||0));return Math.min(1,peak);});
  const bytes=new Uint8Array(44+count*outChannels*2),view=new DataView(bytes.buffer),write=(at,value)=>{for(let i=0;i<value.length;i++)bytes[at+i]=value.charCodeAt(i);};
  write(0,'RIFF');view.setUint32(4,bytes.length-8,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,outChannels,true);view.setUint32(24,audio.sampleRate,true);view.setUint32(28,audio.sampleRate*outChannels*2,true);view.setUint16(32,outChannels*2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,bytes.length-44,true);
  for(let i=0;i<count;i++)for(let c=0;c<outChannels;c++)view.setInt16(44+(i*outChannels+c)*2,Math.round(pcm[c][i]*32767),true);
  return {blob:new Blob([bytes],{type:'audio/wav'}),duration:count/audio.sampleRate,sampleRate:audio.sampleRate,waveform};
 }finally{if(ownsContext)void ctx.close().catch(()=>{});}
}

export function createMilestoneSounds(container,{getAudioContext=()=>null,onActiveSample=()=>{}}={}){
 if(!container)throw new TypeError('A container is required for milestone sounds.');
 let marketKey='',cap=0,replay=false,rows=[],revision=0,activeId='',activeSlot=-1,statusText='Choose a token to add its sounds.';
 const unlocks=unlockMap();
 container.className='milestone-sounds';
 container.innerHTML='<div class="milestone-sounds-head"><div><p class="eyebrow">COLLECTION SOUND MILESTONES</p><h3>Sounds unlocked by market cap</h3></div><span data-current-cap>—</span></div><p class="milestone-sounds-note">Each sound starts at its market-cap milestone and stays in Envion until the next uploaded milestone sound takes over. The $2M sound continues above $2M. Uploads are saved in this browser for this token.</p><div class="milestone-sound-grid" data-slots></div><p class="milestone-sound-status" role="status" aria-live="polite" data-status></p>';
 const slots=container.querySelector('[data-slots]'),status=container.querySelector('[data-status]'),capLabel=container.querySelector('[data-current-cap]');
 const cards=THRESHOLDS.map((threshold,index)=>{
  const card=document.createElement('article');card.className='milestone-sound-card';
  card.innerHTML=`<div class="milestone-sound-title"><strong>${money(threshold)}</strong><span data-lock aria-label="Locked until ${money(threshold)}">${lockIcon}</span></div><small data-range>Starts at ${money(threshold)}</small><div data-file>${waveSvg()}</div><label class="milestone-upload" aria-label="Upload a sound for ${money(threshold)}"><span class="milestone-upload-wave">${waveSvg()}</span><span class="milestone-upload-label">ADD SAMPLE</span><input type="file" accept="audio/*,.wav,.mp3,.m4a,.aiff,.flac,.ogg"></label><button type="button" class="milestone-clear" data-clear>Remove sound</button>`;
  const input=card.querySelector('input'),name=card.querySelector('[data-file]');
  input.addEventListener('change',async()=>{
   const file=input.files?.[0];input.value='';if(!file||!marketKey)return;
   const token=marketKey,version=revision;statusText='Preparing '+file.name+'…';render();
   try{
    const compact=await compactAudio(file,getAudioContext);if(token!==marketKey||version!==revision)return;
    const record={id:token+'|'+index,token,slot:index,threshold,name:file.name.replace(/[<>]/g,''),blob:compact.blob,duration:compact.duration,sampleRate:compact.sampleRate,waveform:compact.waveform,revision:Date.now()};
    await storeRequest('readwrite',store=>store.put(record));if(token!==marketKey)return;
    rows[index]=record;statusText=`Saved ${record.name} · ${record.duration.toFixed(1)} sec · ${Math.round(record.sampleRate/1000)} kHz`;
    updateActive();render();
   }catch(error){statusText=error.message||'Could not load this sound.';render();}
  });
  card.querySelector('[data-clear]').addEventListener('click',async()=>{
   if(!marketKey)return;const token=marketKey;try{await storeRequest('readwrite',store=>store.delete(token+'|'+index));if(token!==marketKey)return;rows[index]=null;statusText=`Removed ${money(threshold)} sound.`;updateActive();render();}catch(error){statusText=error.message||'Could not remove this sound.';render();}
  });
  slots.append(card);return card;
 });
 function unlockedCap(){if(replay)return cap;return Math.max(cap,Number(unlocks[marketKey])||0);}
 function updateUnlock(){if(!marketKey||replay)return;const reached=THRESHOLDS.filter(value=>cap>=value).at(-1)||0;if(reached>(Number(unlocks[marketKey])||0)){unlocks[marketKey]=reached;try{localStorage.setItem(UNLOCK_KEY,JSON.stringify(unlocks));}catch{}}}
 function updateActive(){
  const reached=unlockedCap();let row=null;
  for(let i=rows.length-1;i>=0;i--)if(rows[i]&&reached>=THRESHOLDS[i]){row=rows[i];break;}
  const id=row?row.id:'';activeSlot=row?.slot??-1;if(id===activeId)return;activeId=id;
  if(!row){onActiveSample(null);return;}
  row.blob.arrayBuffer().then(data=>{if(activeId===id)onActiveSample({token:row.token,slot:row.slot,threshold:row.threshold,name:row.name,revision:row.revision,data:new Uint8Array(data)});}).catch(error=>{statusText=error.message;render();});
 }
 function render(){
  capLabel.textContent=money(cap);status.textContent=statusText;
  const reached=unlockedCap();cards.forEach((card,index)=>{
   const row=rows[index],locked=reached<THRESHOLDS[index],active=index===activeSlot&&!!row;card.classList.toggle('is-locked',locked);card.classList.toggle('is-unlocked',!locked);card.classList.toggle('is-active',active);
   const lock=card.querySelector('[data-lock]');lock.innerHTML=locked?lockIcon:active?'PLAYING':row?'READY':'UNLOCKED';lock.setAttribute('aria-label',locked?`Locked until ${money(THRESHOLDS[index])}`:active?'Currently playing':row?'Sound ready':'Unlocked');
   const nextAssigned=rows.slice(index+1).find(Boolean);card.querySelector('[data-range]').textContent=row?`${money(THRESHOLDS[index])} → ${nextAssigned?money(nextAssigned.threshold):'and beyond'}`:`Starts at ${money(THRESHOLDS[index])}`;
   const fileLabel=card.querySelector('[data-file]');fileLabel.replaceChildren();fileLabel.insertAdjacentHTML('afterbegin',waveSvg(row?.waveform));if(row){const name=document.createElement('span');name.className='milestone-sample-name';name.textContent=`${row.name} · ${row.duration.toFixed(1)} sec`;fileLabel.append(name);}
  card.querySelector('[data-clear]').hidden=!row;
   card.querySelector('input').disabled=!marketKey;
   card.querySelector('.milestone-upload').classList.toggle('is-disabled',!marketKey);
  });
 }
 render();
 return {
  async setMarket(key,nextCap=0,isReplay=false){
   key=safeKey(key);const newMarket=key!==marketKey,wasReplay=replay;marketKey=key;cap=Number.isFinite(Number(nextCap))?Math.max(0,Number(nextCap)):0;replay=!!isReplay;
   updateUnlock();
   if(newMarket){const current=++revision;rows=Array(THRESHOLDS.length).fill(null);activeId='';onActiveSample(null);statusText='Loading this token’s saved sounds…';render();
    try{const loaded=await storeRequest('readonly',store=>store.getAll());if(current!==revision)return;for(let row of loaded||[])if(row.token===key&&row.slot>=0&&row.slot<rows.length){if(!Array.isArray(row.waveform)){try{const compact=await compactAudio(row.blob,getAudioContext);if(current!==revision)return;row={...row,...compact};void storeRequest('readwrite',store=>store.put(row)).catch(()=>{});}catch{}}rows[row.slot]=row;}statusText='Sounds are saved locally to this token in this browser.';}
    catch(error){statusText='Local sound storage unavailable: '+(error.message||'');}
   }
   if(wasReplay!==replay)activeId='\u0000';updateActive();render();
  },
  get thresholds(){return THRESHOLDS.slice();},
 };
}
