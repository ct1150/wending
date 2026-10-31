import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBrowser } from './helpers/live-browser.js';

test('a legacy archive whose next context nearly fills 7000 bytes still imports and preserves its state hash',async t=>{
  const {page}=await liveBrowser(t);
  const result=await page.evaluate(async()=>{
    const {makeChunk}=await import('/src/game/live-archive.js');
    const {importLiveArchive,exportLiveArchive}=await import('/src/game/live-save-format.js');
    // This legal pre-retrieval scene was independently accepted by origin/main.
    // Construct its legacy JSONL directly so a new writer cannot hide a replay regression.
    const birth=engine.createLiveGame({runId:'old-boundary',seed:42}),pending=engine.prepareOpening(birth,{requestId:'old-opening'});
    const prefix='r:'+identity.sha256(birth.runId).slice(0,16)+':t1:';
    const scene={id:prefix+'s:scene',title:'山路',location:'山间',blocks:[{kind:'narration',text:'你沿山路继续前行。'}],entities:Array.from({length:19},(_,i)=>({id:prefix+'e:'+i,name:'甲'.repeat(57)+String.fromCharCode(0x4e00+i),kind:'person'})),choices:[{id:prefix+'c:rest',label:'歇息调养',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:prefix+'c:practice',label:'凝神修行',intent:'practice',targetId:'self',stake:'low',approach:'steady'}],memoryDeltas:[]};
    const state=engine.commitTurn(birth,pending,scene),stateHash=identity.stateHash(state);
    const header={type:'header',format:'wending-live-jsonl',version:1,memoryVersion:1,birth,state,pending:null,attempt:null};
    const chunk=makeChunk(0,'0'.repeat(64),[{identity:pending.identity,receipt:pending.receipt,scene,stateHash}]);
    const footer={type:'footer',chunks:1,turns:1,headHash:chunk.hash,manifest:identity.sha256(identity.sha256(JSON.stringify(header))+chunk.hash)};
    const serialized=[header,{type:'chunk',chunk},footer].map(row=>JSON.stringify(row)+'\n').join('');
    const archive=await open('retrieval-legacy-boundary'),restored=await importLiveArchive(new Blob([serialized]).stream(),archive);
    const next=engine.prepareChoice(restored.state,{requestId:'r'.repeat(80),choiceId:scene.choices[1].id});
    const context=memory.buildStoryContext(restored.state,next,[],{selection:'relevance-v1',openTotal:Number.MAX_SAFE_INTEGER,continuity:false});
    const roundtrip=await new Response(exportLiveArchive(archive)).text();
    return {stateHash,restoredHash:identity.stateHash(restored.state),bytes:new TextEncoder().encode(JSON.stringify(context)).length,escapedBytes:new TextEncoder().encode(JSON.stringify(JSON.stringify(context))).length,contextHasRetrieval:Object.hasOwn(context,'retrieval'),roundtrip,serialized};
  });
  assert.equal(result.restoredHash,result.stateHash);
  assert.ok(result.bytes<=7000);assert.ok(result.escapedBytes<=7000);
  assert.equal(result.contextHasRetrieval,false,'optional capability must yield to a legal legacy context');
  assert.equal(result.roundtrip,result.serialized);
});

