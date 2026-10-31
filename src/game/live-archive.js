import { canonicalStringify, sha256, stateHash, assertPlainData } from './cultivation/live/identity.js';
import { validateLiveState } from './cultivation/live/validation.js';
import { prepareOpening, prepareRecordedChoice, commitTurn, settleDeath, resolveImmediateInteraction } from './cultivation/live/engine.js';
import { buildStoryContext, validateGeneratedScene, buildMemoryDelta, validateStoryContext, sceneTurnRecord } from './cultivation/live/memory.js';
import { echoNotes, buildRebirthOptions, reincarnationClaimForChild, validateReincarnationClaim } from './cultivation/live/reincarnation.js';

export const CHUNK_TURNS = 128;
export const CHUNK_BYTES = 256 * 1024;
const STORES = ['runs', 'pending', 'history', 'memory'];
const ACTIVE = '@active';
const clone = value => structuredClone(value);
const same = (a,b) => canonicalStringify(a) === canonicalStringify(b);
export const encodedBytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
function fail(code='ARCHIVE_CONFLICT') { throw Object.assign(new Error(code), {code}); }
function check(ok,code) { if (!ok) fail(code); }
function bounded(value,max) { assertPlainData(value);check(encodedBytes(value)<=max,'ARCHIVE_RECORD_TOO_LARGE');return value; }
function ident(value) { check(typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/.test(value),'ARCHIVE_INVALID_ID'); }
function keys(value,required) { assertPlainData(value);check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...required].sort().join('|'),'ARCHIVE_INVALID_FIELDS'); }
export function verifyPending(state,pending) {
 const expected=pending?.kind==='opening'?prepareOpening(state,{requestId:pending.identity.requestId}):prepareRecordedChoice(state,pending);
 check(same(expected,pending),'ARCHIVE_INVALID_PENDING');return pending;
}
export function validateAttempt(attempt) {
 if(attempt===null)return null;keys(attempt,['id','sessionRef','retryOf']);ident(attempt.id);ident(attempt.sessionRef);
 if(attempt.retryOf!==null){keys(attempt.retryOf,['attemptId','sessionRef']);ident(attempt.retryOf.attemptId);ident(attempt.retryOf.sessionRef);check(attempt.retryOf.attemptId!==attempt.id,'ARCHIVE_INVALID_ATTEMPT');}return attempt;
}
function pauseValue(value) { check(value===null||typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(value),'ARCHIVE_INVALID_PAUSE'); }
export function validateGeneration(generation,pending,state) {
 if(generation===undefined)return;
 keys(generation,['storyActions','context']);check(typeof generation.storyActions==='boolean','ARCHIVE_INVALID_GENERATION');validateStoryContext(generation.context);
 const previous=generation.context.previousLife;
 if(state&&previous!==undefined)check(same(previous,echoNotes(state.reincarnation).slice(0,previous.length)),'ARCHIVE_INVALID_GENERATION');
 check(pending&&same(generation.context.identity,pending.identity)&&same(generation.context.receipt,pending.receipt),'ARCHIVE_INVALID_GENERATION');
}
function pendingRow(archiveId,pending,attempt=null,pause=null,generation) {validateAttempt(attempt);pauseValue(pause);validateGeneration(generation,pending);check(generation===undefined||attempt!==null,'ARCHIVE_INVALID_GENERATION');return bounded({archiveId,pending,attempt,pause,...(generation===undefined?{}:{generation})},65536);}
export function makeChunk(index,previousHash,entries) {
 // Canonicalize each bounded entry separately: aggregate chunks can exceed the
 // pure snapshot inspector's node budget without having unbounded records.
 const content=entries.map(canonicalStringify).join(',');
 const hash=sha256(index+':'+previousHash+':['+content+']');
 return {index,previousHash,entries,hash};
}
export function verifyChunk(chunk) {
 keysShallow(chunk,['index','previousHash','entries','hash']);check(Number.isSafeInteger(chunk.index)&&chunk.index>=0&&/^[a-f0-9]{64}$/.test(chunk.previousHash)&&Array.isArray(chunk.entries)&&chunk.entries.length>0&&chunk.entries.length<=CHUNK_TURNS,'ARCHIVE_INVALID_CHUNK');
 check(encodedBytes(chunk)<=CHUNK_BYTES,'ARCHIVE_RECORD_TOO_LARGE');check(makeChunk(chunk.index,chunk.previousHash,chunk.entries).hash===chunk.hash,'ARCHIVE_BAD_HASH');return chunk;
}
function keysShallow(v,expected) {check(v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join('|')===[...expected].sort().join('|'),'ARCHIVE_INVALID_FIELDS');}
const ZERO='0'.repeat(64);
function loaded(run,pending) {validateGeneration(pending?.generation,pending?.pending,run?.state);return run?{archiveId:run.archiveId,state:clone(run.state),pending:pending?.pending??null,attempt:pending?.attempt??null,pause:pending?.pause??null,...(pending?.generation?{generation:clone(pending.generation)}:{}),...(run.reincarnatedTo?{reincarnatedTo:run.reincarnatedTo}:{})}:null;}
function verifyReadableRun(run) {
 check(run?.status==='active','ARCHIVE_NOT_READABLE');ident(run.archiveId);ident(run.runId);
 validateLiveState(run.birth);validateLiveState(run.state);
 check(run.birth.runId===run.runId&&run.state.runId===run.runId&&stateHash(run.state)===run.hash,'ARCHIVE_INVALID_SNAPSHOT');
}
const claimKey=runId=>'@rebirth:'+sha256(runId);
function writeClaims(stores,get,claims,finish) {
  const remaining=claims.filter(Boolean);
  const next=()=>{
    if(!remaining.length){finish();return;}
    const claim=validateReincarnationClaim(remaining.shift()),archiveId=claimKey(claim.parentRunId),record={archiveId,...claim};
    get(stores.runs,archiveId,existing=>{check(!existing||same(existing,record),'REINCARNATION_ALREADY_CLAIMED');if(!existing)stores.runs.add(record);next();});
  };
  next();
}
// A portable child can be the only surviving backup. If this database also
// knows its original child birth or exact parent death, check the echo and
// purchases against those durable facts before activating any imported copy.
function verifyImportedLineage(stores,get,run,finish) {
 const row=run.birth.reincarnation;
 const readKnown=(id,done)=>get(stores.runs,'@run:'+id,pointer=>pointer?get(stores.runs,pointer.target,done):done(null));
 readKnown(run.runId,old=>{
   if(old&&(old.birth?.reincarnation?.version===2||row?.version===2))
     check(same(old.birth.reincarnation??null,row??null),'REINCARNATION_INVALID_STATE');
   if(row?.version!==2){finish();return;}
   readKnown(row.parentRunId,parent=>{
     if(parent?.hash===row.parentStateHash){
       const expected=buildRebirthOptions(parent.state,row.purchases);
       check(same(row,expected.reincarnation),'REINCARNATION_INVALID_STATE');
     }
     finish();
   });
 });
}
// Never await inside a transaction. All work here is synchronous or chained from
// native request callbacks; only transaction.oncomplete resolves the operation.
function transaction(db,mode,body) {
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORES,mode),s=Object.fromEntries(STORES.map(n=>[n,tx.objectStore(n)]));let result,error;
  const guard=fn=>(event)=>{try{fn(event);}catch(e){error=e;try{tx.abort();}catch{}}};
  const get=(store,key,fn)=>{const req=store.get(key);req.onsuccess=guard(()=>fn(req.result));};
  tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error??tx.error??new Error('ARCHIVE_ABORTED'));tx.onerror=()=>{};
  try{body(s,get,v=>{result=v;},guard,tx);}catch(e){error=e;tx.abort();}
 });
}
export async function openLiveArchive({name='wending-live-v1'}={}) {
 const db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open(name,3);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('runs')) {
    db.createObjectStore('runs',{keyPath:'archiveId'});
    db.createObjectStore('pending',{keyPath:'archiveId'});
    db.createObjectStore('history',{keyPath:['archiveId','index']});
    const memory=db.createObjectStore('memory',{keyPath:['archiveId','id','version']});
    memory.createIndex('entity','entityKey');
    memory.createIndex('status','statusKey');
    memory.createIndex('recent','recentKey');
   }
   // Native IndexedDB populates this additive index from existing v1 records.
   // Version -1 selects only current statuses, never an obsolete open version.
   const memory=req.transaction.objectStore('memory');
   if(!memory.indexNames.contains('storyEntityOpen')) {
    memory.createIndex('storyEntityOpen',['archiveId','version','record.entityId','record.status','id']);
   }
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
  req.onblocked=()=>reject(new Error('ARCHIVE_OPEN_BLOCKED'));
 });
 db.onversionchange=()=>db.close();return new Archive(db);
}
class Archive {
 constructor(db){this.db=db;this.bound=null;}
 close(){this.db.close();}
 async _capture(runId,physical=null) {
  return transaction(this.db,'readonly',(s,get,done)=>{
   get(s.runs,ACTIVE,active=>{const select=physical?{archiveId:physical}:null;
    const fetch=pointer=>{if(!pointer){done(null);return;}get(s.runs,pointer.archiveId,run=>{if(!run){done(null);return;}get(s.pending,run.archiveId,pending=>{const finish=tail=>get(s.runs,claimKey(run.runId),stored=>{const claim=stored?Object.fromEntries(Object.entries(stored).filter(([key])=>key!=='archiveId')):run.reincarnationClaim??null;done({run:claim?{...run,reincarnatedTo:claim.childRunId}:run,pending:pending??null,tail:tail?.chunk??null,active:active?.target??null,reincarnationClaim:claim});});if(run.tailIndex<0)finish(null);else get(s.history,[run.archiveId,run.tailIndex],finish);});});};
    if(select)fetch(select);else if(runId)get(s.runs,'@run:'+runId,p=>fetch(p?{archiveId:p.target}:null));else fetch(active?{archiveId:active.target}:null);
   });
  });
 }
 async load(runId) {const c=await this._capture(runId);if(c)this.bound=c.run.archiveId;return c?loaded(c.run,c.pending):null;}
 // These views never bind the session or change either active/run pointer.
 async _captureReadable(runId,physical=null) {
  if(physical!==null)ident(physical);
  const c=await this._capture(runId,physical);check(c,'ARCHIVE_NOT_READABLE');verifyReadableRun(c.run);
  check((!runId||c.run.runId===runId)&&(!physical||c.run.archiveId===physical),'ARCHIVE_INVALID_SNAPSHOT');
  if(c.pending){check(c.pending.archiveId===c.run.archiveId,'ARCHIVE_INVALID_SNAPSHOT');verifyPending(c.run.state,c.pending.pending);validateAttempt(c.pending.attempt);validateGeneration(c.pending.generation,c.pending.pending,c.run.state);}
  if(c.tail){verifyChunk(c.tail);check(c.tail.index===c.run.tailIndex&&c.tail.hash===c.run.headHash,'ARCHIVE_BAD_HASH');}
  return c;
 }
 async listRetainedArchives(cursor=null,limit=12) {
  check(Number.isInteger(limit)&&limit>=1&&limit<=32,'ARCHIVE_INVALID_QUERY');
  check(cursor===null||typeof cursor==='string'&&cursor.length>0&&cursor.length<=160,'ARCHIVE_INVALID_CURSOR');
  return transaction(this.db,'readonly',(s,get,done,guard)=>get(s.runs,ACTIVE,active=>{
   const entries=[];let visited=0;
   const request=s.runs.openCursor(cursor?IDBKeyRange.lowerBound(cursor,true):null);
   request.onsuccess=guard(()=>{
    const row=request.result;
    if(!row){done({entries,cursor:null});return;}
    const run=row.value;visited++;
    if(run.status==='active'&&run.archiveId!==active?.target){
     verifyReadableRun(run);
     entries.push({archiveId:run.archiveId,runId:run.runId,name:run.state.life.name,phase:run.state.phase,turnId:run.state.turnId,revision:run.state.revision});
    }
    // Bound both returned snapshots and scanned metadata/staging records.
    if(entries.length===limit||visited>=128){done({entries,cursor:row.key});return;}
    row.continue();
   });
  }));
 }
 async readRetainedArchive(archiveId) {ident(archiveId);const c=await this._captureReadable(null,archiveId);return loaded(c.run,c.pending);}
 async readRetainedHistory(archiveId,cursor=null,limit=32) {
  ident(archiveId);const c=await this._captureReadable(null,archiveId);
  return this.readHistory(c.run.runId,cursor,limit,archiveId);
 }

