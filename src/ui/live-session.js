import { createLiveGame, prepareOpening, prepareChoice, commitTurn, settleDeath } from '../game/cultivation/live/engine.js';
import { buildStoryContext, validateGeneratedScene, buildMemoryDelta } from '../game/cultivation/live/memory.js';
import { stateHash } from '../game/cultivation/live/identity.js';
const defaultEngine={createLiveGame,prepareOpening,prepareChoice,commitTurn,settleDeath};
const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const id=()=>globalThis.crypto.randomUUID();
const fault=code=>Object.assign(new Error(code),{code});
export function createLiveSession({archive,client,engine=defaultEngine,onChange=()=>{},onProgress=()=>{}}) {
  let loaded=null,busy=false,status='idle',errorCode=null,preview=null,generationStatus='generating';
  function view(){return copy({...loaded,state:loaded?.state??null,pending:loaded?.pending??null,attempt:loaded?.attempt??null,status,errorCode,busy,preview,generationStatus});}
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
      ...row.state.relatedEntities.map(entity=>entity.id),
      row.pending.receipt.action?.targetId,
    ].filter(Boolean))];
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
  async function generate(row,{reuseAttempt=false}={}) {
    preview=null;generationStatus='generating';
    if(await death(row))return;
    const capability=await client.capabilities();
    if(!capability.available)throw fault(capability.errorCode||'SERVICE_UNAVAILABLE');
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
      const result=await client.requestTurn(row.pending,context,attempt,{storyActions:generation.storyActions,onProgress:event=>{
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
      status='paused';
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
      if(loaded&&loaded.state.phase!=='dead')return;
      const expectedArchiveId=loaded?.archiveId??null;
      const state=engine.createLiveGame(options);
      const pending=engine.prepareOpening(state,{requestId:id()});
      // Validate the exact opening DTO before activating immutable birth facts.
      try { buildStoryContext(state,pending,[],{selection:'relevance-v1',openTotal:0}); }
      catch { throw fault('BIRTH_CONTEXT_INVALID'); }
      loaded=await archive.create({state,pending,expectedArchiveId});
      preview=null;
      status='pending';
      emit();
      await generate(loaded);
    });
  }
  function startNew(options={},expectedArchiveId=null) {
    if(busy)return Promise.resolve({...view(),errorCode:'SESSION_BUSY'});
    return run(async()=>{
      await reload();
      if((loaded?.archiveId??null)!==expectedArchiveId)throw fault('ARCHIVE_CONFLICT');
      const state=engine.createLiveGame(options);
      const pending=engine.prepareOpening(state,{requestId:id()});
      try { buildStoryContext(state,pending,[],{selection:'relevance-v1',openTotal:0}); }
      catch { throw fault('BIRTH_CONTEXT_INVALID'); }
      loaded=await archive.create({state,pending,expectedArchiveId});
      preview=null;
      status='pending';
      errorCode=null;
      emit();
      await generate(loaded);
    });
  }
  function load() {
    if(busy)return Promise.resolve({...view(),errorCode:'SESSION_BUSY'});
    return run(reload);
  }
  function selectJourney(archiveId,expectedArchiveId) {
    if(busy)return Promise.resolve({...view(),errorCode:'SESSION_BUSY'});
    return run(async()=>{
      await archive.selectJourney(archiveId,expectedArchiveId);
      await reload();
    });
  }
  function choose(command) {
    const expectedArchiveId=loaded?.archiveId;
    return run(async()=>{
      await reload(expectedArchiveId);
      if(!loaded||loaded.pending)throw fault('TURN_ALREADY_PENDING');
      if(command.baseRevision!==loaded.state.revision||command.stateHash!==stateHash(loaded.state))throw fault('STALE_CHOICE');
      const pending=engine.prepareChoice(loaded.state,{...command,requestId:id()});
      if(pending.receipt.action?.intent==='interact'&&['decline','leave'].includes(pending.receipt.action.approach)){
        loaded=await archive.commitInteraction({expectedArchiveId:loaded.archiveId,expectedRevision:loaded.state.revision,pending});
        preview=null;status='ready';errorCode=null;emit();return;
      }
      loaded=await archive.prepare(pending);
      status='pending';
      emit();
      await generate(loaded);
    });
  }
  function resume() {
    const expectedArchiveId=loaded?.archiveId;
    return run(async()=>{
      await reload(expectedArchiveId);
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
    const expectedArchiveId=loaded?.archiveId;
    return run(async()=>{
      await reload(expectedArchiveId);
      if(!loaded?.pending||await death(loaded))return;
      const row=loaded;
      if(row.attempt) {
        const result=await client.getTurn(row.pending,row.attempt);
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
        if(result.errorCode==='ATTEMPT_IN_PROGRESS'&&result.retry?.afterMs>0)throw fault('ATTEMPT_IN_PROGRESS');
      }
      await generate(row);
    });
  }
  return {start,startNew,load,selectJourney,choose,resume,retry,view};
}
