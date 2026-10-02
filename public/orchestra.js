const unit=value=>Math.max(0,Math.min(1,Number(value)||0));
export const orchestraTempo=m=>Math.round(80+70*unit(m.activity)+40*unit(m.volume)*unit(m.fresh)+30*unit(m.pressure)*unit(m.fresh));
export const ORCHESTRA_LAYERS=['melody','pad','tones','poly','filtered','percussion'];

// One market-driven ensemble. Roles change at musical phrase boundaries;
// every part shares a mix budget so adding layers cannot multiply gain blindly.
export function orchestraTargets(input,connected,phrase=0){
 const m=Object.fromEntries(['activity','volume','motion','texture','fresh','balance','pressure'].map(key=>[key,unit(input[key])]));
 const activity=m.activity*(connected?1:m.fresh);
 const budget=.9*Math.sqrt(activity*m.volume)*m.fresh;
 const roles=[
  [1.15,1.1,.9,.75,.75,.9],
  [.9,1.1,1.15,.9,.8,.9],
  [1,.8,.8,1.2,1.15,1.15],
  [1.05,1.15,1,.85,.7,.8],
 ][((Math.floor(phrase)%4)+4)%4];
 const weights=[
  .35+.8*m.motion,
  .25+.7*m.texture*(1-.5*m.motion)*(1-.8*m.pressure),
  .2+.6*m.texture*(1-.35*m.motion)*(1-.5*m.pressure),
  .12+.65*m.motion*m.activity,
  .08+.45*m.motion*m.volume,
  .2+.65*m.activity+.2*m.motion,
 ].map((value,index)=>value*roles[index]);
 const total=weights.reduce((a,b)=>a+b,0);
 const result=Object.fromEntries(ORCHESTRA_LAYERS.map((name,index)=>[name,budget*weights[index]/total]));
 result.space=.7*m.texture*m.fresh*(1-.7*m.pressure);
 return result;
}

export function orchestraParameters(input){
 const m=Object.fromEntries(['activity','volume','motion','texture','fresh','balance','pressure'].map(key=>[key,unit(input[key])]));
 return {
  swing:.5+.18*m.motion*(2*m.balance-1),
  density:.08+.85*m.activity,
  duration:230-155*m.volume,
  decay:34-24*m.texture,
  divider:16-12*m.motion,
  drive:2+22*m.motion,
  feedback:.12+.45*m.texture*(1-.6*m.pressure),
  'delay-left':128+128*m.texture,
  'delay-right':128+256*m.texture,
  'perc-density':(.08+1.3*m.activity+.3*m.volume)*m.fresh,
  'perc-decay':50+320*m.texture*(1-.7*m.pressure),
  'perc-color':.1+.85*m.motion,
  'perc-delay':250+500*m.texture,
  'perc-feedback':.08+.44*m.texture*(1-.6*m.pressure),
 };
}

export function createOrchestraConductor(){
 let generation=0,lastTime=null;
 const levels=Object.fromEntries([...ORCHESTRA_LAYERS,'space'].map(name=>[name,0]));
 return {
  observe(name,value){if(name==='generation'&&Number.isFinite(value))generation=Math.max(0,value);},
  update(m,connected,now=performance.now()){
   const phrase=Math.floor(generation/32),target=orchestraTargets(m,connected,phrase);
   // Time-based smoothing keeps a busy trade feed from speeding up mix changes.
   const elapsed=lastTime===null?150:Math.max(0,Math.min(1000,now-lastTime));lastTime=now;
   const alpha=1-Math.exp(-elapsed/650);
   for(const name of Object.keys(levels))levels[name]+=(target[name]-levels[name])*alpha;
   const intensity=unit(m.activity)*.4+unit(m.volume)*.35+unit(m.motion)*.25;
   const state=unit(m.fresh)<.1?'SIGNAL FADING':unit(m.pressure)>.65?(m.context?.direction>0?'RAPID EXPANSION':m.context?.direction<0?'RAPID SELLOFF':'HIGH PARTICIPATION'):intensity>.65?'TURBULENT':intensity>.35?'GATHERING':'SPARSE';
   return {levels:{...levels},parameters:orchestraParameters(m),phrase:phrase%4,state};
  },
  reset(){generation=0;lastTime=null;for(const name of Object.keys(levels))levels[name]=0;},
 };
}
