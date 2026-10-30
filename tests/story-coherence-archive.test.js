import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser} from './helpers/live-browser.js';

test('recent story records reuse two saved scenes across a history chunk boundary',async t=>{
  const {page}=await liveBrowser(t),r=await page.evaluate(async()=>{
    const a=await open('coherence-tail');await born(a);for(let index=0;index<129;index++)await advance(a);
    const l=await a.load(),before=identity.stateHash(l.state),modern=await a.readStoryRecords(l.state.runId,{recent:true}),legacy=await a.readStoryRecords(l.state.runId);
    const p=engine.prepareChoice(l.state,{requestId:'tail-next',choiceId:l.state.currentScene.choices[0].id}),c=memory.buildStoryContext(l.state,p,modern.records,{selection:'relevance-v1',openTotal:modern.openTotal});
    return {turns:modern.records.filter(r=>r.kind==='turn').map(r=>r.turnId).sort((a,b)=>a-b),legacy:legacy.records.filter(r=>r.kind==='turn').length,recent:c.memory.recent.map(r=>r.turnId),bytes:new TextEncoder().encode(JSON.stringify(JSON.stringify(c))).length,same:before===identity.stateHash((await a.load()).state)};
  });
  assert.deepEqual(r.turns,[128,129]);assert.equal(r.legacy,0);assert.equal(new Set(r.recent).size,r.recent.length);assert.ok(r.bytes<=7000);assert.equal(r.same,true);
});

test('generation input is frozen before POST, survives export and rejects a changed retry',async t=>{
  const {page}=await liveBrowser(t),r=await page.evaluate(async()=>{
    const a=await open('coherence-frozen'),l=await born(a),context=memory.buildStoryContext(l.state,l.pending),attempt={id:'frozen-attempt',sessionRef:'frozen-session',retryOf:null},generation={storyActions:true,context};
    await a.setAttempt({runId:l.state.runId,requestId:l.pending.identity.requestId,expectedAttemptId:null,attempt,generation});
    const loaded=await a.load();let rejected=false;try{await a.setAttempt({runId:l.state.runId,requestId:l.pending.identity.requestId,expectedAttemptId:attempt.id,attempt:{id:'frozen-changed',sessionRef:attempt.sessionRef,retryOf:{attemptId:attempt.id,sessionRef:attempt.sessionRef}},generation:{...generation,storyActions:false}});}catch{rejected=true;}
    const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js'),b=await open('coherence-frozen-restored'),restored=await importLiveArchive(exportLiveArchive(a),b);
    const dbVersion=a.db.version;let oldVersionBlocked=false;await new Promise(resolve=>{const req=indexedDB.open('coherence-frozen',2);req.onerror=()=>{oldVersionBlocked=true;resolve();};req.onsuccess=()=>{req.result.close();resolve();};});
    return {loaded:loaded.generation,restored:restored.generation,generation,rejected,oldVersionBlocked,dbVersion,attempt:(await a.load()).attempt.id,same:identity.stateHash(loaded.state)===identity.stateHash(restored.state)};
  });
  assert.deepEqual(r.loaded,r.generation);assert.deepEqual(r.restored,r.generation);assert.equal(r.rejected,true);assert.equal(r.attempt,'frozen-attempt');assert.equal(r.same,true);assert.equal(r.oldVersionBlocked,true);assert.equal(r.dbVersion,3);
});

