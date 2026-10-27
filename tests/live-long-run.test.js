import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { liveBrowser } from './helpers/live-browser.js';
import * as engine from '../src/game/cultivation/live/engine.js';
import * as memory from '../src/game/cultivation/live/memory.js';
import { canonicalStringify, sha256 } from '../src/game/cultivation/live/identity.js';

// Test-only deterministic provider. It proposes intentions; the rules calculate
// every age, material, cultivation gain, injury, breakthrough and death.
function fixtureScene(context, padding = 0) {
  const prefix = `${context.namespace}:t${context.identity.turnId}:`;
  const realms = [
    ['mortal', 0, null], ['qi', 2, 'manual'], ['foundation', 3, 'crystal'],
    ['golden', 4, 'core'], ['nascent', 4, 'soulseal'],
    ['spirit', 5, 'skykey'], ['immortal', 5, 'relic'],
  ];
  const life = context.life, next = realms[realms.findIndex(r => r[0] === life.realm) + 1];
  let action = ['rest', 'self', 'recover'];
  if (next && life.injury <= 1) {
    action = life.cultivation < next[1] ? ['practice', 'self', 'steady']
      : !life.items[next[2]] ? ['explore', next[2], 'cautious']
      : ['practice', next[0], 'breakthrough'];
  }
  const proposal = (suffix, [intent, targetId, approach]) => ({id:prefix + 'c:' + suffix, label:suffix, intent, targetId, stake:'low', approach});
  const alternative = action[0] === 'rest' ? ['practice', 'self', 'steady'] : ['rest', 'self', 'recover'];
  return {
    id:prefix + 's:fixture', title:'山中续行', location:'松溪',
    blocks:[{kind:'narration', text:`松溪的山风吹过石阶，你继续这一程。记事${context.identity.turnId}。` + '松'.repeat(padding)}],
    entities:[], choices:[proposal('continue', action), proposal('alternative', alternative)], memoryDeltas:[],
  };
}

