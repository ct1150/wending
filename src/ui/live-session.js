import { createLiveGame, prepareOpening, prepareChoice, commitTurn, settleDeath } from '../game/cultivation/live/engine.js';
import { buildStoryContext, validateGeneratedScene, buildMemoryDelta } from '../game/cultivation/live/memory.js';
import { stateHash } from '../game/cultivation/live/identity.js';
import { isExperienceLife, EXPERIENCE_VERSION } from '../game/cultivation/live/experience.js';
import { buildRebirthOptions } from '../game/cultivation/live/reincarnation.js';
import {MORTAL_OPENING} from '../game/cultivation/live/mortal-opening.js';
import {requestRecoverableTurn} from './story-recovery.js';
import {buildEventProseBrief,validateProseText} from '../game/cultivation/live/event-prose.js';
import {practicePlan} from '../game/cultivation/live/practice-plan.js';
import {journeyNotes,noteMenuSteps,noteRoutes} from '../game/cultivation/live/journey-notes.js';
const defaultEngine={createLiveGame,prepareOpening,prepareChoice,commitTurn,settleDeath};
const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const id=()=>globalThis.crypto.randomUUID();
const fault=code=>Object.assign(new Error(code),{code});
export function createLiveSession({archive,client,engine=defaultEngine,onChange=()=>{},onProgress=()=>{}}) {
  let loaded=null,busy=false,status='idle',errorCode=null,preview=null,generationStatus='generating',prose=null;
  let practice=null;
  function proseMatches(row,brief){return row?.archiveId===brief.archiveId&&row.state?.phase==='active'&&row.state.events&&row.state.revision===brief.revision&&buildEventProseBrief(row.state,row.archiveId).sourceHash===brief.sourceHash;}
  function view(){
    if(prose&&!proseMatches(loaded,prose.brief))prose=null;
    const samePractice=practice&&practice.archiveId===loaded?.archiveId&&practice.revision===loaded?.state.revision;
    return copy({...loaded,state:loaded?.state??null,pending:loaded?.pending??null,attempt:loaded?.attempt??null,status,errorCode,busy,preview,generationStatus,...(samePractice?{practice}:{}),...(loaded?.state.events?{prose:prose?{status:prose.status,text:prose.text}:null}:{})});
  }
  function emit(){onChange(view());}
  async function reload(expectedArchiveId) {
    const next=await archive.load();
    // A continuation belongs to the displayed physical archive, including
    // when another tab activates an imported copy of the same logical run.
    if(expectedArchiveId!==undefined&&(next?.archiveId??null)!==expectedArchiveId)throw fault('ARCHIVE_CONFLICT');
    if(next?.archiveId!==loaded?.archiveId||next?.pending?.identity.requestId!==loaded?.pending?.identity.requestId||next?.attempt?.id!==loaded?.attempt?.id)preview=null;
    loaded=next;
    status=loaded?.pending?'paused':loaded?.state.phase==='dead'?'dead':loaded?'ready':'idle';
    errorCode=loaded?.pause??null;
    emit();
    return loaded;
  }
  async function contextFor(row,scene=null,continuity=row.generation?.storyActions??!row.attempt) {
    if(row.generation)return copy(row.generation.context);
    if(scene) {
      // Cached replies may have been generated with an earlier selection window.
      // Validate exact closure references and all returned identities directly,
      // without asking inference to regenerate or weakening archive checks.
      const entityIds=[...new Set([...row.state.relatedEntities,...scene.entities].map(entity=>entity.id))];
      const referenceIds=scene.memoryDeltas.flatMap(delta=>delta.referenceId?[delta.referenceId]:[]);
      const records=await archive.readRelated(row.state.runId,{entityIds,referenceIds,includeOpen:false,factsPerEntity:0});
      return buildStoryContext(row.state,row.pending,records,{continuity:false});
    }
    const entityIds=[...new Set([
      row.pending.receipt.action?.targetId,
      row.state.life.cultivationProfile?.experience?.commitment?.entityId,
      row.state.director?.mainQuest?.entityId,
      ...(row.state.director?.sideQuests??[]).map(quest=>quest.entityId),
      ...(row.state.director?.memory?.clues??[]).map(clue=>clue.entityId),
      ...row.state.relatedEntities.map(entity=>entity.id),
    ].filter(Boolean))].slice(0,25);
    const selected=await archive.readStoryRecords(row.state.runId,{entityIds,recent:continuity});
    return buildStoryContext(row.state,row.pending,selected.records,{
      selection:'relevance-v1',
      openTotal:selected.openTotal,
      continuity,
    });
  }
  async function apply(row,result,context) {
    if(result.status!=='ready') {
      status='paused';
      errorCode=result.errorCode||'SERVICE_UNAVAILABLE';
      emit();
      return false;
    }
    if(result.requestId!==row.pending.identity.requestId || result.attemptId!==row.attempt.id || result.sessionRef!==row.attempt.sessionRef) {
      throw fault('RESPONSE_IDENTITY_MISMATCH');
    }
    const validatedContext=context??await contextFor(row,result.scene);
    const scene=validateGeneratedScene(result.scene,validatedContext);
    const nextState=engine.commitTurn(row.state,row.pending,scene,validatedContext.relationships);
    loaded=await archive.commit({
      expectedRevision:row.state.revision,
      expectedAttemptId:row.attempt.id,
      nextState,scene,
      memoryDelta:buildMemoryDelta(row.pending.receipt,scene),
      requestId:row.pending.identity.requestId,
    });
    preview=null;
    status='ready';
    errorCode=null;
    emit();
    return true;
  }
  async function death(row) {
    if(!row.pending?.receipt.death)return false;
    loaded=await archive.commit({
      expectedRevision:row.state.revision,
      nextState:engine.settleDeath(row.state,row.pending),
      scene:null,memoryDelta:null,
      requestId:row.pending.identity.requestId,
    });
    status='dead';
    errorCode=null;
    emit();
    return true;
  }
  // Decide the immutable birth contract BEFORE creating/replacing a physical
  // archive. Older available servers still support their original unmarked V7.
  async function birthContract(options,required=false){
    if(options.eventVersion===1)return {options};
    if(options.engineVersion!==7&&!Object.hasOwn(options,'experienceVersion'))return {options};
    if(Object.hasOwn(options,'experienceVersion')&&(options.engineVersion!==7||options.experienceVersion!==EXPERIENCE_VERSION))throw fault('EXPERIENCE_UNSUPPORTED');
    const capability=await client.capabilities();
    if(!capability.available)throw fault(capability.errorCode||'SERVICE_UNAVAILABLE');
    const supported=capability.experienceVersion===EXPERIENCE_VERSION;
    const mortal=options.originId===MORTAL_OPENING.originId||options.originStories===true&&options.originId==null;
    if(mortal&&capability.openingStoryVersion!==1)throw fault('EXPERIENCE_UNSUPPORTED');
    if(options.originStories && (!supported || capability.originStories!==true || capability.storyActions!==true))throw fault('EXPERIENCE_UNSUPPORTED');
    if(!supported&&(required||Object.hasOwn(options,'experienceVersion')))throw fault('EXPERIENCE_UNSUPPORTED');
    return {options:supported?{...options,experienceVersion:EXPERIENCE_VERSION}:options,capability};
  }
  async function generate(row,{reuseAttempt=false,capability:knownCapability}={}) {
    preview=null;generationStatus='generating';
    if(row.state.events){
      loaded=await archive.commitEvent({expectedArchiveId:row.archiveId,expectedRevision:row.state.revision,pending:row.pending});
      status=loaded.state.phase==='dead'?'dead':'ready';errorCode=null;emit();return;
    }
    if(await death(row))return;
    const capability=knownCapability??await client.capabilities();
    if(!capability.available)throw fault(capability.errorCode||'SERVICE_UNAVAILABLE');
    if(row.state.life.birth.originId===MORTAL_OPENING.originId&&capability.openingStoryVersion!==1)throw fault('EXPERIENCE_UNSUPPORTED');
    if(isExperienceLife(row.state.life)&&capability.experienceVersion!==EXPERIENCE_VERSION)throw fault('EXPERIENCE_UNSUPPORTED');
    if(row.state.life.birth.backgroundId && (capability.originStories!==true || capability.storyActions!==true))throw fault('EXPERIENCE_UNSUPPORTED');
    const storyActions=!row.attempt&&capability.storyActions===true;
    if(capability.storyActions!==true&&(row.generation?.storyActions||row.pending.receipt.action?.intent==='interact'))throw fault('SERVICE_UNAVAILABLE');
    const generation=row.generation??{storyActions,context:await contextFor(row,null,storyActions)};
    const context=generation.context;
    const session=await client.createSession();
    const previous=row.attempt;
    let attempt;
    if(reuseAttempt&&previous?.sessionRef===session.sessionRef) {
      // Re-check the durable frozen request before an idempotent same-ID POST;
      // the coordinator replays charged attempts without another inference.
      loaded=await archive.prepare(row.pending);
      if(JSON.stringify(loaded.attempt)!==JSON.stringify(previous))throw fault('ARCHIVE_ATTEMPT_CONFLICT');
      attempt=previous;
      if(!row.generation)loaded=await archive.setAttempt({runId:row.state.runId,requestId:row.pending.identity.requestId,expectedAttemptId:previous.id,attempt,generation});
    } else {
      attempt={id:id(),sessionRef:session.sessionRef,retryOf:previous?{attemptId:previous.id,sessionRef:previous.sessionRef}:null};
      // CAS precedes POST: a losing tab must not invoke inference.
      loaded=await archive.setAttempt({
        runId:row.state.runId,
        requestId:row.pending.identity.requestId,
        expectedAttemptId:previous?.id??null,
        attempt,
        generation,
      });
    }
    status='pending';
    errorCode=null;
    emit();
    let active=true;
    try{
      const recovered=await requestRecoverableTurn({client,pending:row.pending,context,attempt,storyActions:generation.storyActions,automatic:capability.automaticRecovery===1,replaceAttempt:async(previousAttempt,{reuse})=>{
        const current=await archive.prepare(row.pending);
        if(current.attempt?.id!==previousAttempt.id||current.pending?.identity.requestId!==row.pending.identity.requestId)throw fault('ARCHIVE_ATTEMPT_CONFLICT');
        const authenticated=await client.createSession();
        attempt=reuse&&authenticated.sessionRef===previousAttempt.sessionRef?previousAttempt:{id:id(),sessionRef:authenticated.sessionRef,retryOf:{attemptId:previousAttempt.id,sessionRef:previousAttempt.sessionRef}};
        loaded=await archive.setAttempt({runId:row.state.runId,requestId:row.pending.identity.requestId,expectedAttemptId:previousAttempt.id,attempt,generation});
        preview=null;status='pending';errorCode=null;emit();return attempt;
      },onProgress:event=>{
        if(!active||loaded?.attempt?.id!==attempt.id||loaded?.pending?.identity.requestId!==row.pending.identity.requestId)return;
        if(event.type==='reset')preview=null;
        else if(event.type==='preview')preview={text:(preview?.text??'')+event.text};
        else if(event.type==='block'||event.type==='choice'){
          if(!preview?.blocks)preview={blocks:[],choices:[]};
          if(event.type==='block')preview.blocks[event.index]={kind:event.kind,text:event.text,...(event.speaker?{speaker:event.speaker}:{}),complete:event.complete};
          else preview.choices[event.index]={label:event.label,complete:event.complete};
        }
        else if(event.type==='status')generationStatus=event.status;
        onProgress(view());
      }});
      const result=recovered.result;
      active=false;
      await apply(loaded,result,context);
      return result;
    }finally{active=false;}
  }
  async function run(operation) {
    if(busy)return view();
    busy=true;
    emit();
    try {
      await operation();
    } catch(error) {
      try { await reload(); } catch {}
      status=error.code==='CUSTOM_ACTION_UNSUPPORTED'&&!loaded?.pending?'ready':'paused';
      errorCode=error.code||'STORAGE_OR_STATE_CONFLICT';
    } finally {
      busy=false;
      emit();
    }
    return view();
  }
  function start(options={}) {
    return run(async()=>{
      await reload();
      if(loaded)return;
      const expectedArchiveId=loaded?.archiveId??null;
      const birth=await birthContract(options);
      const state=engine.createLiveGame(birth.options);
      const pending=engine.prepareOpening(state,{requestId:id()});
      // Validate the exact opening DTO before activating immutable birth facts.
      try { buildStoryContext(state,pending,[],{selection:'relevance-v1',openTotal:0}); }
      catch { throw fault('BIRTH_CONTEXT_INVALID'); }
      loaded=await archive.create({state,pending,expectedArchiveId});
      preview=null;
      status='pending';
      emit();
      await generate(loaded,{capability:birth.capability});
    });
  }
  function startNew(options={},expectedArchiveId=null) {
    if(busy)return Promise.resolve({...view(),errorCode:'SESSION_BUSY'});
    return run(async()=>{
      await reload();
      if((loaded?.archiveId??null)!==expectedArchiveId)throw fault('ARCHIVE_CONFLICT');
      const birth=await birthContract(options);
      const state=engine.createLiveGame(birth.options);
      const pending=engine.prepareOpening(state,{requestId:id()});
      try { buildStoryContext(state,pending,[],{selection:'relevance-v1',openTotal:0}); }
      catch { throw fault('BIRTH_CONTEXT_INVALID'); }
      loaded=await archive.create({state,pending,expectedArchiveId});
      preview=null;
      status='pending';
      errorCode=null;
      emit();
      await generate(loaded,{capability:birth.capability});
    });
  }
  function reincarnate(options={},rewardIds=[],expectedArchiveId=null) {
    if(busy)return Promise.resolve({...view(),errorCode:'SESSION_BUSY'});
    return run(async()=>{
      await reload(expectedArchiveId);
      if(loaded?.reincarnatedTo)throw fault('REINCARNATION_ALREADY_CLAIMED');
      if(!loaded||loaded.pending||loaded.state.phase!=='dead')throw fault('REINCARNATION_REQUIRES_DEATH');
      const birth=await birthContract({...options,...buildRebirthOptions(loaded.state,rewardIds)},isExperienceLife(loaded.state.life));
      const state=engine.createLiveGame(birth.options);
      const pending=engine.prepareOpening(state,{requestId:id()});
      try { buildStoryContext(state,pending,[],{selection:'relevance-v1',openTotal:0}); }
      catch { throw fault('BIRTH_CONTEXT_INVALID'); }
      loaded=await archive.reincarnate({state,pending,rewardIds,expectedArchiveId});
      preview=null;status='pending';errorCode=null;emit();
      await generate(loaded,{capability:birth.capability});
    });
  }
  function load() {
    if(busy)return Promise.resolve({...view(),errorCode:'SESSION_BUSY'});
    return run(reload);
  }
  function choose(command) {
    const expectedArchiveId=loaded?.archiveId;
    return run(async()=>{
      await reload(expectedArchiveId);
      if(!loaded||loaded.pending)throw fault('TURN_ALREADY_PENDING');
      if(command.baseRevision!==loaded.state.revision||command.stateHash!==stateHash(loaded.state))throw fault('STALE_CHOICE');
      const pending=engine.prepareChoice(loaded.state,{...command,requestId:id()});
      if(loaded.state.events){
        loaded=await archive.commitEvent({expectedArchiveId:loaded.archiveId,expectedRevision:loaded.state.revision,pending});
        preview=null;status=loaded.state.phase==='dead'?'dead':'ready';errorCode=null;emit();return;
      }
      loaded=await archive.prepare(pending);
      status='pending';
      emit();
      await generate(loaded);
    });
  }
  function openJourneyNote(command,canContinue=()=>true){
    return run(async()=>{
      await reload(command.archiveId);
      if(!loaded||loaded.pending||loaded.archiveId!==command.archiveId||command.baseRevision!==loaded.state.revision||command.stateHash!==stateHash(loaded.state))throw fault('STALE_CHOICE');
      const entry=journeyNotes(loaded.state).find(n=>n.node===command.node);
      if(!entry)throw fault('STALE_CHOICE');
      const route=noteRoutes(loaded.state,[entry]).get(entry.node);
      if(!route?.length)throw fault('STALE_CHOICE');
      for(const key of route){
        if(!canContinue())break;
        const state=loaded.state,choice=state.currentScene.choices.find(c=>c.id.endsWith(':c:'+key));
        if(!choice||!noteMenuSteps(state).some(c=>c.key===key))throw fault('STALE_CHOICE');
        const pending=engine.prepareChoice(state,{choiceId:choice.id,requestId:id()});
        if(pending.receipt.elapsedDays||pending.receipt.random.before!==pending.receipt.random.after)throw fault('STALE_CHOICE');
        loaded=await archive.commitEvent({expectedArchiveId:command.archiveId,expectedRevision:state.revision,pending});
        preview=null;status='ready';errorCode=null;
      }
    });
  }
  function practiceUntil(command,canContinue=()=>true){
    return run(async()=>{
      await reload(command.archiveId);
      if(!loaded||loaded.pending||loaded.archiveId!==command.archiveId||command.baseRevision!==loaded.state.revision||command.stateHash!==stateHash(loaded.state))throw fault('STALE_CHOICE');
      const plan=practicePlan(loaded.state);
      if(!plan||!Number.isInteger(command.count)||command.count<2||command.count>plan.count)throw fault('STALE_CHOICE');
      practice={archiveId:loaded.archiveId,revision:loaded.state.revision,count:command.count,done:0,days:0,gain:0,running:true,stopped:false,reason:command.count===plan.count?plan.stop:'已按所选关数收功',stopNode:command.count===plan.count?plan.stopNode:null};
      try{
        while(practice.done<practice.count){
          if(practice.stopped||!canContinue()){practice.reason='已提前收功';practice.stopNode=null;break;}
          const step=practicePlan(loaded.state);
          if(!step||step.count<1){practice.reason=step?.stop??'已到下一处选择';practice.stopNode=step?.stopNode??null;break;}
          const pending=engine.prepareChoice(loaded.state,{choiceId:step.choiceId,requestId:id()});
          loaded=await archive.commitEvent({expectedArchiveId:command.archiveId,expectedRevision:practice.revision,pending});
          practice.revision=loaded.state.revision;
          practice.done++;practice.days+=pending.receipt.elapsedDays;
          practice.gain+=pending.receipt.after.cultivation-pending.receipt.before.cultivation;
          preview=null;status='ready';errorCode=null;emit();
        }
      }catch(error){
        practice.reason='连续稳修中断';practice.stopNode=null;throw error;
      }finally{practice.running=false;}
    });
  }
  function stopPractice(){if(practice?.running)practice.stopped=true;}
  function resume() {
    const expectedArchiveId=loaded?.archiveId;
    return run(async()=>{
      await reload(expectedArchiveId);
      if(loaded?.pending&&loaded.state.events){await generate(loaded);return;}
      if(!loaded?.pending||await death(loaded))return;
      if(!loaded.attempt) {
        status='paused';
        errorCode='AWAITING_EXPLICIT_RETRY';
        return;
      }
      await apply(loaded,await client.getTurn(loaded.pending,loaded.attempt));
    });
  }
  function retry() {
    const displayed=loaded;
    return run(async()=>{
      await reload(displayed?.archiveId);
      if(!loaded?.pending)return;
      // A click belongs to the displayed decision and attempt, including across tabs.
      if(displayed&&(loaded.pending.identity.requestId!==displayed.pending?.identity.requestId||loaded.attempt?.id!==displayed.attempt?.id))return;
      if(loaded.state.events){await generate(loaded);return;}
      if(await death(loaded))return;
      const row=loaded;
      if(row.attempt) {
        const result=await client.getTurn(row.pending,row.attempt);
        if(result.status==='rejected'&&(result.requestId!==row.pending.identity.requestId||result.attemptId!==row.attempt.id||result.sessionRef!==row.attempt.sessionRef))throw fault('RESPONSE_IDENTITY_MISMATCH');
        if(await apply(row,result))return;
        if(result.errorCode==='ATTEMPT_NOT_FOUND'&&(result.requestId!==row.pending.identity.requestId||result.attemptId!==row.attempt.id))throw fault('RESPONSE_IDENTITY_MISMATCH');
        if(result.errorCode==='ATTEMPT_NOT_ADMITTED') {
          await generate(row,{reuseAttempt:true});
          return;
        }
        if(result.errorCode==='ATTEMPT_NOT_FOUND'&&result.requestId===row.pending.identity.requestId&&result.attemptId===row.attempt.id&&result.sessionRef===row.attempt.sessionRef){
          // Retry the immutable idempotency key first. A charged ledger entry
          // cannot be inferred again, even when its response cache is missing.
          const replayed=await generate(row,{reuseAttempt:true});
          if(replayed?.status==='paused'&&replayed.errorCode==='ATTEMPT_NOT_FOUND'&&replayed.requestId===row.pending.identity.requestId&&replayed.attemptId===row.attempt.id&&replayed.sessionRef===row.attempt.sessionRef)await generate(loaded);
          return;
        }
        if(result.errorCode==='ATTEMPT_IN_PROGRESS')return;
      }
      await generate(row);
    });
  }
  async function expandProse(){
    if(busy||loaded?.pending||!loaded?.state.events||loaded.state.phase!=='active'||prose)return view();
    const current={brief:buildEventProseBrief(loaded.state,loaded.archiveId),status:'loading',text:''};prose=current;emit();
    try{
      const capability=await client.capabilities();
      if(!capability.available||capability.proseVersion!==1)throw fault('SERVICE_UNAVAILABLE');
      if(prose!==current||!proseMatches(loaded,current.brief))return view();
      const session=await client.createSession(),attempt={id:id(),sessionRef:session.sessionRef,retryOf:null};
      if(prose!==current||!proseMatches(loaded,current.brief))return view();
      const result=await client.requestProse(current.brief,attempt);
      const physical=await archive.load();
      if(prose!==current||!proseMatches(loaded,current.brief)||!proseMatches(physical,current.brief))return view();
      if(result.status!=='ready'||result.requestId!==current.brief.requestId||result.attemptId!==attempt.id||result.sessionRef!==attempt.sessionRef||result.prose?.sourceHash!==current.brief.sourceHash)throw fault('PROVIDER_RESPONSE_INVALID');
      validateProseText(result.prose.text);current.status='ready';current.text=result.prose.text;
    }catch{
      if(prose===current&&proseMatches(loaded,current.brief))current.status='unavailable';
    }
    if(prose===current)emit();
    return view();
  }
  return {start,startNew,reincarnate,load,choose,openJourneyNote,practiceUntil,stopPractice,resume,retry,expandProse,view};
}
