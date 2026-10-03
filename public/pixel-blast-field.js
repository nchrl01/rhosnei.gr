import {createPixelBlastCanvas} from './pixel-blast-canvas.js?v=102';
// PixelBlast shader adapted from React Bits / David Haz (2026).
// Full license: vendor/ui/REACT-BITS-LICENSE.md. Market/audio adapter by $UPIC.
// One shared frame clock; no autonomous animation or pointer-triggered effects.
const vertex = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
const fragment = `#version 300 es

precision highp float;

uniform vec3  uColor;
uniform vec2  uResolution;
uniform float uTime;
uniform float uEventTime;
uniform float uSeed;
uniform float uOpacity;
uniform float uPixelSize;
uniform float uScale;
uniform float uDensity;
uniform float uPixelJitter;
uniform int   uEnableRipples;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;
uniform float uEdgeFade;

uniform int   uShapeType;
const int SHAPE_SQUARE   = 0;
const int SHAPE_CIRCLE   = 1;
const int SHAPE_TRIANGLE = 2;
const int SHAPE_DIAMOND  = 3;

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

float maskCircle(vec2 p, float cov){
  float r = sqrt(cov) * .25;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}

float maskTriangle(vec2 p, vec2 id, float cov){
  bool flip = mod(id.x + id.y, 2.0) > 0.5;
  if (flip) p.x = 1.0 - p.x;
  float r = sqrt(cov);
  float d  = p.y - r*(1.0 - p.x);
  float aa = fwidth(d);
  return cov * clamp(0.5 - d/aa, 0.0, 1.0);
}

float maskDiamond(vec2 p, float cov){
  float r = sqrt(cov) * 0.564;
  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main(){
  float pixelSize = uPixelSize;
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  float aspectRatio = uResolution.x / uResolution.y;

  vec2 pixelId = floor(fragCoord / pixelSize);
  vec2 pixelUV = fract(fragCoord / pixelSize);

  float cellPixelSize = 8.0 * pixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

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
      float cellPixelSize = 8.0 * pixelSize;
      vec2 cuv = (((pos - uResolution * .5 - cellPixelSize * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
      float t = max(uEventTime - uClickTimes[i], 0.0);
      float r = distance(uv, cuv);
      float waveR = speed * t;
      float ring  = exp(-pow((r - waveR) / thickness, 2.0));
      float atten = exp(-dampT * t) * exp(-dampR * r);
      feed = max(feed, ring * atten * uRippleIntensity * uClickStrengths[i]);
    }
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);

  float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
  float coverage = bw * jitterScale;
  float M;
  if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle (pixelUV, coverage);
  else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
  else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
  else                                   M = coverage;

  if (uEdgeFade > 0.0) {
    vec2 norm = gl_FragCoord.xy / uResolution;
    float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
    float fade = smoothstep(0.0, uEdgeFade, edge);
    M *= fade;
  }

  vec3 color = uColor;

  // sRGB gamma correction - convert linear to sRGB for accurate color output
  vec3 srgbColor = mix(
    color * 12.92,
    1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, color)
  );

  fragColor = vec4(srgbColor, clamp(M * uOpacity, 0.0, 1.0));
}
`;