test('an unmarked old journey upgrades at a committed story scene and restores help relations on return',async t=>{
  const {page}=await liveBrowser(t),r=await page.evaluate(async()=>{
    const a=await open('coherence-legacy-help'),state=engine.createLiveGame({runId:'legacy-help',seed:42});delete state.relationshipVersion;const opening=engine.prepareOpening(state,{requestId:'legacy-open'});await a.create({state,pending:opening});
    const prefix='r:'+identity.sha256(state.runId).slice(0,16)+':t1:',npc={id:prefix+'e:person_elder',name:'陈叔',kind:'person',status:'alive'};
    async function commit(scene){const l=await a.load(),p=l.pending??engine.prepareChoice(l.state,{requestId:'legacy-next-'+l.state.turnId,choiceId:l.state.currentScene.choices[0].id});if(!l.pending)await a.prepare(p);const records=await a.readRelated(l.state.runId,{entityIds:[npc.id],factsPerEntity:8}),c=memory.buildStoryContext(l.state,p,records),nextState=engine.commitTurn(l.state,p,scene,c.relationships??{});await a.commit({expectedRevision:l.state.revision,nextState,scene,memoryDelta:memory.buildMemoryDelta(p.receipt,scene),requestId:p.identity.requestId,expectedAttemptId:null});return a.load();}
    const first=fixture(state);first.entities=[npc];const old=await commit(first);
    const second=fixture(old.state);second.entities=[npc];second.blocks[0].text='陈叔疲惫地坐在路旁，向你求助。';second.choices=[{id:second.choices[0].id,label:'拿出行粮照料陈叔',intent:'interact',targetId:npc.id,stake:'low',approach:'help'},{id:second.choices[1].id,label:'观察陈叔的情况',intent:'interact',targetId:npc.id,stake:'low',approach:'observe'}];const upgraded=await commit(second);
    const third=fixture(upgraded.state);third.choices[0]={...third.choices[0],label:'观察林间小径',intent:'interact',targetId:'self',approach:'observe'};const absent=await commit(third);
    const fourth=fixture(absent.state);fourth.entities=[npc];fourth.blocks[0].text='你再次遇见陈叔，他记得你先前拿出行粮相助。';const returned=await commit(fourth);
    const records=await a.readRelated(state.runId,{entityIds:[npc.id],includeOpen:false,factsPerEntity:8});
    const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js'),restored=await importLiveArchive(exportLiveArchive(a),await open('coherence-legacy-help-restored'));
    return {old:old.state.relationshipVersion,upgraded:upgraded.state.relationshipVersion,absent:absent.state.life.relations[npc.id],returned:returned.state.life.relations[npc.id],decision:records.some(r=>r.source==='rules'&&r.kind==='fact'&&r.text.includes('拿出行粮照料陈叔')),same:identity.stateHash(restored.state)===identity.stateHash(returned.state),birthUnchanged:restored.state.birthReceipt.random.before===state.birthReceipt.random.before};
  });
  assert.equal(r.old,undefined);assert.equal(r.upgraded,1);assert.equal(r.absent,undefined);assert.equal(r.returned,2);assert.equal(r.decision,true);assert.equal(r.same,true);assert.equal(r.birthUnchanged,true);
});

test('session refresh restores a frozen modern response without another POST',async t=>{
  const {page}=await liveBrowser(t),r=await page.evaluate(async()=>{
    const {createLiveSession}=await import('/src/ui/live-session.js'),a=await open('coherence-session-frozen');let posts=0,cached,firstMode;
    const client={async capabilities(){return {available:true,storyActions:true};},async createSession(){return {sessionRef:'session-frozen'};},async requestTurn(p,c,attempt,options){posts++;firstMode=options.storyActions;cached={protocolVersion:1,status:'ready',requestId:p.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,errorCode:null,retry:null,scene:fixture((await a.load()).state)};throw Object.assign(Error('lost reply'),{code:'NETWORK_UNAVAILABLE'});},async getTurn(){return cached;}};
    const session=createLiveSession({archive:a,client});await session.start({runId:'frozen-session-run',seed:42});const before=await a.load();
    const restored=createLiveSession({archive:await open('coherence-session-frozen'),client});await restored.load();await restored.resume();const after=await a.load();
    return {posts,firstMode,frozen:before.generation?.storyActions,revision:after.state.revision,pending:after.pending,sameRng:before.state.rng===after.state.rng};
  });
  assert.equal(r.posts,1);assert.equal(r.firstMode,true);assert.equal(r.frozen,true);assert.equal(r.revision,1);assert.equal(r.pending,null);assert.equal(r.sameRng,true);
});

