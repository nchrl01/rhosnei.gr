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
aliases={'binance-smart-chain':'bsc','polygon-pos':'polygon','arbitrum-one':'arbitrum','avalanche':'avalanche','optimistic-ethereum':'optimism','zksync':'zksync','tron':'tron','ethereum':'ethereum','solana':'solana','base':'base','ronin':'ronin','fantom':'fantom','celo':'celo','cronos':'cronos','sui':'sui','aptos':'aptos','near-protocol':'near','ton':'ton','hedera-hashgraph':'hedera','robinhood':'robinhood','the-open-network':'ton','xdai':'gnosis','harmony-shard-0':'harmony','hyperevm':'hyperevm','plume-network':'plume','morph-l2':'morph','klay-token':'kaia','sei-v2':'seiv2'}
priority=['ethereum','solana','base','bsc','arbitrum','polygon','avalanche','optimism']
natives={'bitcoin':'bitcoin','ethereum':'ethereum','solana':'solana','binancecoin':'bsc','ripple':'xrp','dogecoin':'dogecoin','cardano':'cardano','tron':'tron','avalanche-2':'avalanche','sui':'sui','the-open-network':'ton','polkadot':'polkadot','litecoin':'litecoin','monero':'monero','stellar':'stellar','near':'near','aptos':'aptos','bitcoin-cash':'bitcoin-cash','ethereum-classic':'ethereum-classic','cosmos':'cosmos','hedera-hashgraph':'hedera','robinhood':'robinhood','the-open-network':'ton','xdai':'gnosis','harmony-shard-0':'harmony','hyperevm':'hyperevm','plume-network':'plume','morph-l2':'morph','klay-token':'kaia','sei-v2':'seiv2'}
aliases.update({'vaulta':'eos','multiversx':'elrond'})
contract_source='https://api.coingecko.com/api/v3/coins/list?include_platform=true'
override_file=ROOT/'scripts/data/catalogue-identity-overrides.json'
override_data=json.loads(override_file.read_text())
overrides={entry['id']:entry for entry in override_data['coins']}
if len(overrides)!=len(override_data['coins']):raise SystemExit('Duplicate immutable asset IDs in identity overrides')

def identifier_key(platform):
 address=platform['address']
 return platform['chain'],address.lower() if re.fullmatch(r'0x[0-9a-fA-F]{40}',address) else address

def identity(coin_id):
 """Merge provider identifiers and reviewed exact-ID evidence without ticker guesses."""
 override=overrides.get(coin_id,{})
 platforms=[]
 for platform,address in contracts.get(coin_id,{}).items():
  if isinstance(address,str) and address and len(address)<=256 and not re.search(r'[\s<>"\\]',address):
   platforms.append({'chain':aliases.get(platform,platform),'platform':platform,'address':address.lower() if re.fullmatch(r'0x[0-9a-fA-F]{40}',address) else address})
 by_identifier={identifier_key(p):p for p in platforms}
 for reviewed in override.get('platforms',[]):
  platform=dict(reviewed);platform['chain']=aliases.get(platform['chain'],platform['chain'])
  address=platform.get('address')
  if not isinstance(address,str) or not address or len(address)>256 or re.search(r'[\s<>"\\]',address):
   raise SystemExit('Invalid reviewed identifier for '+coin_id)
  key=identifier_key(platform)
  if key in by_identifier:
   existing=by_identifier[key]
   existing.update({k:v for k,v in platform.items() if k not in ('chain','platform','address')})
  else:
   platforms.append(platform);by_identifier[key]=platform
 platforms.sort(key=lambda p:priority.index(p['chain']) if p['chain'] in priority else 99)
 native_chain=override.get('nativeChain') or natives.get(coin_id)
 native_chain=aliases.get(native_chain,native_chain)
 native_chains=list(dict.fromkeys(aliases.get(c,c) for c in [native_chain,*override.get('nativePlatformIDs',[])] if c))
 classification=override.get('classification')
 if classification=='off-chain':
  if platforms:raise SystemExit('Off-chain override conflicts with published identifiers for '+coin_id+'; review required')
  status='off-chain';primary={'chain':'off-chain','address':None}
 elif native_chain:
  status='native-with-identifier' if platforms else 'native'
  primary={'chain':native_chain,'address':None}
 else:
  status='source-listed' if platforms else 'not-indexed'
  primary=dict(platforms[0]) if platforms else {'chain':'unknown','address':None}
 sources=list(dict.fromkeys([contract_source,*override.get('sourceURLs',[]),*(source for p in platforms for source in p.get('sourceURLs',[]))]))
 result={**primary,'platforms':platforms,'contractStatus':status,'contractSource':override.get('sourceURLs',[contract_source])[0],'contractSources':sources,'contractIndexedAt':int((raw/'contracts.json').stat().st_mtime*1000)}
 if native_chain:result.update(nativeChain=native_chain,nativeChains=native_chains)
 if override:
  result.update(identityReviewedAt=override_data['reviewedAt'],identityNote=override['reason'])
  if override.get('nativeDenomination'):result['nativeDenomination']=override['nativeDenomination']
 return result

