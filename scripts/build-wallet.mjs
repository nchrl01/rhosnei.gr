import {build} from 'esbuild';
await build({entryPoints:['src/wallet/connect.js'],outdir:'public/vendor/wallet',bundle:true,splitting:true,format:'esm',platform:'browser',target:['safari16','chrome110'],minify:true,legalComments:'eof',define:{'process.env.NODE_ENV':'"production"'}});
