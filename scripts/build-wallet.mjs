import {build} from 'esbuild';
import {readdir,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
const outdir='public/vendor/wallet';
const result=await build({entryPoints:['src/wallet/connect.js'],outdir,bundle:true,splitting:true,format:'esm',platform:'browser',target:['safari16','chrome110'],minify:true,legalComments:'eof',metafile:true,define:{'process.env.NODE_ENV':'"production"'}});
// Hashed wallet chunks are generated; remove obsolete builds after success.
const outputs=new Set(Object.keys(result.metafile.outputs).map(file=>resolve(file)));
for(const file of await readdir(outdir))if(/^(?:chunk-|connect)[\w.-]*\.js$/.test(file)&&!outputs.has(resolve(outdir,file)))await unlink(resolve(outdir,file));
