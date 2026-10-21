#!/usr/bin/env node
// Renders infra/staging/wrangler.generated.json from the template plus CI-only values, so
// staging hostnames, Access identifiers and optional bindings never need to be committed.
// Usage: node infra/staging/render-config.mjs --access-team <team>.cloudflareaccess.com --access-aud <aud> [--no-api] [--name pv-gate]
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),flag=name=>args.includes('--'+name),value=name=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:undefined;};
const template=readFileSync(join(here,'wrangler.jsonc'),'utf8').split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
const config=JSON.parse(template);
if(value('name'))config.name=value('name');
if(flag('no-api'))config.services=config.services.filter(s=>s.binding!=='API');
config.vars={...config.vars};
if(value('access-team'))config.vars.ACCESS_TEAM_DOMAIN=value('access-team');
if(value('access-aud'))config.vars.ACCESS_AUD=value('access-aud');
if(value('capture-source')!==undefined)config.vars.CAPTURE_SOURCE=value('capture-source');
if(config.vars.REQUIRE_ACCESS==='true'&&(!config.vars.ACCESS_TEAM_DOMAIN||!config.vars.ACCESS_AUD)&&!flag('allow-open'))
 throw Error('Refusing to render a staging gateway without Access verification (pass --access-team and --access-aud).');
writeFileSync(join(here,'wrangler.generated.json'),JSON.stringify(config,null,2)+'\n');
console.log(`Rendered ${config.name}: services=${config.services.map(s=>s.binding).join(',')} access=${Boolean(config.vars.ACCESS_AUD)}`);
