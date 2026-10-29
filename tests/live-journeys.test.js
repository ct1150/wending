import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBrowser } from './helpers/live-browser.js';

test('native journey directory pages retained alive runs without history or staged imports; selection is CAS',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
  const a=await open('journey-directory');await born(a,'life-a');await advance(a);
  const old=await a.load(),pending=engine.prepareChoice(old.state,{requestId:'saved-choice',choiceId:old.state.currentScene.choices[0].id});
  await a.prepare(pending);await a.setAttempt({runId:'life-a',requestId:'saved-choice',expectedAttemptId:null,attempt:{id:'saved-attempt',sessionRef:'saved-session',retryOf:null}});const before=await a.load();
  const birth=engine.createLiveGame({runId:'life-b',seed:4});const fresh=await a.create({state:birth,pending:engine.prepareOpening(birth,{requestId:'b-opening'}),expectedArchiveId:old.archiveId});
  const stage=await a._stage(engine.createLiveGame({runId:'import-stage',seed:8}));
  const validated=await a._stage(engine.createLiveGame({runId:'import-validated',seed:9}));const staged=await a._capture(null,validated);await a._validateStage(validated,staged.run.state,null,null);
  const original=IDBObjectStore.prototype.get,reads=[];IDBObjectStore.prototype.get=function(...args){reads.push(this.name);return original.apply(this,args);};
  let first,second;try{first=await a.listJourneys({limit:1});second=await a.listJourneys({cursor:first.cursor,limit:1});}finally{IDBObjectStore.prototype.get=original;}
  const selected=await a.selectJourney(old.archiveId,fresh.archiveId);let stale=false,stagedRejected=false;try{await a.selectJourney(fresh.archiveId,fresh.archiveId);}catch(e){stale=e.code==='ARCHIVE_CONFLICT';}try{await a.selectJourney(stage,old.archiveId);}catch{stagedRejected=true;}
  return {old:before,fresh,first,second,reads,selected,stale,stagedRejected,current:await a.load(),history:await a.readHistory('life-a')};
 });
 assert.equal(r.first.entries.length,1);assert.ok(r.first.cursor);assert.equal(r.second.entries.length,1);assert.equal(r.second.cursor,null);
 assert.deepEqual([r.first.entries[0].runId,r.second.entries[0].runId].sort(),['life-a','life-b']);
 for(const entry of [...r.first.entries,...r.second.entries])assert.deepEqual(Object.keys(entry).sort(),['active','archiveId','runId','state']);
 assert.ok(!r.reads.includes('history'));assert.deepEqual(r.selected,r.old);assert.deepEqual(r.current,r.old);assert.equal(r.history.entries.length,1);assert.equal(r.stale,true);assert.equal(r.stagedRejected,true);
});
test('native live controller starts independent alive lives, refuses stale/busy births and restores cached replies explicitly',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js');const archive=await open('journey-controller');let posts=0,gets=0,cached;
  const client={async capabilities(){return {available:true};},async createSession(){return {sessionRef:'session'};},async requestTurn(p,c,a){posts++;cached={status:'ready',requestId:p.identity.requestId,attemptId:a.id,sessionRef:a.sessionRef,scene:fixture({runId:p.identity.runId,turnId:p.identity.turnId-1})};return {status:'paused',errorCode:'PROVIDER_TIMEOUT'};},async getTurn(){gets++;return cached;}};
  const session=createLiveSession({archive,client});await session.start({runId:'first',seed:42});const old=await archive.load(),oldCached=cached;
  await session.startNew({runId:'second',seed:7},old.archiveId);const second=await archive.load();
  await session.startNew({runId:'stale',seed:8},old.archiveId);const stale=session.view();
  const counts={posts,gets};await session.selectJourney(old.archiveId,second.archiveId);const selected=session.view(),afterSelect={posts,gets};
  cached=oldCached;await session.resume();const resumed=session.view();
  let release,entered;const held=new Promise(resolve=>entered=resolve);client.capabilities=async()=>{entered();await new Promise(resolve=>release=resolve);return {available:false,errorCode:'SERVICE_UNAVAILABLE'};};
  const starting=session.startNew({runId:'third',seed:9},old.archiveId);await held;const busy=await session.startNew({runId:'fourth',seed:10},old.archiveId);const busySelect=await session.selectJourney(second.archiveId,old.archiveId);release();await starting;
  return {old,second,stale,counts,selected,afterSelect,resumed,busy,busySelect,entries:(await archive.listJourneys()).entries};
 });
 assert.equal(r.second.state.runId,'second');assert.equal(r.stale.errorCode,'ARCHIVE_CONFLICT');assert.deepEqual(r.afterSelect,r.counts);
 assert.deepEqual(r.selected.state,r.old.state);assert.deepEqual(r.selected.pending,r.old.pending);assert.deepEqual(r.selected.attempt,r.old.attempt);
 assert.equal(r.resumed.state.revision,1);assert.equal(r.resumed.pending,null);assert.equal(r.resumed.state.runId,'first');assert.equal(r.busy.errorCode,'SESSION_BUSY');assert.equal(r.busySelect.errorCode,'SESSION_BUSY');assert.equal(r.entries.length,3);
});
test('selecting a retained copy of an imported logical run restores its write binding',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
  const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');
  const archive=await open('journey-same-run');await born(archive,'shared-run');await advance(archive);const original=await archive.load();
  const imported=await importLiveArchive(exportLiveArchive(archive),archive);
  await advance(archive);const newer=await archive.load();
  await archive.selectJourney(original.archiveId,newer.archiveId);const selected=await archive.load();await advance(archive);const committed=await archive.load();
  return {original,imported,newer,selected,committed,entries:(await archive.listJourneys()).entries};
 });
 assert.notEqual(r.imported.archiveId,r.original.archiveId);assert.deepEqual(r.selected,r.original);assert.equal(r.committed.archiveId,r.original.archiveId);assert.equal(r.committed.state.revision,2);assert.equal(r.entries.length,2);
});