test('1000 native session turns legally reach immortality, remain bounded and restore every archived entry beyond the old total cap', {timeout:240000}, async t => {
  const {page} = await liveBrowser(t);
  const result = await page.evaluate(async source => {
    const sceneFor = (0, eval)(`(${source})`); // Test-only shared fixture, never loaded by the application.
    const {createLiveSession} = await import('/src/ui/live-session.js');
    const {exportLiveArchive, importLiveArchive} = await import('/src/game/live-save-format.js');
    const {serializeLiveState} = await import('/src/game/cultivation/live/validation.js');
    const archive = await open('long-run-1000');
    const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
    let calls = 0, maxContextBytes = 0, maxSnapshotBytes = 0;
    const realms = [], samples = [], seenBlocks = new Set();
    let repeatedBlocks = 0;
    const client = {
      async capabilities(){return {available:true};},
      async createSession(){return {sessionRef:'fixture-session'};},
      async requestTurn(pending, context, attempt){
        const started=performance.now();
        calls++; maxContextBytes = Math.max(maxContextBytes, bytes(context));
        const scene = sceneFor(context, 1200), hash = identity.sha256(identity.canonicalStringify(scene.blocks));
        if(seenBlocks.has(hash)) repeatedBlocks++; seenBlocks.add(hash);
        if(calls <= 2) samples.push({sampleKind:'fixture', case:calls === 1 ? 'opening' : 'continuous-choice', inputHash:identity.sha256(identity.canonicalStringify(context)), modelId:null, usage:null, actualNeurons:null, accepted:true, reason:'context-aware schema and rule commit accepted', latencyMs:null,fixtureGenerationLatencyMs:performance.now()-started,review:{playerName:context.life.name,ageDays:context.life.ageDays,realm:context.life.realm,location:scene.location,proseExcerpt:scene.blocks[0].text.slice(0,80),paddingCharacters:1200,elapsedDays:context.receipt.elapsedDays,action:context.receipt.action,relationships:'not exercised',suspense:'not exercised'}});
        return {status:'ready', requestId:pending.identity.requestId, attemptId:attempt.id, sessionRef:attempt.sessionRef, scene};
      },
      async getTurn(){throw Error('no retry expected');},
    };
    const session = createLiveSession({archive,client});
    let view = await session.start({runId:'legal-long-life',seed:42});
    const birth = structuredClone(view.state.birthReceipt);
    let immortalAt = null;
    for(let committed = 1; committed <= 1000; committed++) {
      if(view.status !== 'ready' || view.state.revision !== committed) throw Error(`long-run commit failed at ${committed}: ${view.errorCode}`);
      const state = view.state;
      maxSnapshotBytes = Math.max(maxSnapshotBytes, new TextEncoder().encode(serializeLiveState(state)).length);
      if(!realms.includes(state.life.realm)) realms.push(state.life.realm);
      if(state.life.realm === 'immortal' && immortalAt === null) immortalAt = committed;
      if(committed < 1000) view = await session.choose({choiceId:state.currentScene.choices[0].id,baseRevision:state.revision,stateHash:identity.stateHash(state)});
    }
    const final = (await archive.load()).state;
    const readAll = async a => {
      let cursor = null, count = 0, digest = '0'.repeat(64), maxPageBytes = 0, maxPageEntries = 0;
      do {
        const page = await a.readHistory(final.runId, cursor, 37);
        maxPageBytes = Math.max(maxPageBytes, bytes(page.entries));
        maxPageEntries = Math.max(maxPageEntries, page.entries.length);
        for(const entry of page.entries) {
          if(entry.identity.turnId !== ++count) throw Error('history gap or duplicate');
          digest = identity.sha256(digest + identity.canonicalStringify(entry));
        }
        cursor = page.cursor;
      } while(cursor);
      return {count,digest,maxPageBytes,maxPageEntries};
    };
    const before = await readAll(archive), capture = await archive._capture(), chunks = [];
    for(let i=0;i<=capture.run.tailIndex;i++) {
      const c = await archive._readChunk(capture.run.archiveId,i);
      chunks.push({count:c.entries.length,bytes:bytes(c),hash:c.hash,previousHash:c.previousHash});
    }
    let exportBytes = 0;
    const counted = exportLiveArchive(archive).pipeThrough(new TransformStream({transform(chunk,controller){exportBytes += chunk.byteLength; controller.enqueue(chunk);}}));
    const restored = await open('long-run-restored');
    const imported = await importLiveArchive(counted,restored), after = await readAll(restored);
    // A deliberately crafted near-lifespan fixture checks the 3000-year bound
    // without adding thousands of redundant retirement turns to this test.
    const nearEnd = structuredClone(final);
    nearEnd.life.ageDays = nearEnd.life.lifeLimit * 360 - 1;
    nearEnd.lastReceipt.after.ageDays = nearEnd.life.ageDays;
    nearEnd.lastReceipt.before.ageDays = nearEnd.life.ageDays - nearEnd.lastReceipt.elapsedDays;
    const terminal = engine.prepareChoice(nearEnd,{requestId:'crafted-immortal-lifespan',choiceId:nearEnd.currentScene.choices[0].id});
    const immortalDeath = engine.settleDeath(nearEnd,terminal);
    return {calls,realms,immortalAt,birthUnchanged:identity.canonicalStringify(birth)===identity.canonicalStringify(final.birthReceipt),maxContextBytes,maxSnapshotBytes,chunks,exportBytes,before,after,sameState:identity.stateHash(final)===identity.stateHash(imported.state),final:{revision:final.revision,turnId:final.turnId,phase:final.phase,ageDays:final.life.ageDays,lifeLimit:final.life.lifeLimit,realm:final.life.realm},postImmortalTurns:1000-immortalAt,repeatedBlocks,samples,craftedImmortalDeath:{provenance:'crafted from the legally reached turn-1000 immortal state; age moved to one day before lifespan',phase:immortalDeath.phase,cause:immortalDeath.lastReceipt.death.cause,ageDays:immortalDeath.life.ageDays}};
  }, fixtureScene.toString());
  assert.equal(result.calls, 1000);
  assert.deepEqual(result.realms, ['mortal','qi','foundation','golden','nascent','spirit','immortal']);
  assert.equal(result.final.phase, 'active'); assert.equal(result.final.revision, 1000);
  assert.ok(result.postImmortalTurns > 900); assert.ok(result.final.ageDays > 80*360);
  assert.equal(result.birthUnchanged, true);
  assert.ok(result.maxSnapshotBytes <= 65536); assert.ok(result.maxContextBytes <= 7000);
  assert.ok(result.exportBytes > 1024*1024);
  assert.equal(result.before.count, 1000); assert.equal(result.after.count, 1000);
  assert.equal(result.before.digest, result.after.digest); assert.equal(result.sameState, true);
  assert.ok(result.before.maxPageBytes <= 256*1024); assert.ok(result.before.maxPageEntries <= 37);
  for(let i=0;i<result.chunks.length;i++) {
    assert.ok(result.chunks[i].count <= 128); assert.ok(result.chunks[i].bytes <= 256*1024);
    if(i) assert.equal(result.chunks[i].previousHash,result.chunks[i-1].hash);
  }
  assert.equal(result.repeatedBlocks,0);
  assert.equal(result.craftedImmortalDeath.phase,'dead'); assert.equal(result.craftedImmortalDeath.cause,'lifespan');
  assert.equal(result.craftedImmortalDeath.ageDays,3000*360);
  t.diagnostic('LONG_RUN_EVIDENCE '+JSON.stringify(result));
});

