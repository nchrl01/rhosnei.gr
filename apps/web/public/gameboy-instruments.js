// Original UPIC waveforms inspired by handheld chip music. Preset IDs retain
// existing coin assignments and saved Audio Lab selections.
const pulse=(count)=>Array.from({length:32},(_,i)=>i<count?15:0);
const triangle=Array.from({length:32},(_,i)=>Math.round(15*(1-Math.abs(i/16-1))));
const sine=Array.from({length:32},(_,i)=>Math.round(7.5+7.5*Math.sin(i*Math.PI/16)));
const wave=(fn)=>Array.from({length:32},(_,i)=>Math.round(Math.max(0,Math.min(15,fn(i/32)))));
export const GB_INSTRUMENTS=[
 {preset:13,name:'GB · Pulse 12.5%',family:'pulse',wave:pulse(4)},
 {preset:23,name:'GB · Pulse 25%',family:'pulse',wave:pulse(8)},
 {preset:24,name:'GB · Soft pulse',family:'pulse',wave:pulse(16),attack:.024,sustain:.42,release:.16},
 {preset:30,name:'GB · Hollow wave',family:'wave',wave:wave(t=>7.5+5.5*Math.sin(t*2*Math.PI)+2*Math.sin(t*6*Math.PI)),sustain:.5},
 {preset:31,name:'GB · Triangle',family:'wave',wave:triangle,sustain:.48},
 {preset:34,name:'GB · Soft sine',family:'wave',wave:sine,attack:.012,sustain:.38},
 {preset:35,name:'GB · Bright wave',family:'wave',wave:wave(t=>7.5+5*Math.sin(t*2*Math.PI)+2.5*Math.sin(t*4*Math.PI))},
 {preset:36,name:'GB · Pulse 50%',family:'pulse',wave:pulse(16)},
 {preset:37,name:'GB · Pulse 75%',family:'pulse',wave:pulse(24)},
 {preset:139,name:'GB · Wave pad',family:'wave',wave:wave(t=>7.5+4.5*Math.sin(t*2*Math.PI)+2*Math.sin(t*6*Math.PI)+Math.sin(t*10*Math.PI)),attack:.045,sustain:.52,release:.22},
 {preset:147,name:'GB · Triangle pluck',family:'wave',wave:triangle,decay:.14,sustain:.14,release:.07},
 {preset:169,name:'GB · Pulse pluck',family:'pulse',wave:pulse(8),decay:.12,sustain:.16,release:.06},
];
export function gameBoyProfile(preset){
 const instrument=GB_INSTRUMENTS.find(item=>item.preset===preset);
 if(!instrument)return null;
 return {family:instrument.family,attack:instrument.attack??.006,decay:instrument.decay??.1,sustain:instrument.sustain??.34,release:instrument.release??.09,noteMax:1.5,phraseMax:.65,gate:1,low:48,high:88,cutoff:instrument.family==='pulse'?6200:7200,room:.14};
}

// Keep the authored sample rate for short chip loops. decodeAudioData would
// round their length when resampling to 44.1 kHz, changing their loop tuning.
export function createGameBoyBuffer(context,bytes){
 const view=new DataView(bytes);
 if(bytes.byteLength<44||view.getUint16(20,true)!==1||view.getUint16(22,true)!==1||view.getUint16(34,true)!==16)throw Error('Invalid GB instrument sample');
 const frames=view.getUint32(40,true)/2,rate=view.getUint32(24,true);
 if(!Number.isInteger(frames)||frames<2||44+frames*2!==bytes.byteLength||rate!==48000)throw Error('Invalid GB instrument loop');
 const buffer=context.createBuffer(1,frames,rate),channel=buffer.getChannelData(0);
 for(let i=0;i<frames;i++)channel[i]=view.getInt16(44+i*2,true)/32768;
 return buffer;
}