test('mixed old and retrieval scenes replay with the same state hash and frozen retry context',async t=>{
  const {page}=await liveBrowser(t);
  const result=await page.evaluate(async()=>{
    const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');
    const archive=await open('retrieval-archive'),birth=await born(archive,'retrieval-archive-run');
    await advance(archive);
    const old=await archive.load(),oldHash=identity.stateHash(old.state);
    const pending=engine.prepareChoice(old.state,{requestId:'retrieval-accepted',choiceId:old.state.currentScene.choices[0].id});
    await archive.prepare(pending);
    const context=memory.buildStoryContext(old.state,pending),attempt={id:'retrieval-accepted-attempt',sessionRef:'retrieval-session',retryOf:null};
    await archive.setAttempt({runId:old.state.runId,requestId:pending.identity.requestId,expectedAttemptId:null,attempt,generation:{storyActions:true,context}});
    const scene=fixture(old.state,2);
    scene.retrieval={version:1,corpusVersion:'fanren-test-v1',queryHash:identity.sha256(identity.canonicalStringify(context)),cardIds:['WD-FR-17'],evidenceIds:['FR-E-1701','FR-E-1702'],families:['uncertain_witness']};
    const nextState=engine.commitTurn(old.state,pending,scene);
    await archive.commit({expectedRevision:old.state.revision,expectedAttemptId:attempt.id,nextState,scene,memoryDelta:memory.buildMemoryDelta(pending.receipt,scene),requestId:pending.identity.requestId});
    const accepted=await archive.load(),nextPending=engine.prepareChoice(accepted.state,{requestId:'retrieval-pending',choiceId:accepted.state.currentScene.choices[0].id});
    await archive.prepare(nextPending);
    const nextContext=memory.buildStoryContext(accepted.state,nextPending),generation={storyActions:true,context:nextContext},first={id:'retrieval-first',sessionRef:'retrieval-session',retryOf:null};
    await archive.setAttempt({runId:accepted.state.runId,requestId:nextPending.identity.requestId,expectedAttemptId:null,attempt:first,generation});
    const retry={id:'retrieval-retry',sessionRef:'retrieval-session',retryOf:{attemptId:first.id,sessionRef:first.sessionRef}};
    await archive.setAttempt({runId:accepted.state.runId,requestId:nextPending.identity.requestId,expectedAttemptId:first.id,attempt:retry,generation});
    let changedRetryRejected=false;
    const altered=structuredClone(generation);altered.context.retrieval.recentCardIds.push('WD-FORGED');
    try{await archive.setAttempt({runId:accepted.state.runId,requestId:nextPending.identity.requestId,expectedAttemptId:retry.id,attempt:{id:'retrieval-forged-retry',sessionRef:retry.sessionRef,retryOf:{attemptId:retry.id,sessionRef:retry.sessionRef}},generation:altered});}catch{changedRetryRejected=true;}
    const before=await archive.load(),exported=await new Response(exportLiveArchive(archive)).text();
    const restoredArchive=await open('retrieval-restored'),restored=await importLiveArchive(new Blob([exported]).stream(),restoredArchive);
    const history=await restoredArchive.readHistory(restored.state.runId);
    return {birthHasMetadata:Object.hasOwn(birth.state,'retrieval'),oldHasMetadata:Object.hasOwn(old.state,'retrieval'),oldHash,history:history.entries,before,restored,changedRetryRejected,exported};
  });
  assert.equal(result.birthHasMetadata,false);
  assert.equal(result.oldHasMetadata,false);
  assert.equal(result.history[0].stateHash,result.oldHash);
  assert.equal(Object.hasOwn(result.history[0].scene,'retrieval'),false);
  assert.deepEqual(result.history[1].scene.retrieval.evidenceIds,['FR-E-1701','FR-E-1702']);
  assert.deepEqual(result.restored.state,result.before.state);
  assert.deepEqual(result.restored.generation,result.before.generation);
  assert.deepEqual(result.restored.attempt,result.before.attempt);
  assert.deepEqual(result.restored.pending,result.before.pending);
  assert.deepEqual(result.restored.state.retrieval,{version:1,recentCardIds:['WD-FR-17'],recentEvidenceIds:['FR-E-1701','FR-E-1702'],recentFamilies:['uncertain_witness']});
  assert.equal(result.changedRetryRejected,true);
  assert.doesNotMatch(result.exported,/storyReferences|sourceText|private source paragraph/);
});

test('an archive rejects forged exposure state without consuming the fixed action or retry',async t=>{
  const {page}=await liveBrowser(t);
  const result=await page.evaluate(async()=>{
    const archive=await open('retrieval-forgery'),{state,pending}=await born(archive,'retrieval-forgery-run'),context=memory.buildStoryContext(state,pending);
    const attempt={id:'retrieval-fixed',sessionRef:'retrieval-session',retryOf:null};
    await archive.setAttempt({runId:state.runId,requestId:pending.identity.requestId,expectedAttemptId:null,attempt,generation:{storyActions:true,context}});
    const before=await archive.load(),scene=fixture(state);
    scene.retrieval={version:1,corpusVersion:'fanren-test-v1',queryHash:identity.sha256(identity.canonicalStringify(context)),cardIds:['WD-FR-4'],evidenceIds:['FR-E-4'],families:['witness']};
    const forged=engine.commitTurn(state,pending,scene);forged.retrieval.recentCardIds.push('WD-FORGED');
    let rejected=false;
    try{await archive.commit({expectedRevision:state.revision,expectedAttemptId:attempt.id,nextState:forged,scene,memoryDelta:memory.buildMemoryDelta(pending.receipt,scene),requestId:pending.identity.requestId});}catch{rejected=true;}
    return {rejected,before,after:await archive.load(),history:await archive.readHistory(state.runId)};
  });
  assert.equal(result.rejected,true);
  assert.deepEqual(result.after,result.before);
  assert.equal(result.history.entries.length,0);
  assert.equal(Object.hasOwn(result.after.state,'retrieval'),false);
});
