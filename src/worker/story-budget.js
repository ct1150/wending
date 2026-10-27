// One SQLite Durable Object per account/game. No provider work runs inside a
// transaction. Ledger commitments are independent of expiring response records.
export const BUDGET_LIMITS=Object.freeze({dailyNeurons:10000,sessionMs:86400000,ipSessionsPerHour:10,ipRequestsPerHour:1200,ipAttemptsPerDay:240,sessionAttemptsPerDay:120,pendingMs:30000});
const denied=code=>({kind:'denied',code});
const day=now=>new Date(now).toISOString().slice(0,10);
const validText=v=>typeof v==='string'&&v.length>0&&v.length<=256;
export function createBudgetCoordinator({storage,now=Date.now,limits={}}){
  const policy={...BUDGET_LIMITS,...limits};
  // Trusted tests/deployments may lower limits; no configuration can raise caps.
  for(const key of Object.keys(policy))if(!Number.isSafeInteger(policy[key])||policy[key]<1||policy[key]>BUDGET_LIMITS[key])throw new Error('BUDGET_POLICY_INVALID');
  const sql=(query,...args)=>storage.sql.exec(query,...args).toArray();
  sql('CREATE TABLE IF NOT EXISTS sessions (ref TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL)');
  sql('CREATE TABLE IF NOT EXISTS attempts (session_ref TEXT NOT NULL, attempt_id TEXT NOT NULL, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL, context_hash TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, result TEXT, PRIMARY KEY(session_ref,attempt_id))');
  sql('CREATE INDEX IF NOT EXISTS attempts_request ON attempts(session_ref,request_id)');
  sql('CREATE TABLE IF NOT EXISTS ledger (session_ref TEXT NOT NULL, attempt_id TEXT NOT NULL, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL, context_hash TEXT NOT NULL, created INTEGER NOT NULL, retry_session_ref TEXT, retry_attempt_id TEXT, outcome TEXT, day TEXT NOT NULL, reserved INTEGER NOT NULL, charge REAL NOT NULL, status TEXT NOT NULL, actual REAL, PRIMARY KEY(session_ref,attempt_id))');
  sql('CREATE INDEX IF NOT EXISTS ledger_request ON ledger(session_ref,request_id)');
  sql('CREATE TABLE IF NOT EXISTS counters (kind TEXT NOT NULL, subject TEXT NOT NULL, bucket TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(kind,subject,bucket))');
  sql('CREATE TABLE IF NOT EXISTS quota (day TEXT PRIMARY KEY)');
  const tx=fn=>storage.transactionSync(fn);
  const session=(input,time)=>sql('SELECT ref,expires FROM sessions WHERE token_hash=? AND expires>?',input.tokenHash,time).find(row=>!input.sessionRef||row.ref===input.sessionRef);
  const counter=(kind,subject,bucket)=>sql('SELECT count FROM counters WHERE kind=? AND subject=? AND bucket=?',kind,subject,bucket)[0]?.count??0;
  const increment=(kind,subject,bucket)=>sql('INSERT INTO counters(kind,subject,bucket,count) VALUES(?,?,?,1) ON CONFLICT(kind,subject,bucket) DO UPDATE SET count=count+1',kind,subject,bucket);
  const entry=(ref,id)=>sql('SELECT * FROM attempts WHERE session_ref=? AND attempt_id=?',ref,id)[0];
  const replay=row=>{
    if(row.result)return {kind:'replay',result:JSON.parse(row.result)};
    if(now()-row.created>=policy.pendingMs) {
      sql("UPDATE ledger SET status='unknown' WHERE session_ref=? AND attempt_id=? AND status='reserved'",row.session_ref,row.attempt_id);
      return denied('PROVIDER_TIMEOUT');
    }
    return denied('ATTEMPT_IN_PROGRESS');
  };
  const api={
    getSession(input){const found=session(input,now());return found?{kind:'session',sessionRef:found.ref,expiresAt:found.expires}:denied('SESSION_UNAVAILABLE');},
    admit({ipHash}){if(!validText(ipHash))return denied('REQUEST_INVALID');return tx(()=>{const bucket=String(Math.floor(now()/3600000));if(counter('request',ipHash,bucket)>=policy.ipRequestsPerHour)return denied('IP_REQUEST_LIMIT');increment('request',ipHash,bucket);return {kind:'admitted'};});},
    createSession({sessionRef,tokenHash,ipHash}){if(![sessionRef,tokenHash,ipHash].every(validText))return denied('REQUEST_INVALID');return tx(()=>{const time=now(),bucket=String(Math.floor(time/3600000));if(counter('session',ipHash,bucket)>=policy.ipSessionsPerHour)return denied('IP_SESSION_LIMIT');if(sql('SELECT ref FROM sessions WHERE ref=? OR token_hash=?',sessionRef,tokenHash).length)return denied('SESSION_CONFLICT');increment('session',ipHash,bucket);sql('INSERT INTO sessions(ref,token_hash,expires) VALUES(?,?,?)',sessionRef,tokenHash,time+policy.sessionMs);return {kind:'session',sessionRef,expiresAt:time+policy.sessionMs};});},
    lookup(input){return tx(()=>{if(!session(input,now()))return denied('SESSION_UNAVAILABLE');const row=entry(input.sessionRef,input.attemptId);return !row||row.request_id!==input.requestId?denied('ATTEMPT_NOT_FOUND'):replay(row);});},
    reserve(input){return tx(()=>{
      const time=now(),today=day(time),s=session(input,time);
      if(!s)return denied('SESSION_UNAVAILABLE');
      if(![input.attemptId,input.requestId,input.payloadHash,input.ipHash].every(validText)||!Number.isSafeInteger(input.reservedNeurons)||input.reservedNeurons<1||input.reservedNeurons>policy.dailyNeurons)return denied('RESERVATION_INVALID');
      const contextHash=input.contextHash??input.payloadHash;
      if(!validText(contextHash))return denied('RESERVATION_INVALID');
      const prior=entry(s.ref,input.attemptId);
      const priorCommitment=sql('SELECT * FROM ledger WHERE session_ref=? AND attempt_id=?',s.ref,input.attemptId)[0];
      if(priorCommitment&&(priorCommitment.payload_hash!==input.payloadHash||priorCommitment.request_id!==input.requestId||priorCommitment.context_hash!==contextHash))return denied('ATTEMPT_PAYLOAD_MISMATCH');
      if(priorCommitment&&!prior)return denied('ATTEMPT_NOT_FOUND');
      if(prior){if(prior.payload_hash!==input.payloadHash||prior.request_id!==input.requestId)return denied('ATTEMPT_PAYLOAD_MISMATCH');return replay(prior);}
      if(input.retryOf&&(!validText(input.retryOf.attemptId)||!validText(input.retryOf.sessionRef)||input.retryOf.attemptId===input.attemptId))return denied('RETRY_INVALID');
      // Ledger identity/lineage survives loss of a response row. Check all state
      // for this authenticated session/request before considering foreign lineage.
      // rowid orders serialized reservations even when the server clock ties.
      const sameRequest=sql('SELECT l.*,a.result AS cached_result FROM ledger l LEFT JOIN attempts a ON a.session_ref=l.session_ref AND a.attempt_id=l.attempt_id WHERE l.session_ref=? AND l.request_id=? ORDER BY l.rowid DESC',s.ref,input.requestId);
      if(sameRequest.length){
        if(sameRequest.some(row=>row.context_hash!==contextHash))return denied('ATTEMPT_PAYLOAD_MISMATCH');
        if(sameRequest.some(row=>row.cached_result&&JSON.parse(row.cached_result).status==='ready'))return denied('ATTEMPT_ALREADY_READY');
        if(!input.retryOf)return denied('EXPLICIT_RETRY_REQUIRED');
        const latest=sameRequest[0];
        if(input.retryOf.sessionRef!==s.ref||input.retryOf.attemptId!==latest.attempt_id)return denied('RETRY_INVALID');
        if(latest.outcome===null&&time-latest.created<policy.pendingMs)return denied('ATTEMPT_IN_PROGRESS');
        // A missing ready payload may be explicitly regenerated: the exact
        // latest link and unchanged context prevent silent or stale retries.
      }else if(input.retryOf?.sessionRef===s.ref){
        // No corresponding request in this session: a claimed local ancestor
        // cannot be invented or borrowed from another game request.
        return denied('RETRY_INVALID');
      }
      // The active lease is session-wide; durable unknown accounting outlives it.
      // Expiry is a conservative timeout transition, never a refund or cleanup.
      sql("UPDATE ledger SET status='unknown' WHERE session_ref=? AND status='reserved' AND created<=?",s.ref,time-policy.pendingMs);
      if(sql("SELECT 1 FROM ledger WHERE session_ref=? AND status='reserved' AND created>? LIMIT 1",s.ref,time-policy.pendingMs).length)return denied('ATTEMPT_IN_PROGRESS');
      // A foreign-session reference is accepted only for a request new to this
      // session. Never inspect that other session's result or private identity.
      if(sql('SELECT day FROM quota WHERE day=?',today).length)return denied('FREE_QUOTA_EXHAUSTED');
      if(counter('ipAttempt',input.ipHash,today)>=policy.ipAttemptsPerDay)return denied('IP_ATTEMPT_LIMIT');
      if(counter('sessionAttempt',s.ref,today)>=policy.sessionAttemptsPerDay)return denied('SESSION_ATTEMPT_LIMIT');
      const used=sql("SELECT COALESCE(SUM(charge),0) AS total FROM ledger WHERE day=? OR status IN ('reserved','unknown')",today)[0].total;
      if(used+input.reservedNeurons>policy.dailyNeurons)return denied('DAILY_BUDGET_EXHAUSTED');
      increment('ipAttempt',input.ipHash,today);increment('sessionAttempt',s.ref,today);
      sql('INSERT INTO attempts(session_ref,attempt_id,request_id,payload_hash,context_hash,created,expires,result) VALUES(?,?,?,?,?,?,?,NULL)',s.ref,input.attemptId,input.requestId,input.payloadHash,contextHash,time,s.expires);
      sql("INSERT INTO ledger(session_ref,attempt_id,request_id,payload_hash,context_hash,created,retry_session_ref,retry_attempt_id,day,reserved,charge,status,actual,outcome) VALUES(?,?,?,?,?,?,?,?,?,?,?,'reserved',NULL,NULL)",s.ref,input.attemptId,input.requestId,input.payloadHash,contextHash,time,input.retryOf?.sessionRef??null,input.retryOf?.attemptId??null,today,input.reservedNeurons,input.reservedNeurons);
      return {kind:'reserved',sessionRef:s.ref,attemptId:input.attemptId,day:today,reservedNeurons:input.reservedNeurons};
    });},
    settle({sessionRef,attemptId,status,actualNeurons=null,result,quotaExhausted=false}){return tx(()=>{
      if(!['complete','unknown'].includes(status)||actualNeurons!==null&&(!Number.isFinite(actualNeurons)||actualNeurons<0))return denied('SETTLEMENT_INVALID');
      const row=sql('SELECT * FROM ledger WHERE session_ref=? AND attempt_id=?',sessionRef,attemptId)[0];
      if(!row)return denied('RESERVATION_NOT_FOUND');
      if(row.actual!==null&&(actualNeurons===null||actualNeurons<row.actual)||row.status==='complete'&&status==='unknown')return denied('SETTLEMENT_INVALID');
      // Completion without billed usage charges full cap for its original day.
      // Unknown retains at least the cap and cannot be reduced by cache cleanup.
      const charge=status==='unknown'?Math.max(row.reserved,actualNeurons??0):(actualNeurons??row.reserved);
      sql('UPDATE ledger SET status=?,charge=?,actual=? WHERE session_ref=? AND attempt_id=?',status,charge,actualNeurons,sessionRef,attemptId);
      if(result!==undefined){if(!['ready','paused','rejected'].includes(result?.status))throw new Error('SETTLEMENT_INVALID');sql('UPDATE ledger SET outcome=COALESCE(outcome,?) WHERE session_ref=? AND attempt_id=?',result.status,sessionRef,attemptId);const serialized=JSON.stringify(result);if(new TextEncoder().encode(serialized).length>65536)throw new Error('RESULT_TOO_LARGE');sql('UPDATE attempts SET result=? WHERE session_ref=? AND attempt_id=? AND result IS NULL',serialized,sessionRef,attemptId);}
      // Usage stays on its reservation day; observed quota errors block today.
      if(quotaExhausted)sql('INSERT OR IGNORE INTO quota(day) VALUES(?)',day(now()));
      return {kind:'settled'};
    });},
    cleanup(){return tx(()=>{const time=now(),today=day(time);sql('DELETE FROM attempts WHERE expires<=?',time);sql('DELETE FROM sessions WHERE expires<=?',time);sql("DELETE FROM ledger WHERE day<? AND status='complete' AND NOT EXISTS (SELECT 1 FROM sessions WHERE sessions.ref=ledger.session_ref)",today);sql('DELETE FROM quota WHERE day<?',today);sql("DELETE FROM counters WHERE kind IN ('request','session') AND CAST(bucket AS INTEGER)<?",Math.floor(time/3600000)-1);sql("DELETE FROM counters WHERE kind IN ('ipAttempt','sessionAttempt') AND bucket<?",today);return {kind:'cleaned'};});},
  };return api;
}

export class StoryBudget {
  constructor(ctx){this.coordinator=createBudgetCoordinator({storage:ctx.storage});this.nextCleanup=0;}
  async fetch(request){
    // Reachable only through the singleton internal Durable Object binding.
    if(request.method!=='POST')return new Response(null,{status:405});
    const method=new URL(request.url).pathname.slice(1);
    if(!['getSession','admit','createSession','lookup','reserve','settle','cleanup'].includes(method))return new Response(null,{status:404});
    try {if(Date.now()>=this.nextCleanup){this.coordinator.cleanup();this.nextCleanup=Date.now()+3600000;}return Response.json(this.coordinator[method](await request.json()));}catch{return Response.json({kind:'denied',code:'BUDGET_UNAVAILABLE'},{status:503});}
  }
}
