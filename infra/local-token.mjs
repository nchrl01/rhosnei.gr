import {createHmac} from 'node:crypto';
const secret='local-development-secret-only-at-least-32-characters';
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const content=encode({alg:'HS256',typ:'JWT'})+'.'+encode({role:'service_role',exp:Math.floor(Date.now()/1000)+86400*30});
process.stdout.write(content+'.'+createHmac('sha256',secret).update(content).digest('base64url')+'\n');
