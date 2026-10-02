import assert from 'node:assert/strict';
import {createMusicContext,unlockPlayback,stopLegacyPlayback} from '../public/audio-unlock.js';
let steps=[],constructed,playCount=0,pauseCount=0;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'iPhone',audioSession:{type:'auto'}}});
class Context{
 constructor(options){constructed=options;this.state='suspended';this.sampleRate=48000;this.destination={};this.listeners=new Set();}
 createBuffer(channels,frames,rate){assert.equal(frames,1);assert.equal(rate,48000);return {};}
 createBufferSource(){return {connect:()=>steps.push('connect'),disconnect(){},start:()=>steps.push('source-start')};}
 resume(){steps.push('resume');this.state='running';return Promise.resolve();}
 addEventListener(type,fn){this.listeners.add(fn);}
 removeEventListener(type,fn){this.listeners.delete(fn);}
}
globalThis.AudioContext=Context;
globalThis.Audio=class{setAttribute(){}play(){playCount++;return Promise.resolve();}pause(){pauseCount++;}};
const context=createMusicContext();assert.equal(navigator.audioSession.type,'playback');assert.equal(constructed,undefined,'Must use native device sample rate');
await unlockPlayback(context);assert.deepEqual(steps,['connect','source-start','resume']);assert.equal(context.listeners.size,0);assert.equal(playCount,0,'No fallback media when playback mode is available');
const blocked=new Context();blocked.resume=()=>Promise.resolve();await assert.rejects(unlockPlayback(blocked),{name:'AudioUnlockError'});assert.equal(blocked.listeners.size,0);
const interrupted=new Context();interrupted.state='interrupted';await unlockPlayback(interrupted);assert.equal(interrupted.state,'running');
delete navigator.audioSession;const legacy=new Context();await unlockPlayback(legacy);assert.equal(playCount,1);stopLegacyPlayback();assert.equal(pauseCount,1);
console.log('PASS: music category, native sample rate, source started inside gesture, blocked-start error, interruption resume, legacy iOS route fallback');
