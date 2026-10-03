import {build} from 'esbuild';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
const out='public/vendor/ui';
await mkdir(out,{recursive:true});
await build({entryPoints:['src/ui/interface.jsx'],outfile:out+'/upic-ui.js',bundle:true,format:'esm',platform:'browser',target:['safari16','chrome110','firefox115'],jsx:'automatic',minify:true,legalComments:'eof',define:{'process.env.NODE_ENV':'"production"'}});
await copyFile('src/ui/reactbits/LICENSE.md',out+'/REACT-BITS-LICENSE.md');
const licenses=[];
for(const pkg of ['react','react-dom','scheduler','motion','framer-motion','motion-dom','motion-utils','tslib']){
 const manifest=JSON.parse(await readFile('node_modules/'+pkg+'/package.json','utf8'));
 const license=await readFile('node_modules/'+pkg+'/LICENSE.md','utf8').catch(()=>readFile('node_modules/'+pkg+'/LICENSE','utf8')).catch(()=>readFile('node_modules/'+pkg+'/LICENSE.txt','utf8'));
 licenses.push(pkg+' '+manifest.version+'\n'+license);
 if(pkg==='tslib')licenses.push(await readFile('node_modules/tslib/CopyrightNotice.txt','utf8'));
}
await writeFile(out+'/DEPENDENCY-LICENSES.txt',licenses.join('\n\n'));
