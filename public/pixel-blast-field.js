import {holderClusterGLSL} from './holder-cluster-field.js?v=169';
import {withPixelGenerations} from './pixel-generations.js?v=167';
import {battleMotion,battleGLSL} from './earthbound-motion.js?v=171';
import {capitalGLSL} from './capital-field.js?v=167';
import {createPixelBlastCanvas,preparePixelIdentity} from './pixel-blast-canvas.js?v=171';
import {PIXEL_BLAST_REFERENCE,pixelBlastParameters} from './pixel-blast-parameters.js?v=171';
export {PIXEL_BLAST_REFERENCE,pixelBlastParameters};
// PixelBlast shader adapted from React Bits / David Haz (2026).
// Full license: vendor/ui/REACT-BITS-LICENSE.md. Market/audio adapter by $UPIC.
// One shared frame clock; no autonomous animation or pointer-triggered effects.
const vertex = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform vec2 uCanvasScale;
uniform float uPixelSize;
uniform float uDotSize;
uniform ivec2 uGridStart;
uniform int uGridColumns;
flat out vec2 vPixelId;
void main(){
 vPixelId=vec2(uGridStart+ivec2(gl_InstanceID%uGridColumns,gl_InstanceID/uGridColumns));
 vec2 corner=vec2(float(gl_VertexID==1||gl_VertexID==2||gl_VertexID==4),float(gl_VertexID==2||gl_VertexID==4||gl_VertexID==5));
 vec2 center=floor(uResolution*.5)+(vPixelId+.5)*uPixelSize*uCanvasScale;
 vec2 extent=(max(uDotSize*1.5,uPixelSize)*.5+uPixelSize*.5+2.)*uCanvasScale;
 gl_Position=vec4((center+(corner*2.-1.)*extent)/uResolution*2.-1.,0.,1.);
}`;
const fragment = `#version 300 es

precision highp float;
flat in vec2 vPixelId;

uniform vec3  uColor;
uniform vec2  uResolution;
uniform vec2  uCanvasScale;
uniform float uTime;
uniform float uEventTime;
uniform float uSeed;
uniform float uDotSize;
uniform float uPixelPresence;
uniform float uEdgeFade;
uniform float uDotStrength;
uniform float uPixelSize;
uniform float uNoiseCellSize;
uniform float uScale;
uniform float uDensity;
uniform sampler2D uIdentityImage;
uniform float uIdentity;
uniform float uIdentityMotion;
uniform float uPixelJitter;
uniform int   uEnableRipples;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;
uniform int   uLiquid;
uniform float uLiquidStrength;
uniform float uLiquidRadius;
uniform float uLiquidTime;
uniform float uNoiseAmount;
uniform float uEcosystem;

const int   MAX_CLICKS = 6;

uniform vec2  uClickPos  [MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];
uniform float uClickStrengths[MAX_CLICKS];
uniform vec2  uClickDirections[MAX_CLICKS];

out vec4 fragColor;

float Bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2. + a.y * a.y * .75);
}
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

#define FBM_OCTAVES     5
#define FBM_LACUNARITY  1.25
#define FBM_GAIN        1.0

float hash11(float n){ return fract(sin(n)*43758.5453); }

