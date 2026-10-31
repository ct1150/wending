import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBrowser } from './helpers/live-browser.js';

test('reopening preserves the previously selected current save despite newer retained and staged records',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
  const a=await open('current-save-upgrade');await born(a,'life-a');await advance(a);
  const old=await a.load(),pending=engine.prepareChoice(old.state,{requestId:'saved-choice',choiceId:old.state.currentScene.choices[0].id});
  await a.prepare(pending);
  const generation={storyActions:false,context:memory.buildStoryContext(old.state,pending,[])};
  await a.setAttempt({runId:'life-a',requestId:'saved-choice',expectedAttemptId:null,attempt:{id:'saved-attempt',sessionRef:'saved-session',retryOf:null},pause:'PROVIDER_TIMEOUT',generation});
  const before=await a.load(),birth=engine.createLiveGame({runId:'life-b',seed:4});
  await a.create({state:birth,pending:engine.prepareOpening(birth,{requestId:'b-opening'}),expectedArchiveId:old.archiveId});
  await a._stage(engine.createLiveGame({runId:'import-stage',seed:8}));
  const validated=await a._stage(engine.createLiveGame({runId:'import-validated',seed:9}));const staged=await a._capture(null,validated);await a._validateStage(validated,staged.run.state,null,null);
  // An older release could select an earlier physical save. Preserve that
  // exact pointer on upgrade instead of choosing the latest retained row.
  await new Promise((resolve,reject)=>{
   const tx=a.db.transaction('runs','readwrite');
   tx.objectStore('runs').put({archiveId:'@active',target:old.archiveId});
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
  });
  a.close();const reopened=await open('current-save-upgrade'),loaded=await reopened.load();
  const {createLiveSession}=await import('/src/ui/live-session.js');let calls=0;
  const client={async capabilities(){calls++;return {available:false};}};
  const session=createLiveSession({archive:reopened,client});
  const resumed=await session.start({runId:'unrequested-replacement',seed:99});
  return {before,loaded,resumed,current:await reopened.load(),history:await reopened.readHistory('life-a'),calls};
 });
 assert.deepEqual(r.loaded,r.before);assert.deepEqual(r.current,r.before);
 assert.deepEqual(r.resumed.state,r.before.state);assert.deepEqual(r.resumed.pending,r.before.pending);
 assert.deepEqual(r.resumed.attempt,r.before.attempt);assert.deepEqual(r.resumed.generation,r.before.generation);
 assert.equal(r.resumed.errorCode,'PROVIDER_TIMEOUT');assert.equal(r.history.entries.length,1);assert.equal(r.calls,0);
});
test('explicit new game replaces the current save and refuses invalid, stale or busy replacements',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js');const archive=await open('single-save-controller');let posts=0,gets=0,cached;
  const client={async capabilities(){return {available:true};},async createSession(){return {sessionRef:'session'};},async requestTurn(p,c,a){posts++;cached={status:'ready',requestId:p.identity.requestId,attemptId:a.id,sessionRef:a.sessionRef,scene:fixture({runId:p.identity.runId,turnId:p.identity.turnId-1})};return {status:'paused',errorCode:'PROVIDER_TIMEOUT'};},async getTurn(){gets++;return cached;}};
  const session=createLiveSession({archive,client});await session.start({runId:'first',seed:42});const old=await archive.load();
  const invalid=await session.startNew({runId:'invalid',seed:8,name:'<a>'},old.archiveId),afterInvalid=await archive.load(),invalidCalls={posts,gets};
  await session.startNew({runId:'second',seed:7},old.archiveId);const second=await archive.load();
  await session.startNew({runId:'stale',seed:8},old.archiveId);const stale=session.view();
  const counts={posts,gets},loaded=await session.load(),afterLoad={posts,gets};
  await session.resume();const resumed=session.view();
  let release,entered;const held=new Promise(resolve=>entered=resolve);client.capabilities=async()=>{entered();await new Promise(resolve=>release=resolve);return {available:false,errorCode:'SERVICE_UNAVAILABLE'};};
  const starting=session.startNew({runId:'third',seed:9},second.archiveId);await held;
  const durable=await archive.load(),busy=await session.startNew({runId:'fourth',seed:10},second.archiveId),busyLoad=await session.load();
  release();await starting;archive.close();
  const reopened=await open('single-save-controller');
  return {old,invalid,afterInvalid,invalidCalls,second,stale,counts,loaded,afterLoad,resumed,durable,busy,busyLoad,current:await reopened.load(),posts,gets};
 });
 assert.equal(r.invalid.errorCode,'BIRTH_CONTEXT_INVALID');assert.deepEqual(r.afterInvalid,r.old);assert.deepEqual(r.invalidCalls,{posts:1,gets:0});
 assert.equal(r.second.state.runId,'second');assert.equal(r.stale.errorCode,'ARCHIVE_CONFLICT');assert.deepEqual(r.afterLoad,r.counts);
 assert.deepEqual(r.loaded.state,r.second.state);assert.deepEqual(r.loaded.pending,r.second.pending);assert.deepEqual(r.loaded.attempt,r.second.attempt);
 assert.equal(r.resumed.state.revision,1);assert.equal(r.resumed.pending,null);assert.equal(r.resumed.state.runId,'second');
 assert.equal(r.busy.errorCode,'SESSION_BUSY');assert.equal(r.busyLoad.errorCode,'SESSION_BUSY');
 assert.equal(r.durable.state.runId,'third');assert.equal(r.durable.state.revision,0);assert.ok(r.durable.pending);assert.equal(r.durable.attempt,null);
 assert.deepEqual(r.current,r.durable);assert.equal(r.posts,2);assert.equal(r.gets,1);
});
test('reopening an imported copy of the current logical run binds later writes to that copy',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
  const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');
  const archive=await open('current-same-run');await born(archive,'shared-run');await advance(archive);const original=await archive.load();
  const imported=await importLiveArchive(exportLiveArchive(archive),archive);
  archive.close();const reopened=await open('current-same-run'),loaded=await reopened.load();
  await advance(reopened);const committed=await reopened.load(),retained=await reopened._capture(null,original.archiveId);
  return {original,imported,loaded,committed,retained:retained.run.state,mapped:await reopened.load('shared-run')};
 });
 assert.notEqual(r.imported.archiveId,r.original.archiveId);assert.deepEqual(r.loaded,r.imported);
 assert.equal(r.committed.archiveId,r.imported.archiveId);assert.equal(r.committed.state.revision,2);
 assert.deepEqual(r.retained,r.original.state);assert.deepEqual(r.mapped,r.committed);
});

