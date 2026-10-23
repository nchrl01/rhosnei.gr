// Shared by the instrument and Audio Lab. Files remain in this browser's origin.
const DB_NAME='upic-envion-library-v1',STORE='packs',KEY='current';
export const ENVION_SAMPLE_LIMITS=Object.freeze({seconds:30,inputBytes:12*1024*1024,packBytes:18*1024*1024,sampleRate:48000});
const MAX_WAV=44+ENVION_SAMPLE_LIMITS.seconds*ENVION_SAMPLE_LIMITS.sampleRate*2*2;
const slots=['sample','tape'],listeners=new Set();
let database,loading,operation=Promise.resolve(),snapshot={revision:'bundled',sample:null,tape:null},loadError=null,reloadSerial=0,retryAfter=0;
const channel=typeof window!=='undefined'&&typeof BroadcastChannel==='function'?new BroadcastChannel('upic-envion-library-v1'):null;
const revision=()=>globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
const named=value=>String(value||'Custom sample').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,160);
function announce(){for(const fn of listeners){try{fn(snapshot,loadError);}catch{}}}
function openDatabase(){
 if(database)return Promise.resolve(database);
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error('This browser cannot save samples. Use a browser with local storage enabled.'));return;}
  const request=indexedDB.open(DB_NAME,1);let settled=false;
  const timer=setTimeout(()=>finish(Error('Local sample storage is taking too long. Try again.')),8000);
  function finish(error,db){if(settled){db?.close();return;}settled=true;clearTimeout(timer);if(error)reject(error);else{database=db;db.onversionchange=()=>{db.close();database=null;};resolve(db);}}
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
  request.onsuccess=()=>finish(null,request.result);
  request.onerror=()=>finish(Error('Could not open local sample storage. Check browser storage permissions.'));
  request.onblocked=()=>finish(Error('Close other UPIC tabs and try saving samples again.'));
 });
}
async function transaction(mode,run){
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode);let value,failure;
  const timer=setTimeout(()=>{try{tx.abort();}catch{}},8000);
  tx.oncomplete=()=>{clearTimeout(timer);resolve(value);};
  tx.onabort=tx.onerror=()=>{clearTimeout(timer);reject(failure||Error('Could not save or read samples. Browser storage may be full or unavailable.'));};
  try{run(tx.objectStore(STORE),next=>{value=next;},error=>{failure=error;tx.abort();});}catch(error){failure=error;tx.abort();}
 });
}
function pcmInfo(value){
 const data=value instanceof Uint8Array?value:new Uint8Array(value||0);
 if(data.byteLength<44||data.byteLength>MAX_WAV)throw Error('Invalid sample size');
 const v=new DataView(data.buffer,data.byteOffset,data.byteLength),word=(at,n)=>String.fromCharCode(...data.subarray(at,at+n));
 const channels=v.getUint16(22,true),rate=v.getUint32(24,true),frames=v.getUint32(40,true)/(2*channels);
 if(word(0,4)!=='RIFF'||v.getUint32(4,true)!==data.length-8||word(8,4)!=='WAVE'||word(12,4)!=='fmt '||v.getUint32(16,true)!==16||v.getUint16(20,true)!==1||![1,2].includes(channels)||rate!==48000||v.getUint32(28,true)!==rate*channels*2||v.getUint16(32,true)!==channels*2||v.getUint16(34,true)!==16||word(36,4)!=='data'||v.getUint32(40,true)!==data.length-44||!Number.isInteger(frames)||frames<1||frames>rate*30)throw Error('Invalid sample audio');
 return {data,channels,sampleRate:rate,frames,duration:frames/rate};
}
function readStored(value){
 if(value==null)return {revision:'bundled',sample:null,tape:null};
 if(value.version!==1||typeof value.revision!=='string')throw Error('Saved sample library has an unsupported format. Reset the samples to recover.');
 const result={revision:value.revision};
 for(const slot of slots){const item=value[slot];result[slot]=item?{...pcmInfo(item.data),name:named(item.name)}:null;}
 return result;
}
async function read(){return readStored(await transaction('readonly',(store,done)=>{const request=store.get(KEY);request.onsuccess=()=>done(request.result);}));}
async function reload(){
 const serial=++reloadSerial;
 try{const next=await read();if(serial!==reloadSerial)return snapshot;snapshot=next;loadError=null;announce();return snapshot;}
 catch(error){if(serial===reloadSerial){loadError=error;announce();}throw error;}
}
function ready(){
 if(!loading){
  if(loadError&&Date.now()<retryAfter)return Promise.reject(loadError);
  loading=reload().catch(error=>{loading=null;retryAfter=Date.now()+5000;throw error;});
 }
 return loading.then(()=>snapshot);
}
function update(change){
 const next=operation.catch(()=>{}).then(async()=>{
  const pack=await transaction('readwrite',(store,done,fail)=>{
   const request=store.get(KEY);
   request.onsuccess=()=>{
    try{
     const saved=change==='reset'?{}:readStored(request.result);
     const next=change==='reset'?{sample:null,tape:null}:{...saved,...change};
     next.version=1;next.revision=revision();store.put(next,KEY);done(next);
    }catch(error){fail(error);}
   };
  });
  ++reloadSerial;snapshot=readStored(pack);loadError=null;loading=Promise.resolve(snapshot);announce();channel?.postMessage('changed');return snapshot;
 });
 operation=next;return next;
}
function encodePCM(audio){
 const frames=audio.length,channels=audio.numberOfChannels,data=new Uint8Array(44+frames*channels*2),view=new DataView(data.buffer);
 const word=(at,value)=>{for(let i=0;i<value.length;i++)data[at+i]=value.charCodeAt(i);};
 word(0,'RIFF');view.setUint32(4,data.length-8,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,48000,true);view.setUint32(28,48000*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,data.length-44,true);
 const input=Array.from({length:channels},(_,i)=>audio.getChannelData(i));
 for(let i=0;i<frames;i++)for(let c=0;c<channels;c++){const x=Math.max(-1,Math.min(1,Number.isFinite(input[c][i])?input[c][i]:0));view.setInt16(44+(i*channels+c)*2,Math.round(x*(x<0?32768:32767)),true);}
 return data;
}
async function prepare(file){
 if(!file||file.size<1||file.size>ENVION_SAMPLE_LIMITS.inputBytes)throw Error('Choose an audio file smaller than 12 MB.');
 const Decoder=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
 if(!Decoder)throw Error('This browser cannot decode sample files.');
 const input=await file.arrayBuffer();
 // Reject oversized PCM before browser decoding allocates its output buffers.
 if(input.byteLength>=44){const bytes=new Uint8Array(input),v=new DataView(input);if(String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WAVE'){
  let rate=0,align=0,length=0;
  for(let at=12;at+8<=bytes.length;){const size=v.getUint32(at+4,true),body=at+8;if(size>bytes.length-body)throw Error('This WAV file is incomplete.');const kind=String.fromCharCode(...bytes.subarray(at,at+4));if(kind==='fmt '&&size>=16){rate=v.getUint32(body+4,true);align=v.getUint16(body+12,true);}if(kind==='data')length=size;at=body+size+(size&1);}
  if(rate&&align&&length/(rate*align)>30.01)throw Error('Use a sample no longer than 30 seconds.');
 }}
 const decoder=new Decoder(2,1,48000);let timer;
 const audio=await Promise.race([decoder.decodeAudioData(input),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Audio decoding took too long. Try a short WAV file.')),15000);})]).catch(error=>{throw Error(error?.message?.includes('too long')?error.message:'This audio file could not be decoded. Try WAV, MP3, or another supported audio file.');}).finally(()=>clearTimeout(timer));
 if(audio.duration>30||audio.duration<=0)throw Error('Use a sample between a moment and 30 seconds long.');
 if(audio.numberOfChannels<1||audio.numberOfChannels>2)throw Error('Use a mono or stereo audio file.');
 if(audio.sampleRate!==48000||audio.length>1440000)throw Error('This audio file could not be converted safely.');
 const data=encodePCM(audio);return {...pcmInfo(data),name:named(file.name)};
}
function base64(data){let text='';for(let i=0;i<data.length;i+=16384)text+=String.fromCharCode(...data.subarray(i,i+16384));return btoa(text);}
function unbase64(value){
 if(typeof value!=='string'||value.length>Math.ceil(MAX_WAV/3)*4||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('Sample pack contains invalid audio data.');
 const decoded=atob(value),data=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++)data[i]=decoded.charCodeAt(i);return data;
}
export const envionSamples={
 ready,
 snapshot:()=>snapshot,
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 async replace(slot,file){if(!slots.includes(slot))throw Error('Unknown sample slot');const item=await prepare(file);return update({[slot]:item});},
 reset(slot){if(slot&&!slots.includes(slot))return Promise.reject(Error('Unknown sample slot'));return update(slot?{[slot]:null}:'reset');},
 async exportPack(){await ready();return JSON.stringify({schema:'upic-envion-samples',version:1,samples:Object.fromEntries(slots.map(slot=>[slot,snapshot[slot]?{name:snapshot[slot].name,wav:base64(snapshot[slot].data)}:null]))});},
 async importPack(file){
  if(!file||file.size<1||file.size>ENVION_SAMPLE_LIMITS.packBytes)throw Error('Choose an Envion sample pack smaller than 18 MB.');
  let pack;try{pack=JSON.parse(await file.text());}catch{throw Error('This is not a readable Envion sample pack.');}
  if(pack?.schema!=='upic-envion-samples'||pack.version!==1||!pack.samples||typeof pack.samples!=='object'||!slots.every(slot=>Object.hasOwn(pack.samples,slot)))throw Error('This is not an Envion sample pack.');
  const result={};for(const slot of slots){const item=pack.samples[slot];result[slot]=item?{...pcmInfo(unbase64(item.wav)),name:named(item.name)}:null;}
  return update(result);
 },
};
if(channel)channel.onmessage=()=>{void reload().then(()=>{loading=Promise.resolve(snapshot);}).catch(()=>{});};
