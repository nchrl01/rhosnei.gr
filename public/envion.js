import {createEnvionView} from './envion-view.js?v=38';
import {applyEnvionMarket,envionMaterial,ENVION_CONTROLS,ENVION_FIXED} from './envion-market.js?v=38';
export {applyEnvionMarket} from './envion-market.js?v=38';

const BASE = 'patches/envion/';
const ROOT = 'orchestra/envion/';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const bytes = value => value instanceof Uint8Array ? value : new Uint8Array(value);

// Pd's fudiformat escapes spaces inside symbols. The ASCII bridge preserves them.
export function decodePdBytes(line, prefix) {
  const start = line.indexOf(prefix + ':');
  if (start < 0) return null;
  const codes = line.slice(start + prefix.length + 1).trim().split(/\s+/).map(Number);
  if (!codes.length || codes.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  const source = new TextDecoder().decode(Uint8Array.from(codes));
  const atoms = []; let word = '', escaped = false;
  for (const char of source) {
    if (escaped) { word += char; escaped = false; }
    else if (char === '\\') escaped = true;
    else if (/\s|;/.test(char)) { if (word) { atoms.push(word); word = ''; } }
    else word += char;
  }
  if (word) atoms.push(word);
  if (atoms[0] === 'list') atoms.shift();
  return atoms;
}

// Keep WAV frame counts and sample rates intact: decodeAudioData would resample.
export function decodeWave(buffer) {
  const data = bytes(buffer), view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const text = (at, n) => String.fromCharCode(...data.subarray(at, at + n));
  if (data.length < 44 || text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE') return null;
  let format, offset, length;
  for (let at = 12; at + 8 <= data.length;) {
    const size = view.getUint32(at + 4, true), kind = text(at, 4), body = at + 8;
    if (kind === 'fmt ' && size >= 16) {
      format = {code:view.getUint16(body, true), channels:view.getUint16(body + 2, true), sampleRate:view.getUint32(body + 4, true), align:view.getUint16(body + 12, true), bits:view.getUint16(body + 14, true)};
      if (format.code === 65534 && size >= 40) format.code = view.getUint16(body + 24, true);
    }
    if (kind === 'data') { offset = body; length = Math.min(size, data.length - body); }
    at = body + size + (size & 1);
  }
  if (!format || offset == null || ![1, 3].includes(format.code) || ![8,16,24,32,64].includes(format.bits) || !format.align || !format.channels) return null;
  const frames = Math.floor(length / format.align), stride = format.bits / 8;
  if (frames < 1 || format.channels > 32) return null;
  const channels = Array.from({length:format.channels}, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let channel = 0; channel < channels.length; channel++) {
    const at = offset + i * format.align + channel * stride;
    let sample = 0;
    if (format.code === 3) sample = format.bits === 64 ? view.getFloat64(at, true) : view.getFloat32(at, true);
    else if (format.bits === 8) sample = (view.getUint8(at) - 128) / 128;
    else if (format.bits === 16) sample = view.getInt16(at, true) / 32768;
    else if (format.bits === 24) { const n = data[at] | data[at+1] << 8 | data[at+2] << 16; sample = (n & 0x800000 ? n - 0x1000000 : n) / 8388608; }
    else if (format.bits === 32) sample = view.getInt32(at, true) / 2147483648;
    channels[channel][i] = Number.isFinite(sample) ? sample : 0;
  }
  return {...format, frames, channels};
}

export function encodeWave(channels, sampleRate) {
  const frames = channels[0]?.length || 0, count = channels.length, data = new Uint8Array(44 + frames * count * 4), v = new DataView(data.buffer);
  const text = (at, s) => { for (let i=0;i<s.length;i++) data[at+i]=s.charCodeAt(i); };
  text(0,'RIFF');v.setUint32(4,data.length-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,3,true);v.setUint16(22,count,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*count*4,true);v.setUint16(32,count*4,true);v.setUint16(34,32,true);text(36,'data');v.setUint32(40,frames*count*4,true);
  for (let i=0;i<frames;i++) for(let c=0;c<count;c++) v.setFloat32(44+(i*count+c)*4,Number.isFinite(channels[c][i])?channels[c][i]:0,true);
  return data;
}

export function createEnvion(container, {onTransport = () => {}} = {}) {
  let pd, context, model, namespace, running = false, serial = 0, recordingPath = null;
  let activePicker = null, pendingDialog = null, generation = 0, initialized = false;
  let sampleWaveforms = [null,null];
  const nodes = new Map(), dialogs = new Map(), staged = new Set(), loads = new Map(), requests = new Map(), subscriptions = [];
  let presetRequest = 0, latestMarket = null, material = null, candidate = null, candidateSince = 0;
  const marketWrites = new Map();
  const writeMarket = (receiver,value) => {if(marketWrites.get(receiver)===value)return;marketWrites.set(receiver,value);pd.sendFloat(receiver,value);};
  let recordingOperation = Promise.resolve();
  const view = createEnvionView(container, {onControl:control, onFile:openFile, onCommand:command});
  const ready = fetch(BASE+'model.json?v=38').then(async response => {
    if (!response.ok) throw Error('Envion source layout unavailable');
    model = await response.json();
    for (const canvas of Object.values(model.canvases)) for (const node of canvas.nodes) {
      if (node.send) nodes.set(node.send,node);
      if (node.fileRequest) dialogs.set(canvas.id+'-'+node.index,node);
    }
    for(const canvas of Object.values(model.canvases))for(const node of canvas.nodes){
      const entry=canvas.id==='c0'&&ENVION_CONTROLS.find(([index])=>index===node.index);
      node.marketMapping=entry?entry[1]+' ← '+entry[2]+' · '+entry[3]:canvas.id==='c0'&&ENVION_FIXED.includes(node.index)?'Independent source generator disabled; market controls this function':'Source internals / inactive preset · read only';
    }
    view.load(model); view.setStatus('Envion 5.2 · original source · press Listen');
    return model;
  }).catch(error => {view.setStatus(error.message);throw error;});
  // Avoid an unhandled rejection when the user has not started audio yet.
  ready.catch(() => {});
  const requirePd = () => {if (!pd || !initialized) throw Error('Press Listen to open the instrument first');};
  const report = error => view.setStatus(error.message || String(error));
  const absolute = path => '/patches/'+path;
  const status = () => view.setStatus('Envion 5.2 · '+'market controlled'+(running?' · playing':' · paused'));
  function clocks(force = false) {
    if (!pd || !namespace) return;
    pd.sendFloat('av-envion-market',1);
    pd.sendFloat(namespace+'-met0',0);
  }
  async function fetchBytes(path) {
    const response = await fetch(BASE+path.split('/').map(encodeURIComponent).join('/')+'?v=38');
    if (!response.ok) throw Error('Cannot load Envion asset: '+path);
    return new Uint8Array(await response.arrayBuffer());
  }
  async function ensureAsset(path) {
    path = path.replace(/^\.\//,'');
    if (staged.has(ROOT+path)) return;
    if (!model.assets[path]) throw Error('Unknown Envion asset: '+path);
    if (!loads.has(path)) loads.set(path,(async () => {
      const target = pd, epoch = generation;
      view.setStatus('Loading '+path.split('/').pop()+'…');
      const content = await fetchBytes(path);
      if (target !== pd || epoch !== generation) throw Error('Audio session changed');
      await target.writeFile(ROOT+path,content);staged.add(ROOT+path);
    })().finally(() => loads.delete(path)));
    return loads.get(path);
  }
  async function ensurePath(path) {
    const relative = path.replace(/^\/patches\//,'');
    if (staged.has(relative)) return;
    const local = relative.replace(/^orchestra\/envion\//,'').replace(/^\.\//,'');
    if (model.assets[local]) return ensureAsset(local);
    throw Error('Sample is not loaded: '+path);
  }
  async function decode(data) {
    const wave = decodeWave(data); if (wave) return wave;
    const audio = await context.decodeAudioData(bytes(data).slice().buffer);
    return {frames:audio.length,sampleRate:audio.sampleRate,bits:32,channels:Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i).slice()),resampled:true};
  }
  function dispatch(message) {
    const {receiver,selector,values} = message;
    if (selector==='bang') pd.sendBang(receiver);
    else if (selector==='float') pd.sendFloat(receiver,Number(values[0]));
    else if (selector==='symbol') pd.sendSymbol(receiver,String(values[0]));
    else if (selector==='list') pd.sendList(receiver,values);
    else pd.sendMessage(receiver,selector,values);
  }
  function control() { /* The source view is read-only; market() owns sound controls. */ }
  async function stageUserFile(file, folder = '') {
    const target=pd,epoch=generation;
    const data = new Uint8Array(await file.arrayBuffer()), isText = /\.txt$/i.test(file.name);
    let name = file.name.replace(/[^\w. -]/g,'_');
    let content = data;
    if (!isText) {
      const audio = await decode(data);
      // PCM WAV passes through untouched; other browser-supported formats become WAV.
      if (!decodeWave(data)) {content = encodeWave(audio.channels,audio.sampleRate);name=name.replace(/\.[^.]*$/,'')+'.wav';}
    }
    const path = ROOT+'imports/'+(folder || ++serial+'/')+name;
    if(target!==pd||epoch!==generation)throw Error('Audio session changed');
    await target.writeFile(path,content);
    if(target!==pd||epoch!==generation)throw Error('Audio session changed');
    staged.add(path);
    return absolute(path);
  }
  async function openFile(file) {
    requirePd();
    const id = pendingDialog || ( /\.txt$/i.test(file.name) ? 'c0-30' : 'c0-49');
    if(dialogs.get(id)?.fileMode==='1')throw Error('Use Choose folder to complete the directory request');
    const path = await stageUserFile(file);
    if(dialogs.get(id)?.fileMode==='2')pd.sendList('av-envion-file-'+id,[path]);
    else pd.sendSymbol('av-envion-file-'+id,path);
    pendingDialog = null;view.requestFile(null);clocks();
    view.setStatus('Loaded '+file.name+' · '+'market controlled');
  }
  function chooseFiles(id) {
    if (activePicker) return;
    const info = dialogs.get(id), input = document.createElement('input');
    input.type='file'; input.hidden=true;
    const folder = info?.fileMode==='1', multiple=info?.fileMode==='2';
    if (folder) input.webkitdirectory=true;
    else {input.multiple=multiple;input.accept=id==='c0-30'?'.txt':'audio/*,.wav,.aif,.aiff,.flac,.txt';}
    pendingDialog=id;activePicker=input;container.append(input);
    const cleanup=()=>{input.remove();activePicker=null;};
    input.addEventListener('cancel',()=>{pendingDialog=null;view.requestFile(null);cleanup();},{once:true});
    input.addEventListener('change',async()=>{
      const files=Array.from(input.files||[]);cleanup();
      try {
        if(!files.length)return;
        if(folder) {
          const base=++serial+'/';
          for(const file of files) {
            if(!/\.(wav|aiff?|flac|mp3|ogg)$/i.test(file.name))continue;
            const segments=file.webkitRelativePath.split('/').slice(1,-1).map(x=>x.replace(/[^\w. -]/g,'_'));
            await stageUserFile(file,base+(segments.length?segments.join('/')+'/':''));
          }
          pd.sendSymbol('av-envion-file-'+id,absolute(ROOT+'imports/'+base));
        } else if(multiple) {
          const paths=[];for(const file of files)paths.push(await stageUserFile(file));
          pd.sendList('av-envion-file-'+id,paths);
        } else await openFile(files[0]);
        pendingDialog=null;view.requestFile(null);status();
      } catch(error){report(error);}
    },{once:true});
    input.click();
  }
  async function requestFile(atoms) {
    const [id,kind] = atoms;
    if(kind==='savepanel') {
      recordingPath=ROOT+'recordings/envion-'+Date.now()+'.wav';
      // Pre-create the destination directory for writesf~.
      await pd.writeFile(recordingPath,new Uint8Array());
      pd.sendSymbol('av-envion-file-'+id,absolute(recordingPath));
      view.setStatus('Recording original Envion output · stop it before exporting');
    } else if (!activePicker) {
      pendingDialog=id;
      view.requestFile(id,dialogs.get(id)?.fileMode||'0');
      view.setStatus('Choose the file or folder requested by this patch control');
    }
  }
  async function soundfile(atoms) {
    const [id,method,...args]=atoms;
    // Original requests are `read -resize <path> <arrayL> <arrayR>`.
    const path=args.find(value=>!value.startsWith('-'));
    const key='soundfile:'+args.slice(-2).join(','),request=(requests.get(key)||0)+1,epoch=generation;
    requests.set(key,request);
    await ensurePath(path);
    if(requests.get(key)!==request || generation!==epoch || !pd)return;
    pd.sendMessage(id+'-soundfile-ready',method,args.map(value=>/^[-+]?\d+(?:\.\d+)?$/.test(value)?Number(value):value));
    clocks();
    const virtual=path.replace(/^\/patches\//,'').replace(/^(?!orchestra\/)/,ROOT);
    const data=await pd.readFile(virtual);
    if(requests.get(key)!==request || generation!==epoch || !pd)return;
    const wave=decodeWave(data);
    if(wave && args.includes('samplebufL')) {
      sampleWaveforms=[wave.channels[0],wave.channels[1]||new Float32Array(wave.frames)];
      view.setWaveform(sampleWaveforms);
    }
  }
  async function sfload(atoms) {
    const [id,array,method,path,channelArg,sizeArg,startArg]=atoms;
    const target=pd,epoch=generation;
    const key='sfload:'+array,request=(requests.get(key)||0)+1;requests.set(key,request);
    let data;
    if(method==='download') {
      const url=new URL(path);
      if(!['https:','http:'].includes(url.protocol))throw Error('Unsupported audio URL');
      const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
      if(!response.ok)throw Error('NETaudio: HTTP '+response.status);
      data=new Uint8Array(await response.arrayBuffer());
    } else {
      await ensurePath(path);
      data=await pd.readFile(path.replace(/^\/patches\//,'').replace(/^(?!orchestra\/)/,ROOT));
    }
    const audio=await decode(data),channel=Math.trunc(Number(channelArg)||0);
    if(channel<0 || channel>=audio.channels.length)throw Error('NETaudio: channel is outside the source file');
    // ELSE sfload converts size/onset using Pd's host rate, including its
    // original behavior for a source recorded at a different sample rate.
    const start=clamp(Math.floor((Number(startArg)||0)*context.sampleRate/1000),0,audio.frames);
    const length=Number(sizeArg)>0?Math.floor(Number(sizeArg)*context.sampleRate/1000):audio.frames-start;
    const mono=new Float32Array(length),virtual=ROOT+'net/'+id+'.wav';
    mono.set(audio.channels[channel].subarray(start,Math.min(audio.frames,start+length)));
    if(target!==pd||epoch!==generation||requests.get(key)!==request)return;
    await target.writeFile(virtual,encodeWave([mono],audio.sampleRate));
    if(target!==pd||epoch!==generation||requests.get(key)!==request)return;
    staged.add(virtual);
    target.sendList(id+'-sfload-ready',[absolute(virtual),audio.frames,audio.sampleRate,audio.channels.length,audio.bits===24?32:audio.bits]);
    if(array==='samplebufL'||array==='samplebufR') {
      sampleWaveforms[array==='samplebufR'?1:0]=mono;view.setWaveform(sampleWaveforms);
    }
    clocks();
    view.setStatus('NETaudio loaded'+(audio.resampled?' · browser decoded at playback rate':' · source sample rate preserved'));
  }
  function recordCommand(atoms) {
    const [method,...args]=atoms;
    if(method==='open') {
      const path=args.at(-1);
      recordingPath=path.startsWith('/patches/')?path.slice(9):ROOT+path;
      return;
    }
    const target=pd,epoch=generation,path=recordingPath;
    recordingOperation=recordingOperation.catch(()=>{}).then(async()=>{
      if(target!==pd||epoch!==generation)return;
      if(method==='start'||method==='1'||method==='float'&&args[0]==='1') {
        if(!path)throw Error('Choose a patch recording destination first');
        await target.startRecording(path);view.setStatus('Recording original Envion output');
      } else if(method==='stop'||method==='0'||method==='float'&&args[0]==='0') {
        await target.stopRecording();
      }
    });
    return recordingOperation;
  }
  function printed(line) {
    for(const [prefix,handler] of [
      ['av-envion-ui-bytes',atoms=>view.receive(atoms[0],atoms.slice(1).filter(x=>x!=='bang').map(x=>Number.isFinite(Number(x))?Number(x):x))],
      ['av-envion-canvas-bytes',atoms=>view.receiveCanvas(atoms[0],atoms.slice(1))],
      ['av-envion-recorder-bytes',recordCommand],['av-envion-file-bytes',requestFile],['av-envion-soundfile-bytes',soundfile],['av-envion-fetch-bytes',sfload],
    ]) {
      const atoms=decodePdBytes(String(line),prefix);
      if(atoms) {Promise.resolve().then(()=>handler(atoms)).catch(error=>{if(prefix==='av-envion-fetch-bytes')pd?.sendSymbol(atoms[0]+'-sfload-error',error.message);report(error);});return true;}
    }
    return false;
  }
  async function command(name) {
    try {
      if(name==='start'||name==='stop') {await onTransport(name);return;}
      if(name==='market'||name==='original'||name.startsWith('file:')) return;
      requirePd();
      if(name.startsWith('file:')) {chooseFiles(name.slice(5));return;}
      if(name==='export') {
        if(!recordingPath)throw Error('Start and stop REC in the original patch before exporting');
        pd.sendBang('av-envion-ui-c44-1'); // Finalize the original writesf~ WAV header.
        await recordingOperation;
        await pd.stopRecording();
        const data=await pd.readFile(recordingPath);
        if(data.length<45)throw Error('The patch recording contains no audio yet');
        const url=URL.createObjectURL(new Blob([data],{type:'audio/wav'}));
        const link=document.createElement('a');link.href=url;link.download='envion-recording.wav';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
        view.setStatus('Exported original patch recording');
      }
    } catch(error) {report(error);}
  }
  function selectMaterial(m) {
    const next=envionMaterial(m),signature=next.sample+':'+next.envelope;
    if(candidate!==signature){candidate=signature;candidateSince=performance.now();}
    if(material===signature || material && performance.now()-candidateSince<5000)return;
    material=signature;
    const target=pd,epoch=generation,request=++presetRequest;
    ensureAsset(next.sample).then(()=>{
      if(pd!==target||generation!==epoch||request!==presetRequest)return;
      pd.sendBang('av-envion-ui-c0-'+next.envelope);
      pd.sendSymbol('av-envion-file-c0-49',absolute(ROOT+next.sample));
      // Asset reads do not call the original preset macros or their random clocks.
      marketWrites.clear();
      if(latestMarket)applyEnvionMarket(pd,namespace,latestMarket.m,latestMarket.tempo,writeMarket);
      status();
    }).catch(error=>{if(pd===target&&generation===epoch){material=null;report(error);}});
  }
  return {
    view, ready, printed,
    async files() {
      await ready;
      const response=await fetch(BASE+'manifest.json?v=38');if(!response.ok)throw Error('Envion source manifest unavailable');
      const manifest=await response.json();
      const files=Object.fromEntries(await Promise.all(manifest.files.map(async path=>{
        const r=await fetch(BASE+path.split('/').map(encodeURIComponent).join('/')+'?v=38');if(!r.ok)throw Error('Cannot load '+path);
        return [ROOT+path,await r.text()];
      })));
      for(const path of manifest.initialAssets)if(!(ROOT+path in files))files[ROOT+path]=await fetchBytes(path);
      return files;
    },
    async attach(runtime,audioContext,files) {
      pd=runtime;context=audioContext;generation++;staged.clear();loads.clear();requests.clear();
      for(const path of Object.keys(files))staged.add(path);
      for(const receiver of model.receivers)subscriptions.push(pd.subscribe(receiver,message=>view.receive(receiver,message.values)));
      subscriptions.push(pd.subscribeScopes(({channels})=>{
        const scopes={};
        for(const item of model.scopes)scopes[item.id]=item.channels.map(channel=>channels[channel-5]);
        view.setScopes(scopes);
      }));
      subscriptions.push(pd.subscribe('av-envion-sample-frames',()=>marketWrites.clear()));
      subscriptions.push(pd.subscribe('av-envion-id',message=>{namespace=Math.round(message.values[0]);clocks();}));
      subscriptions.push(pd.subscribe('av-envion-stop-request',()=>{if(namespace)pd.sendFloat(namespace+'-met0',0);}));
      pd.sendBang('av-envion-identify');
      // Source loadbang clears sample arrays after 2 ms. MAIN PRESET follows it.
      await new Promise(resolve=>setTimeout(resolve,25));
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{off();reject(Error('Envion default sample did not finish loading'));},15000);
        const off=pd.subscribe('av-envion-sample-frames',message=>{if(Number(message.values[0])>0){clearTimeout(timer);off();resolve();}});
        pd.sendBang('av-envion-main-preset');
      });
      if(!namespace)throw Error('Envion source did not announce its namespace');
      clocks();pd.sendFloat('av-envion-ready',1);initialized=true;
      status();
    },
    setRunning(value){running=!!value;view.setRunning(running);clocks(true);if(!running){pd?.sendBang('av-envion-hard-stop');pd?.sendBang('av-envion-ui-c44-1');}status();},
    market(m,tempo){
      if(!pd||!namespace||!initialized)return;
      clocks();
      latestMarket={m,tempo};
      const values=applyEnvionMarket(pd,namespace,m,tempo,writeMarket);
      selectMaterial(m);
      for(const [name,value] of Object.entries(values)){const target=document.getElementById('function-'+name);if(target)target.textContent=value;}
    },
    detach(){marketWrites.clear();latestMarket=null;material=null;candidate=null;generation++;presetRequest++;initialized=false;for(const off of subscriptions.splice(0))off();pd=null;namespace=null;context=null;running=false;staged.clear();loads.clear();requests.clear();view.setRunning(false);view.requestFile(null);view.setStatus('Envion 5.2 · press Listen');},
  };
}
