import {ROUTES,TIMING,PIXELS,FEEDBACK,COLLECTIBLE,VISUAL_RULES,SOURCES,baseline,hydrate,validate,changes,changeNote} from './mapping-lab-model.js?v=214';
import {ENVION_CONTROLS} from './envion-market.js?v=61';
const $=id=>document.getElementById(id),key='upic-mapping-lab-v1',original=baseline();
let draft=baseline(),storageAvailable=true,saveTimer;
try{const saved=localStorage.getItem(key);if(saved)draft=hydrate(JSON.parse(saved));}catch{storageAvailable=false;}
function get(path,object=draft){return path.split('.').reduce((value,name)=>value[name],object);}
function set(path,value){const names=path.split('.'),last=names.pop();names.reduce((object,name)=>object[name],draft)[last]=value;}
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function bind(control,path){control.dataset.path=path;control.id='lab-'+path.replaceAll('.','-');if(control.type==='checkbox')control.checked=get(path);else control.value=get(path);return control;}
function labeled(control,path,title){bind(control,path);const label=element('label','',title);label.htmlFor=control.id;return [label,control];}
function textField(path,title,rows=3){const wrap=element('div','field'),input=element('textarea');input.rows=rows;input.maxLength=10000;wrap.append(...labeled(input,path,title));return wrap;}
function checkbox(path,title){const label=element('label','check'),input=element('input');input.type='checkbox';bind(input,path);label.append(input,document.createTextNode(title));return label;}
function numberFields(container,group,definitions){
 container.replaceChildren();for(const [id,title,value,min,max,step,unit,hint] of definitions){
  const path=group+'.'+id,wrap=element('div','field'),input=element('input');input.type='number';input.min=min;input.max=max;input.step=step;input.required=true;
  wrap.append(...labeled(input,path,title+(unit?' / '+unit:'')));const helper=element('small');helper.append(element('strong','', 'Original: '+value+(unit?' '+unit:'')),document.createTextNode(' · '+hint));wrap.append(helper);container.append(wrap);
 }
}
function expressionFields(container,group,definitions){
 container.replaceChildren();for(const [id,title,source,expression] of definitions){
  const row=element('div','expression'),meta=element('div'),control=element('div');row.dataset.rule=group+'.'+id;
  meta.append(element('h3','',title),element('small','', 'Original input: '+source));
  const select=element('select');for(const option of [...new Set([...SOURCES,source,get(group+'.'+id+'.source')])]){const node=element('option','',option);node.value=option;select.append(node);}
  meta.append(...labeled(select,group+'.'+id+'.source','DATA INPUT'),checkbox(group+'.'+id+'.enabled','Use this control'));
  control.append(textField(group+'.'+id+'.expression','RESPONSE / FORMULA',2));const helper=element('small','', 'Original: '+expression);control.append(helper,textField(group+'.'+id+'.note','NOTE FOR IMPLEMENTATION',2));row.append(meta,control);container.append(row);
 }
}
function renderForm(){
 $('route-list').replaceChildren();for(const [id,title,inputs] of ROUTES){
  const route=element('article','route');route.dataset.rule='routes.'+id;const head=element('div','route-head');head.append(element('h3','',title),checkbox('routes.'+id+'.enabled','Use this mapping'));const source=element('p','hint',inputs),grid=element('div','route-grid');
  grid.append(textField('routes.'+id+'.interpret','INTERPRETATION'),textField('routes.'+id+'.sound','SOUND RESPONSE'),textField('routes.'+id+'.visual','VISUAL RESPONSE'));
  const note=textField('routes.'+id+'.note','YOUR NOTE',2);note.classList.add('route-note');route.append(head,source,grid,note);$('route-list').append(route);
 }
 numberFields($('timing-list'),'timing',TIMING);numberFields($('pixel-numbers'),'pixels',PIXELS);numberFields($('feedback-list'),'feedback',FEEDBACK);numberFields($('collectible-list'),'collectible',COLLECTIBLE);
 expressionFields($('envion-list'),'envion',ENVION_CONTROLS.map(([id,title,source,expression])=>[id,title,source,expression]));$('envion-count').textContent='('+ENVION_CONTROLS.length+')';
 expressionFields($('pixel-expressions'),'visualRules',VISUAL_RULES);
 bind($('goal'),'goal');bind($('audio-behavior'),'audioBehavior');bind($('include-collectible'),'includeCollectible');bind($('collection-behavior'),'collectionBehavior');
 update(false);
}
function message(text){$('message').textContent=text;}
function update(save=true){
 const list=changes(draft),errors=validate(draft);$('change-count').textContent=list.length+' change'+(list.length===1?'':'s');
 $('note-preview').value=(errors.length?'FIX BEFORE EXPORT\n'+errors.join('\n')+'\n\n':'')+changeNote(draft);
 for(const control of document.querySelectorAll('[data-path]')){const path=control.dataset.path;control.closest('.field')?.classList.toggle('changed',get(path)!==get(path,original));}
 for(const row of document.querySelectorAll('[data-rule]'))row.classList.toggle('changed',JSON.stringify(get(row.dataset.rule))!==JSON.stringify(get(row.dataset.rule,original)));
 if(save){$('save-state').textContent='Saving draft…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(key,JSON.stringify(draft));storageAvailable=true;$('save-state').textContent='Draft saved locally';}catch{storageAvailable=false;$('save-state').textContent='Storage unavailable · download your draft';}},200);}
 else $('save-state').textContent=storageAvailable?'Draft saved locally':'Storage unavailable · download your draft';
}
document.querySelector('main').addEventListener('input',event=>{
 const control=event.target,path=control.dataset.path;if(!path)return;
 const value=control.type==='checkbox'?control.checked:control.type==='number'?(control.value===''?'':Number(control.value)):control.value;set(path,value);message('');update();
});
function validExport(){const errors=validate(draft);if(errors.length){message(errors[0]);$('review').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});return false;}return true;}
function download(contents,type,extension){
 const url=URL.createObjectURL(new Blob([contents],{type})),link=document.createElement('a');link.href=url;link.download='upic-mapping-'+new Date().toISOString().slice(0,10)+'.'+extension;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('download-note').onclick=()=>{if(validExport()){download(changeNote(draft),'text/plain;charset=utf-8','txt');message('Change note exported. Attach it to this chat when you are ready.');}};
$('download-json').onclick=()=>{download(JSON.stringify(draft,null,2),'application/json','json');message('Editable draft saved. Load it here to continue on another device.');};
$('copy-note').onclick=async()=>{
 if(!validExport())return;const note=changeNote(draft);
 try{await navigator.clipboard.writeText(note);message('Note copied. Paste it into this chat.');}catch{$('note-preview').focus();$('note-preview').select();message('Select and copy the note below; clipboard access is unavailable.');}
};
$('import').onchange=async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{if(file.size>300000)throw Error('Draft is too large. Use a JSON draft exported here.');const next=hydrate(JSON.parse(await file.text()));draft=next;renderForm();update();message('Draft loaded. Your requested settings are restored.');}catch(error){message(error.message||'Could not load this draft.');}finally{event.target.value='';}
};
$('reset').onclick=()=>{$('reset-dialog').showModal();};$('cancel-reset').onclick=()=>{$('reset-dialog').close();};$('confirm-reset').onclick=()=>{draft=baseline();renderForm();update();$('reset-dialog').close();message('Draft reset. The live website was not changed.');};
window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);try{localStorage.setItem(key,JSON.stringify(draft));}catch{}});
renderForm();
