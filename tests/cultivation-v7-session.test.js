import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveSession } from '../src/ui/live-session.js';
import { createLiveGame } from '../src/game/cultivation/live/engine.js';
import { stateHash } from '../src/game/cultivation/live/identity.js';

function blockedFixture({ claimed = false } = {}) {
  const state=createLiveGame({runId:'session-v7',seed:42});
  state.life.cultivationProfile={version:7};
  const row={archiveId:'archive-v7',state,pending:null,attempt:null,...(claimed?{reincarnatedTo:'child-life'}:{})};
  const calls={prepare:0,create:0,capability:0};
  const archive={async load(){return structuredClone(row);},async prepare(){calls.prepare++;throw Error('invalid actions must not prepare');},async reincarnate(){calls.create++;throw Error('a claimed life must not create again');}};
  const client={async capabilities(){calls.capability++;throw Error('invalid actions must not infer');}};
  const engine={prepareChoice(){throw Object.assign(Error('【该行动超出当前场景能力范围，请重新选择。】'),{code:'CUSTOM_ACTION_UNSUPPORTED'});}};
  return {state,row,calls,session:createLiveSession({archive,client,engine})};
}

test('unsupported custom action stays at the same decision without creating a pending turn or inference', async () => {
  const {state,calls,session}=blockedFixture();
  await session.load();
  const result=await session.choose({customAction:'立刻飞升天界',baseRevision:state.revision,stateHash:stateHash(state)});
  assert.equal(result.errorCode,'CUSTOM_ACTION_UNSUPPORTED');
  assert.equal(result.status,'ready');
  assert.equal(result.pending,null);
  assert.deepEqual(result.state,state);
  assert.deepEqual(calls,{prepare:0,create:0,capability:0});
});

test('reincarnation cannot create another child once the parent archive carries its claim', async () => {
  const {state,calls,session}=blockedFixture({claimed:true});
  state.phase='dead';state.life.injury=10;state.lastReceipt={death:{cause:'injury'}};
  await session.load();
  assert.equal(typeof session.reincarnate,'function');
  const result=await session.reincarnate({runId:'second-child',name:'沈渡',seed:7},[],'archive-v7');
  assert.equal(result.errorCode,'REINCARNATION_ALREADY_CLAIMED');
  assert.equal(result.state.runId,'session-v7');
  assert.equal(result.pending,null);
  assert.deepEqual(calls,{prepare:0,create:0,capability:0});
});
