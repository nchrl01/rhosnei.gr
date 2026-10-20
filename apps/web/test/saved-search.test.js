import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,expect,it,vi} from 'vitest';

// Run the production saved-list handlers without starting feeds or the player.
const source=readFileSync(new URL('../public/mobile-search.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf(' function selectSaved('),source.indexOf(' function paintRecent('));
const categoryHandler=source.slice(source.indexOf(' function setCategory('),source.indexOf(' for(const [key,label]'));
const dex={key:'ethereum:0x123',source:'dex',symbol:'TEST',name:'Test coin',chain:'ethereum',address:'0x123',query:'0x123'};
const native={key:'cex:kraken:ETH/USD:native:ethereum',source:'ccxt',symbol:'ETH',name:'Ethereum',chain:'exchange',query:'cex:kraken:ETH/USD',exchangeId:'kraken',exchangeSymbol:'ETH/USD',nativeId:'ethereum'};

function fixture(initial=[dex,native]){
 const document={activeElement:null,dispatchEvent:vi.fn()};
 class Element{
  constructor(tag,text='',cls=''){this.tagName=tag;this.textContent=text;this.className=cls;this.children=[];this.dataset={};this.attributes={};this.events={};this.value='';this.classList={contains:value=>this.className.split(' ').includes(value)};}
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
  document,Event,CustomEvent,rows:[...initial],input:new Element('input'),
  desktop:true,desktopOpen:true,desktopSaved:new Element('section'),dialog:{open:true},
  tabs:new Element('div'),category:'coins',visible:30,network:{value:'solana'},
  node:(tag,text,cls)=>new Element(tag,text,cls),
  iconButton:(label,icon,cls)=>{const button=new Element('button','',cls);button.setAttribute('aria-label',label);return button;},
  rememberRecentCoin:vi.fn(),paintRecent:vi.fn(),paintDesktop:vi.fn(),paint:vi.fn(),close:vi.fn(),
  load:vi.fn(),loadTrending:vi.fn(),coinOnNetwork:vi.fn(()=>{throw Error('Saved coins must keep their network');}),
 });
 context.savedCoins=()=>context.rows;
 context.removeSavedCoin=vi.fn(key=>{context.rows=context.rows.filter(row=>row.key!==key);});
 for(const key of ['coins','trending','saved']){const button=new Element('button');button.dataset.category=key;context.tabs.append(button);}
 vm.runInContext(helpers+categoryHandler,context);
 return {context,document,container:new Element('section')};
}

describe('saved search lists',()=>{
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
 it('removes bookmarks using their key and keeps keyboard focus on the next remove button',()=>{
  const {context:c,document,container}=fixture();c.renderSaved(container);
  container.querySelector('.saved-search-remove').focus();container.querySelector('.saved-search-remove').events.click();
  c.renderSaved(container);
  expect(c.removeSavedCoin).toHaveBeenCalledWith(dex.key);
  expect(document.activeElement).toBe(container.querySelector('.saved-search-remove'));
  expect(container.querySelector('.saved-search-row').dataset.key).toBe(native.key);
 });
 it('returns focus to search when the final bookmark is removed',()=>{
  const {context:c,document,container}=fixture([dex]);c.renderSaved(container);
  container.querySelector('.saved-search-remove').focus();container.querySelector('.saved-search-remove').events.click();c.renderSaved(container);
  expect(document.activeElement).toBe(c.input);
  expect(container.querySelector('.saved-search-empty').textContent).toContain('Save a coin');
 });
 it('shows an accessible error when bookmark removal cannot be stored',()=>{
  const {context:c,container}=fixture();c.removeSavedCoin=vi.fn(()=>{throw Error('Storage unavailable');});c.renderSaved(container);
  container.querySelector('.saved-search-remove').events.click();
  expect(container.querySelector('.saved-search-empty')).toMatchObject({textContent:'Storage unavailable',attributes:{role:'alert'}});
 });
 it('opens the Saved mobile tab with all bookmarks and no catalogue or capture request',()=>{
  const {context:c}=fixture();c.input.value='current-token';c.setCategory('saved');
  expect(c.category).toBe('saved');expect(c.input.value).toBe('');
  expect(c.tabs.children.map(button=>button.attributes['aria-pressed'])).toEqual(['false','false','true']);
  expect(c.load).not.toHaveBeenCalled();expect(c.loadTrending).not.toHaveBeenCalled();expect(c.paint).toHaveBeenCalled();
 });
});
