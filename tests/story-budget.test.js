import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createBudgetCoordinator } from '../src/worker/story-budget.js';
function storage(db=new DatabaseSync(':memory:')) { return {sql:{exec(sql,...args){const stmt=db.prepare(sql);return {toArray:()=>stmt.all(...args)};}},transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}; }
function fixture(limits={dailyNeurons:100,pendingMs:30000}){let now=Date.parse('2026-10-27T12:00:00Z');const disk=storage();const make=()=>createBudgetCoordinator({storage:disk,now:()=>now,limits});const b=make();return {b,make,disk,setNow:t=>now=Date.parse(t),get now(){return now;}};}
const create=(b,id='s1',ip='ip')=>b.createSession({sessionRef:id,tokenHash:'token-'+id,ipHash:ip});
const request=(id='a1',rest={})=>({sessionRef:'s1',tokenHash:'token-s1',attemptId:id,requestId:'req1',payloadHash:'hash1',reservedNeurons:40,retryOf:null,ipHash:'ip',...rest});
test('SQLite durable reservation is atomic and duplicate replay never spends twice across restart',()=>{const f=fixture();create(f.b);const a=f.b.reserve(request());assert.equal(a.kind,'reserved');assert.equal(f.b.reserve(request()).code,'ATTEMPT_IN_PROGRESS');assert.equal(f.make().reserve(request()).code,'ATTEMPT_IN_PROGRESS');assert.equal(f.b.reserve(request('a1',{payloadHash:'changed'})).code,'ATTEMPT_PAYLOAD_MISMATCH');f.b.settle({sessionRef:'s1',attemptId:'a1',status:'complete',actualNeurons:null,result:{status:'ready',scene:{id:'scene'}}});assert.equal(f.make().reserve(request()).kind,'replay');assert.equal(f.b.reserve(request('a2',{requestId:'req2',reservedNeurons:61})).code,'DAILY_BUDGET_EXHAUSTED');});
test('lookup and result retention require credential, survive restart and retain entire session lifetime',()=>{const f=fixture();create(f.b);f.b.reserve(request());f.b.settle({sessionRef:'s1',attemptId:'a1',status:'complete',result:{status:'ready'}});assert.equal(f.b.lookup(request('a1',{tokenHash:'wrong'})).code,'SESSION_UNAVAILABLE');f.setNow('2026-10-28T11:59:00Z');f.b.cleanup();assert.equal(f.make().lookup(request()).kind,'replay');f.setNow('2026-10-28T12:00:01Z');assert.equal(f.b.lookup(request()).code,'SESSION_UNAVAILABLE');f.b.cleanup();assert.equal(f.b.reserve(request()).code,'SESSION_UNAVAILABLE');});
test('unknown commitments survive rollover and cleanup while old completed charges leave a finite daily policy',()=>{const f=fixture();create(f.b);f.b.reserve(request());f.b.settle({sessionRef:'s1',attemptId:'a1',status:'unknown',result:{status:'paused'}});f.b.reserve(request('a2',{requestId:'req2',reservedNeurons:60}));f.b.settle({sessionRef:'s1',attemptId:'a2',status:'complete',result:{status:'ready'}});f.setNow('2026-10-29T01:00:00Z');f.b.cleanup();create(f.b,'s2');assert.equal(f.make().reserve(request('a3',{sessionRef:'s2',tokenHash:'token-s2',reservedNeurons:61})).code,'DAILY_BUDGET_EXHAUSTED');assert.equal(f.b.reserve(request('a3',{sessionRef:'s2',tokenHash:'token-s2',reservedNeurons:60})).kind,'reserved');});
test('explicit retry lineage required; unknown prior timeout is not erased by new attempt',()=>{const f=fixture();create(f.b);f.b.reserve(request());assert.equal(f.b.reserve(request('a2')).code,'EXPLICIT_RETRY_REQUIRED');assert.equal(f.b.reserve(request('a2',{retryOf:{attemptId:'a1',sessionRef:'s1'}})).code,'ATTEMPT_IN_PROGRESS');f.setNow('2026-10-27T12:01:00Z');assert.equal(f.b.reserve(request('a2',{retryOf:{attemptId:'a1',sessionRef:'s1'}})).kind,'reserved');assert.equal(f.b.reserve(request('a3',{requestId:'req3'})).code,'ATTEMPT_IN_PROGRESS');});
test('quota3036 pauses only server UTC day; late settlement does not refund current-day successes',()=>{const f=fixture();create(f.b);f.b.reserve(request());f.b.settle({sessionRef:'s1',attemptId:'a1',status:'unknown',quotaExhausted:true,result:{status:'paused'}});assert.equal(f.b.reserve(request('a2',{requestId:'req2'})).code,'FREE_QUOTA_EXHAUSTED');f.setNow('2026-10-28T01:00:00Z');f.b.reserve(request('a2',{requestId:'req2',reservedNeurons:60}));f.b.settle({sessionRef:'s1',attemptId:'a2',status:'complete',result:{status:'ready'}});f.b.settle({sessionRef:'s1',attemptId:'a1',status:'complete',actualNeurons:20,result:{status:'paused'}});assert.equal(f.b.reserve(request('a3',{requestId:'req3',reservedNeurons:41})).code,'DAILY_BUDGET_EXHAUSTED');});
test('trusted finite fixture policy enforces durable IP buckets',()=>{const f=fixture({ipSessionsPerHour:10,ipRequestsPerHour:1200});for(let i=0;i<10;i++)assert.equal(create(f.b,'s'+i).kind,'session');assert.equal(create(f.b,'s10').code,'IP_SESSION_LIMIT');for(let i=0;i<1200;i++)assert.equal(f.b.admit({ipHash:'other'}).kind,'admitted');assert.equal(f.make().admit({ipHash:'other'}).code,'IP_REQUEST_LIMIT');});

