import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser} from './helpers/live-browser.js';
import {storyLife} from './helpers/experience-death.js';
test('paid death, forged or racing child, delayed backup, ongoing frozen request and a physical reimport preserve one real settlement',async t=>{
 const parent=storyLife('rebirth-trail',false),{page}=await liveBrowser(t);
 const out=await page.evaluate(async({birth,steps})=>{
  const {buildRebirthOptions}=await import('/src/game/cultivation/live/reincarnation.js'),format=await import('/src/game/live-save-format.js'),{createLiveSession}=await import('/src/ui/live-session.js');
  const {GLM_PROFILE}=await import('/src/worker/story-config.js'),{buildStoryInput}=await import('/src/worker/story-provider-core.js');
  const db='life-history',a=await open(db),b=await open(db);let row=await a.create({state:birth,pending:steps[0].p}),backup=await new Response(format.exportLiveArchive(a)).text();
  for(const {p,scene} of steps){
   if(!row.pending)await a.prepare(p);
   row=await a.commit({expectedRevision:row.state.revision,nextState:scene?engine.commitTurn(row.state,p,scene):engine.settleDeath(row.state,p),scene,memoryDelta:scene?memory.buildMemoryDelta(p.receipt,scene):null,requestId:p.identity.requestId});
  }
  const parent=row,opts=buildRebirthOptions(parent.state,[]);const create=(id,options=opts)=>{
   const state=engine.createLiveGame({...options,runId:id,seed:2});return {state,pending:engine.prepareOpening(state,{requestId:'opening'}),expectedArchiveId:parent.archiveId,rewardIds:[]};
  };
  const forged=structuredClone(opts);forged.reincarnation.echoes[1].status='fulfilled';
  const error=async fn=>{try{await fn();return null;}catch(e){return e.code??e.message;}};
  const forgedChild=create('forged',forged),bad=await error(()=>a.reincarnate(forgedChild));
  const onlyParent=await a._stage(forgedChild.state);await a._validateStage(onlyParent,forgedChild.state,forgedChild.pending,null);const parentProof=await error(()=>a.activate(onlyParent,parent.archiveId));await a._discardStage(onlyParent);const intact=await a.load();
  await b.load();const settled=await Promise.allSettled([a.reincarnate(create('child-a')),b.reincarnate(create('child-b'))]);
  const w=settled.find(r=>r.status==='fulfilled').value,child=w.state.runId,archive=await open(db),imposter=create(child,forged);
  const staged=await archive._stage(imposter.state);await archive._validateStage(staged,imposter.state,imposter.pending,null);
  const importTamper=await error(()=>archive.activate(staged,w.archiveId));await archive._discardStage(staged);if(!importTamper)throw Error('Forged imported child activated over its genuine parent/child');
  const snapshots=[];
  const client={async capabilities(){return {available:true,storyActions:true,experienceVersion:1};},async createSession(){return {sessionRef:'s'};},async requestTurn(p,c,attempt){
   const capture=await archive.load(),input=buildStoryInput({...GLM_PROFILE,storyActions:true},c),prose=JSON.parse(input.messages[1].content);
   snapshots.push({persisted:JSON.stringify(c)===JSON.stringify(capture.generation.context),echoes:c.previousLife,shown:JSON.stringify(prose).includes('尚欠行粮'),wire:new TextEncoder().encode(JSON.stringify(input)).length,quoted:new TextEncoder().encode(JSON.stringify(JSON.stringify(c))).length});
   if(c.phase!=='opening')return {status:'paused',errorCode:'PROVIDER_TIMEOUT'};
   const scene=structuredClone(steps[0].scene),first=scene.id.split(':t1:')[0],prefix=c.namespace;
   const local=JSON.parse(JSON.stringify(scene).replaceAll(first,prefix));
   return {status:'ready',requestId:p.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,scene:local};
  }};
  const session=createLiveSession({archive,client});await session.load();const active=await session.retry();if(!active.state.currentScene)throw Error(active.errorCode);
  const v=await session.choose({choiceId:active.state.currentScene.choices[0].id,baseRevision:active.state.revision,stateHash:identity.stateHash(active.state)});
  const{validateGeneration}=await import('/src/game/live-archive.js');const fake=structuredClone(v.generation);fake.context.previousLife=['已还行粮'];const generationTamper=await error(()=>validateGeneration(fake,v.pending,v.state));
  const json=await new Response(format.exportLiveArchive(archive)).text(),copy=await open('new-database'),restored=await format.importLiveArchive(new Response(json).body,copy);
  const previous=await format.importLiveArchive(new Response(backup).body,archive);
  return {bad,parentProof,generationTamper,intact:intact.archiveId===parent.archiveId&&!intact.reincarnatedTo,count:settled.filter(x=>x.status==='fulfilled').length,importTamper,child,previous:previous.reincarnatedTo,distinct:previous.archiveId!==parent.archiveId,snapshots,changed:restored.archiveId!==w.archiveId,replay:identity.stateHash(restored.state)===identity.stateHash(v.state),pending:JSON.stringify(restored.generation)===JSON.stringify(v.generation),row:restored.state.reincarnation};
 },{birth:parent.birth,steps:parent.steps});
 assert.equal(out.bad,'REINCARNATION_INVALID_STATE');assert.equal(out.parentProof,'REINCARNATION_INVALID_STATE');assert.ok(out.intact);assert.equal(out.count,1);assert.equal(out.importTamper,'REINCARNATION_INVALID_STATE');assert.equal(out.generationTamper,'ARCHIVE_INVALID_GENERATION');
 assert.equal(out.previous,out.child);assert.ok(out.distinct&&out.changed&&out.replay&&out.pending);assert.equal(out.row.parentStateHash,parent.hash);assert.equal(out.snapshots.length,2);
 for(const s of out.snapshots)assert.ok(s.persisted&&s.shown&&s.quoted<=7000&&s.wire<=24576);
 t.diagnostic('actual reborn opening / next paid action: '+JSON.stringify(out.snapshots));
});