const unit = n => Math.max(0, Math.min(1, Number(n) || 0));
// The supplied studio preset (2px / 7.75 scale / .6 density / .75 speed /
// .15 edge fade) is the centre of bounded, market-controlled ranges.
export function pixelBlastParameters({level=0,formation=0,drive=0,pressure=0,activity=0,volume=0,motion=0,fresh=0,capital=.5,depth=.5,surge=0,imbalance=0,active=false,reducedMotion=false}={}){
 const sound=unit(level),presence=unit(formation),current=active?unit(fresh):0;
 const movement=unit(.55*unit(drive)+.3*unit(motion)+.15*unit(pressure))*current;
 const flow=unit(.45*unit(activity)+.35*unit(volume)+.2*unit(surge))*current;
 return {
  pixelSize:1.25+2.75*movement,
  scale:4+7.5*unit(capital),
  density:.25+1.35*flow,
  speed:reducedMotion?0:.025+1.45*unit(.65*movement+.35*flow),
  edgeFade:.03+.24*(1-unit(depth)),
  jitter:.03+.35*movement,
  opacity:.14+.6*unit(.6*flow+.25*presence+.15*sound),
  rippleIntensity:.35+1.1*unit(.65*unit(surge)+.35*unit(imbalance)),
  rippleSpeed:.12+.45*movement,
  rippleThickness:.02+.055*flow,
  // Quiet/ordinary updates remain like the reference's ripple-off state.
  ripples:active&&!reducedMotion&&current>.05&&(movement>.3||unit(surge)>.45),
 };
}
function hash(key,seed){
 let value=seed>>>0;for(const ch of String(key).slice(0,160))value=Math.imul(value^ch.charCodeAt(0),16777619)>>>0;
 return value;
}
export function createPixelBlastField(host){
 const canvas=document.createElement('canvas');canvas.className='pixel-blast-layer';canvas.setAttribute('aria-hidden','true');host.append(canvas);
 let gl,software=null;
 const useSoftware=matchMedia('(max-width:760px), (pointer:coarse)').matches;
 function fallback(){software??=createPixelBlastCanvas(host);canvas.hidden=true;host.dataset.pixelBlast='canvas';}
 try{gl=useSoftware?null:canvas.getContext('webgl2',{alpha:true,antialias:false,powerPreference:'low-power',premultipliedAlpha:false});}catch{gl=null;}
 let program=null,locations={},closed=false,lost=false,seed=0,ripples=[],lastPulse=-Infinity;
 function release(){if(program)gl?.deleteProgram(program);program=null;}
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
   const names=['uColor','uResolution','uTime','uEventTime','uSeed','uOpacity','uPixelSize','uScale','uDensity','uPixelJitter','uEnableRipples','uRippleSpeed','uRippleThickness','uRippleIntensity','uEdgeFade','uShapeType','uClickPos[0]','uClickTimes[0]','uClickStrengths[0]'];
   locations=Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]));
   canvas.hidden=false;host.dataset.pixelBlast='ready';if(software)software.canvas.hidden=true;
  }catch(error){if(candidate)gl.deleteProgram(candidate);program=null;fallback();console.warn('Pixel field unavailable:',error.message);}
  finally{for(const shader of shaders)gl.deleteShader(shader);}
 }
 function contextLost(event){event.preventDefault();lost=true;program=null;fallback();}
 function contextRestored(){if(closed)return;lost=false;initialize();}
 canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
 initialize();if(!gl)fallback();
 return {
  reset(nextSeed=seed){seed=Number(nextSeed)>>>0;ripples=[];lastPulse=-Infinity;},
  pulse({key,time,strength=.5,balance=.5}={}){
   if(!Number.isFinite(time)||time-lastPulse<.15||ripples.some(p=>p.key===key))return;
   const h=hash(key,seed),x=.15+.7*((h&65535)/65535),y=.15+.7*((h>>>16)/65535);
   ripples.push({key,time,strength:unit(strength),x:unit(.75*x+.25*unit(balance)),y});ripples=ripples.slice(-6);lastPulse=time;
  },
  render({width,height,time,eventTime,level,formation,birth=1,active,mobile,reducedMotion,drive,pressure,activity,volume,motion,fresh,capital,depth,surge,imbalance,dither}={}){
   if(closed)return;
   const limit=mobile?384:640,scale=Math.min(1,limit/Math.max(width,height));
   const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
   if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
   if(!active)ripples=[];
   ripples=ripples.filter(p=>eventTime>=p.time&&eventTime-p.time<3);
   const params=pixelBlastParameters({level,formation,drive,pressure,activity,volume,motion,fresh,capital,depth,surge,imbalance,active,reducedMotion});
   if(lost||!program){fallback();software.render({width,height,time,eventTime,seed,params,birth:unit(birth),dither,ripples});return;}
   const positions=new Float32Array(12).fill(-1),times=new Float32Array(6),strengths=new Float32Array(6);
   ripples.forEach((p,i)=>{positions[i*2]=p.x*w;positions[i*2+1]=p.y*h;times[i]=p.time;strengths[i]=p.strength;});
   gl.viewport(0,0,w,h);gl.useProgram(program);
   const f=(name,value)=>gl.uniform1f(locations[name],value),i=(name,value)=>gl.uniform1i(locations[name],value);
   gl.uniform3f(locations.uColor,1,1,1);gl.uniform2f(locations.uResolution,w,h);
   f('uTime',Number(time)||0);f('uEventTime',Number(eventTime)||0);f('uSeed',(seed%65521)/65521*173.6);f('uOpacity',params.opacity*unit(birth));
   f('uPixelSize',params.pixelSize);f('uScale',params.scale);f('uDensity',params.density);f('uPixelJitter',params.jitter);
   i('uEnableRipples',params.ripples?1:0);f('uRippleSpeed',params.rippleSpeed);f('uRippleThickness',params.rippleThickness);f('uRippleIntensity',params.rippleIntensity);f('uEdgeFade',params.edgeFade);i('uShapeType',dither?0:1);
   gl.uniform2fv(locations['uClickPos[0]'],positions);gl.uniform1fv(locations['uClickTimes[0]'],times);gl.uniform1fv(locations['uClickStrengths[0]'],strengths);
   gl.drawArrays(gl.TRIANGLES,0,3);
   canvas.dataset.density=params.density.toFixed(3);canvas.dataset.level=unit(level).toFixed(3);canvas.dataset.ripples=String(params.ripples?ripples.length:0);
   Object.assign(canvas.dataset,{pixelSize:params.pixelSize.toFixed(3),patternScale:params.scale.toFixed(3),speed:params.speed.toFixed(3),edgeFade:params.edgeFade.toFixed(3),rippleEnabled:String(params.ripples)});
  },
  clear(){software?.clear();if(gl&&!lost){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}ripples=[];},
  close(){closed=true;software?.close();release();canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);canvas.remove();},
 };
}