for(const method of ['retry','resume'])for(const replacement of ['new journey','imported copy']) {
 test(`stale ${method} refuses another active archive (${replacement}) and the displayed journey can be selected again`,async t=>{
  const {page}=await liveBrowser(t);
  const result=await page.evaluate(async({method,replacement})=>{
   const {createLiveSession}=await import('/src/ui/live-session.js');
   const originalArchive=await open('stale-continuation'),otherArchive=await open('stale-continuation');
   const posts=[],gets=[];
   let cached=method==='resume';
   const client={
    async capabilities(){return {available:true};},
    async createSession(){return {sessionRef:'continuation-session'};},
    async requestTurn(pending){posts.push(pending.identity.runId);return {status:'paused',errorCode:'PROVIDER_TIMEOUT'};},
    async getTurn(pending,attempt){
     gets.push(pending.identity.runId);
     return cached?{
      status:'ready',requestId:pending.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,
      scene:fixture({runId:pending.identity.runId,turnId:pending.identity.turnId-1}),
     }:{status:'paused',errorCode:'PROVIDER_TIMEOUT'};
    },
   };
   const original=createLiveSession({archive:originalArchive,client});
   await original.startNew({runId:'displayed-life',seed:42},null);
   const displayed=await originalArchive.load();
   if(replacement==='new journey') {
    const other=createLiveSession({archive:otherArchive,client});
    await other.load();
    await other.startNew({runId:'other-life',seed:7},displayed.archiveId);
   } else {
    const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');
    await importLiveArchive(exportLiveArchive(otherArchive),otherArchive);
   }
   const before=await otherArchive.load(),beforeCalls={posts:[...posts],gets:[...gets]};
   const stale=await original[method]();
   const after=await otherArchive.load(),afterCalls={posts:[...posts],gets:[...gets]};
   // Select by physical archive ID: imported copies can share a logical run ID.
   const selected=await original.selectJourney(displayed.archiveId,before.archiveId);
   cached=true;
   const recovered=await original.resume();
   return {displayed,before,beforeCalls,stale,after,afterCalls,selected,recovered,posts,gets};
  },{method,replacement});
  assert.notEqual(result.before.archiveId,result.displayed.archiveId);
  assert.equal(result.stale.errorCode,'ARCHIVE_CONFLICT');
  assert.deepEqual(result.afterCalls,result.beforeCalls,'a stale continuation must not query or generate for the replacement');
  assert.deepEqual(result.after,result.before,'the replacement pending, attempt and committed state must remain unchanged');
  assert.equal(result.selected.archiveId,result.displayed.archiveId);
  assert.deepEqual(result.selected.state,result.displayed.state);
  assert.deepEqual(result.selected.pending,result.displayed.pending);
  assert.deepEqual(result.selected.attempt,result.displayed.attempt);
  assert.equal(result.recovered.state.runId,'displayed-life');
  assert.equal(result.recovered.state.revision,1);
  assert.equal(result.recovered.pending,null);
  assert.deepEqual(result.posts,result.beforeCalls.posts);
  assert.deepEqual(result.gets,['displayed-life']);
 });
}

test('explicit reload after import binds the imported journey before cached resume',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');
  const archive=await open('import-continuation');let posts=0,gets=0,cached;
  const client={
   async capabilities(){return {available:true};},
   async createSession(){return {sessionRef:'import-session'};},
   async requestTurn(pending,context,attempt){
    posts++;
    cached={status:'ready',requestId:pending.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,scene:fixture({runId:pending.identity.runId,turnId:pending.identity.turnId-1})};
    return {status:'paused',errorCode:'PROVIDER_TIMEOUT'};
   },
   async getTurn(){gets++;return cached;},
  };
  const session=createLiveSession({archive,client});
  await session.startNew({runId:'import-life',seed:42},null);
  const original=await archive.load();
  const imported=await importLiveArchive(exportLiveArchive(archive),archive);
  const displayed=session.view(),loaded=await session.load(),loadCalls={posts,gets};
  const resumed=await session.resume();
  const retained=await session.selectJourney(original.archiveId,imported.archiveId);
  return {original,imported,displayed,loaded,loadCalls,resumed,retained,posts,gets};
 });
 assert.equal(result.displayed.archiveId,result.original.archiveId);
 assert.notEqual(result.imported.archiveId,result.original.archiveId);
 assert.equal(result.loaded.archiveId,result.imported.archiveId);
 assert.deepEqual(result.loadCalls,{posts:1,gets:0});
 assert.equal(result.resumed.archiveId,result.imported.archiveId);
 assert.equal(result.resumed.state.revision,1);
 assert.equal(result.resumed.pending,null);
 assert.equal(result.resumed.errorCode,null);
 assert.deepEqual(result.retained.state,result.original.state);
 assert.deepEqual(result.retained.pending,result.original.pending);
 assert.deepEqual(result.retained.attempt,result.original.attempt);
 assert.equal(result.posts,1);
 assert.equal(result.gets,1);
});
