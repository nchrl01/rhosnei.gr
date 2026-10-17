import {draw,offline,wav} from '@upic/engine';import type {ArtworkInput} from '@upic/domain';
declare global {interface Window {upicRender:{set(input:ArtworkInput):void;frame(time:number,size:number):void;audio():Promise<number[]>}}}
let input:ArtworkInput;const canvas=document.createElement('canvas');document.body.style.margin='0';document.body.append(canvas);
window.upicRender={set(v){input=v;},frame(t,size){canvas.width=size;canvas.height=size;draw(canvas,input,t);},async audio(){return Array.from(wav(await offline(input,location.origin)));}};
