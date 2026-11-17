import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {liveBrowser} from './helpers/live-browser.js';

test('a genuine pre-courier reunion backup retains its exact state and rejects a changed historic companion choice',async t=>{
 const {page}=await liveBrowser(t);
 const old=gunzipSync(await readFile(new URL('./fixtures/f924d32-lin-reunion.jsonl.gz',import.meta.url))).toString('utf8');
 const result=await page.evaluate(async text=>{
  const format=await import('/src/game/live-save-format.js'),{createLiveSession}=await import('/src/ui/live-session.js');
  const archive=await open('old-reunion'),rows=text.trim().split('\n').map(line=>JSON.parse(line));
  await format.importLiveArchive(new Response(text).body,archive);
  let row=await archive.load();const exact=identity.stateHash(row.state)===identity.stateHash(rows[0].state);
  const session=createLiveSession({archive,client:{}});
  for(const key of ['back','affairs-menu','companion-menu','post-book','launch-relay']){
   const s=row.state,action=s.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
   row=await session.choose({choiceId:action.id,baseRevision:s.revision,stateHash:identity.stateHash(s)});
   if(row.errorCode)throw Error(row.errorCode);
  }
  const copy=await open('mixed-reunion');
  await format.importLiveArchive(format.exportLiveArchive(archive),copy);
  const mixed=await copy.load(),stage=await copy._stage(rows[0].birth);
  let rejected=false;
  try{
   for(const entry of rows.filter(r=>r.type==='chunk').flatMap(r=>r.chunk.entries)){
    if(entry.scene?.id.endsWith(':s:event_companion')&&entry.scene.choices.length===2){
     entry.scene.choices[0].label='冒写的旧决定';
     try{await copy._stageEntry(stage,entry);}catch(error){rejected=error.message==='ARCHIVE_INVALID_RULE_SCENE';}
     break;
    }
    await copy._stageEntry(stage,entry);
   }
  }finally{await copy._discardStage(stage);}
  return {exact,rejected,mixed:identity.stateHash(row.state)===identity.stateHash(mixed.state),origin:mixed.state.events.post.origin};
 },old);
 assert.deepEqual(result,{exact:true,rejected:true,mixed:true,origin:'unknown'});
});

test('native event session opens and makes choices without any story service, then refreshes and replays a full backup',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),format=await import('/src/game/live-save-format.js');
  const archive=await open('events-offline');let calls=0;
  const client={capabilities(){calls++;throw Error('offline');},createSession(){calls++;throw Error('offline');},requestTurn(){calls++;throw Error('offline');},getTurn(){calls++;throw Error('offline');}};
  const session=createLiveSession({archive,client});
  let row=await session.startNew({runId:'event-offline',name:'沈渡',seed:42,engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1},null);
  const opening={phase:row.state?.phase,error:row.errorCode,pending:!!row.pending};
  if(row.state?.phase!=='active')return {opening,calls};
  for(const key of ['ask','companion','aid','continue','accept','finish-work','continue','train-menu']){
   const choice=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
   if(!choice)throw Error('missing '+key);
   row=await session.choose({choiceId:choice.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});
   if(row.errorCode)throw Error(row.errorCode);
  }
  const saved=await archive.load(),restoredSession=createLiveSession({archive:await open('events-offline'),client});await restoredSession.load();const refreshed=await restoredSession.resume();
  const text=await new Response(format.exportLiveArchive(archive)).text(),target=await open('events-import');
  await format.importLiveArchive(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(text));c.close();}}),target);
  const imported=await target.load(),history=await target.readHistory(imported.state.runId);
  return {opening,calls,saved,refreshed,imported,historyLength:history.entries.length};
 });
 assert.equal(result.opening.phase,'active',JSON.stringify(result.opening));assert.equal(result.calls,0);
 assert.equal(result.saved.pending,null);assert.equal(result.saved.state.events.entry,'joined');assert.equal(result.saved.state.events.companion,'helped');
 assert.deepEqual(result.saved.state,result.refreshed.state);assert.deepEqual(result.saved.state,result.imported.state);assert.equal(result.historyLength,9);
});

test('native event CAS commits once across tabs and protects an imported physical copy from the old view',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),format=await import('/src/game/live-save-format.js');
  const archive=await open('events-race'),session=createLiveSession({archive,client:{}});
  const row=await session.startNew({runId:'events-race',seed:42,engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1},null);
  if(!row.state)return {error:row.errorCode};
  if(typeof archive.commitEvent!=='function')return {error:'commitEvent missing'};
  const other=await open('events-race');await other.load();
  const p=engine.prepareChoice(row.state,{requestId:'one-decision',choiceId:row.state.currentScene.choices.find(c=>c.id.endsWith(':c:accept')).id});
  const outcomes=await Promise.allSettled([archive.commitEvent({expectedArchiveId:row.archiveId,expectedRevision:row.state.revision,pending:p}),other.commitEvent({expectedArchiveId:row.archiveId,expectedRevision:row.state.revision,pending:p})]);
  const after=await archive.load(),oldSession=createLiveSession({archive:await open('events-race'),client:{}});await oldSession.load();
  await format.importLiveArchive(format.exportLiveArchive(archive),archive);const imported=await archive.load();
  const oldChoice=after.state.currentScene.choices[0],stale=await oldSession.choose({choiceId:oldChoice.id,baseRevision:after.state.revision,stateHash:identity.stateHash(after.state)});
  return {fulfilled:outcomes.filter(o=>o.status==='fulfilled').length,after,imported,stale,final:await archive.load()};
 });
 assert.equal(result.error,undefined,result.error);assert.equal(result.fulfilled,1);assert.equal(result.after.state.revision,2);assert.equal(result.after.pending,null);
 assert.notEqual(result.after.archiveId,result.imported.archiveId);assert.equal(result.stale.errorCode,'ARCHIVE_CONFLICT');assert.deepEqual(result.final.state,result.imported.state);
});

