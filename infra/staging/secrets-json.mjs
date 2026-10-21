#!/usr/bin/env node
// Prints a `wrangler secret bulk` JSON object from every non-empty S_<NAME> environment variable.
// Secrets are passed through the environment so they never appear on a command line or in logs.
const out={};
for(const [key,value] of Object.entries(process.env))if(key.startsWith('S_')&&value)out[key.slice(2)]=value;
process.stdout.write(JSON.stringify(out));
