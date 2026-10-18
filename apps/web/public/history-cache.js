// Thirty-day, bounded history storage. Provider timestamps and coverage survive reloads.
export const HISTORY_RETENTION_MS=30*86400000;
const MAX_BYTES=64*1024*1024,MAX_RECORDS=512,memory=new Map();let database;
function open(){return database??=new Promise((resolve,reject)=>{
 let request,settled=false;const timer=setTimeout(()=>{settled=true;reject(Error('History storage timed out'));},1500);
 try{request=indexedDB.open('upic-history-cache-v1',1);}catch(error){clearTimeout(timer);reject(error);return;}
 request.onupgradeneeded=()=>{request.result.createObjectStore('records',{keyPath:'key'});request.result.createObjectStore('metadata',{keyPath:'key'});};
 request.onsuccess=()=>{clearTimeout(timer);if(settled){request.result.close();return;}settled=true;resolve(request.result);};
 request.onerror=()=>{clearTimeout(timer);settled=true;reject(request.error);};
 request.onblocked=()=>{};
});}
function memo(key,value){memory.delete(key);memory.set(key,value);while(memory.size>8)memory.delete(memory.keys().next().value);}
export async function readSavedHistory(key){
 const now=Date.now(),hit=memory.get(key);if(hit&&now-hit.saved<HISTORY_RETENTION_MS)return hit;
 try{const db=await open();const record=await new Promise((resolve,reject)=>{const tx=db.transaction('records'),r=tx.objectStore('records').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(record&&record.expires>now){memo(key,record.value);return record.value;}}
 catch{}
 // Migrate only this requested legacy entry. Never delete unrelated browser data.
 try{const value=JSON.parse(localStorage.getItem(key));if(value?.saved>now-HISTORY_RETENTION_MS){void writeSavedHistory(key,value);return value;}}catch{}
 return null;
}
export async function writeSavedHistory(key,value){
 if(!Number.isFinite(value?.saved))return;memo(key,value);
 try{const size=JSON.stringify(value).length*2;if(size>MAX_BYTES/4)return;const db=await open(),now=Date.now();
 await new Promise((resolve,reject)=>{const tx=db.transaction(['records','metadata'],'readwrite'),records=tx.objectStore('records'),metadata=tx.objectStore('metadata');
 records.put({key,value,expires:value.saved+HISTORY_RETENTION_MS});metadata.put({key,size,accessed:now,expires:value.saved+HISTORY_RETENTION_MS});
 const all=metadata.getAll();all.onsuccess=()=>{const rows=all.result.sort((a,b)=>b.accessed-a.accessed);let total=0,count=0;for(const row of rows){if(row.expires<=now||count>=MAX_RECORDS||total+row.size>MAX_BYTES){records.delete(row.key);metadata.delete(row.key);}else{total+=row.size;count++;}}};
 tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });try{localStorage.removeItem(key);}catch{}
 }catch{}
}
