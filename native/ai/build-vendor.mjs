import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
const root=new URL('../../',import.meta.url),output=new URL('public/vendor/ai/',root);
await build({entryPoints:[new URL('music-rnn-entry.js',import.meta.url).pathname],outfile:new URL('music-rnn.js',output).pathname,bundle:true,minify:true,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},alias:{'@magenta/music/esm/core/compat/global':'@magenta/music/esm/core/compat/global_browser'},logLevel:'info'});
await copyFile(new URL('node_modules/kokoro-js/dist/kokoro.web.js',import.meta.url),new URL('kokoro.web.js',output));