test('natural mortal lifespan and battle deaths settle in native sessions without any later client operation', async t => {
  const {page} = await liveBrowser(t);
  const results = await page.evaluate(async () => {
    const {createLiveSession} = await import('/src/ui/live-session.js');
    const results = [];
    for(const cause of ['lifespan','injury']) {
      const archive = await open('death-'+cause);
      let clientCalls = 0, generationCalls = 0;
      const client = {
        async capabilities(){clientCalls++;return {available:true};},
        async createSession(){clientCalls++;return {sessionRef:'fixture-death-session'};},
        async requestTurn(p,c,a){
          clientCalls++; generationCalls++;
          const prefix=c.namespace+':t'+c.identity.turnId+':', enemy={id:c.namespace+':t1:e:enemy',name:'山匪',kind:'person',status:'alive'};
          const scene={id:prefix+'s:death',title:'归途',location:'旧道',blocks:[{kind:'narration',text:'旧道的钟声渐远。'+c.identity.turnId}],entities:cause==='injury'?[enemy]:[],choices:[{id:prefix+'c:continue',label:'继续',intent:cause==='injury'?'fight':'rest',targetId:cause==='injury'?enemy.id:'self',stake:cause==='injury'?'high':'low',approach:cause==='injury'?'desperate':'retire'},{id:prefix+'c:recover',label:'歇息',intent:'rest',targetId:'self',stake:'low',approach:'recover'}],memoryDeltas:[]};
          return {status:'ready',requestId:p.identity.requestId,attemptId:a.id,sessionRef:a.sessionRef,scene};
        },
        async getTurn(){clientCalls++;throw Error('dead session must not query');},
      };
      const session=createLiveSession({archive,client});
      let view=await session.start({runId:'natural-death-'+cause,seed:42}), prior;
      while(view.state.phase!=='dead') {
        prior=view.state;
        view=await session.choose({choiceId:prior.currentScene.choices[0].id,baseRevision:prior.revision,stateHash:identity.stateHash(prior)});
        if(view.status==='paused')throw Error(view.errorCode);
      }
      const atDeath=clientCalls, generationsAtDeath=generationCalls, deadState=identity.stateHash(view.state);
      await session.resume(); await session.retry();
      await session.choose({choiceId:prior.currentScene.choices[0].id,baseRevision:view.state.revision,stateHash:deadState});
      const loaded=await archive.load(), history=await archive.readHistory(loaded.state.runId,null,128);
      const last=history.entries.at(-1);
      results.push({cause,phase:loaded.state.phase,ageDays:loaded.state.life.ageDays,injury:loaded.state.life.injury,turns:loaded.state.turnId,historyEntries:history.entries.length,generationsAtDeath,clientCallsAfterDeath:clientCalls-atDeath,deathRequestGenerated:generationCalls!==generationsAtDeath,stateUnchanged:identity.stateHash(loaded.state)===deadState,terminalCause:last.receipt.death.cause,terminalScene:last.scene,pending:loaded.pending});
    }
    return results;
  });
  for(const r of results) {
    assert.equal(r.phase,'dead'); assert.equal(r.terminalCause,r.cause);
    assert.equal(r.terminalScene,null); assert.equal(r.pending,null);
    assert.equal(r.clientCallsAfterDeath,0); assert.equal(r.deathRequestGenerated,false); assert.equal(r.stateUnchanged,true);
    assert.equal(r.historyEntries,r.turns); assert.equal(r.generationsAtDeath,r.turns-1);
  }
  assert.equal(results[0].ageDays,80*360); assert.equal(results[0].turns,65);
  assert.equal(results[1].injury,10); assert.ok(results[1].ageDays < 17*360);
  t.diagnostic('DEATH_EVIDENCE '+JSON.stringify(results));
});