for(const method of ['retry','resume'])for(const replacement of ['new journey','imported copy']) {
 test(`stale ${method} refuses a replacement (${replacement}) until the current save is reloaded`,async t=>{
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
   const reloaded=await original.load(),afterLoadCalls={posts:[...posts],gets:[...gets]};
   cached=true;
   const recovered=await original.resume();
   return {displayed,before,beforeCalls,stale,after,afterCalls,reloaded,afterLoadCalls,recovered,posts,gets};
  },{method,replacement});
  assert.notEqual(result.before.archiveId,result.displayed.archiveId);
  assert.equal(result.stale.errorCode,'ARCHIVE_CONFLICT');
  assert.deepEqual(result.afterCalls,result.beforeCalls,'a stale continuation must not query or generate for the replacement');
  assert.deepEqual(result.after,result.before,'the replacement pending, attempt and committed state must remain unchanged');
  assert.equal(result.reloaded.archiveId,result.before.archiveId);
  assert.deepEqual(result.reloaded.state,result.before.state);
  assert.deepEqual(result.reloaded.pending,result.before.pending);
  assert.deepEqual(result.reloaded.attempt,result.before.attempt);
  assert.deepEqual(result.afterLoadCalls,result.beforeCalls);
  assert.equal(result.recovered.state.runId,result.before.state.runId);
  assert.equal(result.recovered.archiveId,result.before.archiveId);
  assert.equal(result.recovered.state.revision,1);
  assert.equal(result.recovered.pending,null);
  assert.deepEqual(result.posts,result.beforeCalls.posts);
  assert.deepEqual(result.gets,[result.before.state.runId]);
 });
}

test('explicit reload after import binds the current save before cached resume',async t=>{
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
  return {original,imported,displayed,loaded,loadCalls,resumed,current:await archive.load(),posts,gets};
 });
 assert.equal(result.displayed.archiveId,result.original.archiveId);
 assert.notEqual(result.imported.archiveId,result.original.archiveId);
 assert.equal(result.loaded.archiveId,result.imported.archiveId);
 assert.deepEqual(result.loadCalls,{posts:1,gets:0});
 assert.equal(result.resumed.archiveId,result.imported.archiveId);
 assert.equal(result.resumed.state.revision,1);
 assert.equal(result.resumed.pending,null);
 assert.equal(result.resumed.errorCode,null);
 assert.equal(result.current.archiveId,result.imported.archiveId);
 assert.deepEqual(result.current.state,result.resumed.state);
 assert.equal(result.posts,1);
 assert.equal(result.gets,1);
});

