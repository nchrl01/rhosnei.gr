// Earthbound study renderer in the app: packed mark quads, with a CPU fallback.
import {markVertex,fragment} from './upic-earthbound-shaders.js?v=earthbound-5';
import {earthboundFrame,bindEarthboundUniforms} from './upic-earthbound-core.js?v=earthbound-5';
import {buildMarkLayout} from './upic-field-rules.js?v=earthbound-5';
import {preparePixelIdentity,samplePixelIdentity} from './pixel-identity.js?v=276';
import {battlePatternFeed} from './upic-earthbound-sampling.js?v=earthbound-5';
const fract=x=>x-Math.floor(x),mix=(a,b,t)=>a+(b-a)*t,clamp=x=>Math.max(0,Math.min(1,x));
const hash=n=>fract(Math.sin(n)*43758.5453),fade=x=>x*x*x*(x*(x*6-15)+10);
const b2=(x,y)=>fract(Math.floor(x)/2+Math.floor(y)**2*.75);
const b4=(x,y)=>b2(x*.5,y*.5)*.25+b2(x,y),b8=(x,y)=>b4(x*.5,y*.5)*.25+b2(x,y);
function noise(x,y,z){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),n=ix+iy*57+iz*113;
 const a=fade(fract(x)),b=fade(fract(y)),c=fade(fract(z));
 return mix(mix(mix(hash(n),hash(n+1),a),mix(hash(n+57),hash(n+58),a),b),mix(mix(hash(n+113),hash(n+114),a),mix(hash(n+170),hash(n+171),a),b),c)*2-1;
}
export function createEarthboundRenderer(host){
 const canvas=document.createElement('canvas'),software=document.createElement('canvas');
 for(const c of [canvas,software]){c.className='pixel-blast-layer';c.setAttribute('aria-hidden','true');Object.assign(c.style,{width:'100%',height:'100%'});host.append(c);}
 const ctx=software.getContext('2d'),gl=canvas.getContext('webgl',{alpha:true,antialias:false,preserveDrawingBuffer:true});
 let program,buffer,texture,uniforms,mask=null,layoutKey='',layout=null,vertexCount=0,useSoftware=!gl,closed=false;
 const stats={renderer:'earthbound',markCount:0,holderSamples:0};
 function init(){
  const shaders=[];
  try{
   program=gl.createProgram();
   for(const [type,source]of [[gl.VERTEX_SHADER,markVertex],[gl.FRAGMENT_SHADER,fragment]]){
    const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program,shader);
   }
   for(const [name,index]of [['position',0],['aMarkCenter',1],['aMarkSize',2],['aMarkId',3]])gl.bindAttribLocation(program,index,name);
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
   const locations=new Map();
   for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(program,i);locations.set(u.name,{type:u.type,location:gl.getUniformLocation(program,u.name)});}
   uniforms=new Proxy({}, {set(_,name,value){const u=locations.get(name);if(!u)return true;
    if(u.type===gl.SAMPLER_2D)gl.uniform1i(u.location,value);
    else if(u.type===gl.FLOAT_VEC2)gl.uniform2fv(u.location,value);
    else if(u.type===gl.FLOAT_VEC3)gl.uniform3fv(u.location,value);
    else if(u.type===gl.FLOAT_VEC4)gl.uniform4fv(u.location,value);
    else gl.uniform1f(u.location,value);return true;
   }});
   buffer=gl.createBuffer();texture=gl.createTexture();uploadImage();layoutKey='';useSoftware=false;
  }catch(error){useSoftware=true;stats.error=String(error.message||error);if(program)gl.deleteProgram(program);program=null;}
  finally{for(const shader of shaders)gl.deleteShader(shader);}
 }
 function uploadImage(){
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,mask?.width||1,mask?.height||1,0,gl.RGBA,gl.UNSIGNED_BYTE,mask?.texture||new Uint8Array(4));
 }
 function prepare(inputs,w,h){
  const key=JSON.stringify([w,h,inputs.coinKey,inputs.marketCap,inputs.liquidity,inputs.holderBalances,Math.sign(inputs.change)]);
  if(layoutKey===key)return;
  layout=buildMarkLayout(inputs,{mode:'earthbound',mark:'auto'},w,h);layoutKey=key;
  Object.assign(stats,{markCount:layout.marks.length,holderSamples:layout.rules.holderCount,gapPx:layout.rules.gapPx,baseMarkSize:layout.rules.baseMarkSize,fieldSpan:layout.rules.fieldSpan});
  if(useSoftware)return;
  const data=new Float32Array(layout.marks.length*42),corners=[[-.5,-.5],[.5,-.5],[-.5,.5],[-.5,.5],[.5,-.5],[.5,.5]];let at=0;
  for(const mark of layout.marks){
   // Match earthboundMark's pixel-aligned origin. After edge shrink, the
   // reserved centre and final diameter can have opposite parity; unsnapped
   // quads then cut off the shape's last pixel row or column.
   const left=Math.floor(mark.x-mark.diameter/2+.5),bottom=Math.floor(mark.y-mark.diameter/2+.5);
   for(const [x,y]of corners){data.set([left+(x+.5)*mark.diameter,bottom+(y+.5)*mark.diameter,mark.x,mark.y,mark.diameter,mark.column,mark.row],at);at+=7;}
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);vertexCount=data.length/7;
 }
 function cpu(w,h,time,seed,inputs,identity,color,reduced,pixelPresence,inkColor){
  if(!ctx)return;
  ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
  const frame=earthboundFrame(inputs.coinKey,time),offset=(seed%65521)/65521*173.6,guide=new Float32Array(5),imageWidth=w,imageHeight=h;
  const flow=(.028-.014*identity)*(reduced?0:.3),phase=time*.65+offset*.013;
  const palette=(mask?.palette||[[1,1,1],[1,1,1]]).map(c=>'rgb('+c.map(v=>Math.round(255*inkColor*mix(1,v,color))).join(',')+')');
  for(const m of layout.marks){
   if(hash(m.column*73.17+m.row*193.41+7.3)>pixelPresence)continue;
   const x=m.x-Math.floor(w/2),y=m.y-Math.floor(h/2);guide.fill(0);guide[4]=-1;
   if(mask&&(identity>0||color>0))samplePixelIdentity(mask,x/imageWidth,y/imageHeight,1,flow,phase,guide);
   const u=(x+guide[2]*identity*.045*imageWidth)/h,v=(y+guide[3]*identity*.045*imageHeight)/h;
   let sum=1,freq=1;
   for(let i=0;i<5;i++){sum+=noise((u*.25+offset)*freq,(v*.25+offset*.317)*freq,time*.05*freq);freq*=1.25;}
   let base=(sum*.5+.5)*.5-.65+(1.225-.5)*.3;
   base+=.28*noise(u*6+offset*.19,v*6+offset*.41,time*.04);base=Math.max(base,.07+.045*noise(u*14+offset,v*14+offset,time*.03));
   let feed=battlePatternFeed(u,v,time,frame,base);
   feed=mix(feed,.04+.88*guide[0]+Math.max(-.5,Math.min(.5,feed-.5))*.16,identity);
   if(feed+b8(m.column,m.row)-.5<.5)continue;
   const direction=Math.sign(inputs.change);let diameter=Math.max(1,Math.floor(m.diameter*Math.sqrt(pixelPresence)*mix(1,.76+.24*guide[1],identity)+.5));
   if(direction)diameter=Math.max(3,2*Math.floor((diameter-1)/2)+1);
   diameter=Math.min(m.diameter,diameter);
   const left=Math.floor(m.x-diameter/2+.5),bottom=Math.floor(m.y-diameter/2+.5),half=diameter/2,stroke=Math.max(1,Math.floor(diameter*.23+.5))*.5;
   const colorIndex=guide[4]<0?(hash(m.column*127.1+m.row*311.7)>=.5?1:0):guide[4];ctx.fillStyle=palette[colorIndex];
   for(let dy=0;dy<diameter;dy++)for(let dx=0;dx<diameter;dx++){
    const px=dx+.5-half,py=dy+.5-half;
    const inside=direction>0?Math.min(Math.abs(px),Math.abs(py))<=stroke:direction<0?Math.abs(Math.abs(px)-Math.abs(py))*.70710678<=stroke:px*px+py*py<=half*half;
    if(inside)ctx.fillRect(left+dx,h-1-bottom-dy,1,1);
   }
  }
 }
 const lost=e=>{e.preventDefault();useSoftware=true;layoutKey='';};
 const restored=()=>{if(!closed)init();};
 canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);if(gl)init();
 return {
  get kind(){return useSoftware?'canvas':'webgl';},
  setImage(source){mask=preparePixelIdentity(source);if(gl&&!useSoftware)uploadImage();},
  render({width,height,time=0,seed=0,inputs,identity=0,artworkColor=0,presence=1,pixelPresence=1,inkColor=1,reducedMotion=false}){
   if(closed)return;
   const scale=Math.min(1,1024/Math.max(1,width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
   for(const c of [canvas,software]){if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;c.style.opacity=String(clamp(presence));}
   prepare(inputs,w,h);identity=mask?identity:0;artworkColor=mask?artworkColor:0;
   canvas.hidden=useSoftware;software.hidden=!useSoftware;host.dataset.pixelBlast=useSoftware?'canvas':'ready';
   if(useSoftware)cpu(w,h,time,seed,inputs,identity,artworkColor,reducedMotion,pixelPresence,inkColor);
   else{
    gl.useProgram(program);gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    Object.assign(uniforms,{uIdentityImage:0,uImageSize:[w,h],uPixelPresence:pixelPresence,uInkColor:inkColor,uResolution:[w,h],uCanvasScale:[1,1],uIdentity:identity,uIdentityMotion:reducedMotion?0:.3,uTime:time,uSeed:(seed%65521)/65521*173.6,uArtworkColor:artworkColor,uArtworkColorA:mask?.palette[0]||[1,1,1],uArtworkColorB:mask?.palette[1]||[1,1,1]});
    bindEarthboundUniforms({uniforms},{time,inputs,settings:{mode:'earthbound'}});
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [index,size,offset]of [[0,2,0],[1,2,2],[2,1,4],[3,2,5]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,28,offset*4);}
    gl.drawArrays(gl.TRIANGLES,0,vertexCount);
   }
   Object.assign(stats,{backend:this.kind,identity,artworkColor,presence});
  },
  clear(){if(gl&&!useSoftware){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}ctx?.clearRect(0,0,software.width,software.height);},
  snapshot(){return {...stats};},
  close(){closed=true;canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);if(gl){if(buffer)gl.deleteBuffer(buffer);if(texture)gl.deleteTexture(texture);if(program)gl.deleteProgram(program);}canvas.remove();software.remove();}
 };
}
