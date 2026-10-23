import {defineConfig} from 'vite';
export default defineConfig({base:process.env.UPIC_BASE_PATH||'/',optimizeDeps:{entries:['index.html']},server:{host:'127.0.0.1',port:5173},build:{target:['safari16','chrome110'],outDir:'dist'}});
