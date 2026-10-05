import {whisperVoice} from './voice-whisper.js?v=148';
let tts,queue=Promise.resolve(),lastProgress=-1;
self.onmessage=({data})=>{queue=queue.then(async()=>{
 const {id,text}=data;
 try{
  if(!tts){self.postMessage({status:'Loading coin voice…'});const {KokoroTTS,env}=await import('./vendor/ai/kokoro.web.js?v=56');env.wasmPaths='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/';
   tts=await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'q8',device:'wasm',progress_callback:p=>{const progress=Math.round(p.progress||0);if(p.status==='progress'&&p.file?.endsWith('.onnx')&&progress!==lastProgress){lastProgress=progress;self.postMessage({status:'Loading coin voice · '+progress+'%'});}}});
  }
  self.postMessage({status:'Preparing whispered coin name…'});const audio=await tts.generate(text+'.',{voice:'af_nicole',speed:.78});
  const samples=whisperVoice(new Float32Array(audio.audio),audio.sampling_rate);self.postMessage({id,samples,rate:audio.sampling_rate,status:'Whispered coin voice ready'},[samples.buffer]);
 }catch(error){self.postMessage({id,error:error.message,status:'Coin voice unavailable · click Retry'});}
}).catch(error=>self.postMessage({id:data.id,error:error.message}));};
