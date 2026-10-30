import test from 'node:test';
import assert from 'node:assert/strict';
import { getReincarnationSettlement, buildRebirthOptions, validateReincarnation, reincarnationClaimForChild, validateReincarnationClaim, REINCARNATION_REWARDS } from '../src/game/cultivation/live/reincarnation.js';

const dead=()=>({runId:'first-life',phase:'dead',turnId:50,life:{name:'陆岑',ageDays:80*360,lifeLimit:80,realm:'mortal',injury:0},lastReceipt:{death:{cause:'lifespan'}}});

test('death settlement is derived from actual life, repeat reads never credit currency',()=>{
  const state=dead(),before=JSON.stringify(state),a=getReincarnationSettlement(state),b=getReincarnationSettlement(state);
  assert.deepEqual(a,b);assert.equal(a.generation,1);assert.equal(a.earnedPoints,5);assert.equal(a.availablePoints,5);assert.match(a.summary,/陆岑.*80\.0/);assert.ok(a.epitaph);assert.equal(JSON.stringify(state),before);
  assert.equal(getReincarnationSettlement({...state,phase:'active'}),null);
});

test('rebirth spends only affordable distinct rewards and carries exact remaining points',()=>{
  const first=dead(),options=buildRebirthOptions(first,['past-memory','resilient-body']);
  assert.equal(options.engineVersion,7);assert.equal(options.reincarnation.generation,2);assert.equal(options.reincarnation.lineageId,first.runId);assert.equal(options.reincarnation.balance,0);
  assert.deepEqual(options.inheritedBenefits,['past-memory','resilient-body']);validateReincarnation(options.reincarnation);
  assert.throws(()=>buildRebirthOptions(first,['former-relic','resilient-body']),{code:'REINCARNATION_INSUFFICIENT_POINTS'});
  assert.throws(()=>buildRebirthOptions(first,['past-memory','past-memory']),{code:'REINCARNATION_INVALID_REWARDS'});
  assert.throws(()=>buildRebirthOptions(first,['free-god-mode']),{code:'REINCARNATION_INVALID_REWARDS'});
  assert.equal(REINCARNATION_REWARDS.length,4);
});

test('a later death retains lineage balance without inheriting old benefits for free',()=>{
  const first=dead(),second={...dead(),runId:'second-life',reincarnation:buildRebirthOptions(first,['past-memory']).reincarnation};
  const settlement=getReincarnationSettlement(second),third=buildRebirthOptions(second,[]);
  assert.equal(settlement.carriedPoints,3);assert.equal(settlement.availablePoints,8);assert.equal(third.reincarnation.balance,8);assert.equal(third.reincarnation.generation,3);assert.deepEqual(third.inheritedBenefits,[]);assert.equal(third.reincarnation.lineageId,'first-life');
});

test('living characters and false deaths cannot receive reincarnation rewards',()=>{
  assert.throws(()=>buildRebirthOptions({...dead(),phase:'active'},[]),{code:'REINCARNATION_REQUIRES_DEATH'});
  assert.throws(()=>buildRebirthOptions({...dead(),life:{...dead().life,ageDays:20*360}},[]),{code:'REINCARNATION_REQUIRES_DEATH'});
  const result=buildRebirthOptions(dead(),[]).reincarnation;assert.throws(()=>validateReincarnation({...result,balance:-1}));assert.throws(()=>validateReincarnation({...result,purchases:['unknown']}));
});

test('a spent logical life retains its claim across earlier backups without permitting a new settlement',()=>{
  const parent=dead(),child={runId:'child',reincarnation:buildRebirthOptions(parent,[]).reincarnation},claim=reincarnationClaimForChild(child);
  const earlier={...parent,phase:'active',life:{...parent.life,ageDays:20*360},lastReceipt:{death:null}};
  validateReincarnationClaim(claim,parent);
  validateReincarnationClaim(claim,earlier,{matchDeathSnapshot:false});
  assert.throws(()=>validateReincarnationClaim(claim,earlier),{code:'REINCARNATION_INVALID_STATE'});
  assert.throws(()=>validateReincarnationClaim(claim,{...earlier,runId:'different-life'},{matchDeathSnapshot:false}),{code:'REINCARNATION_INVALID_STATE'});
  assert.throws(()=>buildRebirthOptions(earlier,[]),{code:'REINCARNATION_REQUIRES_DEATH'});
});