test('missing response record pauses original attempt and explicit new attempt can recover without freeing old cost',()=>{const f=fixture();create(f.b);f.b.reserve(request());f.disk.sql.exec('DELETE FROM attempts WHERE attempt_id=?','a1').toArray();assert.equal(f.b.reserve(request()).code,'ATTEMPT_NOT_FOUND');assert.equal(f.b.reserve(request('a2',{retryOf:{sessionRef:'s1',attemptId:'a1'}})).code,'ATTEMPT_IN_PROGRESS');f.setNow('2026-10-27T12:01:00Z');assert.equal(f.b.reserve(request('a2',{retryOf:{sessionRef:'s1',attemptId:'a1'}})).kind,'reserved');assert.equal(f.b.reserve(request('a3',{requestId:'req3'})).code,'ATTEMPT_IN_PROGRESS');});
test('quota exhaustion received across midnight pauses the observed UTC day',()=>{const f=fixture();create(f.b);f.setNow('2026-10-27T23:59:59Z');f.b.reserve(request());f.setNow('2026-10-28T00:00:01Z');f.b.settle({sessionRef:'s1',attemptId:'a1',status:'complete',quotaExhausted:true,result:{status:'paused'}});assert.equal(f.b.reserve(request('a2',{requestId:'req2'})).code,'FREE_QUOTA_EXHAUSTED');});
test('trusted finite daily policy uses daily counters without deleting historical ledger or counters',()=>{const disk=storage();let now=Date.parse('2026-10-27T00:00:00Z');const b=createBudgetCoordinator({storage:disk,now:()=>now,limits:{dailyNeurons:240,sessionAttemptsPerDay:120,ipAttemptsPerDay:240}});for(const s of ['s1','s2','s3'])create(b,s);for(const s of ['s1','s2'])for(let i=0;i<120;i++){const r=request('a'+i,{sessionRef:s,tokenHash:'token-'+s,requestId:'req'+i,reservedNeurons:1});assert.equal(b.reserve(r).kind,'reserved');b.settle({sessionRef:s,attemptId:'a'+i,status:'complete',result:{status:'ready'}});}assert.equal(b.reserve(request('excess',{ipHash:'other',requestId:'excess',reservedNeurons:1})).code,'SESSION_ATTEMPT_LIMIT');assert.equal(b.reserve(request('excess',{sessionRef:'s3',tokenHash:'token-s3',requestId:'excess',reservedNeurons:1})).code,'IP_ATTEMPT_LIMIT');const ledger=disk.sql.exec('SELECT * FROM ledger ORDER BY rowid').toArray(),counters=disk.sql.exec('SELECT * FROM counters ORDER BY rowid').toArray();now+=86400001;b.cleanup();assert.deepEqual(disk.sql.exec('SELECT * FROM ledger ORDER BY rowid').toArray(),ledger);assert.deepEqual(disk.sql.exec('SELECT * FROM counters ORDER BY rowid').toArray(),counters);create(b,'next-day');assert.equal(b.reserve(request('next-day',{sessionRef:'next-day',tokenHash:'token-next-day',reservedNeurons:240})).kind,'reserved');});

