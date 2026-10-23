// Operator-run browser checks. Start the app yourself; no server is started here.
import {describe,it,expect} from 'vitest';
import {chromium} from 'playwright';
const url=process.env.UPIC_BROWSER_TEST_URL;
describe.skipIf(!url)('browser flows',()=>{
 it('offers a cached preview without requiring a wallet or a live subscription',async()=>{
  if(!['localhost','127.0.0.1'].includes(new URL(url!).hostname))throw Error('Browser smoke checks require the local app');
  const browser=await chromium.launch({headless:true});
  try{
   const page=await browser.newPage();
   const address='0x'+'11'.repeat(20);
   const deployment={chainId:31337,mode:'local',factory:address,upic:address,vault:address,marketplace:address,buyback:address,router:address,startBlock:0,engineVersion:'upic-nft-gb-v2'};
   let streamRequests=0;
   page.on('websocket',()=>streamRequests++);
   await page.route('**/v1/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const json=path.endsWith('/config')?{deployment,gateway:'http://localhost:8080',appURL:url}:path.endsWith('/discover')?[{chain:'ethereum',token:address,name:'Sample',symbol:'SAMPLE',frame:{chain:'ethereum',token:address,at:0,priceUsd:'0.6',marketCapUsd:'600000',liquidityUsd:'1200000',volumeUsd:'100',source:'cached',stale:false,simulated:false}}]:[];
    await route.fulfill({json});
   });
   await page.goto(url!);
   await page.getByRole('button',{name:'explore',exact:true}).click();
   await page.getByLabel('Token name or address').fill('Sample');
   await page.getByRole('button',{name:'Search',exact:true}).click();
   await page.getByRole('button',{name:/Sample · SAMPLE/}).click();
   await page.getByRole('button',{name:'Play 20-second preview'}).waitFor();
   expect(await page.locator('canvas').count()).toBe(1);
   expect(await page.getByText(/preview seed differs/).isVisible()).toBe(true);
   expect(streamRequests).toBe(0);
  }finally{await browser.close();}
 },30000);
});