test('fixture continuous and counterfactual samples retain rules causality and reject explicit conflicts before commit', async t => {
  const state=engine.createLiveGame({runId:'causal-fixture',seed:42});
  const opening=engine.prepareOpening(state,{requestId:'causal-opening'}), openingContext=memory.buildStoryContext(state,opening);
  const first=memory.validateGeneratedScene(fixtureScene(openingContext),openingContext);
  const active=engine.commitTurn(state,opening,first), before=canonicalStringify(active), samples=[];
  const contexts=[];
  for(const choice of first.choices) {
    const pending=engine.prepareChoice(active,{requestId:'counterfactual-'+choice.id.split(':').at(-1),choiceId:choice.id});
    const context=memory.buildStoryContext(active,pending), scene=fixtureScene(context);
    const started=performance.now();
    const accepted=memory.validateGeneratedScene(scene,context), next=engine.commitTurn(active,pending,accepted);
    assert.deepEqual(next.life,pending.nextLife);
    assert.equal(next.lastReceipt.elapsedDays,choice.intent==='practice'?360:30);
    samples.push({sampleKind:'fixture',case:'counterfactual-'+choice.intent,inputHash:sha256(canonicalStringify(context)),modelId:null,usage:null,actualNeurons:null,accepted:true,reason:'exact rules receipt controls age and action cost',latencyMs:null,fixtureValidationLatencyMs:performance.now()-started,review:{playerName:next.life.name,ageDays:next.life.ageDays,realm:next.life.realm,location:scene.location,blocks:scene.blocks,elapsedDays:pending.receipt.elapsedDays,action:pending.receipt.action,relationships:'not exercised',suspense:'not exercised'}});
    contexts.push(context);
  }
  assert.equal(canonicalStringify(active),before);
  assert.equal(contexts[0].identity.baseRevision,contexts[1].identity.baseRevision);
  assert.equal(contexts[0].identity.stateHash,contexts[1].identity.stateHash);
  assert.notEqual(contexts[0].receipt.after.ageDays,contexts[1].receipt.after.ageDays);
  const context=contexts[0];
  const invalids=[
    ['repeated-blocks',scene=>{scene.blocks=structuredClone(first.blocks);}],
    ['duplicate-action-tuple',scene=>{scene.choices[1]={...scene.choices[0],id:scene.choices[1].id};}],
    ['explicit-age-conflict',scene=>{scene.blocks=[{kind:'narration',text:'你今年999岁。'}];}],
    ['explicit-realm-conflict',scene=>{scene.blocks=[{kind:'narration',text:'你如今已是登仙境界。'}];}],
  ];
  for(const [name,change] of invalids) {
    const scene=fixtureScene(context); change(scene);
    let reason;
    assert.throws(()=>{try{memory.validateGeneratedScene(scene,context);}catch(e){reason=e.code??e.message;throw e;}});
    assert.equal(canonicalStringify(active),before);
    samples.push({sampleKind:'fixture',case:name,inputHash:sha256(canonicalStringify(context)),modelId:null,usage:null,actualNeurons:null,accepted:false,reason,latencyMs:null});
  }
  // The runtime graph must stay generative: no authored finite node catalogue.
  const visited=new Set();
  async function visit(url) {
    if(visited.has(url.href))return; visited.add(url.href);
    const source=await readFile(url,'utf8');
    assert.doesNotMatch(source,/\bNODES\b/);
    for(const [,path] of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      assert.ok(path.startsWith('.')); await visit(new URL(path,url));
    }
  }
  await visit(new URL('../src/ui/live-session.js',import.meta.url));
  t.diagnostic('CAUSAL_EVIDENCE '+JSON.stringify({samples,modulesChecked:visited.size,realCalls:0,actualNeurons:null}));
});

