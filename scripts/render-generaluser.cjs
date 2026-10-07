/* Offline sample builder. Usage: node scripts/render-generaluser.cjs <js-synthesizer package directory> <GeneralUser-GS.sf2>
   Uses FluidSynth's SoundFont synthesis before baking notes. No synth/model runtime is shipped to the browser. */
const fs=require('node:fs'),path=require('node:path');
const pkg=path.resolve(process.argv[2]),JSSynth=require(pkg),fluid=require(path.join(pkg,'externals/libfluidsynth-2.4.6.js'));
const dest=path.resolve(__dirname,'../public/samples/generaluser');fs.mkdirSync(dest,{recursive:true});
const presets=[[13,8,81,'Doctor Solo'],[23,0,48,'Fast Strings'],[24,0,49,'Slow Strings'],[30,0,73,'Flute'],[31,0,78,'Whistle'],[34,8,80,'Sine Wave'],[35,8,80,'Sine Wave'],[36,0,80,'Square Lead'],[37,0,81,'Saw Lead'],[139,0,99,'Atmosphere'],[147,0,50,'Synth Strings 1'],[169,0,16,'Tonewheel Organ']];
JSSynth.Synthesizer.initializeWithFluidSynthModule(fluid);
(async()=>{
 await JSSynth.waitForReady();const synth=new JSSynth.Synthesizer(),rate=32000,n=rate*3;
 synth.init(rate,{reverbActive:false,chorusActive:true,chorusLevel:.3,initialGain:.5,polyphony:64});
 const bytes=fs.readFileSync(process.argv[3]);const id=await synth.loadSFont(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const files=[],rendered=new Map();
 for(const [preset,bank,program,name] of presets){
  for(const midi of [48,60,72,84])for(const velocity of [64,104]){
   const file=`b${bank}-p${program}-n${midi}-v${velocity}.wav`,key=file;
   let trim;
   if(!rendered.has(key)){
    synth.midiAllSoundsOff(0);synth.render([new Float32Array(rate/4),new Float32Array(rate/4)]);
    synth.midiProgramSelect(0,id,bank,program);synth.midiNoteOn(0,midi,velocity);
    const audio=[new Float32Array(n),new Float32Array(n)];synth.render(audio);
    // Seamless sustain: the loop wraps into the end of the crossfade window.
    const start=rate*1.5,end=rate*2.9,fade=rate*.08;
    let energy=0,peak=0;
    for(const channel of audio){
     for(let i=0;i<fade;i++){const x=i/(fade-1);channel[end-fade+i]=channel[end-fade+i]*(1-x)+channel[start+i]*x;}
     for(let i=0;i<n;i++){peak=Math.max(peak,Math.abs(channel[i]));if(i>rate/3&&i<end)energy+=channel[i]**2;}
    }
    const rms=Math.sqrt(energy/(2*(end-rate/3))),scale=Math.min(.13/Math.max(.00001,rms),.88/Math.max(.00001,peak));
    if(rms<1e-5)throw Error('Silent preset '+name+' '+midi);
    const out=Buffer.alloc(44+n*4);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(n*4,40);
    for(let i=0;i<n;i++)for(let c=0;c<2;c++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,audio[c][i]*scale))*32767),44+i*4+c*2);
    fs.writeFileSync(path.join(dest,file),out);rendered.set(key,1);
   }
   files.push({preset,name:'GeneralUser · '+name,bank,program,midi,velocity,file,trim:1,loop:true,loopStart:1.58,loopEnd:2.9,correction:0});
  }
  console.log('Rendered',name);
 }
 fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({version:1,library:'GeneralUser GS 2.0.3',files},null,2)+'\n');synth.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
