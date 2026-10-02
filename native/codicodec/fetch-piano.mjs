import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(root,'data/vsco-piano');
const revision='440300901dfe9275fd84e0b7763af1f8443ae62e';
const folder='Keys/Upright Piano/';
const names=['Info.txt','MappingChart.txt',...[10,12,14,16,18,20,22,24,26,28,30].map(n=>`Player_dyn1_rr1_${String(n).padStart(3,'0')}.wav`)];
await fs.mkdir(out,{recursive:true});
const files=[];
for(const name of [...names,'LICENSE']){
 const source=name==='LICENSE'?name:folder+name;
 const url='https://raw.githubusercontent.com/sgossner/VSCO-2-CE/'+revision+'/'+source.split('/').map(encodeURIComponent).join('/');
 const response=await fetch(url);if(!response.ok)throw Error(source+': '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 await fs.writeFile(path.join(out,name),bytes);
 files.push({path:source,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),url});
 console.log(name);
}
await fs.writeFile(path.join(out,'provenance.json'),JSON.stringify({repository:'https://github.com/sgossner/VSCO-2-CE',revision,license:'CC0-1.0',files},null,2)+'\n');
