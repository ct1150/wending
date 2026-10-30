import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBrowser } from './helpers/live-browser.js';
test('native IDB atomically fixes birth, persists attempts, rejects forged commit and competing tabs',async t=>{
 const {page}=await liveBrowser(t);const result=await page.evaluate(async()=>{
 const a=await open('archive-basic');const birth=await born(a);a.close();const b=await open('archive-basic');const loaded=await b.load();
 const attempt={id:'attempt-1',sessionRef:'session-1',retryOf:null};const races=await Promise.allSettled([b.setAttempt({runId:loaded.state.runId,requestId:'opening',expectedAttemptId:null,attempt}),b.setAttempt({runId:loaded.state.runId,requestId:'opening',expectedAttemptId:null,attempt:{...attempt,id:'attempt-2'}})]);
 const scene=fixture(loaded.state),nextState=engine.commitTurn(loaded.state,loaded.pending,scene),args={expectedRevision:0,nextState,scene,memoryDelta:memory.buildMemoryDelta(loaded.pending.receipt,scene),requestId:'opening',expectedAttemptId:(await b.load()).attempt.id};
 let forged=false;try{await b.commit({...args,nextState:{...nextState,rng:1}});}catch{forged=true;}
 const c=await open('archive-basic');const commits=await Promise.allSettled([b.commit(args),c.commit(args)]);const page=await b.readHistory(birth.state.runId);return {birth,loaded,races:races.map(r=>r.status),commits:commits.map(r=>r.status),forged,count:page.entries.length,current:await b.load()};});
 assert.deepEqual(result.loaded.state,result.birth.state);assert.deepEqual(result.loaded.pending,result.birth.pending);assert.equal(result.races.filter(x=>x==='fulfilled').length,1);assert.equal(result.commits.filter(x=>x==='fulfilled').length,1);assert.equal(result.forged,true);assert.equal(result.count,1);assert.equal(result.current.pending,null);
});
test('history crosses 128-turn and UTF-8 byte chunks beyond 1MiB with stable pages and full streaming restore',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
 const a=await open('archive-long');await born(a);for(let i=0;i<130;i++)await advance(a);
 const at128=await a._readChunk((await a.load()).archiveId,0);for(let i=0;i<160;i++)await advance(a,1900);
 const c=await a._capture();const chunks=[];for(let i=0;i<=c.run.tailIndex;i++)chunks.push(await a._readChunk(c.run.archiveId,i));
 let cursor=null,entries=[];do{const p=await a.readHistory('archive-run',cursor,17);entries.push(...p.entries);cursor=p.cursor;}while(cursor);
 const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');const restoredArchive=await open('archive-long-restored');const restored=await importLiveArchive(exportLiveArchive(a),restoredArchive);return {restored:restored.state,firstCount:at128.entries.length,chunks:chunks.map(c=>({count:c.entries.length,size:new TextEncoder().encode(JSON.stringify(c)).length,hash:c.hash,previousHash:c.previousHash})),total:chunks.reduce((n,c)=>n+new TextEncoder().encode(JSON.stringify(c)).length,0),turns:entries.map(e=>e.identity.turnId),revision:c.run.state.revision};});
 assert.equal(r.firstCount,128);assert.ok(r.total>1024*1024);assert.equal(r.revision,290);assert.equal(r.restored.revision,290);assert.ok(r.chunks.some(c=>c.count<128));assert.deepEqual(r.turns,Array.from({length:290},(_,i)=>i+1));for(let i=0;i<r.chunks.length;i++){assert.ok(r.chunks[i].count<=128);assert.ok(r.chunks[i].size<=256*1024);if(i)assert.equal(r.chunks[i].previousHash,r.chunks[i-1].hash);}
});
test('permanent promise versions and NPC tombstones survive indexed retrieval and cannot reopen',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
 const a=await open('archive-memory');await born(a);let l=await a.load(),scene=fixture(l.state,l.state.turnId),npc={id:scene.id.replace('s:local','e:guide'),name:'渡者',kind:'person',status:'alive'};scene.entities=[npc];scene.memoryDeltas=[{entityId:npc.id,kind:'promise',text:'替渡者寻回旧桨。'}];
 const commit=async(s)=>{const l=await a.load(),p=l.pending??engine.prepareChoice(l.state,{requestId:'r-'+l.state.turnId,choiceId:l.state.currentScene.choices[0].id});if(!l.pending)await a.prepare(p);return a.commit({expectedRevision:l.state.revision,nextState:engine.commitTurn(l.state,p,s),scene:s,memoryDelta:memory.buildMemoryDelta(p.receipt,s),requestId:p.identity.requestId});};
 await commit(scene);const openRows=await a.readRelated('archive-run'),promise=openRows.find(r=>r.kind==='promise');l=await a.load();scene=fixture(l.state,l.state.turnId);scene.entities=[{...npc,status:'dead'}];scene.memoryDeltas=[{entityId:npc.id,kind:'promise',text:promise.text,referenceId:promise.id,status:'resolved'},{entityId:npc.id,kind:'death',text:'渡者在洪水中身亡。'}];await commit(scene);
 const rows=await a.readRelated('archive-run',{entityIds:[npc.id],referenceIds:[promise.id]});l=await a.load();scene=fixture(l.state,l.state.turnId);scene.entities=[npc];let resurrection=false;try{await commit(scene);}catch{resurrection=true;}
 const versions=await new Promise((resolve,reject)=>{const tx=a.db.transaction('memory'),req=tx.objectStore('memory').getAll(IDBKeyRange.bound([(l.archiveId),promise.id,0],[l.archiveId,promise.id,Number.MAX_SAFE_INTEGER]));req.onsuccess=()=>resolve(req.result.map(r=>r.record.status));req.onerror=()=>reject(req.error);});const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');const b=await open('archive-memory-restored');await importLiveArchive(exportLiveArchive(a),b);const restoredRows=await b.readRelated('archive-run',{entityIds:[npc.id],referenceIds:[promise.id]});return {openRows,rows,versions,resurrection,restoredRows};});
 assert.ok(r.openRows.some(r=>r.kind==='entity'));assert.deepEqual(r.versions,['open','resolved']);assert.equal(r.rows.find(r=>r.kind==='promise').status,'resolved');assert.equal(r.rows.find(r=>r.kind==='entity').status,'dead');assert.equal(r.resurrection,true);assert.deepEqual(r.restoredRows,r.rows);
});
test('injected native transaction abort rolls back writes and preserves recoverable pending',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{const a=await open('archive-abort');await born(a);const before=await a.load();const original=IDBObjectStore.prototype.put;let aborted=false;IDBObjectStore.prototype.put=function(...args){const request=original.apply(this,args);if(this.name==='history'){request.addEventListener('success',()=>{aborted=true;this.transaction.abort();});}return request;};let rejected=false;try{await advance(a);}catch{rejected=true;}finally{IDBObjectStore.prototype.put=original;}a.close();const b=await open('archive-abort');return {before,after:await b.load(),history:await b.readHistory('archive-run'),aborted,rejected};});
 assert.equal(r.aborted,true);assert.equal(r.rejected,true);assert.deepEqual(r.after,r.before);assert.equal(r.history.entries.length,0);
});
test('quota probe reports native enforcement honestly; injected quota error rolls back archive commit',async t=>{
 const {page,context,origin}=await liveBrowser(t);await page.evaluate(async()=>{globalThis.quotaArchive=await open('archive-quota');await born(quotaArchive);await advance(quotaArchive);const l=await quotaArchive.load();await quotaArchive.prepare(engine.prepareChoice(l.state,{requestId:'quota-choice',choiceId:l.state.currentScene.choices[0].id}));});
 const before=await page.evaluate(()=>quotaArchive.load()),cdp=await context.newCDPSession(page);await cdp.send('Storage.overrideQuotaForOrigin',{origin,quotaSize:1});
 const probe=await page.evaluate(async()=>new Promise(resolve=>{const tx=quotaArchive.db.transaction('runs','readwrite');tx.objectStore('runs').put({archiveId:'quota-probe-only',payload:new Blob([new Uint8Array(8*1024*1024)])});tx.oncomplete=()=>resolve('not-enforced');tx.onabort=()=>resolve(tx.error?.name);}));
 await cdp.send('Storage.overrideQuotaForOrigin',{origin});assert.ok(['QuotaExceededError','not-enforced'].includes(probe));t.diagnostic(probe==='QuotaExceededError'?'Native browser QuotaExceededError observed in isolated probe.':'CDP quota override not enforced by this Chromium build; natural QuotaExceededError remains unverified. Rollback test below explicitly injects quota error.');
 const injected=await page.evaluate(async()=>{await new Promise(resolve=>{const tx=quotaArchive.db.transaction('runs','readwrite');tx.objectStore('runs').delete('quota-probe-only');tx.oncomplete=resolve;});const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='runs')throw new DOMException('Injected quota failure','QuotaExceededError');return original.apply(this,args);};try{await advance(quotaArchive);return null;}catch(e){return e.name;}finally{IDBObjectStore.prototype.put=original;}});
 assert.equal(injected,'QuotaExceededError');assert.deepEqual(await page.evaluate(()=>quotaArchive.load()),before);const recovered=await page.evaluate(()=>advance(quotaArchive));assert.equal(recovered.state.revision,2);
});
test('rules-confirmed death is atomically archived with null scene and permanent receipt',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{const a=await open('archive-death');await born(a);let l=await a.load();let s=fixture(l.state);s.choices[0].approach='retire';let p=l.pending;await a.commit({expectedRevision:0,nextState:engine.commitTurn(l.state,p,s),scene:s,memoryDelta:memory.buildMemoryDelta(p.receipt,s),requestId:p.identity.requestId});while((l=await a.load()).state.phase!=='dead'){p=engine.prepareChoice(l.state,{requestId:'death-'+l.state.turnId,choiceId:l.state.currentScene.choices[0].id});await a.prepare(p);s=p.receipt.death?null:fixture(l.state,l.state.turnId);if(s)s.choices[0].approach='retire';await a.commit({expectedRevision:l.state.revision,nextState:s?engine.commitTurn(l.state,p,s):engine.settleDeath(l.state,p),scene:s,memoryDelta:s?memory.buildMemoryDelta(p.receipt,s):null,requestId:p.identity.requestId});}const h=await a.readHistory('archive-run',null,128);const receipts=await a.readRelated('archive-run',{referenceIds:['receipt:'+l.state.turnId],includeOpen:false});return {state:l.state,last:h.entries.at(-1),receipts};});
 assert.equal(r.state.phase,'dead');assert.equal(r.last.scene,null);assert.equal(r.last.receipt.death.cause,'lifespan');assert.equal(r.receipts[0]?.kind,'receipt');assert.deepEqual(r.receipts[0].receipt,r.last.receipt);
});
test('page refresh preserves fixed birth/choice and rejects credential fields in attempt metadata',async t=>{
 const {page}=await liveBrowser(t);const before=await page.evaluate(async()=>{const a=await open('archive-refresh');await born(a);await advance(a);const l=await a.load();await a.prepare(engine.prepareChoice(l.state,{requestId:'refresh-choice',choiceId:l.state.currentScene.choices[0].id}));let rejected=false;try{await a.setAttempt({runId:'archive-run',requestId:'refresh-choice',expectedAttemptId:null,attempt:{id:'unsafe',sessionRef:'public-ref',retryOf:null,Authorization:'secret'}});}catch{rejected=true;}return {loaded:await a.load(),rejected};});await page.reload();const after=await page.evaluate(async()=>{const {openLiveArchive}=await import('/src/game/live-archive.js');return (await openLiveArchive({name:'archive-refresh'})).load();});assert.equal(before.rejected,true);assert.deepEqual(after,before.loaded);
});
test('explicit new-life creation CAS preserves old history and rejects a stale tab',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{const a=await open('archive-new-life');await born(a);await advance(a);const old=await a.load();const state=engine.createLiveGame({runId:'second-life',seed:7}),pending=engine.prepareOpening(state,{requestId:'second-opening'});const fresh=await a.create({state,pending,expectedArchiveId:old.archiveId});let stale=false;try{const state=engine.createLiveGame({runId:'stale-life'});await a.create({state,pending:engine.prepareOpening(state,{requestId:'stale-opening'}),expectedArchiveId:old.archiveId});}catch{stale=true;}return {fresh,current:await a.load(),old:await a.load('archive-run'),history:await a.readHistory('archive-run'),stale};});assert.equal(r.fresh.state.runId,'second-life');assert.equal(r.current.archiveId,r.fresh.archiveId);assert.equal(r.old.state.revision,1);assert.equal(r.history.entries.length,1);assert.equal(r.stale,true);
});
test('injected storage permission denial fails without replacing existing archive',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{const a=await open('archive-permission');await born(a);const before=await a.load(),original=IDBFactory.prototype.open;IDBFactory.prototype.open=function(){throw new DOMException('Injected storage denial','SecurityError');};let error;try{await open('archive-permission');}catch(e){error=e.name;}finally{IDBFactory.prototype.open=original;}return {before,error,after:await a.load()};});assert.equal(r.error,'SecurityError');assert.deepEqual(r.after,r.before);
});
test('late response from an older attempt cannot commit after an explicit retry is durable',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{const a=await open('archive-late-attempt');await born(a);let l=await a.load();const first={id:'attempt-first',sessionRef:'session-first',retryOf:null};await a.setAttempt({runId:l.state.runId,requestId:'opening',expectedAttemptId:null,attempt:first});const second={id:'attempt-retry',sessionRef:'session-next',retryOf:{attemptId:first.id,sessionRef:first.sessionRef}};await a.setAttempt({runId:l.state.runId,requestId:'opening',expectedAttemptId:first.id,attempt:second});const before=await a.load(),scene=fixture(l.state),args={expectedRevision:0,nextState:engine.commitTurn(l.state,l.pending,scene),scene,memoryDelta:memory.buildMemoryDelta(l.pending.receipt,scene),requestId:'opening'};let rejected=false;try{await a.commit({...args,expectedAttemptId:first.id});}catch{rejected=true;}const after=await a.load();if(rejected)await a.commit({...args,expectedAttemptId:second.id});return {rejected,before,after,final:await a.load()};});assert.equal(r.rejected,true);assert.deepEqual(r.after,r.before);assert.equal(r.final.state.revision,1);
});

