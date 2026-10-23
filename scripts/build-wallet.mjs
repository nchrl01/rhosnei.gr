import {build} from 'esbuild';
import {readFile,readdir,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
const outdir='apps/web/public/vendor/wallet';
// Apply responsive wallet grids and Send form spacing in the SDK bundle.
// Build-time patches preserve the SDK handlers and fail if source anchors change.
const walletGridStyles={
 'w3m-wallet-send-view':`.inputContainer{gap:12px!important}wui-icon-box{position:relative;top:auto;left:auto;transform:none;align-self:center;flex:none;box-sizing:border-box;width:28px;height:28px;border:0;background:transparent}w3m-input-token,w3m-input-address{box-sizing:border-box;min-width:0}`,
 'wui-token-button':`button{gap:8px;min-height:36px;color:#fff}button .token-image{width:26px!important;height:26px!important}wui-text{color:#fff;--local-color:#fff!important;padding:0}`,
 'w3m-input-token':`:host{display:block;height:auto;min-height:112px;box-sizing:border-box}wui-flex{box-sizing:border-box;min-width:0} :host>wui-flex{padding:20px!important;gap:12px!important}:host>wui-flex>wui-flex:first-child{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center}wui-input-amount{min-width:0;width:100%;mask-image:none}wui-token-button{flex:none;justify-self:end;width:auto}:host>wui-flex>wui-flex:last-child>wui-flex{width:auto;margin-left:auto;gap:8px!important}` ,
 'w3m-input-address':`:host{display:block;height:auto;min-height:88px;box-sizing:border-box} :host>wui-flex{box-sizing:border-box;min-height:88px;padding:20px!important}.instruction{display:flex!important;align-items:center;justify-content:space-between;gap:12px;left:20px;right:20px;white-space:nowrap}.paste{display:inline-flex;flex:none;margin:0}textarea{min-width:0;overflow-wrap:anywhere}`,
 'w3m-all-wallets-list':`wui-grid{grid-template-columns:repeat(2,minmax(0,1fr));justify-content:stretch!important;gap:12px!important;overflow-x:hidden;overscroll-behavior:contain}w3m-all-wallets-list-item,wui-card-select-loader{min-width:0;width:100%}wui-loading-spinner{grid-column:1/-1}`,
 'w3m-all-wallets-search':`wui-grid{grid-template-columns:repeat(2,minmax(0,1fr));justify-content:stretch!important;gap:12px!important;overflow-x:hidden;overscroll-behavior:contain}w3m-all-wallets-list-item{min-width:0;width:100%}`,
 'w3m-all-wallets-list-item':`:host{display:block;min-width:0;width:100%}button{box-sizing:border-box;width:100%;min-height:128px;padding:12px 8px}button>wui-flex{width:100%;min-width:0;min-height:36px;align-items:center}button>wui-flex>wui-text,button>wui-flex>wui-text.certified{min-width:0;max-width:none;white-space:normal;overflow-wrap:anywhere;text-overflow:clip;line-height:18px}button>wui-flex>wui-icon{flex:none}`
};
export const walletGrid={name:'upic-wallet-grid',setup(plugin){
 plugin.onLoad({filter:/appkit-scaffold-ui\/dist\/esm\/src\/partials\/w3m-input-address\/index\.js$/},async({path})=>{
  const source=await readFile(path,'utf8');
  if(!source.includes('Type or')||!source.includes('        address'))throw Error('Recipient template changed; review the UPIC layout patch.');
  return {contents:source.replace('<wui-text\n        ${ref(this.instructionElementRef)}', '<div\n        ${ref(this.instructionElementRef)}').replace('Type or','<wui-text color="secondary" variant="md-medium">Recipient address</wui-text>').replace('        address\n      </wui-text>', '      </div>').replaceAll('<textarea','<textarea aria-label="Recipient address"'),loader:'js'};
 });
 plugin.onLoad({filter:/(?:appkit-scaffold-ui|appkit-ui)\/dist\/esm\/src\/(?:partials|views|composites)\/(?:w3m-all-wallets-(?:list|search|list-item)|w3m-wallet-send-view|w3m-input-token|w3m-input-address|wui-token-button)\/styles\.js$/},async({path})=>{
  const component=path.split('/').at(-2),source=await readFile(path,'utf8'),end=source.lastIndexOf('`;');
  if(end<0||!walletGridStyles[component])throw Error('Wallet grid style source changed; review the UPIC layout patch.');
  return {contents:source.slice(0,end)+'\n'+walletGridStyles[component]+'\n'+source.slice(end),loader:'js'};
 });
}};
const result=await build({entryPoints:['apps/web/legacy/wallet/connect.js'],outdir,bundle:true,splitting:true,format:'esm',platform:'browser',target:['safari16','chrome110'],minify:true,legalComments:'eof',metafile:true,plugins:[walletGrid],define:{'process.env.NODE_ENV':'"production"'}});
// Hashed wallet chunks are generated; remove obsolete builds after success.
const outputs=new Set(Object.keys(result.metafile.outputs).map(file=>resolve(file)));
for(const file of await readdir(outdir))if(/^(?:chunk-|connect|send-|swaps-)[\w.-]*\.js$/.test(file)&&!outputs.has(resolve(outdir,file)))await unlink(resolve(outdir,file));
