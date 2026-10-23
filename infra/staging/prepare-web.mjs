#!/usr/bin/env node
// Apply staging wiring to build output only. Production sources and Pages output stay intact.
import {copyFile,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {dirname,extname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const dist=resolve(process.argv[2]||join(here,'../../apps/web/dist'));
const origin=new URL(process.env.ORIGIN||'http://localhost:5173');
if(!['https:','http:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)
 throw Error('ORIGIN must be an http(s) origin without credentials, path, query or hash');
const productionData='https://upic-insightx.nchrl01.workers.dev';
const wiring='<!-- staging-tools:start --><link rel="stylesheet" href="/staging-navigation.css?v=1"><script src="/staging-navigation.js?v=1" defer></script><!-- staging-tools:end -->';
let pages=0,modules=0;
async function prepare(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const file=join(directory,entry.name);
  if(entry.isDirectory()){await prepare(file);continue;}
  if(!entry.isFile())continue;
  if(entry.name.endsWith('.map')){await rm(file);continue;}
  if(!['.html','.js','.mjs','.css','.json','.webmanifest','.svg','.txt'].includes(extname(file)))continue;
  const before=await readFile(file,'utf8');let source=before.replaceAll(productionData,origin.origin+'/x');
  const ownScript=['.js','.mjs'].includes(extname(file))&&!relative(dist,file).split(/[\\/]/).includes('vendor');
  // Access protects /x as well as the document. same-origin sends its cookie to /x while
  // still omitting cookies for every third-party market API, exactly as before.
  if(ownScript)source=source.replace(/credentials\s*:\s*(['"])omit\1/g,"credentials:'same-origin'");
  if(extname(file)==='.html'&&/<\/head>/i.test(source)){
   source=source.replace(/<!-- staging-tools:start -->[\s\S]*?<!-- staging-tools:end -->\s*/g,'');
   // All static pages use the live instrument as their Home. The platform React app keeps /.
   if(relative(dist,file)!=='index.html')source=source.replace(/\bhref=(['"])\.\/(#[^'"]*)?\1/g,(_,quote,hash='')=>'href='+quote+'/instrument'+hash+quote);
   source=source.replace(/<\/head>/i,wiring+'\n</head>');pages++;
  }
  if(source!==before){await writeFile(file,source);modules++;}
 }
}
await prepare(dist);
await copyFile(join(here,'staging-navigation.js'),join(dist,'staging-navigation.js'));
await copyFile(join(here,'staging-navigation.css'),join(dist,'staging-navigation.css'));
await rm(join(dist,'_redirects'),{force:true});
console.log(`Prepared staging: ${pages} pages, ${modules} files wired, private data calls retain Access, production sources unchanged.`);
