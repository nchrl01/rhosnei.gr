import {defineConfig} from 'vite';
export default defineConfig({publicDir:process.env.UPIC_PAGES_STAGING==='true'?false:'public',base:process.env.UPIC_BASE_PATH||'/',server:{host:'127.0.0.1',port:5173},build:{target:['safari16','chrome110'],outDir:'dist'}});
