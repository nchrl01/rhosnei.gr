import {decodeCartridge,cycleCoefficients,ROM1_SHA256} from './wersi-rom.js?v=20';
const unit=x=>Math.max(0,Math.min(1,Number(x)||0));
const db=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('av-local-cartridges',1);r.onupgradeneeded=()=>r.result.createObjectStore('rom');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function savedROM(buffer){const store=await db();try{return await new Promise((resolve,reject)=>{const tx=store.transaction('rom',buffer?'readwrite':'readonly'),request=buffer?tx.objectStore('rom').put(buffer,'active'):tx.objectStore('rom').get('active');let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}finally{store.close();}}
function renderer(context,destination){
 const output=context.createGain();output.gain.value=0;output.connect(destination);const active=new Set(),cache=new Map();
 function stop(){for(const voice of [...active])voice.stop();}
 function play(patch,midi,m={},velocity=.7){
  while(active.size>=12)[...active][0].stop();
  const now=context.currentTime,soft=/CHOIR|STRIN|BRASS|BRAS|TROMB|TRUMP|SYN/.test(patch.name),attack=soft?.07+.12*unit(m.texture):.006;
  const release=soft?.7+1.4*unit(m.texture):.18+.45*unit(m.texture),hold=soft?.25+.5*unit(m.texture):.06;
  const envelope=context.createGain(),filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=Math.min(context.sampleRate*.4,900+7000*unit(m.texture)+4500*unit(m.motion));filter.Q.value=.65;
  envelope.connect(filter);filter.connect(output);envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(.75*velocity,now+attack);envelope.gain.exponentialRampToValueAtTime(.001,now+attack+hold+release);
  const oscillators=[],nodes=[];
  for(const layer of patch.layers){
   const pitch=Math.max(12,Math.min(108,midi+layer.transpose)),register=pitch<48?0:pitch<60?1:pitch<72?2:3,key=layer.wave.id+':'+register;
   if(!cache.has(key)){const {real,imag}=cycleCoefficients(layer.wave.cycles[register]);cache.set(key,context.createPeriodicWave(real,imag,{disableNormalization:true}));}
   const osc=context.createOscillator(),pan=context.createStereoPanner(),trim=context.createGain();osc.setPeriodicWave(cache.get(key));osc.frequency.value=440*Math.pow(2,(pitch-69)/12);osc.detune.value=layer.detune;
   pan.pan.value=(layer.flags&3)===1?-.5:(layer.flags&3)===2?.5:0;trim.gain.value=1/Math.sqrt(patch.layers.length);
   osc.connect(trim);trim.connect(pan);pan.connect(envelope);oscillators.push(osc);nodes.push(trim,pan);osc.start(now);osc.stop(now+attack+hold+release+.03);
  }
  let stopped=false;const voice={stop(){if(stopped)return;stopped=true;for(const osc of oscillators){try{osc.stop();}catch{}osc.disconnect();}for(const n of [...nodes,envelope,filter])n.disconnect();active.delete(voice);}};
  active.add(voice);oscillators[0].onended=()=>voice.stop();return patch.name;
 }
 return {output,play,stop,close(){stop();output.disconnect();}};
}
export function createWersiBank(container,onChange=()=>{},onVoice=()=>{}){
 container.innerHTML=`<details><summary>WERSI ROM 1 · cartridge sounds</summary><p>Load your cartridge once. Its waves stay in this browser; the market chooses and balances its sounds within the orchestra.</p><label class="cartridge-file">MK1 CARTRIDGE .BIN<input type="file" accept=".bin,application/octet-stream" data-rom-file></label><p data-rom-status role="status">No cartridge loaded · existing orchestra available</p><div class="cartridge-audition"><label>AUDITION A PATCH<select data-rom-patch disabled aria-label="Cartridge patch to audition"></select></label><button type="button" data-rom-audition disabled>▶ Hear patch</button><button type="button" data-rom-clear disabled>Unload</button></div><p>Browser orchestra only. Original waveform cycles and linked voices; approximate register splits, tuning, envelopes, filter and effects. Audition plays a separate reference note.</p></details><div class="cartridge-now" data-rom-now hidden>CARTRIDGE / <span data-rom-name>—</span><meter min="0" max="1" value="0" data-rom-level aria-label="Automatic cartridge gain"></meter></div>`;
 const $=s=>container.querySelector(s),status=$('[data-rom-status]'),select=$('[data-rom-patch]'),file=$('[data-rom-file]');
 let bank=null,engine=null,preview=null,previewContext=null,playing=false,native=false,metrics={},master=.35,level=0,clock=0,phrase=0,seed=0,lastName='',unloaded=false;
 function stop(){engine?.stop();preview?.stop();}
 async function load(buffer,persist=true){
  const parsed=decodeCartridge(buffer);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),x=>x.toString(16).padStart(2,'0')).join('');
  stop();bank=parsed;level=0;try{localStorage.removeItem('av-cartridge-disabled');}catch{}select.replaceChildren(...bank.patches.map(p=>{const o=document.createElement('option');o.value=p.index;o.textContent=`${p.index+1}. ${p.name}`;return o;}));select.disabled=false;$('[data-rom-audition]').disabled=false;$('[data-rom-clear]').disabled=false;$('[data-rom-now]').hidden=false;
  status.textContent=`${hash===ROM1_SHA256?'Verified ROM 1':'Checksum-valid MK1 cartridge'} · ${bank.patches.length} patches / ${bank.waves.length} waveform blocks · local only`;
  if(persist)try{await savedROM(buffer);}catch{status.textContent+=' · storage unavailable; reload file next visit';}onChange();
 }
 file.onchange=async()=>{const input=file.files?.[0];if(!input)return;try{if(input.size!==16384)throw Error('Choose a 16 KB MK1 cartridge .BIN file');await load(await input.arrayBuffer());}catch(e){status.textContent=e.message;}file.value='';};
 $('[data-rom-audition]').onclick=async()=>{if(!bank)return;try{if(!previewContext){previewContext=new AudioContext();preview=renderer(previewContext,previewContext.destination);}await previewContext.resume();preview.stop();preview.output.gain.setValueAtTime(Math.min(.5,master),previewContext.currentTime);const p=bank.patches[Number(select.value)];preview.play(p,60,{texture:.7,motion:.3},.8);status.textContent=`Auditioning ${p.name} · C4 · approximate envelope/filter`;}catch(e){status.textContent='Audition unavailable: '+e.message;}};
 $('[data-rom-clear]').onclick=async()=>{unloaded=true;try{localStorage.setItem('av-cartridge-disabled','1');}catch{}stop();bank=null;level=0;$('[data-rom-now]').hidden=true;select.disabled=true;$('[data-rom-audition]').disabled=true;$('[data-rom-clear]').disabled=true;status.textContent='Cartridge unloaded · original orchestra';try{const store=await db();const tx=store.transaction('rom','readwrite');tx.objectStore('rom').delete('active');tx.oncomplete=()=>store.close();}catch{}onChange();};
 // Local development preloads the supplied file from outside public/. Pages
 // returns 404 here; visitors load their own cartridge through the file input.
 (async()=>{try{if(localStorage.getItem('av-cartridge-disabled')==='1')return;let buffer=await savedROM();if(!buffer&&['localhost','127.0.0.1'].includes(location.hostname)){const r=await fetch('/cartridge/rom1');if(r.ok)buffer=await r.arrayBuffer();}if(buffer&&!unloaded&&!bank)await load(buffer,false);}catch{}})();
 return {
  get loaded(){return !!bank;},
  get state(){return {loaded:!!bank,level,name:lastName};},
  get active(){return !!bank&&!native;},
  attach(context,destination){engine?.close();engine=context?renderer(context,destination):null;},
  update(m,state){metrics=m;playing=state.playing;native=state.native;master=state.master;seed=state.seed;phrase=state.phrase;level=bank&&!native?state.budget*.2:0;
   if(engine)engine.output.gain.setTargetAtTime(playing?level*master:0,engine.output.context.currentTime,.15);
   if(!playing)engine?.stop();$('[data-rom-level]').value=level;$('[data-rom-now]').hidden=!bank;$('[data-rom-name]').textContent=native?'Browser Pd required':`${lastName||'Market-conducted'} · ${Math.round(level*100)}%`;
  },
  receive(name,value){if(name==='generation')clock=value;if(!bank||!engine||!playing||native||level<.0001||name!=='note')return;
   const families=metrics.motion>.6?[10,11,12,14,16,18,19]:metrics.texture>.65?[2,5,6,9,15]:[0,1,3,4,7,8,13,17];
   const pick=((seed%families.length)+phrase+Math.floor(clock/8))%families.length,p=bank.patches[families[pick]];lastName=engine.play(p,value,metrics,.5+.5*unit(metrics.volume));onVoice(p.index);
  },
  reset(){stop();clock=0;level=0;lastName='';},stop,
 };
}