test('bounded story retrieval preserves 17 facts, 13 large obligations and dead identities across retry and export',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const archive=await open('archive-selected-memory');await born(archive);
  const initial=await archive.load(),first=fixture(initial.state,0);
  const actor={id:first.id.replace('s:local','e:guide'),name:'渡者',kind:'person',status:'alive'};
  const dead={id:first.id.replace('s:local','e:departed'),name:'故人',kind:'person',status:'dead'};
  const place={id:first.id.replace('s:local','e:bank'),name:'河岸',kind:'place'};
  async function commit(scene){const row=await archive.load(),pending=row.pending??engine.prepareChoice(row.state,{requestId:'memory-'+row.state.turnId,choiceId:row.state.currentScene.choices[0].id});if(!row.pending)await archive.prepare(pending);return archive.commit({expectedRevision:row.state.revision,nextState:engine.commitTurn(row.state,pending,scene),scene,memoryDelta:memory.buildMemoryDelta(pending.receipt,scene),requestId:pending.identity.requestId});}
  first.entities=[actor,dead,place];first.memoryDeltas=[{kind:'death',entityId:dead.id,text:'故人已亡。'},...Array.from({length:9},(_,i)=>({kind:'fact',entityId:actor.id,text:'往事'+i+'山'.repeat(200)})),...Array.from({length:6},(_,i)=>({kind:'promise',entityId:place.id,text:'河岸旧约'+i+'约'.repeat(300)}))];await commit(first);
  let row=await archive.load();const second=fixture(row.state,1);second.entities=[actor,dead,place];second.memoryDeltas=[...Array.from({length:8},(_,i)=>({kind:'fact',entityId:actor.id,text:'往事'+(9+i)+'山'.repeat(200)})),...Array.from({length:7},(_,i)=>({kind:'promise',entityId:place.id,text:'河岸旧约'+(6+i)+'约'.repeat(300)}))];await commit(second);
  row=await archive.load();const pending=engine.prepareChoice(row.state,{requestId:'fixed-selection',choiceId:row.state.currentScene.choices[0].id});await archive.prepare(pending);
  const selection=await archive.readStoryRecords(row.state.runId,{entityIds:[actor.id,dead.id,place.id]});
  const context=memory.buildStoryContext(row.state,pending,selection.records,{selection:'relevance-v1',openTotal:selection.openTotal});
  const repeated=await archive.readStoryRecords(row.state.runId,{entityIds:[place.id,actor.id,dead.id]});
  const retried=memory.buildStoryContext(row.state,pending,repeated.records,{selection:'relevance-v1',openTotal:repeated.openTotal});
  const {createLiveSession}=await import('/src/ui/live-session.js');let sent;
  const session=createLiveSession({archive,client:{capabilities:async()=>({available:true}),createSession:async()=>({sessionRef:'memory-session'}),requestTurn:async(p,c,a)=>{sent=c;const scene=fixture(row.state,2);scene.entities=[actor,dead,place];return {status:'ready',requestId:p.identity.requestId,attemptId:a.id,sessionRef:a.sessionRef,scene};}}});
  await session.retry();
  const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');
  const restored=await open('archive-selected-restored');await importLiveArchive(exportLiveArchive(archive),restored);
  const rows=await restored.readRelated(row.state.runId,{entityIds:[actor.id,dead.id,place.id],includeOpen:true,factsPerEntity:16});
  const history=await restored.readHistory(row.state.runId,null,128);
  const cachedBase=await restored.load();
  const cachedPending=engine.prepareChoice(cachedBase.state,{requestId:'cached-closure',choiceId:cachedBase.state.currentScene.choices[0].id});
  await restored.prepare(cachedPending);
  const attempt={id:'cached-attempt',sessionRef:'prior-session',retryOf:null};
  await restored.setAttempt({runId:row.state.runId,requestId:'cached-closure',expectedAttemptId:null,attempt});
  const omitted=rows.find(record=>record.kind==='promise'&&!context.references.includes(record.id));
  const cachedScene=fixture(cachedBase.state,3);cachedScene.entities=[actor,dead,place];
  cachedScene.memoryDeltas=[{kind:'promise',entityId:omitted.entityId,text:omitted.text,referenceId:omitted.id,status:'resolved'}];
  const cachedSession=createLiveSession({archive:restored,client:{getTurn:async()=>({status:'ready',requestId:'cached-closure',attemptId:attempt.id,sessionRef:attempt.sessionRef,scene:cachedScene})}});
  await cachedSession.resume();
  const closureRows=await restored.readRelated(row.state.runId,{referenceIds:[omitted.id],includeOpen:true});
  return {selection,context,retried,sent,after:await archive.load(),pending,rows,historyCount:history.entries.length,historyFactCount:history.entries.flatMap(entry=>entry.scene?.memoryDeltas??[]).filter(delta=>delta.kind==='fact').length,cached:cachedSession.view(),closureRows,closedId:omitted.id};
 });
 assert.equal(result.selection.openTotal,13);
 assert.deepEqual(result.context,result.retried);
 assert.deepEqual(result.sent.receipt,result.pending.receipt);
 assert.equal(result.after.state.revision,3);assert.equal(result.after.pending,null);
 assert.ok(result.context.coverage.openOmitted>0);
 assert.ok(new TextEncoder().encode(JSON.stringify(result.context)).length<=7000);
 assert.ok(result.context.entities.some(entity=>entity.status==='dead'));
 assert.equal(result.rows.filter(row=>row.kind==='promise'&&row.status==='open').length,13);
 assert.equal(result.historyCount,3);assert.equal(result.historyFactCount,17);
 assert.equal(result.cached.state.revision,4);assert.equal(result.cached.pending,null);
 assert.equal(result.closureRows.find(row=>row.id===result.closedId).status,'resolved');
 assert.equal(result.closureRows.filter(row=>row.kind==='promise'&&row.status==='open').length,12);
 // readRelated's factual window stays bounded; full history retains all 17.
 assert.equal(result.rows.filter(row=>row.kind==='fact').length,16);
});