test('native event persistence abort keeps state, pending, history and resources intact',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const archive=await open('events-abort'),session=createLiveSession({archive,client:{}});
  const row=await session.startNew({runId:'events-abort',seed:42,engineVersion:7,originStories:true,experienceVersion:1,eventVersion:1},null);
  if(!row.state||typeof archive.commitEvent!=='function')return {error:row.errorCode??'commitEvent missing'};
  const p=engine.prepareChoice(row.state,{requestId:'accept',choiceId:row.state.currentScene.choices.find(c=>c.id.endsWith(':c:accept')).id});
  const original=archive._writeMemory;archive._writeMemory=()=>{throw Error('injected abort');};
  let failed=false;try{await archive.commitEvent({expectedArchiveId:row.archiveId,expectedRevision:1,pending:p});}catch{failed=true;}finally{archive._writeMemory=original;}
  const after=await archive.load(),history=await archive.readHistory(after.state.runId);
  return {before:row,after,historyLength:history.entries.length,failed};
 });
 assert.equal(result.error,undefined,result.error);assert.equal(result.failed,true);assert.deepEqual(result.after.state,result.before.state);assert.equal(result.after.pending,null);assert.equal(result.historyLength,1);
});

test('optional prose never blocks rule choices and a delayed response cannot attach to another revision',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js');
  const archive=await open('events-prose');let complete,calls=0;
  const client={async capabilities(){return {available:true,proseVersion:1};},async createSession(){return {sessionRef:'prose-session'};},requestProse(brief,attempt){calls++;return new Promise(resolve=>{complete=()=>resolve({status:'ready',requestId:brief.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,prose:{text:'晚风拂过外院。',sourceHash:brief.sourceHash}});});}};
  const session=createLiveSession({archive,client}),row=await session.startNew({runId:'events-prose',seed:42,engineVersion:7,originStories:true,eventVersion:1},null);
  if(typeof session.expandProse!=='function')return {error:'expandProse missing'};
  const waiting=session.expandProse();
  while(!complete)await new Promise(resolve=>setTimeout(resolve,0));
  const during=session.view(),choice=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:accept'));
  const advanced=await session.choose({choiceId:choice.id,baseRevision:1,stateHash:identity.stateHash(row.state)});
  complete();await waiting;const after=session.view();
  return {calls,during,advanced,after,saved:await archive.load()};
 });
 assert.equal(result.error,undefined,result.error);assert.equal(result.calls,1);assert.equal(result.during.busy,false);assert.equal(result.during.pending,null);assert.equal(result.during.prose.status,'loading');
 assert.equal(result.advanced.state.revision,2);assert.equal(result.after.prose,null);assert.deepEqual(result.saved.state,result.advanced.state);
});

test('event death and rebirth stay offline, preserve the event birth contract and spend a claim once',async t=>{
 const {page}=await liveBrowser(t);
 const result=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),{buildRebirthOptions}=await import('/src/game/cultivation/live/reincarnation.js');
  const archive=await open('events-rebirth'),session=createLiveSession({archive,client:{}});
  let row=await session.startNew({runId:'events-parent',seed:42,engineVersion:7,originStories:true,eventVersion:1},null);
  const pick=async key=>{const c=row.state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));if(!c)throw Error('missing '+key);row=await session.choose({choiceId:c.id,baseRevision:row.state.revision,stateHash:identity.stateHash(row.state)});if(row.errorCode)throw Error(row.errorCode);};
  for(const key of ['decline','journey-menu','river-book','river-open','deliberate','policy-0','next-case','river-open','clue-1','river-back','train-menu'])await pick(key);
  let count=0;
  while(row.state.phase!=='dead'&&count++<100){await pick('practice');if(row.state.phase==='dead')break;await pick('train-menu');if(row.state.life.cultivationProfile.spirit<40||row.state.life.injury>1){await pick('rest-menu');await pick('recover');if(row.state.phase!=='dead')await pick('train-menu');}}
  const parent=await archive.load(),options=buildRebirthOptions(parent.state,[]);
  const child=await session.reincarnate({runId:'events-child',seed:7,name:'来者'},[],parent.archiveId);
  const parentAfter=await archive.load('events-parent');
  const again=await session.reincarnate({runId:'events-child-again',seed:8},[],parent.archiveId);
  return {parent,options,child,parentAfter,again};
 });
 assert.equal(result.parent.state.phase,'dead');assert.equal(result.options.eventVersion,1);assert.equal(result.child.errorCode,null,JSON.stringify(result.child));
 assert.equal(result.child.state.phase,'active');assert.equal(result.child.state.events.node,'arrival');assert.equal(result.child.state.life.birth.cultivationProfile.eventVersion,1);assert.equal(result.parentAfter.reincarnatedTo,'events-child');
 assert.ok(result.again.errorCode);assert.equal(result.again.state.runId,'events-child');
 assert.deepEqual(result.child.state.events.river,{record:'0',seen:2});
 assert.equal(result.child.state.events.entry,'unresolved');
 assert.equal(result.child.state.life.items.herbs??0,0);
});
