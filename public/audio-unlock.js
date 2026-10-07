// Safari needs the playback category and a source started inside the user's tap.
let legacyAudio=null;
export function requestPlaybackMode(){
 try{if(globalThis.navigator?.audioSession){navigator.audioSession.type='playback';return true;}}catch{}
 return false;
}
function isIOS(){return /iPad|iPhone|iPod/.test(globalThis.navigator?.userAgent||'')||globalThis.navigator?.platform==='MacIntel'&&navigator.maxTouchPoints>1;}
export function createMusicContext(){
 requestPlaybackMode();
 const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
 if(!Context)throw Error('Audio is unavailable in this browser');
 // Let the browser use the speaker/headphone route's native sample rate.
 // A playback buffer gives the synthesis graph more headroom during rendering.
 return new Context({latencyHint:'playback'});
}
function unlockError(){const error=Error('Audio is blocked or interrupted · tap Listen again');error.name='AudioUnlockError';return error;}
export function unlockPlayback(context){
 const category=requestPlaybackMode();
 if(!category&&isIOS()&&globalThis.Audio){
  legacyAudio??=new Audio('audio/playback-unlock.wav?v=55');
  legacyAudio.loop=true;legacyAudio.preload='auto';legacyAudio.setAttribute('playsinline','');
  // This silent media file selects the music route on older iOS versions.
  try{legacyAudio.play()?.catch(()=>{});}catch{}
 }
 try{
  const source=context.createBufferSource();source.buffer=context.createBuffer(1,1,context.sampleRate);
  source.connect(context.destination);source.onended=()=>source.disconnect();source.start();
 }catch{}
 // Invoke resume now, before any sample download or other await loses the tap.
 let resume;try{resume=context.resume();}catch(error){return Promise.reject(error);}
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=error=>{if(done)return;done=true;clearTimeout(timeout);context.removeEventListener?.('statechange',changed);error?reject(error):resolve(context);};
  const changed=()=>{if(context.state==='running')finish();};
  const timeout=setTimeout(()=>finish(context.state==='running'?null:unlockError()),4000);
  context.addEventListener?.('statechange',changed);
  Promise.resolve(resume).then(()=>finish(context.state==='running'?null:unlockError()),finish);
  if(context.state==='running')finish();
 });
}
export function stopLegacyPlayback(){legacyAudio?.pause();}