now=int(max(p.stat().st_mtime for p in raw.glob('markets-*.json'))*1000);coins=[];seen=set()
for m in markets:
 if m['id'] in seen:continue
 seen.add(m['id']);primary=identity(m['id'])
 key=primary['chain']+':'+primary['address'] if primary['address'] else 'coingecko:'+m['id']
 coins.append({'key':key,'id':m['id'],'symbol':m['symbol'].upper(),'name':m['name'],**primary,'query':m['name'] if primary['chain']=='unknown' else m['symbol'].upper()+'/USD','image':m['image'],'marketCap':m.get('market_cap'),'rank':m.get('market_cap_rank'),'volume':m.get('total_volume'),'change':m.get('price_change_percentage_24h'),'marketAt':int(__import__('datetime').datetime.fromisoformat(m['last_updated'].replace('Z','+00:00')).timestamp()*1000) if m.get('last_updated') else now,'trendingRank':trends.get(m['id']),'top1000':True,'source':'CoinGecko'})
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
for c in coins:
 if (c.get('marketCap') or 0)<1e6:c['trendingRank']=None;c['featured']=False
 if c.get('source')=='DexScreener' and c.get('address'):
  source='https://api.dexscreener.com/latest/dex/search?q=jean%20phil'
  c.update(contractStatus='source-listed',contractSource=source,contractSources=[source],contractIndexedAt=int((raw/'jean-phil.json').stat().st_mtime*1000))
coins=[c for c in coins if c.get('top1000') or (c.get('marketCap') or 0)>=1e6]
data={'asOf':now,'ranking':'current-market-cap','source':'CoinGecko','trendingSource':'CoinGecko trending searches; explicitly featured emerging tokens','coins':coins}
path=ROOT/'apps/web/public/marketplace-coin-catalogue.json';path.write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False)+'\n');print('Wrote',len(coins),'coins,',sum(bool(c.get('trendingRank') or c.get('featured')) for c in coins),'trending / featured entries')
statuses={status:sum(c.get('contractStatus')==status for c in coins) for status in ('source-listed','native','native-with-identifier','off-chain','not-indexed')}
audit={'indexedAt':max(c.get('contractIndexedAt',0) for c in coins),'identityReviewedAt':override_data['reviewedAt'],'source':'CoinGecko immutable asset IDs + platform index + sourced identity overrides','identityOverrides':'scripts/data/catalogue-identity-overrides.json','coins':len(coins),'classificationCounts':statuses,'primaryContractCoins':sum(bool(c.get('address')) for c in coins),'platformIdentifiers':sum(len(c.get('platforms',[])) for c in coins),'nativeCoins':[c['id'] for c in coins if c.get('contractStatus') in ('native','native-with-identifier')],'nativeWithIdentifierCoins':[c['id'] for c in coins if c.get('contractStatus')=='native-with-identifier'],'offChainCoins':[c['id'] for c in coins if c.get('contractStatus')=='off-chain'],'notIndexed':[{'id':c['id'],'symbol':c['symbol']} for c in coins if c.get('contractStatus')=='not-indexed'],'note':'Published identifiers include token contracts, native system identifiers, Move types, process IDs and denoms. They are not an independent on-chain security audit. Native defaults retain no primary token address; alternate identifiers are preserved in platforms. Off-chain products have no blockchain contract.'}
(ROOT/'scripts/data/catalogue-address-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
print('Identity coverage:',json.dumps(statuses),'identifiers:',audit['platformIdentifiers'])
