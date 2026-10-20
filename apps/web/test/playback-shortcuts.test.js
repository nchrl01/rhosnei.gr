import {describe,it,expect,vi} from 'vitest';
import {bindPlaybackShortcuts} from '../public/playback-shortcuts.js';

function fixture({system=true}={}){
 const state={ready:true,starting:false,playing:false},handlers={},listeners={};let dialog=false;
 const doc={addEventListener:(type,fn)=>listeners[type]=fn,removeEventListener:vi.fn(),querySelector:()=>dialog?{}:null};
 const button={disabled:false,setAttribute:vi.fn(),click:vi.fn(()=>{state.playing=!state.playing;})};
 const media={setActionHandler:vi.fn((action,fn)=>handlers[action]=fn)};
 const control=bindPlaybackShortcuts({button,getState:()=>state,document:doc,navigator:system?{mediaSession:media}:{},getMetadata:()=>({title:'PEPE',artist:'$AV'}),MediaMetadata:class{constructor(value){Object.assign(this,value);}}});
 const key=(extra={})=>{const event={key:' ',code:'Space',preventDefault:vi.fn(),target:{closest:()=>null},...extra};listeners.keydown(event);return event;};
 return {state,button,media,handlers,control,key,dialog:value=>{dialog=value;}};
}
describe('player keyboard and system transport',()=>{
 it('uses the existing transport to start and pause with Space and consumes scrolling',()=>{
  const f=fixture();expect(f.key().preventDefault).toHaveBeenCalled();expect(f.state.playing).toBe(true);
  f.key();expect(f.state.playing).toBe(false);expect(f.button.click).toHaveBeenCalledTimes(2);
 });
 it('keeps typing, native controls and shadow-root editing intact',()=>{
  const f=fixture();f.key({target:{closest:()=>({})}});
  f.key({composedPath:()=>[{closest:()=>null},{isContentEditable:true}]});
  f.key({ctrlKey:true});f.key({metaKey:true});f.key({isComposing:true});
  expect(f.button.click).not.toHaveBeenCalled();
 });
 it('does not control the player behind an open search, profile or wallet dialog',()=>{
  const f=fixture();f.dialog(true);expect(f.key().preventDefault).not.toHaveBeenCalled();expect(f.button.click).not.toHaveBeenCalled();
 });
 it('suppresses held-Space repeats without scrolling or toggling again',()=>{
  const f=fixture();f.key();expect(f.key({repeat:true}).preventDefault).toHaveBeenCalled();expect(f.button.click).toHaveBeenCalledTimes(1);
 });
 it('ignores loading or unavailable playback without starting parallel loads',()=>{
  const f=fixture();f.state.starting=true;f.key();f.handlers.play();f.state.starting=false;f.state.ready=false;f.key();f.handlers.play();
  f.state.ready=true;f.button.disabled=true;f.key();expect(f.button.click).not.toHaveBeenCalled();
 });
 it('makes system Play and Pause idempotent and shares the gradual pause action',()=>{
  const f=fixture();f.handlers.play();f.handlers.play();expect(f.button.click).toHaveBeenCalledTimes(1);
  f.handlers.pause();f.handlers.pause();expect(f.button.click).toHaveBeenCalledTimes(2);
  f.handlers.play();f.handlers.stop();expect(f.state.playing).toBe(false);
 });
 it('publishes the real transport state and coin in the system media session',()=>{
  const f=fixture();expect(f.media.playbackState).toBe('paused');expect(f.media.metadata.title).toBe('PEPE');
  f.handlers.play();f.control.update();expect(f.media.playbackState).toBe('playing');
  f.state.ready=false;f.control.update();expect(f.media.playbackState).toBe('none');
  f.control.close();expect(f.handlers.play).toBe(null);expect(f.media.metadata).toBe(null);
 });
 it('supports a focused media key fallback when Media Session is unavailable',()=>{
  const f=fixture({system:false});f.key({key:'MediaPlayPause',code:'MediaPlayPause'});expect(f.state.playing).toBe(true);
  f.key({key:'MediaPause',code:'MediaPause'});expect(f.state.playing).toBe(false);
 });
});
