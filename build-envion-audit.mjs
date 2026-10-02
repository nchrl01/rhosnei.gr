import fs from 'node:fs/promises';
import {ENVION_CONTROLS,ENVION_FIXED} from './public/envion-market.js';
import {buildPerformanceCatalog,CHANCE_LABELS} from './public/envion-performance.js';
const root=new URL('./public/patches/envion/',import.meta.url);
const model=JSON.parse(await fs.readFile(new URL('model.json',root),'utf8'));
const {banks}=JSON.parse(await fs.readFile(new URL('performance-catalog.json',root),'utf8'));
const catalog=buildPerformanceCatalog(model,banks),controls=[];
for(const canvas of Object.values(model.canvases))for(const node of canvas.nodes){
 if(!node.send)continue;
 const key=canvas.id+'-'+node.index;
 const preset=canvas.id==='c0'&&catalog.presets.find(p=>p.index===node.index);
 const numeric=canvas.id==='c0'&&ENVION_CONTROLS.find(p=>p[0]===node.index);
 const category=preset?'market-weighted preset chance':CHANCE_LABELS[key]?'market-weighted effect/gesture chance':numeric?'market input with phrase variation':node.fileRequest==='savepanel'?'manual recording infrastructure':node.fileRequest||node.dialogs?.length?'automatic bundled file source':canvas.id==='c0'&&ENVION_FIXED.includes(node.index)?'host clock / dormant source control':'authored DSP / preset internals; not independently randomized';
 controls.push({canvas:canvas.id,canvasName:canvas.name,index:node.index,receiver:node.send,original:node.text,category,...(preset?{name:preset.name}:numeric?{name:numeric[1],input:numeric[2]}:CHANCE_LABELS[key]?{name:CHANCE_LABELS[key]}:{})});
}
const audit={version:2,mode:'Market-weighted phrase chance + automatic bundled file sources',catalog:{presets:catalog.presets,samples:catalog.samples,banks:catalog.banks,impulseResponses:catalog.irs},retainedUserControls:['Listen / Pause','Record','Listening volume','Chart replay'],decisions:{effects:'Every two beats; market-weighted probability and bounded variation',material:'Every four beats; market-weighted chance, no immediate preset repeat',files:'Original source presets, sample loaders and NETaudio requests use bundled assets'},limitations:['Initialization, calibration, Panic, Stop and recording are not chance actions.','Source DSP internals retain the authored implementation.','Historical candles do not encode the original random decisions or full market inputs.'],controls};
await fs.writeFile(new URL('control-audit.json',root),JSON.stringify(audit,null,2)+'\n');
console.log('Catalog:',catalog.presets.length,'presets,',catalog.samples.length,'samples,',catalog.banks.length,'banks,',catalog.samples.filter(p=>p.includes('___tape-audio/')).length,'tape recordings');
