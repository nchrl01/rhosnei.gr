// Validate the active host graph, rather than deleted legacy instruments.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=new URL('../public/patches/orchestra/',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',base),'utf8'));
for(const removed of ['av-hardstyle.pd','av-holder-drone.pd','av-strings.pd','av-zero100.pd'])assert.ok(!manifest.files.includes(removed),'Removed source is absent: '+removed);
for(const name of manifest.files){
 const source=await fs.readFile(new URL(name,base),'utf8');
 const count=source.split('\n').filter(line=>/^#X (obj|msg|text|floatatom|symbolatom|listbox|restore) /.test(line)).length;
 for(const match of source.matchAll(/^#X connect (\d+) (\d+) (\d+) (\d+);/gm))assert.ok(Number(match[1])<count&&Number(match[3])<count,name+' has valid connection endpoints');
}
assert.deepEqual(manifest.layers,['melody','math-0','math-1','math-2','math-3','math-4','data']);
console.log('PASS: active instrument manifest, removed-source exclusion and Pd graph endpoints');
