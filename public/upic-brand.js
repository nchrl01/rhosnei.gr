// The supplied mark and favicon use the same original ordered dither as coins.
import {createCoinDither,ditherPixels} from './coin-dither.js?v=65';
export function createUpicBrand(img,fallback){
 createCoinDither(img,fallback).set('upic-mark.png?v=61');
 const source=new Image();source.onload=()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const c=canvas.getContext('2d',{willReadFrequently:true});if(!c)return;
  c.fillStyle='#fff';c.fillRect(0,0,64,64);
  const scale=Math.min(64/source.width,64/source.height),w=source.width*scale,h=source.height*scale;
  c.drawImage(source,(64-w)/2,(64-h)/2,w,h);
  const pixels=c.getImageData(0,0,64,64);pixels.data.set(ditherPixels(pixels.data,64,64));c.putImageData(pixels,0,0);
  const favicon=document.getElementById('upic-favicon');if(favicon)favicon.href=canvas.toDataURL('image/png');
 };source.src='upic-mark.png?v=61';
}
