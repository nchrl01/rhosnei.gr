import {createPixelBlastCanvas,preparePixelIdentity} from './pixel-blast-canvas.js?v=128';
// PixelBlast shader adapted from React Bits / David Haz (2026).
// Full license: vendor/ui/REACT-BITS-LICENSE.md. Market/audio adapter by $UPIC.
// One shared frame clock; no autonomous animation or pointer-triggered effects.
const vertex = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
const fragment = `#version 300 es

precision highp float;

uniform vec3  uColor;
uniform vec2  uResolution;
uniform vec2  uCanvasScale;
uniform float uTime;
uniform float uEventTime;
uniform float uSeed;
uniform float uDotSize;
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

const int   MAX_CLICKS = 6;

uniform vec2  uClickPos  [MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];
uniform float uClickStrengths[MAX_CLICKS];

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

void main(){
  float pixelSize = uPixelSize;
  vec2 viewSize=uResolution/uCanvasScale;
  vec2 origin=floor(uResolution*.5);
  vec2 rasterPoint=floor(gl_FragCoord.xy);
  vec2 fragCoord = (rasterPoint-origin)/uCanvasScale;
  float aspectRatio = viewSize.x / viewSize.y;

  vec2 pixelId = floor(fragCoord / pixelSize);
  float cellPixelSize = uNoiseCellSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / viewSize * vec2(aspectRatio, 1.0);

  float base = fbm2(uv, uTime * 0.05);
  base = base * 0.5 - 0.65;

  float feed = base + (uDensity - 0.5) * 0.3;

  float speed     = uRippleSpeed;
  float thickness = uRippleThickness;
  const float dampT     = 1.0;
  const float dampR     = 10.0;

  if (uEnableRipples == 1) {
    for (int i = 0; i < MAX_CLICKS; ++i){
      vec2 pos = uClickPos[i];
      if (pos.x < 0.0) continue;
      float cellPixelSize = uNoiseCellSize;
      vec2 cuv = (((pos - origin/uCanvasScale - cellPixelSize * .5) / viewSize)) * vec2(aspectRatio, 1.0);
      float t = max(uEventTime - uClickTimes[i], 0.0);
      float r = distance(uv, cuv);
      float waveR = speed * t;
      float ring  = exp(-pow((r - waveR) / thickness, 2.0));
      float atten = exp(-dampT * t) * exp(-dampR * r);
      feed = max(feed, ring * atten * uRippleIntensity * uClickStrengths[i]);
    }
  }

  // The coin is a target for the same dot field, not a pasted image layer.
  // Its coordinates flow only with the existing market/audio clock. The
  // low-cap field is scattered; a high-cap field settles into recognizable ink.
  float imageInk=0.0;
  if(uIdentity>0.0){
    imageInk=identityInk((pixelId+.5)*pixelSize);
    float imageFeed=mix(feed-.25,.68+.16*min(3.0,uDensity)+.13*feed,imageInk);
    feed=mix(feed,imageFeed,uIdentity);
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);

  float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
  float coverage = bw;
  // The reference edge envelope shrinks individual squares. Their alpha
  // remains binary, including when quiet activity makes them smaller.
  float backgroundScale=mix(1.0,.7+.3*imageInk,uIdentity);
  vec2 centrePhysical=origin+(pixelId+.5)*pixelSize*uCanvasScale;
  vec2 screenUV=centrePhysical/uResolution;
  float edgeDistance=min(min(screenUV.x,1.0-screenUV.x),min(screenUV.y,1.0-screenUV.y));
  float edge=uEdgeFade>0.0?smoothstep(0.0,uEdgeFade,edgeDistance):1.0;
  float dotSize = max(1.0,floor(min(pixelSize,uDotSize*jitterScale*backgroundScale)*edge*min(uCanvasScale.x,uCanvasScale.y)+.5));
  vec2 point=rasterPoint;
  vec2 start=floor(centrePhysical-dotSize*.5+.5);
  float square = step(start.x,point.x)*step(start.y,point.y)
    *(1.0-step(start.x+dotSize,point.x))*(1.0-step(start.y+dotSize,point.y))*step(.015,edge);
  float M = coverage * square;

  vec3 color = uColor;

  // sRGB gamma correction - convert linear to sRGB for accurate color output
  vec3 srgbColor = mix(
    color * 12.92,
    1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, color)
  );

  float inkStrength=mix(1.0,.45+.55*imageInk,uIdentity);
  fragColor = vec4(srgbColor * uDotStrength * inkStrength, clamp(M, 0.0, 1.0));
}
`;

