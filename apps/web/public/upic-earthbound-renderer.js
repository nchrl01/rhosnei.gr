import {protectMovingMarks} from './upic-mark-spacing.js?v=earthbound-14';
import {morphMarkInside} from './upic-mark-morph.js?v=earthbound-13';
import {originalArtworkPalette} from './upic-artwork-palette.js?v=earthbound-10';
// Earthbound study renderer in the app: packed mark quads, with a CPU fallback.
import {markVertex,fragment} from './upic-earthbound-shaders.js?v=earthbound-13';
import {earthboundFrame,bindEarthboundUniforms} from './upic-earthbound-core.js?v=earthbound-10';
import {buildMarkLayout} from './upic-field-rules.js?v=372';
import {imageDetailRules} from './upic-image-detail.js?v=earthbound-12';
import {artworkBackground} from './upic-artwork-detail.js?v=earthbound-10';
import {battlePatternFeed} from './upic-earthbound-sampling.js?v=earthbound-10';
const fract=x=>x-Math.floor(x),mix=(a,b,t)=>a+(b-a)*t,clamp=x=>Math.max(0,Math.min(1,x));
const hash=n=>fract(Math.sin(n)*43758.5453),fade=x=>x*x*x*(x*(x*6-15)+10);
const b2=(x,y)=>fract(Math.floor(x)/2+Math.floor(y)**2*.75);
const b4=(x,y)=>b2(x*.5,y*.5)*.25+b2(x,y),b8=(x,y)=>b4(x*.5,y*.5)*.25+b2(x,y);
function noise(x,y,z){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),n=ix+iy*57+iz*113;
 const a=fade(fract(x)),b=fade(fract(y)),c=fade(fract(z));
 return mix(mix(mix(hash(n),hash(n+1),a),mix(hash(n+57),hash(n+58),a),b),mix(mix(hash(n+113),hash(n+114),a),mix(hash(n+170),hash(n+171),a),b),c)*2-1;
}
export function createEarthboundRenderer(host,{maxDimension=1024,initialAllocation=null}={}){
 const canvas=document.createElement('canvas'),software=document.createElement('canvas');
 for(const c of [canvas,software]){c.className='pixel-blast-layer';c.setAttribute('aria-hidden','true');Object.assign(c.style,{width:'100%',height:'100%'});host.append(c);}
 const ctx=software.getContext('2d'),gl=canvas.getContext('webgl',{alpha:true,antialias:false,preserveDrawingBuffer:true});
 let program,buffer,texture,uniforms,mask=null,layoutKey='',layout=null,vertexCount=0,useSoftware=!gl,closed=false;
 let originalImage=null,imageCells=0,imagePixels=null,background=[1,1,1,1],palette=[[1,1,1],[1,1,1]];
 const detailCanvas=document.createElement('canvas');
 const stats={renderer:'earthbound',markCount:0,holderSamples:0};
 const eased=t=>{t=clamp(t);return t*t*(3-2*t);};
 const shapeFor=direction=>direction>0?[0,1,0]:direction<0?[0,0,1]:[1,0,0];
 const glideSeconds=.32,recoverySeconds=.08;
 let shapeWeights=[1,0,0],shapeFrom=[1,0,0],shapeTarget=null,shapeStarted=0;
 let layoutCoin=null,layoutWidth=0,layoutHeight=0,sizeStarted=0,sizeMoving=false,positionStarted=0,positionMoving=false,protectMotion=false;
 let geometryDirty=true,geometryData=new Float32Array(0),bufferBytes=-1,lastTransitionTime=null,displaySide=0;
 function contentBounds(){
  if(!layout||!layoutWidth)return {current:null,target:null};
  const current={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity},target={...current};
  const scale=displaySide/layoutWidth;
  function include(bounds,x,y,diameter){
   if(!(diameter>0))return;
   // Include snapped raster edges. Y in the renderer starts at the bottom.
   const radius=diameter/2+1;
   bounds.left=Math.min(bounds.left,(x-radius)*scale);bounds.right=Math.max(bounds.right,(x+radius)*scale);
   bounds.top=Math.min(bounds.top,(layoutHeight-y-radius)*scale);bounds.bottom=Math.max(bounds.bottom,(layoutHeight-y+radius)*scale);
  }
  for(const mark of layout.marks){
   include(current,mark.x,mark.y,mark.diameter);
   include(target,mark.targetX,mark.targetY,mark.targetDiameter);
  }
  return {current:Number.isFinite(current.left)?current:null,target:Number.isFinite(target.left)?target:null};
 }
 function advanceGeometry(now,instant=false){
  if(!layout||(!sizeMoving&&!positionMoving))return;
  const sizeT=instant?1:eased((now-sizeStarted)/glideSeconds);
  const elapsed=now-positionStarted,moveT=instant?1:eased(elapsed/glideSeconds);
  const settleT=instant||!protectMotion?1:eased((elapsed-glideSeconds)/recoverySeconds);
  for(const mark of layout.marks){
   const desiredDiameter=mix(mark.fromDiameter,mark.targetDiameter,sizeT);
   if(positionMoving){
    mark.x=mix(mark.fromX,mark.targetX,moveT);mark.y=mix(mark.fromY,mark.targetY,moveT);
    if(moveT>=1&&protectMotion){
     // Restore holder sizes gently once all centres are back on the safe grid.
     if(mark.recoveryDiameter===null)mark.recoveryDiameter=Math.min(mark.diameter,layout.rules.cellDiameterLimit??0);
     mark.diameter=mix(mark.recoveryDiameter,desiredDiameter,settleT);
    }else mark.diameter=desiredDiameter;
   }else mark.diameter=desiredDiameter;
  }
  if(positionMoving&&protectMotion&&moveT<1)protectMovingMarks(layout.marks,Math.min(2,layout.rules.layoutGap??2));
  sizeMoving=sizeT<1;positionMoving=positionMoving&&(moveT<1||settleT<1);geometryDirty=true;
 }
 function allocation(){
  return layout?{coinKey:layoutCoin,columns:layout.rules.columns,rows:layout.rules.rows,
   cells:layout.marks.map(({id,row,column})=>({id,row,column}))}:initialAllocation;
 }
 function advanceShape(direction,now,instant=false,reset=false){
  if(shapeTarget!==null){
   const to=shapeFor(shapeTarget),t=instant?1:eased((now-shapeStarted)/.24);
   shapeWeights=shapeFrom.map((v,i)=>mix(v,to[i],t));
  }
  if(reset||shapeTarget===null||instant){
   shapeTarget=direction;shapeWeights=shapeFor(direction);shapeFrom=shapeWeights.slice();shapeStarted=now;
  }else if(shapeTarget!==direction){
   shapeFrom=shapeWeights.slice();shapeTarget=direction;shapeStarted=now;
  }
 }

 function init(){
  const shaders=[];
  try{
   program=gl.createProgram();
   for(const [type,source]of [[gl.VERTEX_SHADER,markVertex],[gl.FRAGMENT_SHADER,fragment]]){
    const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program,shader);
   }
   for(const [name,index]of [['position',0],['aMarkCenter',1],['aMarkSize',2],['aMarkId',3],['aMarkBrightness',4]])gl.bindAttribLocation(program,index,name);
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
   buffer=gl.createBuffer();bufferBytes=-1;texture=gl.createTexture();uploadImage();layoutKey='';geometryDirty=true;useSoftware=false;
  }catch(error){useSoftware=true;stats.error=String(error.message||error);if(program)gl.deleteProgram(program);program=null;}
  finally{for(const shader of shaders)gl.deleteShader(shader);}
 }
 function uploadImage(){
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,imageCells||1,imageCells||1,0,gl.RGBA,gl.UNSIGNED_BYTE,imagePixels||new Uint8Array(4));
 }
 function updateImageDetail(inputs){
  const detail=imageDetailRules(inputs);stats.imageDetail=detail;
  if(!originalImage||imageCells===detail.cells)return;
  imageCells=detail.cells;detailCanvas.width=detailCanvas.height=imageCells;
  const context=detailCanvas.getContext('2d');
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  context.drawImage(originalImage,0,0,imageCells,imageCells);
  imagePixels=context.getImageData(0,0,imageCells,imageCells).data;
  if(gl&&!useSoftware)uploadImage();
 }
 function coinInk(u,v,color){
  if(!imagePixels)return [1,1,1];
  const x=Math.min(imageCells-1,Math.max(0,Math.floor(u*imageCells)));
  const y=Math.min(imageCells-1,Math.max(0,Math.floor(v*imageCells)));
  const i=((imageCells-1-y)*imageCells+x)*4;
  const rgb=[imagePixels[i]/255,imagePixels[i+1]/255,imagePixels[i+2]/255];
  const distance=colour=>rgb.reduce((sum,c,j)=>sum+(c-colour[j])**2,0);
  const primary=distance(palette[0])<distance(palette[1])?palette[0]:palette[1];
  const peak=Math.max(...primary),level=Math.max(.4,Math.sqrt(peak));
  return primary.map(c=>mix(1,peak>.001?c/peak*level:.4,imagePixels[i+3]/255*color));
 }
 function prepare(inputs,w,h,now,reduced){
  // Continue from what is currently displayed when a newer snapshot interrupts.
  advanceGeometry(now,reduced);
  const newCoin=layoutCoin!==inputs.coinKey;
  advanceShape(Math.sign(inputs.change),now,reduced,newCoin);
  const key=JSON.stringify([w,h,inputs.coinKey,inputs.marketCap,inputs.liquidity,inputs.totalHolders,inputs.holderBalances,inputs.chartHistory]);
  if(layoutKey!==key){
   const target=buildMarkLayout(inputs,{mode:'earthbound',mark:'auto'},w,h,allocation());
   const instant=!layout||newCoin||layoutWidth!==w||layoutHeight!==h||reduced;
   const previous=new Map((layout?.marks||[]).map(mark=>[mark.id,mark]));
   const retargetPosition=!instant&&target.marks.some(mark=>{
    const old=previous.get(mark.id);
    return old&&(Math.abs(old.targetX-mark.x)>.001||Math.abs(old.targetY-mark.y)>.001);
   });
   const keepSizePhase=!instant&&!retargetPosition&&target.marks.every(mark=>{
    const old=previous.get(mark.id);return old&&old.targetDiameter===mark.diameter;
   });
   // During a shared grid glide, retarget size and position from the same
   // displayed frame. Their common progress keeps shrinking cells separated.
   const retargetGeometry=retargetPosition||(!instant&&positionMoving&&!keepSizePhase);
   if(instant){positionMoving=false;protectMotion=false;}
   else if(retargetGeometry){
    // Scaling the same grid is a shared glide and needs no squeeze effect.
    // Guard only real cell changes / arrivals, or an interrupted guarded move.
    protectMotion=(positionMoving&&protectMotion)||target.marks.some(mark=>{
     const old=previous.get(mark.id);return !old||old.row!==mark.row||old.column!==mark.column;
    });
    positionStarted=now;positionMoving=true;
   }
   if(!keepSizePhase)sizeMoving=false;
   for(const mark of target.marks){
    const old=previous.get(mark.id);
    mark.targetX=mark.x;mark.targetY=mark.y;
    mark.fromX=instant?mark.x:retargetGeometry?(old?.x??mark.x):(old?.fromX??mark.x);
    mark.fromY=instant?mark.y:retargetGeometry?(old?.y??mark.y):(old?.fromY??mark.y);
    mark.recoveryDiameter=instant||retargetGeometry?null:(old?.recoveryDiameter??null);
    if(!instant&&positionMoving&&old){mark.x=old.x;mark.y=old.y;}
    mark.targetDiameter=mark.diameter;
    mark.fromDiameter=keepSizePhase?old.fromDiameter:instant?mark.diameter:(old?.diameter??0);
    mark.diameter=keepSizePhase?old.diameter:mark.fromDiameter;
    if(!keepSizePhase&&Math.abs(mark.fromDiameter-mark.targetDiameter)>.0001)sizeMoving=true;
   }
   layout=target;layoutKey=key;layoutCoin=inputs.coinKey;layoutWidth=w;layoutHeight=h;
   if(!keepSizePhase)sizeStarted=now;geometryDirty=true;
   if(positionMoving&&protectMotion&&now-positionStarted<glideSeconds)protectMovingMarks(layout.marks,Math.min(2,layout.rules.layoutGap??2));
   Object.assign(stats,{markCount:layout.marks.length,holderSamples:layout.rules.holderCount,reportedHolders:layout.rules.reportedHolders,aggregateHolders:layout.rules.aggregateHolders,aggregateMarks:layout.rules.aggregateMarks,gapPx:layout.rules.gapPx,baseMarkSize:layout.rules.baseMarkSize,fieldSpan:layout.rules.fieldSpan});
  }
  if(useSoftware||!geometryDirty)return;
  const length=layout.marks.length*48;
  if(geometryData.length!==length)geometryData=new Float32Array(length);
  const corners=[[-.5,-.5],[.5,-.5],[-.5,.5],[-.5,.5],[.5,-.5],[.5,.5]];let at=0;
  for(const mark of layout.marks){
   // Padding covers both snapped full-size and transport-shrunken masks.
   // The shader discards padding so it cannot paint over a neighbouring dot.
   const left=Math.floor(mark.x-mark.diameter/2)-1,bottom=Math.floor(mark.y-mark.diameter/2)-1;
   const right=Math.ceil(mark.x+mark.diameter/2)+1,top=Math.ceil(mark.y+mark.diameter/2)+1;
   for(const [x,y]of corners){
    geometryData[at++]=left+(x+.5)*(right-left);geometryData[at++]=bottom+(y+.5)*(top-bottom);
    geometryData[at++]=mark.x;geometryData[at++]=mark.y;geometryData[at++]=mark.diameter;
    geometryData[at++]=mark.column;geometryData[at++]=mark.row;geometryData[at++]=mark.brightness??1;
   }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  if(bufferBytes!==geometryData.byteLength){gl.bufferData(gl.ARRAY_BUFFER,geometryData,gl.DYNAMIC_DRAW);bufferBytes=geometryData.byteLength;}
  else if(geometryData.length)gl.bufferSubData(gl.ARRAY_BUFFER,0,geometryData);
  vertexCount=geometryData.length/8;geometryDirty=false;
 }
 function cpu(w,h,time,seed,inputs,identity,color,reduced,pixelPresence,inkColor){
  if(!ctx)return;
  ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
  const frame=earthboundFrame(inputs.coinKey,time),offset=(seed%65521)/65521*173.6;
  for(const m of layout.marks){
   if(hash(m.column*73.17+m.row*193.41+7.3)>pixelPresence)continue;
   const x=m.x-Math.floor(w/2),y=m.y-Math.floor(h/2);
   const u=x/h,v=y/h;
   let sum=1,freq=1;
   for(let i=0;i<5;i++){sum+=noise((u*.25+offset)*freq,(v*.25+offset*.317)*freq,time*.05*freq);freq*=1.25;}
   let base=(sum*.5+.5)*.5-.65+(1.225-.5)*.3;
   base+=.28*noise(u*6+offset*.19,v*6+offset*.41,time*.04);base=Math.max(base,.07+.045*noise(u*14+offset,v*14+offset,time*.03));
   let feed=battlePatternFeed(u,v,time,frame,base);
   const brightness=feed+b8(m.column,m.row)-.5<.5?.8:1;
   const diameter=m.diameter*Math.sqrt(pixelPresence);
   if(!(diameter>0))continue;
   const left=Math.floor(m.x-diameter/2+.5),bottom=Math.floor(m.y-diameter/2+.5),half=diameter/2;
   ctx.fillStyle='rgb('+coinInk(m.x/w,m.y/h,color).map(c=>Math.round(255*c*inkColor*brightness*Math.min(1,(m.brightness??1)*1.6))).join(',')+')';
   for(let dy=0;dy<diameter;dy++)for(let dx=0;dx<diameter;dx++){
    const px=dx+.5-half,py=dy+.5-half;
    const inside=morphMarkInside(px,py,diameter,shapeWeights);
    if(inside)ctx.fillRect(left+dx,h-1-bottom-dy,1,1);
   }
  }
 }
 const lost=e=>{e.preventDefault();useSoftware=true;layoutKey='';};
 const restored=()=>{if(!closed)init();};
 canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);if(gl)init();
 return {
  get kind(){return useSoftware?'canvas':'webgl';},
  get surface(){return useSoftware?software:canvas;},
  get contentBounds(){return contentBounds();},
  get allocation(){return allocation();},
  setImage(source){
   stats.imageAvailable=Boolean(source);mask=source;palette=source?originalArtworkPalette(source.originalPixels||source.pixels,{includeNeutrals:true}):[[1,1,1],[1,1,1]];originalImage=null;imageCells=0;imagePixels=null;
   if(source){
    background=artworkBackground(source);originalImage=document.createElement('canvas');
    originalImage.width=source.width;originalImage.height=source.height;
    originalImage.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(source.originalPixels||source.pixels),source.width,source.height),0,0);
   }
   if(gl&&!useSoftware)uploadImage();
  },
  render({width,height,time=0,seed=0,inputs,identity=0,artworkColor=0,presence=1,pixelPresence=1,inkColor=1,reducedMotion=false,transitionTime=null}){
   if(closed)return;
   // Keep enough raster cells for 10,000 holders even in a small mobile panel.
   const side=Math.max(1,Math.min(width,height));displaySide=side;
   const w=Math.max(512,Math.min(maxDimension,Math.round(side))),h=w;
   for(const c of [canvas,software]){if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;Object.assign(c.style,{width:side+'px',height:side+'px',left:(width-side)/2+'px',top:(height-side)/2+'px',right:'auto',bottom:'auto',opacity:String(clamp(presence))});}
   const now=Number.isFinite(transitionTime)?transitionTime:performance.now()/1000;
   if(lastTransitionTime!==null&&now<lastTransitionTime){layoutKey='';layout=null;layoutCoin=null;sizeMoving=false;positionMoving=false;shapeTarget=null;geometryDirty=true;}
   lastTransitionTime=now;
   updateImageDetail(inputs);prepare(inputs,w,h,now,reducedMotion);identity=0;artworkColor=mask?artworkColor:0;
   canvas.hidden=useSoftware;software.hidden=!useSoftware;host.dataset.pixelBlast=useSoftware?'canvas':'ready';
   if(useSoftware)cpu(w,h,time,seed,inputs,identity,artworkColor,reducedMotion,pixelPresence,inkColor);
   else{
    gl.useProgram(program);gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    Object.assign(uniforms,{uMarkShapeWeights:shapeWeights,uIdentityImage:0,uImageSize:[w,h],uPixelPresence:pixelPresence,uInkColor:inkColor,uResolution:[w,h],uCanvasScale:[1,1],uIdentity:identity,uIdentityMotion:reducedMotion?0:.3,uTime:time,uSeed:(seed%65521)/65521*173.6,uArtworkColor:artworkColor,uArtworkBackground:background,uArtworkColorA:palette[0],uArtworkColorB:palette[1],uImageCells:imageCells||4});
    bindEarthboundUniforms({uniforms},{time,inputs,settings:{mode:'earthbound'}});
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [index,size,offset]of [[0,2,0],[1,2,2],[2,1,4],[3,2,5],[4,1,7]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,32,offset*4);}
    gl.drawArrays(gl.TRIANGLES,0,vertexCount);
   }
   Object.assign(stats,{backend:this.kind,identity,artworkColor,presence,shapeWeights:shapeWeights.slice(),sizeTransition:sizeMoving,positionTransition:positionMoving});
  },
  clear(){lastTransitionTime=null;layoutKey='';layout=null;layoutCoin=null;sizeMoving=false;positionMoving=false;shapeTarget=null;geometryDirty=true;if(gl&&!useSoftware){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}ctx?.clearRect(0,0,software.width,software.height);},
  snapshot(){return {...stats};},
  close(){closed=true;canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);if(gl){if(buffer)gl.deleteBuffer(buffer);if(texture)gl.deleteTexture(texture);if(program)gl.deleteProgram(program);}canvas.remove();software.remove();}
 };
}
