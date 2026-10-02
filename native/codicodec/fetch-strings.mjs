import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,'data/vsco-violin');
await fs.mkdir(out,{recursive:true});
const response=await fetch('https://api.github.com/repos/sgossner/VSCO-2-CE/git/trees/master?recursive=1');
if(!response.ok)throw Error('Library index: '+response.status);
const tree=await response.json(),files=tree.tree.filter(x=>/^Strings\/Solo Violin\/Arco Vib\/.*_p.wav$/.test(x.path));
if(!files.length)throw Error('No sustained violin samples found');
for(const item of [...files,{path:'LICENSE'}]){
 const url='https://raw.githubusercontent.com/sgossner/VSCO-2-CE/'+tree.sha+'/'+item.path.split('/').map(encodeURIComponent).join('/');
 const res=await fetch(url);if(!res.ok)throw Error('Sample download: '+res.status);
 await fs.writeFile(path.join(out,path.basename(item.path)),new Uint8Array(await res.arrayBuffer()));
 console.log(path.basename(item.path));
}
await fs.writeFile(path.join(out,'provenance.json'),JSON.stringify({repository:'https://github.com/sgossner/VSCO-2-CE',revision:tree.sha,license:'CC0-1.0',recordists:'Sam Gossner and Simon Dalzell',files},null,2));
