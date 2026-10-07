import {buildPerformanceCatalog,createEnvionPerformance,CHANCE_LABELS} from './envion-performance.js?v=220';
import {createEnvionView} from './envion-view.js?v=220';
import {applyEnvionMarket,ENVION_CONTROLS,ENVION_FIXED} from './envion-market.js?v=41';
export {applyEnvionMarket} from './envion-market.js?v=41';

const BASE = 'patches/envion/';
const ROOT = 'orchestra/envion/';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const bytes = value => value instanceof Uint8Array ? value : new Uint8Array(value);

// Keep the timeout active through body decoding as well as the response headers.
// A stalled bundled asset should leave a retryable instrument, not a pending load.
async function loadAsset(path, format = 'text', timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(BASE+path.split('/').map(encodeURIComponent).join('/')+'?v=209', {signal:controller.signal});
    if (!response.ok) throw Error('Cannot load Envion asset: '+path);
    return await response[format]();
  } catch (error) {
    if (controller.signal.aborted) throw Error('Timed out loading Envion asset: '+path);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

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
  let sampleWaveforms=[null,null],scopeOff=null,waveformSource=null,waveformLoading=null,waveformLoaded=null;
  const nodes = new Map(), dialogs = new Map(), staged = new Set(), loads = new Map(), requests = new Map(), subscriptions = [], guiSubscriptions = [];
  let presetRequest = 0, latestMarket = null, catalog, performer, performancePlan=null, performanceSeed=1917,replayScene=null, materialBusy=false, pendingMaterial=null, activeMaterial=null, loadedBankRows=328, materialOperation=0, marketOverrides={}, milestoneSound=null, milestoneSoundIdentity='';
  let materialRetryTimer=null,materialRetries=0;
  const marketWrites = new Map();
  const writeMarket = (receiver,value) => {if(marketWrites.get(receiver)===value)return;marketWrites.set(receiver,value);pd.sendFloat(receiver,value);};
  let recordingOperation = Promise.resolve();
  const view = createEnvionView(container, {onControl:control, onFile:openFile, onCommand:command,onInspect:inspect});

  function resetMaterialRetry(){clearTimeout(materialRetryTimer);materialRetryTimer=null;materialRetries=0;}
  function inspect(visible,detailed){
    pd?.setGuiTelemetry?.(visible);
    if(!visible||!pd){for(const off of guiSubscriptions.splice(0))off();}
    else if(model&&!guiSubscriptions.length){
      for(const receiver of model.receivers)guiSubscriptions.push(pd.subscribe(receiver,message=>view.receive(receiver,message.values)));
      // Restore the held market values without resending controls to the DSP.
      for(const [receiver,value] of marketWrites){const displayReceiver=nodes.get(receiver)?.receive;if(displayReceiver)view.receive(displayReceiver,[value]);}
    }
    if(scopeOff&&(!visible||!pd)){scopeOff();scopeOff=null;}
    if(visible&&pd&&!scopeOff)scopeOff=pd.subscribeScopes(({channels})=>{const scopes={};for(const item of model.scopes)scopes[item.id]=item.channels.map(channel=>channels[channel-5]);view.setScopes(scopes);});
    if(detailed)void refreshWaveform().catch(report);
  }
  async function refreshWaveform(){
    const source=waveformSource,target=pd;if(!source||!target||!view.isDetailed()||waveformLoaded===source||waveformLoading===source)return;
    waveformLoading=source;
    try{
      const data=await target.readFile(source.virtual);
      if(pd!==target||generation!==source.epoch||waveformSource!==source||!view.isDetailed())return;
      const wave=decodeWave(data);
      if(wave){sampleWaveforms=[wave.channels[0],wave.channels[1]||new Float32Array(wave.frames)];view.setWaveform(sampleWaveforms);waveformLoaded=source;}
    }finally{if(waveformLoading===source)waveformLoading=null;}
  }
  let ready;
  function loadModel() {
    if (ready) return ready;
    ready = loadAsset('model.json','json').then(async source => {
      model = source;
      const catalogSource=await loadAsset('performance-catalog.json','json');
      catalog=buildPerformanceCatalog(model,catalogSource.banks);performer=createEnvionPerformance(catalog,performanceSeed);
      nodes.clear();dialogs.clear();
      for (const canvas of Object.values(model.canvases)) for (const node of canvas.nodes) {
        if (node.send) nodes.set(node.send,node);
        if (node.fileRequest) dialogs.set(canvas.id+'-'+node.index,node);
      }
      for(const canvas of Object.values(model.canvases))for(const node of canvas.nodes){
        const entry=canvas.id==='c0'&&ENVION_CONTROLS.find(([index])=>index===node.index);
        const preset=canvas.id==='c0'&&catalog.presets.find(p=>p.index===node.index);
        node.marketMapping=preset?preset.name+' ← market-weighted preset chance':CHANCE_LABELS[canvas.id+'-'+node.index]?CHANCE_LABELS[canvas.id+'-'+node.index]+' ← market-weighted phrase chance':entry?entry[1]+' ← '+entry[2]+' + phrase chance':node.fileRequest?'Automatic bundled sample / envelope source':'Original source control · controlled by presets and phrase chance';
      }
      view.load(model); view.setStatus('Envion 5.2 · original source · press Listen');
      return model;
    }).catch(error => {ready=null;view.setStatus(error.message);throw error;});
    return ready;
  }
  // Avoid an unhandled rejection when the user has not started audio yet.
  loadModel().catch(() => {});
  const requirePd = () => {if (!pd || !initialized) throw Error('Press Listen to open the instrument first');};
  const report = error => view.setStatus(error.message || String(error));
  const absolute = path => '/patches/'+path;
  const status = () => view.setStatus('Envion 5.2 · '+'market + chance'+(running?' · playing':' · paused'));
  function clocks(force = false) {
    if (!pd || !namespace) return;
    pd.sendFloat('av-envion-market',1);
    pd.sendFloat(namespace+'-met0',0);
  }
  async function fetchBytes(path) {
    return new Uint8Array(await loadAsset(path,'arrayBuffer',30000));
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
  function milestonePath(sound=milestoneSound) {
    if(!sound)return '';
    const token=String(sound.token||'market').replace(/[^a-z0-9_-]/gi,'_').slice(0,150);
    return `imports/milestone-sounds/${token}/${Number(sound.slot)||0}-${Number(sound.revision)||0}.wav`;
  }
  async function ensurePerformanceSample(path) {
    if(path.startsWith('imports/milestone-sounds/')) {
      if(staged.has(ROOT+path))return;
      const sound=milestoneSound;
      if(!sound||milestonePath(sound)!==path)throw Error('This token’s milestone sound is no longer available.');
      const target=pd,epoch=generation;
      await target.writeFile(ROOT+path,sound.data);
      if(target!==pd||epoch!==generation)throw Error('Audio session changed');
      staged.add(ROOT+path);return;
    }
    return ensureAsset(path);
  }
  function setMilestoneSound(sound) {
    const identity=sound?`${sound.token}|${sound.slot}|${sound.revision}|${sound.name}`:'';
    if(identity===milestoneSoundIdentity)return;
    resetMaterialRetry();
    milestoneSoundIdentity=identity;milestoneSound=sound||null;
    if(!performancePlan)return;
    performancePlan=milestonePlan(performancePlan,sound);
    applyCurrent();
    if(initialized){pendingMaterial=performancePlan;if(running)void loadPerformanceMaterial();}
  }
  function milestonePlan(source,sound) {
    const baseSample=source.baseSample||source.material.sample,baseValues=source.baseValues||source.values;
    const baseActions=source.baseActions||source.actions,baseEffects=source.baseEffects||source.effects,baseSummary=source.baseSummary||source.summary;
    const actions=sound?[...baseActions]:baseActions;
    if(sound&&!actions.some(index=>index>=760&&index<=766))actions.push(760+(Number(sound.slot)%7));
    return {...source,baseSample,baseValues,baseActions,baseEffects,baseSummary,
      material:{...source.material,sample:sound?milestonePath(sound):baseSample},
      values:sound?{...baseValues,484:1,751:1,826:1,867:1,926:Math.max(.4,Number(baseValues[926])||0)}:baseValues,
      actions,effects:sound?[...new Set([...baseEffects,'grains'])]:baseEffects,
      summary:sound?`Milestone sound · ${sound.name} · ${baseSummary}`:baseSummary};
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
    view.setStatus('Loaded '+file.name+' · '+'market + chance');
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
    const [id,kind]=atoms,target=pd,epoch=generation;
    // Recorder destination is infrastructure; only the user's Record action
    // starts capture. Musical file inputs always use bundled source material.
    if(kind==='savepanel'){
      recordingPath=ROOT+'recordings/envion-'+Date.now()+'.wav';await target.writeFile(recordingPath,new Uint8Array());
      if(target===pd&&epoch===generation)target.sendSymbol('av-envion-file-'+id,absolute(recordingPath));return;
    }
    const material=performancePlan?.material;
    const path=id==='c0-30'?(material?.bank.path||'data/perc.txt'):id==='c99-1'?(material?.tape||'audio/___tape-audio/ambience.wav'):(material?.sample||'audio/buchla_2.wav');
    await ensurePath(absolute(ROOT+path));if(target!==pd||epoch!==generation)return;
    const mode=dialogs.get(id)?.fileMode;
    if(mode==='1')target.sendSymbol('av-envion-file-'+id,absolute(ROOT+'audio/'));
    else if(mode==='2')target.sendList('av-envion-file-'+id,[absolute(ROOT+path)]);
    else target.sendSymbol('av-envion-file-'+id,absolute(ROOT+path));
    view.requestFile(null);
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
    if(args.includes('samplebufL')){waveformSource={virtual,epoch,request,key};await refreshWaveform();}
  }
  async function sfload(atoms) {
    const [id,array,method,path,channelArg,sizeArg,startArg]=atoms;
    const target=pd,epoch=generation;
    const key='sfload:'+array,request=(requests.get(key)||0)+1;requests.set(key,request);
    let data;
    if(method==='download') {
      // Original NETaudio buttons now draw from the supplied library. A patch
      // gesture never blocks on an external sample host or a file chooser.
      const local=performancePlan?.material.sample||'audio/buchla_2.wav';
      await ensurePerformanceSample(local);if(target!==pd||epoch!==generation)return;
      data=await target.readFile(ROOT+local);
    } else {
      await ensurePath(path);
      data=await target.readFile(path.replace(/^\/patches\//,'').replace(/^(?!orchestra\/)/,ROOT));
    }
    const audio=await decode(data),requestedChannel=Math.trunc(Number(channelArg)||0),channel=audio.channels.length===1?0:requestedChannel;
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
    view.setStatus('Bundled source loaded'+(audio.resampled?' · browser decoded at playback rate':' · source sample rate preserved'));
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
  function applyCurrent() {
    if(!pd||!initialized||!latestMarket)return;
    const soundingPlan=performancePlan?{...performancePlan,material:{...performancePlan.material,bank:{...performancePlan.material.bank,rows:loadedBankRows}},row:performancePlan.row%loadedBankRows}:null;
    const automaticWrite=(receiver,value)=>{if(!Object.hasOwn(marketOverrides,receiver))writeMarket(receiver,value);};
    const values=applyEnvionMarket(pd,namespace,latestMarket.m,latestMarket.tempo,automaticWrite,soundingPlan);
    for(const [receiver,value] of Object.entries(marketOverrides))writeMarket(receiver,value);
    writeMarket('av-envion-row-count',loadedBankRows);if(!soundingPlan)writeMarket('av-envion-row-base',0);
    for(const [name,value] of Object.entries(values)){const target=document.getElementById('function-'+name);if(target)target.textContent=value;}
    const description=performancePlan?.summary||'Waiting for a market phrase';
    const output=document.getElementById('function-performance');if(output)output.textContent=description;
    view.setPerformance?.(description,activeMaterial,materialBusy,{plan:soundingPlan,row:soundingPlan?.row??0,market:latestMarket.m,tempo:latestMarket.tempo});
  }
  function decide(step,force=false) {
    if(!running||!initialized||!latestMarket||!performer)return;
    const generated=performer.next(latestMarket.m,latestMarket.tempo,step,force);if(!generated)return;
    const plan=milestonePlan(generated,milestoneSound);
    performancePlan=plan;applyCurrent();
    for(const index of plan.actions)pd.sendBang('av-envion-ui-c0-'+index);
    if(plan.changeMaterial){pendingMaterial=plan;void loadPerformanceMaterial();}
  }
  async function loadPerformanceMaterial() {
    if(materialBusy)return;materialBusy=true;
    clearTimeout(materialRetryTimer);materialRetryTimer=null;
    const target=pd,epoch=generation,operation=++materialOperation;
    const current=()=>operation===materialOperation&&target===pd&&epoch===generation;
    let attempt=null,failed=false;
    const paused=()=>{if(running)return false;pendingMaterial??=performancePlan||attempt;return true;};
    try {
      while(pendingMaterial&&running&&target===pd&&epoch===generation&&operation===materialOperation){
        const plan=pendingMaterial;attempt=plan;pendingMaterial=null;
        const {preset,sample,bank,tape,ir}=plan.material;
        await Promise.all([...new Set([...preset.assets,tape,ir])].filter(Boolean).map(ensureAsset));
        if(!current()||paused())return;
        await ensurePerformanceSample(sample);
        if(!current()||paused())return;
        if(pendingMaterial)continue;
        // Let the supplied preset configure its own DSP, then populate its file
        // inputs from the local library. Cached assets avoid a network pause here.
        pd.sendFloat('av-envion-ready',0);
        pd.sendBang('av-envion-ui-c0-'+preset.index);
        await new Promise(resolve=>setTimeout(resolve,35));
        if(!current()||paused())return;
        pd.sendSymbol('av-envion-file-c0-49',absolute(ROOT+sample));
        pd.sendSymbol('av-envion-file-c0-30',absolute(ROOT+bank.path));
        pd.sendSymbol(namespace+'-open',absolute(ROOT+tape));
        pd.sendSymbol(namespace+'-tape-IR',absolute(ROOT+ir));
        await new Promise(resolve=>setTimeout(resolve,35));
        if(!current()||paused())return;
        loadedBankRows=bank.rows;
        activeMaterial=preset.name+' · '+sample.split('/').pop();
        resetMaterialRetry();
        marketWrites.clear();clocks();applyCurrent();
        pd.sendFloat('av-envion-ready',1);
        if(milestoneSound&&sample===milestonePath(milestoneSound))pd.sendBang('av-envion-ui-c0-'+(760+(Number(milestoneSound.slot)%7)));
        status();
      }
    } catch(error){
      if(current()){
        failed=true;pendingMaterial??=performancePlan||attempt;report(error);
        // Keep the selected sound retryable without spinning downloads or DSP
        // reconfiguration after a failed asset request.
        if(running&&pendingMaterial&&materialRetries<2){
          const delay=[5000,15000][materialRetries++];
          materialRetryTimer=setTimeout(()=>{materialRetryTimer=null;if(current()&&running&&pendingMaterial)void loadPerformanceMaterial();},delay);
        }
      }
    }
    finally{if(current()){materialBusy=false;pd.sendFloat('av-envion-ready',1);applyCurrent();if(!failed&&pendingMaterial&&running)void loadPerformanceMaterial();}}
  }
  return {
    view, get ready(){return loadModel();}, printed,
    setSeed(value){resetMaterialRetry();replayScene=null;materialOperation++;materialBusy=false;if(pd&&initialized)pd.sendFloat('av-envion-ready',1);performanceSeed=value;view.reset?.();performer?.reset(value);performancePlan=null;pendingMaterial=null;activeMaterial=null;marketWrites.clear();},
    async files() {
      await loadModel();
      const manifest=await loadAsset('manifest.json','json');
      const files=Object.fromEntries(await Promise.all(manifest.files.map(async path=>{
        return [ROOT+path,await loadAsset(path)];
      })));
      // Download the required sample and impulse responses together. Pd still
      // receives the complete file set only after every required asset succeeds.
      await Promise.all(manifest.initialAssets.filter(path=>!(ROOT+path in files)).map(async path=>{
        files[ROOT+path]=await fetchBytes(path);
      }));
      return files;
    },
    async attach(runtime,audioContext,files) {
      pd=runtime;context=audioContext;generation++;staged.clear();loads.clear();requests.clear();
      const epoch=generation;
      for(const path of Object.keys(files))staged.add(path);
      inspect(view.isVisible(),view.isDetailed());
      subscriptions.push(pd.subscribe('av-envion-sample-frames',()=>marketWrites.clear()));
      subscriptions.push(pd.subscribe('generation',message=>{if(!latestMarket?.m?.replay)decide(Number(message.values[0]));}));
      subscriptions.push(pd.subscribe('av-envion-id',message=>{namespace=Math.round(message.values[0]);clocks();}));
      subscriptions.push(pd.subscribe('av-envion-stop-request',()=>{if(namespace)pd.sendFloat(namespace+'-met0',0);}));
      pd.sendBang('av-envion-identify');
      // Source loadbang clears sample arrays after 2 ms. MAIN PRESET follows it.
      await new Promise(resolve=>setTimeout(resolve,25));
      if(pd!==runtime||generation!==epoch)return false;
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{off();reject(Error('Envion default sample did not finish loading'));},15000);
        const off=pd.subscribe('av-envion-sample-frames',message=>{if(Number(message.values[0])>0){clearTimeout(timer);off();resolve();}});
        pd.sendBang('av-envion-main-preset');
      });
      if(pd!==runtime||generation!==epoch)return false;
      if(!namespace)throw Error('Envion source did not announce its namespace');
      clocks();pd.sendFloat('av-envion-ready',1);initialized=true;
      status();
      return true;
    },
    setRunning(value){const wasRunning=running;running=!!value;if(!running){clearTimeout(materialRetryTimer);materialRetryTimer=null;}else if(!wasRunning)resetMaterialRetry();view.setRunning(running);clocks(true);if(!running){pd?.sendBang('av-envion-hard-stop');pd?.sendBang('av-envion-ui-c44-1');}else if(!wasRunning&&initialized&&pendingMaterial)void loadPerformanceMaterial();status();},
    market(m,tempo){
      if(!pd||!namespace||!initialized)return;
      clocks();latestMarket={m,tempo};
      if(m.replay){
       const scene=m.replay.sceneSeed??Math.floor(m.replay.at||0);
       if(scene!==replayScene){replayScene=scene;performer?.reset(scene,{preserveMaterial:true});performancePlan=null;decide(0,true);}
      }
      if(!performancePlan&&running)decide(0,true);
      applyCurrent();
    },
    setOverrides(values={}){
      marketOverrides=Object.fromEntries(Object.entries(values).filter(([receiver,value])=>/^av-envion-ui-c0-\d+$/.test(receiver)&&Number.isFinite(value)));
      applyCurrent();
    },
    setMilestoneSound,
    detach(){resetMaterialRetry();pd?.setGuiTelemetry?.(false);scopeOff?.();scopeOff=null;waveformSource=null;waveformLoaded=null;waveformLoading=null;materialOperation++;loadedBankRows=328;marketWrites.clear();latestMarket=null;performancePlan=null;pendingMaterial=null;activeMaterial=null;materialBusy=false;marketOverrides={};performer?.reset(performanceSeed);generation++;presetRequest++;initialized=false;for(const off of guiSubscriptions.splice(0))off();for(const off of subscriptions.splice(0))off();pd=null;namespace=null;context=null;running=false;staged.clear();loads.clear();requests.clear();view.reset?.();view.setRunning(false);view.requestFile(null);view.setStatus('Envion 5.2 · press Listen');},
  };
}