test('a never-admitted legacy attempt keeps its old mode when its original identity is reused',async t=>{
  const {page}=await liveBrowser(t),r=await page.evaluate(async()=>{
    const {createLiveSession}=await import('/src/ui/live-session.js'),a=await open('coherence-never-admitted'),l=await born(a),attempt={id:'old-never-admitted',sessionRef:'old-session',retryOf:null};await a.setAttempt({runId:l.state.runId,requestId:l.pending.identity.requestId,expectedAttemptId:null,attempt});let posts=0,mode,attemptId,frozen;
    const client={async capabilities(){return {available:true,storyActions:true};},async createSession(){return {sessionRef:attempt.sessionRef};},async getTurn(p,at){return {protocolVersion:1,status:'paused',errorCode:'ATTEMPT_NOT_ADMITTED',requestId:p.identity.requestId,attemptId:at.id,sessionRef:at.sessionRef,retry:{explicit:true,afterMs:0,previousAttemptId:at.id,previousSessionRef:at.sessionRef}};},async requestTurn(p,c,at,options){posts++;mode=options.storyActions;attemptId=at.id;frozen=(await a.load()).generation;return {protocolVersion:1,status:'ready',requestId:p.identity.requestId,attemptId:at.id,sessionRef:at.sessionRef,errorCode:null,retry:null,scene:fixture(l.state)};}};
    const session=createLiveSession({archive:a,client});await session.load();await session.retry();return {posts,mode,attemptId,frozen:!!frozen,revision:(await a.load()).state.revision};
  });
  assert.equal(r.posts,1);assert.equal(r.mode,false);assert.equal(r.attemptId,'old-never-admitted');assert.equal(r.frozen,true);assert.equal(r.revision,1);
});

test('old cached scenes with many long identities commit and import without a new provider gate',async t=>{
  const {page}=await liveBrowser(t),r=await page.evaluate(async()=>{
    const a=await open('coherence-legacy-crowded'),state=engine.createLiveGame({runId:'old-crowded-cache',seed:42});delete state.relationshipVersion;const pending=engine.prepareOpening(state,{requestId:'old-crowded-open'});await a.create({state,pending});
    let scene=fixture(state);scene.entities=Array.from({length:22},(_,index)=>({id:scene.id.replace('s:local','e:person_'+index).padEnd(80,'x'),name:index+'甲',kind:'person',status:'alive'}));
    async function commit(l,p,scene){const nextState=engine.commitTurn(l.state,p,scene);await a.commit({expectedRevision:l.state.revision,nextState,scene,memoryDelta:memory.buildMemoryDelta(p.receipt,scene),requestId:p.identity.requestId,expectedAttemptId:l.attempt?.id??null});}
    await commit(await a.load(),pending,scene);const active=await a.load(),next=engine.prepareChoice(active.state,{requestId:'r'.repeat(80),choiceId:active.state.currentScene.choices[0].id});await a.prepare(next);
    const cached=fixture(active.state,1);cached.entities=scene.entities;await commit(await a.load(),next,cached);const saved=await a.load();
    const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js'),restored=await importLiveArchive(exportLiveArchive(a),await open('coherence-legacy-crowded-restored'));
    return {revision:saved.state.revision,count:saved.state.relatedEntities.length,same:identity.stateHash(saved.state)===identity.stateHash(restored.state),marker:restored.state.relationshipVersion};
  });
  assert.equal(r.revision,2);assert.equal(r.count,22);assert.equal(r.same,true);assert.equal(r.marker,undefined);
});