test('ready current-session request blocks fictional foreign retry and older paused lineage',()=>{
  const f=fixture();create(f.b);f.b.reserve(request());f.b.settle({sessionRef:'s1',attemptId:'a1',status:'complete',result:{status:'ready'}});
  assert.equal(f.b.reserve(request('a2',{retryOf:{sessionRef:'fictional',attemptId:'fictional'}})).code,'ATTEMPT_ALREADY_READY');
  assert.equal(f.disk.sql.exec('SELECT COUNT(*) AS n FROM ledger').toArray()[0].n,1);
  const g=fixture();create(g.b);g.b.reserve(request());g.b.settle({sessionRef:'s1',attemptId:'a1',status:'unknown',result:{status:'paused'}});g.b.reserve(request('a2',{retryOf:{sessionRef:'s1',attemptId:'a1'}}));g.b.settle({sessionRef:'s1',attemptId:'a2',status:'complete',result:{status:'ready'}});
  assert.equal(g.b.reserve(request('a3',{reservedNeurons:1,retryOf:{sessionRef:'s1',attemptId:'a1'}})).code,'ATTEMPT_ALREADY_READY');
  assert.equal(g.disk.sql.exec('SELECT COUNT(*) AS n FROM ledger').toArray()[0].n,2);
});
test('request-level context and latest pending policy cannot be bypassed by foreign or stale references',()=>{
  const f=fixture();create(f.b);f.b.reserve(request());f.b.settle({sessionRef:'s1',attemptId:'a1',status:'unknown',result:{status:'paused'}});
  assert.equal(f.b.reserve(request('a2',{contextHash:'changed',retryOf:{sessionRef:'foreign',attemptId:'old'}})).code,'ATTEMPT_PAYLOAD_MISMATCH');
  assert.equal(f.b.reserve(request('a2',{retryOf:{sessionRef:'foreign',attemptId:'old'}})).code,'RETRY_INVALID');
  assert.equal(f.b.reserve(request('a2',{retryOf:{sessionRef:'s1',attemptId:'a1'}})).kind,'reserved');
  assert.equal(f.b.reserve(request('a3',{reservedNeurons:1,retryOf:{sessionRef:'s1',attemptId:'a2'}})).code,'ATTEMPT_IN_PROGRESS');
  f.setNow('2026-10-27T12:01:00Z');assert.equal(f.b.reserve(request('a3',{reservedNeurons:1,retryOf:{sessionRef:'s1',attemptId:'a1'}})).code,'RETRY_INVALID');
  assert.equal(f.b.reserve(request('a3',{reservedNeurons:1,retryOf:{sessionRef:'s1',attemptId:'a2'}})).kind,'reserved');
});
test('cache loss retains request/context/lineage across restart and requires exact latest explicit retry',()=>{
  const f=fixture();create(f.b);f.b.reserve(request());f.b.settle({sessionRef:'s1',attemptId:'a1',status:'unknown',result:{status:'paused'}});f.disk.sql.exec('DELETE FROM attempts WHERE session_ref=?','s1').toArray();const b=f.make();
  assert.equal(b.reserve(request('a2')).code,'EXPLICIT_RETRY_REQUIRED');
  assert.equal(b.reserve(request('a2',{retryOf:{sessionRef:'foreign',attemptId:'a1'}})).code,'RETRY_INVALID');
  assert.equal(b.reserve(request('a2',{contextHash:'changed',retryOf:{sessionRef:'s1',attemptId:'a1'}})).code,'ATTEMPT_PAYLOAD_MISMATCH');
  assert.equal(b.reserve(request('a1',{payloadHash:'changed'})).code,'ATTEMPT_PAYLOAD_MISMATCH');
  assert.equal(b.reserve(request('a2',{retryOf:{sessionRef:'s1',attemptId:'a1'}})).kind,'reserved');
  const rows=f.disk.sql.exec('SELECT request_id,context_hash,retry_session_ref,retry_attempt_id,charge FROM ledger ORDER BY rowid').toArray();
  assert.equal(rows.length,2);assert.equal(rows[0].charge,40);assert.equal(rows[1].request_id,'req1');assert.equal(rows[1].context_hash,'hash1');assert.equal(rows[1].retry_session_ref,'s1');assert.equal(rows[1].retry_attempt_id,'a1');
  f.disk.sql.exec('DELETE FROM attempts WHERE session_ref=?','s1').toArray();f.setNow('2026-10-27T12:01:00Z');assert.equal(f.make().reserve(request('a3',{reservedNeurons:1,retryOf:{sessionRef:'s1',attemptId:'a1'}})).code,'RETRY_INVALID');
});
test('deleted ready payload can regenerate only through exact latest explicit link, preserving original cost',()=>{
  const f=fixture();create(f.b);f.b.reserve(request());f.b.settle({sessionRef:'s1',attemptId:'a1',status:'complete',result:{status:'ready'}});f.disk.sql.exec('DELETE FROM attempts WHERE session_ref=?','s1').toArray();
  assert.equal(f.b.reserve(request('a2')).code,'EXPLICIT_RETRY_REQUIRED');assert.equal(f.b.reserve(request('a2',{retryOf:{sessionRef:'foreign',attemptId:'a1'}})).code,'RETRY_INVALID');
  assert.equal(f.make().reserve(request('a2',{retryOf:{sessionRef:'s1',attemptId:'a1'}})).kind,'reserved');assert.equal(f.disk.sql.exec('SELECT SUM(charge) AS total FROM ledger').toArray()[0].total,80);
});
test('explicit cross-session recovery is allowed only before this session has a record for the request',()=>{
  const f=fixture();create(f.b);create(f.b,'s2');f.b.reserve(request());f.b.settle({sessionRef:'s1',attemptId:'a1',status:'complete',result:{status:'ready',scene:{secret:'foreign-private'}}});
  const next=request('a2',{sessionRef:'s2',tokenHash:'token-s2',retryOf:{sessionRef:'s1',attemptId:'a1'}}),result=f.b.reserve(next);assert.equal(result.kind,'reserved');assert.doesNotMatch(JSON.stringify(result),/foreign-private/);
  assert.equal(f.b.reserve({...next,attemptId:'a3',reservedNeurons:1}).code,'RETRY_INVALID');
});

