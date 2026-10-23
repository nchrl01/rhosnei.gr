import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,it,expect} from 'vitest';
import {supportedCoinNetwork} from '../public/coin-network-choice.js';
import {collectiblePreview,contractPlayerURL} from '../public/collectible-selection.js';
const source=readFileSync(new URL('../public/marketplace.js',import.meta.url),'utf8');
const render=source.slice(source.indexOf('function render('),source.indexOf('const networkIcons='));
const catalogue=JSON.parse(readFileSync(new URL('../public/marketplace-coin-catalogue.json',import.meta.url),'utf8'));
class Node{
 constructor(tag='div',text='',className=''){Object.assign(this,{tag,textContent:text,className,children:[],attributes:{},style:{},hidden:false});this.classList={toggle(){}};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 addEventListener(){}
 setAttribute(name,value){this.attributes[name]=value;}
 getAttribute(name){return this.attributes[name]??null;}
 hasAttribute(name){return name in this.attributes;}
 removeAttribute(name){delete this.attributes[name];}
 querySelector(selector){for(const child of this.children){if(selector[0]==='.'?child.className===selector.slice(1):child.tag===selector)return child;const nested=child.querySelector(selector);if(nested)return nested;}return null;}
}
describe('marketplace gallery',()=>{
 it('renders the first 40 cards and appends all 100 without a missing-name crash',()=>{
  const grid=new Node(),count=new Node(),more=new Node(),empty=new Node();
  const context=vm.createContext({records:catalogue.coins.filter(c=>c.top1000).sort((a,b)=>b.marketCap-a.marketCap).slice(0,100),network:{value:'all'},visible:40,grid,count,more,cardUpdates:new Map(),supportedCoinNetwork,collectiblePreview,coinPlayerURL:contractPlayerURL,rememberRecentCoin(){},element:(...args)=>new Node(...args),money:()=> '—',$:()=>empty});
  vm.runInContext(render+';render();',context);
  expect(grid.children).toHaveLength(40);expect(count.textContent).toBe('100 coins');
  expect(grid.children[0].children[0].querySelector('.coin-full-name').textContent).toBeTruthy();
  vm.runInContext('visible=100;render(true);',context);expect(grid.children).toHaveLength(100);
  const cards=grid.children.map(wrapper=>wrapper.children[0]);
  expect(cards.filter(c=>c.href)).toHaveLength(94);
  for(const card of cards.filter(c=>c.href)){expect(card.href).toContain('&network=');expect(card.href).not.toContain('native=');expect(card.href).not.toContain('%2FUSD');}
 });
});
