import {envionSamples} from './envion-samples.js?v=449';

export function createEnvionSampleEditor(parent){
 const panel=document.createElement('div');panel.className='envion-sample-editor';panel.id='envion-samples';
 const intro=document.createElement('p');intro.className='lab-hint';intro.textContent='Choose the sounds Envion plays. Main sample feeds the grains; tape supplies the background texture. Mono or stereo, up to 30 seconds and 12 MB each.';
 const scope=document.createElement('p');scope.className='lab-hint';scope.textContent='Samples stay in this browser for this site and also apply on its homepage. Different coins still choose their own presets and effects. Nothing is uploaded.';
 const status=document.createElement('p');status.className='envion-sample-status';status.setAttribute('role','status');
 panel.append(intro,scope);parent.append(panel);
 const controls=[],rows=new Map();let busy=false,disposed=false;
 function button(label,fn){const el=document.createElement('button');el.type='button';el.textContent=label;el.onclick=fn;controls.push(el);return el;}
 function render(pack){
  if(disposed)return;
  for(const [slot,row] of rows){const item=pack[slot];row.detail.textContent=item?item.name+' · '+item.duration.toFixed(1)+' s · '+(item.channels===1?'mono':'stereo'):'Bundled library · chosen by coin';row.reset.disabled=busy||!item;}
 }
 async function run(message,fn,success){
  if(busy||disposed)return;busy=true;controls.forEach(control=>control.disabled=true);status.textContent=message;
  try{await fn();if(!disposed)status.textContent=success;}catch(error){if(!disposed)status.textContent=error.message||'Could not change the sample.';}
  finally{busy=false;if(!disposed){controls.forEach(control=>control.disabled=false);render(envionSamples.snapshot());}}
 }
 for(const [slot,title] of [['sample','Main sample'],['tape','Tape texture']]){
  const row=document.createElement('section');row.className='envion-sample-slot';const heading=document.createElement('h3');heading.textContent=title;
  const detail=document.createElement('p');detail.className='envion-sample-detail';
  const input=document.createElement('input');input.type='file';input.accept='audio/*,.wav,.aif,.aiff,.flac';input.hidden=true;input.setAttribute('aria-label','Choose '+title.toLowerCase());
  input.onchange=()=>{const file=input.files?.[0];input.value='';if(file)void run('Decoding and saving '+title.toLowerCase()+'…',()=>envionSamples.replace(slot,file),title+' saved. Envion will use it when the next material load completes.');};
  const choose=button('Choose audio file',()=>input.click()),reset=button('Use bundled',()=>void run('Restoring bundled '+title.toLowerCase()+'…',()=>envionSamples.reset(slot),'Bundled '+title.toLowerCase()+' restored.'));
  const actions=document.createElement('div');actions.className='envion-sample-actions';actions.append(choose,reset,input);row.append(heading,detail,actions);panel.append(row);rows.set(slot,{detail,reset});
 }
 const tools=document.createElement('div');tools.className='envion-sample-actions';
 const load=document.createElement('input');load.type='file';load.accept='application/json,.json';load.hidden=true;load.setAttribute('aria-label','Import Envion sample pack');
 load.onchange=()=>{const file=load.files?.[0];load.value='';if(file)void run('Reading sample pack…',()=>envionSamples.importPack(file),'Sample pack saved in this browser.');};
 tools.append(button('Export samples',()=>void run('Preparing sample pack…',async()=>{
  const text=await envionSamples.exportPack(),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='upic-envion-samples.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 },'Sample pack exported. Import it in another browser to use the same sounds.')),button('Import samples',()=>load.click()),button('Reset both samples',()=>void run('Restoring bundled samples…',()=>envionSamples.reset(),'Both sample slots now use the bundled library.')),load);
 panel.append(tools,status);
 const unsubscribe=envionSamples.subscribe((pack,error)=>{render(pack);if(error&&!busy&&!disposed)status.textContent=error.message;});
 render(envionSamples.snapshot());void envionSamples.ready().then(render).catch(error=>{if(!disposed)status.textContent=error.message;});
 return()=>{disposed=true;unsubscribe();};
}
