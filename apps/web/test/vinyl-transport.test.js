import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {it,expect} from 'vitest';
it('restores vinyl starts/stops and returns to unprocessed GB audio',()=>{
 let Transport;const messages=[];
 const scope={sampleRate:48000,AudioWorkletProcessor:class{constructor(){this.port={postMessage:m=>messages.push(m)};}},registerProcessor:(_,value)=>Transport=value};
 vm.runInNewContext(readFileSync(new URL('../public/vinyl-worklet.js',import.meta.url),'utf8'),scope);
 const node=new Transport();let frame=0;
 function run(seconds){let last;
  for(let block=0;block<Math.ceil(seconds*48000/128);block++){
   const input=Float32Array.from({length:128},()=>Math.sin(frame++/31)*.2),output=[new Float32Array(128),new Float32Array(128)];
   node.process([[input,input]],[output]);
   expect(output[0].every(Number.isFinite)).toBe(true);last={input,output};
  }return last;
 }
 node.port.onmessage({data:{type:'play',serial:1}});const ready=run(.7);
 expect(node.mode).toBe('on');expect(ready.output[0]).toEqual(ready.input);
 node.port.onmessage({data:{type:'pause',serial:2}});run(.3);expect(node.mode).toBe('pause');
 node.port.onmessage({data:{type:'play',serial:3}});run(.7);expect(node.mode).toBe('on');
 expect(messages).toEqual([]);
 node.port.onmessage({data:{type:'pause',serial:4}});const stopped=run(.9);
 expect(node.mode).toBe('off');expect(stopped.output[0].every(v=>v===0)).toBe(true);
 expect(messages).toEqual([{type:'stopped',serial:4}]);
});