test('a rejected new-game transaction preserves the current save and never starts inference',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const archive=await open('replacement-abort');await born(archive,'current-life');await advance(archive);
  const before=await archive.load();let calls=0,aborted=false;
  const session=createLiveSession({archive,client:{async capabilities(){calls++;return {available:false};}}});
  await session.load();
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){
   const request=put.apply(this,args);
   if(this.name==='runs'&&args[0].archiveId==='@active')request.addEventListener('success',()=>{aborted=true;this.transaction.abort();});
   return request;
  };
  let rejected;
  try{rejected=await session.startNew({runId:'aborted-life',seed:7},before.archiveId);}
  finally{IDBObjectStore.prototype.put=put;}
  archive.close();const reopened=await open('replacement-abort');
  return {before,rejected,aborted,calls,after:await reopened.load(),replacement:await reopened.load('aborted-life'),history:await reopened.readHistory('current-life')};
 });
 assert.equal(result.aborted,true);assert.equal(result.rejected.status,'paused');
 assert.deepEqual(result.after,result.before);assert.equal(result.replacement,null);
 assert.equal(result.history.entries.length,1);assert.equal(result.calls,0);
});

test('ordinary start preserves a completed death settlement after reopening',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const archive=await open('current-death');await born(archive,'settled-life');
  const enemyId='r:'+identity.sha256('settled-life').slice(0,16)+':t1:e:enemy';
  for(let i=0;i<10;i++){
   const row=await archive.load();if(row.state.phase==='dead')break;
   const pending=row.pending??engine.prepareChoice(row.state,{requestId:'settlement-'+i,choiceId:row.state.currentScene.choices[0].id});
   if(!row.pending)await archive.prepare(pending);
   const scene=pending.receipt.death?null:fixture(row.state,i);
   if(scene){
    scene.entities=[{id:enemyId,name:'山匪',kind:'person',status:'alive'}];
    scene.choices[0]={...scene.choices[0],label:'迎战山匪',intent:'fight',targetId:enemyId,stake:'high',approach:'desperate'};
   }
   await archive.commit({expectedRevision:row.state.revision,nextState:scene?engine.commitTurn(row.state,pending,scene):engine.settleDeath(row.state,pending),scene,memoryDelta:scene?memory.buildMemoryDelta(pending.receipt,scene):null,requestId:pending.identity.requestId});
  }
  const before=await archive.load();archive.close();
  const reopened=await open('current-death');let calls=0;
  const session=createLiveSession({archive:reopened,client:{async capabilities(){calls++;return {available:false};}}});
  const started=await session.start({runId:'unrequested-life',seed:99}),resumed=await session.resume();
  return {before,started,resumed,current:await reopened.load(),calls,history:await reopened.readHistory('settled-life')};
 });
 assert.equal(result.before.state.phase,'dead');assert.equal(result.started.status,'dead');
 assert.deepEqual(result.started.state,result.before.state);assert.equal(result.started.pending,null);
 assert.equal(result.resumed.status,'dead');assert.deepEqual(result.current,result.before);assert.equal(result.calls,0);
 assert.equal(result.history.entries.length,result.before.state.turnId);assert.equal(result.history.entries.at(-1).scene,null);
 assert.equal(result.history.entries.at(-1).receipt.death.cause,'injury');
});

test('a late response for the replaced save cannot commit over the new current save',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const originalArchive=await open('late-replacement'),otherArchive=await open('late-replacement');
  let release,entered;const held=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve),posts=[];
  const client={
   async capabilities(){return {available:true};},
   async createSession(){return {sessionRef:'replacement-session'};},
   async requestTurn(pending,context,attempt){
    posts.push(pending.identity.runId);
    if(pending.identity.runId!=='displayed-life')return {status:'paused',errorCode:'PROVIDER_TIMEOUT'};
    entered();await gate;
    return {status:'ready',requestId:pending.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,scene:fixture({runId:pending.identity.runId,turnId:pending.identity.turnId-1})};
   },
  };
  const original=createLiveSession({archive:originalArchive,client}),starting=original.start({runId:'displayed-life',seed:42});
  await held;const displayed=await originalArchive.load();
  const other=createLiveSession({archive:otherArchive,client});await other.load();
  await other.startNew({runId:'replacement-life',seed:7},displayed.archiveId);
  const before=await otherArchive.load();release();const stale=await starting;
  return {before,stale,after:await otherArchive.load(),old:await originalArchive.load('displayed-life'),displayed,posts};
 });
 assert.equal(result.stale.errorCode,'ARCHIVE_CONFLICT');assert.deepEqual(result.after,result.before);
 assert.equal(result.after.state.runId,'replacement-life');assert.equal(result.after.state.revision,0);
 assert.deepEqual(result.old,result.displayed);assert.deepEqual(result.posts,['displayed-life','replacement-life']);
});
