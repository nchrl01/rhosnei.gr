import {build} from 'esbuild';
import {readFile,readdir,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
const outdir='apps/web/public/vendor/wallet';
// The SDK uses 104px wallet cards with space-between, leaving a large central
// gap in narrow embedded dialogs. Patch its bundled component styles at build
// time so both the complete list and search results use the same fluid grid.
const walletGridStyles={
 'w3m-all-wallets-list':`wui-grid{grid-template-columns:repeat(2,minmax(0,1fr));justify-content:stretch!important;gap:12px!important;overflow-x:hidden;overscroll-behavior:contain}w3m-all-wallets-list-item,wui-card-select-loader{min-width:0;width:100%}wui-loading-spinner{grid-column:1/-1}`,
 'w3m-all-wallets-search':`wui-grid{grid-template-columns:repeat(2,minmax(0,1fr));justify-content:stretch!important;gap:12px!important;overflow-x:hidden;overscroll-behavior:contain}w3m-all-wallets-list-item{min-width:0;width:100%}`,
 'w3m-all-wallets-list-item':`:host{display:block;min-width:0;width:100%}button{box-sizing:border-box;width:100%;min-height:128px;padding:12px 8px}button>wui-flex{width:100%;min-width:0;min-height:36px;align-items:center}button>wui-flex>wui-text,button>wui-flex>wui-text.certified{min-width:0;max-width:none;white-space:normal;overflow-wrap:anywhere;text-overflow:clip;line-height:18px}button>wui-flex>wui-icon{flex:none}`
};
const walletGrid={name:'upic-wallet-grid',setup(plugin){
 plugin.onLoad({filter:/appkit-scaffold-ui\/dist\/esm\/src\/partials\/w3m-all-wallets-(?:list|search|list-item)\/styles\.js$/},async({path})=>{
  const component=path.split('/').at(-2),source=await readFile(path,'utf8'),end=source.lastIndexOf('`;');
  if(end<0||!walletGridStyles[component])throw Error('Wallet grid style source changed; review the UPIC layout patch.');
  return {contents:source.slice(0,end)+'\n'+walletGridStyles[component]+'\n'+source.slice(end),loader:'js'};
 });
}};
const result=await build({entryPoints:['apps/web/legacy/wallet/connect.js'],outdir,bundle:true,splitting:true,format:'esm',platform:'browser',target:['safari16','chrome110'],minify:true,legalComments:'eof',metafile:true,plugins:[walletGrid],define:{'process.env.NODE_ENV':'"production"'}});
// Hashed wallet chunks are generated; remove obsolete builds after success.
const outputs=new Set(Object.keys(result.metafile.outputs).map(file=>resolve(file)));
for(const file of await readdir(outdir))if(/^(?:chunk-|connect)[\w.-]*\.js$/.test(file)&&!outputs.has(resolve(outdir,file)))await unlink(resolve(outdir,file));
