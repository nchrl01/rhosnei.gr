// Vendor the official browser build, including its dependency notices.
// It runs in a dedicated worker and is loaded only for exchange searches.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
const meta=JSON.parse(await readFile('node_modules/ccxt/package.json','utf8'));
await mkdir('public/vendor/ccxt',{recursive:true});
await copyFile('node_modules/ccxt/dist/ccxt.browser.min.js','public/vendor/ccxt/ccxt.browser.min.js');
await copyFile('node_modules/ccxt/dist/ccxt.browser.min.js.LICENSE.txt','public/vendor/ccxt/ccxt.browser.min.js.LICENSE.txt');
await copyFile('node_modules/ccxt/LICENSE.txt','public/vendor/ccxt/LICENSE.txt');
await writeFile('public/vendor/ccxt/SOURCE.txt',`CCXT ${meta.version}\nhttps://github.com/ccxt/ccxt\nUnmodified official browser build from the pinned npm package.\nMIT license; see LICENSE.txt and ccxt.browser.min.js.LICENSE.txt.\nUPIC enables Kraken, Coinbase Exchange and Binance spot public feeds.\nLoaded on demand in a Web Worker. No credentials or order methods are used.\nReproduce: npm ci --ignore-scripts && node scripts/build-ccxt.mjs\n`);
