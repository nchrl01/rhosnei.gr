import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,expect,it,vi} from 'vitest';
import {searchNetworks} from '../public/network-marks.js';

// Run the production saved-list handlers without starting feeds or the player.
const source=readFileSync(new URL('../public/mobile-search.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf(' function selectSaved('),source.indexOf(' function paintRecent('));
const networkHandler=source.slice(source.indexOf(' function paintNetworks(){'),source.indexOf(' function paint(){'));
const paintHandler=source.slice(source.indexOf(' function paint(){'),source.indexOf(' function setCategory('));
const categoryHandler=source.slice(source.indexOf(' function setCategory('),source.indexOf(' for(const [key,label]'));
const dex={key:'ethereum:0x123',source:'dex',symbol:'TEST',name:'Test coin',chain:'ethereum',address:'0x123',query:'0x123'};
const native={key:'cex:kraken:ETH/USD:native:ethereum',source:'ccxt',symbol:'ETH',name:'Ethereum',chain:'exchange',query:'cex:kraken:ETH/USD',exchangeId:'kraken',exchangeSymbol:'ETH/USD',nativeId:'ethereum'};

function fixture(initial=[dex,native]){
 const document={activeElement:null,dispatchEvent:vi.fn()};
 class Element{
  constructor(tag,text='',cls=''){this.tagName=tag;this.textContent=text;this.className=cls;this.children=[];this.dataset={};this.attributes={};this.events={};this.value='';this.classList={contains:value=>this.className.split(' ').includes(value)};}
  get childElementCount(){return this.children.length;}
  get options(){return this.children;}
  append(...nodes){for(const child of nodes){child.parent=this;this.children.push(child);}}
  after(child){const siblings=this.parent.children;child.parent=this.parent;siblings.splice(siblings.indexOf(this)+1,0,child);}
  replaceChildren(){this.children=[];}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,callback){this.events[type]=callback;}
  dispatchEvent(event){this.events[event.type]?.(event);return true;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.classList.contains(selector.slice(1))?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  contains(target){return this===target||this.children.some(child=>child.contains(target));}
  focus(){document.activeElement=this;}
 }
 const context=vm.createContext({
  document,Event,CustomEvent,searchNetworks,rows:[...initial],input:new Element('input'),
  desktop:true,desktopOpen:true,desktopPanel:new Element('section'),desktopSaved:new Element('section'),dialog:{open:true,dataset:{}},mobile:{matches:true},open:vi.fn(),
  tabs:new Element('div'),category:'coins',visible:30,network:new Element('select'),filters:new Element('button'),results:new Element('div'),catalogue:[],trending:[],
  filterPanel:new Element('div'),filterNodes:[],recent:new Element('section'),chips:new Element('div'),suggestions:new Element('div'),status:new Element('p'),more:new Element('button'),
  node:(tag,text,cls)=>new Element(tag,text,cls),
  iconButton:(label,icon,cls)=>{const button=new Element('button','',cls);button.setAttribute('aria-label',label);return button;},
  rememberRecentCoin:vi.fn(),paintRecent:vi.fn(),paintDesktop:vi.fn(),paint:vi.fn(),close:vi.fn(),
  load:vi.fn(),loadTrending:vi.fn(),loadSavedCoins:vi.fn(async()=>[]),signInSavedCoins:vi.fn(async()=>{}),savedCoinsState:()=>({status:'ready',account:{address:'0xabc'}}),coinOnNetwork:vi.fn(()=>{throw Error('Saved coins must keep their network');}),
 });
 context.savedCoins=()=>context.rows;
 context.removeSavedCoin=vi.fn(key=>{context.rows=context.rows.filter(row=>row.key!==key);});
 context.network.value='all';context.filters.open=false;
 const all=new Element('option','All networks');all.value='all';context.network.append(all);
 for(const key of ['coins','trending','saved']){const button=new Element('button');button.dataset.category=key;context.tabs.append(button);}
 vm.runInContext(networkHandler+helpers+categoryHandler,context);
 return {context,document,container:new Element('section')};
}

describe('saved search lists',()=>{
 it('shares real local Sui, XDC and KCC logos without requiring native metadata',()=>{
  const networks=searchNetworks([{chain:'sui'},{chain:'xdc'},{chain:'kcc'}]);
  expect(Object.fromEntries(networks.map(row=>[row.chain,row.image]))).toEqual({sui:'images/networks/sui.png',xdc:'images/networks/xdc.png',kcc:'images/networks/kcc.png'});
  for(const row of networks)expect(readFileSync(new URL('../public/'+row.image,import.meta.url)).length).toBeGreaterThan(100);
 });
 it('filters saved identity locally by address, network, symbol and exchange venue',()=>{
  const {context:c}=fixture();
  for(const [query,key] of [['0X123',dex.key],['TEST',dex.key],['kraken',native.key],['ETH/USD',native.key]]){
   c.input.value=query;expect(c.matchingSaved().map(coin=>coin.key)).toEqual([key]);
  }
  c.input.value='ethereum';expect(c.matchingSaved()).toHaveLength(2);
 });
 it('selects the stored native market directly without applying the discovery network',()=>{
  const {context:c,document}=fixture();c.selectSaved(native);
  expect(c.coinOnNetwork).not.toHaveBeenCalled();expect(c.close).toHaveBeenCalledWith(false);
  expect(c.desktopOpen).toBe(false);expect(c.rememberRecentCoin).toHaveBeenCalledWith(native);
  expect(document.dispatchEvent.mock.calls[0][0]).toMatchObject({type:'upic:search-coin',detail:native});
 });
 it('offers Show all when a prefilled query hides saved coins',()=>{
  const {context:c,container}=fixture();c.input.value='does-not-match';c.renderSaved(container,{desktop:true});
  expect(container.querySelectorAll('.saved-search-row')).toHaveLength(0);
  expect(container.querySelector('.saved-search-empty').textContent).toContain('No saved coins match');
  container.querySelector('.saved-search-show-all').events.click();expect(c.input.value).toBe('');
  c.renderSaved(container,{desktop:true});expect(container.querySelectorAll('.saved-search-row')).toHaveLength(2);
 });
 it('removes bookmarks using their key and keeps keyboard focus on the next remove button',async()=>{
  const {context:c,document,container}=fixture();c.renderSaved(container);
  container.querySelector('.saved-search-remove').focus();await container.querySelector('.saved-search-remove').events.click();
  c.renderSaved(container);
  expect(c.removeSavedCoin).toHaveBeenCalledWith(dex.key);
  expect(document.activeElement).toBe(container.querySelector('.saved-search-remove'));
  expect(container.querySelector('.saved-search-row').dataset.key).toBe(native.key);
 });
 it('returns focus to search when the final bookmark is removed',async()=>{
  const {context:c,document,container}=fixture([dex]);c.renderSaved(container);
  container.querySelector('.saved-search-remove').focus();await container.querySelector('.saved-search-remove').events.click();c.renderSaved(container);
  expect(document.activeElement).toBe(c.input);
  expect(container.querySelector('.saved-search-empty').textContent).toContain('Save a coin');
 });
 it('shows an accessible error when bookmark removal cannot be stored',async()=>{
  const {context:c,container}=fixture();c.removeSavedCoin=vi.fn(async()=>{throw Error('Profile unavailable');});c.renderSaved(container);
  await container.querySelector('.saved-search-remove').events.click();
  expect(container.querySelector('.saved-search-empty')).toMatchObject({textContent:'Profile unavailable',attributes:{role:'alert'}});
 });
 it('opens the Saved mobile tab with all bookmarks and no catalogue or capture request',()=>{
  const {context:c}=fixture();c.input.value='current-token';c.setCategory('saved');
  expect(c.category).toBe('saved');expect(c.input.value).toBe('');
  expect(c.tabs.children.map(button=>button.attributes['aria-pressed'])).toEqual(['false','false','true']);
  expect(c.load).not.toHaveBeenCalled();expect(c.loadTrending).not.toHaveBeenCalled();expect(c.loadSavedCoins).toHaveBeenCalled();expect(c.paint).toHaveBeenCalled();
 });
 it('keeps signed-out search free of private rows and sign-in panels',()=>{
  const {context:c,container}=fixture();c.savedCoinsState=()=>({status:'signed-out'});c.renderSaved(container);
  expect(container.children).toHaveLength(0);
  c.setCategory('saved');expect(c.category).toBe('coins');
  expect(c.signInSavedCoins).not.toHaveBeenCalled();expect(c.loadSavedCoins).not.toHaveBeenCalled();
 });
 it('renders loading and retry states for the authenticated profile',async()=>{
  const {context:c,container}=fixture();c.savedCoinsState=()=>({status:'loading',account:{address:'0xabc'}});c.renderSaved(container);
  expect(container.querySelectorAll('.saved-search-row')).toHaveLength(0);
  expect(container.querySelector('.saved-search-empty').textContent).toBe('Loading saved coins…');
  c.savedCoinsState=()=>({status:'error',error:'Connection interrupted',account:{address:'0xabc'}});c.renderSaved(container);
  expect(container.querySelector('.saved-search-empty').textContent).toBe('Connection interrupted');
  await container.querySelector('.saved-search-action').events.click();expect(c.loadSavedCoins).toHaveBeenCalledTimes(1);
 });
 it('keeps category tabs and filters present when live results replace local suggestions',()=>{
  const {context:c}=fixture();c.input.value='ETH';c.results.hidden=false;c.tabs.hidden=true;
  c.filterPanel.append(c.node('label'));vm.runInContext(paintHandler,c);c.paint();
  expect(c.tabs.hidden).toBe(false);expect(c.filters.hidden).toBe(false);expect(c.suggestions.hidden).toBe(true);expect(c.status.hidden).toBe(true);
 });
 it('keeps existing rows and focus stable while a signed-in profile refreshes',()=>{
  const {context:c,container,document}=fixture();c.renderSaved(container);const row=container.querySelector('.saved-search-row');const remove=row.querySelector('.saved-search-remove');remove.focus();c.savedCoinsState=()=>({status:'loading',account:{address:'0xabc'}});c.renderSaved(container);
  expect(container.querySelector('.saved-search-row')).toBe(row);expect(document.activeElement).toBe(remove);expect(container.attributes['aria-busy']).toBe('true');
 });
 it('leaves live results when changing the search category and closes filters',()=>{
  const {context:c}=fixture();c.results.hidden=false;c.filters.open=true;c.setCategory('trending');
  expect(c.results.hidden).toBe(true);expect(c.filters.open).toBe(false);expect(c.category).toBe('trending');
 });
 it('uses actual represented network images and omits unrelated or missing network artwork',()=>{
  const {context:c}=fixture();c.catalogue=[{chain:'ethereum',platforms:[{chain:'base'}]},{chain:'no-image-chain'}];c.paintNetworks();
  expect(c.filterPanel.children.map(button=>button.dataset.chain)).toEqual(['all','ethereum','base']);
  expect(c.filterPanel.children[1].children[0].src).toBe('images/networks/ethereum.svg');
  expect(c.filterPanel.children[2].attributes['aria-label']).toBe('Base');
  expect(c.filterPanel.children.filter(button=>button.dataset.chain==='all')).toHaveLength(1);
 });
 it('includes a native network logo and retains selection without exposing a sort control',()=>{
  const {context:c}=fixture();c.catalogue=[{chain:'bitcoin',nativeChain:'bitcoin',nativeChains:['bitcoin'],contractStatus:'native',name:'Bitcoin',image:'https://images.example/btc.png'}];c.filters.open=true;c.paintNetworks();
  const button=c.filterPanel.children[1];c.network.events.change=vi.fn();button.events.click();c.paintNetworks();
  expect(c.network.value).toBe('bitcoin');expect(c.network.events.change).toHaveBeenCalledOnce();
  expect(button.attributes['aria-pressed']).toBe('true');expect(c.filterPanel.children[0].attributes['aria-pressed']).toBe('false');
  expect(button.children[0].src).toBe('https://images.example/btc.png');
  expect(c.filterPanel.children.every(control=>control.tagName==='button')).toBe(true);
  expect(source).not.toContain("node('option','Sort')");
  expect(source).not.toContain("order.addEventListener");
 });
 it('expands the network row inline and hides it for Saved while retaining its buttons',()=>{
  const {context:c}=fixture();c.catalogue=[{chain:'solana'}];c.paintNetworks();const button=c.filterPanel.children[1];
  expect(c.filterPanel.hidden).toBe(true);expect(c.filters.attributes['aria-expanded']).toBe('false');
  c.filters.open=true;c.paintNetworks();expect(c.filterPanel.hidden).toBe(false);expect(c.filters.attributes['aria-expanded']).toBe('true');
  c.category='saved';c.paintNetworks();expect(c.filters.hidden).toBe(true);expect(c.filterPanel.hidden).toBe(true);expect(c.filterPanel.children[1]).toBe(button);
 });
});