test('native v1 database upgrades additively without changing active run, pending, history or memory',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const source=await open('upgrade-source');await born(source);
  const opening=await source.load(),scene=fixture(opening.state),entity={id:scene.id.replace('s:local','e:upgrade'),name:'旧渡者',kind:'person'};
  scene.entities=[entity];scene.memoryDeltas=[{kind:'promise',entityId:entity.id,text:'升级前已承诺守住渡口。'}];
  await source.commit({expectedRevision:0,nextState:engine.commitTurn(opening.state,opening.pending,scene),scene,memoryDelta:memory.buildMemoryDelta(opening.pending.receipt,scene),requestId:opening.pending.identity.requestId});
  let row=await source.load();const pending=engine.prepareChoice(row.state,{requestId:'upgrade-pending',choiceId:row.state.currentScene.choices[0].id});await source.prepare(pending);await source.setAttempt({runId:row.state.runId,requestId:pending.identity.requestId,expectedAttemptId:null,attempt:{id:'upgrade-attempt',sessionRef:'old-session',retryOf:null}});
  const dump=archive=>new Promise((resolve,reject)=>{const names=['runs','pending','history','memory'],tx=archive.db.transaction(names),data={};for(const name of names){const req=tx.objectStore(name).getAll();req.onsuccess=()=>data[name]=req.result;}tx.oncomplete=()=>resolve(data);tx.onabort=()=>reject(tx.error);});
  const before=await dump(source),loaded=await source.load();source.close();
  const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('native-v1-upgrade',1);req.onupgradeneeded=()=>{const db=req.result;db.createObjectStore('runs',{keyPath:'archiveId'});db.createObjectStore('pending',{keyPath:'archiveId'});db.createObjectStore('history',{keyPath:['archiveId','index']});const memory=db.createObjectStore('memory',{keyPath:['archiveId','id','version']});memory.createIndex('entity','entityKey');memory.createIndex('status','statusKey');memory.createIndex('recent','recentKey');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction(Object.keys(before),'readwrite');for(const [name,rows] of Object.entries(before))for(const item of rows)tx.objectStore(name).put(item);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
  const upgraded=await open('native-v1-upgrade');
  return {before,after:await dump(upgraded),loaded,restored:await upgraded.load(),version:upgraded.db.version,selection:await upgraded.readStoryRecords(loaded.state.runId,{entityIds:[entity.id]})};
 });
 assert.equal(result.version,3);assert.deepEqual(result.after,result.before);assert.deepEqual(result.restored,result.loaded);assert.equal(result.selection.openTotal,1);assert.equal(result.selection.records.filter(row=>row.kind==='promise'&&row.status==='open').length,1);
});