test('a dense old journey reaches a modern session POST with its frozen bounded context',async t=>{
  const {page}=await liveBrowser(t),r=await page.evaluate(async()=>{
    const a=await open('coherence-legacy-context-fallback'),state=engine.createLiveGame({runId:'old-context-fallback',seed:42});delete state.relationshipVersion;
    const opening=engine.prepareOpening(state,{requestId:'old-opening'}),c=memory.buildStoryContext(state,opening,[],{continuity:false});let scene;
    for(let length=1;length<=48;length++){
      const candidate=fixture(state,0,480);candidate.entities=Array.from({length:24},(_,i)=>({id:candidate.id.replace('s:local','e:person_'+i).padEnd(80,'x'),name:i+'名'.repeat(length),kind:'person',status:'alive'}));
      try{memory.validateGeneratedScene(candidate,c);}catch{continue;}
      const active=engine.commitTurn(state,opening,candidate),p=engine.prepareChoice(active,{requestId:'r'.repeat(36),choiceId:candidate.choices[0].id}),context=memory.buildStoryContext(active,p,[],{selection:'relevance-v1',openTotal:0});
      if(!context.memory.recent.length){scene=candidate;break;}
    }
    if(!scene)throw Error('No legal dense old fixture');
    await a.create({state,pending:opening});const nextState=engine.commitTurn(state,opening,scene);await a.commit({expectedRevision:state.revision,nextState,scene,memoryDelta:memory.buildMemoryDelta(opening.receipt,scene),requestId:opening.identity.requestId,expectedAttemptId:null});
    let posts=0,sessions=0,mode,bytes;
    const client={async capabilities(){return {available:true,storyActions:true};},async createSession(){sessions++;return {sessionRef:'dense-old-session'};},async requestTurn(p,context,attempt,options){posts++;mode=options.storyActions;bytes=new TextEncoder().encode(JSON.stringify(JSON.stringify(context))).length;throw Object.assign(Error('fixture transport interruption'),{code:'NETWORK_UNAVAILABLE'});}};
    const {createLiveSession}=await import('/src/ui/live-session.js'),session=createLiveSession({archive:a,client});await session.load();await session.choose({choiceId:scene.choices[0].id,baseRevision:nextState.revision,stateHash:identity.stateHash(nextState)});const loaded=await a.load();
    return {posts,sessions,mode,bytes,frozen:loaded.generation?.storyActions,pending:!!loaded.pending,revision:loaded.state.revision,retainedEntities:loaded.state.relatedEntities.length,error:session.view().errorCode};
  });
  assert.equal(r.posts,1,JSON.stringify(r));assert.equal(r.sessions,1);assert.equal(r.mode,true);assert.ok(r.bytes<=7000);assert.equal(r.frozen,true);assert.equal(r.pending,true);assert.equal(r.revision,1);assert.equal(r.retainedEntities,24);assert.equal(r.error,'NETWORK_UNAVAILABLE');
});

test('new sessions negotiate legacy mode with an older server and keep frozen modern attempts paused',async t=>{
  const {page}=await liveBrowser(t),r=await page.evaluate(async()=>{
    const {createLiveSession}=await import('/src/ui/live-session.js'),a=await open('coherence-older-service');let posts=0,mode;
    const client={async capabilities(){return {available:true,storyActions:false};},async createSession(){return {sessionRef:'older-service'};},async requestTurn(p,c,at,options){posts++;mode=options.storyActions;return {protocolVersion:1,status:'ready',requestId:p.identity.requestId,attemptId:at.id,sessionRef:at.sessionRef,errorCode:null,retry:null,scene:fixture((await a.load()).state)};}};
    const session=createLiveSession({archive:a,client});await session.start({runId:'older-service-run',seed:42});
    const b=await open('coherence-frozen-service'),l=await born(b),attempt={id:'frozen-modern-old-service',sessionRef:'old-service-session',retryOf:null};await b.setAttempt({runId:l.state.runId,requestId:l.pending.identity.requestId,expectedAttemptId:null,attempt,generation:{storyActions:true,context:memory.buildStoryContext(l.state,l.pending)}});
    const restored=createLiveSession({archive:b,client:{...client,async getTurn(){return {protocolVersion:1,status:'rejected',errorCode:'GENERATED_SCENE_INVALID',requestId:l.pending.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,retry:null};}}});await restored.load();await restored.retry();const saved=await b.load();
    return {posts,mode,revision:(await a.load()).state.revision,preserved:saved.generation.storyActions,attempt:saved.attempt.id,error:restored.view().errorCode};
  });
  assert.equal(r.posts,1);assert.equal(r.mode,false);assert.equal(r.revision,1);assert.equal(r.preserved,true);assert.equal(r.attempt,'frozen-modern-old-service');assert.equal(r.error,'SERVICE_UNAVAILABLE');
});

