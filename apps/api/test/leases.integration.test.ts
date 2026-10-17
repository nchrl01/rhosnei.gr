import {describe,it,expect} from 'vitest';import {DB} from '../src/db';import type {Env} from '../src/env';
const enabled=Boolean(process.env.UPIC_DB_TEST_TOKEN);
describe.skipIf(!enabled)('local Postgres transactional leases',()=>{
 const url=process.env.UPIC_DB_TEST_URL||'http://127.0.0.1:54321';
 if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Database integration tests require a local database');
 const db=new DB({POSTGREST_URL:url,POSTGREST_TOKEN:process.env.UPIC_DB_TEST_TOKEN} as Env);
 it('leases a job to one worker and rejects a forged completion',async()=>{
  const key='lease-test:'+crypto.randomUUID(),id=await db.rpc<string>('upic_job_enqueue',{p_kind:'render',p_key:key,p_payload:{test:true}});
  // Run in a dedicated local database with no active renderer or queued jobs.
  const jobs=await Promise.all([db.rpc<any[]>('upic_job_take',{p_kind:'render',p_seconds:300}),db.rpc<any[]>('upic_job_take',{p_kind:'render',p_seconds:300})]);
  const claimed=jobs.flat().filter(j=>j.id===id);expect(claimed).toHaveLength(1);
  expect(await db.rpc('upic_job_finish',{p_id:id,p_lease:crypto.randomUUID(),p_result:{},p_error:null})).toBe(false);
  expect(await db.rpc('upic_job_finish',{p_id:id,p_lease:claimed[0].lease_token,p_result:{ok:true},p_error:null})).toBe(true);
  await db.call('upic_jobs?id=eq.'+id,undefined,'DELETE');
 });
});