float vnoise(vec3 p){
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0  = mix(x00, x10, w.y);
  float y1  = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

float fbm2(vec2 uv, float t){
  vec3 p = vec3(uv * uScale + vec2(uSeed, uSeed * .317), t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 1.0;
  for (int i = 0; i < FBM_OCTAVES; ++i){
    sum  += amp * vnoise(p * freq);
    freq *= FBM_LACUNARITY;
    amp  *= FBM_GAIN;
  }
  return sum * 0.5 + 0.5;
}

${capitalGLSL}
${holderClusterGLSL}
${battleGLSL}

// Upstream liquid displacement, driven by finite market/audio touches. Warp
// the sampled field before drawing squares so their edges remain orthogonal.
vec2 liquidOffset(vec2 point){
  vec2 result=vec2(0.0);
  if(uLiquid==0||uLiquidStrength<=0.0)return result;
  vec2 viewSize=uResolution/uCanvasScale;
  vec2 origin=floor(uResolution*.5)/uCanvasScale;
  float radius=max(.001,.12*uLiquidRadius);
  for(int i=0;i<MAX_CLICKS;++i){
    vec2 pos=uClickPos[i];
    float age=uEventTime-uClickTimes[i];
    if(pos.x<0.0||age<0.0||age>=3.0)continue;
    vec2 delta=point-(pos-origin)/viewSize.y;
    float distanceSquared=dot(delta,delta);
    if(distanceSquared>12.0*radius*radius)continue;
    float intensity=exp(-distanceSquared/(radius*radius))*exp(-age*1.8)*uClickStrengths[i];
    float wave=.5+.5*sin(uLiquidTime+intensity*6.2831853);
    result+=uClickDirections[i]*uLiquidStrength*intensity*wave;
  }
  return result;
}

float identityInk(vec2 point){
  vec2 viewSize=uResolution/uCanvasScale;
  float side=.82*min(viewSize.x,viewSize.y);
  vec2 p=point/side;
  float flow=((1.0-uIdentity)*.1+.012)*uIdentityMotion;
  float phase=uTime*.65+uSeed*.013;
  vec2 uv=vec2(.5+p.x,.5-p.y)+vec2(
    sin(p.y*9.0+phase)+.35*sin(p.x*5.0-phase*.7),
    sin(p.x*8.0-phase*.85)+.3*sin(p.y*5.0+phase*.6)
  )*flow;
  if(any(lessThan(uv,vec2(0.0)))||any(greaterThanEqual(uv,vec2(1.0))))return 0.0;
  return texture(uIdentityImage,uv).r;
}

// Sound injects local motion into the same noise coordinates. There is no
// second ink mask, brightness overlay, or independently drawn sound shape.
vec2 dataMotion(vec2 point){
 vec2 flow=vec2(0.);
 vec2 origin=floor(uResolution*.5)/uCanvasScale;
 for(int i=0;i<MAX_CLICKS;i++){
  float age=uEventTime-uClickTimes[i];
  if(uClickPos[i].x<0.||age<0.||age>1.8)continue;
  float strength=uClickStrengths[i];
  float envelope=smoothstep(0.,.16,age)*(1.-smoothstep(.25,1.8,age));
  vec2 delta=(point-(uClickPos[i]-origin))/vec2(100.,65.);
  float weight=exp(-dot(delta,delta)*1.5)*envelope*strength;
  vec2 direction=uClickDirections[i];
  flow+=vec2(direction.x-delta.y*.35,direction.y+delta.x*.35)*weight*70.;
 }
 return flow;
}

void main(){
  float pixelSize = uPixelSize;
  vec2 viewSize=uResolution/uCanvasScale;
  vec2 origin=floor(uResolution*.5);
  vec2 rasterPoint=floor(gl_FragCoord.xy);
  vec2 fragCoord = (rasterPoint-origin)/uCanvasScale;
  float aspectRatio = viewSize.x / viewSize.y;

  vec2 pixelId = vPixelId;
  vec2 squarePoint=(pixelId+.5)*pixelSize;
  float cellPixelSize = uNoiseCellSize;
  vec2 cellId = floor(squarePoint / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 displacement=dataMotion(squarePoint)/viewSize.y;
  vec2 samplePoint=squarePoint+displacement*viewSize.y;
  vec2 uv = battleWarp(squarePoint / viewSize * vec2(aspectRatio, 1.0)+displacement);

  float base = fbm2(uv, uTime * 0.05);
  base = base * 0.5 - 0.65;

  float feed = base + (uDensity - 0.5) * 0.3;
  // Distributed local populations, with no central image or radial attractor.
  feed+=uEcosystem*vnoise(vec3(uv*6.0+vec2(uSeed*.19,uSeed*.41),uTime*.04));
  feed=max(feed,.07+.045*vnoise(vec3(uv*14.0+uSeed,uTime*.03)));
  feed=capitalFeed(uv,feed);
  feed+=holderClusterFeed(squarePoint/viewSize,aspectRatio);
  float speed     = uRippleSpeed;
  float thickness = uRippleThickness;
  const float dampT     = 1.0;
  const float dampR     = 10.0;


  // The coin is a target for the same dot field, not a pasted image layer.
  // Its coordinates flow only with the existing market/audio clock. The
  // low-cap field is scattered; a high-cap field settles into recognizable ink.
  float imageInk=0.0;
  if(uIdentity>0.0){
    imageInk=identityInk(mix(samplePoint,squarePoint,uIdentity));
    float imageFeed=mix(-.05,1.05,imageInk);
    feed=mix(feed,imageFeed,uIdentity);
  }

  float bayer = Bayer8(pixelId) - 0.5;
  float bw = step(0.5, feed + bayer);

  float h = fract(sin(dot(pixelId, vec2(127.1, 311.7))) * 43758.5453);
  float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
  float coverage = bw;
  // The reference edge envelope shrinks individual squares. Their alpha
  // remains binary, including when quiet activity makes them smaller.
  float backgroundScale=mix(1.0,.7+.3*imageInk,uIdentity);
  vec2 centrePhysical=origin+squarePoint*uCanvasScale;
  vec2 screenUV=centrePhysical/uResolution;
  float edgeDistance=min(min(screenUV.x,1.0-screenUV.x),min(screenUV.y,1.0-screenUV.y));
  float edge=uEdgeFade>0.0?smoothstep(0.0,uEdgeFade,edgeDistance):1.0;
  float rasterScale=min(uCanvasScale.x,uCanvasScale.y);
  float localSize=1.0; // Wallet-driven uPixelJitter owns size variation.
  float markSize=uDotSize*localSize*jitterScale*backgroundScale*sqrt(uPixelPresence);
  float dotSize=max(1.,floor(markSize*edge*rasterScale+.5));
  vec2 point=rasterPoint;
  vec2 start=floor(centrePhysical-dotSize*.5+.5);
  float square = step(start.x,point.x)*step(start.y,point.y)
    *(1.0-step(start.x+dotSize,point.x))*(1.0-step(start.y+dotSize,point.y))*step(.015,edge);
  float perimeterHash=hash11(pixelId.x*127.1+pixelId.y*311.7+19.7);
  float survival=step(hash11(pixelId.x*73.17+pixelId.y*193.41+7.3),uPixelPresence)*step(.0001,uPixelPresence);
  float M = coverage * square * step(perimeterHash,edge*edge)*survival;

  if(M<.5)discard;
  fragColor=vec4(uColor,1.);

}
`;

const unit = n => Math.max(0, Math.min(1, Number(n) || 0));
function hash(key,seed){
 let value=seed>>>0;for(const ch of String(key).slice(0,160))value=Math.imul(value^ch.charCodeAt(0),16777619)>>>0;
 return value;
}
export function createPixelBlastField(host,{generations=true}={}){
 const canvas=document.createElement('canvas');canvas.className='pixel-blast-layer';canvas.setAttribute('aria-hidden','true');host.append(canvas);
 let gl,software=null,identityMask=null,identityTexture=null,probeFramebuffer=null,probeTexture=null;
 const probePixels=new Uint8Array(32*32*4),emptyHolderGroups=new Float32Array(32);
 const useSoftware=matchMedia('(max-width:760px), (pointer:coarse)').matches;
 function fallback(){if(!software){software=createPixelBlastCanvas(host);software.setImage(identityMask);}canvas.hidden=true;host.dataset.pixelBlast='canvas';}
 try{gl=useSoftware?null:canvas.getContext('webgl2',{alpha:true,antialias:false,powerPreference:'low-power',premultipliedAlpha:false});}catch{gl=null;}
 let program=null,locations={},closed=false,lost=false,seed=0,ripples=[],lastPulse=-Infinity,lastParameters=null;
 function release(){if(probeFramebuffer)gl?.deleteFramebuffer(probeFramebuffer);if(probeTexture)gl?.deleteTexture(probeTexture);probeFramebuffer=null;probeTexture=null;if(program)gl?.deleteProgram(program);if(identityTexture)gl?.deleteTexture(identityTexture);program=null;identityTexture=null;}
 function uploadImage(){
  if(!gl||lost||!program)return;
  identityTexture??=gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,identityTexture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,identityMask?.width||1,identityMask?.height||1,0,gl.RED,gl.UNSIGNED_BYTE,identityMask?.data||new Uint8Array(1));
 }
 function initialize(){
  if(!gl)return;
  const shaders=[];let candidate;
  try{
   for(const [kind,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
    const shader=gl.createShader(kind);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
   }
   candidate=gl.createProgram();for(const shader of shaders)gl.attachShader(candidate,shader);gl.linkProgram(candidate);
   if(!gl.getProgramParameter(candidate,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(candidate));
   program=candidate;
   const names=['uColor','uResolution','uCanvasScale','uTime','uEventTime','uSeed','uDotSize','uEdgeFade','uDotStrength','uPixelSize','uNoiseCellSize','uScale','uDensity','uIdentityImage','uIdentity','uIdentityMotion','uPixelJitter','uEnableRipples','uRippleSpeed','uRippleThickness','uRippleIntensity','uLiquid','uLiquidStrength','uLiquidRadius','uLiquidTime','uNoiseAmount','uEcosystem','uClickPos[0]','uClickTimes[0]','uClickStrengths[0]','uClickDirections[0]'];
   locations=Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]));
   locations.holderGroups=gl.getUniformLocation(program,'uHolderGroups[0]');
   locations.uGridStart=gl.getUniformLocation(program,'uGridStart');
   locations.uGridColumns=gl.getUniformLocation(program,'uGridColumns');
   locations.uPixelPresence=gl.getUniformLocation(program,'uPixelPresence');
   locations.uBattleA=gl.getUniformLocation(program,'uBattleA');
   locations.uBattleB=gl.getUniformLocation(program,'uBattleB');
   locations.uCapitalStage=gl.getUniformLocation(program,'uCapitalStage');
   uploadImage();
   canvas.hidden=false;host.dataset.pixelBlast='ready';if(software)software.canvas.hidden=true;
  }catch(error){if(candidate)gl.deleteProgram(candidate);program=null;fallback();console.warn('Pixel field unavailable:',error.message);}
  finally{for(const shader of shaders)gl.deleteShader(shader);}
 }
 function contextLost(event){event.preventDefault();lost=true;program=null;identityTexture=null;fallback();}
 function contextRestored(){if(closed)return;lost=false;initialize();}
 canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
 initialize();if(!gl)fallback();
 const renderer={
  coverage(){
   if(lost||!program)return software?.coverage()??0;
   if(!probeFramebuffer){
    probeFramebuffer=gl.createFramebuffer();probeTexture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,probeTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,32,32,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,probeFramebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,probeTexture,0);
   }
   gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,probeFramebuffer);
   gl.blitFramebuffer(0,0,canvas.width,canvas.height,0,0,32,32,gl.COLOR_BUFFER_BIT,gl.LINEAR);
   gl.bindFramebuffer(gl.READ_FRAMEBUFFER,probeFramebuffer);gl.readPixels(0,0,32,32,gl.RGBA,gl.UNSIGNED_BYTE,probePixels);
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);let coverage=0;for(let i=3;i<probePixels.length;i+=4)coverage+=probePixels[i]/255;return coverage/1024;
  },
  setImage(image){if(closed)return;identityMask=preparePixelIdentity(image);software?.setImage(identityMask);uploadImage();},
  reset(nextSeed=seed){seed=Number(nextSeed)>>>0;ripples=[];lastPulse=-Infinity;lastParameters=null;},
  snapshot(){return lastParameters?{...lastParameters}:null;},
  pulse({key,time,strength=.5,balance=.5,direction=0}={}){
   if(!Number.isFinite(time)||time-lastPulse<.15||ripples.some(p=>p.key===key))return;
   const h=hash(key,seed),x=.04+.92*((h&65535)/65535),y=.04+.92*((h>>>16)/65535);
   let dx=Math.max(-1,Math.min(1,Number(direction)||0)),dy=(unit(balance)-.5)*.6;
   const length=Math.hypot(dx,dy);if(length>.000001){dx/=length;dy/=length;}else{dx=1;dy=0;}
   ripples.push({key,time,strength:unit(strength),x,y,dx,dy});ripples=ripples.slice(-6);lastPulse=time;
  },
  render({width,height,time,liquidTime,eventTime,parameters,preserve=false,...inputs}={}){
   if(closed)return;
   const {active,mobile,dither}=inputs;
   const scale=Math.min(Math.max(1,devicePixelRatio||1),2,Math.sqrt(1200000/Math.max(1,width*height)));
   const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));
   if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
   if(!active)ripples=[];
   ripples=ripples.filter(p=>eventTime>=p.time&&eventTime-p.time<3);
   const params=parameters||pixelBlastParameters({...inputs,mobile:mobile||useSoftware});lastParameters={...params};
   if(lost||!program){fallback();software.render({width,height,time,liquidTime,eventTime,seed,params,dither,ripples:params.frozen?[]:ripples,preserve});return;}
   // Integer cell boundaries keep a square's complete width and height even
   // on odd viewport dimensions or fractional device pixel ratios.
   const grid=Math.max(2,Math.round(params.cellSize*scale)),rasterScale=grid/params.cellSize;
   const positions=new Float32Array(12).fill(-1),times=new Float32Array(6),strengths=new Float32Array(6),directions=new Float32Array(12);
   (params.frozen?[]:ripples).forEach((p,i)=>{positions[i*2]=p.x*w/rasterScale;positions[i*2+1]=p.y*h/rasterScale;times[i]=p.time;strengths[i]=p.strength;directions[i*2]=p.dx;directions[i*2+1]=p.dy;});
   gl.viewport(0,0,w,h);gl.useProgram(program);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,identityTexture);
   const f=(name,value)=>gl.uniform1f(locations[name],value),i=(name,value)=>gl.uniform1i(locations[name],value);
   gl.uniform4fv(locations.holderGroups,params.holderGroups||emptyHolderGroups);
   f('uCapitalStage',params.patternStage??params.capitalStage??-1);f('uPixelPresence',params.pixelPresence??1);
   const battle=battleMotion(seed,time||0,params.capitalStage);
   gl.uniform4fv(locations.uBattleA,battle[0]);gl.uniform4fv(locations.uBattleB,battle[1]);
   const ink=params.inkColor??1;gl.uniform3f(locations.uColor,ink,ink,ink);gl.uniform2f(locations.uResolution,w,h);gl.uniform2f(locations.uCanvasScale,rasterScale,rasterScale);
   f('uTime',Number(time)||0);f('uEventTime',Number(eventTime)||0);f('uSeed',(seed%65521)/65521*173.6);f('uDotSize',params.dotSize);f('uDotStrength',params.dotStrength);f('uEdgeFade',params.edgeFade);
   f('uPixelSize',params.cellSize);f('uNoiseCellSize',16);f('uScale',params.scale);f('uDensity',params.density);f('uPixelJitter',params.jitter);
   i('uIdentityImage',0);f('uIdentity',identityMask?params.identity:0);f('uIdentityMotion',params.identityMotion);
   i('uEnableRipples',params.ripples?1:0);f('uRippleSpeed',params.rippleSpeed);f('uRippleThickness',params.rippleThickness);f('uRippleIntensity',params.rippleIntensity);
   i('uLiquid',params.liquid?1:0);f('uLiquidStrength',params.liquidStrength);f('uLiquidRadius',params.liquidRadius);f('uLiquidTime',Number.isFinite(liquidTime)?liquidTime:(Number(time)||0)*params.liquidWobbleSpeed);f('uNoiseAmount',params.noiseAmount);f('uEcosystem',params.ecosystem);
   gl.uniform2fv(locations['uClickPos[0]'],positions);gl.uniform1fv(locations['uClickTimes[0]'],times);gl.uniform1fv(locations['uClickStrengths[0]'],strengths);gl.uniform2fv(locations['uClickDirections[0]'],directions);
   const pad=Math.ceil(params.dotSize*1.5/params.cellSize)+1;
   const firstX=Math.floor(-Math.floor(w/2)/grid)-pad,firstY=Math.floor(-Math.floor(h/2)/grid)-pad;
   const columns=Math.ceil(w/grid)+pad*2+2,rows=Math.ceil(h/grid)+pad*2+2;
   gl.uniform2i(locations.uGridStart,firstX,firstY);gl.uniform1i(locations.uGridColumns,columns);
   gl.disable(gl.BLEND);gl.disable(gl.STENCIL_TEST);
   if(!preserve){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}
   gl.drawArraysInstanced(gl.TRIANGLES,0,6,columns*rows);
   canvas.dataset.density=params.density.toFixed(3);canvas.dataset.level=unit(inputs.level).toFixed(3);canvas.dataset.ripples=String(params.ripples?ripples.length:0);
   Object.assign(canvas.dataset,{basePixelSize:params.pixelSize.toFixed(3),pixelSize:params.pixelSize.toFixed(3),cellSize:params.cellSize.toFixed(3),dotSize:params.dotSize.toFixed(3),dotStrength:params.dotStrength.toFixed(3),patternScale:params.scale.toFixed(3),speed:params.speed.toFixed(3),edgeFade:String(params.edgeFade),rippleEnabled:String(params.ripples),identity:(identityMask?params.identity:0).toFixed(3),identityImage:String(!!identityMask)});
   Object.assign(canvas.dataset,{jitter:params.jitter.toFixed(3),liquid:String(params.liquid),liquidStrength:params.liquidStrength.toFixed(3),liquidRadius:params.liquidRadius.toFixed(3),liquidWobbleSpeed:params.liquidWobbleSpeed.toFixed(3),noiseAmount:params.noiseAmount.toFixed(3),ecosystem:params.ecosystem.toFixed(3),rippleSpeed:params.rippleSpeed.toFixed(3),rippleThickness:params.rippleThickness.toFixed(3),rippleIntensity:params.rippleIntensity.toFixed(3)});
  },
  clear(){software?.clear();if(gl&&!lost){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}ripples=[];},
  close(){closed=true;software?.close();release();identityMask=null;canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);canvas.remove();},
 };
 return generations?withPixelGenerations(renderer,pixelBlastParameters):renderer;
}
