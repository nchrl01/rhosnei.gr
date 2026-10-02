// All creative controls are derived from the same live/replay market frame.
// DSP constants and listening/recording transport are deliberately separate.
const unit = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
export const ENVION_CONTROLS = [
  [26,'Envelope interval','activity','100 + 1900 × (1 − activity)',m=>100+1900*(1-m.activity)],
  [35,'Envelope stretch','motion','10 + 90 × (1 − motion)',m=>10+90*(1-m.motion)],
  [72,'Playback factor','direction','0.75 + 0.5 × direction',m=>.75+.5*m.direction],
  [633,'Time stretch','activity','1 + 7 × (1 − activity)',m=>1+7*(1-m.activity)],
  [350,'Filter left','motion','100 + 4900 × motion Hz',m=>100+4900*m.motion],
  [351,'Filter right','motion','100 + 4900 × motion Hz',m=>100+4900*m.motion],
  [353,'Filter route left','motion','motion > 0.3',m=>+(m.motion>.3)],
  [354,'Filter route right','motion','motion > 0.3',m=>+(m.motion>.3)],
  [355,'Filter mode left','pressure','pressure > 0.5',m=>+(m.pressure>.5)],
  [356,'Filter mode right','pressure','pressure > 0.5',m=>+(m.pressure>.5)],
  [369,'Reverb decay','liquidity','0.1 + 10 × liquidity',m=>.1+10*m.liquidity],
  [371,'Reverb damping','liquidity','1 − 0.8 × liquidity',m=>1-.8*m.liquidity],
  [373,'Reverb room size','liquidity','liquidity',m=>m.liquidity],
  [379,'Reverb mix','liquidity','0.25 × liquidity',m=>.25*m.liquidity],
  [390,'Reverb route left','liquidity','liquidity > 0',m=>+(m.liquidity>0)],
  [391,'Reverb route right','liquidity','liquidity > 0',m=>+(m.liquidity>0)],
  [408,'Stereo position','balance','2 × buy share',m=>2*m.balance],
  [433,'Pan route left','balance','imbalance > 0.1',m=>+(Math.abs(m.balance-.5)>.1)],
  [434,'Pan route right','balance','imbalance > 0.1',m=>+(Math.abs(m.balance-.5)>.1)],
  [435,'Direct route left','balance','imbalance ≤ 0.1',m=>+(Math.abs(m.balance-.5)<=.1)],
  [436,'Direct route right','balance','imbalance ≤ 0.1',m=>+(Math.abs(m.balance-.5)<=.1)],
  [444,'Echo route left','volume','volume > 0.4',m=>+(m.volume>.4)],
  [445,'Echo route right','volume','volume > 0.4',m=>+(m.volume>.4)],
  [448,'Echo left delay','tempo','quarter note, bounded 1–1000 ms',m=>Math.min(1000,60000/m.tempo)],
  [450,'Echo right delay','tempo','dotted eighth note, bounded 1–1000 ms',m=>Math.min(1000,45000/m.tempo)],
  [452,'Echo reverb','liquidity','12 × liquidity',m=>12*m.liquidity],
  [454,'Echo mix','volume','0.65 × volume',m=>.65*m.volume],
  [456,'Echo repeats','volume','floor(2 × volume)',m=>Math.floor(2*m.volume)],
  [457,'Echo flutter','motion','8 × motion',m=>8*m.motion],
  [461,'Echo feedback','volume','60 × volume (below unity)',m=>60*m.volume],
  [483,'Burst articulation','shock','shock > 0.6',m=>+(m.shock>.6)],
  [484,'Grain articulation','activity','activity > 0.55',m=>+(m.activity>.55)],
  [540,'Gesture interval','activity','50 + 950 × (1 − activity)',m=>50+950*(1-m.activity)],
  [651,'Gesture interval duplicate','activity','50 + 950 × (1 − activity)',m=>50+950*(1-m.activity)],
  [578,'Gesture rounding left','motion','150 + 4850 × (1 − motion)',m=>150+4850*(1-m.motion)],
  [593,'Gesture rounding right','motion','150 + 4850 × (1 − motion)',m=>150+4850*(1-m.motion)],
  [735,'Grain pitch','direction','350 + 250 × direction',m=>350+250*m.direction],
  [737,'Grain duration','activity','30 + 370 × (1 − activity) ms',m=>30+370*(1-m.activity)],
  [740,'Grain start','balance','0.9 × buy share',m=>.9*m.balance],
  [747,'Grain overlap','volume','0.9 + 0.5 × volume',m=>.9+.5*m.volume],
  [799,'Long grain duration','activity','2000 + 5000 × (1 − activity)',m=>2000+5000*(1-m.activity)],
  [822,'Grain modulation depth','motion','0.7 × motion',m=>.7*m.motion],
  [837,'Grain modulation pitch','direction','350 + 250 × direction',m=>350+250*m.direction],
  [846,'Grain modulation rate','activity','1 + 9 × activity',m=>1+9*m.activity],
  [857,'Grain scan rate','activity','0.007 × activity',m=>.007*m.activity],
  [860,'Grain scan rate duplicate','activity','0.007 × activity',m=>.007*m.activity],
  [879,'Tape hiss','volume','0.01 × volume',m=>.01*m.volume],
  [880,'Tape wow/flutter','motion','2 × motion',m=>2*m.motion],
  [884,'Tape level','activity + volume','0.8 × sqrt(activity × volume)',m=>.8*Math.sqrt(m.activity*m.volume)],
  [926,'Grain level','activity + volume','sqrt(activity × volume)',m=>Math.sqrt(m.activity*m.volume)],
];
// These source generators can overwrite market values or run independent clocks.
export const ENVION_FIXED = [18,220,226,311,328,407,412,503,536,569,570,571,585,586,587,637,679,751,772,779,786,793,826,867,876,877,878,881,929,930,942,1064,1090,1123,1137];
export function envionFrame(m, tempo) {
  const available=m.availability||{};
  return {
    motion:unit(m.motion),activity:unit(m.activity),volume:unit(m.volume),
    liquidity:available.liquidity===false?0:unit(m.texture),
    balance:available.balance===false?.5:unit(m.balance??.5),
    direction:unit(((Number(m.context?.direction)||0)+1)/2),pressure:unit(m.context?.pressure),shock:unit(m.context?.shock),
    tempo:Math.max(10,Math.min(200,Number(tempo)||120)),availability:available,
  };
}
export function applyEnvionMarket(pd, namespace, m, tempo, write = (receiver,value)=>pd.sendFloat(receiver,value)) {
  const frame=envionFrame(m,tempo);
  for(const index of ENVION_FIXED)write('av-envion-ui-c0-'+index,0);
  for(const [index,,,,derive] of ENVION_CONTROLS)write('av-envion-ui-c0-'+index,derive(frame));
  // Some original parameter wires bang clock toggles as a side effect. Always
  // stop those generators after the parameter writes, even when 0 is cached.
  for(const index of [18,220,226])pd.sendFloat('av-envion-ui-c0-'+index,0);
  pd.sendFloat(namespace+'-met0',0);
  // The authored pan inlet divides by 20 before its equal-power curves.
  write('av-envion-pan-position',frame.balance*20);
  write('av-envion-density',1+Math.floor(7*(1-frame.activity)));
  write('av-envion-row-base',Math.min(999,Math.floor(999*(.5*frame.direction+.3*frame.volume+.2*frame.motion))));
  return {
    nuke:Math.round(100+4900*frame.motion)+' Hz',
    grains:(frame.activity>.55?'ACTIVE':'QUIET')+' · '+Math.round(frame.activity*100)+'%',
    pan:frame.availability.balance===false?'CENTRE · NO HISTORY':Math.round(frame.balance*100)+'% BUY',
    echo:Math.round(frame.volume*65)+'%'+(frame.availability.volume===false?' · ESTIMATED':''),
    reverb:frame.availability.liquidity===false?'DRY · NO HISTORY':Math.round(frame.liquidity*25)+'%',
  };
}
export function envionMaterial(m) {
  const activity=unit(m.activity),motion=unit(m.motion);
  // Small, supplied assets only. Banks contain 1000 rows, selected on market ticks.
  return {
    sample:activity>.75?'audio/gait.wav':activity>.5?'audio/wood.wav':motion>.5?'audio/toy.wav':'audio/earings.wav',
    envelope:activity>.7?190:motion>.5?208:activity>.35?187:209,
  };
}
