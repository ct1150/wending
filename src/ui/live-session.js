import { createLiveGame, prepareOpening, prepareChoice, commitTurn, settleDeath } from '../game/cultivation/live/engine.js';
import { buildStoryContext, validateGeneratedScene, buildMemoryDelta } from '../game/cultivation/live/memory.js';
import { stateHash } from '../game/cultivation/live/identity.js';
const defaultEngine={createLiveGame,prepareOpening,prepareChoice,commitTurn,settleDeath};
const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const id=()=>globalThis.crypto.randomUUID();
const fault=code=>Object.assign(new Error(code),{code});
export function createLiveSession({archive,client,engine=defaultEngine,onChange=()=>{}}) {
  let loaded=null,busy=false,status='idle',errorCode=null;
  function view(){return copy({...loaded,state:loaded?.state??null,pending:loaded?.pending??null,attempt:loaded?.attempt??null,status,errorCode,busy});}
  function emit(){onChange(view());}
  async function reload(){loaded=await archive.load();status=loaded?.pending?'paused':loaded?.state.phase==='dead'?'dead':loaded?'ready':'idle';errorCode=loaded?.pause??null;emit();return loaded;}
  async function contextFor(row){const entityIds=[...new Set([...(row.state.relatedEntities??[]).map(e=>e.id),row.pending.receipt.action?.targetId].filter(Boolean))];return buildStoryContext(row.state,row.pending,await archive.readRelated(row.state.runId,{entityIds,includeOpen:true}));}
  async function apply(row,result,context){
    if(result.status!=='ready'){status='paused';errorCode=result.errorCode||'SERVICE_UNAVAILABLE';emit();return false;}
    if(result.requestId!==row.pending.identity.requestId||result.attemptId!==row.attempt.id||result.sessionRef!==row.attempt.sessionRef)throw fault('RESPONSE_IDENTITY_MISMATCH');
    const scene=validateGeneratedScene(result.scene,context??await contextFor(row));
    const nextState=engine.commitTurn(row.state,row.pending,scene);
    loaded=await archive.commit({expectedRevision:row.state.revision,expectedAttemptId:row.attempt.id,nextState,scene,memoryDelta:buildMemoryDelta(row.pending.receipt,scene),requestId:row.pending.identity.requestId});
    status='ready';errorCode=null;emit();return true;
  }
  async function death(row){if(!row.pending?.receipt.death)return false;loaded=await archive.commit({expectedRevision:row.state.revision,nextState:engine.settleDeath(row.state,row.pending),scene:null,memoryDelta:null,requestId:row.pending.identity.requestId});status='dead';errorCode=null;emit();return true;}
  async function generate(row){
    if(await death(row))return;
    const capability=await client.capabilities();if(!capability.available)throw fault(capability.errorCode||'SERVICE_UNAVAILABLE');
    const context=await contextFor(row);
    const session=await client.createSession();
    const previous=row.attempt;
    const attempt={id:id(),sessionRef:session.sessionRef,retryOf:previous?{attemptId:previous.id,sessionRef:previous.sessionRef}:null};
    // CAS precedes POST: a losing tab must not invoke inference.
    loaded=await archive.setAttempt({runId:row.state.runId,requestId:row.pending.identity.requestId,expectedAttemptId:previous?.id??null,attempt});
    status='pending';errorCode=null;emit();
    await apply(loaded,await client.requestTurn(row.pending,context,attempt),context);
  }
  async function run(operation){if(busy)return view();busy=true;emit();try{await operation();}catch(e){try{await reload();}catch{}status='paused';errorCode=e.code||'STORAGE_OR_STATE_CONFLICT';}finally{busy=false;emit();}return view();}
  function start(options={}){return run(async()=>{await reload();if(loaded&&loaded.state.phase!=='dead')return;const expectedArchiveId=loaded?.archiveId??null;const state=engine.createLiveGame(options);const pending=engine.prepareOpening(state,{requestId:id()});loaded=await archive.create({state,pending,expectedArchiveId});status='pending';emit();await generate(loaded);});}
  function choose(command){return run(async()=>{await reload();if(!loaded||loaded.pending)throw fault('TURN_ALREADY_PENDING');if(command.baseRevision!==loaded.state.revision||command.stateHash!==stateHash(loaded.state))throw fault('STALE_CHOICE');const pending=engine.prepareChoice(loaded.state,{...command,requestId:id()});loaded=await archive.prepare(pending);status='pending';emit();await generate(loaded);});}
  function resume(){return run(async()=>{await reload();if(!loaded?.pending||await death(loaded))return;if(!loaded.attempt){status='paused';errorCode='AWAITING_EXPLICIT_RETRY';return;}await apply(loaded,await client.getTurn(loaded.pending,loaded.attempt));});}
  function retry(){return run(async()=>{await reload();if(!loaded?.pending||await death(loaded))return;const row=loaded;if(row.attempt){let result;try{result=await client.getTurn(row.pending,row.attempt);}catch(e){throw e;}if(await apply(row,result))return;if(result.errorCode==='ATTEMPT_IN_PROGRESS'&&result.retry?.afterMs>0)throw fault('ATTEMPT_IN_PROGRESS');}await generate(row);});}
  return {start,choose,resume,retry,view};
}