test('session lease serializes distinct requests across restart and releases without forgiving unknown cost',()=>{
  const f=fixture();create(f.b);create(f.b,'s2');
  assert.equal(f.b.reserve(request('a1',{reservedNeurons:20})).kind,'reserved');
  assert.equal(f.make().reserve(request('a2',{requestId:'req2',reservedNeurons:20})).code,'ATTEMPT_IN_PROGRESS');
  assert.equal(f.make().reserve(request('other',{sessionRef:'s2',tokenHash:'token-s2',reservedNeurons:20})).kind,'reserved');
  f.b.settle({sessionRef:'s1',attemptId:'a1',status:'complete',result:{status:'rejected'}});
  assert.equal(f.b.reserve(request('a2',{requestId:'req2',reservedNeurons:20})).kind,'reserved');
  f.setNow('2026-10-27T12:00:30Z');
  assert.equal(f.make().reserve(request('a3',{requestId:'req3',reservedNeurons:20})).kind,'reserved');
  const row=f.disk.sql.exec('SELECT status,charge,actual FROM ledger WHERE attempt_id=?','a2').toArray()[0];
  assert.equal(row.status,'unknown');assert.equal(row.charge,20);assert.equal(row.actual,null);
});

test('restart timeout lookup releases active lease and permits explicit same-request retry without refund',()=>{
  const f=fixture();create(f.b);f.b.reserve(request());
  f.setNow('2026-10-27T12:00:30Z');const restarted=f.make();
  assert.equal(restarted.lookup(request()).code,'PROVIDER_TIMEOUT');
  assert.equal(restarted.reserve(request()).code,'PROVIDER_TIMEOUT');
  assert.equal(restarted.reserve(request('a2',{retryOf:{sessionRef:'s1',attemptId:'a1'}})).kind,'reserved');
  const rows=f.disk.sql.exec('SELECT status,charge FROM ledger ORDER BY rowid').toArray();assert.equal(rows[0].status,'unknown');assert.equal(rows[0].charge,40);assert.equal(rows[1].charge,40);
});

