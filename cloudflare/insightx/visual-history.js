// Archive only authenticated captures of catalogue coins, never browser uploads.
import {captureIdentity} from './coin-captures.js';
const RETENTION=30*86400000,MAX_BYTES=128*1024*1024,MAX_FRAMES=10000;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export class VisualHistory{
 constructor(sql){this.sql=sql;sql.exec('CREATE TABLE IF NOT EXISTS visual_history (key TEXT NOT NULL,captured INTEGER NOT NULL,metadata TEXT NOT NULL,image BLOB NOT NULL,bytes INTEGER NOT NULL,PRIMARY KEY(key,captured))');}
 record(metadata,bytes){
  const now=Date.now();
  this.sql.exec('INSERT OR IGNORE INTO visual_history(key,captured,metadata,image,bytes) VALUES(?,?,?,?,?)',metadata.key,metadata.capturedAt,JSON.stringify(metadata),bytes.buffer,bytes.length);
  this.sql.exec('DELETE FROM visual_history WHERE captured<?',now-RETENTION);
  const rows=this.sql.exec('SELECT key,captured,bytes FROM visual_history ORDER BY captured DESC').toArray();let total=0;
  for(let i=0;i<rows.length;i++){total+=rows[i].bytes;if(i>=MAX_FRAMES||total>MAX_BYTES)this.sql.exec('DELETE FROM visual_history WHERE key=? AND captured=?',rows[i].key,rows[i].captured);}
 }
 fetch(url){
  const identity=captureIdentity(url.searchParams.get('network'),url.searchParams.get('address'));if(!identity)return json({error:'Unknown catalogue identity'},404);
  const now=Date.now(),oldest=now-RETENTION;
  if(url.pathname==='/visual-history/image'){
   const at=Number(url.searchParams.get('at'));if(!Number.isSafeInteger(at)||at<oldest||at>now+1000)return json({error:'Invalid frame timestamp'},400);
   const row=this.sql.exec('SELECT image FROM visual_history WHERE key=? AND captured=?',identity.key,at).toArray()[0];
   return row?new Response(row.image,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}}):json({error:'Recorded frame not found'},404);
  }
  const rows=this.sql.exec('SELECT captured,metadata FROM visual_history WHERE key=? AND captured>=? ORDER BY captured LIMIT 10000',identity.key,oldest).toArray();
  return json({version:1,kind:'recorded-live-frames',retentionDays:30,capacityBytes:MAX_BYTES,frames:rows.map(row=>{const m=JSON.parse(row.metadata);return {chain:identity.chain,address:identity.address,capturedAt:row.captured,source:m.source};})});
 }
}
