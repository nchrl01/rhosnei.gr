// Market-generated layers using the row-distortion methods documented by
// Earthbound-Battle-Backgrounds-JS. Pattern content is generated from observations.
import {BAYER} from './coin-dither.js?v=79';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
export function backgroundParameters(model,seed=0,position=0){
 const change=Number(model.change)||0,volume=unit(model.volume),activity=unit(model.activity);
 return {mode:(seed>>>0)%3,amplitude:2+unit(model.drive)*24,frequency:.025+activity*.16,
  phase:position*1.4+change*.25,spacing:7+Math.round((1-volume)*16),
  compression:.8+unit(model.pressure)*.6,seed:(seed>>>0)%997,weight:.18+unit(model.drive)*.42};
}
export function marketBackground(model,{seed=0,position=0,dither=true,width=256,height=192}={}){
 const p=backgroundParameters(model,seed,position),out=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const shift=p.amplitude*Math.sin(y*p.frequency+p.phase),u=x+(p.mode===1&&y%2?-shift:shift);
  const v=p.mode===2?y*p.compression+shift:y;
  const stripe=(1+Math.cos((u+v*.6)/p.spacing*Math.PI*2+p.seed*.13))/2;
  const ring=(1+Math.sin(Math.hypot(u-width*.5,v-height*.5)*.16-p.phase+p.seed*.07))/2;
  // Two pale layers resolve into a sparse monochrome texture through Bayer.
  const darkness=p.weight*(Math.pow(stripe,5)*.65+Math.pow(ring,8)*.35);
  const threshold=(BAYER[(y%8)*8+x%8]+.5)/64,i=(y*width+x)*4;
  const alpha=dither?(darkness>threshold?255:0):Math.round(darkness*255);
  out[i]=out[i+1]=out[i+2]=0;out[i+3]=alpha;
 }
 return out;
}
export function createMarketBackground(){
 const source=document.createElement('canvas');source.width=256;source.height=192;
 const context=source.getContext('2d');
 return {paint(target,width,height,model,settings){
  const pixels=marketBackground(model,settings);context.putImageData(new ImageData(pixels,256,192),0,0);
  if(settings.invert){context.globalCompositeOperation='source-in';context.fillStyle='#fff';context.fillRect(0,0,256,192);context.globalCompositeOperation='source-over';}
  target.save();target.imageSmoothingEnabled=!settings.nds;target.drawImage(source,0,0,width,height);target.restore();
 }};
}