test('not-admitted proofs bind identity and payload, survive restart, and cannot override a charged tombstone',()=>{
  const f=fixture();create(f.b);f.b.reserve(request());
  const blocked=request('blocked',{requestId:'other',payloadHash:'blocked-body',contextHash:'blocked-context'});
  assert.equal(f.b.reserve(blocked).code,'ATTEMPT_IN_PROGRESS');
  assert.equal(f.make().lookup(blocked).code,'ATTEMPT_NOT_ADMITTED');
  assert.equal(f.b.lookup({...blocked,tokenHash:'wrong'}).code,'SESSION_UNAVAILABLE');
  assert.equal(f.b.lookup({...blocked,requestId:'wrong'}).code,'ATTEMPT_NOT_FOUND');
  for(const change of [{payloadHash:'changed'},{contextHash:'changed'},{requestId:'changed'}])assert.equal(f.b.reserve({...blocked,...change}).code,'ATTEMPT_PAYLOAD_MISMATCH');
  assert.equal(f.disk.sql.exec('SELECT COUNT(*) AS n FROM ledger').toArray()[0].n,1);
  f.b.settle({sessionRef:'s1',attemptId:'a1',status:'unknown',result:{status:'paused'}});
  assert.equal(f.b.reserve(blocked).kind,'reserved');
  assert.equal(f.disk.sql.exec('SELECT COUNT(*) AS n FROM denied_admissions').toArray()[0].n,0);
  f.disk.sql.exec('DELETE FROM attempts WHERE attempt_id=?','blocked').toArray();
  assert.equal(f.b.lookup(blocked).code,'ATTEMPT_NOT_FOUND');
  // Even stale/corrupt denial metadata cannot conceal a real charged commitment.
  f.disk.sql.exec('INSERT INTO denied_admissions VALUES(?,?,?,?,?,?)','s1','blocked','other','blocked-body','blocked-context',f.now+1000).toArray();
  assert.equal(f.b.lookup(blocked).code,'ATTEMPT_NOT_FOUND');
  assert.equal(f.b.reserve({...blocked,attemptId:'invented',retryOf:{sessionRef:'s1',attemptId:'never-recorded'}}).code,'RETRY_INVALID');
});

test('denial proof capacity preserves existing retries without charge and expires only with session',()=>{
  const f=fixture();const b=createBudgetCoordinator({storage:f.disk,now:()=>f.now,limits:{dailyNeurons:100,sessionAttemptsPerDay:2}});create(b);b.reserve(request());
  const second=request('second',{requestId:'second'}),third=request('third',{requestId:'third'});
  assert.equal(b.reserve(second).code,'ATTEMPT_IN_PROGRESS');assert.equal(b.reserve(third).code,'ATTEMPT_IN_PROGRESS');
  assert.equal(b.reserve(request('overflow',{requestId:'overflow'})).code,'ADMISSION_RECORD_LIMIT');
  assert.equal(b.lookup(request('overflow',{requestId:'overflow'})).code,'ATTEMPT_NOT_FOUND');
  assert.equal(f.disk.sql.exec('SELECT COUNT(*) AS n FROM denied_admissions').toArray()[0].n,2);
  assert.equal(f.disk.sql.exec('SELECT SUM(charge) AS n FROM ledger').toArray()[0].n,40);
  b.settle({sessionRef:'s1',attemptId:'a1',status:'complete',result:{status:'ready'}});
  assert.equal(b.reserve(second).kind,'reserved');
  assert.equal(f.disk.sql.exec('SELECT COUNT(*) AS n FROM denied_admissions').toArray()[0].n,1);
  b.settle({sessionRef:'s1',attemptId:'second',status:'complete',result:{status:'ready'}});
  f.setNow('2026-10-28T00:00:01Z');b.cleanup();assert.equal(b.lookup(third).code,'ATTEMPT_NOT_ADMITTED');
  assert.equal(b.reserve(third).kind,'reserved');
  assert.equal(b.reserve(request('last',{requestId:'last'})).code,'ATTEMPT_IN_PROGRESS');
  f.setNow('2026-10-28T12:00:01Z');b.cleanup();assert.equal(f.disk.sql.exec('SELECT COUNT(*) AS n FROM denied_admissions').toArray()[0].n,0);
  assert.equal(b.lookup(third).code,'SESSION_UNAVAILABLE');
});

