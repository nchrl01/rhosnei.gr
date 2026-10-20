import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,expect,it,vi} from 'vitest';

// Exercise production state/DOM logic offline. These are explicit fixtures,
// never registry responses used by the published application.
const source=readFileSync(new URL('../public/nft-owner-preview.js',import.meta.url),'utf8').replace(/^import .*;\n/m,'').replace(/export function /g,'function ');
const token='0x'+'aB'.repeat(20),address='0x'+'12'.repeat(20),wallet='0x'+'34'.repeat(20);
const market={chainId:'ethereum',baseToken:{address:token,symbol:'TEST'}};
const collection={chain:'ethereum',token:token.toLowerCase(),address};
const config={deployment:{mode:'mainnet',chainId:1,factory:'0x'+'56'.repeat(20)},appURL:'https://collections.example/app/'};
const json=value=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>value});
function fixture({host='nchrl01.github.io',api,fetch=vi.fn(),account=null}={}){
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.events={};this.textContent='';this.hidden=false;this.className='';this.classList={add:name=>{this.className+=' '+name;}};}
  append(...children){for(const child of children){child.remove();child.parent=this;this.children.push(child);}}
  after(child){child.remove();child.parent=this.parent;this.parent.children.splice(this.parent.children.indexOf(this)+1,0,child);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}}
  replaceChildren(...children){for(const child of [...this.children])child.remove();this.append(...children);}
  contains(child){return this===child||this.children.some(item=>item.contains(child));}
  querySelector(selector){return this.children.find(child=>child.className.split(' ').includes(selector.slice(1)))||null;}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(name,callback){this.events[name]=callback;}
 }
 const player=new Element('section'),advanced=new Element('div'),panel=new Element('section'),summary=new Element('aside');summary.className='coin-ai-summary';panel.append(summary);player.append(advanced,panel);if(api)panel.dataset.collectionApi=api;
 const location=new URL('https://'+host+'/rhosnei.gr/'),document={baseURI:location.href,createElement:tag=>new Element(tag),querySelector:selector=>selector==='.instrument'?player:null,getElementById:id=>id==='advanced-diagnostics'?advanced:null};
 const unsubscribe=vi.fn(),context=vm.createContext({document,location,URL,URLSearchParams,AbortController,AbortSignal,Date,fetch,getWalletAccount:()=>account,subscribeWalletAccount:listener=>{listener(account);return unsubscribe;}});
 vm.runInContext(source,context);
 const ui=context.createNftOwnerPreview(panel),state=panel.children[1],note=panel.children[2],owner=panel.children[3],actions=panel.children[4],browse=actions.children[0],retry=actions.children[1];
 return {context,ui,panel,player,advanced,summary,state,note,owner,browse,retry,fetch,unsubscribe};
}
function liveFixture({rows=[collection],details={collection,editions:[{collection:address,edition:1,owner:wallet}]},...options}={}){
 const fetch=vi.fn(async url=>String(url).endsWith('/config')?json(config):String(url).endsWith('/collections')?json(rows):json(details));
 return fixture({api:'/api/',fetch,...options});
}
describe('coin collection status',()=>{
 it('shows a quiet unavailable state with no futile retry or tokenization action on the static site',async()=>{
  const f=fixture();await f.ui.setMarket(market);
  expect(f.state.textContent).toBe('Tokenization is not available yet');expect(f.retry.hidden).toBe(true);expect(f.fetch).not.toHaveBeenCalled();
  expect(f.browse.textContent).toBe('Browse collection');expect(f.panel.children[4].children).toHaveLength(2);
  expect(f.player.children.indexOf(f.panel)).toBe(f.player.children.indexOf(f.advanced)+1);expect(f.player.contains(f.summary)).toBe(true);
 });
 it('hides the panel until a coin is selected',async()=>{const f=fixture();await f.ui.setMarket(null);expect(f.panel.hidden).toBe(true);expect(f.fetch).not.toHaveBeenCalled();});
 it('never presents testnet collections as live ownership and offers no futile retry',async()=>{
  const fetch=vi.fn(async()=>json({...config,deployment:{...config.deployment,mode:'testnet',chainId:46630}})),f=fixture({api:'/api/',fetch});await f.ui.setMarket(market);
  expect(f.state.textContent).toBe('Tokenization is not available yet');expect(f.owner.hidden).toBe(true);expect(f.retry.hidden).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('offers retry for an actual configured service failure and caches failures across selections',async()=>{
  const fetch=vi.fn(async()=>{throw Error('network');}),f=fixture({api:'/api/',fetch});await f.ui.setMarket(market);await f.ui.setMarket({...market,chainId:'base'});
  expect(f.state.textContent).toBe('Collection status unavailable');expect(f.retry.hidden).toBe(false);expect(f.retry.disabled).toBe(false);expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('treats a missing same-origin API as unconfigured, without a permanent Retry',async()=>{
  const f=fixture({host:'example.com',fetch:vi.fn(async()=>({ok:false,status:404}))});await f.ui.setMarket(market);expect(f.state.textContent).toBe('Tokenization is not available yet');expect(f.retry.hidden).toBe(true);
 });
 it('requires the exact network and preserves non-EVM address case',()=>{
  const {context:c}=fixture(),id=c.collectionIdentity(market);expect(id.token).toBe(token.toLowerCase());expect(c.matchingCollection([collection],id).address).toBe(address);
  expect(c.matchingCollection([collection],{...id,chain:'base'})).toBeNull();
  const sol=c.collectionIdentity({chainId:'solana',baseToken:{address:'AbCdEf'}});expect(sol.token).toBe('AbCdEf');expect(c.matchingCollection([{...collection,chain:'solana',token:'abcdef'}],sol)).toBeNull();
  expect(c.matchingCollection([collection,collection],id)).toBeNull();expect(c.matchingCollection([null,{token:3}],id)).toBeNull();
 });
 it('uses a verified native identity rather than an exchange pair symbol',()=>{
  const {context:c}=fixture();expect(c.collectionIdentity({source:'ccxt',chainId:'exchange',baseToken:{address:'cex:kraken:ETH/USD'}})).toBeNull();
  expect(c.collectionIdentity({source:'ccxt',chainId:'exchange',nativeAsset:{chain:'ethereum',address:token},baseToken:{address:'cex:kraken:ETH/USD'}})).toEqual({chain:'ethereum',token:token.toLowerCase()});
 });
 it('shows the exact indexed genesis owner and identifies the connected wallet',async()=>{
  const f=liveFixture({account:{address:wallet}});await f.ui.setMarket(market);
  expect(f.state.textContent).toBe('Already in the collection');expect(f.owner.textContent).toContain('Genesis edition owner · '+wallet);expect(f.owner.textContent).toContain('Your wallet');expect(f.note.textContent).toContain('index');expect(f.browse.href).toBe('https://collections.example/app/nft/'+address+'/1');
 });
 it('does not interpret an absent collection in a capped index as untokenized',async()=>{
  const f=liveFixture({rows:[]});await f.ui.setMarket(market);expect(f.state.textContent).toBe('Collection status unavailable');expect(f.browse.textContent).toBe('Browse collection');expect(f.owner.hidden).toBe(true);
 });
 it('rejects mismatching detail identity and does not show a fabricated owner',async()=>{
  const f=liveFixture({details:{collection:{...collection,chain:'base'},editions:[{edition:1,collection:address,owner:wallet}]}});await f.ui.setMarket(market);
  expect(f.state.textContent).toBe('Collection status unavailable');expect(f.owner.hidden).toBe(true);expect(f.browse.textContent).toBe('Browse collection');
 });
 it('keeps ownership unavailable for a zero owner',async()=>{
  const f=liveFixture({details:{collection,editions:[{collection:address,edition:1,owner:'0x'+'0'.repeat(40)}]}});await f.ui.setMarket(market);expect(f.owner.hidden).toBe(true);expect(f.note.textContent).toContain('owner is unavailable');
 });
 it('does not let an older delayed response overwrite a newly selected coin',async()=>{
  let release;const waiting=new Promise(resolve=>{release=resolve;});
  const f=fixture({api:'/api/',fetch:vi.fn(async url=>String(url).endsWith('/config')?waiting:String(url).endsWith('/collections')?json([collection]):json({collection,editions:[]}))});
  const first=f.ui.setMarket(market),second=f.ui.setMarket({...market,chainId:'base'});release(json(config));await Promise.all([first,second]);expect(f.state.textContent).toBe('Collection status unavailable');expect(f.owner.hidden).toBe(true);
 });
 it('removes its wallet subscription and ignores updates after close',async()=>{const f=fixture();f.ui.close();await f.ui.setMarket(market);expect(f.unsubscribe).toHaveBeenCalledTimes(1);expect(f.fetch).not.toHaveBeenCalled();expect(f.player.contains(f.panel)).toBe(false);});
});
