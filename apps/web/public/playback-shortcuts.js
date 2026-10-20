// Keyboard and system media controls share the player's existing transport.
export function bindPlaybackShortcuts({button,getState,getMetadata=()=>null,document:doc=globalThis.document,navigator:nav=globalThis.navigator,MediaMetadata:Metadata=globalThis.MediaMetadata}){
 const media=nav?.mediaSession;let metadataKey='',systemControls=false;
 function act(action){
  const state=getState();
  if(!state.ready||state.starting||button.disabled)return false;
  if(action==='play'&&state.playing||action==='pause'&&!state.playing)return false;
  button.click();return true;
 }
 const actions={play:()=>act('play'),pause:()=>act('pause'),stop:()=>act('pause')};
 for(const [action,handler] of Object.entries(actions)){
  try{media?.setActionHandler(action,handler);if(media&&action!=='stop')systemControls=true;}catch{}
 }
 const interactive='input,textarea,select,button,a,summary,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"],[role="button"],[role="link"]';
 function keydown(event){
  if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const space=event.code==='Space'||event.key===' '||event.key==='Spacebar';
  const fallback=!systemControls&&['MediaPlayPause','MediaPlay','MediaPause','MediaStop'].includes(event.key);
  if(!space&&!fallback)return;
  if(space){
   if(doc.querySelector('dialog[open],[aria-modal="true"]'))return;
   const path=event.composedPath?.()||[event.target];
   if(path.some(element=>element?.isContentEditable||element?.closest?.(interactive)))return;
  }
  if(event.repeat){if(getState().ready)event.preventDefault();return;}
  const action=space||event.key==='MediaPlayPause'?'toggle':event.key==='MediaPlay'?'play':'pause';
  if(getState().ready)event.preventDefault();
  act(action);
 }
 doc.addEventListener('keydown',keydown);
 button.setAttribute('aria-keyshortcuts','Space');
 function update(){
  const state=getState();
  try{if(media)media.playbackState=!state.ready?'none':state.playing?'playing':'paused';}catch{}
  const metadata=getMetadata();
  const key=JSON.stringify(metadata);
  if(key!==metadataKey){metadataKey=key;try{if(media)media.metadata=metadata&&Metadata?new Metadata(metadata):null;}catch{}}
 }
 update();
 return {update,close(){doc.removeEventListener('keydown',keydown);for(const action of Object.keys(actions)){try{media?.setActionHandler(action,null);}catch{}}try{if(media){media.playbackState='none';media.metadata=null;}}catch{}}};
}