test('default session admission exceeds the former ten-per-IP threshold and keeps its counter after restart',()=>{
  const f=fixture({});
  for(let i=0;i<11;i++)assert.equal(create(f.b,'session-'+i).kind,'session');
  assert.equal(create(f.make(),'session-after-restart').kind,'session');
  const rows=f.disk.sql.exec("SELECT count FROM counters WHERE kind='session'").toArray();
  assert.equal(rows[0].count,12);
  assert.equal(f.make().getSession({tokenHash:'token-session-0'}).kind,'session');
});

test('default request admission exceeds the former 1200-per-IP threshold without resetting the counter',()=>{
  const f=fixture({});
  for(let i=0;i<1201;i++)assert.equal(f.b.admit({ipHash:'same-ip'}).kind,'admitted');
  assert.equal(f.make().admit({ipHash:'same-ip'}).kind,'admitted');
  assert.equal(f.disk.sql.exec("SELECT count FROM counters WHERE kind='request'").toArray()[0].count,1202);
});

test('default session reservations exceed 120 while each attempt and unknown charge remains durable',()=>{
  const f=fixture({});create(f.b);
  for(let i=0;i<121;i++){
    assert.equal(f.b.reserve(request('attempt-'+i,{requestId:'request-'+i,reservedNeurons:1})).kind,'reserved');
    f.b.settle({sessionRef:'s1',attemptId:'attempt-'+i,status:i===0?'unknown':'complete',result:{status:i===0?'paused':'ready'}});
  }
  const rows=f.disk.sql.exec('SELECT * FROM ledger ORDER BY rowid').toArray();
  assert.equal(rows.length,121);assert.equal(rows[0].status,'unknown');assert.equal(rows[0].charge,1);
  assert.equal(f.make().reserve(request('attempt-120',{requestId:'request-120',reservedNeurons:1})).kind,'replay');
  assert.deepEqual(f.disk.sql.exec('SELECT * FROM ledger ORDER BY rowid').toArray(),rows);
  assert.equal(f.disk.sql.exec("SELECT count FROM counters WHERE kind='sessionAttempt'").toArray()[0].count,121);
});

test('default IP reservations exceed 240 across sessions without erasing prior commitments',()=>{
  const f=fixture({});for(const s of ['s1','s2','s3'])create(f.b,s);
  for(let i=0;i<241;i++){
    const sessionRef='s'+(Math.floor(i/120)+1);
    assert.equal(f.b.reserve(request('attempt-'+i,{sessionRef,tokenHash:'token-'+sessionRef,requestId:'request-'+i,reservedNeurons:1})).kind,'reserved');
    f.b.settle({sessionRef,attemptId:'attempt-'+i,status:'complete',result:{status:'ready'}});
  }
  assert.equal(f.disk.sql.exec('SELECT COUNT(*) AS n FROM ledger').toArray()[0].n,241);
  assert.equal(f.disk.sql.exec("SELECT count FROM counters WHERE kind='ipAttempt'").toArray()[0].count,241);
});

test('default reservation accounting exceeds the old daily aggregate and individual ceilings without losing unknown history',()=>{
  const f=fixture({});create(f.b);
  assert.equal(f.b.reserve(request('old-unknown',{reservedNeurons:7000})).kind,'reserved');
  f.b.settle({sessionRef:'s1',attemptId:'old-unknown',status:'unknown',result:{status:'paused'}});
  const unknown=f.disk.sql.exec('SELECT * FROM ledger').toArray()[0],counters=f.disk.sql.exec('SELECT * FROM counters ORDER BY rowid').toArray();
  f.setNow('2026-10-29T12:00:00Z');f.b.cleanup();
  assert.deepEqual(f.disk.sql.exec('SELECT * FROM ledger').toArray(),[unknown]);
  assert.deepEqual(f.disk.sql.exec('SELECT * FROM counters ORDER BY rowid').toArray(),counters);
  const b=f.make();create(b,'s2');
  assert.equal(b.reserve(request('new-day',{sessionRef:'s2',tokenHash:'token-s2',requestId:'new-day',reservedNeurons:4000})).kind,'reserved');
  b.settle({sessionRef:'s2',attemptId:'new-day',status:'complete',result:{status:'ready'}});
  assert.equal(b.reserve(request('larger-reservation',{sessionRef:'s2',tokenHash:'token-s2',requestId:'larger-reservation',reservedNeurons:10001})).kind,'reserved');
  assert.deepEqual(f.disk.sql.exec('SELECT * FROM ledger WHERE attempt_id=?','old-unknown').toArray(),[unknown]);
  assert.equal(f.disk.sql.exec('SELECT SUM(charge) AS total FROM ledger').toArray()[0].total,21001);
});

