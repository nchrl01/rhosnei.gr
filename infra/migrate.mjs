import {readdir,readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const args=['compose','-f','infra/compose.yml','exec','-T','postgres','psql','-U','upic','-d','upic','-v','ON_ERROR_STOP=1'];
function sql(text){const result=spawnSync('docker',args,{input:text,encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);return result.stdout;}
for(const name of (await readdir('supabase/migrations')).filter(n=>/^\d+_[a-z0-9_]+\.sql$/.test(n)).sort()){
 const exists=sql("select count(*) from public.upic_migrations where name='"+name+"';");if(/\n\s*1\s*\n/.test(exists))continue;
 sql('begin;\n'+await readFile('supabase/migrations/'+name,'utf8')+"\ninsert into public.upic_migrations(name) values ('"+name+"');\ncommit;");process.stdout.write('Applied '+name+'\n');
}
sql("notify pgrst, 'reload schema';");