 async create({state,pending,expectedArchiveId=null}) {
  validateLiveState(state);check(!state.reincarnation&&!state.life.birth.cultivationProfile?.inheritedBenefits?.length,'REINCARNATION_REQUIRES_SETTLEMENT');check(state.revision===0&&state.archiveCursor===0,'ARCHIVE_INVALID_BIRTH');verifyPending(state,pending);
  const archiveId=crypto.randomUUID(),run={archiveId,runId:state.runId,state:clone(state),birth:clone(state),hash:stateHash(state),tailIndex:-1,headHash:ZERO,status:'active'};
  const p=pendingRow(archiveId,clone(pending));await transaction(this.db,'readwrite',(s,get,done)=>get(s.runs,ACTIVE,active=>{check((active?.target??null)===expectedArchiveId);get(s.runs,'@run:'+state.runId,existing=>{check(!existing);s.runs.add(run);s.pending.add(p);s.runs.put({archiveId:ACTIVE,target:archiveId});s.runs.put({archiveId:'@run:'+state.runId,target:archiveId});done();});}));this.bound=archiveId;return loaded(run,p);
 }
 async reincarnate({state,pending,rewardIds=[],expectedArchiveId}) {
  validateLiveState(state);check(state.revision===0&&state.archiveCursor===0,'ARCHIVE_INVALID_BIRTH');verifyPending(state,pending);
  const c=await this._capture();check(c&&c.run.archiveId===expectedArchiveId&&!c.pending&&c.run.state.phase==='dead','REINCARNATION_REQUIRES_DEATH');
  check(!c.reincarnationClaim,'REINCARNATION_ALREADY_CLAIMED');
  const expected=buildRebirthOptions(c.run.state,rewardIds);
  check((expected.experienceVersion===undefined||state.life.birth.cultivationProfile?.experienceVersion===expected.experienceVersion)&&same(state.reincarnation,expected.reincarnation)&&same(state.life.birth.cultivationProfile?.inheritedBenefits,expected.inheritedBenefits),'REINCARNATION_INVALID_STATE');
  const claim=reincarnationClaimForChild(state);validateReincarnationClaim(claim,c.run.state);
  const archiveId=crypto.randomUUID(),run={archiveId,runId:state.runId,state:clone(state),birth:clone(state),hash:stateHash(state),tailIndex:-1,headHash:ZERO,status:'active'},p=pendingRow(archiveId,clone(pending));
  await transaction(this.db,'readwrite',(s,get)=>this._cas(s,get,c,()=>get(s.runs,claimKey(c.run.runId),old=>{
    check(!old,'REINCARNATION_ALREADY_CLAIMED');
    get(s.runs,'@run:'+state.runId,existing=>{check(!existing);writeClaims(s,get,[claim],()=>{
      s.runs.add(run);s.pending.add(p);s.runs.put({...c.run,reincarnatedTo:state.runId});s.runs.put({archiveId:ACTIVE,target:archiveId});s.runs.put({archiveId:'@run:'+state.runId,target:archiveId});
    });});
  })));
  this.bound=archiveId;return loaded(run,p);
 }
 _cas(s,get,c,fn,{staging=false}={}) {
  get(s.runs,ACTIVE,active=>{check(staging||active?.target===c.run.archiveId);get(s.runs,c.run.archiveId,run=>{check(run&&run.hash===c.run.hash&&run.headHash===c.run.headHash&&run.state.revision===c.run.state.revision);get(s.pending,c.run.archiveId,p=>{check(same(p??null,c.pending));fn(run,p);});});});
 }
 async prepare(pending) {
  const c=await this._capture(pending?.identity?.runId);check(c&&(!this.bound||this.bound===c.run.archiveId));verifyPending(c.run.state,pending);const p=pendingRow(c.run.archiveId,clone(pending));
  if(c.pending)check(same(c.pending.pending,pending));
  await transaction(this.db,'readwrite',(s,get)=>this._cas(s,get,c,()=>{if(!c.pending)s.pending.put(p);}));return loaded(c.run,c.pending??p);
 }
 async setAttempt({runId,requestId,expectedAttemptId,attempt,pause=null,generation}) {
  ident(runId);ident(requestId);validateAttempt(attempt);pauseValue(pause);const c=await this._capture(runId);check(c&&(!this.bound||this.bound===c.run.archiveId)&&c.pending?.pending.identity.requestId===requestId&&(c.pending.attempt?.id??null)===expectedAttemptId);
  validateGeneration(generation,c.pending.pending,c.run.state);
  const old=c.pending.attempt,freezing=old&&generation!==undefined&&c.pending.generation===undefined&&same(attempt,old);if(attempt&&!freezing){check(attempt.id!==old?.id);check(old?same(attempt.retryOf,{attemptId:old.id,sessionRef:old.sessionRef}):attempt.retryOf===null,'ARCHIVE_INVALID_ATTEMPT');}else if(!attempt)check(!old);
  if(c.pending.generation!==undefined&&generation!==undefined)check(same(c.pending.generation,generation),'ARCHIVE_GENERATION_CONFLICT');
  const p=pendingRow(c.run.archiveId,c.pending.pending,clone(attempt),pause,clone(generation??c.pending.generation));await transaction(this.db,'readwrite',(s,get)=>this._cas(s,get,c,()=>s.pending.put(p)));return loaded(c.run,p);
 }
 async readRelated(runId,{entityIds=[],referenceIds=[],includeOpen=true,limit=256,factsPerEntity=8}={},physical=null) {
  check(Number.isInteger(factsPerEntity)&&factsPerEntity>=0&&factsPerEntity<=16,'ARCHIVE_INVALID_QUERY');check(Array.isArray(entityIds)&&entityIds.length<=48&&Array.isArray(referenceIds)&&referenceIds.length<=32&&Number.isInteger(limit)&&limit>0&&limit<=256,'ARCHIVE_INVALID_QUERY');[...entityIds,...referenceIds].forEach(ident);
  const c=await this._capture(runId,physical);if(!c)return [];
  return transaction(this.db,'readonly',(s,get,done,guard)=>{
   const records=new Map();let bytes=0;
   const add=row=>{if(!row||records.has(row.id))return;const record=row.record;bytes+=encodedBytes(record);check(records.size<limit&&bytes<=CHUNK_BYTES,'MEMORY_CONTEXT_TOO_LARGE');records.set(row.id,record);if(record.entityId)entities.add(record.entityId);};
   const entities=new Set(entityIds);const tasks=[];for(const id of referenceIds)tasks.push(()=>get(s.memory,[c.run.archiveId,id,-1],row=>{add(row);next();}));
   const scan=(index,key)=>()=>{const req=s.memory.index(index).openCursor(IDBKeyRange.only(key));req.onsuccess=guard(()=>{const cursor=req.result;if(!cursor){next();return;}add(cursor.value);cursor.continue();});};
   for(const id of new Set(entityIds))if(factsPerEntity)tasks.push(()=>{let n=0,visited=0;const req=s.memory.index('recent').openCursor(IDBKeyRange.bound([c.run.archiveId,id,0],[c.run.archiveId,id,Number.MAX_SAFE_INTEGER,[]]),'prev');req.onsuccess=guard(()=>{const cursor=req.result;if(!cursor||n>=factsPerEntity||visited++>=factsPerEntity*2){next();return;}if(!['entity','ruleRelation'].includes(cursor.value.record.kind)&&cursor.value.record.status!=='open'){add(cursor.value);n++;}cursor.continue();});});
   if(includeOpen)tasks.push(scan('status',[c.run.archiveId,'open']));
   let fetchedEntities=false;
   const next=()=>{
    if(tasks.length){tasks.shift()();return;}
    if(!fetchedEntities) {
     fetchedEntities=true;
     const prefixes=c.run.state.relationshipVersion===1?['e:','q:']:['e:'];
     for(const id of entities)for(const prefix of prefixes) {
      tasks.push(()=>get(s.memory,[c.run.archiveId,prefix+sha256(id).slice(0,40),-1],row=>{add(row);next();}));
     }
     next();return;
    }
    done([...records.values()]);
   };
   next();
  });
 }
 // Prompt retrieval is a bounded view over permanent indexes. All obligations
 // remain available to readRelated/export; count does not materialize their rows.
 async readStoryRecords(runId,{entityIds=[],recent=false}={}) {
  check(typeof recent==='boolean','ARCHIVE_INVALID_QUERY');
  check(Array.isArray(entityIds)&&entityIds.length<=25,'ARCHIVE_INVALID_QUERY');
  entityIds.forEach(ident);
  const currentIds=[...new Set(entityIds)].sort();
  const c=await this._capture(runId);
  if(!c)return {records:[],openTotal:0};
  return transaction(this.db,'readonly',(stores,get,done,guard)=>{
   const records=new Map(),entities=new Set(currentIds),tasks=[];
   let openTotal=0,totalBytes=0,fetchedEntities=false;
   const add=row=>{
    if(!row||records.has(row.id))return;
    totalBytes+=encodedBytes(row.record);
    check(records.size<256&&totalBytes<=CHUNK_BYTES,'MEMORY_RETRIEVAL_TOO_LARGE');
    records.set(row.id,row.record);
    if(row.record.entityId)entities.add(row.record.entityId);
    if(row.record.kind==='turn')for(const entityId of row.record.entityIds)entities.add(entityId);
   };
   if(recent&&c.tail){
    verifyChunk(c.tail);check(c.tail.hash===c.run.headHash,'ARCHIVE_BAD_HASH');
    const entries=c.tail.entries.filter(entry=>entry.scene).slice(-2);
    const addScenes=rows=>{for(const entry of rows.slice(-2)){const record=sceneTurnRecord(entry.scene,{runId:c.run.runId,turnId:entry.identity.turnId,action:entry.receipt.action});add({id:record.id,record});for(const entity of entry.scene.entities)entities.add(entity.id);}};
    if(entries.length<2&&c.run.tailIndex>0)tasks.push(()=>get(stores.history,[c.run.archiveId,c.run.tailIndex-1],row=>{check(row?.chunk,'ARCHIVE_BAD_HASH');verifyChunk(row.chunk);check(row.chunk.hash===c.tail.previousHash,'ARCHIVE_BAD_HASH');addScenes([...row.chunk.entries.filter(entry=>entry.scene).slice(-2),...entries]);next();}));
    else addScenes(entries);
   }
   const next=()=>{
    if(tasks.length) { tasks.shift()(); return; }
    if(!fetchedEntities) {
     fetchedEntities=true;
     for(const entityId of [...entities].sort()) {
      for(const prefix of c.run.state.relationshipVersion===1?['e:','q:']:['e:'])tasks.push(()=>get(stores.memory,[c.run.archiveId,prefix+sha256(entityId).slice(0,40),-1],row=>{add(row);next();}));
     }
     next();
     return;
    }
    done({records:[...records.values()],openTotal});
   };
   // Rotation depends on the committed turn only: a retry selects exactly the
   // same rows, while later turns can revisit obligations outside this window.
   const openWindow=(index,range,limit,global=false)=>()=>{
    const source=stores.memory.index(index),count=source.count(range);
    count.onsuccess=guard(()=>{
     const total=count.result;
     if(global)openTotal=total;
     if(!total) { next(); return; }
     const offset=c.run.state.turnId%total;
     let visited=0,wrapped=false;
     const scan=skip=>{
      let first=true;
      const request=source.openCursor(range);
      request.onsuccess=guard(()=>{
       const cursor=request.result;
       if(!cursor) {
        if(!wrapped&&offset&&visited<Math.min(limit,total)) { wrapped=true;scan(0); }
        else next();
        return;
       }
       if(first&&skip) { first=false;cursor.advance(skip);return; }
       first=false;
       add(cursor.value);
       visited++;
       if(visited>=Math.min(limit,total))next();
       else cursor.continue();
      });
     };
     scan(offset);
    });
   };
   for(const entityId of currentIds) {
    const prefix=[c.run.archiveId,-1,entityId,'open'];
    tasks.push(openWindow('storyEntityOpen',IDBKeyRange.bound(prefix,[...prefix,[]]),2));
    tasks.push(()=>{
     let selected=0,visited=0;
     const range=IDBKeyRange.bound([c.run.archiveId,entityId,0],[c.run.archiveId,entityId,Number.MAX_SAFE_INTEGER,[]]);
     const request=stores.memory.index('recent').openCursor(range,'prev');
     request.onsuccess=guard(()=>{
      const cursor=request.result;
      if(!cursor||selected>=2||visited++>=8) { next();return; }
      if(!['entity','ruleRelation'].includes(cursor.value.record.kind)&&cursor.value.record.status!=='open') { add(cursor.value);selected++; }
      cursor.continue();
     });
    });
   }
   tasks.push(openWindow('status',IDBKeyRange.only([c.run.archiveId,'open']),12,true));
   get(stores.runs,c.run.archiveId,run=>{
    check(run&&run.hash===c.run.hash);
    next();
   });
  });
 }
 async _derived(c,scene,memoryDelta) {
  const p=c.pending.pending;
  if(scene===null){check(p.receipt.death&&memoryDelta===null,'ARCHIVE_INVALID_DEATH');return {state:settleDeath(c.run.state,p),records:[{id:'receipt:'+p.identity.turnId,runId:c.run.runId,turnId:p.identity.turnId,source:'rules',kind:'receipt',receipt:clone(p.receipt)}]};}
  check(!p.receipt.death,'ARCHIVE_INVALID_DEATH');
  const related=await this.readRelated(c.run.runId,{entityIds:[...new Set([...c.run.state.relatedEntities.map(e=>e.id),...scene.entities.map(e=>e.id)])],referenceIds:scene.memoryDeltas.flatMap(m=>m.referenceId?[m.referenceId]:[]),includeOpen:false,factsPerEntity:0},c.run.archiveId);
  const context=buildStoryContext(c.run.state,p,related);validateGeneratedScene(scene,context);
  const expected=buildMemoryDelta(p.receipt,scene);check(same(expected,memoryDelta),'ARCHIVE_INVALID_MEMORY');
  const turnId=p.identity.turnId,common={runId:c.run.runId,turnId};
  const records=[{id:'receipt:'+turnId,...common,source:'rules',kind:'receipt',receipt:clone(p.receipt)},...expected.records.map(r=>({...r,...common})),...scene.entities.map(e=>{const prior=related.find(r=>r.kind==='entity'&&r.entity.id===e.id);return {id:'e:'+sha256(e.id).slice(0,40),...common,source:'narrative',kind:'entity',entity:{id:e.id,name:e.name,kind:e.kind,...(e.experience?{experience:clone(e.experience)}:{})},status:prior?.status==='dead'?'dead':e.status??prior?.status??'unknown'};})];
  const nextState=commitTurn(c.run.state,p,scene,context.relationships);
  if(nextState.relationshipVersion===1) {
   for(const entityId of Object.keys(c.run.state.relationshipVersion===1?p.receipt.relationChanges:p.nextLife.relations))records.push({
    id:'q:'+sha256(entityId).slice(0,40),...common,source:'rules',kind:'ruleRelation',
    entityId,value:p.nextLife.relations[entityId],
   });
  }
  const action=p.receipt.action;
  if(action?.intent==='interact'&&c.run.state.relatedEntities.some(entity=>entity.id===action.targetId))records.push({id:'decision:'+turnId,...common,source:'rules',kind:'fact',entityId:action.targetId,text:'你在'+c.run.state.currentScene.location+'选择了“'+action.label+'”。'});
  return {state:nextState,records};
 }
 _writeMemory(store,archiveId,records) {
  for(const record of records){bounded(record,65536);const base={archiveId,id:record.id,record};store.add({...base,version:record.turnId});const entityId=record.entityId??record.entity?.id;store.put({...base,version:-1,...(entityId?{entityKey:[archiveId,entityId],recentKey:[archiveId,entityId,record.turnId,record.id]}:{}),...(record.status==='open'?{statusKey:[archiveId,'open']}:{})});}
 }
 async commit({expectedRevision,nextState,scene,memoryDelta,requestId,expectedAttemptId=null}) {
  ident(requestId);validateLiveState(nextState);const c=await this._capture(nextState.runId);check(c&&(!this.bound||this.bound===c.run.archiveId)&&c.run.state.revision===expectedRevision&&c.pending?.pending.identity.requestId===requestId);
  if(scene!==null)check((c.pending.attempt?.id??null)===expectedAttemptId,'ARCHIVE_ATTEMPT_CONFLICT');
  const derived=await this._derived(c,scene,memoryDelta);check(same(nextState,derived.state),'ARCHIVE_INVALID_STATE');
  return this._commitCaptured(c,c.pending.pending,scene,derived);
 }
 async commitInteraction({expectedArchiveId,expectedRevision,pending}) {
  assertPlainData(pending);pending=clone(pending);
  const c=await this._capture(pending?.identity?.runId);check(c&&c.run.archiveId===expectedArchiveId&&(!this.bound||this.bound===c.run.archiveId)&&c.run.state.revision===expectedRevision&&!c.pending);
  verifyPending(c.run.state,pending);const scene=resolveImmediateInteraction(c.run.state,pending);
  const derived=await this._derived({...c,pending:pendingRow(c.run.archiveId,pending)},scene,buildMemoryDelta(pending.receipt,scene));
  return this._commitCaptured(c,pending,scene,derived);
 }
 async _commitCaptured(c,pending,scene,derived) {
  const nextState=derived.state,entry={identity:clone(pending.identity),receipt:clone(pending.receipt),scene:clone(scene),stateHash:stateHash(nextState)};
  let chunk=makeChunk(c.tail?.index??0,c.tail?.previousHash??ZERO,[...(c.tail?.entries??[]),entry]);
  if(chunk.entries.length>CHUNK_TURNS||encodedBytes(chunk)>CHUNK_BYTES)chunk=makeChunk((c.tail?.index??-1)+1,c.tail?.hash??ZERO,[entry]);verifyChunk(chunk);
  const run={...c.run,state:clone(nextState),hash:entry.stateHash,tailIndex:chunk.index,headHash:chunk.hash};
  await transaction(this.db,'readwrite',(s,get)=>this._cas(s,get,c,()=>{s.history.put({archiveId:run.archiveId,index:chunk.index,chunk});this._writeMemory(s.memory,run.archiveId,derived.records);s.runs.put(run);s.pending.delete(run.archiveId);}));return loaded(run,null);
 }
 async readHistory(runId,cursor=null,limit=32,physical=null) {
  check(Number.isInteger(limit)&&limit>=1&&limit<=128,'ARCHIVE_INVALID_QUERY');const c=await this._capture(runId,physical);if(!c)return {entries:[],cursor:null};
  let index=0,offset=0;if(cursor){keys(cursor,['archiveId','index','offset']);check(cursor.archiveId===c.run.archiveId&&Number.isSafeInteger(cursor.index)&&cursor.index>=0&&Number.isSafeInteger(cursor.offset)&&cursor.offset>=0,'ARCHIVE_INVALID_CURSOR');index=cursor.index;offset=cursor.offset;}
  return transaction(this.db,'readonly',(s,get,done)=>{
   const entries=[];let bytes=0;
   const next=()=>{if(index>c.run.tailIndex){done({entries,cursor:null});return;}const read=chunk=>{check(chunk&&offset<=chunk.entries.length,'ARCHIVE_INVALID_CURSOR');while(offset<chunk.entries.length){const entry=chunk.entries[offset],size=encodedBytes(entry);if(entries.length&&(entries.length===limit||bytes+size>CHUNK_BYTES)){done({entries,cursor:{archiveId:c.run.archiveId,index,offset}});return;}entries.push(entry);bytes+=size;offset++;}index++;offset=0;next();};if(index===c.run.tailIndex)read(c.tail);else get(s.history,[c.run.archiveId,index],row=>read(row?.chunk));};next();
  });
 }
 async _readChunk(archiveId,index) {return transaction(this.db,'readonly',(s,get,done)=>get(s.history,[archiveId,index],r=>done(r?.chunk??null)));}
 async _stage(birth) {
  validateLiveState(birth);check(birth.reincarnation||!birth.life.birth.cultivationProfile?.inheritedBenefits?.length,'REINCARNATION_REQUIRES_SETTLEMENT');check(birth.revision===0&&birth.archiveCursor===0,'ARCHIVE_INVALID_BIRTH');const archiveId=crypto.randomUUID(),run={archiveId,runId:birth.runId,state:clone(birth),birth:clone(birth),hash:stateHash(birth),tailIndex:-1,headHash:ZERO,status:'staging'};await transaction(this.db,'readwrite',s=>s.runs.add(run));return archiveId;
 }
 async _stageEntry(archiveId,entry) {
  keys(entry,['identity','receipt','scene','stateHash']);const c=await this._capture(null,archiveId);check(c?.run.status==='staging');const identity=entry.identity;
  const p=c.run.state.phase==='awaitingOpening'?prepareOpening(c.run.state,{requestId:identity.requestId}):prepareRecordedChoice(c.run.state,entry);check(same(p.identity,identity)&&same(p.receipt,entry.receipt),'ARCHIVE_INVALID_HISTORY');c.pending=pendingRow(archiveId,p);
  const d=await this._derived(c,entry.scene,entry.scene?buildMemoryDelta(p.receipt,entry.scene):null);check(stateHash(d.state)===entry.stateHash,'ARCHIVE_BAD_HASH');
  await transaction(this.db,'readwrite',(s,get)=>get(s.runs,archiveId,run=>{check(run.status==='staging'&&run.hash===c.run.hash);this._writeMemory(s.memory,archiveId,d.records);s.runs.put({...run,state:d.state,hash:entry.stateHash});}));
 }
 async _stageChunk(archiveId,chunk) {verifyChunk(chunk);await transaction(this.db,'readwrite',(s,get)=>get(s.runs,archiveId,run=>{check(run.status==='staging'&&chunk.index===run.tailIndex+1&&chunk.previousHash===run.headHash);s.history.add({archiveId,index:chunk.index,chunk});s.runs.put({...run,tailIndex:chunk.index,headHash:chunk.hash});}));}
 async _validateStage(archiveId,state,pending,attempt,generation,reincarnationClaim=null) {
  validateGeneration(generation,pending,state);
  // A claimed logical life stays spent when an earlier physical backup is
  // restored; only a new settlement requires the exact final death snapshot.
  if(reincarnationClaim)validateReincarnationClaim(reincarnationClaim,state,{matchDeathSnapshot:false});
  validateLiveState(state);validateAttempt(attempt);const c=await this._capture(null,archiveId);check(same(c.run.state,state),'ARCHIVE_INVALID_SNAPSHOT');if(pending)verifyPending(state,pending);else check(attempt===null,'ARCHIVE_INVALID_ATTEMPT');
  await transaction(this.db,'readwrite',(s,get)=>get(s.runs,archiveId,run=>{check(run.status==='staging');s.runs.put({...run,status:'validated',...(reincarnationClaim?{reincarnationClaim}: {})});if(pending)s.pending.put(pendingRow(archiveId,pending,attempt,'SESSION_UNAVAILABLE',generation));}));
 }
 async _discardStage(archiveId) {
  return transaction(this.db,'readwrite',(s,get)=>get(s.runs,archiveId,run=>{
   if(!run||!['staging','validated'].includes(run.status))return;
   const range=IDBKeyRange.bound([archiveId],[archiveId,[]]);
   s.history.delete(range);s.memory.delete(range);s.pending.delete(archiveId);s.runs.delete(archiveId);
  }));
 }
 async activate(archiveId,expectedArchiveId,expectedSnapshot=null) {
  await transaction(this.db,'readwrite',(s,get)=>get(s.runs,ACTIVE,active=>{
   check((active?.target??null)===expectedArchiveId);
   const switchPointer=()=>get(s.runs,archiveId,run=>{check(run?.status==='validated','ARCHIVE_NOT_VALIDATED');verifyImportedLineage(s,get,run,()=>writeClaims(s,get,[reincarnationClaimForChild(run.state),run.reincarnationClaim],()=>{s.runs.put({...run,status:'active'});s.runs.put({archiveId:ACTIVE,target:archiveId});s.runs.put({archiveId:'@run:'+run.runId,target:archiveId});}));});
   if(expectedSnapshot)get(s.runs,expectedArchiveId,run=>{check(run?.hash===expectedSnapshot.run.hash&&run?.headHash===expectedSnapshot.run.headHash);get(s.pending,expectedArchiveId,p=>{check(same(p??null,expectedSnapshot.pending));switchPointer();});});else switchPointer();
  }));this.bound=archiveId;return this.load();
 }
}