test('default denied-admission proofs exceed 120 while the session still has only one active inference',()=>{
  const f=fixture({});create(f.b);f.b.reserve(request());
  for(let i=0;i<121;i++)assert.equal(f.b.reserve(request('blocked-'+i,{requestId:'blocked-request-'+i})).code,'ATTEMPT_IN_PROGRESS');
  const final=request('blocked-120',{requestId:'blocked-request-120'});
  assert.equal(f.make().lookup(final).code,'ATTEMPT_NOT_ADMITTED');
  assert.equal(f.disk.sql.exec('SELECT COUNT(*) AS n FROM denied_admissions').toArray()[0].n,121);
  assert.equal(f.disk.sql.exec('SELECT COUNT(*) AS n FROM ledger').toArray()[0].n,1);
  f.b.settle({sessionRef:'s1',attemptId:'a1',status:'unknown',result:{status:'paused'}});
  assert.equal(f.make().reserve(final).kind,'reserved');
  assert.equal(f.disk.sql.exec('SELECT COUNT(*) AS n FROM denied_admissions').toArray()[0].n,120);
  assert.equal(f.disk.sql.exec("SELECT charge FROM ledger WHERE status='unknown'").toArray()[0].charge,40);
});

test('default active lease lasts ninety seconds across restart without refunding its eventual unknown outcome',()=>{
  const f=fixture({});create(f.b);f.b.reserve(request());
  f.setNow('2026-10-27T12:01:29.999Z');
  assert.equal(f.make().reserve(request('another',{requestId:'another'})).code,'ATTEMPT_IN_PROGRESS');
  assert.equal(f.b.lookup(request()).code,'ATTEMPT_IN_PROGRESS');
  f.setNow('2026-10-27T12:01:30.000Z');
  assert.equal(f.make().reserve(request('another',{requestId:'another'})).kind,'reserved');
  assert.equal(f.disk.sql.exec('SELECT status,charge FROM ledger WHERE attempt_id=?','a1').toArray()[0].status,'unknown');
  assert.equal(f.disk.sql.exec('SELECT status,charge FROM ledger WHERE attempt_id=?','a1').toArray()[0].charge,40);
});

test('default policy still makes provider quota exhaustion sticky for the observed UTC day only',()=>{
  const f=fixture({});create(f.b);f.b.reserve(request());
  f.b.settle({sessionRef:'s1',attemptId:'a1',status:'unknown',quotaExhausted:true,result:{status:'paused',errorCode:'FREE_QUOTA_EXHAUSTED'}});
  const original=f.disk.sql.exec('SELECT * FROM ledger').toArray()[0];
  f.setNow('2026-10-27T23:59:59.999Z');
  assert.equal(f.make().reserve(request('next',{requestId:'next'})).code,'FREE_QUOTA_EXHAUSTED');
  f.setNow('2026-10-28T00:00:00.000Z');f.b.cleanup();
  assert.equal(f.make().reserve(request('next',{requestId:'next'})).kind,'reserved');
  assert.deepEqual(f.disk.sql.exec('SELECT * FROM ledger WHERE attempt_id=?','a1').toArray(),[original]);
});

test('trusted policy accepts explicit finite count limits without retaining old production ceilings and rejects malformed policy',()=>{
  for(const limits of [{dailyNeurons:10001},{ipSessionsPerHour:11},{ipRequestsPerHour:1201},{ipAttemptsPerDay:241},{sessionAttemptsPerDay:121}])assert.doesNotThrow(()=>createBudgetCoordinator({storage:storage(),limits}));
  for(const limits of [{dailyNeurons:0},{dailyNeurons:-1},{dailyNeurons:1.1},{dailyNeurons:Infinity},{ipRequestsPerHour:'1200'},{sessionAttemptsPerDay:undefined},{pendingMs:null},{pendingMs:90001},{sessionMs:null},{unknown:1}])assert.throws(()=>createBudgetCoordinator({storage:storage(),limits}),/BUDGET_POLICY_INVALID/);
  const f=fixture({});create(f.b);
  for(const reservedNeurons of [0,-1,1.1,NaN,Infinity,null,Number.MAX_SAFE_INTEGER+1])assert.equal(f.b.reserve(request('invalid',{reservedNeurons})).code,'RESERVATION_INVALID');
});