test('unresolved narrative obligations do not create an alive but permanently unplayable run', async t => {
  const {page}=await liveBrowser(t);
  const result=await page.evaluate(async()=>{
    const {createLiveSession}=await import('/src/ui/live-session.js');
    const archive=await open('many-open-promises');let generated=0,maxContextBytes=0,lastCoverage=null,lastIncludedPromises=0;
    const client={
      async capabilities(){return {available:true};},
      async createSession(){return {sessionRef:'fixture-obligation-session'};},
      async requestTurn(p,c,a){
        generated++;maxContextBytes=Math.max(maxContextBytes,new TextEncoder().encode(JSON.stringify(c)).length);lastCoverage=c.coverage??null;lastIncludedPromises=c.memory.promises.length;
        const prefix=c.namespace+':t'+c.identity.turnId+':',npc={id:c.namespace+':t1:e:guide',name:'渡者',kind:'person',status:'alive'};
        const scene={id:prefix+'s:promise',title:'渡口',location:'松溪',blocks:[{kind:'narration',text:'渡者记下尚待完成的托付。'+c.identity.turnId}],entities:[npc],choices:[{id:prefix+'c:rest',label:'稍候',intent:'rest',targetId:'self',stake:'low',approach:'recover'},{id:prefix+'c:practice',label:'修习',intent:'practice',targetId:'self',stake:'low',approach:'steady'}],memoryDeltas:c.identity.turnId<=13?[{entityId:npc.id,kind:'promise',text:'替渡者寻物'+c.identity.turnId+'。'}]:[]};
        return {status:'ready',requestId:p.identity.requestId,attemptId:a.id,sessionRef:a.sessionRef,scene};
      },
      async getTurn(){return {status:'paused',errorCode:'SESSION_UNAVAILABLE'};},
    };
    const session=createLiveSession({archive,client});let view=await session.start({runId:'obligation-life',seed:42});
    while(view.state.revision<15&&view.status==='ready')view=await session.choose({choiceId:view.state.currentScene.choices[0].id,baseRevision:view.state.revision,stateHash:identity.stateHash(view.state)});
    const paused=view.status==='paused';if(paused)await session.retry();
    const rows=await archive.readRelated('obligation-life');
    return {generated,revision:session.view().state.revision,phase:session.view().state.phase,status:session.view().status,errorCode:session.view().errorCode,pending:!!session.view().pending,openPromises:rows.filter(r=>r.kind==='promise'&&r.status==='open').length,pausedBeforeRetry:paused,maxContextBytes,lastCoverage,lastIncludedPromises};
  });
  t.diagnostic('OBLIGATION_EVIDENCE '+JSON.stringify(result));
  assert.equal(result.phase,'active');
  assert.equal(result.openPromises,13,'all unresolved promises must remain durably retrievable');
  assert.equal(result.revision,15,'bounded provider context must permit continued play without erasing unresolved obligations');
  assert.equal(result.status,'ready');
  assert.ok(result.maxContextBytes<=7000);
  assert.equal(result.lastCoverage.policy,'relevance-v1');
  assert.equal(result.lastCoverage.openTotal,13);
  assert.equal(result.lastCoverage.openIncluded+result.lastCoverage.openOmitted,13);
  assert.ok(result.lastCoverage.openOmitted>=1,'omission from bounded context must be explicit');
  assert.ok(result.lastIncludedPromises<=12);
});
