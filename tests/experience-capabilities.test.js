import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBrowser} from './helpers/live-browser.js';
import {createStoryApi} from '../src/worker/story-api.js';

test('ready story API announces the supported experience version; paused API cannot enable a new birth',async()=>{
 const url='https://story.example/api/story/capabilities';
 const ready=createStoryApi({config:{readiness(){}}}),paused=createStoryApi({config:{readiness(){throw Error('offline');}}});
 const first=await (await ready.fetch(new Request(url))).json(),second=await (await paused.fetch(new Request(url))).json();
 assert.equal(first.available,true);assert.equal(first.experienceVersion,1);assert.equal(second.available,false);assert.equal(second.experienceVersion,undefined);
});

test('native session negotiates marked birth before replacing storage, rolls back safely and restores a cached marked reply',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),format=await import('/src/game/live-save-format.js');
  const a=await open('experience-negotiation'),frozen=await (await fetch('/tests/fixtures/v540-unmarked-v7.json')).json();
  let capability={available:true,storyActions:true},calls=0,posts=0,gets=0,cached;
  const client={async capabilities(){calls++;return capability;},async createSession(){return {sessionRef:'session'};},async requestTurn(p,c,attempt){posts++;cached={status:'ready',requestId:p.identity.requestId,attemptId:attempt.id,sessionRef:attempt.sessionRef,scene:frozen.scene};return {status:'paused',errorCode:'PROVIDER_TIMEOUT'};},async getTurn(){gets++;return cached;}};
  const ss=createLiveSession({archive:a,client}),legacy=await ss.startNew({...frozen.options,runId:'old'},null);
  const blocked=await ss.startNew({...frozen.options,experienceVersion:1},legacy.archiveId),afterBlock=await a.load();
  capability={available:false,errorCode:'AI_DISABLED',experienceVersion:1};const offline=await ss.startNew({...frozen.options,experienceVersion:1},legacy.archiveId);
  capability={available:true,storyActions:true,experienceVersion:1};const before=calls,modern=await ss.startNew(frozen.options,legacy.archiveId),creationChecks=calls-before;
  const b=await open('experience-import'),imported=await format.importLiveArchive(format.exportLiveArchive(a),b);
  capability={available:true,storyActions:true};const savedCalls=calls,restored=await ss.resume(),lookupCalls=calls-savedCalls;
  const beforeChoice=posts,waiting=await ss.choose({choiceId:restored.state.currentScene.choices[0].id,baseRevision:restored.state.revision,stateHash:identity.stateHash(restored.state)}),failedPosts=posts-beforeChoice;
  return {legacy:legacy.state.life.birth.cultivationProfile,blocked:blocked.errorCode,offline:offline.errorCode,kept:afterBlock.archiveId===legacy.archiveId,modern:modern.state.life.birth.cultivationProfile,creationChecks,restored:restored.state.phase,lookupCalls,gets,paused:waiting.errorCode,pending:!!waiting.pending,failedPosts,samePending:JSON.stringify(imported.pending)===JSON.stringify(modern.pending),sameState:identity.stateHash(imported.state)===identity.stateHash(modern.state)};
 });
 assert.equal(r.legacy.experienceVersion,undefined);assert.equal(r.blocked,'EXPERIENCE_UNSUPPORTED');assert.ok(r.offline);assert.equal(r.kept,true);
 assert.equal(r.modern.experienceVersion,1);assert.equal(r.creationChecks,1);assert.equal(r.restored,'active');assert.equal(r.lookupCalls,0);assert.equal(r.gets,1);
 assert.equal(r.paused,'EXPERIENCE_UNSUPPORTED');assert.equal(r.pending,true);assert.equal(r.failedPosts,0);assert.equal(r.sameState,true);assert.equal(r.samePending,true);
});

test('marked death cannot lose its experience contract or consume its only claim on an older service',async t=>{
 const {page}=await liveBrowser(t);const r=await page.evaluate(async()=>{
  const {createLiveSession}=await import('/src/ui/live-session.js'),{buildRebirthOptions}=await import('/src/game/cultivation/live/reincarnation.js');
  const f=await (await fetch('/tests/fixtures/v540-unmarked-v7.json')).json(),a=await open('experience-rebirth');
  const state=engine.createLiveGame({...f.options,experienceVersion:1});await a.create({state,pending:engine.prepareOpening(state,{requestId:'opening'})});
  let row=await a.load();
  do{
    const s=row.state,n=s.turnId+1,p=row.pending??engine.prepareChoice(s,{choiceId:s.currentScene.choices[0].id,requestId:'fight-'+n});
    if(!row.pending)await a.prepare(p);
    const scene=structuredClone(f.scene);scene.id=scene.id.replace(':t1:',':t'+n+':');for(const choice of scene.choices)choice.id=choice.id.replace(':t1:',':t'+n+':');
    Object.assign(scene.choices[0],{label:'与陈砚拼死一搏',intent:'fight',approach:'desperate',stake:'high',targetId:scene.entities[0].id});
    const dead=!!p.receipt.death;
    row=await a.commit({expectedRevision:s.revision,nextState:dead?engine.settleDeath(s,p):engine.commitTurn(s,p,scene),scene:dead?null:scene,memoryDelta:dead?null:memory.buildMemoryDelta(p.receipt,scene),requestId:p.identity.requestId});
    if(n>30)throw Error('combat fixture did not reach actual death');
  }while(row.state.phase!=='dead');
  const parent=row,opts=buildRebirthOptions(parent.state,[]),bad={...opts,runId:'downgraded'};delete bad.experienceVersion;
  const child=engine.createLiveGame(bad);let archiveCode=null;try{await a.reincarnate({state:child,pending:engine.prepareOpening(child,{requestId:'bad'}),expectedArchiveId:parent.archiveId,rewardIds:[]});}catch(e){archiveCode=e.code;}
  let version,posts=0;
  const client={async capabilities(){return {available:true,storyActions:true,experienceVersion:version};},async createSession(){return {sessionRef:'session'};},async requestTurn(){posts++;return {status:'paused',errorCode:'PROVIDER_TIMEOUT'};}};
  const ss=createLiveSession({archive:a,client});await ss.load();const refused=await ss.reincarnate({runId:'new-life'},[],parent.archiveId);
  const untouched=await a.load();version=1;const success=await ss.reincarnate({runId:'new-life'},[],parent.archiveId);
  return {archiveCode,required:opts.experienceVersion,refused:refused.errorCode,untouched:untouched.archiveId===parent.archiveId&&!untouched.reincarnatedTo,child:success.state.life.birth.cultivationProfile.experienceVersion,posts,recorded:(await a.load(parent.state.runId)).reincarnatedTo};
 });
 assert.equal(r.required,1);assert.equal(r.archiveCode,'REINCARNATION_INVALID_STATE');assert.equal(r.refused,'EXPERIENCE_UNSUPPORTED');assert.equal(r.untouched,true);assert.equal(r.child,1);assert.equal(r.posts,1);assert.equal(r.recorded,'new-life');
});
