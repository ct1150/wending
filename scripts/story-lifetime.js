// Opt-in acceptance against the ordinary public API. No scenes, actions,
// receipts or death conditions are supplied by this runner.
// node scripts/story-lifetime.js BASE_URL OUTPUT_DIR [SEED]
// WENDING_TEST_VERSION optionally selects a zero-traffic Worker candidate.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,appendFile,open} from 'node:fs/promises';
import path from 'node:path';
import {readFileSync,unlinkSync} from 'node:fs';
import {createLiveGame,prepareOpening,prepareChoice,commitTurn,settleDeath,compileChoices} from '../src/game/cultivation/live/engine.js';
import {buildStoryContext,validateGeneratedScene,buildMemoryDelta,sceneTurnRecord} from '../src/game/cultivation/live/memory.js';
import {serializeLiveState,deserializeLiveState} from '../src/game/cultivation/live/validation.js';
import {stateHash} from '../src/game/cultivation/live/identity.js';
import {nextRealmFor} from '../src/game/cultivation/live/cultivation-rules.js';
import {getReincarnationSettlement,buildRebirthOptions,validateReincarnationClaim,reincarnationClaimForChild} from '../src/game/cultivation/live/reincarnation.js';
import {createStoryClient} from '../src/ui/story-client.js';
import {requestRecoverableTurn} from '../src/ui/story-recovery.js';