const unit = n => Math.max(0, Math.min(1, Number(n) || 0));
// User's React Bits reference. CSS pixels, not pixels of a stretched buffer.
export const PIXEL_BLAST_REFERENCE=Object.freeze({pixelSize:2,patternScale:.25,speed:1.35,edgeFade:.5,patternDensity:1.65});
// Cell centres and noise scale stay fixed. Market cap and sound grow the
// squares inside those cells; liquidity controls coverage, never scene zoom.
export function pixelBlastParameters({level=0,formation=0,drive=0,pressure=0,activity=0,volume=0,motion=0,fresh=0,capital=.5,depth=.5,surge=0,imbalance=0,identity=0,active=false,reducedMotion=false,mobile=false,piano=0,transient=0}={}){
 const reference=PIXEL_BLAST_REFERENCE;
 const sound=unit(level),presence=unit(formation),current=active?unit(fresh):0;
 const attack=active&&!reducedMotion?unit(transient):0,notes=active?unit(piano):0;
 const movement=unit(.55*unit(drive)+.3*unit(motion)+.15*unit(pressure))*current;
 const flow=unit(.45*unit(activity)+.35*unit(volume)+.2*unit(surge))*current;
 const engagement=active?unit(Math.max(presence,sound,notes)):0;
 const strength=unit(.3*flow+.3*presence+.25*sound+.15*attack);
 const dotSize=reference.pixelSize*(.25+1.05*strength)*(.7+.6*unit(capital))*(1+.32*notes+.18*attack);
 return {
  pixelSize:reference.pixelSize,
  cellSize:4,
  dotSize:Math.min(3.8,dotSize),
  scale:reference.patternScale,
  density:Math.max(.65,Math.min(2.6,reference.patternDensity+1.2*(unit(depth)-.5)+.18*flow+.12*notes)),
  // Leave part of the procedural field visible even for a mature coin.
  identity:.78*unit(identity),
  identityMotion:reducedMotion?0:unit(.7*movement+.3*flow),
  speed:reducedMotion||engagement<.002?0:reference.speed*(.55+.85*unit(.6*movement+.25*flow+.15*sound))*Math.sqrt(engagement),
  edgeFade:reference.edgeFade,
  jitter:reducedMotion?0:.025+.12*movement,
  dotStrength:(mobile?.28:.2)+(mobile?.72:.8)*strength,
  rippleIntensity:.35+1.1*unit(.65*unit(surge)+.35*unit(imbalance)),
  rippleSpeed:.12+.45*movement,
  rippleThickness:.02+.055*flow,
  // Quiet/ordinary updates remain like the reference's ripple-off state.
  ripples:active&&!reducedMotion&&engagement>.08&&current>.05&&(movement>.3||unit(surge)>.45),
 };
}
function hash(key,seed){
 let value=seed>>>0;for(const ch of String(key).slice(0,160))value=Math.imul(value^ch.charCodeAt(0),16777619)>>>0;
 return value;
}
export function createPixelBlastField(host){
 const canvas=document.createElement('canvas');canvas.className='pixel-blast-layer';canvas.setAttribute('aria-hidden','true');host.append(canvas);
 let gl,software=null,identityMask=null,identityTexture=null;
 const useSoftware=matchMedia('(max-width:760px), (pointer:coarse)').matches;
 function fallback(){if(!software){software=createPixelBlastCanvas(host);software.setImage(identityMask);}canvas.hidden=true;host.dataset.pixelBlast='canvas';}
 try{gl=useSoftware?null:canvas.getContext('webgl2',{alpha:true,antialias:false,powerPreference:'low-power',premultipliedAlpha:false});}catch{gl=null;}
 let program=null,locations={},closed=false,lost=false,seed=0,ripples=[],lastPulse=-Infinity;
 function release(){if(program)gl?.deleteProgram(program);if(identityTexture)gl?.deleteTexture(identityTexture);program=null;identityTexture=null;}
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
   const names=['uColor','uResolution','uCanvasScale','uTime','uEventTime','uSeed','uDotSize','uEdgeFade','uDotStrength','uPixelSize','uNoiseCellSize','uScale','uDensity','uIdentityImage','uIdentity','uIdentityMotion','uPixelJitter','uEnableRipples','uRippleSpeed','uRippleThickness','uRippleIntensity','uClickPos[0]','uClickTimes[0]','uClickStrengths[0]'];
   locations=Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]));
   uploadImage();
   canvas.hidden=false;host.dataset.pixelBlast='ready';if(software)software.canvas.hidden=true;
  }catch(error){if(candidate)gl.deleteProgram(candidate);program=null;fallback();console.warn('Pixel field unavailable:',error.message);}
  finally{for(const shader of shaders)gl.deleteShader(shader);}
 }
 function contextLost(event){event.preventDefault();lost=true;program=null;identityTexture=null;fallback();}
 function contextRestored(){if(closed)return;lost=false;initialize();}
 canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
 initialize();if(!gl)fallback();
 return {
  setImage(image){if(closed)return;identityMask=preparePixelIdentity(image);software?.setImage(identityMask);uploadImage();},
  reset(nextSeed=seed){seed=Number(nextSeed)>>>0;ripples=[];lastPulse=-Infinity;},
  pulse({key,time,strength=.5,balance=.5}={}){
   if(!Number.isFinite(time)||time-lastPulse<.15||ripples.some(p=>p.key===key))return;
   const h=hash(key,seed),x=.15+.7*((h&65535)/65535),y=.15+.7*((h>>>16)/65535);
   ripples.push({key,time,strength:unit(strength),x:unit(.75*x+.25*unit(balance)),y});ripples=ripples.slice(-6);lastPulse=time;
  },
  render({width,height,time,eventTime,level,formation,piano=0,transient=0,active,mobile,reducedMotion,drive,pressure,activity,volume,motion,fresh,capital,depth,surge,imbalance,identity=0,dither}={}){
   if(closed)return;
   const scale=Math.min(Math.max(1,devicePixelRatio||1),2,Math.sqrt(1200000/Math.max(1,width*height)));
   const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));
   if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
   if(!active)ripples=[];
   ripples=ripples.filter(p=>eventTime>=p.time&&eventTime-p.time<3);
   const params=pixelBlastParameters({level,formation,drive,pressure,activity,volume,motion,fresh,capital,depth,surge,imbalance,identity,active,reducedMotion,mobile:mobile||useSoftware,piano,transient});
   if(lost||!program){fallback();software.render({width,height,time,eventTime,seed,params,dither,ripples});return;}
   // Integer cell boundaries keep a square's complete width and height even
   // on odd viewport dimensions or fractional device pixel ratios.
   const grid=Math.max(2,Math.round(params.cellSize*scale)),rasterScale=grid/params.cellSize;
   const positions=new Float32Array(12).fill(-1),times=new Float32Array(6),strengths=new Float32Array(6);
   ripples.forEach((p,i)=>{positions[i*2]=p.x*w/rasterScale;positions[i*2+1]=p.y*h/rasterScale;times[i]=p.time;strengths[i]=p.strength;});
   gl.viewport(0,0,w,h);gl.useProgram(program);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,identityTexture);
   const f=(name,value)=>gl.uniform1f(locations[name],value),i=(name,value)=>gl.uniform1i(locations[name],value);
   gl.uniform3f(locations.uColor,1,1,1);gl.uniform2f(locations.uResolution,w,h);gl.uniform2f(locations.uCanvasScale,rasterScale,rasterScale);
   f('uTime',Number(time)||0);f('uEventTime',Number(eventTime)||0);f('uSeed',(seed%65521)/65521*173.6);f('uDotSize',params.dotSize);f('uDotStrength',params.dotStrength);f('uEdgeFade',params.edgeFade);
   f('uPixelSize',params.cellSize);f('uNoiseCellSize',8*params.pixelSize);f('uScale',params.scale);f('uDensity',params.density);f('uPixelJitter',params.jitter);
   i('uIdentityImage',0);f('uIdentity',identityMask?params.identity:0);f('uIdentityMotion',params.identityMotion);
   i('uEnableRipples',params.ripples?1:0);f('uRippleSpeed',params.rippleSpeed);f('uRippleThickness',params.rippleThickness);f('uRippleIntensity',params.rippleIntensity);
   gl.uniform2fv(locations['uClickPos[0]'],positions);gl.uniform1fv(locations['uClickTimes[0]'],times);gl.uniform1fv(locations['uClickStrengths[0]'],strengths);
   gl.drawArrays(gl.TRIANGLES,0,3);
   canvas.dataset.density=params.density.toFixed(3);canvas.dataset.level=unit(level).toFixed(3);canvas.dataset.ripples=String(params.ripples?ripples.length:0);
   Object.assign(canvas.dataset,{basePixelSize:params.pixelSize.toFixed(3),pixelSize:params.pixelSize.toFixed(3),cellSize:params.cellSize.toFixed(3),dotSize:params.dotSize.toFixed(3),dotStrength:params.dotStrength.toFixed(3),patternScale:params.scale.toFixed(3),speed:params.speed.toFixed(3),edgeFade:String(params.edgeFade),rippleEnabled:String(params.ripples),identity:(identityMask?params.identity:0).toFixed(3),identityImage:String(!!identityMask)});
  },
  clear(){software?.clear();if(gl&&!lost){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}ripples=[];},
  close(){closed=true;software?.close();release();identityMask=null;canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);canvas.remove();},
 };
}
