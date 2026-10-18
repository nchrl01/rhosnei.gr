"""Refresh the public catalogue with bounded CoinGecko requests. No browser API fan-out.
Use --input-dir to rebuild from previously downloaded API responses.
"""
import argparse, json, pathlib, re, subprocess, tempfile, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--input-dir');args=parser.parse_args()
raw=pathlib.Path(args.input_dir) if args.input_dir else pathlib.Path(tempfile.mkdtemp(prefix='upic-catalogue-'))
raw.mkdir(exist_ok=True)
def fetch(url,name):
 target=raw/name
 if args.input_dir:return json.loads(target.read_text())
 body=subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','40',url]);value=json.loads(body);target.write_bytes(body);return value
markets=[]
for page in range(1,5):
 markets.extend(fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page='+str(page)+'&sparkline=false','markets-'+str(page)+'.json'))
 if not args.input_dir:time.sleep(7)
if len({m['id'] for m in markets})<1000:
 markets.extend(fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=5&sparkline=false','markets-5.json'))
 if not args.input_dir:time.sleep(7)
contracts={r['id']:r.get('platforms',{}) for r in fetch('https://api.coingecko.com/api/v3/coins/list?include_platform=true','contracts.json')}
if not args.input_dir:time.sleep(7)
trending=fetch('https://api.coingecko.com/api/v3/search/trending','trending.json')
trends={r['item']['id']:i+1 for i,r in enumerate(trending.get('coins',[]))}
aliases={'binance-smart-chain':'bsc','polygon-pos':'polygon','arbitrum-one':'arbitrum','avalanche':'avalanche','optimistic-ethereum':'optimism','zksync':'zksync','tron':'tron','ethereum':'ethereum','solana':'solana','base':'base','ronin':'ronin','fantom':'fantom','celo':'celo','cronos':'cronos','sui':'sui','aptos':'aptos','near-protocol':'near','ton':'ton','hedera-hashgraph':'hedera'}
priority=['ethereum','solana','base','bsc','arbitrum','polygon','avalanche','optimism']
natives={'bitcoin':'bitcoin','ethereum':'ethereum','solana':'solana','binancecoin':'bsc','ripple':'xrp','dogecoin':'dogecoin','cardano':'cardano','tron':'tron','avalanche-2':'avalanche','sui':'sui','the-open-network':'ton','polkadot':'polkadot','litecoin':'litecoin','monero':'monero','stellar':'stellar','near':'near','aptos':'aptos','bitcoin-cash':'bitcoin-cash','ethereum-classic':'ethereum-classic','cosmos':'cosmos','hedera-hashgraph':'hedera'}
now=int(max(p.stat().st_mtime for p in raw.glob('markets-*.json'))*1000);coins=[];seen=set()
for m in markets:
 if m['id'] in seen:continue
 seen.add(m['id']);platforms=[]
 for platform,address in contracts.get(m['id'],{}).items():
  chain=aliases.get(platform)
  if chain and isinstance(address,str) and (re.fullmatch(r'0x[0-9a-fA-F]{40}',address) or chain=='solana' and re.fullmatch(r'[1-9A-HJ-NP-Za-km-z]{32,44}',address)):
   platforms.append({'chain':chain,'address':address.lower() if address.startswith('0x') else address})
 platforms.sort(key=lambda p:priority.index(p['chain']) if p['chain'] in priority else 99)
 primary=platforms[0] if platforms else {'chain':natives.get(m['id'],'unknown'),'address':None}
 key=primary['chain']+':'+primary['address'] if primary['address'] else 'coingecko:'+m['id']
 coins.append({'key':key,'id':m['id'],'symbol':m['symbol'].upper(),'name':m['name'],**primary,'platforms':platforms[:5],'query':m['name'] if primary['chain']=='unknown' else m['symbol'].upper()+'/USD','image':m['image'],'marketCap':m.get('market_cap'),'rank':m.get('market_cap_rank'),'volume':m.get('total_volume'),'change':m.get('price_change_percentage_24h'),'marketAt':int(__import__('datetime').datetime.fromisoformat(m['last_updated'].replace('Z','+00:00')).timestamp()*1000) if m.get('last_updated') else now,'trendingRank':trends.get(m['id']),'top1000':True,'source':'CoinGecko'})
coins.sort(key=lambda c:c.get('marketCap') or 0,reverse=True)
coins=coins[:1000]
for index,c in enumerate(coins):c['catalogueRank']=index+1
if len(coins)!=1000:raise SystemExit('Expected exactly 1,000 distinct coins; refusing incomplete refresh: '+str(len(coins)))
# Explicitly requested emerging token. Resolve by its independently checked CA,
# never by taking the first similarly named search result.
address='GTBxUiw6wJdmmkCGZgRHLyYxqu1vG4KtRpeox6yDpump'
pairs=fetch('https://api.dexscreener.com/latest/dex/search?q=jean%20phil','jean-phil.json').get('pairs',[])
pairs=[p for p in pairs if p.get('chainId')=='solana' and p.get('baseToken',{}).get('address')==address]
if pairs:
 pair=max(pairs,key=lambda p:p.get('liquidity',{}).get('usd',0));key='solana:'+address
 existing=next((c for c in coins if c['key']==key),None)
 if existing:existing.update(featured=True,emerging=True)
 else:coins.append({'key':key,'id':'jean-phil','chain':'solana','address':address,'platforms':[{'chain':'solana','address':address}],'symbol':'JEANPHIL','name':'Jean Phil','image':pair.get('info',{}).get('imageUrl'),'marketCap':pair.get('marketCap'),'volume':pair.get('volume',{}).get('h24'),'liquidity':pair.get('liquidity',{}).get('usd'),'change':pair.get('priceChange',{}).get('h24'),'marketAt':int((raw/'jean-phil.json').stat().st_mtime*1000),'source':'DexScreener','top1000':False,'featured':True,'emerging':True})
data={'asOf':now,'ranking':'current-market-cap','source':'CoinGecko','trendingSource':'CoinGecko trending searches; explicitly featured emerging tokens','coins':coins}
path=ROOT/'apps/web/public/marketplace-coin-catalogue.json';path.write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False)+'\n');print('Wrote',len(coins),'coins,',sum(bool(c.get('trendingRank') or c.get('featured')) for c in coins),'trending / featured entries')
