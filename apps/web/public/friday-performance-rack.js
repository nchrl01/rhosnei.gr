import {createGameBoyInstrument,renderGameBoyScore,compileGameBoyEvent,prepareChipPhrasing} from './gb-apu-instrument.js?v=480';
export {prepareChipPhrasing};
export const FRIDAY_OUTPUT_GAIN=10**(-8/20);
// One original four-channel core: pulse/noise interruptions are part of the
// approved instrument. This adapter only preserves the app's scheduling API.
export async function createGameBoyRack(ctx,destination,options={}){
 const bus=ctx.createGain();bus.gain.value=FRIDAY_OUTPUT_GAIN;bus.connect(destination);
 let driver;
 try{driver=await createGameBoyInstrument(ctx,bus,options);}catch(error){bus.disconnect();throw error;}
 let configured={...options};
 function schedule(event={},time=event.time??event.at??ctx.currentTime){
  const result=event.drum||event.kind==='texture'?driver.hit(event,time):
   driver.note(event.midi,time,event.gain,event.duration,event.kind,event.expression);
  if(!result)return null;
  const compiled=compileGameBoyEvent(event,configured,ctx.sampleRate);
  const register=compiled?.writes.find(([address])=>address===(compiled.channel===0?0xff12:compiled.channel===1?0xff17:0xff21))?.[1];
  const hardwareEnvelope=compiled?.channel!==2&&register!==undefined?
   {initial:register>>4,pace:register&7,increasing:Boolean(register&8)}:null;
  return {...result,chip:0,channel:compiled?.channel??event.channel,hardwareEnvelope};
 }
 return {
  schedule,note:driver.note,hit:driver.hit,texture:driver.texture,
  cancelVoice:driver.cancelVoice,cancelAfter:driver.cancelAfter,cancelDrumsAfter:driver.cancelDrumsAfter,clear:driver.clear,
  configure(changes={}){configured={...options,...changes};driver.configure(changes);},
  snapshot(){const state=driver.snapshot();return {...state,engine:'Friday Game Boy transmission',chipCount:1,channelCount:4,outputGain:FRIDAY_OUTPUT_GAIN,
   chips:[{...state,id:0,name:'Friday transmission',channelRoles:['Pulse current','Pulse response','Low wave / bass','Noise packets']}],apu0:state.apu};},
  close(){driver.close();bus.disconnect();},
 };
}
export function renderGameBoyRack(events,options={}){
 if(!Array.isArray(events)||events.length>8192)throw new RangeError('Invalid or oversized Friday chip render');
 const rendered=renderGameBoyScore(events,options);
 for(let i=0;i<rendered.left.length;i++){rendered.left[i]*=FRIDAY_OUTPUT_GAIN;rendered.right[i]*=FRIDAY_OUTPUT_GAIN;}
 return {...rendered,chipCount:1,channelCount:4,outputGain:FRIDAY_OUTPUT_GAIN};
}