const [base,output,seed='complete-life-2026-11-01']=process.argv.slice(2);
if(!base||!output)throw Error('Usage: node scripts/story-lifetime.js BASE_URL OUTPUT_DIR [SEED]');
const root=path.resolve(output);await mkdir(root,{recursive:true});
// One writer per acceptance output. A killed process can leave this lock;
// verify it has stopped before manually removing it to resume the same life.
const lockPath=path.join(root,'runner.lock'),lockOwner=crypto.randomUUID();
let lock;
try{lock=await open(lockPath,'wx');}catch(error){if(error.code==='EEXIST')throw Error('Acceptance output already in use; verify the previous runner has stopped before removing '+lockPath);throw error;}
await lock.writeFile(lockOwner);await lock.close();
const releaseLock=()=>{try{if(readFileSync(lockPath,'utf8')===lockOwner)unlinkSync(lockPath);}catch{}};
process.once('exit',releaseLock);
for(const [signal,status]of [['SIGINT',130],['SIGTERM',143]])process.once(signal,()=>{releaseLock();process.exit(status);});
const checkpoint=path.join(root,'checkpoint.json'),transcript=path.join(root,'turns.jsonl');
const headers={origin:new URL(base).origin,...(process.env.WENDING_TEST_VERSION?{'Cloudflare-Workers-Version-Overrides':'baishi-wending="'+process.env.WENDING_TEST_VERSION+'"'}:{})};
let run;try{run=JSON.parse(await readFile(checkpoint,'utf8'));}catch{run={state:createLiveGame({runId:'lifetime-'+crypto.randomUUID(),seed,name:'林朔',engineVersion:7,experienceVersion:1,originStories:true}),records:[],metrics:{turns:0,failures:[],actions:{},elapsedDays:0,restores:0,maxContextBytes:0,zeroDayStreak:0,maxZeroDayStreak:0},pending:null,attempt:null};}
const save=()=>writeFile(checkpoint,JSON.stringify(run,null,2));
run.policy??=process.env.WENDING_LIFE_POLICY??'balanced';
const client=createStoryClient({location:new URL(base),fetch:async(route,options)=>{
 const response=await fetch(new URL(route,base),{...options,headers:{...headers,...options.headers,...(process.env.WENDING_TEST_TRACE&&route==='/api/story/turn'?{'X-Story-Preview':'1'}:{}),...(run.cookie?{cookie:run.cookie}:{})}});
 if(process.env.WENDING_TEST_TRACE&&response.headers.get('content-type')?.includes('text/event-stream')){const id=JSON.parse(options.body).attempt.id;response.clone().text().then(text=>writeFile(path.join(root,id+'.sse'),text)).catch(()=>{});}
 const cookie=response.headers.get('set-cookie');if(cookie)run.cookie=cookie.split(';')[0];return response;
}});
const resumingTerminal=Boolean(run.attempt&&run.metrics.failures.at(-1)?.result?.attemptId===run.attempt.id);
if(run.pending)run.pendingSourceCommit??=run.sourceCommit;
let capability,health;
for(let probe=0;probe<20;probe++){
 health=await(await fetch(new URL('/healthz',base),{headers,signal:AbortSignal.timeout(10000)})).json();capability=await client.capabilities();
 if((!process.env.WENDING_TEST_VERSION||capability.automaticRecovery===1)&&(!process.env.WENDING_EXPECT_SOURCE||health.sourceCommit===process.env.WENDING_EXPECT_SOURCE))break;
 await new Promise(resolve=>setTimeout(resolve,1500));
}
assert.equal(capability.available,true,JSON.stringify(capability));if(process.env.WENDING_TEST_VERSION)assert.equal(capability.automaticRecovery,1,'candidate has propagated');
if(process.env.WENDING_EXPECT_SOURCE)assert.equal(health.sourceCommit,process.env.WENDING_EXPECT_SOURCE);
run.sourceCommit=health.sourceCommit;run.frontendHash=health.htmlSha256;
if(resumingTerminal)run.pendingSourceCommit=run.sourceCommit;
run.runtimeHistory??=[];if(run.runtimeHistory.at(-1)?.sourceCommit!==health.sourceCommit)run.runtimeHistory.push({sourceCommit:health.sourceCommit,fromTurn:run.pending?.identity.turnId?(run.pending.identity.turnId+(run.pendingSourceCommit&&run.pendingSourceCommit!==health.sourceCommit?1:0)):run.state.turnId+1,observer:!!process.env.WENDING_TEST_TRACE});
if(!run.sessionRef){const session=await client.createSession();run.sessionRef=session.sessionRef;await save();}
run.metrics.recoveries??=[];
async function generate(pending,context){
 return requestRecoverableTurn({client,pending,context,attempt:run.attempt,storyActions:true,automatic:capability.automaticRecovery===1,onProgress:()=>{},
  onRecovery:event=>{run.metrics.recoveries.push({turn:pending.identity.turnId,...event});console.log(JSON.stringify({recovery:event,turn:pending.identity.turnId}));},
  replaceAttempt:async(previous,{reuse})=>{
   const session=await client.createSession();run.sessionRef=session.sessionRef;
   run.attempt=reuse?previous:{id:'attempt-'+crypto.randomUUID(),sessionRef:session.sessionRef,retryOf:{attemptId:previous.id,sessionRef:previous.sessionRef}};
   if(!reuse)run.pendingSourceCommit=run.sourceCommit;
   if(run.childPending?.identity.requestId===pending.identity.requestId)run.childAttempt=run.attempt;
   await save();return run.attempt;
  }
 });
}
// Restarting after a recorded terminal failure is an explicit retry. A lost
// response with no recorded result keeps its exact attempt for safe replay.
if(resumingTerminal){const old=run.attempt;run.attempt={id:'attempt-'+crypto.randomUUID(),sessionRef:run.sessionRef,retryOf:{attemptId:old.id,sessionRef:old.sessionRef}};await save();}
function select(){
 const s=run.state,next=nextRealmFor(s.life),offered=compileChoices(s,s.currentScene.choices).filter(row=>row.enabled);
 assert.ok(offered.length>=2,'at least two generated enabled choices');
 const prior=s.lastReceipt.action;
 function score(c){
  if(c.intent==='rest')return s.life.injury>0||s.life.cultivationProfile.spirit<30?110:c.approach==='retire'?(run.policy==='patient'?85:25):5;
  if(c.intent==='practice')return c.approach==='breakthrough'?(run.policy==='patient'?40:100):c.approach==='forbidden'?15:65;
  if(c.intent==='craft')return c.approach==='repay'?95:c.approach==='restore'?85:c.approach==='diagnose'?75:c.approach==='study'&&next?.material==='manual'&&!s.life.items.manual?80:40;
  if(c.intent==='explore')return c.targetId===next?.material&&!s.life.items[next.material]?90:c.targetId==='supplies'&&s.life.items.supplies<2?75:35;
  if(c.intent==='travel')return prior?.intent==='travel'?20:50;
  if(c.intent==='negotiate')return c.approach==='pressure'?0:45;
  if(c.intent==='fight')return -10;
  if(c.intent==='evade')return 60;
  if(c.intent==='interact')return c.approach==='ask'?(prior?.approach==='ask'?6:18):c.approach==='observe'?(prior?.approach==='observe'?2:12):8;
  return 0;
 }
 return offered.map((c,i)=>({c,score:score(c),i})).sort((a,b)=>b.score-a.score||a.i-b.i)[0].c;
}
function related(){
 const wanted=new Set(run.state.relatedEntities.map(e=>e.id));
 const open=run.records.filter(r=>['clue','promise'].includes(r.kind)&&r.status==='open');for(const r of open)wanted.add(r.entityId);
 return run.records.filter(r=>r.kind==='turn'&&r.turnId>=run.state.turnId-3||wanted.has(r.entityId)||r.kind==='entity'&&wanted.has(r.entity.id)).slice(-256);
}
function remember(pending,scene){
 const common={runId:run.state.runId,turnId:pending.identity.turnId};
 const rows=[sceneTurnRecord(scene,{...common,action:pending.receipt.action}),...buildMemoryDelta(pending.receipt,scene).records.map(row=>({...common,...row})),...scene.entities.map(e=>{const {status='unknown',...entity}=e;return {...common,id:'entity:'+e.id,source:'narrative',kind:'entity',entity,status};})];
 const map=new Map(run.records.map(r=>[r.id,r]));for(const row of rows)map.set(row.id,row);run.records=[...map.values()];
}
while(run.state.phase!=='dead'){
 const before=run.state;
 if(!run.pending){const choice=before.phase==='awaitingOpening'?null:select();run.pending=choice?prepareChoice(before,{requestId:'req-'+crypto.randomUUID(),choiceId:choice.id}):prepareOpening(before,{requestId:'req-'+crypto.randomUUID()});run.attempt=null;run.pendingSourceCommit=run.sourceCommit;await save();}
 const pending=run.pending;
 assert.equal(stateHash(deserializeLiveState(serializeLiveState(before))),stateHash(before));run.metrics.restores++;
 // Real rule death needs no inference and cannot be changed by the narrator.
 if(pending.receipt.death){run.state=settleDeath(before,pending);run.metrics.elapsedDays+=pending.receipt.elapsedDays;await appendFile(transcript,JSON.stringify({turn:pending.identity.turnId,selected:pending.receipt.action,receipt:pending.receipt,death:true,stateHash:stateHash(run.state)})+'\n');run.pending=null;await save();break;}
 const records=related(),context=buildStoryContext(before,pending,records,{selection:'relevance-v1',openTotal:run.records.filter(r=>['clue','promise'].includes(r.kind)&&r.status==='open').length});
 run.metrics.maxContextBytes=Math.max(run.metrics.maxContextBytes,new TextEncoder().encode(JSON.stringify(context)).length);
 if(!run.attempt){run.attempt={id:'attempt-'+crypto.randomUUID(),sessionRef:run.sessionRef,retryOf:null};await save();}
 const started=Date.now(),{result}=await generate(pending,context);
 if(result.status!=='ready'){
  run.metrics.failures.push({turn:pending.identity.turnId,errorCode:result.errorCode,result});await save();await writeFile(path.join(root,'failure-context.json'),JSON.stringify(context,null,2));throw Error('Turn '+pending.identity.turnId+': '+result.errorCode);
 }
 validateGeneratedScene(result.scene,context);
 const after=commitTurn(before,pending,result.scene);
 assert.equal(before.revision+1,after.revision);assert.equal(after.life.ageDays-before.life.ageDays,pending.receipt.elapsedDays);
 assert.ok(compileChoices(after,after.currentScene.choices).filter(c=>c.enabled).length>=2);
 const snapshot=serializeLiveState(after);await writeFile(path.join(root,'save.json'),snapshot);assert.deepEqual(deserializeLiveState(await readFile(path.join(root,'save.json'),'utf8')),after);
 const action=pending.receipt.action,key=action?action.intent+':'+action.approach:'opening';run.metrics.actions[key]=(run.metrics.actions[key]??0)+1;
 run.metrics.zeroDayStreak=pending.receipt.elapsedDays===0?run.metrics.zeroDayStreak+1:0;run.metrics.maxZeroDayStreak=Math.max(run.metrics.maxZeroDayStreak,run.metrics.zeroDayStreak);
 run.metrics.turns++;run.metrics.elapsedDays+=pending.receipt.elapsedDays;
 remember(pending,result.scene);
 await appendFile(transcript,JSON.stringify({turn:pending.identity.turnId,age:after.life.ageDays/360,realm:after.life.realm,selected:action,receipt:pending.receipt,scene:result.scene,sourceCommit:run.pendingSourceCommit??run.sourceCommit,contextHash:stateHash(context),stateHash:stateHash(after),latencyMs:Date.now()-started})+'\n');
 run.state=after;run.pending=null;run.attempt=null;run.pendingSourceCommit=null;await save();
 console.log(JSON.stringify({turn:after.turnId,age:Math.round(after.life.ageDays/36)/10,realm:after.life.realm,injury:after.life.injury,spirit:after.life.cultivationProfile.spirit,selected:action?.label??'开局',text:result.scene.blocks.map(b=>b.text).join(' '),choices:result.scene.choices.map(c=>({text:c.label,action:c.intent+':'+c.approach}))}));
}
const dead=run.state,settlement=getReincarnationSettlement(dead);assert.ok(settlement);assert.ok(dead.life.injury>=10||dead.life.ageDays>=dead.life.lifeLimit*360);
assert.deepEqual(getReincarnationSettlement(deserializeLiveState(serializeLiveState(dead))),settlement);
const rewards=settlement.availablePoints>=2?['past-memory']:[],child=run.child??createLiveGame({runId:'reborn-'+crypto.randomUUID(),seed:seed+'-child',name:'林继',originStories:true,...buildRebirthOptions(dead,rewards)});
validateReincarnationClaim(reincarnationClaimForChild(child),dead);assert.equal(child.reincarnation.generation,2);
run.child=child;run.childPending??=prepareOpening(child,{requestId:'req-'+crypto.randomUUID()});run.attempt=run.childAttempt??{id:'attempt-'+crypto.randomUUID(),sessionRef:run.sessionRef,retryOf:null};run.childAttempt=run.attempt;await save();
const childContext=buildStoryContext(child,run.childPending,[]),{result:childResult}=await generate(run.childPending,childContext);assert.equal(childResult.status,'ready',JSON.stringify(childResult));validateGeneratedScene(childResult.scene,childContext);
const childAfter=commitTurn(child,run.childPending,childResult.scene);assert.equal(childAfter.reincarnation.generation,2);assert.deepEqual(deserializeLiveState(serializeLiveState(childAfter)),childAfter);await writeFile(path.join(root,'child.json'),serializeLiveState(childAfter));
const report={completed:true,version:process.env.WENDING_TEST_VERSION??'production',sourceCommit:run.sourceCommit,frontendHash:run.frontendHash,runtimeHistory:run.runtimeHistory,seed,policy:run.policy,metrics:run.metrics,settlement,deathAge:dead.life.ageDays/360,deathCause:dead.lastReceipt.death,deathHash:stateHash(dead),childHash:stateHash(childAfter),rewards,childGeneration:childAfter.reincarnation.generation,childOpening:true};
await writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
