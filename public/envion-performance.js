import {envionFrame} from './envion-market.js?v=229';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const named=(file)=>file.split('/').pop().replace(/\.[^.]+$/,'');
export function buildPerformanceCatalog(model,banks){
 const root=model.canvases[model.root],byIndex=new Map(root.nodes.map(n=>[n.index,n]));
 const presets=root.nodes.filter(n=>!n.retired&&n.kind==='obj'&&n.args[0]==='bng'&&(n.assets?.some(p=>p.startsWith('audio/'))||[552,557,561,674,684,703,707,729,872].includes(n.index))).map(n=>{
  const child=root.wires.filter(w=>w[0]===n.index).map(w=>byIndex.get(w[2])).find(n=>n?.child);
  return {index:n.index,name:child?.text.replace(/^pd /,'')||'Preset '+n.index,assets:n.assets||[]};
 });
 return {presets,samples:Object.keys(model.assets).filter(p=>p.startsWith('audio/')&&p.endsWith('.wav')),irs:Object.keys(model.assets).filter(p=>p.startsWith('asset/')&&p.endsWith('.wav')),banks};
}
// Decisions are held between musical boundaries. Equal market readings can
// produce different phrases; market intensity controls the probability and range.
export function createEnvionPerformance(catalog,seed=1917){
 let materialSeed=seed>>>0,state=seed>>>0,last=-1,turn=0,current=null,heldMaterial=null;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const pick=(items,previous,weight=()=>1)=>{
  const pool=items.filter(x=>items.length===1||x!==previous),weights=pool.map(x=>Math.max(.02,weight(x)));
  let value=random()*weights.reduce((a,b)=>a+b,0);return pool.find((_,i)=>(value-=weights[i])<=0)||pool.at(-1);
 };
 function next(metrics,tempo,step,force=false){
  const m=envionFrame(metrics,tempo),boundary=Math.floor(step/8);
  if(!force&&boundary===last)return null;last=boundary;turn++;
  const chance=p=>random()<clamp(p,0,1),signed=()=>random()*2-1;
  const intensity=clamp(.4*m.activity+.35*m.motion+.25*m.pressure,0,1);
  // File and convolution changes run on Pd's audio thread. Choose these once
  // for this seed; musical boundaries continue to vary the existing material.
  const changeMaterial=!heldMaterial;
  const material={...(heldMaterial||{})};
  if(changeMaterial){
   let materialState=materialSeed;
   const choose=items=>{materialState=(Math.imul(materialState,1664525)+1013904223)>>>0;return items[Math.floor(materialState/4294967296*items.length)];};
   const preset=choose(catalog.presets);
   material.preset=preset;
   material.sample=choose(catalog.samples);
   material.bank=choose(catalog.banks);
   material.tape=choose(catalog.samples.filter(p=>p.includes('___tape-audio/')));
   material.ir=choose(catalog.irs);
   heldMaterial=material;
  }
  const gates={filter:chance(.15+.75*m.motion),pan:Math.abs(m.direction-.5)>.05,echo:chance(.12+.75*m.volume),reverb:m.liquidity>0,grains:chance(.2+.7*m.activity),burst:chance(.1+.6*m.shock),autopan:false,grainMotion:chance(.2+.65*intensity),tape:chance(.15+.45*(1-intensity)),pingpong:chance(.2+.5*m.volume),distortion:chance(.1+.55*m.motion)};
  // Bounded numeric gestures; values follow the market and vary within its range.
  const values={
   26:80+900*(1-m.activity)*( .6+random()),35:10+110*(1-m.activity)*(.5+random()),72:.75+.5*m.direction,633:.3+9*(1-m.activity)*random(),
   350:100+4900*clamp(m.motion+signed()*.25,0,1),351:100+4900*clamp(m.motion+signed()*.25,0,1),
   353:+gates.filter,354:+gates.filter,355:+chance(.15+.7*m.pressure),356:+chance(.15+.7*m.pressure),
   369:.1+12*m.liquidity*(.3+.7*random()),371:clamp(1-m.liquidity+signed()*.15,0,1),373:m.liquidity*(.5+.5*random()),379:gates.reverb?.25*m.liquidity:0,390:+gates.reverb,391:+gates.reverb,
   433:+gates.pan,434:+gates.pan,435:+!gates.pan,436:+!gates.pan,444:+gates.echo,445:+gates.echo,
   448:clamp(60000/m.tempo*pick([.125,.25,.375,.5,.75,1]),1,1000),450:clamp(60000/m.tempo*pick([.125,.25,.375,.5,.75,1]),1,1000),452:15*m.liquidity*random(),454:gates.echo?m.volume*(.2+.45*random()):0,456:Math.floor(random()*3),457:12*m.motion*random(),461:65*m.volume*(.2+.8*random()),
   483:+gates.burst,484:+gates.grains,409:0,501:0,407:0,503:0,
   735:350+250*m.direction,737:20+380*(1-m.activity)*(.2+.8*random()),740:.9*random(),747:.9+.5*m.volume*random(),799:2000+5000*(1-m.activity)*random(),
   770:.1+1.9*random(),777:.1+1.9*random(),784:.1+1.9*random(),791:.1+1.9*random(),751:+gates.grains,826:+gates.grainMotion,867:+gates.grainMotion,
   822:.7*m.motion*random(),837:350+250*m.direction,846:1+9*m.activity*random(),857:.007*m.activity*random(),860:.007*m.activity*random(),
   876:+gates.tape,877:0,878:0,879:.015*m.volume*random(),880:3*m.motion*random(),881:+chance(.5),884:gates.tape?.5*Math.sqrt(m.activity):0,926:gates.grains?.7*Math.sqrt(m.activity):0,
  };
  const extra={'c53-18':+gates.pingpong,'c53-40':+gates.distortion,'c53-23':1000+14000*random(),'c53-25':100*(1-m.motion)*random(),'c53-28':60*random(),'c53-30':20+400*m.motion*random(),'c53-34':30*m.motion*random(),'c53-37':35*m.motion*random()};
  const effects=Object.entries(gates).filter(([,enabled])=>enabled).map(([name])=>name);
  const actions=[];
  if(gates.grains&&chance(.35+.5*m.motion))actions.push(pick([760,761,762,763,764,765,766]));
  if(chance(.05+.35*m.shock))actions.push(pick([471,472]));
  if(chance(.04+.1*(1-intensity)))actions.push(160);
  current={actions,turn,material,changeMaterial,values,extra,effects,row:Math.floor(random()*material.bank.rows),density:clamp(Math.round(1+(1-m.activity)*5+signed()*2),1,8),summary:material.preset.name+' · '+named(material.sample)+' · '+named(material.bank.path)+' · '+effects.join(' / ')};
  return current;
 }
 return {next,get current(){return current;},reset(value=seed,{preserveMaterial=false}={}){state=value>>>0;last=-1;turn=0;current=null;if(!preserveMaterial){heldMaterial=null;materialSeed=value>>>0;}}};
}

export const CHANCE_LABELS={
 'c0-409':'Pan rate','c0-501':'Autopan rate','c0-407':'Pan motion switch','c0-503':'Autopan switch',
 'c0-751':'Grain engine and entropy','c0-770':'Overlap modulation rate','c0-777':'Duration modulation rate','c0-784':'Start modulation rate','c0-791':'Pitch modulation rate','c0-826':'Grain modulation 1','c0-867':'Grain modulation 2',
 'c0-876':'Tape playback','c0-881':'Tape bypass','c53-18':'Echo ping-pong','c53-40':'Echo distortion mode',
 'c53-23':'Echo low-pass','c53-25':'Echo high-frequency damping','c53-28':'Echo low-frequency damping','c53-30':'Echo high-pass','c53-34':'Echo sideband amount','c53-37':'Echo sideband shift',
 'c0-471':'Excitation 1','c0-472':'Excitation 2','c0-160':'Original-speed gesture',
 ...Object.fromEntries([760,761,762,763,764,765,766].map((id,i)=>['c0-'+id,'Grain envelope '+(i+1)])),
};
