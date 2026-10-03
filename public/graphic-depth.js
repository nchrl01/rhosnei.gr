// Deterministic score geometry: source time and coin seed set the layout.
// The caller clears the surface on silence, seek and transport changes.
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
export function drawGraphicDepth(c,{width:w,height:h,time,seed,level,drive,balance,transient,accent,reducedMotion=false}){
 const t=reducedMotion?0:time,energy=unit(drive*.6+level*.4);
 const phase=(seed%997)/997*Math.PI*2;
 const color=`rgb(255 ${Math.round(255*(1-unit(accent)))} ${Math.round(255-71*unit(accent))})`,size=Math.min(w,h);
 c.save();c.lineWidth=Math.max(1,w/900);
 // Broad, slowly drifting contour trails give the field foreground and depth.
 for(let trail=7;trail>=0;trail--){
  const age=trail*.19,clock=t-age;
  c.strokeStyle=trail===0?color:'#fff';
  c.globalAlpha=(trail===0?.55:.045)*(1-trail/10)*( .45+level*.55);
  c.beginPath();
  for(let i=0;i<=120;i++){
   const u=i/120,x=u*w;
   const arch=Math.sin(u*Math.PI);
   const y=h*(.48+.19*Math.sin(u*5+clock*.21+phase)*arch)
    +Math.sin(u*16-clock*.43+phase)*size*(.035+energy*.085)*arch
    +(balance-.5)*h*.15+age*size*.011;
   if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
  }
  c.stroke();
 }
 // A perspective dot sheet bends continuously with the measured sound level.
 const cols=w<650?45:66,rows=30;
 for(let row=0;row<rows;row++){
  const depth=row/(rows-1),spread=.2+.95*depth;
  for(let col=0;col<cols;col++){
   const u=col/(cols-1)-.5;
   const wave=Math.sin(u*10+t*.32+phase+depth*4);
   const x=w*.5+u*w*spread+Math.sin(depth*5+t*.2+phase)*w*.055;
   const y=h*(.12+depth*.8)+wave*size*(.035+energy*.09)*Math.sin(depth*Math.PI);
   const r=Math.max(.65,size*(.0008+.0016*depth)*(1+level*.35));
   c.globalAlpha=.12+depth*.42;
   const ribbon=Math.abs(u-.23*Math.sin(t*.2+depth*3+phase))<.025;
   c.fillStyle=ribbon?color:'#fff';
   c.fillRect(x,y,r,r);
  }
 }
 // Angular paths open on attacks; they stretch rather than switching on/off.
 c.globalAlpha=.16+unit(transient)*.5;c.strokeStyle=color;
 for(let band=0;band<3;band++){
  c.beginPath();
  for(let i=0;i<17;i++){
   const x=i/16*w,zig=(i%2?1:-1);
   const y=h*(.25+band*.25)+zig*size*(.008+energy*.055+transient*.018)
    +Math.sin(i*.3+t*.25+phase+band)*size*.045;
   if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
  }
  c.stroke();
 }
 c.restore();
}
