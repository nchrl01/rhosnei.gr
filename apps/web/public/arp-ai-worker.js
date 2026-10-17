// Magenta's browser compatibility module expects window, including in workers.
globalThis.window=globalThis;
let model,queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 const {id,seed,chords=['C','F','Am','G'],minor=false}=data;
 try{
  if(!model){self.postMessage({status:'Loading musical model…'});const {MusicRNN,tf}=await import('./vendor/ai/music-rnn.js?v=56');await tf.setBackend('cpu');await tf.ready();model=new MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv');await model.initialize();}
  self.postMessage({status:'Writing arpeggio phrase…'});
  let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const tones=minor?[60,63,67,72]:[60,64,67,72];
  const primer={quantizationInfo:{stepsPerQuarter:2},totalQuantizedSteps:8,notes:Array.from({length:4},(_,i)=>({pitch:tones[Math.floor(random()*tones.length)],quantizedStartStep:i*2,quantizedEndStep:i*2+1}))};
  // Decode a deterministic recurrent trajectory, then sample its neural pitch
  // probabilities with the coin PRNG. Note-off/hold tokens are omitted because
  // this instrument articulates a finite arpeggio, rather than a held melody.
  const result=await model.continueSequenceAndReturnProbabilities(primer,32,0,chords);
  const pattern=result.probs.filter((_,i)=>i%2===0).map((probs,i)=>{
   const pitches=Array.from(probs.slice(2)),sum=pitches.reduce((a,b)=>a+b,0);if(!(sum>0))throw Error('No neural pitch probabilities');
   let draw=random()*sum,index=0;for(;index<pitches.length-1;index++){draw-=pitches[index];if(draw<=0)break;}return [i,Math.max(48,Math.min(83,48+index))];
  });
  if(pattern.length<3)throw Error('Model returned too few notes');
  self.postMessage({id,pattern,status:'AI arpeggios ready'});
 }catch(error){self.postMessage({id,error:error.message,status:'AI unavailable · seeded arpeggios active'});}
}).catch(error=>self.postMessage({id:data.id,error:error.message}));};