test('missing replies replay the frozen id safely through rejection, disabled inference and import',async t=>{
  const {page}=await liveBrowser(t),r=await page.evaluate(async()=>{
    const {createLiveSession}=await import('/src/ui/live-session.js'),results=[];
    for(const scenario of ['preflight','disabled','tombstone','import']){
      const a=await open('coherence-replay-'+scenario),sessionRef='replay-session-'+scenario,requests=[];let target=a,inferences=0;
      const client={async capabilities(){return {available:true,storyActions:true};},async createSession(){return {sessionRef};},async getTurn(p,at){return {protocolVersion:1,status:'paused',errorCode:'ATTEMPT_NOT_FOUND',requestId:p.identity.requestId,attemptId:at.id,sessionRef:at.sessionRef,retry:null};},async requestTurn(p,c,at){requests.push({attempt:structuredClone(at),context:structuredClone(c)});if(requests.length===1||scenario==='preflight'&&requests.length===2)return {protocolVersion:1,status:'rejected',errorCode:'REQUEST_INVALID',requestId:null,attemptId:null,sessionRef:null,retry:null};if(scenario==='disabled'&&requests.length===2)return {protocolVersion:1,status:'paused',errorCode:'INFERENCE_DISABLED',requestId:p.identity.requestId,attemptId:at.id,sessionRef:at.sessionRef,retry:null};if(scenario==='tombstone'&&requests.length===2)return {protocolVersion:1,status:'paused',errorCode:'ATTEMPT_NOT_FOUND',requestId:p.identity.requestId,attemptId:at.id,sessionRef:at.sessionRef,retry:null};inferences++;return {protocolVersion:1,status:'ready',errorCode:null,requestId:p.identity.requestId,attemptId:at.id,sessionRef:at.sessionRef,retry:null,scene:fixture((await target.load()).state)};}};
      const first=createLiveSession({archive:a,client});await first.start({runId:'replay-run-'+scenario,seed:42});const before=await a.load();
      if(scenario==='import'){const {exportLiveArchive,importLiveArchive}=await import('/src/game/live-save-format.js');target=await open('coherence-replay-import-restored');await importLiveArchive(exportLiveArchive(a),target);}
      const restored=createLiveSession({archive:target,client});await restored.load();await restored.retry();if((await target.load()).pending)await restored.retry();const final=await target.load();
      results.push({scenario,requests,inferences,frozen:before.generation,revision:final.state.revision,pending:final.pending});
    }
    return results;
  });
  for(const row of r){assert.deepEqual(row.requests[0].attempt,row.requests[1].attempt);assert.ok(row.requests.every(request=>JSON.stringify(request.context)===JSON.stringify(row.frozen.context)));assert.equal(row.inferences,1);assert.equal(row.revision,1);assert.equal(row.pending,null);if(row.scenario==='tombstone'){assert.notEqual(row.requests[2].attempt.id,row.requests[0].attempt.id);assert.deepEqual(row.requests[2].attempt.retryOf,{attemptId:row.requests[0].attempt.id,sessionRef:row.requests[0].attempt.sessionRef});}else assert.ok(row.requests.every(request=>request.attempt.id===row.requests[0].attempt.id));}
});

test('a malformed missing-response identity cannot create a new attempt',async t=>{
  const {page}=await liveBrowser(t),r=await page.evaluate(async()=>{
    const {createLiveSession}=await import('/src/ui/live-session.js'),results=[];
    for(const field of ['requestId','attemptId']){
      const a=await open('coherence-wrong-'+field);let posts=0;
      const client={async capabilities(){return {available:true,storyActions:true};},async createSession(){return {sessionRef:'wrong-identity-session'};},async requestTurn(){posts++;throw Object.assign(Error('lost response'),{code:'NETWORK_UNAVAILABLE'});},async getTurn(p,at){return {protocolVersion:1,status:'paused',errorCode:'ATTEMPT_NOT_FOUND',requestId:p.identity.requestId,attemptId:at.id,sessionRef:at.sessionRef,retry:null,[field]:'wrong-identity'};}};
      const session=createLiveSession({archive:a,client});await session.start({runId:'wrong-'+field,seed:42});const before=await a.load();await session.retry();const after=await a.load();results.push({posts,error:session.view().errorCode,sameAttempt:JSON.stringify(before.attempt)===JSON.stringify(after.attempt),sameGeneration:JSON.stringify(before.generation)===JSON.stringify(after.generation)});
    }
    return results;
  });
  for(const row of r){assert.equal(row.posts,1);assert.equal(row.error,'RESPONSE_IDENTITY_MISMATCH');assert.equal(row.sameAttempt,true);assert.equal(row.sameGeneration,true);}
});
