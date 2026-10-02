// Independent reader of the MK1 cartridge binary layout documented by
// https://github.com/ijsf/DMS-Toolbox. No ROM data is bundled with the website.
export const ROM1_SHA256='599d5e9d83355bb15ee3b36c938c11cfef63bc98ac3d745beb89c4e1879754a3';
const signed=x=>x>127?x-256:x;
export function decodeCartridge(buffer){
 const bytes=new Uint8Array(buffer);if(bytes.length!==16384||bytes[0]!==255||bytes[1]!==255)throw Error('Choose a 16 KB MK1 cartridge .BIN file');
 const word=at=>{if(at<0||at+1>=bytes.length)throw Error('Invalid ROM pointer');return bytes[at]*256+bytes[at+1];};
 const checksum=(bytes.slice(0,16382).reduce((sum,b)=>sum+b,0)+word(16382))&65535;
 if(checksum)throw Error('Cartridge checksum failed; the original file is unchanged');
 const icbTable=word(2),waveTable=word(10),waves=new Map();
 const pointer=(table,index,size)=>{const at=word(table+index*2);if(at<12||at+size>16382)throw Error('Cartridge block points outside ROM');return at;};
 function wave(id){
  if(waves.has(id))return waves.get(id);if(id<128)throw Error('This cartridge references an internal keyboard waveform that is not in the ROM');
  const at=pointer(waveTable,id-128,177),fixed=!!(bytes[at]&128),cycles=[];
  for(const [offset,length] of [[1,64],[65,64],[129,32],[161,16]])cycles.push(Float32Array.from(bytes.slice(at+offset,at+offset+length),b=>signed(b)/128));
  const result={id,cycles,level:bytes[at]&127,fixedFormants:fixed};waves.set(id,result);return result;
 }
 const patches=[];
 for(let i=0;i<20;i++){
  let id=129+i;const layers=[],seen=new Set();
  while(id){if(id<129||id>255||seen.has(id)||layers.length>=8)throw Error('Invalid linked cartridge voice');seen.add(id);
   const at=pointer(icbTable,id-129,16),name=String.fromCharCode(...bytes.slice(at+10,at+16)).replace(/\0/g,'').trim();
   layers.push({id,name,wave:wave(bytes[at+4]),transpose:signed(bytes[at+7]),detune:signed(bytes[at+8]),flags:bytes[at+6],amplitudeBlock:bytes[at+2],frequencyBlock:bytes[at+3],filterBlock:bytes[at+1]});id=bytes[at];
  }
  patches.push({index:i,name:layers[0].name||`PATCH ${i+1}`,layers});
 }
 return {patches,waves:[...waves.values()],checksum:'GOOD'};
}
// Band-limited oscillator coefficients, preserving each cycle's shape.
// DC removal and peak normalization are AV playback choices.
export function cycleCoefficients(cycle){
 const n=cycle.length,mean=cycle.reduce((s,v)=>s+v,0)/n,peak=Math.max(...cycle.map(v=>Math.abs(v-mean)),1e-6);
 const real=new Float32Array(n/2+1),imag=new Float32Array(n/2+1);
 for(let harmonic=1;harmonic<real.length;harmonic++)for(let i=0;i<n;i++){const v=(cycle[i]-mean)/peak*.7,angle=2*Math.PI*harmonic*i/n;const factor=harmonic===n/2?1/n:2/n;real[harmonic]+=v*Math.cos(angle)*factor;imag[harmonic]+=v*Math.sin(angle)*factor;}
 return {real,imag};
}
